<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useCourseMenuProgress } from "./shared/composables/useCourseMenuProgress";
import { loadEnglishVocabularyManifest, loadEnglishVocabularyIndex, loadEnglishVocabularyLesson, vocabularySelection,
  type EnglishVocabularyGroup, type EnglishVocabularyIndex, type EnglishVocabularyLessonSummary } from "./shared/data/englishVocabularyLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const container = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const progress = useCourseMenuProgress("english-vocabulary", open, searchQuery);
const { activeGroupId, selectedLessonId, listElement, rememberScroll, setGroup, syncGroups, rememberLesson, restoreScroll } = progress;
const groups = ref<EnglishVocabularyGroup[]>([]);
const indexes = ref<Record<string, EnglishVocabularyIndex>>({});
const loading = ref(false);
const indexLoading = ref(false);
const error = ref("");
const indexError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");
const activeGroup = computed(() => groups.value.find(group => group.id === activeGroupId.value));
let indexGeneration = 0;
let disposed = false;

const filteredLessons = computed(() => {
  const group = activeGroup.value;
  if (!group) return [];
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return group.lessons;
  const matches = new Set(indexes.value[group.id]?.lessons.filter(lesson => lesson.words.some(word => word.toLowerCase().includes(query))).map(lesson => lesson.id));
  return group.lessons.filter(lesson => String(lesson.unitNo).includes(query) || matches.has(lesson.id));
});

async function loadIndex(): Promise<void> {
  const generation = ++indexGeneration;
  const group = activeGroup.value;
  indexError.value = "";
  indexLoading.value = false;
  if (!group || indexes.value[group.id]) return;
  indexLoading.value = true;
  try {
    const index = await loadEnglishVocabularyIndex(group.indexPath);
    if (!disposed) indexes.value[group.id] = index;
  } catch {
    if (generation === indexGeneration && !disposed) indexError.value = "词条搜索索引加载失败，请重试。";
  } finally {
    if (generation === indexGeneration && !disposed) indexLoading.value = false;
  }
}
async function loadMenu(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const manifest = await loadEnglishVocabularyManifest();
    if (disposed) return;
    groups.value = manifest.groups;
    syncGroups(manifest.groups.map(group => group.id));
    if (!manifest.groups.length) error.value = "词库目录暂无内容，请重试。";
  } catch {
    if (!disposed) error.value = "词库目录暂时无法加载，请重试。";
  } finally {
    loading.value = false;
  }
}
function close(restoreFocus = false): void {
  rememberScroll();
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
async function toggle(): Promise<void> {
  if (open.value) { close(); return; }
  searchQuery.value = "";
  lessonError.value = "";
  open.value = true;
  if (!groups.value.length && !loading.value) await loadMenu();
  await nextTick();
  container.value?.querySelector<HTMLSelectElement>("select")?.focus();
}
async function selectLesson(lesson: EnglishVocabularyLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadEnglishVocabularyLesson(lesson.jsonPath);
    if (disposed) return;
    rememberLesson(lesson.groupId, lesson.id);
    emit("select", vocabularySelection(detail));
    close(true);
  } catch {
    if (!disposed) lessonError.value = "单元加载失败，请再次选择该单元重试。";
  } finally {
    loadingLessonId.value = "";
  }
}
function outside(event: MouseEvent): void {
  if (event.target instanceof Node && !container.value?.contains(event.target)) close();
}
// A restored group ID already exists before the manifest arrives. Watch the
// resolved group so reopening after a reload loads its search index as well.
watch(activeGroup, () => { lessonError.value = ""; void loadIndex(); });
watch(searchQuery, () => { if (!searchQuery.value.trim()) void restoreScroll(); });
watch(open, value => {
  if (value) document.addEventListener("mousedown", outside);
  else document.removeEventListener("mousedown", outside);
});
onBeforeUnmount(() => { disposed = true; indexGeneration++; document.removeEventListener("mousedown", outside); });
</script>

<template>
  <div ref="container" class="nce-dropdown" data-course-dropdown="english-vocabulary" @keydown.esc.stop="close(true)">
    <button ref="trigger" type="button" class="study-button" :class="{ 'nce-button-active': open }" :aria-expanded="open" @click="toggle">
      英语词汇 <span class="nce-caret" :class="{ 'nce-caret-open': open }" aria-hidden="true">▼</span>
    </button>
    <div v-if="open" class="nce-panel vocabulary-menu" @click.stop>
      <p v-if="loading" class="nce-empty" role="status">正在加载词库…</p>
      <div v-else-if="error" class="nce-empty" role="alert">{{ error }} <button type="button" class="study-button" @click="loadMenu">重试</button></div>
      <template v-else>
        <label class="vocabulary-book-label">选择词库
          <select :value="activeGroupId" aria-label="选择词库" class="nce-search vocabulary-book-select" @change="setGroup(($event.target as HTMLSelectElement).value)">
            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.title }} · {{ group.wordCount }} 词</option>
          </select>
        </label>
        <input v-model="searchQuery" class="nce-search" type="search" aria-label="搜索当前词库的单词或单元编号" placeholder="搜索单词或单元编号…" spellcheck="false">
        <p v-if="indexLoading" class="vocabulary-menu-note" role="status">正在加载词条搜索…</p>
        <div v-if="indexError" class="vocabulary-menu-note" role="alert">{{ indexError }} <button type="button" class="study-button" @click="loadIndex">重试</button></div>
        <p v-if="lessonError" class="vocabulary-menu-note" role="alert">{{ lessonError }}</p>
        <div ref="listElement" class="nce-list" @scroll="rememberScroll">
          <button v-for="lesson in filteredLessons" :key="lesson.id" type="button" class="nce-item"
            :class="{ 'nce-item-last-selected': selectedLessonId === lesson.id }" :data-lesson-id="lesson.id"
            :aria-current="selectedLessonId === lesson.id ? 'true' : undefined" :disabled="Boolean(loadingLessonId)" @click="selectLesson(lesson)">
            <span class="nce-num">{{ lesson.unitNo }}</span>
            <span class="nce-title">{{ lesson.title }}<small class="vocabulary-unit-count">{{ loadingLessonId === lesson.id ? '加载中…' : `${lesson.wordCount} 词` }}</small></span>
          </button>
          <p v-if="!filteredLessons.length && !indexLoading && !indexError" class="nce-empty">没有匹配的单元</p>
        </div>
      </template>
    </div>
  </div>
</template>
