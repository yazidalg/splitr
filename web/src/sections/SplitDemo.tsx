import { useMemo, useState } from 'react';
import { Bezel } from '../components/Bezel.tsx';
import { Check, Minus, Plus } from '../components/Icons.tsx';
import { useLang } from '../lib/i18n.tsx';
import { computeSplit, groupDigits, makeSplitId, type Participant } from '../lib/split.ts';

const NAMES = ['Rani', 'Dimas', 'Sari', 'Bagas', 'Nadia', 'Yoga', 'Putri', 'Arif'];
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 8;

const STEP_BUTTON =
  'grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-25';

export function SplitDemo() {
  const { lang, t } = useLang();

  // Digits only in state, formatted on render. Switching language reformats
  // the field instead of leaving English separators behind.
  const [digits, setDigits] = useState('300000');
  const [count, setCount] = useState(3);
  const [mode, setMode] = useState<'equal' | 'weighted'>('equal');
  const [weights, setWeights] = useState<number[]>(() => [2, 1, 1, 1, 1, 1, 1, 1]);
  const [payer, setPayer] = useState(0);
  const [id] = useState(makeSplitId);

  const participants: Participant[] = useMemo(
    () =>
      NAMES.slice(0, count).map((name, i) => ({
        name,
        weight: mode === 'equal' ? 1 : weights[i],
      })),
    [count, mode, weights],
  );

  const result = useMemo(
    () => computeSplit(digits, participants, lang),
    [digits, participants, lang],
  );

  const setWeight = (i: number, delta: number) =>
    setWeights((w) => w.map((v, j) => (j === i ? Math.min(9, Math.max(1, v + delta)) : v)));

  const setCountClamped = (next: number) => {
    const c = Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, next));
    setCount(c);
    if (payer >= c) setPayer(0);
  };

  return (
    <Bezel className="w-full" innerClassName="overflow-hidden">
      <div className="border-b border-border px-5 py-6 sm:px-6">
        <label htmlFor="demo-total" className="text-[13px] text-muted-foreground">
          {t.demo.total}
        </label>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="font-display text-2xl text-faint">Rp</span>
          <input
            id="demo-total"
            type="text"
            inputMode="numeric"
            value={groupDigits(digits, lang)}
            onChange={(e) => setDigits(e.target.value.replace(/[^\d]/g, ''))}
            className="tnum w-full min-w-0 bg-transparent text-[clamp(2rem,7vw,2.75rem)] leading-none font-medium tracking-[-0.03em] outline-none placeholder:text-faint"
            placeholder="0"
            aria-describedby="demo-currency"
          />
          <span
            id="demo-currency"
            className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
          >
            IDRX
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-1 rounded-full border border-border bg-foreground/[0.02] p-1">
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={() => setCountClamped(count - 1)}
            disabled={count <= MIN_PEOPLE}
            aria-label={t.demo.fewer}
          >
            <Minus size={14} />
          </button>
          <span className="tnum min-w-16 text-center text-[13px]">
            {count} {t.demo.people}
          </span>
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={() => setCountClamped(count + 1)}
            disabled={count >= MAX_PEOPLE}
            aria-label={t.demo.more}
          >
            <Plus size={14} />
          </button>
        </div>

        <div
          className="flex items-center gap-1 rounded-full border border-border bg-foreground/[0.02] p-1"
          role="group"
          aria-label={t.demo.splitType}
        >
          {(['equal', 'weighted'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={[
                'rounded-full px-3.5 py-1.5 text-[12px] capitalize transition-all duration-400 ease-fluid',
                // A segmented control is not a call to action. Solid primary
                // here would out-shout the CTA sitting next to it.
                mode === m
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.demo[m]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="border-b border-border px-5 py-2.5 text-[12px] text-faint sm:px-6">
          {t.demo.tapHint}
        </p>

        {result.ok ? (
          result.shares.map((s, i) => {
            const isPayer = i === payer;
            return (
              <div
                key={s.name}
                className={[
                  'flex items-center gap-3 px-5 py-3.5 transition-colors duration-300 sm:px-6',
                  i < result.shares.length - 1 ? 'border-b border-border' : '',
                  isPayer ? 'bg-primary/[0.05]' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => setPayer(i)}
                  aria-pressed={isPayer}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={[
                      'grid size-8 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors duration-400',
                      isPayer
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                        : 'bg-foreground/[0.05] text-muted-foreground',
                    ].join(' ')}
                  >
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px]">{s.name}</span>
                    <span className="block text-[11px] text-faint">
                      {isPayer ? t.demo.fronted : t.demo.owes}
                    </span>
                  </span>
                </button>

                {/* Fixed-width slots for the last two columns. Without them the
                    amount's own width (150,000 against 75,000) shoves the
                    stepper sideways and the rows stop lining up. */}
                {mode === 'weighted' ? (
                  <div className="flex w-24 shrink-0 items-center justify-center gap-1 rounded-full border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setWeight(i, -1)}
                      disabled={weights[i] <= 1}
                      aria-label={t.demo.decrease(s.name)}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="tnum w-6 text-center text-[11px] text-muted-foreground">
                      {weights[i]}x
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeight(i, 1)}
                      disabled={weights[i] >= 9}
                      aria-label={t.demo.increase(s.name)}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ) : null}

                <span className="w-[5.5rem] shrink-0 text-right sm:w-24">
                  <span key={s.exact} className="value-in tnum block text-[15px]">
                    {s.display}
                  </span>
                  {/* Only when the split does not land on a whole unit. That is
                      the case worth proving; repeating it otherwise is noise. */}
                  {s.exact.includes('.') ? (
                    <span className="block font-mono text-[10px] text-faint">{s.exact}</span>
                  ) : null}
                </span>
              </div>
            );
          })
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground sm:px-6">
            {t.demo[result.error]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-foreground/[0.015] px-5 py-3.5 sm:px-6">
        <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Check size={14} className="text-primary" />
          {result.ok && result.sumsExactly ? t.demo.sumsExact : t.demo.sumsAlways}
        </span>
        <span className="tnum text-[11px] text-faint">splitr:{id}</span>
      </div>
    </Bezel>
  );
}
