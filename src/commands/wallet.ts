import { Asset, Keypair, Operation } from '@stellar/stellar-sdk';
import {
  loadWallets,
  saveWallets,
  findWallet,
  encryptSecret,
  getPassphrase,
  keypairFor,
} from '../store.ts';
import { requireAssetConfig, assetFrom, BASE_RESERVE_XLM } from '../config.ts';
import { planUnsponsor, whyUnsponsorRefused } from '../sponsorship.ts';
import {
  snapshot,
  fundWithFriendbot,
  submit,
  hasTrustline,
  explorerTx,
  balanceOf,
} from '../stellar.ts';
import { formatPretty, parseAmount } from '../money.ts';

export async function walletCreate(label: string, quiet = false): Promise<void> {
  if (!label) throw new Error('Usage: wallet create <label>');
  const wallets = loadWallets();
  if (wallets.some((w) => w.label === label)) throw new Error(`Wallet "${label}" already exists.`);

  const kp = Keypair.random();
  const passphrase = await getPassphrase();
  wallets.push({
    label,
    publicKey: kp.publicKey(),
    secret: encryptSecret(kp.secret(), passphrase),
    createdAt: new Date().toISOString(),
  });
  saveWallets(wallets);

  if (quiet) return;
  console.log(`Created wallet "${label}"`);
  console.log(`  public key  ${kp.publicKey()}`);
  console.log(`  secret      encrypted at rest (AES-256-GCM)`);
  console.log(`\nNext: wallet fund ${label}`);
}

export async function walletList(): Promise<void> {
  const wallets = loadWallets();
  if (wallets.length === 0) return void console.log('No wallets yet. Try: wallet create alice');

  const cfg = (() => {
    try {
      return requireAssetConfig();
    } catch {
      return null;
    }
  })();
  const asset = cfg ? assetFrom(cfg) : null;

  for (const w of wallets) {
    const snap = await snapshot(w.publicKey);
    // An issuer never holds a trustline to its own asset — it mints by paying out.
    const state = !snap.exists
      ? 'unfunded'
      : w.publicKey === cfg?.issuer
        ? 'issuer'
        : asset && !hasTrustline(snap, asset)
          ? 'no trustline'
          : 'ready';
    const held = asset && snap.exists ? balanceOf(snap, asset) : null;
    console.log(
      `${w.label.padEnd(12)} ${w.publicKey}  ${state.padEnd(12)}` +
        (held ? ` ${asset!.getCode()} ${formatPretty(parseAmount(held))}` : ''),
    );
  }
}

export async function walletFund(label: string): Promise<void> {
  if (!label) throw new Error('Usage: wallet fund <label>');
  const w = findWallet(label);
  const before = await snapshot(w.publicKey);
  if (before.exists) {
    console.log(`"${label}" already exists on-chain. Topping up via Friendbot…`);
  }
  await fundWithFriendbot(w.publicKey);
  const after = await snapshot(w.publicKey);
  const xlm = after.balances.find((b) => b.code === 'XLM')?.balance ?? '0';
  console.log(`Funded "${label}" — ${xlm} XLM`);
  console.log(
    `  reserve floor ${after.minBalanceXLM} XLM (${after.subentries} subentries) · spendable ~${after.spendableXLM.toFixed(4)} XLM`,
  );
}

export async function walletBalance(label: string): Promise<void> {
  const targets = label === '--all' || !label ? loadWallets().map((w) => w.label) : [label];
  if (targets.length === 0) return void console.log('No wallets yet.');

  for (const t of targets) {
    const w = findWallet(t);
    const snap = await snapshot(w.publicKey);
    console.log(`\n${w.label}  ${w.publicKey}`);
    if (!snap.exists) {
      console.log('  (account not created on-chain yet — run `wallet fund`)');
      continue;
    }
    for (const b of snap.balances) {
      const suffix = b.issuer ? `  issuer ${b.issuer.slice(0, 8)}…` : '';
      console.log(`  ${b.code.padEnd(8)} ${formatPretty(parseAmount(b.balance)).padStart(16)}${suffix}`);
    }
    console.log(
      `  ── reserve floor ${snap.minBalanceXLM} XLM · spendable ${snap.spendableXLM.toFixed(4)} XLM`,
    );
  }
}

export async function walletTrust(label: string): Promise<void> {
  if (!label) throw new Error('Usage: wallet trust <label>');
  const cfg = requireAssetConfig();
  const asset = assetFrom(cfg);
  if (asset.isNative()) throw new Error('XLM needs no trustline.');

  const w = findWallet(label);
  const snap = await snapshot(w.publicKey);
  if (!snap.exists) throw new Error(`"${label}" is not funded yet. Run \`wallet fund ${label}\`.`);
  if (hasTrustline(snap, asset)) {
    return void console.log(`"${label}" already trusts ${asset.getCode()}.`);
  }

  const kp = await keypairFor(w);
  const hash = await submit(kp, [Operation.changeTrust({ asset })]);
  console.log(`"${label}" now trusts ${cfg.code}`);
  console.log(`  a trustline costs 0.5 XLM of reserve — this is the onboarding cost per member`);
  console.log(`  ${explorerTx(hash)}`);
}

/**
 * Brings a member on-chain holding nothing at all.
 *
 * Stellar makes every account pay a reserve: 1 XLM to exist, 0.5 more per
 * trustline. That is the onboarding wall this project keeps running into — a
 * treasurer cannot tell four friends to go buy XLM before anyone can be paid
 * back in Rupiah. Sponsored reserves move that cost to whoever is already
 * funded: the sponsor's balance is locked for the reserve, the member's stays
 * at zero, and the member can hand the reserve back later by revoking
 * sponsorship.
 *
 * All four operations ride in one transaction, because they are one decision.
 * `createAccount` may start at zero only inside a sponsorship sandwich, and
 * both the sandwich's opening and its closing have to be authorised by the
 * account being sponsored — hence two signatures on one envelope.
 */
