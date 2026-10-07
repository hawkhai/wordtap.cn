import type { Segment } from "../types/app";

export interface ReadingSentence {
  id: string;
  start: number;
  end: number;
  text: string;
  wordIds: string[];
}

export interface ReadingRun {
  id: string;
  sentence?: ReadingSentence;
  segments: Segment[];
}

const abbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|a\.m|p\.m|adj|adv|pron|prep|conj|n|v)\.$/i;
const closingPunctuation = /[.!?。！？…"'”’»）)\]}]/u;
const hardBoundary = /[\r\n]/u;

function endsSentence(text: string, index: number): boolean {
  const char = text[index];
  if (!/[.!?。！？…]/u.test(char)) return false;
  const token = text.slice(text.lastIndexOf(" ", index) + 1, index + 1).split(/\s/).at(-1) ?? "";
  if (/(?:https?:\/\/|www\.)/i.test(token) && /[^\s"'”’）)\]}]/u.test(text[index + 1] ?? "")) return false;
  if (/[!?。！？]/u.test(char)) return true;
  if (char !== "." && char !== "…") return false;
  // Periods inside decimals, email addresses, domains and initials are not ends.
  if (/[\p{L}\p{N}]/u.test(text[index + 1] ?? "")) return false;
  const prefix = text.slice(0, index + 1);
  if (abbreviation.test(prefix)) return false;
  if (/\b(?:[A-Z]\.){2,}$/.test(prefix) || /\b[A-Z]\.$/.test(prefix)) return false;
  return true;
}

/** Offsets refer to the same trimmed snapshot used by splitWords, never edited text. */
export function indexReadingSentences(text: string, segments: Segment[]): ReadingSentence[] {
  const ranges: ReadingSentence[] = [];
  let start = 0;
  const append = (end: number) => {
    const raw = text.slice(start, end);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (/\p{L}/u.test(trimmed)) {
      const from = start + leading;
      ranges.push({ id: `sentence-${from}-${from + trimmed.length}`, start: from,
        end: from + trimmed.length, text: trimmed, wordIds: [] });
    }
  };
  for (let index = 0; index < text.length; index += 1) {
    if (hardBoundary.test(text[index])) {
      append(index);
      start = index + 1;
    } else if (endsSentence(text, index)) {
      while (index + 1 < text.length && closingPunctuation.test(text[index + 1])) index += 1;
      append(index + 1);
      start = index + 1;
    }
  }
  append(text.length);

  let offset = 0;
  let rangeIndex = 0;
  for (const segment of segments) {
    while (rangeIndex < ranges.length && ranges[rangeIndex].end <= offset) rangeIndex += 1;
    const range = ranges[rangeIndex];
    if (segment.type === "word" && range && offset >= range.start && offset + segment.text.length <= range.end) {
      range.wordIds.push(segment.id);
    }
    offset += segment.text.length + (segment.type === "word" ? (segment.trailingText?.length ?? 0) : 0);
  }
  return ranges;
}

/** Split only text/punctuation at sentence boundaries; word IDs and indices survive. */
export function buildReadingRuns(segments: Segment[], sentences: ReadingSentence[]): ReadingRun[] {
  const runs: ReadingRun[] = [];
  let offset = 0;
  let sentenceIndex = 0;
  const push = (segment: Segment, sentence?: ReadingSentence) => {
    let run = runs.at(-1);
    if (!run || run.sentence?.id !== sentence?.id) {
      run = { id: sentence?.id ?? `gap-${offset}`, sentence, segments: [] };
      runs.push(run);
    }
    run.segments.push(segment);
  };
  for (const original of segments) {
    const value = original.text + (original.type === "word" ? original.trailingText ?? "" : "");
    if (!value) { push(original); continue; }
    let position = 0;
    while (position < value.length) {
      while (sentenceIndex < sentences.length && sentences[sentenceIndex].end <= offset) sentenceIndex += 1;
      const next = sentences[sentenceIndex];
      const sentence = next && offset >= next.start ? next : undefined;
      const boundary = sentence?.end ?? next?.start ?? Infinity;
      // Blank-line tokens must keep their layout semantics (including extra empty tokens).
      const length = original.type === "blank-line" ? value.length : Math.min(value.length - position, boundary - offset);
      const piece = value.slice(position, position + length);
      let segment: Segment;
      if (original.type === "word" && position === 0) {
        segment = { ...original, trailingText: piece.slice(original.text.length) };
      } else if (position === 0 && length === value.length) {
        segment = original;
      } else {
        segment = { type: "text", id: `${original.id}-slice-${position}`, text: piece };
      }
      push(segment, sentence);
      position += length;
      offset += length;
    }
  }
  return runs;
}
