import { useEffect, useState } from 'react';

/**
 * Two pages, so two lines of routing rather than a router.
 *
 * Path-based, not hash-based: the landing page already uses `#how`, `#demo`
 * and `#faq` to scroll, and a hash router would fight them for the same slot.
 * The cost is that a static host has to rewrite unknown paths to index.html —
 * `web/public/_redirects` does that for Netlify, and Vite's dev server does it
 * already.
 */
export type Route = 'landing' | 'app';

export function routeFor(pathname: string): Route {
  return pathname.replace(/\/+$/, '').endsWith('/app') ? 'app' : 'landing';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFor(window.location.pathname));

  useEffect(() => {
    const sync = () => setRoute(routeFor(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return route;
}

/** Client-side navigation, so moving between the two does not reload the app. */
export function navigate(to: string): void {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
