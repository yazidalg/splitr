import { Cta } from '../components/Cta.tsx';
import { ArrowRight } from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { useLang } from '../lib/i18n.tsx';
import { useWalletCta } from '../lib/useWalletCta.ts';
import { SplitDemo } from './SplitDemo.tsx';

/**
 * Four elements only: headline, subtext, two CTAs, and the working demo.
 * No eyebrow, no tagline under the buttons, no stat strip.
 */
export function Hero() {
  const { lang, t } = useLang();
  const cta = useWalletCta();

  // The <br> fixes two lines, so each half has to fit its column on one line at
  // every desktop width. Indonesian runs longer for the same sentence, so it
  // gets a lower ceiling rather than a third line.
  const headline =
    lang === 'id' ? 'text-[clamp(2rem,3.2vw,2.9rem)]' : 'text-[clamp(2.4rem,4vw,3.6rem)]';

  return (
    <section
      id="top"
      className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-20 sm:px-8 md:pt-32 lg:pb-28"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <Reveal>
            <h1
              className={`font-display leading-[1.02] tracking-[-0.035em] text-balance ${headline}`}
            >
              {t.hero.line1}
              <br />
              <span className="text-muted-foreground">{t.hero.line2}</span>
            </h1>
          </Reveal>

          <Reveal delay={90}>
            <p className="mt-7 max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
              {t.hero.sub}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Cta icon={<ArrowRight />} onClick={cta.onClick} disabled={cta.busy} title={cta.title}>
                {cta.label}
              </Cta>
              <Cta href="#how" variant="ghost">
                {t.hero.secondary}
              </Cta>
            </div>
          </Reveal>
        </div>

        <div id="demo" className="scroll-mt-28">
          <Reveal delay={150}>
            <SplitDemo />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
