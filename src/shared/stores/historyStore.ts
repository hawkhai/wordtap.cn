import { siteCopy } from "../copy/siteCopy";

export type StudyHistoryRecord = {
  key: string;
  word: string;
  meaning: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

export type StudyTextRecord = {
  id: string;
  title: string;
  text: string;
  count: number;
  createdAt: string;
  lastSeen: string;
};

export type ExamCourseId = "cet" | "kaoyan-english";
export type ExamProgressStatus = "in-progress" | "completed";
export type ExamReviewState = "learning" | "known";

export type ExamProgressRecord = {
  key: string;
  course: ExamCourseId;
  lessonId: string;
  title: string;
  status: ExamProgressStatus;
  startedAt: string;
  lastOpenedAt: string;
  completedAt?: string;
  openCount: number;
  updatedAt: string;
};

export type ExamWordEncounterRecord = {
  key: string;
  wordKey: string;
  word: string;
  meaning: string;
  course: ExamCourseId;
  lessonId: string;
  lessonTitle: string;
  context: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  reviewState: ExamReviewState;
  updatedAt: string;
};

export type LearningDataImportResult = {
  words: number;
  examProgress: number;
  examWords: number;
};

export type TranslationCacheSource = "local-dictionary" | "baidu-sug" | "fallback";

export type TranslationCacheRecord = {
  word: string;
  meaning: string;
  source: TranslationCacheSource;
  updatedAt: string;
};

export type AudioCacheRecord = {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  engineVersion: string;
  createdAt: string;
  lastUsedAt: string;
};

type AudioCacheMeta = {
  key: string;
  size: number;
  lastUsedAt: string;
};

export type AudioCacheStats = {
  count: number;
  totalBytes: number;
  limitBytes: number;
};

export type AudioCacheMaintenanceStats = AudioCacheStats & {
  removed: number;
};

export type TranslationCacheStats = {
  count: number;
  limit: number;
};

type ImportedHistoryRecord = Partial<StudyHistoryRecord> & {
  first_seen?: string;
  last_seen?: string;
};

const dbName = "wordtap-study-history";
const dbVersion = 5;
const wordsStoreName = "words";
const textsStoreName = "texts";
const translationCacheStoreName = "translation_cache";
const audioCacheStoreName = "audio_cache";
const audioCacheMetaStoreName = "audio_cache_meta";
const examProgressStoreName = "exam_progress";
const examWordEncountersStoreName = "exam_word_encounters";
const textHistoryLimit = 100;
const maxTextHistoryChars = 120000;
const translationCacheRecordLimit = 5000;
const audioCacheRecordLimit = 80;
const audioCacheTotalBytesLimit = 80 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

export function normalizeHistoryWord(word: string): string {
  return word.trim().toLowerCase();
}

export async function listStudyHistory(): Promise<StudyHistoryRecord[]> {
  const records = await readAllWordRecords();
  return records.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export async function recordWordStudy(word: string): Promise<StudyHistoryRecord> {
  const key = normalizeHistoryWord(word);
  const now = new Date().toISOString();
  const existing = await getRecord(key);
  const next: StudyHistoryRecord = existing
    ? {
        ...existing,
        word,
        count: existing.count + 1,
        lastSeen: now,
      }
    : {
        key,
        word,
        meaning: "",
        count: 1,
        firstSeen: now,
        lastSeen: now,
      };

  await putRecord(next);
  return next;
}

export async function updateStudyMeaning(word: string, meaning: string): Promise<void> {
  const key = normalizeHistoryWord(word);
  const existing = await getRecord(key);
  if (!existing) {
    return;
  }
  await putRecord({
    ...existing,
    meaning,
  });
}

export async function deleteStudyHistoryRecord(key: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(wordsStoreName, "readwrite").objectStore(wordsStoreName).delete(key));
}

export async function listStudyTexts(): Promise<StudyTextRecord[]> {
  const records = await readAllTextRecords();
  return records.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export async function latestStudyText(): Promise<StudyTextRecord | null> {
  return (await listStudyTexts())[0] ?? null;
}

export async function deleteStudyTextRecord(id: string): Promise<void> {
  if (!id) {
    return;
  }
  const db = await openDb();
  await requestToPromise(db.transaction(textsStoreName, "readwrite").objectStore(textsStoreName).delete(id));
}

function examProgressKey(course: ExamCourseId, lessonId: string): string {
  return `${course}:${lessonId}`;
}

function examWordEncounterKey(course: ExamCourseId, lessonId: string, word: string): string {
  return `${course}:${lessonId}:${normalizeHistoryWord(word)}`;
}

export async function listExamProgress(): Promise<ExamProgressRecord[]> {
  const db = await openDb();
  const records = await requestToPromise<ExamProgressRecord[]>(
    db.transaction(examProgressStoreName, "readonly").objectStore(examProgressStoreName).getAll(),
  );
  return records.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

export async function recordExamOpen(
  course: ExamCourseId,
  lessonId: string,
  title: string,
): Promise<ExamProgressRecord> {
  const key = examProgressKey(course, lessonId);
  const now = new Date().toISOString();
  const db = await openDb();
  const store = db.transaction(examProgressStoreName, "readonly").objectStore(examProgressStoreName);
  const existing = await requestToPromise<ExamProgressRecord | undefined>(store.get(key));
  const next: ExamProgressRecord = existing
    ? {
        ...existing,
        title: title.trim() || existing.title,
        lastOpenedAt: now,
        openCount: Math.max(0, existing.openCount) + 1,
        updatedAt: now,
      }
    : {
        key,
        course,
        lessonId,
        title: title.trim(),
        status: "in-progress",
        startedAt: now,
        lastOpenedAt: now,
        openCount: 1,
        updatedAt: now,
      };
  const tx = db.transaction(examProgressStoreName, "readwrite");
  tx.objectStore(examProgressStoreName).put(next);
  await transactionDone(tx);
  return next;
}

export async function setExamProgressCompleted(
  course: ExamCourseId,
  lessonId: string,
  title: string,
): Promise<ExamProgressRecord> {
  const key = examProgressKey(course, lessonId);
  const now = new Date().toISOString();
  const db = await openDb();
  const existing = await requestToPromise<ExamProgressRecord | undefined>(
    db.transaction(examProgressStoreName, "readonly").objectStore(examProgressStoreName).get(key),
  );
  const next: ExamProgressRecord = {
    key,
    course,
    lessonId,
    title: title.trim() || existing?.title || lessonId,
    status: "completed",
    startedAt: existing?.startedAt ?? now,
    lastOpenedAt: existing?.lastOpenedAt ?? now,
    completedAt: now,
    openCount: existing?.openCount ?? 0,
    updatedAt: now,
  };
  const tx = db.transaction(examProgressStoreName, "readwrite");
  tx.objectStore(examProgressStoreName).put(next);
  await transactionDone(tx);
  return next;
}

export async function resetExamProgress(course: ExamCourseId, lessonId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(examProgressStoreName, "readwrite");
  tx.objectStore(examProgressStoreName).delete(examProgressKey(course, lessonId));
  await transactionDone(tx);
}

export async function listExamWordEncounters(): Promise<ExamWordEncounterRecord[]> {
  const db = await openDb();
  const records = await requestToPromise<ExamWordEncounterRecord[]>(
    db.transaction(examWordEncountersStoreName, "readonly").objectStore(examWordEncountersStoreName).getAll(),
  );
  return records.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export async function recordExamWordEncounter(input: {
  course: ExamCourseId;
  lessonId: string;
  lessonTitle: string;
  word: string;
  meaning?: string;
  context?: string;
}): Promise<ExamWordEncounterRecord> {
  const wordKey = normalizeHistoryWord(input.word);
  const key = examWordEncounterKey(input.course, input.lessonId, wordKey);
  const now = new Date().toISOString();
  const db = await openDb();
  const existing = await requestToPromise<ExamWordEncounterRecord | undefined>(
    db.transaction(examWordEncountersStoreName, "readonly").objectStore(examWordEncountersStoreName).get(key),
  );
  const context = String(input.context ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const next: ExamWordEncounterRecord = existing
    ? {
        ...existing,
        word: input.word,
        lessonTitle: input.lessonTitle.trim() || existing.lessonTitle,
        meaning: input.meaning?.trim() || existing.meaning,
        context: context || existing.context,
        count: Math.max(0, existing.count) + 1,
        lastSeen: now,
        updatedAt: now,
      }
    : {
        key,
        wordKey,
        word: input.word,
        meaning: input.meaning?.trim() ?? "",
        course: input.course,
        lessonId: input.lessonId,
        lessonTitle: input.lessonTitle.trim(),
        context,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        reviewState: "learning",
        updatedAt: now,
      };
  const tx = db.transaction(examWordEncountersStoreName, "readwrite");
  tx.objectStore(examWordEncountersStoreName).put(next);
  await transactionDone(tx);
  return next;
}

export async function updateExamWordEncounter(input: {
  key: string;
  meaning?: string;
  reviewState?: ExamReviewState;
}): Promise<void> {
  const db = await openDb();
  const existing = await requestToPromise<ExamWordEncounterRecord | undefined>(
    db.transaction(examWordEncountersStoreName, "readonly").objectStore(examWordEncountersStoreName).get(input.key),
  );
  if (!existing) return;
  const now = new Date().toISOString();
  const tx = db.transaction(examWordEncountersStoreName, "readwrite");
  tx.objectStore(examWordEncountersStoreName).put({
    ...existing,
    meaning: input.meaning?.trim() || existing.meaning,
    reviewState: input.reviewState ?? existing.reviewState,
    updatedAt: now,
  });
  await transactionDone(tx);
}

export async function recordStudyText(text: string): Promise<StudyTextRecord | null> {
  const normalized = normalizeArticleText(text);
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxTextHistoryChars) {
    throw new Error(siteCopy.historyStore.textTooLong(maxTextHistoryChars.toLocaleString("zh-CN")));
  }

  const id = await textHistoryId(normalized);
  const now = new Date().toISOString();
  const existing = await getTextRecord(id);
  const next: StudyTextRecord = existing
    ? {
        ...existing,
        title: makeTextHistoryTitle(normalized),
        text: normalized,
        count: existing.count + 1,
        lastSeen: now,
      }
    : {
        id,
        title: makeTextHistoryTitle(normalized),
        text: normalized,
        count: 1,
        createdAt: now,
        lastSeen: now,
      };

  await putTextRecord(next);
  await pruneTextHistory();
  return next;
}

export async function getCachedTranslation(word: string): Promise<TranslationCacheRecord | undefined> {
  const key = normalizeHistoryWord(word);
  if (!key) {
    return undefined;
  }
  const db = await openDb();
  return requestToPromise<TranslationCacheRecord | undefined>(
    db.transaction(translationCacheStoreName, "readonly").objectStore(translationCacheStoreName).get(key),
  );
}

export async function putCachedTranslation(
  word: string,
  meaning: string,
  source: TranslationCacheSource,
): Promise<void> {
  const key = normalizeHistoryWord(word);
  const cleaned = meaning.trim();
  if (!key || !cleaned || cleaned === siteCopy.historyStore.missingMeaning) {
    return;
  }

  const db = await openDb();
  await requestToPromise(
    db.transaction(translationCacheStoreName, "readwrite").objectStore(translationCacheStoreName).put({
      word: key,
      meaning: cleaned,
      source,
      updatedAt: new Date().toISOString(),
    } satisfies TranslationCacheRecord),
  );
  await pruneTranslationCache();
}

export async function translationCacheStats(): Promise<TranslationCacheStats> {
  const records = await readAllTranslationCacheRecords();
  return {
    count: records.length,
    limit: translationCacheRecordLimit,
  };
}

export async function clearTranslationCache(): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(translationCacheStoreName, "readwrite").objectStore(translationCacheStoreName).clear());
}

export async function makeAudioCacheKey(parts: string[]): Promise<string> {
  const identity = parts.map((part) => part.trim()).join("\u001f");
  if ("crypto" in globalThis && globalThis.crypto.subtle) {
    const bytes = new TextEncoder().encode(identity);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackHash(identity);
}

export async function getCachedAudio(key: string): Promise<AudioCacheRecord | undefined> {
  const db = await openDb();
  const store = db.transaction(audioCacheStoreName, "readonly").objectStore(audioCacheStoreName);
  const record = await requestToPromise<AudioCacheRecord | undefined>(store.get(key));
  if (!record?.blob || !record.size) {
    return undefined;
  }

  try {
    await touchAudioCacheRecord(record);
  } catch {
    // LRU 更新失败不影响播放，但下次淘汰时时间戳可能不准
  }
  return record;
}

export async function putCachedAudio(
  key: string,
  blob: Blob,
  engineVersion: string,
): Promise<void> {
  if (!key || !blob.size) {
    return;
  }

  const now = new Date().toISOString();
  const record: AudioCacheRecord = {
    key,
    blob,
    mimeType: blob.type || "audio/mpeg",
    size: blob.size,
    engineVersion,
    createdAt: now,
    lastUsedAt: now,
  };
  const meta: AudioCacheMeta = { key, size: blob.size, lastUsedAt: now };

  const db = await openDb();
  const tx = db.transaction([audioCacheStoreName, audioCacheMetaStoreName], "readwrite");
  tx.objectStore(audioCacheStoreName).put(record);
  tx.objectStore(audioCacheMetaStoreName).put(meta);
  await transactionDone(tx);
  await pruneAudioCache();
}

export async function audioCacheStats(): Promise<AudioCacheStats> {
  const records = await readAllAudioCacheRecords();
  return {
    count: records.length,
    totalBytes: records.reduce((sum, record) => sum + Math.max(0, record.size), 0),
    limitBytes: audioCacheTotalBytesLimit,
  };
}

export async function repairAudioCache(engineVersion: string): Promise<AudioCacheMaintenanceStats> {
  const expectedEngineVersion = engineVersion.trim();
  const records = await readAllAudioCacheRecords();
  const invalidKeys = records
    .filter((record) => isInvalidAudioCacheRecord(record, expectedEngineVersion))
    .map((record) => record.key);

  if (invalidKeys.length) {
    const db = await openDb();
    const tx = db.transaction([audioCacheStoreName, audioCacheMetaStoreName], "readwrite");
    const blobStore = tx.objectStore(audioCacheStoreName);
    const metaStore = tx.objectStore(audioCacheMetaStoreName);
    for (const key of invalidKeys) {
      blobStore.delete(key);
      metaStore.delete(key);
    }
    await transactionDone(tx);
  }

  // 清理元数据 store 中的孤儿记录
  const orphanMeta = (await readAllAudioCacheMeta()).filter(
    (meta) => !records.some((r) => r.key === meta.key && !invalidKeys.includes(r.key)),
  );
  if (orphanMeta.length) {
    const db = await openDb();
    const tx = db.transaction(audioCacheMetaStoreName, "readwrite");
    const metaStore = tx.objectStore(audioCacheMetaStoreName);
    for (const meta of orphanMeta) {
      metaStore.delete(meta.key);
    }
    await transactionDone(tx);
  }

  await pruneAudioCache();

  const validRecords = records.filter((record) => !invalidKeys.includes(record.key));
  return {
    count: validRecords.length,
    totalBytes: validRecords.reduce((sum, record) => sum + Math.max(0, record.size), 0),
    limitBytes: audioCacheTotalBytesLimit,
    removed: invalidKeys.length + orphanMeta.length,
  };
}

export async function clearAudioCache(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([audioCacheStoreName, audioCacheMetaStoreName], "readwrite");
  tx.objectStore(audioCacheStoreName).clear();
  tx.objectStore(audioCacheMetaStoreName).clear();
  await transactionDone(tx);
}

export async function importStudyHistoryJson(text: string): Promise<number> {
  const payload = JSON.parse(stripBom(text)) as unknown;
  const rawRecords = Array.isArray(payload) ? payload : Object.values(payload as Record<string, unknown>);
  const normalized = rawRecords.map(normalizeImportedRecord).filter((record): record is StudyHistoryRecord => Boolean(record));
  if (!normalized.length) {
    throw new Error(siteCopy.historyStore.noImportRecords);
  }

  const existing = await readAllWordRecords();
  const merged = new Map(existing.map((record) => [record.key, record]));
  for (const record of normalized) {
    const current = merged.get(record.key);
    if (!current) {
      merged.set(record.key, record);
      continue;
    }

    merged.set(record.key, {
      key: record.key,
      word: record.word || current.word,
      meaning: record.meaning || current.meaning,
      count: Math.max(0, current.count) + Math.max(0, record.count),
      firstSeen: minIso(current.firstSeen, record.firstSeen),
      lastSeen: maxIso(current.lastSeen, record.lastSeen),
    });
  }

  const db = await openDb();
  const transaction = db.transaction(wordsStoreName, "readwrite");
  const store = transaction.objectStore(wordsStoreName);
  for (const record of merged.values()) {
    store.put(record);
  }
  await transactionDone(transaction);
  return normalized.length;
}

export function exportStudyHistoryJson(records: StudyHistoryRecord[]): string {
  const payload = records.map((record) => ({
    word: record.word,
    meaning: record.meaning,
    count: record.count,
    first_seen: record.firstSeen,
    last_seen: record.lastSeen,
  }));
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function exportCompleteLearningDataJson(): Promise<string> {
  const [words, examProgress, examWords] = await Promise.all([
    listStudyHistory(),
    listExamProgress(),
    listExamWordEncounters(),
  ]);
  return `${JSON.stringify({
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    words,
    examProgress,
    examWords,
  }, null, 2)}\n`;
}

export async function importCompleteLearningDataJson(text: string): Promise<LearningDataImportResult> {
  const payload = JSON.parse(stripBom(text)) as unknown;
  if (Array.isArray(payload)) {
    return { words: await importStudyHistoryJson(text), examProgress: 0, examWords: 0 };
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(siteCopy.historyStore.noImportRecords);
  }
  const data = payload as Record<string, unknown>;
  const rawWords = Array.isArray(data.words) ? data.words : [];
  const rawProgress = Array.isArray(data.examProgress) ? data.examProgress : [];
  const rawExamWords = Array.isArray(data.examWords) ? data.examWords : [];
  if (!rawWords.length && !rawProgress.length && !rawExamWords.length) {
    throw new Error(siteCopy.historyStore.noImportRecords);
  }

  const words = rawWords.map(normalizeImportedRecord).filter((record): record is StudyHistoryRecord => Boolean(record));
  const progress = rawProgress.map(normalizeImportedExamProgress).filter((record): record is ExamProgressRecord => Boolean(record));
  const examWords = rawExamWords.map(normalizeImportedExamWord).filter((record): record is ExamWordEncounterRecord => Boolean(record));
  const db = await openDb();
  const storeNames = [wordsStoreName, examProgressStoreName, examWordEncountersStoreName];
  const tx = db.transaction(storeNames, "readwrite");

  for (const record of words) {
    const current = await requestToPromise<StudyHistoryRecord | undefined>(tx.objectStore(wordsStoreName).get(record.key));
    tx.objectStore(wordsStoreName).put(current ? {
      ...current,
      word: record.word || current.word,
      meaning: record.meaning || current.meaning,
      count: Math.max(current.count, record.count),
      firstSeen: minIso(current.firstSeen, record.firstSeen),
      lastSeen: maxIso(current.lastSeen, record.lastSeen),
    } : record);
  }
  for (const record of progress) {
    const store = tx.objectStore(examProgressStoreName);
    const current = await requestToPromise<ExamProgressRecord | undefined>(store.get(record.key));
    store.put(!current || record.updatedAt >= current.updatedAt ? record : current);
  }
  for (const record of examWords) {
    const store = tx.objectStore(examWordEncountersStoreName);
    const current = await requestToPromise<ExamWordEncounterRecord | undefined>(store.get(record.key));
    store.put(current ? {
      ...(record.updatedAt >= current.updatedAt ? current : record),
      ...(record.updatedAt >= current.updatedAt ? record : current),
      count: Math.max(current.count, record.count),
      firstSeen: minIso(current.firstSeen, record.firstSeen),
      lastSeen: maxIso(current.lastSeen, record.lastSeen),
    } : record);
  }
  await transactionDone(tx);
  return { words: words.length, examProgress: progress.length, examWords: examWords.length };
}

function normalizeImportedRecord(raw: unknown): StudyHistoryRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as ImportedHistoryRecord;
  const word = typeof record.word === "string" ? record.word.trim() : "";
  const key = normalizeHistoryWord(typeof record.key === "string" ? record.key : word);
  if (!word || !key) {
    return null;
  }

  const now = new Date().toISOString();
  const firstSeen = normalizeDate(record.firstSeen ?? record.first_seen) ?? now;
  const lastSeen = normalizeDate(record.lastSeen ?? record.last_seen) ?? firstSeen;
  return {
    key,
    word,
    meaning: typeof record.meaning === "string" ? record.meaning : "",
    count: normalizeCount(record.count),
    firstSeen,
    lastSeen,
  };
}

function isExamCourseId(value: unknown): value is ExamCourseId {
  return value === "cet" || value === "kaoyan-english";
}

function normalizeImportedExamProgress(raw: unknown): ExamProgressRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Partial<ExamProgressRecord>;
  if (!isExamCourseId(record.course) || typeof record.lessonId !== "string" || !record.lessonId.trim()) return null;
  const now = new Date().toISOString();
  const startedAt = normalizeDate(record.startedAt) ?? now;
  const lastOpenedAt = normalizeDate(record.lastOpenedAt) ?? startedAt;
  const status: ExamProgressStatus = record.status === "completed" ? "completed" : "in-progress";
  return {
    key: examProgressKey(record.course, record.lessonId),
    course: record.course,
    lessonId: record.lessonId,
    title: typeof record.title === "string" ? record.title : record.lessonId,
    status,
    startedAt,
    lastOpenedAt,
    completedAt: status === "completed" ? normalizeDate(record.completedAt) ?? lastOpenedAt : undefined,
    openCount: normalizeCount(record.openCount),
    updatedAt: normalizeDate(record.updatedAt) ?? lastOpenedAt,
  };
}

function normalizeImportedExamWord(raw: unknown): ExamWordEncounterRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Partial<ExamWordEncounterRecord>;
  if (!isExamCourseId(record.course) || typeof record.lessonId !== "string" || typeof record.word !== "string") return null;
  const wordKey = normalizeHistoryWord(record.wordKey || record.word);
  if (!wordKey || !record.lessonId.trim()) return null;
  const now = new Date().toISOString();
  const firstSeen = normalizeDate(record.firstSeen) ?? now;
  const lastSeen = normalizeDate(record.lastSeen) ?? firstSeen;
  return {
    key: examWordEncounterKey(record.course, record.lessonId, wordKey),
    wordKey,
    word: record.word.trim(),
    meaning: typeof record.meaning === "string" ? record.meaning : "",
    course: record.course,
    lessonId: record.lessonId,
    lessonTitle: typeof record.lessonTitle === "string" ? record.lessonTitle : record.lessonId,
    context: typeof record.context === "string" ? record.context.replace(/\s+/g, " ").trim().slice(0, 300) : "",
    count: normalizeCount(record.count),
    firstSeen,
    lastSeen,
    reviewState: record.reviewState === "known" ? "known" : "learning",
    updatedAt: normalizeDate(record.updatedAt) ?? lastSeen,
  };
}

function normalizeCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const trimmed = value.trim();
  const parsed = new Date(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}

function minIso(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? a : b;
}

function maxIso(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function normalizeArticleText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function textHistoryIdentityText(text: string): string {
  return normalizeArticleText(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function makeTextHistoryTitle(text: string): string {
  const compact = normalizeArticleText(text).replace(/\s+/g, " ");
  if (!compact) {
    return siteCopy.historyStore.untitledArticle;
  }
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact;
}

async function textHistoryId(text: string): Promise<string> {
  const identity = textHistoryIdentityText(text);
  if ("crypto" in globalThis && globalThis.crypto.subtle) {
    const bytes = new TextEncoder().encode(identity);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackHash(identity);
}

function fallbackHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

async function readAllWordRecords(): Promise<StudyHistoryRecord[]> {
  const db = await openDb();
  return requestToPromise<StudyHistoryRecord[]>(
    db.transaction(wordsStoreName, "readonly").objectStore(wordsStoreName).getAll(),
  );
}

async function getRecord(key: string): Promise<StudyHistoryRecord | undefined> {
  const db = await openDb();
  return requestToPromise<StudyHistoryRecord | undefined>(
    db.transaction(wordsStoreName, "readonly").objectStore(wordsStoreName).get(key),
  );
}

async function putRecord(record: StudyHistoryRecord): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(wordsStoreName, "readwrite").objectStore(wordsStoreName).put(record));
}

async function readAllTextRecords(): Promise<StudyTextRecord[]> {
  const db = await openDb();
  return requestToPromise<StudyTextRecord[]>(
    db.transaction(textsStoreName, "readonly").objectStore(textsStoreName).getAll(),
  );
}

async function getTextRecord(id: string): Promise<StudyTextRecord | undefined> {
  const db = await openDb();
  return requestToPromise<StudyTextRecord | undefined>(
    db.transaction(textsStoreName, "readonly").objectStore(textsStoreName).get(id),
  );
}

async function putTextRecord(record: StudyTextRecord): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(textsStoreName, "readwrite").objectStore(textsStoreName).put(record));
}

async function pruneTextHistory(): Promise<void> {
  const records = await readAllTextRecords();
  if (records.length <= textHistoryLimit) {
    return;
  }

  const staleRecords = records.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(textHistoryLimit);
  const db = await openDb();
  const transaction = db.transaction(textsStoreName, "readwrite");
  const store = transaction.objectStore(textsStoreName);
  for (const record of staleRecords) {
    store.delete(record.id);
  }
  await transactionDone(transaction);
}

async function readAllTranslationCacheRecords(): Promise<TranslationCacheRecord[]> {
  const db = await openDb();
  return requestToPromise<TranslationCacheRecord[]>(
    db.transaction(translationCacheStoreName, "readonly").objectStore(translationCacheStoreName).getAll(),
  );
}

async function pruneTranslationCache(): Promise<void> {
  const records = await readAllTranslationCacheRecords();
  if (records.length <= translationCacheRecordLimit) {
    return;
  }

  const staleRecords = records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(translationCacheRecordLimit);
  const db = await openDb();
  const transaction = db.transaction(translationCacheStoreName, "readwrite");
  const store = transaction.objectStore(translationCacheStoreName);
  for (const record of staleRecords) {
    store.delete(record.word);
  }
  await transactionDone(transaction);
}

async function touchAudioCacheRecord(record: AudioCacheRecord): Promise<void> {
  const now = new Date().toISOString();
  const db = await openDb();
  // 只更新轻量元数据 store，不重写整个 Blob 记录
  await requestToPromise(
    db.transaction(audioCacheMetaStoreName, "readwrite").objectStore(audioCacheMetaStoreName).put({
      key: record.key,
      size: record.size,
      lastUsedAt: now,
    } satisfies AudioCacheMeta),
  );
}

async function readAllAudioCacheRecords(): Promise<AudioCacheRecord[]> {
  const db = await openDb();
  return requestToPromise<AudioCacheRecord[]>(
    db.transaction(audioCacheStoreName, "readonly").objectStore(audioCacheStoreName).getAll(),
  );
}

function isInvalidAudioCacheRecord(record: AudioCacheRecord, expectedEngineVersion: string): boolean {
  if (!record.key || !record.blob || record.blob.size <= 0 || record.size <= 0) {
    return true;
  }
  if (record.blob.size !== record.size) {
    return true;
  }
  return Boolean(expectedEngineVersion && record.engineVersion !== expectedEngineVersion);
}

async function readAllAudioCacheMeta(): Promise<AudioCacheMeta[]> {
  const db = await openDb();
  return requestToPromise<AudioCacheMeta[]>(
    db.transaction(audioCacheMetaStoreName, "readonly").objectStore(audioCacheMetaStoreName).getAll(),
  );
}

async function pruneAudioCache(): Promise<void> {
  // 只读轻量元数据，不加载 Blob
  const metas = await readAllAudioCacheMeta();
  let totalBytes = metas.reduce((sum, m) => sum + Math.max(0, m.size), 0);
  if (metas.length <= audioCacheRecordLimit && totalBytes <= audioCacheTotalBytesLimit) {
    return;
  }

  // 按 lastUsedAt 升序（最旧的在前）
  const staleMetas = metas.sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt));
  const keysToDelete: string[] = [];
  for (const meta of staleMetas) {
    if (metas.length - keysToDelete.length <= audioCacheRecordLimit && totalBytes <= audioCacheTotalBytesLimit) {
      break;
    }
    keysToDelete.push(meta.key);
    totalBytes -= Math.max(0, meta.size);
  }

  if (!keysToDelete.length) {
    return;
  }

  const db = await openDb();
  const tx = db.transaction([audioCacheStoreName, audioCacheMetaStoreName], "readwrite");
  const blobStore = tx.objectStore(audioCacheStoreName);
  const metaStore = tx.objectStore(audioCacheMetaStoreName);
  for (const key of keysToDelete) {
    blobStore.delete(key);
    metaStore.delete(key);
  }
  await transactionDone(tx);
}

