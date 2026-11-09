import type { ReadingSelection } from "./readingSentences";

/** Map only original text nodes, never IPA annotations or inline controls. */
export function selectionFromRange(root: HTMLElement, range: Range, snapshot: string): ReadingSelection | null {
  if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  let start = Infinity;
  let end = -1;
  for (const token of root.querySelectorAll<HTMLElement>("[data-source-start]")) {
    const node = token.firstChild;
    if (!node || node.nodeType !== 3) {
      const length = Number(token.dataset.sourceLength ?? 0);
      if (length) {
        const whole = document.createRange();
        whole.selectNode(token);
        if (range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0) {
          const offset = Number(token.dataset.sourceStart);
          start = Math.min(start, offset);
          end = Math.max(end, offset + length);
        }
      }
      continue;
    }
    const length = node.textContent?.length ?? 0;
    if (!length || range.comparePoint(node, length) < 0 || range.comparePoint(node, 0) > 0) continue;
    const boundary = (after: boolean) => {
      let low = 0;
      let high = length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const point = range.comparePoint(node, mid);
        if (after ? point <= 0 : point < 0) low = mid + 1;
        else high = mid;
      }
      return low;
    };
    const from = range.startContainer === node ? range.startOffset : boundary(false);
    const to = range.endContainer === node ? range.endOffset : boundary(true);
    if (from >= to) continue;
    const offset = Number(token.dataset.sourceStart);
    start = Math.min(start, offset + from);
    end = Math.max(end, offset + to);
  }
  return start < end && snapshot.slice(start, end).trim() ? { snapshot, start, end } : null;
}

export function selectionMenuPosition(anchor: { left: number; right: number; top: number; bottom: number },
  viewport: { left: number; top: number; width: number; height: number }, width: number, height: number) {
  const left = Math.max(viewport.left + 8, Math.min(anchor.right - width / 2, viewport.left + viewport.width - width - 8));
  const above = anchor.top - height - 8;
  const top = above >= viewport.top + 8 ? above : anchor.bottom + 8;
  return { left, top: Math.max(viewport.top + 8, Math.min(top, viewport.top + viewport.height - height - 8)) };
}
