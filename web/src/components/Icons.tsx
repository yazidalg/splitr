/**
 * Icons come from Phosphor at one weight, set once in App.tsx via IconContext.
 * Nothing here draws paths by hand except the wordmark, which is brand, not UI.
 */
export {
  ArrowRight,
  ArrowUpRight,
  CaretLeft,
  CaretRight,
  Calculator,
  ChatCircleDots,
  Check,
  ClockCountdown,
  CurrencyCircleDollar,
  Image as ImageIcon,
  List,
  ListChecks,
  Minus,
  Moon,
  Plus,
  Receipt,
  Scales,
  SealCheck,
  ShieldCheck,
  Sun,
  UserFocus,
  UsersThree,
  X,
} from '@phosphor-icons/react';

/** The wordmark: a ledger line splitting a circle. One simple geometric mark. */
export function Mark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 3.5v17" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M4.2 9.25h15.6M4.2 14.75h15.6"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.4"
      />
    </svg>
  );
}
