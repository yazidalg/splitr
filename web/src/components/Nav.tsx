import { useEffect, useState } from 'react';
import { ArrowRight, List, Mark, X } from './Icons.tsx';
import { ConnectWallet } from './ConnectWallet.tsx';
import { LangToggle } from './LangToggle.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useLang } from '../lib/i18n.tsx';
import { navigate, useRoute } from '../lib/useRoute.ts';

export function Nav() {
  const { t } = useLang();
  const route = useRoute();
  const [open, setOpen] = useState(false);

  // The anchor links only mean anything on the landing page; from /app they
  // would scroll to nothing.
  // On /app the logo is already the way back, so a second link saying so is
  // just noise beside it.
  const links =
    route === 'app'
      ? []
      : [
          { href: '#how', label: t.nav.how },
          { href: '#proof', label: t.nav.proof },
          { href: '#faq', label: t.nav.faq },
          { href: '/app', label: t.nav.app },
        ];

  /** Same-origin paths route client-side; hashes stay plain anchors. */
  const onNavClick = (href: string) => (e: React.MouseEvent) => {
    setOpen(false);
    if (!href.startsWith('/')) return;
    e.preventDefault();
    navigate(href);
  };

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5 sm:pt-6">
        {/* /80 rather than /60: the light ground gives backdrop-blur far less
            to work with, and headings were reading through the pill. */}
        <nav className="flex w-full max-w-3xl items-center gap-2 rounded-full border border-border bg-background/80 py-2 pr-2 pl-4 backdrop-blur-xl sm:w-max sm:gap-5 sm:pl-5">
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-70"
          >
            <Mark className="size-5 text-primary" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">splitr</span>
          </a>

          <span className="hidden h-4 w-px bg-border sm:block" />

          <ul className="hidden items-center gap-5 sm:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={onNavClick(l.href)}
                  className="text-[13px] whitespace-nowrap text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <LangToggle className="ml-auto" />
          <ThemeToggle />

          {/* One trailing action, never both. There is nothing to sign on the
              landing page, and `#demo` does not exist on /app — carrying both
              overflowed the pill and left a link pointing at nothing.
              ConnectWallet is not given a `hidden` class here: it sets its own
              `inline-flex`, and Tailwind picks between competing display
              utilities by stylesheet order, so the class would be ignored. */}
          {route === 'app' ? (
            <ConnectWallet />
          ) : (
            <a
              href="#demo"
              className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium whitespace-nowrap text-primary-foreground transition-transform duration-500 ease-fluid active:scale-[0.97] sm:inline-flex"
            >
              {t.hero.primary}
              <ArrowRight size={14} />
            </a>
          )}

          {/* /app has no nav links and its wallet control sits in the pill at
              every width, so there is nothing behind a menu to open. */}
          {links.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? t.a11y.closeMenu : t.a11y.openMenu}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/[0.05] sm:hidden"
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          ) : null}
        </nav>
      </header>

      <div
        className={[
          'fixed inset-0 z-30 bg-background/92 backdrop-blur-3xl transition-opacity duration-500 ease-fluid sm:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <ul className="flex h-full flex-col justify-center gap-2 px-8">
          {links.map((l, i) => (
            <li
              key={l.href}
              className="overflow-hidden transition-all duration-700 ease-fluid"
              style={{
                transitionDelay: open ? `${120 + i * 70}ms` : '0ms',
                transform: open ? 'translateY(0)' : 'translateY(2rem)',
                opacity: open ? 1 : 0,
              }}
            >
              <a
                href={l.href}
                onClick={onNavClick(l.href)}
                className="block py-3 font-display text-4xl tracking-[-0.03em]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
