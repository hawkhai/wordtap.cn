export type Segment =
  | { type: "text"; text: string; id: string }
  | { type: "word"; text: string; trailingText?: string; id: string; index: number };

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  translation?: string;
  definition?: string;
};

export type DictionaryManifest = {
  version: string;
  generatedAt: string;
  source: string;
  shardCount: number;
  entryCount: number;
  targetShardBytes?: number;
  maxPrefixLength?: number;
  shardNames?: string[];
  shardFiles?: Record<string, string>;
  largestShard?: {
    name: string;
    bytes: number;
    entries: number;
  };
};

export type DictionaryShard = Record<string, DictionaryEntry>;
export type ActiveView = "study" | "exam" | "review" | "diagnostics" | "ipa";
export type CourseId = "pep-english" | "nce" | "shuimu" | "postgraduate" | "college-english" | "cet" | "kaoyan-english";
export type CourseLessonSelection = {
  course: CourseId;
  id: string;
  path: string;
  title: string;
  text: string;
};
export type ActiveCourseLesson = Omit<CourseLessonSelection, "text"> & {
  code: string;
  url: string;
};
export type GatewayStatusRefreshMode = "manual" | "auto";
export type TranslationMode = "auto" | "ecdict" | "baidu_sug";
export type TranslationLookupSource =
  | "memory-cache"
  | "translation-cache"
  | "local-dictionary"
  | "baidu-sug"
  | "fallback"
  | "missing";
export type TranslationLookup = {
  meaning: string;
  source: TranslationLookupSource;
  sourceLabel: string;
};
export type MeaningMemoryRecord = {
  meaning: string;
  source: Exclude<TranslationLookupSource, "memory-cache" | "missing">;
};
export type DiagnosticStatus = "pending" | "ok" | "warn" | "fail";
export type DiagnosticItem = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
};
export type GatewayCapabilitiesPayload = {
  protocols?: string[];
  endpoints?: string[];
};
export type WordPopoverState = {
  visible: boolean;
  word: string;
  meaning: string;
  status: "loading" | "ready" | "missing";
  x: number;
  y: number;
  mobile: boolean;
};
export type ReviewContextMenuState = {
  visible: boolean;
  key: string;
  x: number;
  y: number;
};
export type AppSettings = {
  selectedRate: string;
  selectedRepeat: number;
  selectedTranslateMode: TranslationMode;
  markLearned: boolean;
  browserSpeechVoiceUri: string;
  gatewaySpeechVoice: string;
  defaultTextRunCount: number;
};
