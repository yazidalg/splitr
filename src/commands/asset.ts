import { Operation, StrKey } from '@stellar/stellar-sdk';
import { loadWallets, findWallet, keypairFor } from '../store.ts';
import { saveAssetConfig, requireAssetConfig, assetFrom, loadAssetConfig } from '../config.ts';
import { snapshot, fundWithFriendbot, submit, hasTrustline, explorerTx } from '../stellar.ts';
import { formatAmount, formatPretty, parseAmount } from '../money.ts';
import { walletCreate } from './wallet.ts';

/**
 * Stand up the settlement asset. On Stellar an "issuer" is just an account other
 * accounts trust; supply is created by paying out from it and destroyed by paying
 * back to it. IDRX stands in for a Rupiah-pegged stablecoin until a real anchor exists.
 */
export async function assetInit(flags: Record<string, string>): Promise<void> {
  const code = flags.code ?? 'IDRX';
  const label = flags['issuer-label'] ?? 'issuer';

  if (!loadWallets().some((w) => w.label === label)) {
    await walletCreate(label);
  }
  const issuer = findWallet(label);
  const snap = await snapshot(issuer.publicKey);
  if (!snap.exists) {
    await fundWithFriendbot(issuer.publicKey);
    console.log(`Funded issuer account via Friendbot`);
  }

  saveAssetConfig({ code, issuerLabel: label, issuer: issuer.publicKey });
  console.log(`\nSettlement asset configured: ${code}`);
  console.log(`  issuer  ${issuer.publicKey} (wallet "${label}")`);
  console.log(`\nNext: wallet trust <member>, then asset issue --to <member> --amount 1000000`);
}

export async function assetIssue(flags: Record<string, string>): Promise<void> {
  const cfg = requireAssetConfig();
  const asset = assetFrom(cfg);
  if (!cfg.issuerLabel) {
    throw new Error(
      `Asset ${cfg.code} is issued by ${cfg.issuer}, which Splitr does not hold the key for.\n` +
        'Only a self-issued asset can be minted here.',
    );
  }
  const to = flags.to;
  const amount = flags.amount;
  if (!to || !amount) {
    throw new Error('Usage: asset issue --to <label|G…address> --amount <n>');
  }

  // A raw address as well as a label, because the wallets that most need test
  // funds are browser wallets Splitr holds no key for.
  const external = StrKey.isValidEd25519PublicKey(to);
  const destKey = external ? to : findWallet(to).publicKey;

  const destSnap = await snapshot(destKey);
  if (!destSnap.exists) {
    throw new Error(
      external
        ? `${to} does not exist on the ledger yet — it has to be funded first.`
        : `"${to}" is not funded yet. Run \`wallet fund ${to}\`.`,
    );
  }
  if (!hasTrustline(destSnap, asset)) {
    throw new Error(
      external
        ? `That account has no ${cfg.code} trustline yet. Open one from the app, or with the wallet that holds it.`
        : `"${to}" has no ${cfg.code} trustline. Run \`wallet trust ${to}\` first.`,
    );
  }

  const units = parseAmount(amount);
  const issuerKp = await keypairFor(findWallet(cfg.issuerLabel));
  const hash = await submit(
    issuerKp,
    [Operation.payment({ destination: destKey, asset, amount: formatAmount(units) })],
    'splitr:mint',
  );
  console.log(`Issued ${formatPretty(units)} ${cfg.code} to "${to}"`);
  console.log(`  ${explorerTx(hash)}`);
}

export function assetShow(): void {
  const cfg = loadAssetConfig();
  if (!cfg) return void console.log('No settlement asset configured. Run `asset init`.');
  console.log(`code    ${cfg.code}`);
  console.log(`issuer  ${cfg.issuer}${cfg.issuerLabel ? ` (wallet "${cfg.issuerLabel}")` : ''}`);
}
