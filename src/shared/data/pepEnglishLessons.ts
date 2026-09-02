import { appAssetUrl } from "../utils/assetUrls";

interface PepEnglishBlock { type: "paragraph"; lang: "en"; text: string; }
export interface PepEnglishLessonSummary {
  id: string; groupId: string; unitNo: number; sequenceNo: number; section: string; title: string; jsonPath: string;
}
export interface PepEnglishGroup {
  id: string; stage: "junior" | "senior"; stageTitle: "初中" | "高中"; bookOrder: number;
  title: string; subtitle: string; sourceStatus: "available"; lessonCount: number; lessons: PepEnglishLessonSummary[];
}
export interface PepEnglishManifest {
  schemaVersion: 1; generatedAt: string; generator: string; generatorVersion: string;
  expectedBookCount: 17; availableBookCount: number; complete: boolean; totalLessons: number;
  missingBooks: Array<{ id: string; stage: "junior" | "senior"; title: string; reason: string }>;
  groups: PepEnglishGroup[];
}
export interface PepEnglishLessonDetail extends PepEnglishLessonSummary {
  schemaVersion: 1; text: string; blocks: PepEnglishBlock[];
  source: {
    publisher: string; stage: string; book: string; pageStart: number; pageEnd: number;
    extractionMode: "text" | "ocr"; origin?: string; contentId?: string; pdfMd5?: string; pdfSize?: number;
    manualReview?: { method: string; source: string; reviewedAt: string; notes?: string };
  };
}

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return (await response.json()) as T;
}
export function loadPepEnglishManifest(): Promise<PepEnglishManifest> {
  return fetchJson<PepEnglishManifest>("pep-english/manifest.json", "no-cache");
}
export function loadPepEnglishLesson(path: string): Promise<PepEnglishLessonDetail> {
  return fetchJson<PepEnglishLessonDetail>(path);
}
