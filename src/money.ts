/**
 * Stellar amounts have exactly 7 decimal places. All Splitr arithmetic happens in
 * integer "units" (1 unit = 1e-7 of the asset) so a bill never loses a fraction to
 * floating point — the sum of the shares always equals the total, exactly.
 */
export const DECIMALS = 7;
export const ONE = 10_000_000n;

export function parseAmount(input: string): bigint {
  const s = input.trim().replace(/_/g, '');
  if (!/^\d+(\.\d{1,7})?$/.test(s)) {
    throw new Error(`Invalid amount "${input}" (max ${DECIMALS} decimal places, no negatives)`);
  }
  const [whole, frac = ''] = s.split('.');
  return BigInt(whole) * ONE + BigInt(frac.padEnd(DECIMALS, '0'));
}

export function formatAmount(units: bigint): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const whole = abs / ONE;
  const frac = (abs % ONE).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Human-readable grouping for Rupiah-sized numbers: 300000 -> 300,000 */
export function formatPretty(units: bigint): string {
  const [whole, frac] = formatAmount(units).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
}

/**
 * Largest-remainder split. Distributes `total` across `weights` so the parts sum
 * back to `total` exactly; leftover units go to the largest remainders first, ties
 * broken by index so the result is deterministic and reproducible on every machine.
 */
export function splitByWeights(total: bigint, weights: bigint[]): bigint[] {
  if (weights.length === 0) throw new Error('Cannot split across zero participants');
  const weightSum = weights.reduce((a, b) => a + b, 0n);
  if (weightSum <= 0n) throw new Error('Split weights must sum to more than zero');

  const parts = weights.map((w) => (total * w) / weightSum);
  const remainders = weights.map((w, i) => ({ i, rem: (total * w) % weightSum }));
  let leftover = total - parts.reduce((a, b) => a + b, 0n);

  remainders.sort((a, b) => (b.rem === a.rem ? a.i - b.i : b.rem > a.rem ? 1 : -1));
  for (let k = 0; leftover > 0n; k = (k + 1) % remainders.length, leftover--) {
    parts[remainders[k].i] += 1n;
  }
  return parts;
}

export function splitEven(total: bigint, n: number): bigint[] {
  return splitByWeights(total, Array.from({ length: n }, () => 1n));
}
