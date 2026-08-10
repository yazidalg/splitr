/**
 * The contract, from the browser.
 *
 * Mirrors `src/soroban.ts`, with one difference that matters: the CLI signs
 * with a keypair it holds, and this signs by handing the envelope to whatever
 * wallet the visitor connected. `contract.Client` takes either, because
 * `signTransaction` has the same shape in both.
 *
 * Everything here is behind dynamic imports. `@stellar/stellar-sdk` is larger
 * than the entire landing page, and someone reading the marketing copy should
 * never download it.
 */
import type { contract as contractNs } from '@stellar/stellar-sdk';
import deployments from '../../../soroban/deployments.json';

export const CONTRACT_ID = deployments.testnet['splitr-split'].contractId;
export const SAC_ID = deployments.testnet['idrx-sac'].contractId;
export const ASSET_CODE = 'IDRX';
export const ASSET_ISSUER = deployments.testnet['idrx-sac'].asset.split(':')[1];
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface Share {
  member: string;
  weight: number;
  owes: bigint;
  paid: bigint;
}

export interface Bill {
  id: number;
  group: string;
  asset: string;
  payer: string;
  total: bigint;
  shares: Share[];
}

/** Mirrors the `#[contractimpl]` block in the contract. */
interface SplitrSplit {
  create_bill: (args: {
    payer: string;
    group: string;
    asset: string;
    total: bigint;
    members: string[];
    weights: number[];
  }) => Promise<contractNs.AssembledTransaction<contractNs.Result<number>>>;
  settle: (args: {
    id: number;
    member: string;
  }) => Promise<contractNs.AssembledTransaction<contractNs.Result<bigint>>>;
  settle_part: (args: {
    id: number;
    member: string;
    amount: bigint;
  }) => Promise<contractNs.AssembledTransaction<contractNs.Result<bigint>>>;
  bill: (args: {
    id: number;
  }) => Promise<contractNs.AssembledTransaction<contractNs.Result<Bill>>>;
  bills_for: (args: {
    member: string;
  }) => Promise<contractNs.AssembledTransaction<number[]>>;
}

export type SplitrClient = contractNs.Client & SplitrSplit;

type SignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

/**
 * A client for reading only.
 *
 * Deliberately unbound to any account. Simulation needs a source account, and
 * binding the connected one made every read demand that it already exist
 * on-chain — so a freshly created wallet, which has no ledger entry until it is
 * funded, could not even list the bills it is on. Without a `publicKey` the SDK
 * substitutes a null account, and reads work for anybody.
 */
export async function makeReadClient(): Promise<SplitrClient> {
  const { contract } = await import('@stellar/stellar-sdk');
  return contract.Client.from<SplitrSplit>({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
  });
}

/**
 * A client bound to the connected account.
 *
 * Not cached across addresses: the signer is baked into the client, and reusing
 * one built for a previous account is how an app ends up asking the wrong
 * wallet to sign.
 */
export async function makeClient(
  publicKey?: string,
  signTransaction?: SignTransaction,
): Promise<SplitrClient> {
  const { contract } = await import('@stellar/stellar-sdk');
  return contract.Client.from<SplitrSplit>({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    ...(publicKey ? { publicKey } : {}),
    ...(signTransaction ? { signTransaction } : {}),
  });
}

/** Unwraps the contract's `Result`, which the SDK returns rather than throws. */
export function unwrap<T>(result: contractNs.Result<T>): T {
  if (result.isOk()) return result.unwrap();
  throw new Error(result.unwrapErr().message);
}

/** Same table as `src/soroban.ts`; keep the two in step with the contract. */
const CONTRACT_ERRORS: Record<number, string> = {
  1: 'A bill needs at least two people.',
  2: 'One weight per member.',
  3: 'Amounts must be above zero.',
  4: 'The payer has to be on the bill.',
  5: 'No bill with that id.',
  6: "You are not on this bill.",
  7: 'That share is already settled.',
  8: 'You fronted this bill — there is nothing to pay yourself.',
  9: 'That is more than is still owed.',
};

export function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = /Error\(Contract, #(\d+)\)/.exec(message);
  if (code) return CONTRACT_ERRORS[Number(code[1])] ?? `Contract error #${code[1]}`;
  // Wallet rejections read badly raw, and are the most common failure by far.
  if (/user (declined|rejected)|denied|cancel/i.test(message)) return 'You cancelled the signature.';
  return message;
}

/** stellar.expert is where a payment stops being a claim and becomes checkable. */
export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function outstandingOf(bill: Bill): bigint {
  return bill.shares.reduce((sum, s) => sum + (s.owes > s.paid ? s.owes - s.paid : 0n), 0n);
}

export function shareOf(bill: Bill, member: string): Share | undefined {
  return bill.shares.find((s) => s.member === member);
}

// --------------------------------------------------------------------- relay

/**
 * Below this an account cannot reliably cover a contract invocation, so the
 * relay pays instead. Not zero: an account with a few stroops left would fail
 * mid-flight, which is worse than never trying.
 */
export const FEE_FLOOR_XLM = 0.5;

