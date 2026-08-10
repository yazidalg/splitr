/**
 * The app half of Splitr: real bills, on the deployed contract, signed by the
 * visitor's own wallet.
 *
 * This whole module is loaded lazily. It pulls in `@stellar/stellar-sdk`,
 * which is larger than the landing page it sits beside, and someone who came
 * to read the marketing copy should never download it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../lib/i18n.tsx';
import { shortAddress, useWallet } from '../lib/wallet.tsx';
import { formatPretty, parseAmount } from '../lib/split.ts';
import {
  ASSET_CODE,
  CONTRACT_ID,
  SAC_ID,
  describeError,
  makeClient,
  outstandingOf,
  readEvents,
  shareOf,
  unwrap,
  type Bill,
  type BillEvent,
  type SplitrClient,
} from '../lib/contract.ts';

export default function DApp() {
  const { t } = useLang();
  const { address, connect, connecting, signTransaction } = useWallet();
  const [client, setClient] = useState<SplitrClient | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<BillEvent[]>([]);

  // One client per connected account: the signer is baked in, so reusing one
  // built for a previous address asks the wrong wallet to sign.
  useEffect(() => {
    let cancelled = false;
    makeClient(address ?? undefined, address ? signTransaction : undefined)
      .then((c) => !cancelled && setClient(c))
      .catch((err) => !cancelled && setError(describeError(err)));
    return () => {
      cancelled = true;
    };
  }, [address, signTransaction]);

  const refresh = useCallback(async () => {
    if (!client || !address) return;
    try {
      const ids = (await client.bills_for({ member: address })).result;
      const loaded = await Promise.all(
        ids.map(async (id) => {
          try {
            return unwrap((await client.bill({ id })).result);
          } catch {
            // A bill whose storage TTL lapsed is gone, not a reason to fail
            // the whole list.
            return null;
          }
        }),
      );
      setBills(loaded.filter((b): b is Bill => b !== null));
    } catch (err) {
      setError(describeError(err));
    }
  }, [client, address]);

  useEffect(() => {
    if (!address) {
      setBills(null);
      return;
    }
    void refresh();
  }, [address, refresh]);

  // Live feed. Polling, because Soroban RPC offers no subscription. Anything
  // that lands — including someone else settling your bill — refreshes the
  // list, which is the point of watching at all.
  const cursor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const page = await readEvents(client, { cursor: cursor.current });
        if (stopped) return;
        if (page.cursor) cursor.current = page.cursor;
        if (page.events.length) {
          setEvents((prev) => [...page.events.reverse(), ...prev].slice(0, 12));
          void refresh();
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one carries on from
        // the same cursor, so nothing is lost.
      }
      if (!stopped) timer = setTimeout(tick, 5_000);
    };

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [client, refresh]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-28 pb-24 sm:px-8">
      <header className="mb-10">
        <h1 className="font-display text-[clamp(1.9rem,4.2vw,2.6rem)] leading-[1.05] tracking-[-0.03em]">
          {t.app.title}
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          {t.app.lede}
        </p>
        <p className="mt-3 font-mono text-[11px] break-all text-faint">
          {CONTRACT_ID}
        </p>
      </header>

      {!address ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-[15px] text-muted-foreground">{t.app.connectFirst}</p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={connecting}
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {connecting ? t.wallet.connecting : t.wallet.connect}
          </button>
          <p className="mt-4 text-[12px] text-faint">{t.wallet.custody}</p>
        </div>
      ) : (
        <>
          <NewBill address={address} client={client} busy={busy} run={run} />

          <section className="mt-12">
            <h2 className="font-display text-lg tracking-[-0.02em]">{t.app.yourBills}</h2>
            {bills === null ? (
              <p className="mt-4 text-[14px] text-faint">{t.app.loading}</p>
            ) : bills.length === 0 ? (
              <p className="mt-4 text-[14px] text-muted-foreground">{t.app.noBills}</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {bills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    me={address}
                    client={client}
                    busy={busy}
                    run={run}
                  />
                ))}
              </ul>
            )}
          </section>

          <EventFeed events={events} />
        </>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}

// ------------------------------------------------------------------ new bill

function NewBill({
  address,
  client,
  busy,
  run,
}: {
  address: string;
  client: SplitrClient | null;
  busy: string | null;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useLang();
  const [group, setGroup] = useState('');
  const [amount, setAmount] = useState('');
  const [others, setOthers] = useState('');

  const members = useMemo(
    () => others.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    [others],
  );

  const submit = () =>
    void run('create', async () => {
      if (!client) throw new Error('Still connecting.');
      // The payer is always on their own bill, and the contract insists on it.
      const all = [address, ...members.filter((m) => m !== address)];
      const tx = await client.create_bill({
        payer: address,
        group: group.trim() || 'Bill',
        asset: SAC_ID,
        total: parseAmount(amount.replace(/[^\d.]/g, '')),
        members: all,
        weights: all.map(() => 1),
      });
      unwrap((await tx.signAndSend()).result);
      setGroup('');
      setAmount('');
      setOthers('');
    });

  const ready = amount.trim() !== '' && members.length > 0 && client !== null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg tracking-[-0.02em]">{t.app.newBill}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t.app.group}>
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Nasi Padang"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-ring"
          />
        </Field>
        <Field label={`${t.app.total} (${ASSET_CODE})`}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="300000"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-[14px] outline-none focus:border-ring"
          />
        </Field>
      </div>
      <Field label={t.app.members} className="mt-4">
        <textarea
          value={others}
          onChange={(e) => setOthers(e.target.value)}
          rows={2}
          placeholder="G… , G…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-[12px] outline-none focus:border-ring"
        />
        <p className="mt-2 text-[12px] text-faint">{t.app.membersHint}</p>
      </Field>
      <button
        type="button"
        onClick={submit}
        disabled={!ready || busy !== null}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy === 'create' ? t.app.signing : t.app.createBill}
      </button>
    </section>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[12px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// ----------------------------------------------------------------- bill card

function BillCard({
  bill,
  me,
  client,
  busy,
  run,
}: {
  bill: Bill;
  me: string;
  client: SplitrClient | null;
  busy: string | null;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useLang();
  const [part, setPart] = useState('');
  const mine = shareOf(bill, me);
  const remaining = mine ? mine.owes - mine.paid : 0n;
  const isPayer = bill.payer === me;
  const outstanding = outstandingOf(bill);

  const settle = (amount?: bigint) =>
    void run(`settle-${bill.id}`, async () => {
      if (!client) throw new Error('Still connecting.');
      const tx = amount
        ? await client.settle_part({ id: bill.id, member: me, amount })
        : await client.settle({ id: bill.id, member: me });
      unwrap((await tx.signAndSend()).result);
      setPart('');
    });

  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] tracking-[-0.01em]">
          #{bill.id} · {bill.group}
        </h3>
        <span className="font-mono text-[13px]">
          {formatPretty(bill.total)} {ASSET_CODE}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {bill.shares.map((s, i) => {
          const left = s.owes - s.paid;
          const settled = left <= 0n;
          return (
            <li
              key={`${s.member}-${i}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]"
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${settled ? 'bg-primary' : 'bg-border'}`}
              />
              <span className="font-mono text-faint">{shortAddress(s.member)}</span>
              {s.member === me ? <span className="text-primary">{t.app.you}</span> : null}
              <span className="ml-auto font-mono text-muted-foreground">
                {formatPretty(s.paid)} / {formatPretty(s.owes)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[12.5px] text-muted-foreground">
        {outstanding === 0n
          ? t.app.settledInFull
          : `${t.app.outstanding} ${formatPretty(outstanding)} ${ASSET_CODE}`}
      </p>

      {!isPayer && remaining > 0n ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => settle()}
            disabled={busy !== null}
            className="rounded-full bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === `settle-${bill.id}`
              ? t.app.signing
              : `${t.app.payShare} ${formatPretty(remaining)}`}
          </button>
          <input
            value={part}
            onChange={(e) => setPart(e.target.value)}
            inputMode="decimal"
            placeholder={t.app.partAmount}
            className="w-28 rounded-full border border-border bg-background px-3 py-2 font-mono text-[12.5px] outline-none focus:border-ring"
          />
          <button
            type="button"
            onClick={() => settle(parseAmount(part.replace(/[^\d.]/g, '') || '0'))}
            disabled={busy !== null || part.trim() === ''}
            className="rounded-full border border-border px-4 py-2 text-[12.5px] disabled:opacity-40"
          >
            {t.app.payPart}
          </button>
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------- event feed

function EventFeed({ events }: { events: BillEvent[] }) {
  const { t } = useLang();
  if (events.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-lg tracking-[-0.02em]">{t.app.liveFeed}</h2>
      <p className="mt-2 text-[12.5px] text-faint">{t.app.liveFeedNote}</p>
      <ul className="mt-4 space-y-1.5">
        {events.map((e) => (
          <li key={`${e.txHash}-${e.name}-${e.id}`} className="font-mono text-[12px] text-muted-foreground">
            <span className="text-faint">{e.at.slice(11, 19)}</span>{' '}
            {e.name === 'Created' ? t.app.evCreated : t.app.evSettled} #{e.id}{' '}
            {typeof e.data.total === 'bigint'
              ? formatPretty(e.data.total)
              : typeof e.data.amount === 'bigint'
                ? formatPretty(e.data.amount)
                : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
