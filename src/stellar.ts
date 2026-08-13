import {
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Memo,
  Asset,
  type Keypair,
  type xdr,
} from '@stellar/stellar-sdk';
import { HORIZON_URL, NETWORK_PASSPHRASE, BASE_RESERVE_XLM } from './config.ts';

export const server = new Horizon.Server(HORIZON_URL);

export interface BalanceLine {
  code: string;
  issuer: string | null;
  balance: string;
  limit: string | null;
  /** Who pays this trustline's reserve, if it is not the holder. */
  sponsor: string | null;
}

export interface AccountSnapshot {
  exists: boolean;
  publicKey: string;
  subentries: number;
  /** Reserves this account is paying on someone else's behalf. */
  sponsoring: number;
  /** Reserves someone else is paying on this account's behalf. */
  sponsored: number;
  /**
   * Who pays this account's own base reserve, if it is not the account. Counts
   * and totals cannot answer "hand it back to whom" — that needs the identity.
   */
  sponsor: string | null;
  balances: BalanceLine[];
  /** (2 + subentries + sponsoring - sponsored) * base reserve. */
  minBalanceXLM: number;
  spendableXLM: number;
}

export async function snapshot(publicKey: string): Promise<AccountSnapshot> {
  try {
    const acc = await server.loadAccount(publicKey);
    // Horizon reports `sponsor` on the account and on each sponsored balance,
    // but the SDK's types predate it — the same reason `num_sponsoring` is read
    // through a cast below.
    const sponsorOf = (v: unknown): string | null =>
      (v as { sponsor?: string })?.sponsor ?? null;

    const balances: BalanceLine[] = acc.balances.map((b) => {
      if (b.asset_type === 'native') {
        return { code: 'XLM', issuer: null, balance: b.balance, limit: null, sponsor: null };
      }
      const line = b as Extract<typeof b, { asset_code: string }>;
      return {
        code: line.asset_code,
        issuer: line.asset_issuer,
        balance: line.balance,
        limit: 'limit' in line ? (line.limit as string) : null,
        sponsor: sponsorOf(line),
      };
    });
    const native = Number(balances.find((b) => b.code === 'XLM')?.balance ?? '0');
    // Sponsorship moves a reserve from the sponsored account to the sponsor, so
    // the floor is not just "two plus your subentries". Leaving those two terms
    // out understated the sponsor's floor and overstated a sponsored member's —
    // it told a member holding zero XLM that they needed 1.5, which is the
    // whole thing sponsorship exists to avoid.
    const sponsoring = (acc as { num_sponsoring?: number }).num_sponsoring ?? 0;
    const sponsored = (acc as { num_sponsored?: number }).num_sponsored ?? 0;
    const entries = Math.max(0, 2 + acc.subentry_count + sponsoring - sponsored);
    const minBalance = entries * BASE_RESERVE_XLM;
    return {
      exists: true,
      publicKey,
      subentries: acc.subentry_count,
      sponsoring,
      sponsored,
      sponsor: sponsorOf(acc),
      balances,
      minBalanceXLM: minBalance,
      spendableXLM: Math.max(0, native - minBalance),
    };
  } catch (err) {
    if (isNotFound(err)) {
      return {
        exists: false,
        publicKey,
        subentries: 0,
        sponsoring: 0,
        sponsored: 0,
        sponsor: null,
        balances: [],
        minBalanceXLM: 0,
        spendableXLM: 0,
      };
    }
    throw err;
  }
}

export function isNotFound(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404 || (err as { name?: string })?.name === 'NotFoundError';
}

export function hasTrustline(snap: AccountSnapshot, asset: Asset): boolean {
  if (asset.isNative()) return snap.exists;
  return snap.balances.some((b) => b.code === asset.getCode() && b.issuer === asset.getIssuer());
}