export function needsRelay(account: AccountState | null): boolean {
  if (!account) return false;
  return Number(account.xlm) < FEE_FLOOR_XLM;
}

/**
 * Signs a contract call and gets it onto the ledger.
 *
 * Two routes to the same place. Normally the account pays its own fee and the
 * SDK submits. When it holds no XLM — the whole point of sponsored onboarding —
 * the signed envelope goes to `/api/relay`, which wraps it in a fee-bump paid
 * by the sponsor. Either way the member signs, and the payment is debited from
 * them; only who pays the fee differs.
 */
export async function signAndSubmit<T>(
  tx: contractNs.AssembledTransaction<contractNs.Result<T>>,
  opts: {
    viaRelay: boolean;
    signTransaction: SignTransaction;
  },
): Promise<{ value: T; hash: string | undefined }> {
  if (!opts.viaRelay) {
    const sent = await tx.signAndSend();
    return { value: unwrap(sent.result), hash: sent.sendTransactionResponse?.hash };
  }

  const built = tx.built;
  if (!built) throw new Error('Transaction was never assembled.');

  const { signedTxXdr } = await opts.signTransaction(built.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const res = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ xdr: signedTxXdr }),
  });
  const body = (await res.json()) as { hash?: string; error?: string };
  if (!res.ok || !body.hash) {
    throw new Error(body.error ?? `Relay returned ${res.status}`);
  }

  // The relay reports success or failure, but not the call's return value;
  // the caller refreshes from the contract straight after.
  return { value: undefined as T, hash: body.hash };
}

// ------------------------------------------------------------------- account

export interface AccountState {
  /** False until the account is funded — Stellar has no entry for it before that. */
  exists: boolean;
  xlm: string;
  /** Null when there is no trustline for the settlement asset yet. */
  idrx: string | null;
}

/**
 * Balances, from Horizon rather than the contract: an account's XLM and its
 * trustlines are classic ledger state, and Soroban RPC does not serve them.
 */
export async function fetchAccount(address: string): Promise<AccountState> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return { exists: false, xlm: '0', idrx: null };
  if (!res.ok) throw new Error(`Horizon returned ${res.status}`);
  const data = (await res.json()) as {
    balances: { asset_type: string; asset_code?: string; balance: string }[];
  };
  const native = data.balances.find((b) => b.asset_type === 'native');
  const idrx = data.balances.find((b) => b.asset_code === ASSET_CODE);
  return {
    exists: true,
    xlm: native?.balance ?? '0',
    idrx: idrx ? idrx.balance : null,
  };
}

/**
 * Opens the IDRX trustline, signed by the visitor's own wallet.
 *
 * Stellar will not let an account hold an asset it has not agreed to, and the
 * CLI cannot do this on a browser wallet's behalf — it has no key for it. So
 * the app builds the classic transaction and the wallet signs it, which is the
 * only route a Freighter user has to becoming able to receive IDRX.
 */
export async function openTrustline(
  address: string,
  signTransaction: SignTransaction,
): Promise<string> {
  const { Horizon, TransactionBuilder, Operation, Asset, BASE_FEE } = await import(
    '@stellar/stellar-sdk'
  );
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: new Asset(ASSET_CODE, ASSET_ISSUER) }))
    .setTimeout(120)
    .build();

  const { signedTxXdr } = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  const signed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const res = await server.submitTransaction(signed);
  return res.hash;
}

/** Testnet only. Friendbot is the stand-in for an on-ramp that does not exist yet. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${HORIZON_URL}/friendbot?addr=${address}`);
  if (!res.ok && res.status !== 400) throw new Error(`Friendbot returned ${res.status}`);
}

// -------------------------------------------------------------------- events

export interface BillEvent {
  name: string;
  id: number;
  data: Record<string, unknown>;
  at: string;
  txHash: string;
}

/**
 * One page of contract events. Soroban RPC has no subscription, so the caller
 * polls this on the cursor it returns; five seconds is the testnet ledger
 * cadence, and anything shorter just re-asks the same question.
 */
export async function readEvents(
  client: SplitrClient,
  opts: { cursor?: string; startLedger?: number } = {},
): Promise<{ events: BillEvent[]; cursor: string }> {
  const { rpc } = await import('@stellar/stellar-sdk');
  const server = new rpc.Server(RPC_URL);

  const range = opts.cursor
    ? { cursor: opts.cursor }
    : { startLedger: opts.startLedger ?? (await server.getLatestLedger()).sequence - 1 };

  const res = await server.getEvents({
    ...range,
    limit: 100,
    filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
  });

  const events: BillEvent[] = [];
  for (const e of res.events) {
    if (!e.inSuccessfulContractCall) continue;
    const parsed = client.spec.parseEvent(e.topic, e.value);
    if (!parsed) continue;
    const { id, ...rest } = parsed.data as { id: number } & Record<string, unknown>;
    events.push({ name: parsed.name, id, data: rest, at: e.ledgerClosedAt, txHash: e.txHash });
  }
  return { events, cursor: res.cursor };
}
