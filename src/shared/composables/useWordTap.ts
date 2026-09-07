import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  GatewaySpeechSession,
  gatewayDownloadUrl,
  gatewayReleaseManifestUrl,
  gatewaySpeechEngineVersion,
  isGatewaySpeechCancelError,
  isLocalGatewayRunning,
  localGatewayBaseUrl,
} from "../utils/gatewaySpeech";
import {
  audioCacheStats,
  clearAudioCache,
  clearTranslationCache,
  deleteStudyHistoryRecord,
  deleteStudyTextRecord,
  exportCompleteLearningDataJson,
  exportStudyHistoryJson,
  getCachedTranslation,
  importCompleteLearningDataJson,
  importStudyHistoryJson,
  latestStudyText,
  listExamProgress,
  listExamWordEncounters,
  listStudyHistory,
  listStudyTexts,
  normalizeHistoryWord,
  putCachedTranslation,
  recordExamOpen,
  recordExamWordEncounter,
  recordStudyText,
  recordWordStudy,
  repairAudioCache,
  resetExamProgress,
  setExamProgressCompleted,
  type StudyHistoryRecord,
  type StudyTextRecord,
  type TranslationCacheSource,
  startupPruneAudioCache,
  translationCacheStats,
  updateStudyMeaning,
  updateExamWordEncounter,
  type ExamCourseId,
  type ExamProgressRecord,
  type ExamProgressStatus,
  type ExamReviewState,
  type ExamWordEncounterRecord,
} from "../stores/historyStore";
import { appAssetUrl, appDownloadUrl } from "../utils/assetUrls";
import { siteCopy } from "../copy/siteCopy";
import { translateWithBaiduSugGateway } from "../utils/gatewayTranslate";
import { isNarrowLayoutViewport, isProbablyMobileBrowser, isWindows } from "../utils/device";
import { buildLessonShortUrl, lessonShortCode, parseLessonShortCode } from "../utils/lessonUrls";
import {
  formatLineStructuredTextForReading,
  formatProseForReading,
  formatShuimuForReading,
  withReadingTitle,
} from "../utils/readingLayout";
import { loadNceLesson, loadNceManifest } from "../data/nceLessons";
import { loadShuimuLesson, loadShuimuManifest } from "../data/shuimuLessons";
import { loadPostgraduateLesson, loadPostgraduateManifest } from "../data/postgraduateLessons";
import { loadPepEnglishLesson, loadPepEnglishManifest } from "../data/pepEnglishLessons";
import { loadCollegeEnglishLesson, loadCollegeEnglishManifest } from "../data/collegeEnglishLessons";
import { loadCetLesson, loadCetManifest } from "../data/cetLessons";
import { loadKaoyanEnglishLesson, loadKaoyanEnglishManifest } from "../data/kaoyanEnglishLessons";
import { examNotice } from "../config/examNotice";
import {
  UI_SPLIT_WORDS_DEBOUNCE,
  UI_TEXT_HISTORY_SAVE_DEBOUNCE,
  GATEWAY_HEARTBEAT_INTERVAL,
  GATEWAY_DIAGNOSTIC_STATUS,
  GATEWAY_DIAGNOSTIC_CAPABILITIES,
  GATEWAY_DIAGNOSTIC_TRANSLATE,
  GATEWAY_DIAGNOSTIC_SPEECH,
  GATEWAY_TRANSLATE_REQUEST,
  DICTIONARY_FETCH,
  NETWORK_HEAD_PROBE,
  NETWORK_LARGE_DOWNLOAD_HEAD_PROBE,
  NETWORK_RELEASE_MANIFEST,
  SPEECH_WATCHDOG_BASE,
  SPEECH_BROWSER_CHAR_MS,
  SPEECH_YOUDAO_CHAR_MS,
  SPEECH_READ_AUDIO_BLOB,
  RESPONSE_READ_ERROR_TEXT,
} from "../utils/timeoutConstants";
import type {
  Segment,
  DictionaryEntry,
  DictionaryManifest,
  DictionaryShard,
  ActiveView,
  GatewayStatusRefreshMode,
  TranslationMode,
  TranslationLookupSource,
  TranslationLookup,
  MeaningMemoryRecord,
  DiagnosticStatus,
  DiagnosticItem,
  GatewayCapabilitiesPayload,
  WordPopoverState,
  ReviewContextMenuState,
  AppSettings,
  ActiveCourseLesson,
  CourseId,
  CourseLessonSelection,
} from "../types/app";

