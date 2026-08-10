import type { Lang } from '../lib/copy.ts';
import { useLang } from '../lib/i18n.tsx';

const OPTIONS: { code: Lang; label: string; full: string }[] = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'id', label: 'ID', full: 'Bahasa Indonesia' },
];

/**
 * Two segments rather than one button showing the other language. A lone "ID"
 * is ambiguous: it reads equally well as the current state or the target.
 */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang();

  return (
    <div
      role="group"
      aria-label={t.a11y.language}
      className={`flex shrink-0 items-center rounded-full border border-border p-0.5 ${className}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          aria-pressed={lang === o.code}
          aria-label={o.full}
          onClick={() => setLang(o.code)}
          className={[
            'rounded-full px-2 py-1 font-mono text-[10px] transition-colors duration-300',
            lang === o.code
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
