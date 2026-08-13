/**
 * Exercises the rules for handing a sponsored reserve back.
 *
 * These are the cases `wallet unsponsor` has to get right without a network:
 * which entries belong to which sponsor, and whether the member can carry the
 * reserve once it lands on them. The second is the one that matters — revoking
 * too early puts a member under their own minimum, and Stellar refuses the
 * whole transaction rather than half of it.
 *
 * Run with `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planUnsponsor, whyUnsponsorRefused } from '../src/sponsorship.ts';
import type { AccountSnapshot, BalanceLine } from '../src/stellar.ts';

const BASE_RESERVE = 0.5;
const SPONSOR = 'GSPONSOR';
const STRANGER = 'GSTRANGER';
const LABELS = { member: 'dina', sponsor: 'issuer' };

function line(over: Partial<BalanceLine> = {}): BalanceLine {
  return { code: 'IDRX', issuer: 'GISSUER', balance: '50000', limit: null, sponsor: null, ...over };
}

/**
 * A member as `wallet onboard` leaves them: on chain, holding nothing at all.
 *
 * `sponsored` is 3, not 2, and that is not a typo. Horizon counts reserve units
 * rather than entries, and an account's own entry is worth two of them. This
 * fixture is the shape read back off testnet for the member the README follows.
 */
function onboarded(over: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    exists: true,
    publicKey: 'GDINA',
    subentries: 1,
    sponsoring: 0,
    sponsored: 3,
    sponsor: SPONSOR,
    balances: [
      { code: 'XLM', issuer: null, balance: '0', limit: null, sponsor: null },
      line({ sponsor: SPONSOR }),
    ],
    minBalanceXLM: 0,
    spendableXLM: 0,
    ...over,
  };
}

function withXLM(snap: AccountSnapshot, xlm: string): AccountSnapshot {
  return { ...snap, balances: snap.balances.map((b) => (b.code === 'XLM' ? { ...b, balance: xlm } : b)) };
}

test('an onboarded member has both entries to hand back', () => {
  const plan = planUnsponsor(onboarded(), SPONSOR, BASE_RESERVE);

  assert.equal(plan.account, true);
  assert.equal(plan.trustlines.length, 1);
  assert.equal(plan.entries, 2);
  // Two entries, but three reserve units: the account is worth two on its own.
  // Counting entries here reports 1 XLM released instead of 1.5 — half a
  // trustline adrift, and the number a treasurer is told to send.
  assert.equal(plan.reserves, 3);
  // 1 XLM for the account, 0.5 for the trustline — exactly what onboarding cost.
  assert.equal(plan.releasedXLM, 1.5);
  // And exactly what the member must then carry themselves.
  assert.equal(plan.floorAfterXLM, 1.5);
});

test('a member holding nothing cannot take their reserve back', () => {
  const snap = onboarded();
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  assert.equal(plan.shortfallXLM, 1.5);
  const refusal = whyUnsponsorRefused(snap, plan, LABELS);
  // The operator has to be told which account to top up, and by how much —
  // op_low_reserve names neither.
  assert.match(refusal ?? '', /cannot carry their own reserves yet/);
  assert.match(refusal ?? '', /1\.5/);
});

test('a member who has funded themselves can', () => {
  const snap = withXLM(onboarded(), '1.5');
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  assert.equal(plan.shortfallXLM, 0);
  assert.equal(whyUnsponsorRefused(snap, plan, LABELS), null);
});

test('a stroop short is still short', () => {
  const snap = withXLM(onboarded(), '1.4999999');
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  assert.equal(plan.shortfallXLM, 0.0000001);
  assert.ok(whyUnsponsorRefused(snap, plan, LABELS));
});

test('only the entries this sponsor pays for are revoked', () => {
  // The account is ours, the trustline is someone else's. Releasing both would
  // be one sponsor spending another's decision.
  const snap = onboarded({ balances: [
    { code: 'XLM', issuer: null, balance: '2', limit: null, sponsor: null },
    line({ sponsor: STRANGER }),
  ] });
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  assert.equal(plan.account, true);
  assert.deepEqual(plan.trustlines, []);
  assert.equal(plan.entries, 1);
  assert.equal(plan.reserves, 2);
  assert.equal(plan.releasedXLM, 1);
  // The stranger's trustline stays sponsored, so the member picks up the
  // account's two reserves and not that one.
  assert.equal(plan.floorAfterXLM, 1);
  assert.equal(whyUnsponsorRefused(snap, plan, LABELS), null);
});

test('a sponsor with nothing to release is told so, not sent to the network', () => {
  const snap = onboarded({ sponsor: STRANGER, balances: [
    { code: 'XLM', issuer: null, balance: '5', limit: null, sponsor: null },
    line({ sponsor: STRANGER }),
  ] });
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  assert.equal(plan.entries, 0);
  assert.equal(plan.reserves, 0);
  const refusal = whyUnsponsorRefused(snap, plan, LABELS);
  assert.match(refusal ?? '', /not paying any reserves/);
  // Someone is sponsoring them, just not us — worth saying, or the operator
  // reads this as "there is nothing sponsored here".
  assert.match(refusal ?? '', /Someone else is/);
});

test('an account that never made it on chain is refused first', () => {
  const snap: AccountSnapshot = {
    exists: false,
    publicKey: 'GDINA',
    subentries: 0,
    sponsoring: 0,
    sponsored: 0,
    sponsor: null,
    balances: [],
    minBalanceXLM: 0,
    spendableXLM: 0,
  };
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);
  assert.match(whyUnsponsorRefused(snap, plan, LABELS) ?? '', /not on chain/);
});

test('a member who sponsors someone else keeps carrying that', () => {
  // dina was onboarded, then sponsored a friend herself. Handing her own
  // reserves back must not forget the one she now pays for.
  const snap = withXLM(onboarded({ sponsoring: 1 }), '3');
  const plan = planUnsponsor(snap, SPONSOR, BASE_RESERVE);

  // 2 (base) + 1 (her trustline) + 1 (what she sponsors) - 0 = 4 entries.
  assert.equal(plan.floorAfterXLM, 2);
  assert.equal(plan.shortfallXLM, 0);
});
