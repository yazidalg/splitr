/**
 * What the relay refuses, and why.
 *
 * This lives apart from `relay.ts` because every decision here is about values
 * — no request object, no environment, no network — which is the only reason
 * any of it can be run in a test. The relay's guards had never been exercised
 * by a single request, and a guard nobody has run is a guard nobody has
 * checked. `scripts/relay-guards.ts` runs these.
 *
 * The structural checks answer "is this the transaction we agreed to pay for".
 * The balance checks answer "does this caller actually need us, and can we
 * still afford it" — questions the old relay never asked, which is what made
 * it a faucet for anyone who found the URL.
 */
import { Address, type Transaction, xdr } from '@stellar/stellar-sdk';

/**
 * Below this an account cannot reliably cover a contract invocation of its own,
 * which is the only situation the relay exists for. Above it, the caller is
 * asking someone else to pay a fee they can pay themselves.
 *
 * It has to match `FEE_FLOOR_XLM` in `web/src/lib/contract.ts`: that is the
 * number the browser uses to decide to call the relay at all, and the relay now
 * checks the same one rather than trusting that it did. Importing it from there
 * would pull the browser client and the whole SDK into a serverless function,
 * so it is duplicated with this note instead.
 */
export const FEE_FLOOR_XLM = 0.5;

/**
 * The relay stops before the sponsor is empty rather than at empty.
 *
 * A drained sponsor is worse than a refusing relay: the same account pays the
 * reserves for `wallet onboard`, so running it to zero stops new members from
 * getting on chain at all, not just from having a fee paid. Leaving a floor
 * turns "someone can empty the sponsor" into "someone can spend down to it".
 */
export const SPONSOR_FLOOR_XLM = 5;

/** One relayed call per account per minute. */
export const COOLDOWN_MS = 60_000;

/**
 * Whether this is the shape of transaction the relay agreed to pay for.
 *
 * Anything not explicitly recognised is refused, because the failure mode of a
 * permissive relay is someone else's money.
 */
export function whyStructurallyRefused(tx: Transaction, contractId: string): string | null {
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

  if (target !== contractId) {
    return 'This relay only pays for the Splitr contract.';
  }
  return null;
}

/**
 * Whether this caller needs the relay at all.
 *
 * The browser already declines to call the relay above `FEE_FLOOR_XLM`, but
 * that is a decision made on the caller's own machine — the endpoint is a URL
 * anyone can post to, so it has to reach the same conclusion from the ledger.
 */
export function whyCallerRefused(callerXlm: number): string | null {
  if (!Number.isFinite(callerXlm)) {
    return 'Could not read what this account holds.';
  }
  if (callerXlm >= FEE_FLOOR_XLM) {
    return 'This account holds enough XLM to pay its own fee.';
  }
  return null;
}

/** Whether the sponsor has spent down to its floor and should stop. */
export function sponsorIsSpent(sponsorXlm: number): boolean {
  return !Number.isFinite(sponsorXlm) || sponsorXlm < SPONSOR_FLOOR_XLM;
}

export interface Limiter {
  /** Records the call and returns false if this account called too recently. */
  claim: (account: string, now: number) => boolean;
  /** Accounts currently inside the cooldown window. Exposed for the test. */
  tracked: () => number;
}

/**
 * A per-account cooldown, held in memory.
 *
 * **This is per instance, not global.** A serverless deployment runs several,
 * so a determined caller spread across them gets a multiple of this rate. The
 * honest fix is a shared store, which is a dependency and a bill this project
 * does not have on testnet — and it is the wrong place to lean anyway. What
 * actually bounds the spend is `whyCallerRefused`, which requires an attacker
 * to hold a genuinely empty account per stream of requests, and
 * `SPONSOR_FLOOR_XLM`, which bounds the total. The cooldown stops the cheap
 * case: one account in a loop.
 */
export function createLimiter(cooldownMs: number = COOLDOWN_MS): Limiter {
  const lastSeen = new Map<string, number>();

  return {
    claim(account, now) {
      // Prune first, so a long-lived instance holds an entry per caller in the
      // last minute rather than one per caller ever seen.
      for (const [key, at] of lastSeen) {
        if (now - at >= cooldownMs) lastSeen.delete(key);
      }

      const at = lastSeen.get(account);
      if (at !== undefined && now - at < cooldownMs) return false;

      lastSeen.set(account, now);
      return true;
    },
    tracked: () => lastSeen.size,
  };
}
