import { useState } from 'react';
import { Minus, Plus } from '../components/Icons.tsx';
import { Section, SectionHead } from '../components/Section.tsx';
import { useLang } from '../lib/i18n.tsx';

export function Faq() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <SectionHead title={t.faq.title} />

      <div className="mt-12 border-t border-border">
        {t.faq.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="border-b border-border">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span className="font-display text-[17px] tracking-[-0.02em]">{item.q}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
              </h3>
              <div
                className="grid transition-[grid-template-rows,opacity] duration-500 ease-fluid"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
              >
                <div className="overflow-hidden">
                  <p className="max-w-2xl pb-7 text-[14.5px] leading-relaxed text-muted-foreground text-pretty">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
