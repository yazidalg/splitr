import { Reveal } from '../components/Reveal.tsx';
import { Section } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

export function UnderTheHood() {
  const { t } = useLang();

  return (
    <Section id="proof">
      <div className="grid gap-12 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-16">
        <Reveal>
          <div className="md:sticky md:top-32">
            <h2 className="font-display text-[clamp(1.9rem,4.2vw,3rem)] leading-[1.05] tracking-[-0.03em] text-balance">
              {t.proof.title}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {t.proof.lede}
            </p>
          </div>
        </Reveal>

        <div className="space-y-12 md:space-y-14">
          {t.proof.facts.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div>
                <h3 className="font-display text-xl tracking-[-0.025em]">{f.title}</h3>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground text-pretty">
                  {/* Ledger values inside the sentence render as mono so they
                      read as quoted data, not prose. */}
                  {f.body.map((seg, j) =>
                    typeof seg === 'string' ? (
                      <span key={j}>{seg}</span>
                    ) : (
                      <span key={j} className="tnum text-foreground">
                        {seg.n}
                      </span>
                    ),
                  )}
                </p>
                <code className="mt-5 inline-block rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-[11.5px] text-primary">
                  {f.code}
                </code>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
