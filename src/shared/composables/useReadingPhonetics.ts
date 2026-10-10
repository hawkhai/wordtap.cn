import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { ReadingDisplayMode, Segment, WordPhonetic } from "../types/app";
import { phoneticWordKey } from "../utils/readingPhonetics";

const storageKey = "wordtap.readingDisplayMode";
export function useReadingPhonetics(options: {
  sourceText: Ref<string>;
  snapshot: Ref<string>;
  segments: Ref<Segment[]>;
  enabled: Ref<boolean>;
  prepare: () => Promise<boolean>;
  lookup: (word: string) => Promise<WordPhonetic>;
}) {
  let initial: ReadingDisplayMode = "original";
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "annotated" || stored === "phonetic") initial = "annotated";
    // The former phonetic-only preference now means showing IPA alongside the text.
    if (stored === "phonetic") window.localStorage.setItem(storageKey, "annotated");
  } catch { /* Display preferences must not require storage. */ }
  const readingDisplayMode = ref<ReadingDisplayMode>(initial);
  const phonetics = ref<Record<string, WordPhonetic>>({});
  const counts = computed(() => {
    const values = Object.values(phonetics.value);
    return {
      loading: values.filter(x => x.status === "loading").length,
      missing: values.filter(x => x.status === "missing").length,
      error: values.filter(x => x.status === "error").length,
    };
  });
  let generation = 0;
  function invalidate() { generation++; phonetics.value = {}; }
  async function refresh() {
    const run = ++generation;
    phonetics.value = {};
    if (readingDisplayMode.value === "original" || !options.enabled.value ||
      options.sourceText.value.trim() !== options.snapshot.value) return;
    const keys = [...new Set(options.segments.value.filter(s => s.type === "word").map(s => phoneticWordKey(s.text)))];
    phonetics.value = Object.fromEntries(keys.map(key => [key, { status: "loading" }]));
    if (!keys.length) return;
    const prepared = await options.prepare().catch(() => false);
    if (run !== generation) return;
    if (!prepared) {
      phonetics.value = Object.fromEntries(keys.map(key => [key, { status: "error" }]));
      return;
    }
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, keys.length) }, async () => {
      while (run === generation && cursor < keys.length) {
        const key = keys[cursor++]!;
        const result = await options.lookup(key).catch((): WordPhonetic => ({ status: "error" }));
        if (run === generation) phonetics.value[key] = result;
      }
    }));
  }
  // Invalidate immediately, before the reader's debounced segmentation completes.
  watch(options.sourceText, invalidate, { flush: "sync" });
  watch([readingDisplayMode, options.segments, options.enabled], () => { void refresh(); }, { immediate: true });
  watch(readingDisplayMode, value => {
    try { window.localStorage.setItem(storageKey, value); } catch { /* Optional preference. */ }
  }, { flush: "sync" });
  onBeforeUnmount(invalidate);
  function phoneticNotice(word: string): string {
    if (readingDisplayMode.value === "original") return "";
    const result = phonetics.value[phoneticWordKey(word)];
    return result?.status === "missing" ? "暂无音标" : result?.status === "error" ? "音标加载失败，请重试" : "";
  }
  return { readingDisplayMode, phonetics, phoneticCounts: counts, retryPhonetics: refresh, phoneticNotice };
}
