import { useCallback, useLayoutEffect, useState } from 'react';
import addTheGroup from '../../img/opt/add_the_group.webp';
import seeTheSplit from '../../img/opt/see_the_split.webp';
import settleAndProve from '../../img/opt/settle_and_prove.webp';
import { CaretLeft, CaretRight } from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

const ART = [addTheGroup, seeTheSplit, settleAndProve];

/** Drift, as a share of the slide's own size, so it scales with the viewport. */
const DRIFT_X = 3;
const DRIFT_Y = 9;

type Role = 'active' | 'incoming' | 'outgoing';

/**
 * Going forward, a slide enters from the lower left and the one it replaces
 * leaves toward the upper right. Going back, both reverse.
 *
 * That diagonal is why this is stacked slides rather than a horizontal track.
 * A track lays its slides out left to right, so advancing can only ever move
 * them left; the direction is free but it is the wrong direction. Stacking
 * them costs one piece of bookkeeping, handled below.
 */
function transformFor(role: Role, dir: number): string {
  if (role === 'active') return 'translate3d(0, 0, 0)';
  const sign = role === 'outgoing' ? 1 : -1;
  return `translate3d(${sign * dir * DRIFT_X}%, ${-sign * dir * DRIFT_Y}%, 0)`;
}

export function HowItWorks() {
  const { t } = useLang();
  const count = t.how.steps.length;

  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  // The slide being parked at its entry point for one frame before it starts
  // moving. Without this, a slide that had been parked for the other direction
  // would animate in from the wrong corner.
  const [arming, setArming] = useState<number | null>(null);

  const go = useCallback(
    (next: number) => {
      if (arming !== null) return;
      const target = ((next % count) + count) % count;
      if (target === index) return;
      setDir(next > index ? 1 : -1);
      setArming(target);
    },
    [arming, count, index],
  );

  useLayoutEffect(() => {
    if (arming === null) return;
    // One frame parked, then release. Any sooner and the browser never sees a
    // start position to animate away from.
    const raf = requestAnimationFrame(() => {
      setOutgoing(index);
      setIndex(arming);
      setArming(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [arming, index]);

  const CARD_BASE =
    'block rounded-xl px-4 py-2.5 shadow-sm transition-[transform,opacity] duration-700 ease-fluid';

  return (
    <Section id="how">
      <SectionHead title={t.how.title} lede={t.how.lede} />

      <Reveal delay={60}>
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={t.how.title}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(index - 1);
            if (e.key === 'ArrowRight') go(index + 1);
          }}
          className="mt-12 grid overflow-hidden md:mt-16"
        >
          {t.how.steps.map((s, i) => {
            const parked = i === arming;
            const active = i === index && !parked;
            const role: Role = active
              ? 'active'
              : !parked && i === outgoing
                ? 'outgoing'
                : 'incoming';

            return (
              <div
                key={s.title}
                style={{
                  gridArea: '1 / 1',
                  transform: transformFor(role, dir),
                  opacity: active ? 1 : 0,
                }}
                aria-hidden={!active}
                inert={!active}
                className={[
                  'transition-[transform,opacity] duration-[800ms] ease-fluid',
                  parked ? 'transition-none' : '',
                  active ? '' : 'pointer-events-none',
                ].join(' ')}
              >
                <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
                  <div>
                    <h3 className="font-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.08] tracking-[-0.03em] text-balance">
                      {s.title}
                    </h3>
                    <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground text-pretty">
                      {s.body}
                    </p>
                  </div>

                  <figure className="relative">
                    <img
                      src={ART[i]}
                      alt={s.alt}
                      width={1400}
                      height={781}
                      // Eager, but at low priority. A slide stacked behind the
                      // active one never crosses the lazy-load threshold, so a
                      // lazy one would still be blank on the first click.
                      loading="eager"
                      fetchPriority="low"
                      className="w-full rounded-[calc(var(--radius)*2)] border border-border"
                    />

                    {/* The comparison, hung over the lower edge of the picture
                        and kept inside the frame so the clip never cuts it. */}
                    <figcaption className="mt-4 flex flex-col gap-2 sm:absolute sm:bottom-5 sm:left-4 sm:mt-0 lg:left-5">
                      <span
                        style={{ transitionDelay: active ? '340ms' : '0ms' }}
                        className={[
                          CARD_BASE,
                          'border border-border bg-card',
                          active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                        ].join(' ')}
                      >
                        <span className="block font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
                          {t.how.oldLabel}
                        </span>
                        <span className="mt-0.5 block font-display text-[15px] tracking-[-0.01em]">
                          {s.old}
                        </span>
                      </span>

                      <span
                        style={{ transitionDelay: active ? '440ms' : '0ms' }}
                        className={[
                          CARD_BASE,
                          'bg-primary text-primary-foreground',
                          active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                        ].join(' ')}
                      >
                        <span className="block font-mono text-[9.5px] tracking-[0.14em] uppercase opacity-75">
                          {t.how.newLabel}
                        </span>
                        <span className="mt-0.5 block font-display text-[15px] tracking-[-0.01em]">
                          {s.now}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      <div className="mt-10 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label={t.how.prev}
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 ease-fluid hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"
        >
          <CaretLeft size={16} />
        </button>

        <div className="flex items-center gap-2.5">
          {t.how.steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => go(i)}
              aria-label={s.title}
              aria-current={i === index}
              className={[
                'h-1.5 rounded-full transition-all duration-500 ease-fluid',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground',
              ].join(' ')}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label={t.how.next}
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 ease-fluid hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"
        >
          <CaretRight size={16} />
        </button>
      </div>
    </Section>
  );
}
