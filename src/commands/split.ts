import crypto from 'node:crypto';
import { Operation } from '@stellar/stellar-sdk';
import type { Asset } from '@stellar/stellar-sdk';
import { findWallet, findSplit, loadSplits, saveSplits, keypairFor, type Split } from '../store.ts';
import { requireAssetConfig, assetFrom } from '../config.ts';
import {
  server,
  snapshot,
  submit,
  hasTrustline,
  balanceOf,
  explorerTx,
} from '../stellar.ts';
import { parseAmount, formatAmount, formatPretty, splitByWeights } from '../money.ts';

// ------------------------------------------------------------------- create

export async function splitCreate(flags: Record<string, string>): Promise<void> {
  const cfg = requireAssetConfig();
  const group = flags.group ?? 'group';
  const payerLabel = flags.payer;
  const amount = flags.amount;
  const memberArg = flags.members;
  if (!payerLabel || !amount || !memberArg) {
    throw new Error(
      'Usage: split create --group <name> --payer <label> --amount <n> --members a,b,c [--shares a=2,b=1] [--note "..."]',
    );
  }

  const labels = memberArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (!labels.includes(payerLabel)) labels.unshift(payerLabel);
  if (labels.length < 2) throw new Error('A split needs at least two participants.');

  const weights = parseWeights(flags.shares, labels);
  const total = parseAmount(amount);
  const shares = splitByWeights(total, weights);

  const id = crypto.randomBytes(4).toString('hex');
  const payer = findWallet(payerLabel);
  const split: Split = {
    id,
    group,
    note: flags.note ?? '',
    asset: { code: cfg.code, issuer: cfg.issuer },
    total: formatAmount(total),
    payer: payerLabel,
    payerPublicKey: payer.publicKey,
    members: labels.map((label, i) => ({
      label,
      publicKey: findWallet(label).publicKey,
      weight: weights[i].toString(),
      owes: formatAmount(shares[i]),
    })),
    memo: `splitr:${id}`,
    createdAt: new Date().toISOString(),
  };

  const splits = loadSplits();
  splits.push(split);
  saveSplits(splits);

  console.log(`Split ${id} · ${group}${split.note ? ` — ${split.note}` : ''}`);
  console.log(`  total ${formatPretty(total)} ${cfg.code}, fronted by "${payerLabel}"`);
  console.log(`  memo  ${split.memo}  (this is what makes the payment self-identifying on-chain)\n`);
  for (const m of split.members) {
    const owed = m.label === payerLabel ? 'fronted the bill' : `owes ${formatPretty(parseAmount(m.owes))}`;
    console.log(`  ${m.label.padEnd(12)} share ${formatPretty(parseAmount(m.owes)).padStart(14)}  ${owed}`);
  }
  console.log(`\nNext: split settle ${id}`);
}

function parseWeights(shares: string | undefined, labels: string[]): bigint[] {
  if (!shares) return labels.map(() => 1n);
  const map = new Map<string, bigint>();
  for (const pair of shares.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (!k || !v) throw new Error(`Bad --shares entry "${pair}", expected label=weight`);
    map.set(k, BigInt(v));
  }
  const unknown = [...map.keys()].filter((k) => !labels.includes(k));
  if (unknown.length) throw new Error(`--shares mentions non-members: ${unknown.join(', ')}`);
  return labels.map((l) => map.get(l) ?? 1n);
}

// --------------------------------------------------------------------- list

export function splitList(): void {
  const splits = loadSplits();
  if (splits.length === 0) return void console.log('No splits yet. Try: split create …');
  for (const s of splits) {
    console.log(
      `${s.id}  ${s.group.padEnd(14)} ${formatPretty(parseAmount(s.total)).padStart(14)} ${s.asset.code}` +
        `  payer=${s.payer}  ${s.members.length} members${s.note ? `  — ${s.note}` : ''}`,
    );
  }
}

// ---------------------------------------------------------------- reconcile

export interface MemberStatus {
  label: string;
  publicKey: string;
  owes: bigint;
  paid: bigint;
  txs: string[];
}

/**
 * Truth comes from the ledger, not from a local "paid" flag. Splitr replays the
 * payer's payment history, keeps the ones carrying this split's memo, and sums
 * them per member. That is the dispute-ending property the product brief promises.
 */
