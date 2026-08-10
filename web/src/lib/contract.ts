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
export const RPC_URL = 'https://soroban-testnet.stellar.org';
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

export function outstandingOf(bill: Bill): bigint {
  return bill.shares.reduce((sum, s) => sum + (s.owes > s.paid ? s.owes - s.paid : 0n), 0n);
}

export function shareOf(bill: Bill, member: string): Share | undefined {
  return bill.shares.find((s) => s.member === member);
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
