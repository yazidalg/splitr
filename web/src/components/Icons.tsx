/**
 * Icons come from Phosphor at one weight, set once in App.tsx via IconContext.
 * Nothing here draws paths by hand except the wordmark, which is brand, not UI.
 */
import { useId } from 'react';

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

/**
 * The wordmark: a disc cut into three equal shares around an open hub.
 *
 * Redrawn from `web/img/logo/logo.png` rather than imported. The mark is pure
 * geometry, so a raster costs 3.5 MB and a fixed teal; as a path it costs ~400
 * bytes, takes its colour from `currentColor` (so it stays on the `--primary`
 * token in both themes), and the gaps read as the page ground instead of the
 * source file's baked-in white.
 *
 * The gaps are cut with a mask, not drawn as angular wedge insets: the source
 * mark's spokes are parallel-sided, and an angular gap fans out towards the rim.
 * `useId` keeps the mask reference unique — Nav and Footer both render this.
 */
export function Mark({ className = 'size-5' }: { className?: string }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <mask id={mask}>
        <rect width="32" height="32" fill="#fff" />
        {/* Spokes run past r=13 so the cut always clears the rim. */}
        <path
          d="M16 16V1M16 16L3 23.5M16 16L29 23.5"
          stroke="#000"
          strokeWidth="1.7"
          fill="none"
        />
        <circle cx="16" cy="16" r="2.6" fill="#000" />
      </mask>
      <circle cx="16" cy="16" r="13" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}
