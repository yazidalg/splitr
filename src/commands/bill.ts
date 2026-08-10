/**
 * Bills — the contract-backed counterpart to `split`.
 *
 * `split` records the group locally and settles with classic payments tagged by
 * memo; truth is reassembled afterwards by replaying Horizon. `bill` puts the
 * group in the contract, which computes the shares itself and moves the asset
 * inside the same invocation that records the payment. Nothing to reconcile:
 * `bill show` reads the answer instead of deriving it.
 *
 * Both remain useful. `split` needs no contract and works with any wallet on
 * the network; `bill` needs the contract but cannot disagree with itself.
 */
import { findWallet, keypairFor } from '../store.ts';
import { requireAssetConfig, requireSacId } from '../config.ts';
import { explorerTx } from '../stellar.ts';
import {
  splitrClient,
  unwrap,
  readEvents,
  watchEvents,
  type BillEvent,
  type ContractBill,
  type SplitrClient,
} from '../soroban.ts';
import { parseAmount, formatPretty } from '../money.ts';

// -------------------------------------------------------------------- create

export async function billCreate(flags: Record<string, string>): Promise<void> {
  const payerLabel = flags.payer;
  const amount = flags.amount;
  const memberArg = flags.members;
  if (!payerLabel || !amount || !memberArg) {
    throw new Error(
      'Usage: bill create --group <name> --payer <label> --amount <n> --members a,b,c [--shares a=2,b=1]',
    );
  }

  const labels = memberArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (!labels.includes(payerLabel)) labels.unshift(payerLabel);
  if (labels.length < 2) throw new Error('A bill needs at least two participants.');

  const weights = parseWeights(flags.shares, labels);
  const total = parseAmount(amount);
  const cfg = requireAssetConfig();
  const payer = findWallet(payerLabel);

  const client = await splitrClient(await keypairFor(payer));
  const tx = await client.create_bill({
    payer: payer.publicKey,
    group: flags.group ?? 'group',
    asset: requireSacId(),
    total,
    members: labels.map((l) => findWallet(l).publicKey),
    weights,
  });

  const sent = await tx.signAndSend();
  const id = unwrap(sent.result);

  console.log(`Bill #${id} · ${flags.group ?? 'group'} — recorded on-chain`);
  console.log(`  total ${formatPretty(total)} ${cfg.code}, fronted by "${payerLabel}"`);
  if (sent.sendTransactionResponse?.hash) {
    console.log(`  ${explorerTx(sent.sendTransactionResponse.hash)}`);
  }
  console.log(
    `\nThe contract computed the shares, not this CLI. Read them back: bill show ${id}`,
  );
}

function parseWeights(shares: string | undefined, labels: string[]): number[] {
  if (!shares) return labels.map(() => 1);
  const map = new Map<string, number>();
  for (const pair of shares.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (!k || !v) throw new Error(`Bad --shares entry "${pair}", expected label=weight`);
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`Weight for "${k}" must be a positive integer`);
    map.set(k, n);
  }
  const unknown = [...map.keys()].filter((k) => !labels.includes(k));
  if (unknown.length) throw new Error(`--shares mentions non-members: ${unknown.join(', ')}`);
  return labels.map((l) => map.get(l) ?? 1);
}

// ---------------------------------------------------------------------- show

export async function billShow(idArg: string): Promise<void> {
  const id = requireId(idArg);
  const client = await splitrClient();
  printBill(unwrap((await client.bill({ id })).result));
}

function printBill(bill: ContractBill): void {
  // Derived from the same snapshot rather than read back with `outstanding`:
  // two RPC calls can simulate against two different ledgers, and a page that
  // shows a member as unpaid next to a total that says otherwise is worse than
  // a page that is simply a moment old. The contract's `outstanding` computes
  // exactly this sum — see `outstandingOf`.
  const outstanding = outstandingOf(bill);
  const cfg = requireAssetConfig();

  console.log(`Bill #${bill.id} · ${bill.group}`);
  console.log(`  total ${formatPretty(bill.total)} ${cfg.code}, fronted by ${short(bill.payer)}\n`);

  for (const s of bill.shares) {
    const remaining = s.owes - s.paid;
    const isPayer = s.member === bill.payer;
    const mark = isPayer ? 'PAID' : remaining <= 0n ? 'PAID' : 'OPEN';
    console.log(
      `  ${mark}  ${short(s.member)}  weight ${String(s.weight).padStart(2)}` +
        `  owes ${formatPretty(s.owes).padStart(14)}  paid ${formatPretty(s.paid).padStart(14)}` +
        (remaining > 0n && !isPayer ? `  short ${formatPretty(remaining)}` : ''),
    );
  }

  console.log(
    outstanding === 0n
      ? '\nSettled in full — this is the contract\'s own record, not a reconstruction.'
      : `\nOutstanding: ${formatPretty(outstanding)} ${cfg.code}`,
  );
}

