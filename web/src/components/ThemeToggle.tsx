import { Moon, Sun } from './Icons.tsx';
import { useLang } from '../lib/i18n.tsx';
import { useTheme } from '../lib/useTheme.ts';

/** Crossfades the two glyphs in place so the button never jumps. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useLang();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t.a11y.toLight : t.a11y.toDark}
      className={[
        'relative grid size-9 shrink-0 place-items-center rounded-full',
        'text-muted-foreground transition-colors duration-300 hover:bg-foreground/[0.06] hover:text-foreground',
        className,
      ].join(' ')}
    >
      <Sun
        size={17}
        className={[
          'absolute transition-all duration-500 ease-fluid',
          dark ? 'scale-75 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        ].join(' ')}
      />
      <Moon
        size={17}
        className={[
          'absolute transition-all duration-500 ease-fluid',
          dark ? 'scale-100 rotate-0 opacity-100' : 'scale-75 -rotate-90 opacity-0',
        ].join(' ')}
      />
    </button>
  );
}
