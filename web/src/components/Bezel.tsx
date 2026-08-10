import type { ReactNode } from 'react';

type BezelProps = {
  children: ReactNode;
  /** Extra classes on the outer shell (grid spans, sizing). */
  className?: string;
  /** Extra classes on the inner core (padding, layout). */
  innerClassName?: string;
  /** Lift on hover. Off for static display panels. */
  interactive?: boolean;
};

/**
 * The double-bezel: a glass plate sitting in a machined tray. An outer shell
 * with a hairline ring, and an inner core with its own top highlight and a
 * concentric (2rem − 0.375rem) radius.
 */
export function Bezel({
  children,
  className = '',
  innerClassName = '',
  interactive = false,
}: BezelProps) {
  return (
    <div
      className={[
        'rounded-[calc(var(--radius)*2)] bg-foreground/[0.03] p-1.5 ring-1 ring-border/60',
        'transition-[background-color,box-shadow] duration-500 ease-fluid',
        interactive ? 'hover:bg-foreground/[0.055] hover:ring-border' : '',
        className,
      ].join(' ')}
    >
      <div
        className={[
          // Concentric with the shell: the same radius less the 0.375rem inset.
          'bezel-core h-full rounded-[calc(var(--radius)*2_-_0.375rem)] bg-card',
          innerClassName,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