export function useWordTap() {
const copy = siteCopy;
const defaultText = copy.defaultText;

const wordPattern = /[A-Za-z]+(?:['-][A-Za-z]+)?/g;
const trailingPunctuationPattern = /^[,.;:!?…，。！？；：、)\]}"'”’]+/;
const rateOptions = ["-40%", "-20%", "-10%", "+0%", "+10%", "+20%", "+40%"];
const rateOptionLabels: Record<string, string> = { ...copy.controls.rateOptionLabels };
const repeatOptions = [1, 2, 3, 4, 5];
const translateModeOptions: Array<{ value: TranslationMode; label: string }> = [...copy.controls.translateModeOptions];
const defaultGatewayVoice = copy.controls.defaultGatewayVoice;
const gatewayVoiceOptions = [...copy.controls.gatewayVoiceOptions];
const fallbackDictionary: Record<string, string> = { ...copy.controls.fallbackDictionary };
const settingsStorageKey = "wordtap.settings";
const markLearnedStorageKey = "wordtap.markLearned";
const browserSpeechVoiceStorageKey = "wordtap.browserSpeechVoice";
const gatewaySpeechVoiceStorageKey = "wordtap.gatewaySpeechVoice";
const translateModeStorageKey = "wordtap.translateMode";
const defaultTextRunCountStorageKey = "wordtap.defaultTextRunCount";
const defaultTextRunLimit = 3;
const youdaoDictVoiceBaseUrl = "https://dict.youdao.com/dictvoice";
const storedSettings = readStoredSettings();
const sourceText = ref("");
const segments = ref<Segment[]>([]);
const selectedSegmentId = ref("");
const currentWord = ref<string>(copy.state.currentWordEmpty);
const meaning = ref<string>(copy.state.meaningHint);
const status = ref<string>(copy.state.initialStatus);
const dictionaryInfo = ref<string>(copy.state.dictionaryPreparing);
const selectedRate = ref(storedSettings.selectedRate);
const selectedRepeat = ref(storedSettings.selectedRepeat);
const selectedTranslateMode = ref<TranslationMode>(storedSettings.selectedTranslateMode);
const isWordSpeaking = ref(false);
const isFullTextSpeaking = ref(false);
const browserSpeechSupported = ref(true);
const isGatewayRunning = ref(false);
const wordSpeechRunId = ref(0);
const fullTextSpeechRunId = ref(0);
const lookupRunId = ref(0);
const manifest = ref<DictionaryManifest | null>(null);
const availableShardNames = ref<Set<string>>(new Set());
const availableVoices = ref<SpeechSynthesisVoice[]>([]);
const historyRecords = ref<StudyHistoryRecord[]>([]);
const textHistoryRecords = ref<StudyTextRecord[]>([]);
const selectedTextHistoryId = ref("");
const reviewSearch = ref("");
const selectedReviewKey = ref("");
const historyImportInput = ref<HTMLInputElement | null>(null);
const reviewList = ref<HTMLElement | null>(null);
const historyImporting = ref(false);
type ExamCategory = "all" | "e1" | "e2" | "cet4" | "cet6";
type ExamStatusFilter = "all" | "not-started" | "in-progress" | "completed";
type ExamSubView = "papers" | "words";
type ExamWordDisplay = "list" | "cards";
type ExamPaper = {
  course: ExamCourseId;
  id: string;
  path: string;
  title: string;
  category: Exclude<ExamCategory, "all">;
  categoryLabel: string;
  sortValue: number;
};
const examPapers = ref<ExamPaper[]>([]);
const examProgressRecords = ref<ExamProgressRecord[]>([]);
const examWordRecords = ref<ExamWordEncounterRecord[]>([]);
const examLoading = ref(false);
const examStorageAvailable = ref(true);
const examSearch = ref("");
const examCategory = ref<ExamCategory>("all");
const examStatusFilter = ref<ExamStatusFilter>("all");
const examSubView = ref<ExamSubView>("papers");
const examWordSearch = ref("");
const examWordStateFilter = ref<"all" | ExamReviewState>("learning");
const examWordLessonFilter = ref("all");
const examWordDisplay = ref<ExamWordDisplay>("list");
const revealedExamWordKey = ref("");
const examDataImportInput = ref<HTMLInputElement | null>(null);
const examDataImporting = ref(false);
const examDataFeedback = ref("");
const markLearned = ref(storedSettings.markLearned);
const selectedBrowserVoiceUri = ref(storedSettings.browserSpeechVoiceUri);
const selectedGatewayVoice = ref(storedSettings.gatewaySpeechVoice);
const activeView = ref<ActiveView>("study");
const diagnostics = ref<DiagnosticItem[]>([]);
const diagnosticsRunning = ref(false);
const diagnosticsUpdatedAt = ref("");
const audioCacheClearing = ref(false);
const audioCacheSummary = ref<string>(copy.state.cacheUnchecked);
const translationCacheClearing = ref(false);
const translationCacheSummary = ref<string>(copy.state.cacheUnchecked);
const activeCourseLesson = ref<ActiveCourseLesson | null>(null);
const lessonShareUrlCopied = ref(false);
const wordPopover = ref<WordPopoverState>({
  visible: false,
  word: "",
  meaning: "",
  status: "loading",
  x: 0,
  y: 0,
  mobile: false,
});
const reviewContextMenu = ref<ReviewContextMenuState>({
  visible: false,
  key: "",
  x: 0,
  y: 0,
});

const shardCache = new Map<string, Promise<DictionaryShard | null>>();
const meaningMemoryCache = new Map<string, MeaningMemoryRecord>();
const logoMarkUrl = appAssetUrl("logo-mark.png");
const wordTapWindowsDownloadUrl = appDownloadUrl("downloads/WordTap-Setup.exe");
const wordTapWindowsInstallGuideUrl = appAssetUrl("install/windows/");
const gatewayInstallGuideUrl = appAssetUrl("install/gateway/");
let manifestPromise: Promise<void> | null = null;
let gatewaySpeechSession: GatewaySpeechSession | null = null;
let youdaoSpeechAudio: HTMLAudioElement | null = null;
let lookupAbortController: AbortController | null = null;
let gatewayHeartbeatTimer: number | null = null;
let splitWordsTimer: number | null = null;
let textHistorySaveTimer: number | null = null;
let sourceTextHydrationTimer: number | null = null;
let gatewayStatusPromise: Promise<boolean> | null = null;
let historyLoadRunId = 0;
let textHistoryLoadRunId = 0;
let wordPopoverAnchorX = 0;
let wordPopoverAnchorY = 0;
let suppressedTextHistoryText = "";
let sourceTextHydrating = false;
let startupExampleActive = false;
let sourceTextTouched = false;
let lastAutoSavedText = "";
let activeCourseLessonTextSnapshot = "";
let lessonShareCopiedTimer: number | null = null;

const gatewayHeartbeatIntervalMs = GATEWAY_HEARTBEAT_INTERVAL;
const speechPlaybackWatchdogMs = SPEECH_WATCHDOG_BASE;

function readStoredMarkLearned(): boolean {
  try {
    return window.localStorage.getItem(markLearnedStorageKey) === "true";
  } catch {
    return false;
  }
}

function readStoredBrowserSpeechVoice(): string {
  try {
    return window.localStorage.getItem(browserSpeechVoiceStorageKey) ?? "";
  } catch {
    return "";
  }
}

function readStoredGatewaySpeechVoice(): string {
  try {
    const stored = window.localStorage.getItem(gatewaySpeechVoiceStorageKey) ?? "";
    return gatewayVoiceOptions.some((option) => option.value === stored) ? stored : defaultGatewayVoice;
  } catch {
    return defaultGatewayVoice;
  }
}

function readStoredTranslateMode(): TranslationMode {
  try {
    const stored = window.localStorage.getItem(translateModeStorageKey);
    return isTranslationMode(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

function readStoredSettings(): AppSettings {
  const legacySettings: Partial<AppSettings> = {
    selectedTranslateMode: readStoredTranslateMode(),
    markLearned: readStoredMarkLearned(),
    browserSpeechVoiceUri: readStoredBrowserSpeechVoice(),
    gatewaySpeechVoice: readStoredGatewaySpeechVoice(),
    defaultTextRunCount: readLegacyDefaultTextRunCount(),
  };

  try {
    const stored = window.localStorage.getItem(settingsStorageKey);
    if (!stored) {
      return normalizeSettings(legacySettings);
    }
    return normalizeSettings({
      ...legacySettings,
      ...(JSON.parse(stored) as Partial<AppSettings>),
    });
  } catch {
    return normalizeSettings(legacySettings);
  }
}

function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const selectedRepeat = Number(raw.selectedRepeat);
  const defaultTextRunCount = Number(raw.defaultTextRunCount);
  const selectedTranslateMode = isTranslationMode(raw.selectedTranslateMode) ? raw.selectedTranslateMode : "auto";
  const gatewaySpeechVoice =
    typeof raw.gatewaySpeechVoice === "string" && gatewayVoiceOptions.some((option) => option.value === raw.gatewaySpeechVoice)
      ? raw.gatewaySpeechVoice
      : defaultGatewayVoice;

  return {
    selectedRate: typeof raw.selectedRate === "string" && rateOptions.includes(raw.selectedRate) ? raw.selectedRate : "+0%",
    selectedRepeat: repeatOptions.includes(selectedRepeat) ? selectedRepeat : 1,
    selectedTranslateMode,
    markLearned: typeof raw.markLearned === "boolean" ? raw.markLearned : false,
    browserSpeechVoiceUri: typeof raw.browserSpeechVoiceUri === "string" ? raw.browserSpeechVoiceUri : "",
    gatewaySpeechVoice,
    defaultTextRunCount: Number.isFinite(defaultTextRunCount) && defaultTextRunCount > 0 ? defaultTextRunCount : 0,
  };
}

function saveStoredSettings(partial: Partial<AppSettings>): void {
  try {
    const next = normalizeSettings({
      ...readStoredSettings(),
      ...partial,
    });
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(next));
  } catch {
    // Settings are best-effort; storage can be unavailable in private browsing.
  }
}

function persistCurrentSettings(): void {
  saveStoredSettings({
    selectedRate: selectedRate.value,
    selectedRepeat: selectedRepeat.value,
    selectedTranslateMode: selectedTranslateMode.value,
    markLearned: markLearned.value,
    browserSpeechVoiceUri: selectedBrowserVoiceUri.value,
    gatewaySpeechVoice: selectedGatewayVoice.value,
  });
}

function readDefaultTextRunCount(): number {
  return readStoredSettings().defaultTextRunCount;
}

function readLegacyDefaultTextRunCount(): number {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(defaultTextRunCountStorageKey) ?? "0", 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function bumpDefaultTextRunCount(current: number): void {
  saveStoredSettings({ defaultTextRunCount: current + 1 });
}

const wordCount = computed(() => segments.value.filter((segment) => segment.type === "word").length);
const wordCountLabel = computed(() => copy.computed.wordCount(wordCount.value));
const isSpeaking = computed(() => isWordSpeaking.value || isFullTextSpeaking.value);
const historyStats = computed(() => {
  const clickTotal = historyRecords.value.reduce((sum, record) => sum + record.count, 0);
  return {
    wordTotal: historyRecords.value.length,
    clickTotal,
  };
});
const examProgressByKey = computed(() => new Map(examProgressRecords.value.map((record) => [record.key, record])));
const examStats = computed(() => ({
  inProgress: examProgressRecords.value.filter((record) => record.status === "in-progress").length,
  completed: examProgressRecords.value.filter((record) => record.status === "completed").length,
  words: examWordRecords.value.length,
}));
const recentExamProgress = computed(() => examProgressRecords.value.slice(0, 5));
const filteredExamPapers = computed(() => {
  const query = examSearch.value.trim().toLowerCase();
  return examPapers.value.filter((paper) => {
    if (examCategory.value !== "all" && paper.category !== examCategory.value) return false;
    if (query && !paper.title.toLowerCase().includes(query) && !paper.categoryLabel.includes(query)) return false;
    const status = examProgressByKey.value.get(`${paper.course}:${paper.id}`)?.status ?? "not-started";
    return examStatusFilter.value === "all" || status === examStatusFilter.value;
  });
});
const examWordLessonOptions = computed(() => {
  const seen = new Map<string, string>();
  for (const record of examWordRecords.value) seen.set(`${record.course}:${record.lessonId}`, record.lessonTitle);
  return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});
const filteredExamWords = computed(() => {
  const query = examWordSearch.value.trim().toLowerCase();
  return examWordRecords.value.filter((record) => {
    if (examCategory.value !== "all") {
      const paper = examPapers.value.find((item) => item.course === record.course && item.id === record.lessonId);
      if (paper?.category !== examCategory.value) return false;
    }
    if (examWordStateFilter.value !== "all" && record.reviewState !== examWordStateFilter.value) return false;
    if (examWordLessonFilter.value !== "all" && `${record.course}:${record.lessonId}` !== examWordLessonFilter.value) return false;
    return !query || record.wordKey.includes(query) || record.meaning.toLowerCase().includes(query) || record.context.toLowerCase().includes(query);
  });
});
const learnedWordKeys = computed(() => new Set(historyRecords.value.map((record) => record.key)));
const filteredHistory = computed(() => {
  const query = normalizeWord(reviewSearch.value);
  if (!query) {
    return historyRecords.value;
  }
  return historyRecords.value.filter(
    (record) => record.key.includes(query) || record.word.toLowerCase().includes(query) || record.meaning.includes(query),
  );
});
const reviewContextRecord = computed(() =>
  historyRecords.value.find((record) => record.key === reviewContextMenu.value.key) ?? null,
);
const textHistoryEmptyLabel = computed(() =>
  copy.computed.textHistoryEmpty(Boolean(textHistoryRecords.value.length)),
);
const reviewEmptyText = computed(() =>
  copy.computed.reviewEmpty(Boolean(historyRecords.value.length)),
);
const mobileBrowser = computed(() => isProbablyMobileBrowser());
const browserVoiceOptions = computed(() => availableVoices.value.filter((voice) => voice.lang.toLowerCase().startsWith("en")));
const browserVoiceSelectOptions = computed(() =>
  browserVoiceOptions.value.map((voice) => ({
    value: voice.voiceURI,
    label: formatBrowserVoiceLabel(voice),
  })),
);
const isHttpsPage = computed(() => window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const fullTextSpeechDisabled = computed(() => !isGatewayRunning.value && !isBrowserSpeechSupported());
const gatewayStatusLabel = computed(() => {
  return isGatewayRunning.value ? copy.computed.gatewayStatusReady : "";
});
const diagnosticsSummary = computed(() => {
  const counts = diagnostics.value.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pending: 0, ok: 0, warn: 0, fail: 0 } satisfies Record<DiagnosticStatus, number>,
  );
  return copy.computed.diagnosticsSummary(counts.ok, counts.warn, counts.fail);
});

function isTranslationMode(value: unknown): value is TranslationMode {
  return typeof value === "string" && translateModeOptions.some((option) => option.value === value);
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function viewFromHash(): ActiveView {
  if (window.location.hash === "#exam") {
    return "exam";
  }
  if (window.location.hash === "#review") {
    return "review";
  }
  if (window.location.hash === "#diagnostics") {
    return "diagnostics";
  }
  if (window.location.hash === "#ipa") {
    return "ipa";
  }
  return "study";
}

function syncActiveViewFromHash(): void {
  activeView.value = viewFromHash();
  if (activeView.value === "study") {
    status.value = studyReadyStatusText();
  } else {
    cancelLookup();
    hideWordPopover();
  }
  if (activeView.value === "review") {
    void reloadHistory({ preserveReviewScroll: true });
  } else if (activeView.value === "exam") {
    void initializeExamPanel();
  } else if (activeView.value === "diagnostics" && !diagnostics.value.length) {
    void runDiagnostics();
  }
}

function studyReadyStatusText(): string {
  return copy.computed.studyReadyStatus(Boolean(sourceText.value.trim()));
}

function currentTranslateModeLabel(): string {
  return translateModeOptions.find((option) => option.value === selectedTranslateMode.value)?.label ?? translateModeOptions[0].label;
}

function announceTranslateModeChange(): void {
  status.value = copy.status.translateModeSelected(currentTranslateModeLabel());
}

function setActiveView(view: ActiveView): void {
  activeView.value = view;
  if (view !== "study") {
    cancelLookup();
    hideWordPopover();
  } else {
    status.value = studyReadyStatusText();
  }
  const nextHash = view === "exam" ? "#exam" : view === "review" ? "#review" : view === "diagnostics" ? "#diagnostics" : view === "ipa" ? "#ipa" : "#study";
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
  if (view === "review") {
    void reloadHistory({ preserveReviewScroll: true });
  } else if (view === "exam") {
    void initializeExamPanel();
  } else if (view === "diagnostics" && !diagnostics.value.length) {
    void runDiagnostics();
  }
}

function isExamCourse(course: CourseId): course is ExamCourseId {
  return course === "cet" || course === "kaoyan-english";
}

function examPaperFor(course: ExamCourseId, lessonId: string): ExamPaper | undefined {
  return examPapers.value.find((paper) => paper.course === course && paper.id === lessonId);
}

async function loadExamCatalog(): Promise<void> {
  if (examPapers.value.length) return;
  const [cetManifest, kaoyanManifest] = await Promise.all([loadCetManifest(), loadKaoyanEnglishManifest()]);
  const papers: ExamPaper[] = [];
  for (const group of kaoyanManifest.groups) {
    for (const lesson of group.lessons) {
      papers.push({
        course: "kaoyan-english",
        id: lesson.id,
        path: lesson.jsonPath,
        title: lesson.title,
        category: group.id,
        categoryLabel: group.title,
        sortValue: lesson.year * 100,
      });
    }
  }
  for (const group of cetManifest.groups) {
    for (const lesson of group.lessons) {
      papers.push({
        course: "cet",
        id: lesson.id,
        path: lesson.jsonPath,
        title: lesson.title,
        category: group.id,
        categoryLabel: group.title,
        sortValue: lesson.year * 10000 + lesson.month * 100 + lesson.setNo,
      });
    }
  }
  examPapers.value = papers.sort((a, b) => b.sortValue - a.sortValue || a.title.localeCompare(b.title, "zh-CN"));
}

async function reloadExamData(): Promise<void> {
  try {
    const [progress, words] = await Promise.all([listExamProgress(), listExamWordEncounters()]);
    examProgressRecords.value = progress;
    examWordRecords.value = words;
    examStorageAvailable.value = true;
  } catch (error) {
    console.warn("Unable to load exam learning data", error);
    examStorageAvailable.value = false;
  }
}

async function initializeExamPanel(): Promise<void> {
  if (examLoading.value) return;
  examLoading.value = true;
  try {
    await Promise.all([loadExamCatalog(), reloadExamData()]);
  } catch (error) {
    console.warn("Unable to initialize exam panel", error);
  } finally {
    examLoading.value = false;
  }
}

async function trackExamOpen(selection: Pick<CourseLessonSelection, "course" | "id" | "title">): Promise<void> {
  if (!isExamCourse(selection.course)) return;
  try {
    await recordExamOpen(selection.course, selection.id, selection.title);
    await reloadExamData();
  } catch (error) {
    console.warn("Unable to record exam progress", error);
    examStorageAvailable.value = false;
  }
}

async function openExamPaper(paper: ExamPaper | ExamProgressRecord): Promise<void> {
  await loadExamCatalog();
  const catalogPaper = "path" in paper ? paper : examPaperFor(paper.course, paper.lessonId);
  if (!catalogPaper) {
    status.value = "找不到这套试卷，请从考试目录重新选择。";
    return;
  }
  const selection = await loadCourseLessonFromPath({
    course: catalogPaper.course,
    id: catalogPaper.id,
    path: catalogPaper.path,
    title: catalogPaper.title,
  });
  applyCourseLessonSelection(selection);
  setActiveView("study");
}

async function openExamWordSource(record: ExamWordEncounterRecord): Promise<void> {
  await loadExamCatalog();
  const paper = examPaperFor(record.course, record.lessonId);
  if (paper) await openExamPaper(paper);
}

function examPaperStatus(paper: ExamPaper): "not-started" | ExamProgressStatus {
  return examProgressByKey.value.get(`${paper.course}:${paper.id}`)?.status ?? "not-started";
}

async function markExamPaperCompleted(paper: ExamPaper): Promise<void> {
  try {
    await setExamProgressCompleted(paper.course, paper.id, paper.title);
    await reloadExamData();
  } catch (error) {
    console.warn("Unable to complete exam paper", error);
    examStorageAvailable.value = false;
  }
}

async function resetExamPaper(paper: ExamPaper): Promise<void> {
  try {
    await resetExamProgress(paper.course, paper.id);
    await reloadExamData();
  } catch (error) {
    console.warn("Unable to reset exam progress", error);
    examStorageAvailable.value = false;
  }
}

async function setExamWordReviewState(record: ExamWordEncounterRecord, reviewState: ExamReviewState): Promise<void> {
  try {
    await updateExamWordEncounter({ key: record.key, reviewState });
    await reloadExamData();
  } catch (error) {
    console.warn("Unable to update exam word", error);
    examStorageAvailable.value = false;
  }
}

function toggleExamWordReveal(record: ExamWordEncounterRecord): void {
  revealedExamWordKey.value = revealedExamWordKey.value === record.key ? "" : record.key;
}

function chooseExamDataImportFile(): void {
  examDataImportInput.value?.click();
}

async function exportCompleteLearningData(): Promise<void> {
  examDataFeedback.value = "";
  try {
    const data = await exportCompleteLearningDataJson();
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `wordtap-learning-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }, 0);
    examDataFeedback.value = "学习数据已导出。";
    status.value = "已导出完整学习数据。";
  } catch (error) {
    console.warn("Unable to export learning data", error);
    examDataFeedback.value = "学习数据导出失败，请稍后重试。";
    status.value = "学习数据导出失败，请稍后重试。";
  }
}

async function importCompleteLearningData(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || examDataImporting.value) return;
  examDataImporting.value = true;
  examDataFeedback.value = "";
  try {
    const result = await importCompleteLearningDataJson(await file.text());
    await Promise.all([reloadHistory(), reloadExamData()]);
    examDataFeedback.value = `已导入 ${result.words} 个单词、${result.examProgress} 条进度和 ${result.examWords} 条考试生词。`;
    status.value = `已导入 ${result.words} 个单词、${result.examProgress} 条进度和 ${result.examWords} 条考试生词。`;
  } catch (error) {
    console.warn("Unable to import learning data", error);
    examDataFeedback.value = error instanceof Error ? error.message : "学习数据导入失败。";
    status.value = error instanceof Error ? error.message : "学习数据导入失败。";
  } finally {
    examDataImporting.value = false;
  }
}

function learnedClassForWord(word: string): string {
  if (!markLearned.value || !learnedWordKeys.value.has(normalizeHistoryWord(word))) {
    return "bg-transparent";
  }
  return "study-word-learned";
}

function cancelLookup(): void {
  lookupRunId.value += 1;
  lookupAbortController?.abort();
  lookupAbortController = null;
}

function showWordPopover(word: string, event: MouseEvent): void {
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const rect = target?.getBoundingClientRect();
  const mobile = mobileBrowser.value || isNarrowLayoutViewport();
  const pad = 16;
  const popW = Math.min(256, window.innerWidth - pad * 2);
  const gap = 8;

  // 锚点：单词左侧 X，单词底部 Y
  const anchorX = rect ? rect.left : window.innerWidth / 2;
  const anchorY = rect ? rect.bottom : window.innerHeight * 0.28;

  // 水平：左边缘贴近单词左边缘，clamp 到视口内
  const left = Math.round(Math.min(Math.max(anchorX, pad), window.innerWidth - popW - pad));

  // 释义限 5 行，高度可预测：word(~22px) + meaning(5行~112px) + padding(~20px) ≈ 160px
  const popH = 160;

  let top: number;
  if (rect && anchorY + gap + popH > window.innerHeight - pad) {
    // 下方放不下，显示到上方
    top = Math.round(rect.top - popH - 12);
  } else {
    // 下方
    top = Math.round(anchorY + gap);
  }
  top = Math.max(pad, Math.min(top, window.innerHeight - popH - pad));

  wordPopoverAnchorX = event.clientX || anchorX;
  wordPopoverAnchorY = event.clientY || anchorY;
  wordPopover.value = {
    visible: true,
    word,
    meaning: copy.lookup.loadingMeaning,
    status: "loading",
    x: left,
    y: top,
    mobile,
  };
}

function handleWordPopoverMouseMove(event: MouseEvent): void {
  if (!wordPopover.value.visible || wordPopover.value.mobile) {
    return;
  }

  if (event.target instanceof HTMLElement && event.target.closest(".study-word-popover")) {
    return;
  }

  const deltaX = event.clientX - wordPopoverAnchorX;
  const deltaY = event.clientY - wordPopoverAnchorY;
  if (Math.hypot(deltaX, deltaY) > 260) {
    hideWordPopover();
  }
}

function updateWordPopover(word: string, meaningText: string, missing: boolean): void {
  if (!wordPopover.value.visible || normalizeWord(wordPopover.value.word) !== normalizeWord(word)) {
    return;
  }

  wordPopover.value = {
    ...wordPopover.value,
    meaning: meaningText,
    status: missing ? "missing" : "ready",
  };
}

function hideWordPopover(): void {
  if (!wordPopover.value.visible) {
    return;
  }
  wordPopover.value = {
    ...wordPopover.value,
    visible: false,
  };
}

function hideReviewContextMenu(): void {
  if (!reviewContextMenu.value.visible) {
    return;
  }
  reviewContextMenu.value = {
    ...reviewContextMenu.value,
    visible: false,
  };
}

function handlePopoverKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideWordPopover();
    hideReviewContextMenu();
  }
}

function cleanDictionaryText(text?: string): string {
  return (text ?? "").replace(/\\n/g, "\n").trim();
}

function queryVariants(word: string): string[] {
  const normalized = normalizeWord(word);
  const simple = normalized.replace(/[^a-z0-9]/g, "");
  return Array.from(new Set([word, normalized, simple].map((item) => normalizeWord(item)).filter(Boolean)));
}

function formatEntry(entry: DictionaryEntry): string {
  const phonetic = cleanDictionaryText(entry.phonetic);
  const translation = cleanDictionaryText(entry.translation);
  const definition = cleanDictionaryText(entry.definition);
  const pieces: string[] = [];

  if (phonetic) {
    pieces.push(`[${phonetic}]`);
  }
  if (translation) {
    pieces.push(translation);
  } else if (definition) {
    pieces.push(definition);
  }

  return pieces.join("\n").trim();
}

async function reloadHistory(options: { preserveReviewScroll?: boolean } = {}): Promise<void> {
  const runId = (historyLoadRunId += 1);
  const previousScrollTop = options.preserveReviewScroll ? reviewList.value?.scrollTop : undefined;
  try {
    const records = await listStudyHistory();
    if (runId !== historyLoadRunId) {
      return;
    }
    historyRecords.value = records;
    if (selectedReviewKey.value && !records.some((record) => record.key === selectedReviewKey.value)) {
      selectedReviewKey.value = "";
    }
    restoreReviewScroll(previousScrollTop, runId);
  } catch (error) {
    if (runId !== historyLoadRunId) {
      return;
    }
    console.warn("Unable to load study history", error);
    status.value = copy.status.historyUnavailable;
  }
}

async function reloadTextHistory(): Promise<void> {
  const runId = (textHistoryLoadRunId += 1);
  try {
    const records = await listStudyTexts();
    if (runId !== textHistoryLoadRunId) {
      return;
    }
    textHistoryRecords.value = records;
    if (selectedTextHistoryId.value && !records.some((record) => record.id === selectedTextHistoryId.value)) {
      selectedTextHistoryId.value = "";
    }
  } catch (error) {
    if (runId !== textHistoryLoadRunId) {
      return;
    }
    console.warn("Unable to load text history", error);
    status.value = copy.status.textHistoryUnavailable;
  }
}

function restoreReviewScroll(previousScrollTop: number | undefined, runId: number): void {
  if (previousScrollTop === undefined || activeView.value !== "review") {
    return;
  }
  requestAnimationFrame(() => {
    if (runId !== historyLoadRunId || !reviewList.value) {
      return;
    }
    reviewList.value.scrollTop = Math.min(previousScrollTop, reviewList.value.scrollHeight);
  });
}

function hydrateSourceText(text: string): void {
  if (sourceTextHydrationTimer !== null) {
    window.clearTimeout(sourceTextHydrationTimer);
  }
  sourceTextHydrating = true;
  sourceText.value = text;
  sourceTextHydrationTimer = window.setTimeout(() => {
    sourceTextHydrationTimer = null;
    sourceTextHydrating = false;
  }, 0);
}

function appRootUrl(): URL {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const sectionIndex = parts.findIndex((part) => part === "exam" || part === "nce" || part === "shuimu" || part === "postgraduate" || part === "pep-english" || part === "college-english" || part === "cet" || part === "kaoyan-english");
  const baseParts = sectionIndex >= 0 ? parts.slice(0, sectionIndex) : parts;
  const lastPart = baseParts.at(-1) ?? "";
  const directoryParts = lastPart.includes(".") ? baseParts.slice(0, -1) : baseParts;
  const basePath = `/${directoryParts.join("/")}${directoryParts.length ? "/" : ""}`;
  return new URL(basePath, window.location.origin);
}

function buildLessonUrl(course: CourseId, id: string): string {
  return buildLessonShortUrl(appRootUrl(), course, id);
}

function makeActiveCourseLesson(selection: Omit<CourseLessonSelection, "text">): ActiveCourseLesson {
  return {
    ...selection,
    code: lessonShortCode(selection.course, selection.id),
    url: buildLessonUrl(selection.course, selection.id),
  };
}

function replaceBrowserLessonUrl(course: CourseId, id: string): void {
  const nextUrl = new URL(buildLessonUrl(course, id));
  window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function clearBrowserLessonUrl(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.has("l")) {
    url.searchParams.delete("l");
    const search = url.searchParams.toString();
    window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  }
}

function setActiveCourseLesson(selection: Omit<CourseLessonSelection, "text">, text: string): void {
  activeCourseLesson.value = makeActiveCourseLesson(selection);
  activeCourseLessonTextSnapshot = text.trim();
  lessonShareUrlCopied.value = false;
}

function clearActiveCourseLesson(options: { clearUrl?: boolean } = {}): void {
  activeCourseLesson.value = null;
  activeCourseLessonTextSnapshot = "";
  lessonShareUrlCopied.value = false;
  if (options.clearUrl) {
    clearBrowserLessonUrl();
  }
}

async function copyActiveCourseLessonUrl(): Promise<void> {
  const lesson = activeCourseLesson.value;
  if (!lesson) {
    return;
  }

  try {
    await window.navigator.clipboard.writeText(lesson.url);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = lesson.url;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  lessonShareUrlCopied.value = true;
  status.value = "已复制当前文章链接。";
  if (lessonShareCopiedTimer !== null) {
    window.clearTimeout(lessonShareCopiedTimer);
  }
  lessonShareCopiedTimer = window.setTimeout(() => {
    lessonShareCopiedTimer = null;
    lessonShareUrlCopied.value = false;
  }, 1800);
}

function parseShortLessonFromUrl(): { course: CourseId; id: string } | null {
  return parseLessonShortCode(new URLSearchParams(window.location.search).get("l") ?? "");
}

async function lessonSelectionFromShortUrl(
  shortLesson: { course: CourseId; id: string },
): Promise<Omit<CourseLessonSelection, "text"> | null> {
  if (shortLesson.course === "nce") {
    const manifest = await loadNceManifest();
    for (const book of manifest.books) {
      const lesson = book.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return {
          course: "nce",
          id: lesson.id,
          path: lesson.jsonPath,
          title: `${book.title} L${lesson.lessonNo} ${lesson.titleZh} ${lesson.title}`,
        };
      }
    }
    return null;
  }

  if (shortLesson.course === "shuimu") {
    const manifest = await loadShuimuManifest();
    for (const level of manifest.levels) {
      const lesson = level.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return {
          course: "shuimu",
          id: lesson.id,
          path: lesson.jsonPath,
          title: `${level.title} 第 ${lesson.unitNo} 单元 ${lesson.title}`,
        };
      }
    }
    return null;
  }

  if (shortLesson.course === "postgraduate") {
    const manifest = await loadPostgraduateManifest();
    for (const volume of manifest.volumes) {
      const lesson = volume.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return {
          course: "postgraduate",
          id: lesson.id,
          path: lesson.jsonPath,
          title: `${volume.title} 第 ${lesson.unitNo} 单元 ${lesson.title}`,
        };
      }
    }
    return null;
  }

  if (shortLesson.course === "pep-english") {
    const manifest = await loadPepEnglishManifest();
    for (const group of manifest.groups) {
      const lesson = group.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return {
          course: "pep-english",
          id: lesson.id,
          path: lesson.jsonPath,
          title: `${group.stageTitle}${group.title} · ${lesson.section} · ${lesson.title}`,
        };
      }
    }
    return null;
  }

  if (shortLesson.course === "cet") {
    const manifest = await loadCetManifest();
    for (const group of manifest.groups) {
      const lesson = group.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return { course: "cet", id: lesson.id, path: lesson.jsonPath, title: lesson.title };
      }
    }
    return null;
  }

  if (shortLesson.course === "kaoyan-english") {
    const manifest = await loadKaoyanEnglishManifest();
    for (const group of manifest.groups) {
      const lesson = group.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
      if (lesson) {
        return { course: "kaoyan-english", id: lesson.id, path: lesson.jsonPath, title: lesson.title };
      }
    }
    return null;
  }

  const manifest = await loadCollegeEnglishManifest();
  for (const group of manifest.groups) {
    const lesson = group.lessons.find((item) => item.id.toLowerCase() === shortLesson.id);
    if (lesson) {
      return {
        course: "college-english",
        id: lesson.id,
        path: lesson.jsonPath,
        title: `${group.title} · Unit ${lesson.unitNo} · Section ${lesson.section} · ${lesson.title}`,
      };
    }
  }

  return null;
}

async function initializeSourceText(): Promise<void> {
  const injected = await initializeCourseLessonFromUrl();
  if (injected) {
    return;
  }

  try {
    const latest = await latestStudyText();
    if (latest) {
      hydrateSourceText(latest.text);
      clearActiveCourseLesson();
      startupExampleActive = false;
      sourceTextTouched = false;
      selectedTextHistoryId.value = latest.id;
      lastAutoSavedText = latest.text.trim();
      status.value = copy.status.restoredLatestArticle(latest.title);
      splitWords({ recordTextHistory: false });
      return;
    }
  } catch (error) {
    console.warn("Unable to restore latest text", error);
  }

  const runCount = readDefaultTextRunCount();
  if (runCount < defaultTextRunLimit) {
    hydrateSourceText(defaultText);
    clearActiveCourseLesson();
    startupExampleActive = true;
    bumpDefaultTextRunCount(runCount);
    status.value = copy.status.exampleLoaded;
  } else {
    hydrateSourceText("");
    clearActiveCourseLesson();
    startupExampleActive = false;
    status.value = copy.status.readyToPaste;
  }
  sourceTextTouched = false;
  lastAutoSavedText = "";
  splitWords({ recordTextHistory: false });
}

async function loadCourseLessonFromPath(selection: Omit<CourseLessonSelection, "text">): Promise<CourseLessonSelection> {
  if (selection.course === "nce") {
    const detail = await loadNceLesson(selection.path);
    const title = selection.title || `Book ${detail.bookNo} Lesson ${detail.lessonNo} ${detail.title}`;
    return {
      course: "nce",
      id: detail.id,
      path: selection.path,
      title,
      text: withReadingTitle(
        `Book ${detail.bookNo} Lesson ${detail.lessonNo} ${detail.title}`,
        formatLineStructuredTextForReading(detail.text),
      ),
    };
  }

  if (selection.course === "shuimu") {
    const detail = await loadShuimuLesson(selection.path);
    const title = selection.title || `水木英语 第 ${detail.unitNo} 单元 ${detail.title}`;
    return {
      course: "shuimu",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: withReadingTitle(title, formatShuimuForReading(detail.blocks, detail.text)),
    };
  }

  if (selection.course === "pep-english") {
    const detail = await loadPepEnglishLesson(selection.path);
    const title = selection.title || `${detail.section} · ${detail.title}`;
    return {
      course: "pep-english",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: withReadingTitle(title, formatProseForReading(detail.blocks, detail.text)),
    };
  }

  if (selection.course === "college-english") {
    const detail = await loadCollegeEnglishLesson(selection.path);
    const title = selection.title || `新视野大学英语 Unit ${detail.unitNo} · Section ${detail.section} · ${detail.title}`;
    return {
      course: "college-english",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: withReadingTitle(title, formatProseForReading(detail.blocks, detail.text)),
    };
  }

  if (selection.course === "cet") {
    const detail = await loadCetLesson(selection.path);
    const title = selection.title || detail.title;
    return {
      course: "cet",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: withReadingTitle(title, formatProseForReading(detail.blocks, detail.text)),
    };
  }

  if (selection.course === "kaoyan-english") {
    const detail = await loadKaoyanEnglishLesson(selection.path);
    const title = selection.title || detail.title;
    return {
      course: "kaoyan-english",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: withReadingTitle(title, formatProseForReading(detail.blocks, detail.text)),
    };
  }

  const detail = await loadPostgraduateLesson(selection.path);
  const articleLabel = detail.textLabel ? ` · ${detail.textLabel}` : "";
  const authorLabel = detail.author ? ` · ${detail.author}` : "";
  const title = selection.title || `研究生英语 第 ${detail.unitNo} 单元${articleLabel} ${detail.title}`;
  return {
    course: "postgraduate",
    id: detail.id,
    path: detail.jsonPath,
    title,
    text: withReadingTitle(`${title}${authorLabel}`, formatProseForReading(detail.blocks, detail.text)),
  };
}

function applyCourseLessonSelection(selection: CourseLessonSelection, options: { updateUrl?: boolean } = {}): void {
  hydrateSourceText(selection.text);
  setActiveCourseLesson(selection, selection.text);
  startupExampleActive = false;
  sourceTextTouched = false;
  selectedTextHistoryId.value = "";
  lastAutoSavedText = selection.text.trim();
  status.value = `已载入：${selection.title}`;
  splitWords({ recordTextHistory: false });
  if (options.updateUrl ?? true) {
    replaceBrowserLessonUrl(selection.course, selection.id);
  }
  void trackExamOpen(selection);
}

async function loadCourseLessonSelection(selection: CourseLessonSelection): Promise<void> {
  applyCourseLessonSelection(selection);
  setActiveView("study");
}

async function initializeCourseLessonFromUrl(): Promise<boolean> {
  const shortLesson = parseShortLessonFromUrl();
  if (!shortLesson) {
    return false;
  }

  try {
    const shortSelection = await lessonSelectionFromShortUrl(shortLesson);
    if (shortSelection) {
      const selection = await loadCourseLessonFromPath(shortSelection);
      applyCourseLessonSelection(selection, { updateUrl: false });
      return true;
    }
    status.value = "课程链接无法识别，请从课程目录重新选择。";
    return true;
  } catch (error) {
    console.warn("Unable to load lesson from short URL", error);
    status.value = "课程链接暂时无法打开，请从课程目录重新选择。";
    return true;
  }
}

async function saveCurrentTextHistory(options: { announce?: boolean } = {}): Promise<boolean> {
  const announce = options.announce ?? true;
  const text = sourceText.value.trim();
  if (!text) {
    if (announce) {
      status.value = copy.status.noArticleToSave;
    }
    return false;
  }
  if (!announce && startupExampleActive && !sourceTextTouched && text === defaultText.trim()) {
    return false;
  }
  if (!announce && suppressedTextHistoryText && text === suppressedTextHistoryText) {
    return false;
  }
  if (suppressedTextHistoryText && text !== suppressedTextHistoryText) {
    suppressedTextHistoryText = "";
  }

  try {
    const record = await recordStudyText(text);
    await reloadTextHistory();
    if (record) {
      selectedTextHistoryId.value = record.id;
      suppressedTextHistoryText = "";
      lastAutoSavedText = text;
      if (announce) {
        status.value = copy.status.articleSaved(record.title);
      }
    }
    return Boolean(record);
  } catch (error) {
    console.warn("Unable to save text history", error);
    if (announce) {
      status.value = error instanceof Error ? error.message : copy.status.articleSaveFailed;
    }
    return false;
  }
}

function clearScheduledTextHistorySave(): void {
  if (textHistorySaveTimer === null) {
    return;
  }
  window.clearTimeout(textHistorySaveTimer);
  textHistorySaveTimer = null;
}

function scheduleTextHistorySaveAfterSplit(textSnapshot: string): void {
  clearScheduledTextHistorySave();
  if (!textSnapshot || textSnapshot === lastAutoSavedText) {
    return;
  }

  textHistorySaveTimer = window.setTimeout(() => {
    textHistorySaveTimer = null;
    if (sourceText.value.trim() !== textSnapshot || textSnapshot === lastAutoSavedText) {
      return;
    }
    void saveCurrentTextHistory({ announce: false }).then((saved) => {
      if (saved) {
        lastAutoSavedText = textSnapshot;
      }
    });
  }, UI_TEXT_HISTORY_SAVE_DEBOUNCE);
}

function loadTextHistoryRecord(): void {
  const record = textHistoryRecords.value.find((item) => item.id === selectedTextHistoryId.value);
  if (!record) {
    return;
  }

  cancelWordSpeech();
  hideWordPopover();
  cancelLookup();
  suppressedTextHistoryText = "";
  hydrateSourceText(record.text);
  clearActiveCourseLesson({ clearUrl: true });
  startupExampleActive = false;
  sourceTextTouched = false;
  lastAutoSavedText = record.text.trim();
  currentWord.value = copy.state.currentWordEmpty;
  meaning.value = copy.state.meaningHint;
  status.value = copy.status.articleLoaded(record.title);
  splitWords({ announce: true, recordTextHistory: false });
  void saveCurrentTextHistory({ announce: false });
}

async function deleteSelectedTextHistoryRecord(): Promise<void> {
  const record = textHistoryRecords.value.find((item) => item.id === selectedTextHistoryId.value);
  if (!record) {
    status.value = copy.status.selectSavedArticleFirst;
    return;
  }
  if (!window.confirm(copy.status.deleteArticleConfirm(record.title))) {
    return;
  }

  try {
    clearScheduledTextHistorySave();
    await deleteStudyTextRecord(record.id);
    if (sourceText.value.trim() === record.text.trim()) {
      suppressedTextHistoryText = record.text.trim();
      lastAutoSavedText = record.text.trim();
      clearActiveCourseLesson({ clearUrl: true });
    }
    selectedTextHistoryId.value = "";
    await reloadTextHistory();
    status.value = copy.status.articleDeleted(record.title);
  } catch (error) {
    console.warn("Unable to delete text history", error);
    status.value = error instanceof Error ? error.message : copy.status.articleDeleteFailed;
  }
}

async function deleteHistoryRecord(record: StudyHistoryRecord): Promise<void> {
  hideReviewContextMenu();
  if (selectedReviewKey.value === record.key) {
    selectedReviewKey.value = "";
  }
  await deleteStudyHistoryRecord(record.key);
  await reloadHistory({ preserveReviewScroll: true });
  status.value = copy.status.wordDeleted(record.word);
}

async function refreshReviewRecords(): Promise<void> {
  hideReviewContextMenu();
  await reloadHistory({ preserveReviewScroll: true });
  status.value = copy.status.wordListRefreshed;
}

function exportReviewRecords(): void {
  if (!historyRecords.value.length) {
    status.value = copy.status.noWordsToExport;
    return;
  }

  const blob = new Blob([exportStudyHistoryJson(historyRecords.value)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `wordtap-study-history-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  status.value = copy.status.wordsExported(historyRecords.value.length);
}

function chooseHistoryImportFile(): void {
  historyImportInput.value?.click();
}

async function importReviewRecords(event: Event): Promise<void> {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file || historyImporting.value) {
    return;
  }

  historyImporting.value = true;
  try {
    const importedCount = await importStudyHistoryJson(await file.text());
    await reloadHistory({ preserveReviewScroll: true });
    status.value = copy.status.wordsImported(importedCount);
  } catch (error) {
    console.warn("Unable to import study history", error);
    status.value = error instanceof Error ? error.message : copy.status.wordsImportFailed;
  } finally {
    historyImporting.value = false;
    if (input) {
      input.value = "";
    }
  }
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function selectReviewRecord(record: StudyHistoryRecord): void {
  cancelLookup();
  hideWordPopover();
  selectedReviewKey.value = record.key;
  currentWord.value = record.word;
  meaning.value = record.meaning || copy.lookup.wordWithoutMeaning;
  status.value = copy.status.wordSelected(record.word);
}

function showReviewContextMenu(record: StudyHistoryRecord, event: MouseEvent): void {
  event.preventDefault();
  showReviewContextMenuAt(record, event.clientX, event.clientY);
}

function showReviewContextMenuAt(record: StudyHistoryRecord, x: number, y: number): void {
  selectReviewRecord(record);
  hideWordPopover();
  const menuWidth = 150;
  const menuHeight = 92;
  reviewContextMenu.value = {
    visible: true,
    key: record.key,
    x: Math.round(Math.min(Math.max(x, 12), window.innerWidth - menuWidth - 12)),
    y: Math.round(Math.min(Math.max(y, 12), window.innerHeight - menuHeight - 12)),
  };
}

function handleReviewRowKeydown(event: KeyboardEvent, record: StudyHistoryRecord): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  selectReviewRecord(record);
}

function speakHistoryRecord(record: StudyHistoryRecord): void {
  hideReviewContextMenu();
  selectReviewRecord(record);
  speakWord(record.word, record.word);
}

function speakReviewContextRecord(): void {
  const record = reviewContextRecord.value;
  if (!record) {
    hideReviewContextMenu();
    return;
  }
  speakHistoryRecord(record);
}

async function deleteReviewContextRecord(): Promise<void> {
  const record = reviewContextRecord.value;
  hideReviewContextMenu();
  if (!record) {
    return;
  }
  await deleteHistoryRecord(record);
}

function refreshVoices(): void {
  if (!isBrowserSpeechSupported()) {
    return;
  }
  availableVoices.value = window.speechSynthesis.getVoices();
  reconcileBrowserVoiceSelection();
}

function reconcileBrowserVoiceSelection(): void {
  if (!selectedBrowserVoiceUri.value || !browserVoiceOptions.value.length) {
    return;
  }
  if (browserVoiceOptions.value.some((voice) => voice.voiceURI === selectedBrowserVoiceUri.value)) {
    return;
  }
  selectedBrowserVoiceUri.value = "";
}

async function loadManifest(): Promise<void> {
  if (manifestPromise) {
    return manifestPromise;
  }

  manifestPromise = loadManifestOnce();
  return manifestPromise;
}

async function loadManifestOnce(): Promise<void> {
  try {
    const response = await fetchWithTimeout(appAssetUrl("dict/manifest.json"), { cache: "no-cache" }, DICTIONARY_FETCH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    manifest.value = (await response.json()) as DictionaryManifest;
    availableShardNames.value = new Set(manifest.value.shardNames ?? []);
    dictionaryInfo.value = formatDictionaryStatus(manifest.value);
  } catch {
    manifestPromise = null;
    dictionaryInfo.value = copy.dictionary.unavailable;
  }
}

function formatDictionaryStatus(_nextManifest: DictionaryManifest): string {
  return "";
}

function diagnosticStatusText(value: DiagnosticStatus): string {
  const labels: Record<DiagnosticStatus, string> = {
    pending: copy.diagnostics.statuses.pending,
    ok: copy.diagnostics.statuses.ok,
    warn: copy.diagnostics.statuses.warn,
    fail: copy.diagnostics.statuses.fail,
  };
  return labels[value];
}

function diagnosticStatusClass(value: DiagnosticStatus): string {
  return `study-diagnostic-status-${value}`;
}

function updateDiagnosticItem(next: DiagnosticItem): void {
  diagnostics.value = diagnostics.value.map((item) => (item.id === next.id ? next : item));
}

async function runDiagnostics(): Promise<void> {
  if (diagnosticsRunning.value) {
    return;
  }

  diagnosticsRunning.value = true;
  diagnosticsUpdatedAt.value = "";
  const checks = diagnosticChecks();
  diagnostics.value = checks.map((check) => ({
    id: check.id,
    label: check.label,
    status: "pending",
    detail: copy.diagnostics.waiting,
  }));
  status.value = copy.status.diagnosticsRunning;

  const results = await Promise.allSettled(
    checks.map(async (check) => {
      try {
        return await check.run();
      } catch (error) {
        if (check.id === "gateway-status") {
          isGatewayRunning.value = false;
        }
        return {
          id: check.id,
          label: check.label,
          status: "fail" as const,
          detail: formatDiagnosticError(error),
        } satisfies DiagnosticItem;
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      updateDiagnosticItem(result.value);
    }
  }

  diagnosticsRunning.value = false;
  diagnosticsUpdatedAt.value = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  status.value = copy.status.diagnosticsDone(diagnosticsSummary.value);
}

function diagnosticChecks(): Array<{ id: string; label: string; run: () => Promise<DiagnosticItem> }> {
  return [
    {
      id: "browser-speech",
      label: copy.diagnostics.labels.browserSpeech,
      run: async () => {
        if (!isBrowserSpeechSupported()) {
          return diagnostic("browser-speech", copy.diagnostics.labels.browserSpeech, "warn", copy.diagnostics.browserSpeechUnsupported);
        }
        const englishVoiceCount = browserVoiceOptions.value.length;
        return diagnostic(
          "browser-speech",
          copy.diagnostics.labels.browserSpeech,
          "ok",
          copy.diagnostics.browserSpeechReady(englishVoiceCount),
        );
      },
    },
    {
      id: "indexeddb",
      label: copy.diagnostics.labels.studyRecords,
      run: async () => {
        await Promise.all([listStudyHistory(), listStudyTexts(), getCachedTranslation("english")]);
        return diagnostic("indexeddb", copy.diagnostics.labels.studyRecords, "ok", copy.diagnostics.studyRecordsReady);
      },
    },
    {
      id: "translation-cache",
      label: copy.diagnostics.labels.translationCache,
      run: checkTranslationCache,
    },
    {
      id: "local-storage",
      label: copy.diagnostics.labels.readingSettings,
      run: async () => {
        const key = "wordtap.diagnostics.probe";
        window.localStorage.setItem(key, "1");
        window.localStorage.removeItem(key);
        return diagnostic("local-storage", copy.diagnostics.labels.readingSettings, "ok", copy.diagnostics.readingSettingsReady);
      },
    },
    {
      id: "dictionary-manifest",
      label: copy.diagnostics.labels.dictionary,
      run: checkDictionaryManifest,
    },
    {
      id: "dictionary-shard",
      label: copy.diagnostics.labels.chineseMeaning,
      run: checkDictionaryShard,
    },
    {
      id: "gateway-status",
      label: copy.diagnostics.labels.fullTextSpeech,
      run: checkGatewayStatus,
    },
    {
      id: "gateway-capabilities",
      label: copy.diagnostics.labels.speechAndLookup,
      run: checkGatewayCapabilities,
    },
    {
      id: "edge-tts-recipe",
      label: copy.diagnostics.labels.speechAudio,
      run: checkEdgeTtsRecipe,
    },
    {
      id: "baidu-recipe",
      label: copy.diagnostics.labels.onlineLookup,
      run: checkBaiduRecipe,
    },
    {
      id: "gateway-release",
      label: copy.diagnostics.labels.gateway,
      run: checkGatewayReleaseManifest,
    },
    {
      id: "gateway-download",
      label: copy.diagnostics.labels.gatewayDownload,
      run: () => checkHeadUrl("gateway-download", copy.diagnostics.labels.gatewayDownload, gatewayDownloadUrl),
    },
    {
      id: "windows-download",
      label: copy.diagnostics.labels.windowsDownload,
      run: () => checkHeadUrl(
        "windows-download",
        copy.diagnostics.labels.windowsDownload,
        wordTapWindowsDownloadUrl,
        NETWORK_LARGE_DOWNLOAD_HEAD_PROBE,
      ),
    },
    {
      id: "storage-estimate",
      label: copy.diagnostics.labels.studyRecordStorage,
      run: checkStorageEstimate,
    },
    {
      id: "audio-cache",
      label: copy.diagnostics.labels.savedAudio,
      run: checkAudioCache,
    },
  ];
}

function diagnostic(id: string, label: string, statusValue: DiagnosticStatus, detail: string): DiagnosticItem {
  return {
    id,
    label,
    status: statusValue,
    detail,
  };
}

function formatDiagnosticError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return copy.diagnostics.timeout;
  }
  if (error instanceof TypeError) {
    return copy.diagnostics.gatewayDisconnected;
  }
  if (error instanceof Error && /^HTTP\s+\d+/.test(error.message)) {
    return copy.diagnostics.urlUnavailable;
  }
  return error instanceof Error ? error.message : copy.diagnostics.failed;
}

async function checkDictionaryManifest(): Promise<DiagnosticItem> {
  const nextManifest = await fetchJsonWithTimeout<DictionaryManifest>(appAssetUrl("dict/manifest.json"), DICTIONARY_FETCH);
  manifest.value = nextManifest;
  availableShardNames.value = new Set(nextManifest.shardNames ?? []);
  if (!nextManifest.entryCount || !nextManifest.shardCount) {
    return diagnostic("dictionary-manifest", copy.diagnostics.labels.dictionary, "warn", copy.diagnostics.dictionaryIncomplete);
  }
  return diagnostic(
    "dictionary-manifest",
    copy.diagnostics.labels.dictionary,
    "ok",
    copy.diagnostics.dictionaryReady,
  );
}

async function checkDictionaryShard(): Promise<DiagnosticItem> {
  const currentManifest = manifest.value ?? (await fetchJsonWithTimeout<DictionaryManifest>(appAssetUrl("dict/manifest.json"), DICTIONARY_FETCH));
  const shardName = currentManifest.shardNames?.includes("a") ? "a" : currentManifest.shardNames?.[0];
  if (!shardName) {
    return diagnostic("dictionary-shard", copy.diagnostics.labels.chineseMeaning, "fail", copy.diagnostics.chineseMeaningUnknown);
  }
  const fileName = currentManifest.shardFiles?.[shardName] ?? `shard-${shardName}.json`;
  const shard = await fetchJsonWithTimeout<DictionaryShard>(appAssetUrl(`dict/shards/${fileName}`), DICTIONARY_FETCH);
  const entryCount = Object.keys(shard).length;
  return entryCount
    ? diagnostic("dictionary-shard", copy.diagnostics.labels.chineseMeaning, "ok", copy.diagnostics.chineseMeaningReady)
    : diagnostic("dictionary-shard", copy.diagnostics.labels.chineseMeaning, "warn", copy.diagnostics.chineseMeaningMissing);
}

async function checkGatewayStatus(): Promise<DiagnosticItem> {
  const response = await fetchWithTimeout(`${localGatewayBaseUrl}/v1/status`, { cache: "no-store" }, GATEWAY_DIAGNOSTIC_STATUS);
  if (!response.ok) {
    isGatewayRunning.value = false;
    return diagnostic("gateway-status", copy.diagnostics.labels.fullTextSpeech, "fail", copy.diagnostics.fullTextSpeechFailed);
  }
  isGatewayRunning.value = true;
  await response.json();
  return diagnostic("gateway-status", copy.diagnostics.labels.fullTextSpeech, "ok", copy.diagnostics.fullTextSpeechReady);
}

async function checkGatewayCapabilities(): Promise<DiagnosticItem> {
  const payload = await fetchJsonWithTimeout<GatewayCapabilitiesPayload>(`${localGatewayBaseUrl}/v1/capabilities`, GATEWAY_DIAGNOSTIC_CAPABILITIES);
  const endpoints = payload.endpoints ?? [];
  const hasSpeech = endpoints.includes("POST /v1/recipes/speech");
  const hasBaidu = endpoints.includes("POST /v1/recipes/baidu-sug");
  if (!hasSpeech || !hasBaidu) {
    return diagnostic("gateway-capabilities", copy.diagnostics.labels.speechAndLookup, "warn", copy.diagnostics.gatewayCapabilitiesPartial);
  }
  return diagnostic("gateway-capabilities", copy.diagnostics.labels.speechAndLookup, "ok", copy.diagnostics.gatewayCapabilitiesReady);
}

async function checkBaiduRecipe(): Promise<DiagnosticItem> {
  const response = await fetchWithTimeout(
    `${localGatewayBaseUrl}/v1/recipes/baidu-sug`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "example" }),
    },
    GATEWAY_DIAGNOSTIC_TRANSLATE,
  );
  if (!response.ok) {
    return diagnostic("baidu-recipe", copy.diagnostics.labels.onlineLookup, "warn", copy.diagnostics.onlineLookupNoResult);
  }
  const payload = (await response.json()) as { meaning?: string };
  return payload.meaning
    ? diagnostic("baidu-recipe", copy.diagnostics.labels.onlineLookup, "ok", copy.diagnostics.onlineLookupReady)
    : diagnostic("baidu-recipe", copy.diagnostics.labels.onlineLookup, "warn", copy.diagnostics.onlineLookupNoMeaning);
}

async function checkEdgeTtsRecipe(): Promise<DiagnosticItem> {
  const response = await fetchWithTimeout(
    `${localGatewayBaseUrl}/v1/recipes/speech`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "test",
        voice: selectedGatewayVoice.value,
        rate: selectedRate.value,
      }),
    },
    GATEWAY_DIAGNOSTIC_SPEECH,
  );
  if (!response.ok) {
    const detail = await readResponseTextWithTimeout(response, RESPONSE_READ_ERROR_TEXT);
    return diagnostic(
      "edge-tts-recipe",
      copy.diagnostics.labels.speechAudio,
      "warn",
      detail ? copy.diagnostics.speechAudioWithDetail(detail) : copy.diagnostics.speechAudioNoDetail,
    );
  }

  const audio = await readBlobWithTimeout(response, SPEECH_READ_AUDIO_BLOB);
  if (!audio.size) {
    return diagnostic("edge-tts-recipe", copy.diagnostics.labels.speechAudio, "warn", copy.diagnostics.speechAudioRequestedNoSound);
  }
  return diagnostic(
    "edge-tts-recipe",
    copy.diagnostics.labels.speechAudio,
    "ok",
    copy.diagnostics.speechAudioReady,
  );
}

