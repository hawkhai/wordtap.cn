import { appAssetUrl } from "../utils/assetUrls";

interface CollegeEnglishBlock {
  type: "paragraph";
  lang: "en" | "zh";
  text: string;
}

export interface CollegeEnglishLessonSummary {
  id: string;
  sequenceNo: number;
  groupId: string;
  unitNo: number;
  unitTitle: string;
  section: "A" | "B" | "C";
  articleType: "text-a" | "text-b" | "stories-of-china";
  title: string;
  printedPageStart: number;
  printedPageEnd: number;
  jsonPath: string;
  characterCount: number;
}

export interface CollegeEnglishGroup {
  id: string;
  title: string;
  subtitle: string;
  sourceBook: string;
  pdfPageCount: number;
  ocrPageCount: number;
  plannedArticleCount: number;
  publishedArticleCount: number;
  lessonCount: number;
  lessons: CollegeEnglishLessonSummary[];
}

export interface CollegeEnglishManifest {
  schemaVersion: 2;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  courseId: "college-english";
  title: string;
  plannedArticleCount: number;
  publishedArticleCount: number;
  totalLessons: number;
  groups: CollegeEnglishGroup[];
}

export interface CollegeEnglishLessonDetail extends CollegeEnglishLessonSummary {
  schemaVersion: 2;
  text: string;
  blocks: CollegeEnglishBlock[];
  source: {
    series: string;
    book: string;
    sourceBook: string;
    printedPageStart: number;
    printedPageEnd: number;
    pdfPageStart: number;
    pdfPageEnd: number;
    pdfSha256: string;
    ocrFiles: string[];
  };
  manualReview: {
    status: "passed";
    reviewer: string;
    reviewedAt: string;
    correctionCount: number;
    evidence: string;
    textSha256: string;
    eventSha256: string;
  };
}

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export function loadCollegeEnglishManifest(): Promise<CollegeEnglishManifest> {
  return fetchJson<CollegeEnglishManifest>("college-english/manifest.json", "no-cache");
}

export function loadCollegeEnglishLesson(path: string): Promise<CollegeEnglishLessonDetail> {
  return fetchJson<CollegeEnglishLessonDetail>(path);
}
