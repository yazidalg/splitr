/**
 * The contract half of Splitr.
 *
 * `stellar.ts` speaks to Horizon and moves classic payments. This speaks to
 * Soroban RPC and drives `soroban/contracts/splitr-split`. They settle the same
 * debts in the same asset — the contract transfers through the asset's Stellar
 * Asset Contract, so a member's IDRX balance is one balance either way.
 *
 * No generated bindings. `Client.from` downloads the contract's spec from the
 * chain and builds the call encoders from it, so the wire format can never
 * drift from the deployed wasm; the `SplitrSplit` interface below only supplies
 * the TypeScript types, and is checked against the spec at runtime by the same
 * call. Regenerating nothing after a redeploy is the point.
 */
import { contract, rpc, type Keypair, type xdr } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, RPC_URL, requireContractId } from './config.ts';

export const rpcServer = new rpc.Server(RPC_URL);

/** Mirrors the `#[contractimpl]` block in `soroban/contracts/splitr-split/src/lib.rs`. */
export interface SplitrSplit {
  create_bill: (
    args: {
      payer: string;
      group: string;
      asset: string;
      total: bigint;
      members: string[];
      weights: number[];
    },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<number>>>;
  settle: (
    args: { id: number; member: string },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<bigint>>>;
  settle_part: (
    args: { id: number; member: string; amount: bigint },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<bigint>>>;
  bills_for: (
    args: { member: string },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<number[]>>;
  bill: (
    args: { id: number },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<ContractBill>>>;
  outstanding: (
    args: { id: number },
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<bigint>>>;
  count: (
    opts?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<number>>;
}

/** The `Bill` struct, as `scValToNative` decodes it. */
export interface ContractBill {
  id: number;
  group: string;
  asset: string;
  payer: string;
  total: bigint;
  shares: ContractShare[];
}

export interface ContractShare {
  member: string;
  weight: number;
  owes: bigint;
  paid: bigint;
}

export type SplitrClient = contract.Client & SplitrSplit;

/**
 * A client for the deployed contract. Pass a keypair to sign; omit it for reads,
 * which only ever simulate and so need no signer and no funded account.
 */
export async function splitrClient(signer?: Keypair): Promise<SplitrClient> {
  return contract.Client.from<SplitrSplit>({
    contractId: requireContractId(),
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    ...(signer
      ? { publicKey: signer.publicKey(), signTransaction: contract.basicNodeSigner(signer, NETWORK_PASSPHRASE).signTransaction }
      : {}),
  });
}

/**
 * Unwraps the `Result<T, Error>` the contract returns. The SDK surfaces a
 * contract error as a value rather than a throw, which is easy to read past —
 * this makes ignoring one impossible.
 */
export function unwrap<T>(result: contract.Result<T>): T {
  if (result.isOk()) return result.unwrap();
  const err = result.unwrapErr();
  throw new Error(`Contract rejected the call: ${err.message}`);
}

/**
 * The `#[contracterror]` variants, by discriminant, from
 * `soroban/contracts/splitr-split/src/lib.rs`.
 *
 * A failed simulation arrives as a wall of diagnostic XDR with the real reason
 * — `Error(Contract, #7)` — buried in the middle of it. These are the same
 * strings as the doc comments on the enum; keep them in step.
 */
const CONTRACT_ERRORS: Record<number, string> = {
  1: 'A bill needs at least two participants.',
  2: 'One weight per member, no more and no less.',
  3: 'Totals and weights must be above zero.',
  4: 'The payer has to be one of the members.',
  5: 'No bill with that id.',
  6: 'That address is not on this bill.',
  7: 'Nothing left to pay — that share is already settled.',
  8: 'The payer fronted the bill; they do not settle with themselves.',
  9: 'That is more than is still owed on this share.',
};

/** Reduces a contract failure to its reason, or passes other errors through. */
export function describeContractError(err: unknown): string {
  const message = errorText(err);
  const code = /Error\(Contract, #(\d+)\)/.exec(message);
  if (!code) return message;
  const known = CONTRACT_ERRORS[Number(code[1])];
  return known
    ? `Contract refused: ${known}`
    : `Contract refused with error #${code[1]} (unknown to this CLI — is it newer than the contract?)`;
}

/**
 * Not everything thrown is an `Error`. RPC clients reject with plain objects,
 * and `String(obj)` turns those into "[object Object]", which tells nobody
 * anything. Dig out whatever text there is.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'name']) {
      if (typeof o[key] === 'string' && o[key]) return o[key] as string;
    }
    try {
      return JSON.stringify(err, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    } catch {
      // Circular or otherwise unserialisable — fall through.
    }
  }
  return String(err);
}

// -------------------------------------------------------------------- events

/**
 * A contract event, decoded against the contract's own spec.
 *
 * The `#[contractevent]` structs in the contract are published into its SEP-48
 * spec, so the field names here (`payer`, `total`, `member`, `amount`) come
 * from the deployed wasm rather than from a copy of them kept on this side.
 */
export interface BillEvent {
  name: string;
  /** Bill id, carried as an indexed topic. */
  id: number;
  data: Record<string, unknown>;
  ledger: number;
  at: string;
  txHash: string;
}

export interface EventPage {
  events: BillEvent[];
  /** Pass back as `cursor` to resume exactly where this page stopped. */
  cursor: string;
  latestLedger: number;
}

/**
 * Reads contract events from RPC. This is the synchronisation primitive: RPC
 * keeps roughly 24 hours of events, and a cursor makes reads resumable, so a
 * watcher can be stopped and restarted without replaying or missing anything.
 */
export async function readEvents(
  client: SplitrClient,
  opts: { startLedger?: number; cursor?: string; limit?: number } = {},
): Promise<EventPage> {
  const contractId = requireContractId();
  const range = opts.cursor
    ? { cursor: opts.cursor }
    : { startLedger: opts.startLedger ?? (await rpcServer.getLatestLedger()).sequence - 1 };

  const res = await rpcServer.getEvents({
    ...range,
    limit: opts.limit ?? 100,
    filters: [{ type: 'contract', contractIds: [contractId] }],
  });

  const events: BillEvent[] = [];
  for (const e of res.events) {
    // A failed call still emits; only successful ones changed any state.
    if (!e.inSuccessfulContractCall) continue;
    const parsed = client.spec.parseEvent(e.topic as xdr.ScVal[], e.value);
    if (!parsed) continue;
    const { id, ...rest } = parsed.data as { id: number } & Record<string, unknown>;
    events.push({
      name: parsed.name,
      id,
      data: rest,
      ledger: e.ledger,
      at: e.ledgerClosedAt,
      txHash: e.txHash,
    });
  }

  return { events, cursor: res.cursor, latestLedger: res.latestLedger };
}

/**
 * Follows the contract, yielding events as ledgers close.
 *
 * Polling rather than a socket, because Soroban RPC offers no subscription —
 * `getEvents` with a cursor is the whole interface. Testnet closes a ledger
 * about every five seconds, so that is the poll interval; a shorter one just
 * burns requests on the same empty answer.
 */
export async function* watchEvents(
  client: SplitrClient,
  opts: {
    startLedger?: number;
    intervalMs?: number;
    signal?: AbortSignal;
    /** Called on a poll that failed; the watcher keeps going regardless. */
    onError?: (message: string) => void;
  } = {},
): AsyncGenerator<BillEvent> {
  const interval = opts.intervalMs ?? 5_000;
  let cursor: string | undefined;
  let startLedger = opts.startLedger;
  let backoff = interval;

  while (!opts.signal?.aborted) {
    let page: EventPage | null = null;
    try {
      page = await readEvents(client, { cursor, startLedger });
      backoff = interval;
    } catch (err) {
      // A watcher that dies on one failed request is not a watcher. RPC nodes
      // rate-limit, restart and briefly lose their event index; back off and
      // carry on from the same cursor, which makes the retry lossless.
      if (opts.signal?.aborted) return;
      opts.onError?.(errorText(err));
      backoff = Math.min(backoff * 2, 60_000);
    }

    if (page) {
      // Once a cursor exists it supersedes startLedger — RPC rejects both at once.
      if (page.cursor) {
        cursor = page.cursor;
        startLedger = undefined;
      }
      for (const e of page.events) yield e;
    }

    if (opts.signal?.aborted) return;
    await new Promise((r) => setTimeout(r, backoff));
  }
}