async function checkGatewayReleaseManifest(): Promise<DiagnosticItem> {
  const payload = await fetchJsonWithTimeout<{ version?: string; sha256?: string; sizeBytes?: number }>(gatewayReleaseManifestUrl, NETWORK_RELEASE_MANIFEST);
  if (!payload.sha256 || !payload.sizeBytes) {
    return diagnostic("gateway-release", copy.diagnostics.labels.gateway, "warn", copy.diagnostics.gatewayReleaseIncomplete);
  }
  return diagnostic(
    "gateway-release",
    copy.diagnostics.labels.gateway,
    "ok",
    copy.diagnostics.gatewayReleaseReady,
  );
}

async function checkHeadUrl(
  id: string,
  label: string,
  url: string,
  timeoutMs = NETWORK_HEAD_PROBE,
): Promise<DiagnosticItem> {
  const response = await fetchWithTimeout(url, { method: "HEAD", cache: "no-store" }, timeoutMs);
  if (!response.ok) {
    return diagnostic(id, label, "fail", copy.diagnostics.downloadUnavailable);
  }
  return diagnostic(id, label, "ok", copy.diagnostics.downloadReady);
}

async function checkStorageEstimate(): Promise<DiagnosticItem> {
  if (!navigator.storage?.estimate) {
    return diagnostic("storage-estimate", copy.diagnostics.labels.studyRecordStorage, "warn", copy.diagnostics.storageUnknown);
  }
  await navigator.storage.estimate();
  return diagnostic(
    "storage-estimate",
    copy.diagnostics.labels.studyRecordStorage,
    "ok",
    copy.diagnostics.storageReady,
  );
}