/** 启动时清理：删除过期/无效元数据，然后执行 LRU 淘汰 */
export async function startupPruneAudioCache(engineVersion: string): Promise<void> {
  try {
    const metas = await readAllAudioCacheMeta();
    if (!metas.length) {
      return;
    }

    // 清理元数据 store 中有但 blob store 中已不存在的孤儿记录
    const db = await openDb();
    const orphanKeys: string[] = [];
    for (const meta of metas) {
      const blobRecord = await requestToPromise<AudioCacheRecord | undefined>(
        db.transaction(audioCacheStoreName, "readonly").objectStore(audioCacheStoreName).get(meta.key),
      );
      if (!blobRecord?.blob?.size) {
        orphanKeys.push(meta.key);
      }
    }

    if (orphanKeys.length) {
      const tx = db.transaction([audioCacheMetaStoreName], "readwrite");
      const metaStore = tx.objectStore(audioCacheMetaStoreName);
      for (const key of orphanKeys) {
        metaStore.delete(key);
      }
      await transactionDone(tx);
    }

    await pruneAudioCache();
  } catch {
    // 启动清理失败不应阻塞应用
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(wordsStoreName)) {
        db.createObjectStore(wordsStoreName, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(textsStoreName)) {
        db.createObjectStore(textsStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(translationCacheStoreName)) {
        db.createObjectStore(translationCacheStoreName, { keyPath: "word" });
      }
      if (!db.objectStoreNames.contains(audioCacheStoreName)) {
        db.createObjectStore(audioCacheStoreName, { keyPath: "key" });
      }
      // v4: 轻量元数据 store，淘汰时只读 key/size/lastUsedAt，不加载 Blob
      if (!db.objectStoreNames.contains(audioCacheMetaStoreName)) {
        const metaStore = db.createObjectStore(audioCacheMetaStoreName, { keyPath: "key" });
        metaStore.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(examProgressStoreName)) {
        const progressStore = db.createObjectStore(examProgressStoreName, { keyPath: "key" });
        progressStore.createIndex("lastOpenedAt", "lastOpenedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(examWordEncountersStoreName)) {
        const encounterStore = db.createObjectStore(examWordEncountersStoreName, { keyPath: "key" });
        encounterStore.createIndex("lastSeen", "lastSeen", { unique: false });
        encounterStore.createIndex("lessonId", "lessonId", { unique: false });
        encounterStore.createIndex("reviewState", "reviewState", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(siteCopy.historyStore.openDbFailed));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(siteCopy.historyStore.indexedDbRequestFailed));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(siteCopy.historyStore.writeFailed));
    transaction.onabort = () => reject(transaction.error ?? new Error(siteCopy.historyStore.writeAborted));
  });
}
