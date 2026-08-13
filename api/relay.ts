/**
 * Pays the fee for members who hold no XLM.
 *
 * Sponsored reserves get someone on-chain owning nothing (`wallet onboard`),
 * but a zero-XLM account still cannot pay a transaction fee, and Stellar's
 * answer — a fee-bump — requires the *sponsor* to sign the outer envelope. The
 * sponsor's key cannot live in a browser, so this is the one piece of Splitr
 * that has to run on a server.
 *
 * It is deliberately not a general relay. Four things have to hold before it
 * signs anything, and they are all in `guards.ts` so they can be tested: the
 * transaction is a single call to this project's contract, the caller genuinely
 * cannot pay its own fee, the sponsor has not spent down to its floor, and that
 * account has not just been relayed for. The first was the only one the relay
 * used to check, which left it a faucet for anyone who found the URL: a valid
 * invocation from a funded account, repeated, was free money out of the
 * sponsor.
 *
 * Testnet only, and the sponsor holds testnet XLM. What is still missing before
 * this goes near real funds is a *shared* rate limit — the one here is per
 * serverless instance — and an accounting of what it has spent over time
 * rather than only what is left.
 */
import {
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Transaction,
  TransactionBuilder,
  rpc,
} from '@stellar/stellar-sdk';
import deployments from '../soroban/deployments.json' with { type: 'json' };
import {
  createLimiter,
  sponsorIsSpent,
  whyCallerRefused,
  whyStructurallyRefused,
} from './guards.ts';

const CONTRACT_ID = deployments.testnet['splitr-split'].contractId;
const RPC_URL = process.env.SPLITR_RPC ?? 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.SPLITR_HORIZON ?? 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

/** 0.1 XLM. Generous for one invocation, bounded against a fee-spike drain. */
const MAX_FEE_STROOPS = '1000000';

/**
 * Held at module scope so it survives between requests that reuse the same warm
 * instance. That is the whole of its reach — see the note in `guards.ts`.
 */
const limiter = createLimiter();

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

  // Cheapest check first: this one needs nothing but the transaction itself.
  const rejection = whyStructurallyRefused(inner, CONTRACT_ID);
  if (rejection) {
    res.status(403).json({ error: rejection });
    return;
  }

  const sponsor = Keypair.fromSecret(secret);
  const horizon = new Horizon.Server(HORIZON_URL);

  let callerXLM: number;
  let sponsorXLM: number;
  try {
    [callerXLM, sponsorXLM] = await Promise.all([
      nativeBalance(horizon, inner.source),
      nativeBalance(horizon, sponsor.publicKey()),
    ]);
  } catch {
    // Fail closed. Paying while unable to see who is being paid for is the
    // exact behaviour these checks were added to remove.
    res.status(503).json({ error: 'Could not read balances; not relaying.' });
    return;
  }

  const callerRejection = whyCallerRefused(callerXLM);
  if (callerRejection) {
    res.status(403).json({ error: callerRejection });
    return;
  }

  if (sponsorIsSpent(sponsorXLM)) {
    res.status(503).json({ error: 'The sponsor cannot cover any more fees.' });
    return;
  }

  // Claimed last, so a caller refused above does not spend its own slot and
  // find itself locked out for a minute over a transaction that never cost the
  // sponsor anything.
  if (!limiter.claim(inner.source, Date.now())) {
    res.status(429).json({ error: 'Already relayed for this account; try again shortly.' });
    return;
  }

  try {
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

/** An account's XLM, or a throw if Horizon cannot say. */
async function nativeBalance(horizon: Horizon.Server, publicKey: string): Promise<number> {
  const account = await horizon.loadAccount(publicKey);
  const native = account.balances.find((b) => b.asset_type === 'native');
  return Number(native?.balance ?? '0');
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