async function checkTranslationCache(): Promise<DiagnosticItem> {
  const stats = await translationCacheStats();
  const detail = copy.diagnostics.translationCacheSaved(stats.count);
  translationCacheSummary.value = detail;
  return diagnostic("translation-cache", copy.diagnostics.labels.translationCache, "ok", detail);
}

async function refreshTranslationCacheSummary(): Promise<void> {
  try {
    const stats = await translationCacheStats();
    translationCacheSummary.value = copy.diagnostics.translationCacheSummary(stats.count);
  } catch {
    translationCacheSummary.value = copy.diagnostics.summaryUnavailable;
  }
}

async function clearStoredTranslationCache(): Promise<void> {
  if (translationCacheClearing.value) {
    return;
  }
  translationCacheClearing.value = true;
  try {
    await clearTranslationCache();
    meaningMemoryCache.clear();
    await refreshTranslationCacheSummary();
    const cacheItem = diagnostics.value.find((item) => item.id === "translation-cache");
    if (cacheItem) {
      updateDiagnosticItem({
        ...cacheItem,
        status: "ok",
        detail: copy.diagnostics.translationCacheClearedDetail,
      });
    }
    status.value = copy.status.translationCacheCleared;
  } catch (error) {
    status.value = error instanceof Error ? error.message : copy.status.translationCacheClearFailed;
  } finally {
    translationCacheClearing.value = false;
  }
}

