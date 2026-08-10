import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-entry visibility. IntersectionObserver only - a scroll listener would
 * reflow on every frame and cost more than the animation is worth. Fires once,
 * then disconnects.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return { ref, shown };
}
