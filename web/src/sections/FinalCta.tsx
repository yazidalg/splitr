import { Bezel } from '../components/Bezel.tsx';
import { Cta } from '../components/Cta.tsx';
import { ArrowRight } from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { Section } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

export function FinalCta() {
  const { t } = useLang();

  return (
    <Section className="pb-12 md:pb-20">
      <Reveal>
        <Bezel innerClassName="px-6 py-16 text-center sm:px-12 md:py-24">
          <h2 className="mx-auto max-w-2xl font-display text-[clamp(1.9rem,4.6vw,3rem)] leading-[1.05] tracking-[-0.035em] text-balance">
            {t.finalCta.title}
          </h2>

          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {t.finalCta.sub}
          </p>

          <div className="mt-9 flex justify-center">
            {/* Still the calculator, not the wallet. The hero and nav now ask
                for a wallet; this one closes the page by inviting a try, and
                the demo needs nothing installed to answer. */}
            <Cta href="#demo" icon={<ArrowRight />}>
              {t.hero.primary}
            </Cta>
          </div>
        </Bezel>
      </Reveal>
    </Section>
  );
}
