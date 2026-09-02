import { appAssetUrl } from "../utils/assetUrls";

interface NceLessonSentence {
  index: number;
  startTime: number;
  endTime: number | null;
  en: string;
  zh: string;
  role: "lesson" | "title" | "prompt" | "question" | "body";
}

interface NceLessonAudio {
  fileName: string;
  sourcePath: string;
  exists: boolean;
}

interface NceLessonSource {
  lrcFileName: string;
  lrcPath: string;
}

export interface NceLessonSummary {
  id: string;
  bookId: string;
  bookNo: number;
  lessonNo: number;
  lessonRange: number[];
  title: string;
  titleZh: string;
  question: string;
  questionZh: string;
  jsonPath: string;
  sentenceCount: number;
  bodySentenceCount: number;
  audio: NceLessonAudio;
  source: NceLessonSource;
}

export interface NceBook {
  id: string;
  bookNo: number;
  title: string;
  subtitle: string;
  lessonCount: number;
  lessons: NceLessonSummary[];
}

export interface NceManifest {
  schemaVersion: number;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  totalLessons: number;
  books: NceBook[];
}

export interface NceLessonDetail extends Omit<NceLessonSummary, "jsonPath" | "sentenceCount" | "bodySentenceCount"> {
  schemaVersion: number;
  text: string;
  bodyText: string;
  bodyTextZh: string;
  sentences: NceLessonSentence[];
  source: NceLessonSource & {
    repository: string;
    sourceDataFile: string;
    generatedAt: string;
    generator: string;
    generatorVersion: string;
    metadata: Record<string, string>;
  };
}

export const nceBooks: NceBook[] = [
  {
    id: "nce1",
    bookNo: 1,
    title: "新概念英语 第一册",
    subtitle: "英语初阶 (First Things First)",
    lessonCount: 0,
    lessons: [],
  },
  {
    id: "nce2",
    bookNo: 2,
    title: "新概念英语 第二册",
    subtitle: "实践与进步 (Practice and Progress)",
    lessonCount: 0,
    lessons: [],
  },
  {
    id: "nce3",
    bookNo: 3,
    title: "新概念英语 第三册",
    subtitle: "培养技能 (Developing Skills)",
    lessonCount: 0,
    lessons: [],
  },
  {
    id: "nce4",
    bookNo: 4,
    title: "新概念英语 第四册",
    subtitle: "流利英语 (Fluency in English)",
    lessonCount: 0,
    lessons: [],
  },
];

let manifestPromise: Promise<NceManifest> | null = null;

async function fetchJson<T>(path: string, cache: RequestCache = "force-cache"): Promise<T> {
  const response = await fetch(appAssetUrl(path), { cache });
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function loadNceManifest(): Promise<NceManifest> {
  manifestPromise ??= fetchJson<NceManifest>("nce/manifest.json", "no-cache").catch((error: unknown) => {
    manifestPromise = null;
    throw error;
  });
  return manifestPromise;
}

export function loadNceLesson(path: string): Promise<NceLessonDetail> {
  return fetchJson<NceLessonDetail>(path);
}
