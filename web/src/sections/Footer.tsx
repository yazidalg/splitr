import { Mark } from '../components/Icons.tsx';
import { useLang } from '../lib/i18n.tsx';
import { useRoute } from '../lib/useRoute.ts';

export function Footer() {
  const { t } = useLang();
  const prefix = useRoute() === 'app' ? '/' : '';

  const links = [
    // Scroll anchors only exist on the landing page. From /app they pointed at
    // nothing, so send people back to the page that has them.
    { href: prefix + '#how', label: t.nav.how },
    { href: prefix + '#proof', label: t.nav.proof },
    { href: prefix + '#faq', label: t.nav.faq },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Mark className="size-5 text-primary" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">splitr</span>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground text-pretty">
            {t.footer.blurb}
          </p>
          <p className="mt-5 text-[12px] leading-relaxed text-faint text-pretty">
            {t.footer.testnet}
          </p>
        </div>

        <nav>
          <ul className="space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[13px] text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{t.footer.rights}</span>
          <span>{t.footer.built}</span>
        </div>
      </div>
    </footer>
  );
}
