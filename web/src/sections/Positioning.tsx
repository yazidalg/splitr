import { Reveal } from '../components/Reveal.tsx';
import { useLang } from '../lib/i18n.tsx';

/** Full-bleed typographic band. The one moment on the page where the argument
 *  gets the whole width to itself. */
export function Positioning() {
  const { t } = useLang();

  return (
    <section className="border-y border-border bg-card/70">
      <div className="mx-auto w-full max-w-5xl px-5 py-24 sm:px-8 md:py-36">
        <Reveal>
          <blockquote className="font-display text-[clamp(1.7rem,4.2vw,2.9rem)] leading-[1.14] tracking-[-0.03em] text-balance">
            {t.positioning.q1}
            <span className="text-muted-foreground">{t.positioning.q2}</span>
            <br className="hidden sm:block" /> {t.positioning.q3}
            <span className="text-muted-foreground">{t.positioning.q4}</span>
          </blockquote>

          <p className="mt-10 max-w-xl text-[14px] leading-relaxed text-muted-foreground text-pretty">
            {t.positioning.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
