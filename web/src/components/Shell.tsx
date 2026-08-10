/**
 * One soft radial behind the fold, plus film grain. Both fixed and
 * pointer-events-none: blur and noise over a scrolling container repaint every
 * frame. The decorative hairline grid that used to live here is gone. Grid
 * lines drawn purely to make a page feel designed are decoration, not
 * structure, and they were doing no work.
 */
export function Shell() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="aurora-primary absolute -top-[35%] -left-[15%] size-[70vw] rounded-full blur-[120px]" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
