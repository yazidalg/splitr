import type { CSSProperties, ReactNode } from 'react';
import { useReveal } from '../lib/useReveal.ts';

type RevealProps = {
  children: ReactNode;
  /** Stagger, in ms. Lists should cascade rather than mount all at once. */
  delay?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={`reveal ${className}`}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