async function checkAudioCache(): Promise<DiagnosticItem> {
  const stats = await repairAudioCache(gatewaySpeechEngineVersion);
  const detail = copy.diagnostics.audioCacheSaved(stats.count, stats.removed);
  audioCacheSummary.value = detail;
  return diagnostic(
    "audio-cache",
    copy.diagnostics.labels.savedAudio,
    stats.totalBytes > stats.limitBytes * 0.85 ? "warn" : "ok",
    detail,
  );
}

async function refreshAudioCacheSummary(): Promise<void> {
  try {
    const stats = await audioCacheStats();
    audioCacheSummary.value = copy.diagnostics.audioCacheSummary(stats.count);
  } catch {
    audioCacheSummary.value = copy.diagnostics.summaryUnavailable;
  }
}

async function clearGatewayAudioCache(): Promise<void> {
  if (audioCacheClearing.value) {
    return;
  }
  audioCacheClearing.value = true;
  try {
    await clearAudioCache();
    await refreshAudioCacheSummary();
    const cacheItem = diagnostics.value.find((item) => item.id === "audio-cache");
    if (cacheItem) {
      updateDiagnosticItem({
        ...cacheItem,
        status: "ok",
        detail: copy.diagnostics.audioCacheClearedDetail,
      });
    }
    status.value = copy.status.audioCacheCleared;
  } catch (error) {
    status.value = error instanceof Error ? error.message : copy.status.audioCacheClearFailed;
  } finally {
    audioCacheClearing.value = false;
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const response = await fetchWithTimeout(url, { cache: "no-store" }, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(copy.diagnostics.timeout);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readBlobWithTimeout(response: Response, timeoutMs: number): Promise<Blob> {
  let timeout: number | null = null;
  try {
    return await Promise.race([
      response.blob(),
      new Promise<Blob>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(copy.diagnostics.timeout)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
  }
}

async function readResponseTextWithTimeout(response: Response, timeoutMs: number): Promise<string> {
  let timeout: number | null = null;
  try {
    const text = await Promise.race([
      response.text(),
      new Promise<string>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(copy.diagnostics.timeout)), timeoutMs);
      }),
    ]);
    return text.trim().slice(0, 140);
  } catch {
    return "";
  } finally {
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
  }
}

function shardCandidatesForWord(word: string): string[] {
  const normalized = normalizeWord(word);
  const names = availableShardNames.value;
  if (!names.size) {
    if (/^[a-z]$/.test(normalized)) {
      return [normalized];
    }
    if (/^[a-z]{2}/.test(normalized)) {
      return [normalized.slice(0, 2)];
    }
    return ["misc"];
  }

  const candidates: string[] = [];
  const maxPrefixLength = Math.min(manifest.value?.maxPrefixLength ?? normalized.length, normalized.length);
  for (let length = maxPrefixLength; length >= 1; length -= 1) {
    const prefix = normalized.slice(0, length);
    if (names.has(prefix)) {
      candidates.push(prefix);
    }
  }
  if (names.has("misc")) {
    candidates.push("misc");
  }

  return Array.from(new Set(candidates));
}

async function loadShard(name: string): Promise<DictionaryShard | null> {
  const cached = shardCache.get(name);
  if (cached) {
    return cached;
  }

  const fileName = manifest.value?.shardFiles?.[name] ?? `shard-${name}.json`;
  const version = manifest.value?.generatedAt ? `?v=${encodeURIComponent(manifest.value.generatedAt)}` : "";
  const request = fetchWithTimeout(appAssetUrl(`dict/shards/${fileName}${version}`), { cache: "force-cache" }, DICTIONARY_FETCH)
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as DictionaryShard;
    })
    .catch(() => null);

  shardCache.set(name, request);
  return request;
}

