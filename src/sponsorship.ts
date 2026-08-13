/**
 * Handing a sponsored reserve back.
 *
 * `wallet onboard` moves a member's reserves onto a sponsor so they can arrive
 * holding nothing. Nothing moved them back, so a sponsor's XLM stayed locked
 * for as long as the member existed — fine at four members, an accumulating
 * liability at fifty, and the sponsor is also the account that pays for the
 * *next* member to be onboarded.
 *
 * The whole decision lives here, apart from the network, because the answer is
 * arithmetic over an account snapshot and the interesting cases are the ones
 * that must be refused. `scripts/sponsorship.ts` runs them.
 *
 * The rule Stellar enforces, and the reason this cannot be unconditional: a
 * revoked reserve falls back onto the account that holds the entry. A member
 * still holding zero XLM cannot take theirs back — the revocation would leave
 * them under their own minimum and the network rejects it. Sponsorship is
 * therefore not a loan that can be called at will; it is released only once the
 * member can carry it. Saying that up front is better than forwarding
 * `op_low_reserve` and letting the operator guess which of the two accounts is
 * short.
 */
import type { AccountSnapshot, BalanceLine } from './stellar.ts';

export interface UnsponsorPlan {
  /** Sponsored trustlines to revoke, in submission order. */
  trustlines: BalanceLine[];
  /** Whether the account's own base reserve is being handed back too. */
  account: boolean;
  /** Ledger entries the sponsor stops paying for. */
  entries: number;
  /**
   * Reserve *units* those entries cost, which is not the same number. An
   * account's own entry is worth two — the `2` in the minimum-balance formula —
   * and every other entry is worth one. Horizon counts `num_sponsored` in these
   * units, so this is what may be subtracted from it.
   */
  reserves: number;
  /** XLM the sponsor gets back. */
  releasedXLM: number;
  /** What the member's own floor becomes once these are revoked. */
  floorAfterXLM: number;
  heldXLM: number;
  /** XLM the member is short of carrying its own reserves. Zero when ready. */
  shortfallXLM: number;
}

/**
 * What could be handed back to `sponsorKey`, and what it would cost the member.
 *
 * Only entries this sponsor actually pays for are included. Revoking is scoped
 * to one sponsor because that is who signs it, and because a member sponsored
 * by two accounts must not have one of them silently release the other's.
 */
export function planUnsponsor(
  snap: AccountSnapshot,
  sponsorKey: string,
  baseReserveXLM: number,
): UnsponsorPlan {
  const trustlines = snap.balances.filter((b) => b.issuer !== null && b.sponsor === sponsorKey);
  const account = snap.sponsor === sponsorKey;
  const entries = trustlines.length + (account ? 1 : 0);
  // Two for the account, one per trustline. Counting entries here instead
  // understates what onboarding cost — a sponsored member reads
  // `num_sponsored: 3` off Horizon, not 2 — and would have this command tell a
  // treasurer to send 1 XLM when the network is about to demand 1.5.
  const reserves = trustlines.length + (account ? 2 : 0);

  // Every revoked reserve is one fewer someone else is covering, so the
  // member's own floor rises by exactly that many.
  const sponsoredAfter = Math.max(0, snap.sponsored - reserves);
  const floorEntries = Math.max(0, 2 + snap.subentries + snap.sponsoring - sponsoredAfter);
  const floorAfterXLM = round7(floorEntries * baseReserveXLM);
  const heldXLM = Number(snap.balances.find((b) => b.code === 'XLM')?.balance ?? '0');

  return {
    trustlines,
    account,
    entries,
    reserves,
    releasedXLM: round7(reserves * baseReserveXLM),
    floorAfterXLM,
    heldXLM,
    shortfallXLM: Math.max(0, round7(floorAfterXLM - heldXLM)),
  };
}

/**
 * Why this hand-back cannot go ahead, or `null` if it can.
 *
 * Checked before building the transaction rather than after Horizon rejects it,
 * because the failure that matters — the member cannot carry their own reserve
 * yet — is a fact about the group, not a malformed request, and the operator
 * needs to be told which account to top up and by how much.
 */
export function whyUnsponsorRefused(
  snap: AccountSnapshot,
  plan: UnsponsorPlan,
  labels: { member: string; sponsor: string },
): string | null {
  if (!snap.exists) {
    return `"${labels.member}" is not on chain, so nothing is being sponsored for them.`;
  }
  if (plan.entries === 0) {
    return (
      `"${labels.sponsor}" is not paying any reserves for "${labels.member}".` +
      (snap.sponsored > 0
        ? ` Someone else is — ${snap.sponsored} entr${snap.sponsored === 1 ? 'y' : 'ies'}.`
        : '')
    );
  }
  if (plan.shortfallXLM > 0) {
    return (
      `"${labels.member}" cannot carry their own reserves yet: they hold ` +
      `${plan.heldXLM} XLM and would need ${plan.floorAfterXLM}. ` +
      `Send them ${plan.shortfallXLM} XLM first, or leave the sponsorship in place — ` +
      `revoking it would put them below their minimum and the network would refuse.`
    );
  }
  return null;
}

/** XLM has 7 decimal places; float arithmetic on reserves needs pinning back to them. */
function round7(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}
