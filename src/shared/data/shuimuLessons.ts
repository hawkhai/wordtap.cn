import { appAssetUrl } from "../utils/assetUrls";

interface ShuimuVideo {
  lessonNo: number;
  position: number;
  title: string;
  duration: string;
  url: string;
  mappingBasis: string;
}

interface ShuimuBlock {
  type: "heading" | "subheading" | "list" | "paragraph";
  text: string;
}

export interface ShuimuLessonDetail {
  schemaVersion: number;
  id: string;
  levelId: string;
  unitNo: number;
  title: string;
  jsonPath: string;
  text: string;
  blocks: ShuimuBlock[];
  videos: ShuimuVideo[];
}

export interface ShuimuLessonSummary {
  id: string;
  levelId: string;
  unitNo: number;
  title: string;
  jsonPath: string;
  videoCount: number;
}

export interface ShuimuLevel {
  id: string;
  title: string;
  subtitle: string;
  lessonCount: number;
  lessons: ShuimuLessonSummary[];
}

export interface ShuimuManifest {
  schemaVersion: number;
  totalLessons: number;
  levels: ShuimuLevel[];
}

export async function loadShuimuManifest(): Promise<ShuimuManifest> {
  const response = await fetch(appAssetUrl("shuimu/manifest.json"), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load shuimu manifest: ${response.status}`);
  }
  return (await response.json()) as ShuimuManifest;
}

export async function loadShuimuLesson(path: string): Promise<ShuimuLessonDetail> {
  const response = await fetch(appAssetUrl(path), { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return (await response.json()) as ShuimuLessonDetail;
}
