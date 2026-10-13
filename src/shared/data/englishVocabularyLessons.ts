import { appAssetUrl } from "../utils/assetUrls";
import type { CourseLessonSelection } from "../types/app";

export interface VocabularyEntry {
  word: string;
  uk?: string;
  us?: string;
  translations?: { translation: string; type?: string }[];
  phrases?: { phrase: string; translation?: string }[];
  sentences?: { sentence: string; translation?: string }[];
}
export interface EnglishVocabularyLessonSummary {
  id: string;
  groupId: string;
  unitNo: number;
  title: string;
  wordCount: number;
  firstWord: string;
  lastWord: string;
  jsonPath: string;
}
export interface EnglishVocabularyGroup {
  id: string;
  title: string;
  wordCount: number;
  lessonCount: number;
  indexPath: string;
  lessons: EnglishVocabularyLessonSummary[];
}
export interface EnglishVocabularyManifest {
  schemaVersion: 1;
  wordsPerArticle: number;
  totalWords: number;
  totalLessons: number;
  groups: EnglishVocabularyGroup[];
}
export interface EnglishVocabularyLesson extends EnglishVocabularyLessonSummary {
  schemaVersion: 1;
  groupTitle: string;
  entries: VocabularyEntry[];
  text: string;
  typingText: string;
  source?: { commit: string; path: string; sha256: string; lineStart: number; lineEnd: number };
}
export interface EnglishVocabularyIndex {
  groupId: string;
  lessons: { id: string; words: string[] }[];
}

async function fetchJson<T>(path: string, cache: RequestCache = "no-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}
export function loadEnglishVocabularyManifest(): Promise<EnglishVocabularyManifest> {
  return fetchJson("english-vocabulary/manifest.json", "no-cache");
}
export function loadEnglishVocabularyIndex(path: string): Promise<EnglishVocabularyIndex> {
  return fetchJson(path);
}

/** New articles keep the first 20-word unit's ID, so old short codes stay unambiguous. */
export function resolveEnglishVocabularyLesson(groups: EnglishVocabularyGroup[], id: string): EnglishVocabularyLessonSummary | undefined {
  const match = /^(ev[a-z0-9]+)-(\d{3})$/.exec(id);
  if (!match || Number(match[2]) < 1) return;
  const group = groups.find(item => item.id === match[1]);
  const number = Number(match[2]);
  return group?.lessons.find(lesson => {
    const first = Number(lesson.id.slice(-3));
    return number >= first && number < first + Math.ceil(lesson.wordCount / 20);
  });
}

function readingEntry(entry: VocabularyEntry): string {
  const lines = [entry.word];
  const phonetics = ([['uk', '英'], ['us', '美']] as const)
    .filter(([key]) => entry[key]?.trim())
    .map(([key, label]) => `${label} /${entry[key]!.trim().replace(/^\/+|\/+$/g, '')}/`);
  if (phonetics.length) lines.push(`音标：${phonetics.join('  ')}`);
  for (const item of entry.translations ?? []) {
    const kind = item.type?.trim() ?? '';
    lines.push((kind ? `${kind.replace(/\.+$/, '')}. ` : '') + item.translation);
  }
  for (const item of entry.phrases ?? []) lines.push(`短语：${item.phrase}${item.translation ? ` — ${item.translation}` : ''}`);
  for (const item of entry.sentences ?? []) {
    if (item.sentence) lines.push(`例句：${item.sentence}`);
    if (item.translation) lines.push(item.translation);
  }
  return lines.join('\n');
}

export async function loadEnglishVocabularyLesson(path: string): Promise<EnglishVocabularyLesson> {
  // Saved 20-word articles keep their exact text and typing body for draft recovery.
  // New selections use articles/; no legacy JSON files are published.
  const legacy = /^english-vocabulary\/lessons\/(ev[a-z0-9]+)\/(\d{3})\.json$/.exec(path);
  const oldNumber = legacy ? Number(legacy[2]) : 0;
  if (legacy && oldNumber < 1) throw new Error("Invalid vocabulary unit");
  const first = Math.floor((oldNumber - 1) / 5) * 5 + 1;
  const fetchPath = legacy ? `english-vocabulary/articles/${legacy[1]}/${String(first).padStart(3, '0')}.json` : path;
  const lesson = await fetchJson<EnglishVocabularyLesson>(fetchPath);
  if (lesson.schemaVersion !== 1 || !lesson.text?.trim() || !lesson.typingText?.trim() || !Array.isArray(lesson.entries)) {
    throw new Error("Invalid vocabulary unit");
  }
  if (legacy) {
    const entries = lesson.entries.slice((oldNumber - first) * 20, (oldNumber - first + 1) * 20);
    if (!entries.length) throw new Error("Invalid vocabulary unit");
    const typingText = entries.flatMap(entry => {
      const sentences = (entry.sentences ?? []).filter(item => /[A-Za-z]/.test(item.sentence)).map(item => item.sentence);
      return sentences.length ? sentences : [entry.word];
    }).join('\n\n');
    return { ...lesson, id: `${legacy[1]}-${legacy[2]}`, unitNo: oldNumber, jsonPath: path,
      title: `${entries[0].word} — ${entries.at(-1)!.word}`, wordCount: entries.length, entries, typingText,
      ...(lesson.source ? { source: { ...lesson.source, lineStart: (oldNumber - 1) * 20 + 1,
        lineEnd: (oldNumber - 1) * 20 + entries.length } } : {}),
      text: `英语词汇 · ${lesson.groupTitle} · 第 ${oldNumber} 单元\n\n${entries.map(readingEntry).join('\n\n')}` };
  }
  return lesson;
}
export function vocabularySelection(detail: EnglishVocabularyLesson): CourseLessonSelection {
  return { course: "english-vocabulary", id: detail.id, path: detail.jsonPath,
    title: `${detail.groupTitle} · 第 ${detail.unitNo} 单元 · ${detail.title}`, text: detail.text };
}
