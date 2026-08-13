/**
 * Exercises the relay's guards.
 *
 * The README has said since Green Belt that the relay "typechecks and its guard
 * logic is straightforward, but no request has ever reached it". Straightforward
 * is not the same as run. These are the refusals that stand between the sponsor
 * and anyone who finds the URL, so they are worth more than a reading.
 *
 * What is still untested here is the part that needs a network: the fee-bump
 * itself, and Horizon telling us a balance. This covers every decision made
 * from those answers.
 *
 * Run with `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Asset, BASE_FEE, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import deployments from '../soroban/deployments.json' with { type: 'json' };
import {
  COOLDOWN_MS,
  FEE_FLOOR_XLM,
  SPONSOR_FLOOR_XLM,
  createLimiter,
  sponsorIsSpent,
  whyCallerRefused,
  whyStructurallyRefused,
} from '../api/guards.ts';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const CONTRACT_ID = deployments.testnet['splitr-split'].contractId;
/** A real contract that is not ours — the SAC the settlement asset runs on. */
const OTHER_CONTRACT = deployments.testnet['idrx-sac'].contractId;

function transaction(...operations: ReturnType<typeof Operation.payment>[]) {
  const builder = new TransactionBuilder(new Account(Keypair.random().publicKey(), '1'), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of operations) builder.addOperation(op);
  return builder.setTimeout(30).build();
}

const callContract = (contract: string) =>
  Operation.invokeContractFunction({ contract, function: 'settle', args: [] });

test('a single call to the Splitr contract is accepted', () => {
  assert.equal(whyStructurallyRefused(transaction(callContract(CONTRACT_ID)), CONTRACT_ID), null);
});

test('anything but one call to the Splitr contract is refused', () => {
  const refused = (tx: ReturnType<typeof transaction>) => whyStructurallyRefused(tx, CONTRACT_ID);
  const pay = () =>
    Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: '1',
    });

  // Another contract's call. The relay pays for this project, not for whatever
  // else the caller would like invoked.
  assert.match(refused(transaction(callContract(OTHER_CONTRACT))) ?? '', /only pays for the Splitr/);

  // More than one operation: a second op could do anything, including moving
  // the sponsor's own funds if it were ever the source.
  assert.match(refused(transaction(pay(), pay())) ?? '', /single-operation/);

  // Not a contract call at all.
  assert.match(refused(transaction(pay())) ?? '', /contract invocations/);

  // A contract operation, but one that uploads code rather than calling ours.
  assert.match(
    refused(transaction(Operation.uploadContractWasm({ wasm: Buffer.from([0, 97, 115, 109]) }))) ??
      '',
    /not uploads or deployments/,
  );
});

test('only an account that cannot pay its own fee is relayed for', () => {
  // The case the relay exists for: onboarded, holding nothing.
  assert.equal(whyCallerRefused(0), null);
  // Some dust, still short of a reliable invocation.
  assert.equal(whyCallerRefused(FEE_FLOOR_XLM - 0.0000001), null);

  // Exactly at the floor is the browser's own cut-off for taking this route, so
  // it has to refuse here or the two disagree about the same number.
  assert.ok(whyCallerRefused(FEE_FLOOR_XLM));
  assert.ok(whyCallerRefused(100));
  // Horizon answered with something unusable; refuse rather than assume zero.
  assert.ok(whyCallerRefused(Number.NaN));
});

test('the sponsor stops at its floor, not at empty', () => {
  assert.equal(sponsorIsSpent(SPONSOR_FLOOR_XLM), false);
  assert.equal(sponsorIsSpent(1000), false);
  assert.equal(sponsorIsSpent(SPONSOR_FLOOR_XLM - 0.0000001), true);
  assert.equal(sponsorIsSpent(0), true);
  assert.equal(sponsorIsSpent(Number.NaN), true);
});

test('an account gets one relayed call per cooldown', () => {
  const limiter = createLimiter(COOLDOWN_MS);
  const alice = Keypair.random().publicKey();
  const bob = Keypair.random().publicKey();
  const start = 1_000_000;

  assert.equal(limiter.claim(alice, start), true);
  assert.equal(limiter.claim(alice, start + 1), false, 'a second call straight away is refused');
  assert.equal(limiter.claim(alice, start + COOLDOWN_MS - 1), false);
  assert.equal(limiter.claim(alice, start + COOLDOWN_MS), true, 'allowed again once it expires');

  // One caller in a loop must not lock anyone else out.
  assert.equal(limiter.claim(bob, start + COOLDOWN_MS), true);
});

test('the limiter forgets accounts once their cooldown passes', () => {
  const limiter = createLimiter(COOLDOWN_MS);
  const start = 1_000_000;

  for (let i = 0; i < 50; i++) limiter.claim(Keypair.random().publicKey(), start);
  assert.equal(limiter.tracked(), 50);

  // A later call prunes them, so a warm instance holds the last minute of
  // callers rather than every caller it has ever seen.
  limiter.claim(Keypair.random().publicKey(), start + COOLDOWN_MS);
  assert.equal(limiter.tracked(), 1);
});