export async function reconcileSplit(split: Split): Promise<MemberStatus[]> {
  const status = new Map<string, MemberStatus>();
  for (const m of split.members) {
    if (m.label === split.payer) continue;
    status.set(m.publicKey, {
      label: m.label,
      publicKey: m.publicKey,
      owes: parseAmount(m.owes),
      paid: 0n,
      txs: [],
    });
  }

  let page = await server
    .payments()
    .forAccount(split.payerPublicKey)
    .join('transactions')
    .order('desc')
    .limit(200)
    .call();

  for (let pageCount = 0; pageCount < 5; pageCount++) {
    for (const rec of page.records) {
      const p = rec as unknown as {
        type: string;
        from?: string;
        to?: string;
        asset_type?: string;
        asset_code?: string;
        asset_issuer?: string;
        amount?: string;
        transaction_hash: string;
        transaction?: unknown;
      };
      if (p.type !== 'payment' || p.to !== split.payerPublicKey) continue;
      const target = p.from ? status.get(p.from) : undefined;
      if (!target) continue;
      if (split.asset.code === 'XLM') {
        if (p.asset_type !== 'native') continue;
      } else if (p.asset_code !== split.asset.code || p.asset_issuer !== split.asset.issuer) {
        continue;
      }
      if ((await memoOf(p)) !== split.memo) continue;

      target.paid += parseAmount(p.amount ?? '0');
      target.txs.push(p.transaction_hash);
    }
    if (page.records.length < 200) break;
    page = await page.next();
  }

  return [...status.values()];
}

async function memoOf(record: { transaction?: unknown }): Promise<string | undefined> {
  const t = record.transaction;
  if (typeof t === 'function') {
    const tx = (await (t as () => Promise<{ memo?: string }>)()) ?? {};
    return tx.memo;
  }
  if (t && typeof t === 'object') return (t as { memo?: string }).memo;
  return undefined;
}

export async function splitReconcile(id: string): Promise<void> {
  const split = findSplit(id);
  const rows = await reconcileSplit(split);
  const cfg = split.asset;

  console.log(`Split ${split.id} · ${split.group}  (memo ${split.memo})`);
  console.log(`  total ${formatPretty(parseAmount(split.total))} ${cfg.code}, fronted by "${split.payer}"\n`);

  let outstanding = 0n;
  for (const r of rows) {
    const remaining = r.owes - r.paid;
    outstanding += remaining > 0n ? remaining : 0n;
    const mark = remaining <= 0n ? 'PAID' : 'OPEN';
    console.log(
      `  ${mark}  ${r.label.padEnd(12)} owes ${formatPretty(r.owes).padStart(14)}  paid ${formatPretty(r.paid).padStart(14)}` +
        (remaining > 0n ? `  short ${formatPretty(remaining)}` : ''),
    );
    for (const h of r.txs) console.log(`        ${explorerTx(h)}`);
  }
  console.log(
    outstanding === 0n
      ? `\nSettled in full — verified against the ledger, not a local flag.`
      : `\nOutstanding: ${formatPretty(outstanding)} ${cfg.code}`,
  );
}

// ------------------------------------------------------------------- settle

export async function splitSettle(id: string, flags: Record<string, string>): Promise<void> {
  const split = findSplit(id);
  const asset = assetFrom({ code: split.asset.code, issuer: split.asset.issuer });
  const rows = await reconcileSplit(split);
  const only = flags.member;

  // A member onboarded with sponsored reserves holds no XLM, so they cannot pay
  // their own fee. Someone else bids it for them via a fee-bump; the payment
  // itself is still signed by, and debited from, the member.
  const feeSource = flags['fee-source']
    ? await keypairFor(findWallet(flags['fee-source']))
    : undefined;

  const due = rows.filter((r) => r.owes > r.paid && (!only || r.label === only));
  if (only && !rows.some((r) => r.label === only)) {
    throw new Error(`"${only}" is not a debtor on split ${split.id}.`);
  }
  if (due.length === 0) return void console.log(`Nothing outstanding on split ${split.id}.`);

  const payerSnap = await snapshot(split.payerPublicKey);
  if (!hasTrustline(payerSnap, asset)) {
    throw new Error(`Payer "${split.payer}" has no ${split.asset.code} trustline — they cannot receive.`);
  }

  for (const r of due) {
    const remaining = r.owes - r.paid;
    const label = r.label;
    try {
      const wallet = findWallet(label);
      const snap = await snapshot(wallet.publicKey);
      if (!snap.exists) throw new Error(`account not funded (run \`wallet fund ${label}\`)`);
      if (!hasTrustline(snap, asset)) throw new Error(`no ${split.asset.code} trustline (run \`wallet trust ${label}\`)`);
      const held = parseAmount(balanceOf(snap, asset) ?? '0');
      if (held < remaining) {
        throw new Error(
          `holds ${formatPretty(held)} but owes ${formatPretty(remaining)} ${split.asset.code}`,
        );
      }

      const kp = await keypairFor(wallet);
      const hash = await submit(
        kp,
        [
          Operation.payment({
            destination: split.payerPublicKey,
            asset: asset as Asset,
            amount: formatAmount(remaining),
          }),
        ],
        split.memo,
        feeSource ? { feeSource } : {},
      );
      console.log(`  ${label} → ${split.payer}  ${formatPretty(remaining)} ${split.asset.code}`);
      console.log(`    ${explorerTx(hash)}`);
    } catch (err) {
      console.log(`  ${label}: SKIPPED — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  await splitReconcile(split.id);
}
