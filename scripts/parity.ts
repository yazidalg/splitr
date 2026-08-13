/**
 * The TypeScript half of the cross-implementation gate.
 *
 * `splitByWeights` exists twice — here in `src/money.ts` as `BigInt`, and in
 * `soroban/contracts/splitr-split/src/lib.rs` as `i128` — and the two have to
 * produce the same number for the same bill, tie-break included. The landing
 * page's preview runs the TypeScript one; the chain runs the Rust one. If they
 * disagree, the page tells people something the contract will not honour.
 *
 * `test::agrees_with_money_ts` already pins the Rust side, but it pins it
 * against numbers recorded in Rust, not against what this file's engine
 * actually returns. That made the gate one-directional: editing `lib.rs` broke
 * `cargo test`, while editing `money.ts` broke nothing at all — `tsc` checks
 * types, not values, and Cargo never learns TypeScript changed. This file
 * closes the other direction with the identical cases, so a change to either
 * implementation alone now fails a build.
 *
 * Run with `npm test`. It uses only `node:test`, because `src/money.ts` has to
 * stay dependency-free and browser-safe (the web bundle imports it directly),
 * and adding a test framework to prove that would be a strange way to keep it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ONE, splitByWeights } from '../src/money.ts';

/** Weights are `u32` on the contract side; take them the same way here. */
function parts(total: bigint, ws: number[]): bigint[] {
  return splitByWeights(
    total,
    ws.map((w) => BigInt(w)),
  );
}

test('agrees with the contract, case for case', () => {
  // 300,000 across three, evenly. Divides cleanly.
  assert.deepEqual(parts(300_000n * ONE, [1, 1, 1]), [
    100_000n * ONE,
    100_000n * ONE,
    100_000n * ONE,
  ]);

  // 100,000 across three. Does not divide: one unit is left over and goes to
  // the first largest remainder, which is index 0 on a tie.
  assert.deepEqual(parts(100_000n * ONE, [1, 1, 1]), [
    333_333_333_334n,
    333_333_333_333n,
    333_333_333_333n,
  ]);

  // Weighted 2:1:1.
  assert.deepEqual(parts(300_000n * ONE, [2, 1, 1]), [
    150_000n * ONE,
    75_000n * ONE,
    75_000n * ONE,
  ]);

  // 40,000 across seven. Six units left over, so the first six indices take one
  // each and the last is a unit short.
  assert.deepEqual(parts(40_000n * ONE, [1, 1, 1, 1, 1, 1, 1]), [
    57_142_857_143n,
    57_142_857_143n,
    57_142_857_143n,
    57_142_857_143n,
    57_142_857_143n,
    57_142_857_143n,
    57_142_857_142n,
  ]);
});

test('parts always sum back to the total', () => {
  const cases: [bigint, number[]][] = [
    [1n, [1, 1, 1]],
    [7n, [1, 1, 1, 1, 1, 1, 1]],
    [100_000n * ONE, [1, 1, 1]],
    [40_000n * ONE, [1, 1, 1, 1, 1, 1, 1]],
    [999_999n, [3, 1, 1, 1]],
    [123_456_789n, [5, 3, 2]],
    [1n, [1, 1]],
    // u32::MAX of the asset, split nine ways — the widest spread the contract's
    // own weights can express.
    [4_294_967_295n * ONE, [9, 8, 7, 6, 5, 4, 3, 2, 1]],
  ];

  for (const [total, ws] of cases) {
    const split = parts(total, ws);
    let sum = 0n;
    for (const part of split) {
      assert.ok(part >= 0n, 'no share may be negative');
      sum += part;
    }
    assert.equal(sum, total, `shares must sum back to ${total}`);
  }
});

test('heavier weights never receive less than lighter ones', () => {
  const split = parts(300_000n * ONE, [3, 2, 1]);
  assert.ok(split[0] > split[1]);
  assert.ok(split[1] > split[2]);
});
