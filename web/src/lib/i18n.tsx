import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { COPY, type Copy, type Lang } from './copy.ts';

export const LANG_KEY = 'splitr-lang';

type LanguageValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  /** The whole dictionary for the active language. */
  t: Copy;
};

const LanguageContext = createContext<LanguageValue | null>(null);

/** Stored choice wins; otherwise follow the browser. An Indonesian visitor
 *  should land on Indonesian without touching anything. */
function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'id') return stored;
  } catch {
    // Blocked storage: fall through to the browser preference.
  }
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = COPY[lang].meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', COPY[lang].meta.description);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Choice still applies for this visit.
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: COPY[lang] }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be called inside LanguageProvider');
  return ctx;
}