function cacheTranslation(
  word: string,
  variants: string[],
  meaningText: string,
  source: MeaningMemoryRecord["source"],
): TranslationLookup {
  const record = { meaning: meaningText, source };
  meaningMemoryCache.set(normalizeWord(word), record);
  for (const variant of variants) {
    meaningMemoryCache.set(variant, record);
  }
  return translationLookup(meaningText, source);
}

function translationLookup(
  meaningText: string,
  source: TranslationLookupSource,
): TranslationLookup {
  const sourceLabelBySource: Record<TranslationLookupSource, string> = {
    "memory-cache": copy.lookup.sourceLabels["memory-cache"],
    "translation-cache": copy.lookup.sourceLabels["translation-cache"],
    "local-dictionary": copy.lookup.sourceLabels["local-dictionary"],
    "baidu-sug": copy.lookup.sourceLabels["baidu-sug"],
    fallback: copy.lookup.sourceLabels.fallback,
    missing: copy.lookup.sourceLabels.missing,
  };
  return {
    meaning: meaningText,
    source,
    sourceLabel: sourceLabelBySource[source],
  };
}

function cacheSourceForPersistent(source: TranslationLookupSource): TranslationCacheSource {
  return source === "baidu-sug" ? "baidu-sug" : source === "fallback" ? "fallback" : "local-dictionary";
}

function persistCachedTranslation(word: string, meaningText: string, source: TranslationCacheSource): void {
  void putCachedTranslation(word, meaningText, source).catch(() => {
    // Translation cache is an optimization; lookup fallback should still work when storage is blocked.
  });
}

async function lookupCachedTranslation(word: string, variants: string[], signal?: AbortSignal): Promise<TranslationLookup> {
  for (const variant of variants) {
    const cached = meaningMemoryCache.get(variant);
    if (cached) {
      return translationLookup(cached.meaning, "memory-cache");
    }
  }

  for (const variant of variants) {
    let cached: Awaited<ReturnType<typeof getCachedTranslation>>;
    try {
      cached = await getCachedTranslation(variant);
    } catch {
      continue;
    }
    if (signal?.aborted) {
      return translationLookup(copy.lookup.missingMeaning, "missing");
    }
    if (cached?.meaning) {
      const lookup = cacheTranslation(word, variants, cached.meaning, cached.source);
      return {
        ...lookup,
        source: "translation-cache",
        sourceLabel: copy.lookup.savedSource,
      };
    }
  }

  return translationLookup(copy.lookup.missingMeaning, "missing");
}

async function lookupLocalDictionary(word: string, variants: string[], signal?: AbortSignal): Promise<TranslationLookup> {
  await loadManifest();
  if (signal?.aborted) {
    return translationLookup(copy.lookup.missingMeaning, "missing");
  }

  for (const variant of variants) {
    for (const shardName of shardCandidatesForWord(variant)) {
      const shard = await loadShard(shardName);
      if (signal?.aborted) {
        return translationLookup(copy.lookup.missingMeaning, "missing");
      }
      const entry = shard?.[variant];
      if (!entry) {
        continue;
      }

      const formatted = formatEntry(entry);
      if (formatted) {
        const lookup = cacheTranslation(word, variants, formatted, "local-dictionary");
        persistCachedTranslation(word, formatted, cacheSourceForPersistent(lookup.source));
        return lookup;
      }
    }
  }

  return translationLookup(copy.lookup.missingMeaning, "missing");
}

async function lookupOnlineTranslation(word: string, variants: string[], signal?: AbortSignal): Promise<TranslationLookup> {
  if (signal?.aborted) {
    return translationLookup(copy.lookup.missingMeaning, "missing");
  }
  const gatewayMeaning = await translateWithBaiduSugGateway(word, { signal });
  if (signal?.aborted) {
    return translationLookup(copy.lookup.missingMeaning, "missing");
  }
  if (gatewayMeaning) {
    const lookup = cacheTranslation(word, variants, gatewayMeaning, "baidu-sug");
    persistCachedTranslation(word, gatewayMeaning, "baidu-sug");
    return lookup;
  }

  return translationLookup(copy.lookup.missingMeaning, "missing");
}

function lookupFallbackDictionary(word: string, variants: string[]): TranslationLookup {
  const fallback = fallbackDictionary[normalizeWord(word)] ?? "";
  if (!fallback) {
    return translationLookup(copy.lookup.missingMeaning, "missing");
  }

  const lookup = cacheTranslation(word, variants, fallback, "fallback");
  persistCachedTranslation(word, fallback, "fallback");
  return lookup;
}

async function translateWord(word: string, signal?: AbortSignal): Promise<TranslationLookup> {
  const variants = queryVariants(word);
  const mode = selectedTranslateMode.value;

  const cachedLookup = await lookupCachedTranslation(word, variants, signal);
  if (cachedLookup.source !== "missing") {
    return cachedLookup;
  }

  if (mode === "ecdict") {
    const localLookup = await lookupLocalDictionary(word, variants, signal);
    return localLookup.source !== "missing" ? localLookup : lookupFallbackDictionary(word, variants);
  }

  if (mode === "baidu_sug") {
    const onlineLookup = await lookupOnlineTranslation(word, variants, signal);
    if (onlineLookup.source !== "missing") {
      return onlineLookup;
    }
    const localLookup = await lookupLocalDictionary(word, variants, signal);
    return localLookup.source !== "missing" ? localLookup : lookupFallbackDictionary(word, variants);
  }

  const localLookup = await lookupLocalDictionary(word, variants, signal);
  if (localLookup.source !== "missing") {
    return localLookup;
  }

  const onlineLookup = await lookupOnlineTranslation(word, variants, signal);
  if (onlineLookup.source !== "missing") {
    return onlineLookup;
  }

  return lookupFallbackDictionary(word, variants);
}

function isBrowserSpeechSupported(): boolean {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function isYoudaoSpeechSupported(): boolean {
  return "Audio" in window;
}

function isWordSpeechSupported(): boolean {
  return isBrowserSpeechSupported() || isYoudaoSpeechSupported();
}

// isProbablyMobileBrowser imported from shared/utils/device

function browserSpeechRate(): number {
  const percent = Number.parseInt(selectedRate.value, 10);
  if (Number.isNaN(percent)) {
    return 1;
  }
  return Math.min(Math.max(1 + percent / 100, 0.1), 2);
}

function cancelWordSpeech(): void {
  wordSpeechRunId.value += 1;
  if (isBrowserSpeechSupported()) {
    window.speechSynthesis.cancel();
    // Chrome workaround: cancel() 后队列可能残留，用空 utterance 冲刷
    try {
      const flush = new SpeechSynthesisUtterance("");
      flush.volume = 0;
      window.speechSynthesis.speak(flush);
      window.speechSynthesis.cancel();
    } catch {
      // 部分浏览器不支持空 utterance，忽略
    }
  }
  cancelYoudaoSpeech();
  isWordSpeaking.value = false;
}

function cancelFullTextSpeech(): void {
  fullTextSpeechRunId.value += 1;
  gatewaySpeechSession?.cancel();
  gatewaySpeechSession = null;
  // browser 降级路径也可能在播放，一并取消
  if (isBrowserSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
  isFullTextSpeaking.value = false;
}

function cancelSpeech(message?: string): void {
  cancelWordSpeech();
  cancelFullTextSpeech();
  if (message) {
    status.value = message;
  }
}

function formatSpeechError(error: unknown): string {
  if (!(error instanceof Error)) {
    return copy.speechErrors.unknown;
  }
  if (error.message.includes("user didn't interact")) {
    return copy.speechErrors.autoplayBlocked;
  }
  if (error.message.includes("not-allowed")) {
    return copy.speechErrors.playbackInterrupted;
  }
  if (error.message.includes(copy.speechErrors.gatewayNotStartedNeedle)) {
    return copy.speechErrors.gatewayNotStarted;
  }
  if (error.message.includes("Gateway speech")) {
    return copy.speechErrors.gatewaySpeechFailed;
  }
  return error.message;
}

function formatVoiceLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  if (normalized.startsWith("en-us")) {
    return copy.voice.enUs;
  }
  if (normalized.startsWith("en-gb")) {
    return copy.voice.enGb;
  }
  if (normalized.startsWith("en-au")) {
    return copy.voice.enAu;
  }
  if (normalized.startsWith("en-ca")) {
    return copy.voice.enCa;
  }
  return copy.voice.english;
}

function formatBrowserVoiceLabel(voice: SpeechSynthesisVoice): string {
  const source = voice.localService ? copy.voice.systemSource : copy.voice.browserSource;
  return `${formatVoiceLanguage(voice.lang)} · ${voice.name}（${source}）`;
}

function selectedBrowserVoice(): SpeechSynthesisVoice | null {
  if (!selectedBrowserVoiceUri.value) {
    return null;
  }
  return browserVoiceOptions.value.find((voice) => voice.voiceURI === selectedBrowserVoiceUri.value) ?? null;
}

function selectEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = browserVoiceOptions.value;
  const selectedVoice = selectedBrowserVoice();
  if (selectedVoice) {
    return selectedVoice;
  }
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "en-us" && /google|samantha|english|aria/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
    voices[0] ??
    null
  );
}

function selectedYoudaoDictVoiceType(): "1" | "2" {
  const selectedVoice = selectedBrowserVoice();
  return selectedVoice?.lang.toLowerCase().startsWith("en-gb") ? "1" : "2";
}

function youdaoDictVoiceUrl(text: string): string {
  return `${youdaoDictVoiceBaseUrl}?audio=${encodeURIComponent(text)}&type=${selectedYoudaoDictVoiceType()}`;
}

function cancelYoudaoSpeech(): void {
  if (!youdaoSpeechAudio) {
    return;
  }
  youdaoSpeechAudio.pause();
  youdaoSpeechAudio.removeAttribute("src");
  youdaoSpeechAudio.load();
  youdaoSpeechAudio = null;
}

function speakWithBrowserOnce(text: string, runId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowserSpeechSupported()) {
      reject(new Error(copy.speechErrors.browserSpeechUnsupported));
      return;
    }
    if (runId !== wordSpeechRunId.value) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = selectEnglishVoice();
    utterance.lang = selectedVoice?.lang ?? "en-US";
    utterance.rate = browserSpeechRate();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(watchdog);
      window.clearInterval(chromeResumeTimer);
      utterance.onend = null;
      utterance.onerror = null;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const watchdog = window.setTimeout(() => {
      finish(new Error(copy.speechErrors.browserSpeechNoResponse));
    }, Math.max(speechPlaybackWatchdogMs, text.length * SPEECH_BROWSER_CHAR_MS));

    // Chrome workaround: 长文本朗读会卡住，定期 resume 防死锁
    const chromeResumeTimer = window.setInterval(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // ignore
      }
    }, 14000);

    utterance.onend = () => finish();
    utterance.onerror = (event) => {
      const reason = event.error ? `：${event.error}` : "";
      finish(new Error(copy.speechErrors.browserSpeechFailed(reason)));
    };
    window.speechSynthesis.speak(utterance);
  });
}

function speakWithYoudaoOnce(text: string, runId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isYoudaoSpeechSupported()) {
      reject(new Error(copy.speechErrors.fallbackSpeechUnsupported));
      return;
    }
    if (runId !== wordSpeechRunId.value) {
      resolve();
      return;
    }

    cancelYoudaoSpeech();
    const audio = new Audio(youdaoDictVoiceUrl(text));
    youdaoSpeechAudio = audio;
    audio.preload = "auto";
    audio.playbackRate = browserSpeechRate();

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(watchdog);
      audio.onended = null;
      audio.onerror = null;
      audio.onabort = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (youdaoSpeechAudio === audio) {
        youdaoSpeechAudio = null;
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const watchdog = window.setTimeout(() => {
      finish(new Error(copy.speechErrors.fallbackSpeechNoResponse));
    }, Math.max(speechPlaybackWatchdogMs, text.length * SPEECH_YOUDAO_CHAR_MS));

    audio.onended = () => finish();
    audio.onerror = () => {
      const reason = audio.error?.message ? `：${audio.error.message}` : "";
      finish(new Error(copy.speechErrors.fallbackSpeechFailed(reason)));
    };
    audio.onabort = () => finish(new Error(copy.speechErrors.fallbackSpeechCanceled));
    audio.play().catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error(copy.speechErrors.fallbackSpeechFailedPlain));
    });
  });
}

