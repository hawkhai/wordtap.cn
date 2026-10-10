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
export async function loadEnglishVocabularyLesson(path: string): Promise<EnglishVocabularyLesson> {
  const lesson = await fetchJson<EnglishVocabularyLesson>(path);
  if (lesson.schemaVersion !== 1 || !lesson.text?.trim() || !lesson.typingText?.trim() || !Array.isArray(lesson.entries)) {
    throw new Error("Invalid vocabulary unit");
  }
  return lesson;
}
export function vocabularySelection(detail: EnglishVocabularyLesson): CourseLessonSelection {
  return { course: "english-vocabulary", id: detail.id, path: detail.jsonPath,
    title: `${detail.groupTitle} · 第 ${detail.unitNo} 单元 · ${detail.title}`, text: detail.text };
}
