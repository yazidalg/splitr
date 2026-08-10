import { useCallback, useState } from 'react';
import addTheGroup from '../../img/opt/add_the_group.webp';
import seeTheSplit from '../../img/opt/see_the_split.webp';
import settleAndProve from '../../img/opt/settle_and_prove.webp';
import { CaretLeft, CaretRight } from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

const ART = [addTheGroup, seeTheSplit, settleAndProve];

/**
 * One step at a time, with the old way and the Splitr way stated side by side
 * over the illustration. The slides share a single grid cell so the section
 * keeps the height of its tallest slide and nothing jumps when you advance.
 *
 * No auto-advance. A carousel that moves on its own takes the reading pace away
 * from the reader.
 */
export function HowItWorks() {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const count = t.how.steps.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

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
          className="mt-12 grid md:mt-16"
        >
          {t.how.steps.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.title}
                style={{ gridArea: '1 / 1' }}
                aria-hidden={!active}
                inert={!active}
                className={[
                  'transition-opacity duration-500 ease-fluid',
                  active ? 'opacity-100' : 'pointer-events-none opacity-0',
                ].join(' ')}
              >
                {/* The illustrations are 16:9, so the picture column is given
                    the larger share. A narrower one leaves the row mostly air. */}
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
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="w-full rounded-[calc(var(--radius)*2)] border border-border"
                    />

                    {/* The comparison, hung over the lower edge of the picture. */}
                    <figcaption className="mt-4 flex flex-col gap-2 sm:absolute sm:bottom-5 sm:left-4 sm:mt-0 lg:-left-6">
                      <span className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
                        <span className="block font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
                          {t.how.oldLabel}
                        </span>
                        <span className="mt-0.5 block font-display text-[15px] tracking-[-0.01em]">
                          {s.old}
                        </span>
                      </span>
                      <span className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-sm">
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
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors duration-300 hover:bg-foreground/[0.06] hover:text-foreground"
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
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors duration-300 hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <CaretRight size={16} />
        </button>
      </div>
    </Section>
  );
}
