import type { ReactNode } from 'react';
import { Reveal } from './Reveal.tsx';

export function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative mx-auto w-full max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 md:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Headline plus optional lede, stacked. No eyebrow: a label above every section
 * headline is what makes a page read as templated, and the section's position
 * already says what it is.
 */
export function SectionHead({
  title,
  lede,
  className = '',
}: {
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <h2 className="max-w-3xl font-display text-[clamp(1.9rem,4.2vw,3rem)] leading-[1.05] tracking-[-0.03em] text-balance">
        {title}
      </h2>
      {lede ? (
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground text-pretty">
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
