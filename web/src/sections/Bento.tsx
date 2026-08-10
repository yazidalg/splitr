import arisan from '../../img/opt/arisan.webp';
import { Bezel } from '../components/Bezel.tsx';
import {
  Check,
  CurrencyCircleDollar,
  ListChecks,
  Scales,
  ShieldCheck,
} from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

const CARD_ICONS = [Scales, ListChecks];
const CARD_SPANS = ['md:col-span-5', 'md:col-span-7'];

export function Bento() {
  const { t } = useLang();

  return (
    <Section>
      <SectionHead title={t.bento.title} lede={t.bento.lede} />

      <div className="mt-14 grid gap-4 md:mt-16 md:grid-cols-12">
        {/* Shown whole at its native ratio. The illustration is already drawn
            in the brand palette, so it needs no colour correction to sit here. */}
        <Reveal className="md:col-span-7">
          <figure className="flex h-full flex-col overflow-hidden rounded-[calc(var(--radius)*2)] border border-border bg-muted">
            <img
              src={arisan}
              alt={t.bento.alt}
              width={1400}
              height={781}
              loading="lazy"
              className="w-full"
            />
            <figcaption className="px-5 py-4 text-[13px] leading-relaxed text-muted-foreground text-pretty">
              {t.bento.caption}
            </figcaption>
          </figure>
        </Reveal>

        {/* The one tinted cell: a real number doing real work. */}
        <Reveal delay={70} className="md:col-span-5">
          <Bezel
            className="h-full"
            innerClassName="flex h-full flex-col justify-center bg-secondary p-6 md:p-8"
          >
            <CurrencyCircleDollar className="text-secondary-foreground" size={22} />

            <div className="mt-6">
              <p className="tnum font-display text-6xl leading-none tracking-[-0.04em] text-secondary-foreground">
                7
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-secondary-foreground/80 text-pretty">
                {t.bento.sevenBody}
              </p>
            </div>

            {/* The claim, worked out. Cheaper than asking anyone to take it on
                trust, and it gives the cell something to hold. */}
            <div className="mt-8 border-t border-secondary-foreground/15 pt-5">
              <p className="font-mono text-[10px] tracking-[0.12em] text-secondary-foreground/60 uppercase">
                {t.bento.sevenCaption}
              </p>
              <ul className="mt-3 space-y-1">
                {['33333.3333334', '33333.3333333', '33333.3333333'].map((n, i) => (
                  <li
                    key={i}
                    className="tnum text-[13px] text-secondary-foreground/90 tabular-nums"
                  >
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-2 border-t border-secondary-foreground/15 pt-3 text-[12.5px] text-secondary-foreground">
                <Check size={14} />
                {t.bento.sevenSum}
              </p>
            </div>
          </Bezel>
        </Reveal>

        {t.bento.cards.map((c, i) => {
          const Icon = CARD_ICONS[i];
          return (
            <Reveal key={c.title} delay={120 + i * 60} className={CARD_SPANS[i]}>
              <Bezel interactive className="h-full" innerClassName="flex h-full flex-col p-6">
                <Icon className="text-primary" size={22} />
                <h3 className="mt-8 font-display text-base tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                  {c.body}
                </p>
              </Bezel>
            </Reveal>
          );
        })}

        <Reveal delay={240} className="md:col-span-12">
          <Bezel
            interactive
            innerClassName="flex flex-col gap-4 p-6 md:flex-row md:items-center md:gap-10 md:p-8"
          >
            <ShieldCheck className="shrink-0 text-primary" size={22} />
            <h3 className="font-display text-lg tracking-[-0.02em] md:w-72 md:shrink-0">
              {t.bento.verifyTitle}
            </h3>
            <p className="max-w-xl text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
              {t.bento.verifyBody}
            </p>
          </Bezel>
        </Reveal>
      </div>
    </Section>
  );
}
