import { appAssetUrl } from "../utils/assetUrls";

interface PostgraduateBlock {
  type: "paragraph";
  lang: "en" | "zh";
  text: string;
}

export interface PostgraduateLessonSummary {
  id: string;
  volumeId: string;
  unitNo: number;
  articleNo?: number;
  textLabel?: "Text A" | "Text B";
  author?: string;
  title: string;
  theme: string;
  jsonPath: string;
  paragraphCount: number;
}

export interface PostgraduateVolume {
  id: string;
  title: string;
  subtitle: string;
  lessonCount: number;
  expectedLessonCount: number;
  languageMode: "bilingual" | "en";
  missingUnitNos: number[];
  lessons: PostgraduateLessonSummary[];
}

export interface PostgraduateManifest {
  schemaVersion: number;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  totalLessons: number;
  expectedTotalLessons: number;
  complete: boolean;
  missingLessons: Array<{
    volumeId: string;
    unitNo: number;
    textLabel?: "Text A" | "Text B";
    title: string;
    theme: string;
  }>;
  volumes: PostgraduateVolume[];
}

export interface PostgraduateLessonDetail extends Omit<PostgraduateLessonSummary, "paragraphCount"> {
  schemaVersion: number;
  text: string;
  blocks: PostgraduateBlock[];
}

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function loadPostgraduateManifest(): Promise<PostgraduateManifest> {
  return fetchJson<PostgraduateManifest>("postgraduate/manifest.json", "no-cache");
}

export function loadPostgraduateLesson(path: string): Promise<PostgraduateLessonDetail> {
  return fetchJson<PostgraduateLessonDetail>(path);
}
