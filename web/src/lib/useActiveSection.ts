import { useEffect, useState } from 'react';

/**
 * Which section the reader is currently in, for the nav to mark.
 *
 * IntersectionObserver rather than a scroll listener, for the same reason
 * `useReveal` uses one: a handler on every scroll frame reflows the page to ask
 * where things are, and this is decoration.
 *
 * The trick is the root margin, which collapses the viewport to a thin band
 * just below the nav pill instead of asking "is any of this section visible" —
 * on a long page three sections can be visible at once, and the useful answer
 * is the one you are reading. 112px is `scroll-mt-28`, the offset the sections
 * already use, so the band starts exactly where an anchor jump lands.
 */
const BAND = '-112px 0px -70% 0px';

/** `ids` must be in document order; the hook does not sort them. */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  // Joined, so a caller passing an array literal does not re-run this on every
  // render. The ids themselves are read from the closure, which is correct
  // because the key changes whenever they do.
  const key = ids.join(',');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const visible = new Set<string>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        // Last in document order wins. At a boundary both the outgoing and the
        // incoming section cross the band; highlighting the one being scrolled
        // into is what a reader expects, and it keeps the mark moving forward
        // rather than flickering between the two.
        let next: string | null = null;
        for (const id of ids) if (visible.has(id)) next = id;
        setActive(next);
      },
      { rootMargin: BAND },
    );

    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [key]);

  return active;
}
