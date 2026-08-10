import type { ReactNode } from 'react';
import { ArrowUpRight } from './Icons.tsx';

type CtaProps = {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'ghost';
  icon?: ReactNode;
  className?: string;
};

/**
 * Island button. The trailing arrow lives in its own circle, flush with the
 * pill's inner padding, and picks up a little kinetic tension on hover. No
 * outer glow: a neon halo under a button is decoration, not affordance.
 */
export function Cta({
  children,
  href,
  variant = 'primary',
  icon = <ArrowUpRight size={16} />,
  className = '',
}: CtaProps) {
  const primary = variant === 'primary';

  return (
    <a
      href={href}
      className={[
        'group inline-flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-6',
        'text-sm font-medium transition-all duration-500 ease-fluid active:scale-[0.98]',
        primary
          ? 'bg-primary text-primary-foreground hover:brightness-110'
          : 'bg-foreground/[0.03] text-foreground ring-1 ring-border hover:bg-foreground/[0.07]',
        className,
      ].join(' ')}
    >
      <span>{children}</span>
      <span
        className={[
          'grid size-9 place-items-center rounded-full transition-transform duration-500 ease-fluid',
          'group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105',
          primary
            ? 'bg-primary-foreground/15 text-primary-foreground'
            : 'bg-foreground/[0.06] text-foreground',
        ].join(' ')}
      >
        {icon}
      </span>
    </a>
  );
}