function speakWord(text: string, label: string): void {
  const phrase = text.trim();
  if (!phrase) {
    status.value = copy.status.noSpeechContent;
    return;
  }

  if (!isWordSpeechSupported()) {
    isWordSpeaking.value = false;
    status.value = copy.status.wordSpeechUnavailable;
    return;
  }

  cancelWordSpeech();
  wordSpeechRunId.value += 1;
  const runId = wordSpeechRunId.value;
  const total = selectedRepeat.value;
  let played = 0;

  const playNext = async () => {
    if (runId !== wordSpeechRunId.value) {
      return;
    }
    if (played >= total) {
      isWordSpeaking.value = false;
      status.value = copy.status.playDone(label, total);
      return;
    }

    played += 1;
    isWordSpeaking.value = true;
    status.value = copy.status.speakingWord(label, played, total);

    try {
      await speakWithBrowserOnce(phrase, runId);
      if (runId !== wordSpeechRunId.value) {
        return;
      }
      void playNext();
    } catch (browserError) {
      if (runId !== wordSpeechRunId.value) {
        return;
      }
      status.value = copy.status.tryingFallbackSpeech(label, played, total);
      try {
        await speakWithYoudaoOnce(phrase, runId);
        if (runId === wordSpeechRunId.value) {
          void playNext();
        }
      } catch (error) {
        if (runId !== wordSpeechRunId.value) {
          return;
        }
        isWordSpeaking.value = false;
        status.value = copy.status.wordSpeechFailed(label, formatSpeechError(error || browserError));
      }
    }
  };

  void playNext();
}

function applyGatewayStatus(nextRunning: boolean, mode: GatewayStatusRefreshMode): void {
  const previousRunning = isGatewayRunning.value;
  isGatewayRunning.value = nextRunning;

  if (mode === "manual") {
    status.value = nextRunning ? copy.status.fullTextReady : copy.status.fullTextNotReady;
    return;
  }

  if (previousRunning !== nextRunning) {
    status.value = nextRunning ? copy.status.fullTextReady : copy.status.gatewayClosed;
  }
}

async function refreshGatewayStatus(mode: GatewayStatusRefreshMode = "manual"): Promise<boolean> {
  if (mode === "manual") {
    status.value = copy.status.checkingFullTextSpeech;
  }
  if (gatewayStatusPromise) {
    return gatewayStatusPromise;
  }

  gatewayStatusPromise = (async () => {
    try {
      const nextRunning = await isLocalGatewayRunning();
      applyGatewayStatus(nextRunning, mode);
      return nextRunning;
    } finally {
      gatewayStatusPromise = null;
    }
  })();
  return gatewayStatusPromise;
}

function startGatewayHeartbeat(): void {
  void refreshGatewayStatus("auto");
  gatewayHeartbeatTimer = window.setInterval(() => {
    void refreshGatewayStatus("auto");
  }, gatewayHeartbeatIntervalMs);
}

function stopGatewayHeartbeat(): void {
  if (gatewayHeartbeatTimer === null) {
    return;
  }
  window.clearInterval(gatewayHeartbeatTimer);
  gatewayHeartbeatTimer = null;
}

function openInstallGuide(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function handleGatewayDownload(event: MouseEvent): Promise<void> {
  if (!isHttpsPage.value) {
    event.preventDefault();
    status.value = copy.status.gatewayOfficialDownloadOnly;
    return;
  }

  openInstallGuide(gatewayInstallGuideUrl);

  try {
    const response = await fetchWithTimeout(gatewayDownloadUrl, { method: "HEAD", cache: "no-store" }, NETWORK_HEAD_PROBE);
    if (response.ok) {
      return;
    }
  } catch {
    // Fall through to the visible status message below.
  }

  event.preventDefault();
  status.value = copy.status.gatewayInstallerNotReady;
}

async function handleWordTapWindowsDownload(event: MouseEvent): Promise<void> {
  if (mobileBrowser.value) {
    event.preventDefault();
    status.value = copy.status.desktopDownloadOnly;
    return;
  }

  if (!isHttpsPage.value) {
    event.preventDefault();
    status.value = copy.status.wordTapOfficialDownloadOnly;
    return;
  }

  openInstallGuide(wordTapWindowsInstallGuideUrl);

  try {
    const response = await fetchWithTimeout(wordTapWindowsDownloadUrl, { method: "HEAD", cache: "no-store" }, NETWORK_HEAD_PROBE);
    if (response.ok) {
      return;
    }
  } catch {
    // Fall through to the visible status message below.
  }

  event.preventDefault();
  status.value = copy.status.wordTapInstallerNotReady;
}

/** 将文本按句子边界分段（保留标点） */
function splitSentencesForBrowser(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) {
    return [];
  }
  // 按句子结束符 + 空白/换行 分段，保留标点在句尾
  const parts = cleaned.split(/(?<=[.!?;:])\s+/);
  // 过滤空白段，合并过短的段（<10 字符）到前一段
  const merged: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    if (merged.length > 0 && trimmed.length < 10) {
      merged[merged.length - 1] += " " + trimmed;
    } else {
      merged.push(trimmed);
    }
  }
  return merged.length ? merged : [cleaned];
}

