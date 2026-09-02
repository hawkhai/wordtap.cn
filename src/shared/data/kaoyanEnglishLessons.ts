import { appAssetUrl } from "../utils/assetUrls";

export interface KaoyanEnglishLessonSummary {
  id: string;
  sequenceNo: number;
  groupId: "e1" | "e2";
  year: number;
  title: string;
  jsonPath: string;
  pageCount: number;
  characterCount: number;
}

export interface KaoyanEnglishGroup {
  id: "e1" | "e2";
  title: string;
  subtitle: string;
  lessonCount: number;
  lessons: KaoyanEnglishLessonSummary[];
}

export interface KaoyanEnglishManifest {
  schemaVersion: 1;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  courseId: "kaoyan-english";
  title: string;
  totalLessons: number;
  groups: KaoyanEnglishGroup[];
}

export interface KaoyanEnglishLessonDetail extends KaoyanEnglishLessonSummary {
  schemaVersion: 1;
  text: string;
  blocks: Array<{ type: "paragraph"; lang: "en"; text: string }>;
  source: {
    sourceId: string;
    sourcePage: string;
    downloadUrl: string;
    archiveEntry: string;
    pdfSha256: string;
    extraction: string;
  };
}

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export function loadKaoyanEnglishManifest(): Promise<KaoyanEnglishManifest> {
  return fetchJson<KaoyanEnglishManifest>("kaoyan-english/manifest.json", "no-cache");
}

export function loadKaoyanEnglishLesson(path: string): Promise<KaoyanEnglishLessonDetail> {
  return fetchJson<KaoyanEnglishLessonDetail>(path);
}
