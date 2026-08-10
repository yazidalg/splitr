import { Keypair, Operation } from '@stellar/stellar-sdk';
import {
  loadWallets,
  saveWallets,
  findWallet,
  encryptSecret,
  getPassphrase,
  keypairFor,
} from '../store.ts';
import { requireAssetConfig, assetFrom } from '../config.ts';
import {
  snapshot,
  fundWithFriendbot,
  submit,
  hasTrustline,
  explorerTx,
  balanceOf,
} from '../stellar.ts';
import { formatPretty, parseAmount } from '../money.ts';

export async function walletCreate(label: string): Promise<void> {
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
