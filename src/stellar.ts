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
}

export interface AccountSnapshot {
  exists: boolean;
  publicKey: string;
  subentries: number;
  balances: BalanceLine[];
  /** XLM held back by the protocol: (2 + subentries) * base reserve. */
  minBalanceXLM: number;
  spendableXLM: number;
}

export async function snapshot(publicKey: string): Promise<AccountSnapshot> {
  try {
    const acc = await server.loadAccount(publicKey);
    const balances: BalanceLine[] = acc.balances.map((b) => {
      if (b.asset_type === 'native') {
        return { code: 'XLM', issuer: null, balance: b.balance, limit: null };
      }
      const line = b as Extract<typeof b, { asset_code: string }>;
      return {
        code: line.asset_code,
        issuer: line.asset_issuer,
        balance: line.balance,
        limit: 'limit' in line ? (line.limit as string) : null,
      };
    });
    const native = Number(balances.find((b) => b.code === 'XLM')?.balance ?? '0');
    const minBalance = (2 + acc.subentry_count) * BASE_RESERVE_XLM;
    return {
      exists: true,
      publicKey,
      subentries: acc.subentry_count,
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

/** Build, sign and submit a single-source transaction. Returns the tx hash. */
export async function submit(
  source: Keypair,
  ops: xdr.Operation[],
  memo?: string,
): Promise<string> {
  const account = await server.loadAccount(source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: await bidFee(),
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(Memo.text(memo));
  const tx = builder.setTimeout(60).build();
  tx.sign(source);

  try {
    const res = await server.submitTransaction(tx);
    return res.hash;
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
