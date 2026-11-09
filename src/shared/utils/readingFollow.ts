/** Zero means the current sentence already fits inside the safe reading area. */
export function readingScrollDelta(target: { top: number; bottom: number }, top: number, bottom: number): number {
  if (bottom <= top) return 0;
  if (target.bottom - target.top > bottom - top) {
    // A tall sentence cannot fit; keep its first line in view without repeated scrolling.
    return target.top >= top && target.top < bottom ? 0 : target.top - top;
  }
  return target.top >= top && target.bottom <= bottom ? 0 : target.top - top;
}

export function readingViewport() {
  const viewport = window.visualViewport;
  return { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight };
}

/** Scroll inner containers before the page; one cancellable animation owns the chain. */
export function followReadingSentence(reader: HTMLElement, sentence: HTMLElement): () => void {
  let frame = 0;
  let cancelled = false;
  const ancestors: HTMLElement[] = [];
  for (let parent = sentence.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
    if (/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) ancestors.push(parent);
  }
  const viewport = readingViewport();
  let safeTop = viewport.top + 24;
  const readerRect = reader.getBoundingClientRect();
  // The narrow-screen word card can stick above the article and cover its first lines.
  for (const element of document.querySelectorAll<HTMLElement>(".study-word-card, .study-top-download")) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if ((style.position === "sticky" || style.position === "fixed") && rect.right > readerRect.left && rect.left < readerRect.right &&
      rect.top <= safeTop && rect.bottom > viewport.top && rect.height < viewport.height - 72) safeTop = Math.max(safeTop, rect.bottom + 24);
  }
  const safeBottom = viewport.top + viewport.height - 24;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets: Array<{ element: HTMLElement; from: number; to: number }> = [];
  const projected = sentence.getBoundingClientRect();
  let projectedTop = projected.top;
  let projectedBottom = projected.bottom;
  for (const element of ancestors) {
    const rect = element.getBoundingClientRect();
    let top = Math.max(safeTop, rect.top + 24);
    let bottom = Math.min(safeBottom, rect.bottom - 24);
    // An offscreen inner reader still needs positioning while the page reveals it.
    if (bottom <= top) { top = rect.top + 24; bottom = rect.bottom - 24; }
    const delta = readingScrollDelta({ top: projectedTop, bottom: projectedBottom }, top, bottom);
    const from = element.scrollTop;
    const to = Math.max(0, Math.min(from + delta, element.scrollHeight - element.clientHeight));
    targets.push({ element, from, to });
    projectedTop -= to - from;
    projectedBottom -= to - from;
  }
  const page = document.scrollingElement as HTMLElement | null;
  if (page && !ancestors.includes(page)) {
    const delta = readingScrollDelta({ top: projectedTop, bottom: projectedBottom }, safeTop, safeBottom);
    targets.push({ element: page, from: page.scrollTop, to: Math.max(0, Math.min(page.scrollTop + delta, page.scrollHeight - page.clientHeight)) });
  }
  const moving = targets.filter(target => Math.abs(target.to - target.from) > 1);
  const started = performance.now();
  const step = (now: number) => {
    if (cancelled) return;
    const progress = reduced ? 1 : Math.min(1, (now - started) / 280);
    const eased = 1 - (1 - progress) ** 3;
    for (const { element, from, to } of moving) element.scrollTop = from + (to - from) * eased;
    if (progress < 1 && moving.length) frame = requestAnimationFrame(step);
  };
  if (moving.length) frame = requestAnimationFrame(step);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
}
