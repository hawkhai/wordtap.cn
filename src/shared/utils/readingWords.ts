import type { Segment } from "../types/app";

export const readingWordPattern = /[A-Za-z]+(?:['‘’-][A-Za-z]+)*/g;

/** Keep the original punctuation and spacing while making words individually clickable. */
export function segmentReadingLine(text: string, idPrefix: string): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  for (const [index, match] of Array.from(text.matchAll(readingWordPattern)).entries()) {
    const start = match.index ?? 0;
    if (start > offset) segments.push({ type: "text", text: text.slice(offset, start), id: `${idPrefix}-text-${index}` });
    segments.push({ type: "word", text: match[0], id: `${idPrefix}-word-${index}`, index });
    offset = start + match[0].length;
  }
  if (offset < text.length) segments.push({ type: "text", text: text.slice(offset), id: `${idPrefix}-tail` });
  return segments;
}
