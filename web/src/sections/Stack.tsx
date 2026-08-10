import { Reveal } from '../components/Reveal.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

/**
 * The protocol stack, drawn as a stack rather than set as a table.
 *
 * A five-row table with a hairline under every row is the laziest way to show
 * this, and it hides the one thing worth seeing: how much of it is actually
 * running. A layer that is live gets a filled card, a solid rail and a solid
 * border; a layer that is not gets a dashed outline and no fill. You can count
 * what is built from across the room.
 */
export function Stack() {
  const { t } = useLang();

  return (
    <Section id="stack">
      <SectionHead title={t.stack.title} lede={t.stack.lede} />

      <ol className="mt-14 space-y-2.5 md:mt-16">
        {t.stack.layers.map((l, i) => (
          <li key={l.layer}>
            <Reveal delay={i * 60}>
              <div
                className={[
                  'grid gap-x-8 gap-y-3 rounded-2xl border p-5 md:p-6',
                  'md:grid-cols-[minmax(0,13rem)_minmax(0,15rem)_1fr_auto] md:items-center',
                  l.live ? 'border-border bg-card' : 'border-dashed border-border',
                ].join(' ')}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className={`h-7 w-1 shrink-0 rounded-full ${l.live ? 'bg-primary' : 'bg-border'}`}
                  />
                  <span className="font-display text-[15px] tracking-[-0.01em]">{l.layer}</span>
                </div>

                <code className="font-mono text-[12.5px] text-primary">{l.protocol}</code>

                <p className="text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                  {l.role}
                </p>

                <span
                  className={[
                    'justify-self-start rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap md:justify-self-end',
                    l.live ? 'bg-primary/10 text-primary' : 'bg-foreground/[0.05] text-faint',
                  ].join(' ')}
                >
                  {l.live ? t.stack.live : t.stack.planned}
                </span>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