export function balanceOf(snap: AccountSnapshot, asset: Asset): string | null {
  if (asset.isNative()) return snap.balances.find((b) => b.code === 'XLM')?.balance ?? null;
  return (
    snap.balances.find((b) => b.code === asset.getCode() && b.issuer === asset.getIssuer())
      ?.balance ?? null
  );
}

export async function fundWithFriendbot(publicKey: string): Promise<void> {
  await server.friendbot(publicKey).call();
}

/**
 * Stellar charges the market-clearing fee, not your bid, so bidding above base is
 * safe and keeps transactions from being dropped during surge pricing. Capped at
 * 0.01 XLM per operation so a fee spike can never drain an account.
 */
const MAX_FEE_STROOPS = 100_000;
let cachedFee: string | null = null;

export async function bidFee(): Promise<string> {
  if (cachedFee) return cachedFee;
  try {
    const stats = await server.feeStats();
    const p90 = Number(stats.fee_charged.p90 ?? BASE_FEE);
    cachedFee = String(Math.min(Math.max(Number(BASE_FEE), p90 * 2), MAX_FEE_STROOPS));
  } catch {
    cachedFee = BASE_FEE;
  }
  return cachedFee;
}

export interface SubmitOptions {
  /**
   * Extra signers, for operations whose source is not the transaction source —
   * a sponsored account authorising its own trustline, for instance.
   */
  cosigners?: Keypair[];
  /**
   * Pays the fee instead of the source account, by wrapping the whole thing in
   * a fee-bump. This is what lets a member hold zero XLM and still transact:
   * the inner transaction's fee is never charged, only the outer one's.
   */
  feeSource?: Keypair;
}

/** Build, sign and submit a transaction. Returns the tx hash. */
export async function submit(
  source: Keypair,
  ops: xdr.Operation[],
  memo?: string,
  opts: SubmitOptions = {},
): Promise<string> {
  const account = await server.loadAccount(source.publicKey());
  const fee = await bidFee();
  const builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(Memo.text(memo));
  const tx = builder.setTimeout(60).build();
  tx.sign(source, ...(opts.cosigners ?? []));

  try {
    if (!opts.feeSource) {
      return (await server.submitTransaction(tx)).hash;
    }
    // The fee-bump must bid at least as much per operation as the inner
    // transaction, so reuse the same bid rather than the base fee.
    const bumped = TransactionBuilder.buildFeeBumpTransaction(
      opts.feeSource,
      fee,
      tx,
      NETWORK_PASSPHRASE,
    );
    bumped.sign(opts.feeSource);
    return (await server.submitTransaction(bumped)).hash;
  } catch (err) {
    throw new Error(describeSubmitError(err));
  }
}

export function describeSubmitError(err: unknown): string {
  const extras = (err as { response?: { data?: { extras?: Record<string, unknown> } } })?.response
    ?.data?.extras;
  if (!extras) return err instanceof Error ? err.message : String(err);
  const codes = extras.result_codes as { transaction?: string; operations?: string[] } | undefined;
  const parts = [codes?.transaction, ...(codes?.operations ?? [])].filter(Boolean);
  const hint = HINTS[parts.find((p) => p && HINTS[p]) ?? ''] ?? '';
  return `Transaction rejected: ${parts.join(' / ') || 'unknown'}${hint ? `\n  → ${hint}` : ''}`;
}

const HINTS: Record<string, string> = {
  op_no_destination: 'The destination account does not exist yet — fund it first.',
  op_no_trust:
    'The destination has no trustline for this asset. Run `wallet trust <label>` for them.',
  op_underfunded: 'Not enough of the asset, or the XLM reserve floor would be breached.',
  op_low_reserve: 'Below the minimum balance for a new subentry (each trustline costs reserve).',
  tx_insufficient_balance: 'Not enough XLM to pay the fee.',
  tx_bad_auth: 'Wrong signer for this source account.',
};

export function explorerTx(hash: string): string {
  const net = NETWORK_PASSPHRASE.includes('Test') ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}
