/**
 * The bill being built, before any of it touches the chain.
 *
 * Pure on purpose, and separate from the form that renders it. Two decisions
 * here are easy to get wrong and impossible to see once they are wrong — the
 * de-duplication, and the fact that a member with no wallet still takes a share
 * — so they live somewhere they can be exercised directly rather than only
 * through a browser with a wallet extension attached.
 */
import { parseAmount, splitByWeights } from './split.ts';
import type { Group } from './groups.ts';

/**
 * One line of the bill. `address` is null for a group member who has no wallet
 * yet: they still get a share and still appear in the split, and they only
 * block the on-chain step.
 */
export type Row = {
  key: string;
  name: string;
  address: string | null;
  isYou: boolean;
};

/**
 * Who is on the bill: a group's roster, or a pasted list of addresses.
 *
 * The payer is appended if they are not already there. The contract requires
 * the payer to be a member, and a roster built on somebody else's phone will
 * not have them.
 */
export function buildRows(opts: {
  group: Group | null;
  pasted: string;
  me: string;
  youLabel: string;
  shorten: (address: string) => string;
}): Row[] {
  const { group, pasted, me, youLabel, shorten } = opts;
  const rows: Row[] = [];
  const seen = new Set<string>();

  const push = (row: Row) => {
    // The contract writes one share per member, so the same wallet listed twice
    // would quietly double that person's portion of the bill.
    if (row.address) {
      if (seen.has(row.address)) return;
      seen.add(row.address);
    }
    rows.push(row);
  };

  if (group) {
    for (const m of group.members) {
      push({ key: m.id, name: m.name, address: m.address, isYou: m.address === me });
    }
  } else {
    for (const a of pasted
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      push({ key: a, name: shorten(a), address: a, isYou: a === me });
    }
  }

  if (!rows.some((r) => r.isYou)) {
    push({ key: 'you', name: youLabel, address: me, isYou: true });
  }
  return rows;
}

export type Preview = { total: bigint; parts: bigint[] };

/**
 * What each row owes, or null when there is not yet enough to say.
 *
 * `splitByWeights` is the same engine the Soroban contract mirrors, so what is
 * previewed here is what `create_bill` will compute and record — the preview is
 * not an estimate of the real thing, it is the real thing run early.
 */
export function previewSplit(
  rows: Row[],
  rawAmount: string,
  weights: Record<string, number>,
): Preview | null {
  const clean = rawAmount.replace(/[^\d.]/g, '');
  if (!clean || rows.length < 2) return null;

  let total: bigint;
  try {
    total = parseAmount(clean);
  } catch {
    // Half-typed input is the normal state of a form, not an error to report.
    return null;
  }
  if (total <= 0n) return null;

  return { total, parts: splitByWeights(total, rows.map((r) => BigInt(weightOf(weights, r.key)))) };
}

/** Weights are clamped, so `splitByWeights` can never see a zero sum. */
export function weightOf(weights: Record<string, number>, key: string): number {
  return clampWeight(weights[key] ?? 1);
}

export function clampWeight(value: number): number {
  return Math.min(99, Math.max(1, Math.round(value)));
}
