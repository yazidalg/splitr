import { Calculator, ChatCircleDots, ImageIcon, UserFocus } from '../components/Icons.tsx';
import { Reveal } from '../components/Reveal.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

const ICONS = [Calculator, ChatCircleDots, ImageIcon, UserFocus];

export function Problem() {
  const { t } = useLang();

  return (
    <Section>
      <SectionHead title={t.problem.title} lede={t.problem.lede} />

      <Reveal delay={80}>
        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 md:mt-16 md:gap-y-14">
          {t.problem.items.map((p, i) => {
            const Icon = ICONS[i];
            return (
              <div key={p.title} className="max-w-sm">
                <Icon className="text-primary" size={22} />
                <h3 className="mt-5 font-display text-lg tracking-[-0.02em]">{p.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground text-pretty">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}
