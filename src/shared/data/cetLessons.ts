import { appAssetUrl } from "../utils/assetUrls";

export interface CetLessonSummary {
  id: string;
  sequenceNo: number;
  groupId: "cet4" | "cet6";
  year: number;
  month: number;
  setNo: number;
  title: string;
  jsonPath: string;
  pageCount: number;
  characterCount: number;
}

export interface CetGroup {
  id: "cet4" | "cet6";
  title: string;
  subtitle: string;
  lessonCount: number;
  lessons: CetLessonSummary[];
}

export interface CetManifest {
  schemaVersion: 1;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  courseId: "cet";
  title: string;
  totalLessons: number;
  groups: CetGroup[];
}

export interface CetLessonDetail extends CetLessonSummary {
  schemaVersion: 1;
  text: string;
  blocks: Array<{ type: "paragraph"; lang: "en"; text: string }>;
  source: { relativePath: string; pdfSha256: string; extraction: string };
}

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export function loadCetManifest(): Promise<CetManifest> {
  return fetchJson<CetManifest>("cet/manifest.json", "no-cache");
}

export function loadCetLesson(path: string): Promise<CetLessonDetail> {
  return fetchJson<CetLessonDetail>(path);
}