/** Contract addresses are 56 characters; nobody reads them whole. */
function short(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * What the group still owes the payer. Mirrors `outstanding` in the contract,
 * so a caller holding a `Bill` never has to make a second round trip that could
 * answer from a different ledger.
 */
function outstandingOf(bill: ContractBill): bigint {
  let total = 0n;
  for (const s of bill.shares) {
    const remaining = s.owes - s.paid;
    if (remaining > 0n) total += remaining;
  }
  return total;
}

/**
 * Reads a bill back after writing to it, waiting for the contract's record to
 * reflect the write.
 *
 * `signAndSend` returns once the transaction is in a closed ledger, but reads
 * are simulations, and an RPC node can still simulate against a slightly older
 * snapshot — which would print the member who just paid as still owing, one
 * line under their own receipt. Poll until it catches up, then give up quietly:
 * the receipt above is authoritative either way.
 */
async function billAfterWrite(
  client: SplitrClient,
  id: number,
  isFresh: (bill: ContractBill) => boolean,
): Promise<ContractBill> {
  let bill = unwrap((await client.bill({ id })).result);
  for (let attempt = 0; attempt < 5 && !isFresh(bill); attempt++) {
    await new Promise((r) => setTimeout(r, 2_000));
    bill = unwrap((await client.bill({ id })).result);
  }
  return bill;
}

function requireId(idArg: string | undefined): number {
  const id = Number(idArg);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Bill ids are positive integers, got "${idArg ?? ''}". Try: bill list`);
  }
  return id;
}

// -------------------------------------------------------------------- settle

export async function billSettle(idArg: string, flags: Record<string, string>): Promise<void> {
  const id = requireId(idArg);
  const label = flags.member;
  if (!label) throw new Error('Usage: bill settle <id> --member <label> [--amount <n>]');

  const wallet = findWallet(label);
  const client = await splitrClient(await keypairFor(wallet));
  const cfg = requireAssetConfig();

  // Read what this member had already paid before writing, so the reread below
  // can tell "RPC is a ledger behind" from "a partial payment landed".
  const paidBefore = paidBy(unwrap((await client.bill({ id })).result), wallet.publicKey);

  // Without --amount the contract works out what is left; with it, a member
  // pays part of their share now and the rest whenever they can.
  const tx = flags.amount
    ? await client.settle_part({ id, member: wallet.publicKey, amount: parseAmount(flags.amount) })
    : await client.settle({ id, member: wallet.publicKey });
  const sent = await tx.signAndSend();
  const moved = unwrap(sent.result);

  console.log(`  ${label} settled ${formatPretty(moved)} ${cfg.code} on bill #${id}`);
  if (sent.sendTransactionResponse?.hash) {
    console.log(`    ${explorerTx(sent.sendTransactionResponse.hash)}`);
  }
  console.log('    the transfer and the record happened in one invocation\n');

  printBill(
    await billAfterWrite(
      client,
      id,
      (b) => paidBy(b, wallet.publicKey) >= paidBefore + moved,
    ),
  );
}

function paidBy(bill: ContractBill, member: string): bigint {
  return bill.shares.find((s) => s.member === member)?.paid ?? 0n;
}

// ---------------------------------------------------------------------- list

export async function billList(): Promise<void> {
  const client = await splitrClient();
  const count = (await client.count()).result;
  if (count === 0) return void console.log('No bills on-chain yet. Try: bill create …');

  const cfg = requireAssetConfig();
  for (let id = 1; id <= count; id++) {
    const bill = await safeBill(client, id);
    if (!bill) continue;
    const outstanding = outstandingOf(bill);
    console.log(
      `#${String(bill.id).padStart(3)}  ${bill.group.padEnd(18)}` +
        ` ${formatPretty(bill.total).padStart(14)} ${cfg.code}` +
        `  payer=${short(bill.payer)}  ${bill.shares.length} members` +
        `  ${outstanding === 0n ? 'settled' : `outstanding ${formatPretty(outstanding)}`}`,
    );
  }
}

/** A bill whose storage TTL lapsed is gone, not an error worth aborting a list for. */
async function safeBill(client: SplitrClient, id: number): Promise<ContractBill | null> {
  try {
    return unwrap((await client.bill({ id })).result);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------- mine

/**
 * The bills one member is on, from the contract's own index.
 *
 * `bill list` walks 1..count because it is an operator's view of everything.
 * This is the view an app needs, and it is one call rather than one per bill.
 */
export async function billMine(label: string | undefined): Promise<void> {
  if (!label) throw new Error('Usage: bill mine <label>');
  const wallet = findWallet(label);
  const client = await splitrClient();
  const ids = (await client.bills_for({ member: wallet.publicKey })).result;

  if (ids.length === 0) return void console.log(`"${label}" is not on any bill yet.`);

  const cfg = requireAssetConfig();
  for (const id of ids) {
    const bill = await safeBill(client, id);
    if (!bill) continue;
    const owed = bill.shares.find((s) => s.member === wallet.publicKey);
    const remaining = owed ? owed.owes - owed.paid : 0n;
    const role = bill.payer === wallet.publicKey ? 'fronted' : remaining > 0n ? 'owes' : 'settled';
    console.log(
      `#${String(bill.id).padStart(3)}  ${bill.group.padEnd(18)}` +
        ` ${formatPretty(bill.total).padStart(14)} ${cfg.code}  ${role}` +
        (remaining > 0n && bill.payer !== wallet.publicKey
          ? ` ${formatPretty(remaining)}`
          : ''),
    );
  }
}

// --------------------------------------------------------------------- watch

export async function billWatch(flags: Record<string, string>): Promise<void> {
  const client = await splitrClient();
  const cfg = requireAssetConfig();

  const from = flags.from ? Number(flags.from) : undefined;
  if (flags.from && !Number.isInteger(from)) throw new Error('--from takes a ledger sequence');

  // A one-shot catch-up read, so `--from` reports history and then stops.
  if (flags.once) {
    const page = await readEvents(client, { startLedger: from });
    for (const e of page.events) console.log(render(e, cfg.code));
    console.log(
      `\n${page.events.length} event(s) up to ledger ${page.latestLedger}. ` +
        'Drop --once to keep following.',
    );
    return;
  }

  console.log(`Following ${cfg.code} bills on-chain. Ctrl-C to stop.\n`);
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      controller.abort();
      console.log('\nStopped.');
      process.exit(0);
    });
  }

  for await (const e of watchEvents(client, {
    startLedger: from,
    signal: controller.signal,
    onError: (message) => console.error(`  … RPC unavailable, retrying (${message})`),
  })) {
    console.log(render(e, cfg.code));
  }
}

/**
 * `name` is the event struct's declared name from the contract spec — `Created`,
 * `Settled` — not the lower-case topic symbol the chain carries. Amounts arrive
 * already decoded as bigints, in the same 1e-7 units as everything else here.
 */
function render(e: BillEvent, code: string): string {
  const when = e.at.replace('T', ' ').replace('Z', '');
  const amount = (v: unknown) => formatPretty(typeof v === 'bigint' ? v : 0n);

  switch (e.name) {
    case 'Created':
      return (
        `${when}  created  bill #${e.id}  ${amount(e.data.total)} ${code}` +
        `  payer ${short(String(e.data.payer ?? ''))}`
      );
    case 'Settled':
      return (
        `${when}  settled  bill #${e.id}  ${amount(e.data.amount)} ${code}` +
        `  from ${short(String(e.data.member ?? ''))}`
      );
    default:
      // An event this CLI predates. Show it rather than drop it — but JSON
      // cannot serialise the bigints the decoder produces.
      return `${when}  ${e.name}  bill #${e.id}  ${describe(e.data)}`;
  }
}

function describe(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${typeof v === 'bigint' ? formatPretty(v) : String(v)}`)
    .join(' ');
}