export async function walletOnboard(label: string, flags: Record<string, string>): Promise<void> {
  if (!label) throw new Error('Usage: wallet onboard <label> [--sponsor <label>]');

  const cfg = requireAssetConfig();
  const asset = assetFrom(cfg);
  const sponsorLabel = flags.sponsor ?? 'issuer';
  const sponsor = findWallet(sponsorLabel);
  if (sponsor.label === label) throw new Error('A wallet cannot sponsor itself.');

  const sponsorSnap = await snapshot(sponsor.publicKey);
  if (!sponsorSnap.exists) throw new Error(`Sponsor "${sponsorLabel}" is not funded yet.`);

  // Reuse the wallet if it exists but never made it on-chain; otherwise mint one.
  const wallets = loadWallets();
  const existing = wallets.find((w) => w.label === label);
  if (existing && (await snapshot(existing.publicKey)).exists) {
    throw new Error(`"${label}" already exists on-chain. Onboarding is for new members.`);
  }
  // Quietly: `wallet fund` is the wrong next step for a sponsored member.
  if (!existing) await walletCreate(label, true);

  const member = findWallet(label);
  const memberKp = await keypairFor(member);
  const sponsorKp = await keypairFor(sponsor);

  const hash = await submit(
    sponsorKp,
    [
      Operation.beginSponsoringFutureReserves({ sponsoredId: member.publicKey }),
      Operation.createAccount({ destination: member.publicKey, startingBalance: '0' }),
      Operation.changeTrust({ asset, source: member.publicKey }),
      Operation.endSponsoringFutureReserves({ source: member.publicKey }),
    ],
    undefined,
    { cosigners: [memberKp] },
  );

  const after = await snapshot(member.publicKey);
  const xlm = after.balances.find((b) => b.code === 'XLM')?.balance ?? '0';

  console.log(`Onboarded "${label}", sponsored by "${sponsorLabel}"`);
  console.log(`  ${explorerTx(hash)}`);
  console.log(`  account   ${member.publicKey}`);
  console.log(`  XLM       ${xlm}  (the reserve is locked in "${sponsorLabel}", not here)`);
  console.log(`  ${cfg.code}      trustline open, ready to receive`);
  console.log(
    `\n"${label}" holds no XLM and still cannot pay a fee — settle for them with` +
      `\n  split settle <id> --member ${label} --fee-source ${sponsorLabel}`,
  );
}

/**
 * Hands a member's reserves back to the sponsor.
 *
 * The other half of `wallet onboard`, and until now the missing one: reserves
 * went out and never came back, so a sponsor's XLM was locked for as long as
 * the member existed. The same account funds the next onboarding, which makes
 * this a ceiling on how many members a group can bring on, not just tidiness.
 *
 * Only the sponsor signs. Unlike the sponsorship sandwich, revocation is the
 * sponsor releasing something it pays for, so the member's authorisation is not
 * required — but their *balance* is, because the reserve lands on them.
 * `whyUnsponsorRefused` says so before anything is signed.
 */
export async function walletUnsponsor(label: string, flags: Record<string, string>): Promise<void> {
  if (!label) throw new Error('Usage: wallet unsponsor <label> [--sponsor <label>]');

  const sponsorLabel = flags.sponsor ?? 'issuer';
  const member = findWallet(label);
  const sponsor = findWallet(sponsorLabel);
  if (member.publicKey === sponsor.publicKey) throw new Error('A wallet cannot sponsor itself.');

  const snap = await snapshot(member.publicKey);
  const plan = planUnsponsor(snap, sponsor.publicKey, BASE_RESERVE_XLM);
  const refusal = whyUnsponsorRefused(snap, plan, { member: label, sponsor: sponsorLabel });
  if (refusal) throw new Error(refusal);

  const sponsorKp = await keypairFor(sponsor);
  // Trustlines first, then the account, mirroring the order they were sponsored
  // in. Each revocation raises the member's own floor, so the last one is the
  // binding constraint either way — the order is for legibility on the ledger.
  const ops = [
    ...plan.trustlines.map((line) =>
      Operation.revokeTrustlineSponsorship({
        account: member.publicKey,
        asset: new Asset(line.code, line.issuer!),
      }),
    ),
    ...(plan.account ? [Operation.revokeAccountSponsorship({ account: member.publicKey })] : []),
  ];

  const hash = await submit(sponsorKp, ops);
  const after = await snapshot(member.publicKey);
  const sponsorAfter = await snapshot(sponsor.publicKey);

  console.log(`"${sponsorLabel}" no longer sponsors "${label}"`);
  console.log(`  ${explorerTx(hash)}`);
  console.log(
    `  released  ${plan.releasedXLM} XLM of reserve across ${plan.entries} ` +
      `entr${plan.entries === 1 ? 'y' : 'ies'}`,
  );
  console.log(
    `  ${label.padEnd(9)} floor ${after.minBalanceXLM} XLM · spendable ${after.spendableXLM.toFixed(4)} XLM`,
  );
  console.log(
    `  ${sponsorLabel.padEnd(9)} floor ${sponsorAfter.minBalanceXLM} XLM · spendable ${sponsorAfter.spendableXLM.toFixed(4)} XLM`,
  );
}
