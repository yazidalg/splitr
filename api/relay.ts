/**
 * Pays the fee for members who hold no XLM.
 *
 * Sponsored reserves get someone on-chain owning nothing (`wallet onboard`),
 * but a zero-XLM account still cannot pay a transaction fee, and Stellar's
 * answer — a fee-bump — requires the *sponsor* to sign the outer envelope. The
 * sponsor's key cannot live in a browser, so this is the one piece of Splitr
 * that has to run on a server.
 *
 * It is deliberately not a general relay. It signs a fee-bump only for a
 * single-operation transaction that invokes this project's contract, and only
 * up to a capped fee. Without those two checks it would be a faucet that
 * drains the sponsor for anyone who finds the URL.
 *
 * Testnet only, and the sponsor holds testnet XLM. On mainnet this needs rate
 * limiting per account and a spend ceiling before it goes anywhere near real
 * funds.
 */
import {
  Address,
  FeeBumpTransaction,
  Keypair,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import deployments from '../soroban/deployments.json' with { type: 'json' };

const CONTRACT_ID = deployments.testnet['splitr-split'].contractId;
const RPC_URL = process.env.SPLITR_RPC ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

/** 0.1 XLM. Generous for one invocation, bounded against a fee-spike drain. */
const MAX_FEE_STROOPS = '1000000';

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST an { xdr } body.' });
    return;
  }

  const secret = process.env.SPLITR_SPONSOR_SECRET;
  if (!secret) {
    // Missing configuration, not a bad request — say so rather than pretending
    // the caller got it wrong.
    res.status(503).json({ error: 'No sponsor configured for this deployment.' });
    return;
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as
    | { xdr?: unknown }
    | undefined;
  const envelope = typeof body?.xdr === 'string' ? body.xdr : null;
  if (!envelope) {
    res.status(400).json({ error: 'Expected { xdr: "<signed transaction>" }.' });
    return;
  }

  let inner: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(envelope, NETWORK_PASSPHRASE);
    if (parsed instanceof FeeBumpTransaction) {
      res.status(400).json({ error: 'Already a fee-bump.' });
      return;
    }
    inner = parsed;
  } catch {
    res.status(400).json({ error: 'That is not a transaction for this network.' });
    return;
  }

  const rejection = whyRefused(inner);
  if (rejection) {
    res.status(403).json({ error: rejection });
    return;
  }

  try {
    const sponsor = Keypair.fromSecret(secret);
    const bumped = TransactionBuilder.buildFeeBumpTransaction(
      sponsor,
      MAX_FEE_STROOPS,
      inner,
      NETWORK_PASSPHRASE,
    );
    bumped.sign(sponsor);

    const server = new rpc.Server(RPC_URL);
    const sent = await server.sendTransaction(bumped);
    if (sent.status === 'ERROR') {
      res.status(502).json({ error: 'The network rejected the transaction.' });
      return;
    }

    const settled = await server.pollTransaction(sent.hash);
    if (settled.status !== 'SUCCESS') {
      res.status(502).json({ error: `Transaction ${settled.status.toLowerCase()}.`, hash: sent.hash });
      return;
    }
    res.status(200).json({ hash: sent.hash });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Relay failed.' });
  }
}

/**
 * The whole guard. Anything this does not explicitly recognise is refused,
 * because the failure mode of a permissive relay is someone else's money.
 */
function whyRefused(tx: Transaction): string | null {
  if (tx.operations.length !== 1) {
    return 'Only a single-operation transaction is relayed.';
  }
  const op = tx.operations[0];
  if (op.type !== 'invokeHostFunction') {
    return 'Only contract invocations are relayed.';
  }

  let target: string;
  try {
    const fn = op.func;
    if (fn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
      return 'Only contract calls are relayed, not uploads or deployments.';
    }
    target = Address.fromScAddress(fn.invokeContract().contractAddress()).toString();
  } catch {
    return 'Could not read which contract this calls.';
  }

  if (target !== CONTRACT_ID) {
    return 'This relay only pays for the Splitr contract.';
  }
  return null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
