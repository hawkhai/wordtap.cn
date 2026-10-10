import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { ActiveCourseLesson, ActiveView } from "../types/app";
import {
  articleTypingSourceId, getArticleTypingProgress, latestArticleTypingProgress,
  putArticleTypingProgress, type ArticleTypingProgress,
} from "../stores/historyStore";
import {
  buildTypingSentences, initialTypingState, nextTypingWord, normalizeTypingState, updateTypingDraft, submitTypingSentence, typingFeedback,
  type TypingSentence, type TypingState,
} from "../utils/articleTyping";
import { loadArticleTypingBody } from "../utils/articleTypingSource";

const autoSpeakKey = "wordtap.articleTyping.autoSpeak";
const autoWordKey = "wordtap.articleTyping.autoWord";
const recentProgressKey = "wordtap.articleTyping.recent";

export function useArticleTyping(options: {
  sourceText: Ref<string>;
  activeCourseLesson: Ref<ActiveCourseLesson | null>;
  activeView: Ref<ActiveView>;
  speechDisabled: Ref<boolean>;
  wordSpeechDisabled: Ref<boolean>;
  speak: (text: string) => Promise<void>;
  speakWord: (word: string) => void;
  stopSpeech: () => void;
}) {
  const active = ref(false);
  const loading = ref(false);
  const message = ref("");
  const sentences = ref<TypingSentence[]>([]);
  const state = ref<TypingState>(initialTypingState());
  const autoSpeak = ref(false);
  const autoWord = ref(true);
  try { autoSpeak.value = window.localStorage.getItem(autoSpeakKey) === "true"; } catch { /* storage is optional */ }
  try { autoWord.value = window.localStorage.getItem(autoWordKey) !== "false"; } catch { /* storage is optional */ }
  let recordKey = "";
  let sourceId = "";
  let mode: ArticleTypingProgress["mode"] = "full";
  let selectionStart = 0;
  let selectionEnd = 0;
  let generation = 0;
  let promptSequence = 0;
  let announcedWordKey = "";
  let sentencePromptPending = false;
  let pendingSave: ArticleTypingProgress | null = null;
  let saving = false;

  const currentSentence = computed(() => sentences.value[state.value.current] ?? null);
  const currentDraft = computed(() => state.value.drafts[state.value.current] ?? "");
  const completedCount = computed(() => state.value.completed.length);
  const finished = computed(() => sentences.value.length > 0 && completedCount.value === sentences.value.length);

  function wordPrompt(): { key: string; text: string } | null {
    const sentence = currentSentence.value;
    if (!sentence || finished.value || typingFeedback(sentence.target, currentDraft.value).ready || state.value.completed.includes(state.value.current)) return null;
    const word = nextTypingWord(sentence.target, currentDraft.value);
    return word ? { key: `${state.value.current}:${word.start}`, text: word.text } : null;
  }

  function speakCurrentWord(): void {
    if (!active.value || !autoWord.value || options.wordSpeechDisabled.value) return;
    const prompt = wordPrompt();
    if (!prompt || prompt.key === announcedWordKey) return;
    announcedWordKey = prompt.key;
    promptSequence += 1;
    sentencePromptPending = false;
    options.speakWord(prompt.text);
  }

  function playCurrentPrompt(): void {
    const run = ++promptSequence;
    announcedWordKey = "";
    sentencePromptPending = false;
    if (!active.value || finished.value) return;
    const sentence = currentSentence.value;
    if (!sentence) return;
    if (autoSpeak.value && !options.speechDisabled.value) {
      sentencePromptPending = true;
      void options.speak(sentence.target).catch((error) => {
        console.warn("Unable to speak typing sentence", error);
      }).then(() => {
        if (run === promptSequence) sentencePromptPending = false;
      });
    }
  }

  function close(): void {
    generation += 1;
    promptSequence += 1;
    sentencePromptPending = false;
    active.value = false;
    loading.value = false;
    options.stopSpeech();
  }

  function persist(): void {
    if (!recordKey) return;
    const snapshot: ArticleTypingProgress = {
      key: recordKey, sourceId, mode, selectionStart, selectionEnd,
      state: {
        current: state.value.current,
        completed: [...state.value.completed],
        drafts: { ...state.value.drafts },
      },
      updatedAt: new Date().toISOString(),
    };
    try { window.localStorage.setItem(recentProgressKey, JSON.stringify(snapshot)); } catch { /* IndexedDB remains available */ }
    pendingSave = snapshot;
    if (!saving) void flushSaves();
  }

  async function flushSaves(): Promise<void> {
    saving = true;
    while (pendingSave) {
      const snapshot = pendingSave;
      pendingSave = null;
      try {
        await putArticleTypingProgress(snapshot);
      } catch (error) {
        console.warn("Unable to save article typing progress", error);
        message.value = "跟打进度暂时无法保存，请检查浏览器存储空间。";
      }
    }
    saving = false;
  }

  function readRecentLocalProgress(): ArticleTypingProgress | null {
    try {
      const raw = window.localStorage.getItem(recentProgressKey);
      if (!raw) return null;
      const record = JSON.parse(raw) as ArticleTypingProgress;
      return typeof record?.key === "string" && typeof record.sourceId === "string" &&
        typeof record.updatedAt === "string" ? record : null;
    } catch { return null; }
  }

  async function start(startOffset = 0, endOffset = 0): Promise<void> {
    const source = options.sourceText.value;
    if (!source.trim()) { message.value = "请先载入或粘贴一篇英文文章。"; return; }
    const selected = endOffset > startOffset && Boolean(source.slice(startOffset, endOffset).trim());
    const run = ++generation;
    loading.value = true;
    message.value = "";
    try {
      const nextSourceId = await articleTypingSourceId(source);
      const persistedRecent = selected ? null : await latestArticleTypingProgress(nextSourceId);
      const localRecent = readRecentLocalProgress();
      const recent = !selected && localRecent?.sourceId === nextSourceId &&
        (!persistedRecent || localRecent.updatedAt >= persistedRecent.updatedAt) ? localRecent : persistedRecent;
      if (run !== generation || source !== options.sourceText.value) return;
      let nextMode: ArticleTypingProgress["mode"];
      let from = 0;
      let to = 0;
      let body: string;
      if (selected) {
        nextMode = "selection";
        from = startOffset;
        to = endOffset;
        body = source.slice(from, to);
      } else if (recent?.mode === "selection") {
        nextMode = "selection";
        from = recent.selectionStart;
        to = recent.selectionEnd;
        body = source.slice(from, to);
      } else if (options.activeCourseLesson.value) {
        let extracted: string | null = null;
        try {
          extracted = await loadArticleTypingBody(options.activeCourseLesson.value);
        } catch (error) {
          if (options.activeCourseLesson.value?.course === "english-vocabulary") throw error;
          console.warn("Unable to identify article body for typing", error);
        }
        if (run !== generation || source !== options.sourceText.value) return;
        nextMode = extracted?.trim() ? "auto" : "full";
        body = extracted?.trim() || source;
      } else {
        nextMode = "full";
        body = source;
      }
      const nextSentences = buildTypingSentences(body);
      if (!nextSentences.length) { message.value = "所选内容没有可跟打的英文句子。"; return; }
      const nextKey = `${nextSourceId}:${nextMode}:${from}:${to}`;
      const saved = await getArticleTypingProgress(nextKey);
      if (run !== generation || source !== options.sourceText.value) return;
      options.stopSpeech();
      sourceId = nextSourceId;
      recordKey = nextKey;
      mode = nextMode;
      selectionStart = from;
      selectionEnd = to;
      sentences.value = nextSentences;
      const local = readRecentLocalProgress()?.key === nextKey ? readRecentLocalProgress() : null;
      const latest = local && (!saved || local.updatedAt >= saved.updatedAt) ? local : saved;
      state.value = normalizeTypingState(latest?.state, nextSentences);
      active.value = true;
      persist();
      playCurrentPrompt();
    } catch (error) {
      console.warn("Unable to start article typing", error);
      message.value = "跟打暂时无法打开，请重试。";
    } finally {
      if (run === generation) loading.value = false;
    }
  }

  function chooseSentence(index: number): void {
    if (!active.value || index < 0 || index >= sentences.value.length) return;
    options.stopSpeech();
    state.value = { ...state.value, current: index };
    persist();
    playCurrentPrompt();
  }

  function typeDraft(value: string, afterKeyboardInput = false): void {
    if (!active.value || finished.value || state.value.completed.includes(state.value.current)) return;
    if (value === currentDraft.value) {
      // An IME commit can have the same text as its last intermediate draft.
      if (afterKeyboardInput && value.length > 0) speakCurrentWord();
      return;
    }
    state.value = updateTypingDraft(state.value, value);
    persist();
    if (typingFeedback(currentSentence.value?.target ?? "", value).ready) {
      promptSequence += 1;
      sentencePromptPending = false;
      options.stopSpeech();
    } else if (afterKeyboardInput) {
      speakCurrentWord();
    }
  }

  function submitSentence(): void {
    if (!active.value || finished.value) return;
    const next = submitTypingSentence(state.value, sentences.value);
    if (next === state.value) return;
    state.value = next;
    persist();
    options.stopSpeech();
    // Enter/click confirms the sentence; the next word waits for actual text entry.
    playCurrentPrompt();
  }

  function restartSentence(): void {
    const index = state.value.current;
    state.value = {
      current: index,
      completed: state.value.completed.filter((item) => item !== index),
      drafts: { ...state.value.drafts, [index]: "" },
    };
    persist();
    options.stopSpeech();
    playCurrentPrompt();
  }

  function restartAll(): void {
    state.value = initialTypingState();
    persist();
    options.stopSpeech();
    playCurrentPrompt();
  }

  function setAutoSpeak(value: boolean): void {
    autoSpeak.value = value;
    try { window.localStorage.setItem(autoSpeakKey, String(value)); } catch { /* storage is optional */ }
    if (value) {
      options.stopSpeech();
      playCurrentPrompt();
    } else if (sentencePromptPending) {
      promptSequence += 1;
      sentencePromptPending = false;
      options.stopSpeech();
    }
  }

  function setAutoWord(value: boolean): void {
    autoWord.value = value;
    try { window.localStorage.setItem(autoWordKey, String(value)); } catch { /* storage is optional */ }
  }

  watch(options.sourceText, () => { if (active.value || loading.value) close(); }, { flush: "sync" });
  watch(options.activeView, (view) => { if (view !== "study" && active.value) close(); }, { flush: "sync" });
  onBeforeUnmount(close);

  return {
    active, loading, message, sentences, state, autoSpeak, autoWord, currentSentence, currentDraft,
    completedCount, finished, start, close, chooseSentence, typeDraft, submitSentence, restartSentence,
    restartAll, setAutoSpeak, setAutoWord,
  };
}
