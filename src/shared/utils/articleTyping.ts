import { indexReadingSentences } from "./readingSentences";
import { readingWordPattern } from "./readingWords";

/** Text entry/deletion from physical keyboards, mobile keyboards or IMEs; not paste/drop. */
export function isTypingKeyboardInput(event: Pick<InputEvent, "inputType">): boolean {
  return /^(insertText|insertCompositionText|insertFromComposition|delete(Content|Word|SoftLine|HardLine)(Backward|Forward))$/.test(event.inputType);
}

export interface TypingSentence {
  id: string;
  display: string;
  target: string;
}

export interface TypingState {
  current: number;
  completed: number[];
  drafts: Record<number, string>;
}

export function englishTypingTarget(text: string): string {
  return text
    .replace(/\([^)]*\p{Script=Han}[^)]*\)|（[^）]*）/gu, "")
    .replace(/[\p{Script=Han}，。！？；：、]+/gu, "")
    .replace(/[\t\r\n ]+/g, " ")
    .trim();
}

export function buildTypingSentences(text: string): TypingSentence[] {
  return indexReadingSentences(text.trim(), [])
    .map((sentence) => ({
      id: sentence.id,
      display: sentence.text,
      target: englishTypingTarget(sentence.text),
    }))
    .filter((sentence) => /[A-Za-z]/.test(sentence.target));
}

export function nextTypingWord(target: string, draft: string): { text: string; start: number } | null {
  const feedback = typingFeedback(target, draft);
  const correctLength = feedback.firstError < 0 ? feedback.actual.length : feedback.firstError;
  let letterEnd = 0;
  for (const match of target.matchAll(readingWordPattern)) {
    const start = match.index ?? 0;
    letterEnd += (match[0].match(/[A-Za-z]/g) ?? []).length;
    if (correctLength < letterEnd) return { text: match[0], start };
  }
  return null;
}

export function initialTypingState(): TypingState {
  return { current: 0, completed: [], drafts: {} };
}

/** Compare English letters only; retain source positions for highlighting and editing. */
export function typingFeedback(target: string, draft: string) {
  const expected = target.match(/[A-Za-z]/g) ?? [];
  const entries = Array.from(draft.matchAll(/[A-Za-z]/g));
  const actual = entries.map((match) => match[0]);
  const firstError = actual.findIndex((char, index) => char.toLowerCase() !== expected[index]?.toLowerCase());
  let letterIndex = 0;
  const targetLetterIndices = Array.from(target, (char) => /[A-Za-z]/.test(char) ? letterIndex++ : -1);
  return {
    expected, actual, firstError, targetLetterIndices,
    errorOffset: entries[firstError]?.index ?? 0,
    ready: expected.length > 0 && firstError < 0 && expected.length === actual.length,
  };
}

export function updateTypingDraft(state: TypingState, value: string): TypingState {
  return { ...state, drafts: { ...state.drafts, [state.current]: value } };
}

/** Finishing a line is explicit, so a final keystroke never unexpectedly replaces it. */
export function submitTypingSentence(state: TypingState, sentences: TypingSentence[]): TypingState {
  const current = state.current;
  if (!sentences[current] || state.completed.includes(current) || !typingFeedback(sentences[current].target, state.drafts[current] ?? "").ready) return state;
  const completed = [...new Set([...state.completed, current])].sort((a, b) => a - b);
  const next = sentences.findIndex((_, index) => index > current && !completed.includes(index));
  const firstIncomplete = sentences.findIndex((_, index) => !completed.includes(index));
  return { current: next >= 0 ? next : firstIncomplete >= 0 ? firstIncomplete : current, completed, drafts: state.drafts };
}

export function normalizeTypingState(raw: unknown, sentences: TypingSentence[]): TypingState {
  if (!raw || typeof raw !== "object") return initialTypingState();
  const value = raw as Partial<TypingState>;
  const completed = Array.isArray(value.completed)
    ? [...new Set(value.completed.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < sentences.length))]
    : [];
  const drafts: Record<number, string> = {};
  if (value.drafts && typeof value.drafts === "object") {
    for (const [key, draft] of Object.entries(value.drafts)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < sentences.length && typeof draft === "string") {
        drafts[index] = draft;
      }
    }
  }
  const current = Number.isInteger(value.current) && Number(value.current) >= 0 && Number(value.current) < sentences.length
    ? Number(value.current) : 0;
  return { current, completed, drafts };
}

export function englishBlocks(blocks: Array<{ type: string; lang?: string; text: string }>): string {
  return blocks.filter((block) => block.type === "paragraph" && block.lang === "en")
    .map((block) => block.text.trim()).filter(Boolean).join("\n\n");
}

export function nceBodyText(detail: { bodyText: string; text: string }): string {
  return detail.bodyText.trim() || detail.text.trim();
}

export function shuimuBodyText(blocks: Array<{ type: string; text: string }>): string {
  const start = blocks.findIndex((block) => /\bStep\s*2\s*:\s*Intensive reading\b/i.test(block.text));
  if (start < 0) return "";
  const body: string[] = [];
  for (const block of blocks.slice(start + 1)) {
    if (block.type === "heading" || /\bStep\s*[3-9]\s*:/i.test(block.text)) break;
    const text = block.text.trim();
    if (block.type === "paragraph" && /[A-Za-z]/.test(text) && !/\p{Script=Han}/u.test(text)) body.push(text);
  }
  return body.join("\n\n");
}