/** 浏览器 speechSynthesis 逐句朗读全文（gateway 不可用时的降级路径） */
function speakFullTextWithBrowser(text: string, label: string): void {
  if (!isBrowserSpeechSupported()) {
    isFullTextSpeaking.value = false;
    status.value = copy.status.fullTextSpeechUnavailable;
    return;
  }

  const sentences = splitSentencesForBrowser(text);
  if (!sentences.length) {
    status.value = copy.status.noSpeechContent;
    return;
  }

  cancelFullTextSpeech();
  fullTextSpeechRunId.value += 1;
  const runId = fullTextSpeechRunId.value;
  const total = selectedRepeat.value;
  let played = 0;

  const voice = selectEnglishVoice();
  const rate = browserSpeechRate();

  // Chrome workaround: 定期 resume 防卡住
  const chromeResumeTimer = window.setInterval(() => {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }, 14000);

  const cleanup = () => {
    window.clearInterval(chromeResumeTimer);
  };

  const playNext = () => {
    if (runId !== fullTextSpeechRunId.value) {
      cleanup();
      return;
    }
    if (played >= total) {
      cleanup();
      isFullTextSpeaking.value = false;
      status.value = copy.status.playDone(label, total);
      return;
    }

    played += 1;
    isFullTextSpeaking.value = true;
    status.value = copy.status.speakingFullText(label, played, total);

    let sentenceIndex = 0;

    const speakNextSentence = () => {
      if (runId !== fullTextSpeechRunId.value) {
        cleanup();
        return;
      }
      if (sentenceIndex >= sentences.length) {
        // 本轮完成，进入下一遍
        playNext();
        return;
      }

      const sentence = sentences[sentenceIndex];
      sentenceIndex += 1;
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = voice?.lang ?? "en-US";
      utterance.rate = rate;
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => speakNextSentence();
      utterance.onerror = (event) => {
        if (runId !== fullTextSpeechRunId.value) {
          cleanup();
          return;
        }
        // 单句失败不中断整篇，跳到下一句
        console.warn("Browser full-text sentence error:", event.error);
        speakNextSentence();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSentence();
  };

  playNext();
}

function speakFullTextWithGateway(text: string, label: string): void {
  const phrase = text.trim();
  if (!phrase) {
    status.value = copy.status.noSpeechContent;
    return;
  }

  if (!("fetch" in window && "Audio" in window && "URL" in window)) {
    isFullTextSpeaking.value = false;
    status.value = copy.status.fullTextSpeechUnavailable;
    return;
  }

  cancelFullTextSpeech();
  fullTextSpeechRunId.value += 1;
  const runId = fullTextSpeechRunId.value;
  const total = selectedRepeat.value;
  let played = 0;
  const session = new GatewaySpeechSession();
  gatewaySpeechSession = session;

  const playNext = () => {
    if (runId !== fullTextSpeechRunId.value) {
      return;
    }
    if (played >= total) {
      isFullTextSpeaking.value = false;
      gatewaySpeechSession = null;
      status.value = copy.status.playDone(label, total);
      return;
    }

    played += 1;
    isFullTextSpeaking.value = true;
    void session
      .speak(phrase, {
        rate: selectedRate.value,
        voice: selectedGatewayVoice.value,
        onProgress: (progress) => {
          if (runId !== fullTextSpeechRunId.value) {
            return;
          }
          if (progress.phase === "playing") {
            status.value = copy.status.speakingFullText(label, played, total);
            return;
          }
          if (progress.phase === "cache-hit") {
            status.value = copy.status.cachedFullTextAudioFound(label);
            return;
          }
          if (progress.phase === "receiving") {
            isGatewayRunning.value = true;
          }
          status.value = progress.phase === "connecting" ? copy.status.preparingFullTextSpeech(label) : copy.status.generatingFullTextSpeech(label);
        },
      })
      .then(() => {
        if (runId === fullTextSpeechRunId.value) {
          playNext();
        }
      })
      .catch((error: unknown) => {
        if (runId !== fullTextSpeechRunId.value || isGatewaySpeechCancelError(error)) {
          return;
        }
        gatewaySpeechSession = null;
        if (error instanceof Error && error.message.includes(copy.speechErrors.gatewayNotStartedNeedle)) {
          isGatewayRunning.value = false;
        }
        console.warn("Gateway speech playback failed, falling back to browser", error);
        // gateway 失败，降级到浏览器内置 speechSynthesis
        if (isBrowserSpeechSupported()) {
          status.value = copy.status.fullTextSpeechBrowserFallback;
          speakFullTextWithBrowser(phrase, label);
        } else {
          isFullTextSpeaking.value = false;
          status.value = copy.status.fullTextSpeechFailed(label, formatSpeechError(error));
        }
      }
    );
  };

  playNext();
}

function splitWords(options: { announce?: boolean; recordTextHistory?: boolean } = {}): void {
  const announce = options.announce ?? false;
  const recordTextHistory = options.recordTextHistory ?? true;
  cancelWordSpeech();
  cancelLookup();
  hideWordPopover();
  const text = sourceText.value.trim();
  if (!text) {
    clearScheduledTextHistorySave();
    segments.value = [];
    selectedSegmentId.value = "";
    if (announce) {
      status.value = copy.status.pasteEnglishFirst;
    }
    return;
  }

  const matches = Array.from(text.matchAll(wordPattern));
  if (!matches.length) {
    clearScheduledTextHistorySave();
    segments.value = [];
    selectedSegmentId.value = "";
    if (announce) {
      status.value = copy.status.noEnglishWordsFound;
    }
    return;
  }

  const nextSegments: Segment[] = [];
  let lastPosition = 0;
  const appendTextSegments = (text: string, id: string): void => {
    const paragraphBreakPattern = /\r?\n(?:[\t ]*\r?\n)+/g;
    let textPosition = 0;

    Array.from(text.matchAll(paragraphBreakPattern)).forEach((match, breakIndex) => {
      const start = match.index ?? 0;
      if (start > textPosition) {
        nextSegments.push({ type: "text", text: text.slice(textPosition, start), id: `${id}-part-${breakIndex}` });
      }
      const blankLineCount = (match[0].match(/\n/g) ?? []).length - 1;
      for (let blankLineIndex = 0; blankLineIndex < blankLineCount; blankLineIndex += 1) {
        nextSegments.push({
          type: "blank-line",
          text: blankLineIndex === 0 ? match[0] : "",
          id: `${id}-blank-${breakIndex}-${blankLineIndex}`,
        });
      }
      textPosition = start + match[0].length;
    });

    if (textPosition < text.length) {
      nextSegments.push({ type: "text", text: text.slice(textPosition), id: `${id}-part-tail` });
    }
  };
  const appendTextGap = (gap: string, id: string): void => {
    if (!gap) {
      return;
    }

    const previousSegment = nextSegments[nextSegments.length - 1];
    const trailingPunctuation = gap.match(trailingPunctuationPattern)?.[0] ?? "";
    if (previousSegment?.type === "word" && trailingPunctuation) {
      previousSegment.trailingText = `${previousSegment.trailingText ?? ""}${trailingPunctuation}`;
      const remainingGap = gap.slice(trailingPunctuation.length);
      if (remainingGap) {
        appendTextSegments(remainingGap, id);
      }
      return;
    }

    appendTextSegments(gap, id);
  };

  matches.forEach((match, index) => {
    const word = match[0];
    const start = match.index ?? 0;
    if (start > lastPosition) {
      appendTextGap(text.slice(lastPosition, start), `text-${index}`);
    }
    nextSegments.push({ type: "word", text: word, id: `word-${index}`, index });
    lastPosition = start + word.length;
  });

  if (lastPosition < text.length) {
    appendTextGap(text.slice(lastPosition), "text-tail");
  }

  segments.value = nextSegments;
  selectedSegmentId.value = "";
  currentWord.value = copy.state.currentWordEmpty;
  meaning.value = copy.state.meaningHint;
  if (announce) {
    status.value = copy.status.wordsReady(matches.length);
  }
  if (recordTextHistory) {
    scheduleTextHistorySaveAfterSplit(text);
  }
}

function scheduleSplitWords(): void {
  if (splitWordsTimer !== null) {
    window.clearTimeout(splitWordsTimer);
  }
  splitWordsTimer = window.setTimeout(() => {
    splitWordsTimer = null;
    splitWords();
  }, UI_SPLIT_WORDS_DEBOUNCE);
}

function extractSentenceContext(segment: Extract<Segment, { type: "word" }>): string {
  const targetIndex = segments.value.findIndex((item) => item.id === segment.id);
  if (targetIndex < 0) return "";
  const segmentText = (item: Segment): string => item.type === "word" ? `${item.text}${item.trailingText ?? ""}` : item.text;
  const startOffset = segments.value.slice(0, targetIndex).reduce((sum, item) => sum + segmentText(item).length, 0);
  const endOffset = startOffset + segment.text.length;
  const text = sourceText.value;
  const leftText = text.slice(0, startOffset);
  const leftMatch = Math.max(leftText.lastIndexOf("."), leftText.lastIndexOf("!"), leftText.lastIndexOf("?"), leftText.lastIndexOf("\n"));
  const rightText = text.slice(endOffset);
  const rightCandidates = [rightText.indexOf("."), rightText.indexOf("!"), rightText.indexOf("?"), rightText.indexOf("\n")].filter((index) => index >= 0);
  const rightOffset = rightCandidates.length ? Math.min(...rightCandidates) + 1 : Math.min(rightText.length, 220);
  return text.slice(leftMatch + 1, endOffset + rightOffset).replace(/\s+/g, " ").trim().slice(0, 300);
}

async function studyWord(segment: Extract<Segment, { type: "word" }>, event: MouseEvent): Promise<void> {
  cancelWordSpeech();
  cancelLookup();
  const runId = lookupRunId.value;
  const lookupController = new AbortController();
  lookupAbortController = lookupController;

  selectedSegmentId.value = segment.id;
  currentWord.value = segment.text;
  meaning.value = copy.lookup.loadingMeaning;
  showWordPopover(segment.text, event);
  status.value = copy.status.lookingUpWord(segment.text);
  speakWord(segment.text, segment.text);
  const currentLesson = activeCourseLesson.value;
  const examLesson: { course: ExamCourseId; id: string; title: string } | null = currentLesson && isExamCourse(currentLesson.course)
    ? { course: currentLesson.course, id: currentLesson.id, title: currentLesson.title }
    : null;
  let examEncounter: ExamWordEncounterRecord | null = null;
  const historyWrite = (async () => {
    try {
      await recordWordStudy(segment.text);
      if (examLesson) {
        examEncounter = await recordExamWordEncounter({
          course: examLesson.course,
          lessonId: examLesson.id,
          lessonTitle: examLesson.title,
          word: segment.text,
          context: extractSentenceContext(segment),
        });
      }
      await reloadHistory({ preserveReviewScroll: activeView.value === "review" });
      if (examLesson) await reloadExamData();
    } catch (error) {
      console.warn("Unable to record study history", error);
    }
  })();

  let translated: TranslationLookup;
  try {
    translated = await translateWord(segment.text, lookupController.signal);
  } catch (error) {
    if (runId === lookupRunId.value) {
      const failureMeaning = copy.lookup.lookupFailedMeaning;
      console.warn("Unable to translate word", error);
      meaning.value = failureMeaning;
      updateWordPopover(segment.text, failureMeaning, true);
      status.value = copy.status.lookupFailed(segment.text);
    }
    return;
  } finally {
    if (lookupAbortController === lookupController) {
      lookupAbortController = null;
    }
  }
  if (runId !== lookupRunId.value) {
    return;
  }

  meaning.value = translated.meaning;
  updateWordPopover(segment.text, translated.meaning, translated.source === "missing");
  status.value =
    translated.source === "missing"
      ? copy.status.meaningMissingForWord(segment.text)
      : copy.status.meaningFoundForWord(segment.text, translated.sourceLabel);
  void historyWrite.then(async () => {
    try {
      await updateStudyMeaning(segment.text, translated.meaning);
      if (examEncounter) await updateExamWordEncounter({ key: examEncounter.key, meaning: translated.meaning });
      await reloadHistory({ preserveReviewScroll: activeView.value === "review" });
      if (examEncounter) await reloadExamData();
    } catch (error) {
      console.warn("Unable to update study meaning", error);
    }
  });
}

async function readFullText(): Promise<void> {
  const text = sourceText.value.trim();
  if (!text) {
    status.value = copy.status.pasteEnglishToRead;
    return;
  }

  // 浏览器和 gateway 都不可用
  if (!isGatewayRunning.value && !isBrowserSpeechSupported()) {
    status.value = copy.status.fullTextSpeechUnavailable;
    return;
  }

  cancelLookup();
  hideWordPopover();
  selectedSegmentId.value = "";
  currentWord.value = copy.template.readFullText;
  meaning.value = copy.status.preparingFullTextSpeech(copy.template.readFullText);
  await saveCurrentTextHistory({ announce: false });

  if (isGatewayRunning.value) {
    // gateway 可用，优先走 gateway（失败时内部会自动降级到 browser）
    speakFullTextWithGateway(text, copy.template.readFullText);
  } else {
    // gateway 不可用，直接用浏览器内置 speechSynthesis
    speakFullTextWithBrowser(text, copy.template.readFullText);
  }
}

watch(sourceText, () => {
  if (!sourceTextHydrating) {
    sourceTextTouched = true;
    if (sourceText.value.trim() !== defaultText.trim()) {
      startupExampleActive = false;
    }
    if (suppressedTextHistoryText && sourceText.value.trim() !== suppressedTextHistoryText) {
      suppressedTextHistoryText = "";
    }
    if (activeCourseLesson.value && sourceText.value.trim() !== activeCourseLessonTextSnapshot) {
      clearActiveCourseLesson({ clearUrl: true });
    }
  }
  scheduleSplitWords();
});
watch([selectedRate, selectedRepeat, selectedTranslateMode, markLearned, selectedBrowserVoiceUri, selectedGatewayVoice], persistCurrentSettings);

function handlePageHide(): void {
  void saveCurrentTextHistory({ announce: false });
}

onMounted(() => {
  browserSpeechSupported.value = isWordSpeechSupported();
  syncActiveViewFromHash();
  window.addEventListener("hashchange", syncActiveViewFromHash);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("keydown", handlePopoverKeydown);
  window.addEventListener("click", hideReviewContextMenu);
  window.addEventListener("mousemove", handleWordPopoverMouseMove);
  window.addEventListener("resize", hideWordPopover);
  window.addEventListener("resize", hideReviewContextMenu);
  window.addEventListener("scroll", hideWordPopover, true);
  window.addEventListener("scroll", hideReviewContextMenu, true);
  void loadManifest();
  startGatewayHeartbeat();
  void reloadHistory();
  void reloadTextHistory();
  void initializeSourceText();
  void refreshAudioCacheSummary();
  void refreshTranslationCacheSummary();
  void startupPruneAudioCache(gatewaySpeechEngineVersion);
  refreshVoices();
  if (isBrowserSpeechSupported()) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("hashchange", syncActiveViewFromHash);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("keydown", handlePopoverKeydown);
  window.removeEventListener("click", hideReviewContextMenu);
  window.removeEventListener("mousemove", handleWordPopoverMouseMove);
  window.removeEventListener("resize", hideWordPopover);
  window.removeEventListener("resize", hideReviewContextMenu);
  window.removeEventListener("scroll", hideWordPopover, true);
  window.removeEventListener("scroll", hideReviewContextMenu, true);
  stopGatewayHeartbeat();
  if (splitWordsTimer !== null) {
    window.clearTimeout(splitWordsTimer);
    splitWordsTimer = null;
  }
  if (sourceTextHydrationTimer !== null) {
    window.clearTimeout(sourceTextHydrationTimer);
    sourceTextHydrationTimer = null;
  }
  if (lessonShareCopiedTimer !== null) {
    window.clearTimeout(lessonShareCopiedTimer);
    lessonShareCopiedTimer = null;
  }
  clearScheduledTextHistorySave();
  cancelLookup();
  cancelSpeech();
  if (isBrowserSpeechSupported()) {
    window.speechSynthesis.onvoiceschanged = null;
  }
});

  return {
    // Static values
    copy, defaultText, rateOptions, rateOptionLabels, repeatOptions,
    translateModeOptions, defaultGatewayVoice, gatewayVoiceOptions, fallbackDictionary,
    logoMarkUrl, wordTapWindowsDownloadUrl,
    gatewayDownloadUrl, gatewayReleaseManifestUrl, examNotice,
    // Refs
    sourceText, segments, selectedSegmentId, currentWord, meaning, status,
    dictionaryInfo, selectedRate, selectedRepeat, selectedTranslateMode,
    isWordSpeaking, isFullTextSpeaking, browserSpeechSupported, isGatewayRunning,
    manifest, availableShardNames, availableVoices, historyRecords, textHistoryRecords,
    selectedTextHistoryId, reviewSearch, selectedReviewKey, historyImportInput, reviewList,
    historyImporting, markLearned, selectedBrowserVoiceUri, selectedGatewayVoice,
    examPapers, examProgressRecords, examWordRecords, examLoading, examStorageAvailable,
    examSearch, examCategory, examStatusFilter, examSubView, examWordSearch,
    examWordStateFilter, examWordLessonFilter, examWordDisplay, revealedExamWordKey,
    examDataImportInput, examDataImporting, examDataFeedback,
    activeView, diagnostics, diagnosticsRunning, diagnosticsUpdatedAt,
    audioCacheClearing, audioCacheSummary, translationCacheClearing, translationCacheSummary,
    activeCourseLesson, lessonShareUrlCopied,
    wordPopover, reviewContextMenu,
    // Computed
    wordCount, wordCountLabel, isSpeaking, historyStats, learnedWordKeys,
    filteredHistory, reviewContextRecord, textHistoryEmptyLabel, reviewEmptyText,
    mobileBrowser, browserVoiceOptions, browserVoiceSelectOptions, isHttpsPage,
    fullTextSpeechDisabled, gatewayStatusLabel, diagnosticsSummary,
    examStats, recentExamProgress, filteredExamPapers, filteredExamWords, examWordLessonOptions,
    // Functions
    isTranslationMode, normalizeWord, viewFromHash, syncActiveViewFromHash,
    studyReadyStatusText, currentTranslateModeLabel, announceTranslateModeChange,
    setActiveView, learnedClassForWord, cancelLookup, showWordPopover,
    initializeExamPanel, openExamPaper, openExamWordSource, examPaperStatus, markExamPaperCompleted,
    resetExamPaper, setExamWordReviewState, toggleExamWordReveal,
    chooseExamDataImportFile, exportCompleteLearningData, importCompleteLearningData,
    handleWordPopoverMouseMove, updateWordPopover, hideWordPopover, hideReviewContextMenu,
    handlePopoverKeydown, cleanDictionaryText, queryVariants, formatEntry,
    reloadHistory, reloadTextHistory, restoreReviewScroll, hydrateSourceText,
    initializeSourceText, saveCurrentTextHistory, clearScheduledTextHistorySave,
    scheduleTextHistorySaveAfterSplit, loadTextHistoryRecord, deleteSelectedTextHistoryRecord,
    deleteHistoryRecord, refreshReviewRecords, exportReviewRecords, chooseHistoryImportFile,
    importReviewRecords, formatHistoryTime, selectReviewRecord, showReviewContextMenu, showReviewContextMenuAt,
    handleReviewRowKeydown, speakHistoryRecord, speakReviewContextRecord,
    deleteReviewContextRecord, refreshVoices, reconcileBrowserVoiceSelection,
    loadManifest, loadManifestOnce, formatDictionaryStatus, diagnosticStatusText,
    diagnosticStatusClass, updateDiagnosticItem, runDiagnostics, diagnosticChecks,
    diagnostic, formatDiagnosticError, checkDictionaryManifest, checkDictionaryShard,
    checkGatewayStatus, checkGatewayCapabilities, checkBaiduRecipe, checkEdgeTtsRecipe,
    checkGatewayReleaseManifest, checkHeadUrl, checkStorageEstimate, checkTranslationCache,
    refreshTranslationCacheSummary, clearStoredTranslationCache, checkAudioCache,
    refreshAudioCacheSummary, clearGatewayAudioCache, fetchJsonWithTimeout, fetchWithTimeout,
    readBlobWithTimeout, readResponseTextWithTimeout, shardCandidatesForWord, loadShard,
    cacheTranslation, translationLookup, cacheSourceForPersistent, lookupCachedTranslation,
    lookupLocalDictionary, lookupOnlineTranslation, lookupFallbackDictionary, translateWord,
    isBrowserSpeechSupported, isYoudaoSpeechSupported, isWordSpeechSupported,
    browserSpeechRate, cancelWordSpeech, cancelFullTextSpeech, cancelSpeech,
    formatSpeechError, formatVoiceLanguage, formatBrowserVoiceLabel, selectedBrowserVoice,
    selectEnglishVoice, selectedYoudaoDictVoiceType, youdaoDictVoiceUrl, cancelYoudaoSpeech,
    speakWithBrowserOnce, speakWithYoudaoOnce, speakWord, applyGatewayStatus,
    refreshGatewayStatus, startGatewayHeartbeat, stopGatewayHeartbeat, handleGatewayDownload,
    handleWordTapWindowsDownload, speakFullTextWithGateway, splitWords, scheduleSplitWords,
    studyWord, readFullText, loadCourseLessonSelection, copyActiveCourseLessonUrl, handlePageHide,
  };
}
