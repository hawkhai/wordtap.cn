<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  loadKaoyanEnglishLesson,
  loadKaoyanEnglishManifest,
  type KaoyanEnglishGroup,
  type KaoyanEnglishLessonSummary,
} from "./shared/data/kaoyanEnglishLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();
const open = ref(false);
const activeGroupIndex = ref(0);
const searchQuery = ref("");
const groups = ref<KaoyanEnglishGroup[]>([]);
const errorMessage = ref("");
const loadingLessonId = ref("");
const activeGroup = computed(() => groups.value[activeGroupIndex.value] ?? groups.value[0]);
const filteredLessons = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!activeGroup.value) return [];
  const matchingLessons = !query ? activeGroup.value.lessons : activeGroup.value.lessons.filter((lesson) => (
    lesson.title.toLocaleLowerCase().includes(query) || String(lesson.year).includes(query)
  ));
  return [...matchingLessons].sort((left, right) => right.year - left.year);
});

function close(): void { open.value = false; }
function toggle(): void {
  open.value = !open.value;
  if (open.value) { searchQuery.value = ""; errorMessage.value = ""; }
}
async function selectLesson(group: KaoyanEnglishGroup, lesson: KaoyanEnglishLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  errorMessage.value = "";
  try {
    const detail = await loadKaoyanEnglishLesson(lesson.jsonPath);
    emit("select", {
      course: "kaoyan-english",
      id: detail.id,
      path: detail.jsonPath,
      title: detail.title,
      text: `${group.title} · ${detail.title}\n${detail.text}`,
    });
    close();
  } catch (error) {
    console.warn("Unable to load Kaoyan English paper", error);
    errorMessage.value = "考研英语真题暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}
function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="kaoyan-english"]')) close();
}
onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadKaoyanEnglishManifest().then((manifest) => { groups.value = manifest.groups; }).catch((error: unknown) => {
    console.warn("Unable to load Kaoyan English manifest", error);
    errorMessage.value = "考研英语目录暂时无法加载";
  });
});
onBeforeUnmount(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div class="nce-dropdown" data-course-dropdown="kaoyan-english">
    <button type="button" class="study-button" :class="{ 'nce-button-active': open }" :aria-expanded="open" @click="toggle">
      考研英语 <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>
    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button v-for="(group, index) in groups" :key="group.id" type="button" class="nce-book-tab" :class="{ 'nce-book-tab-active': activeGroupIndex === index }" @click="activeGroupIndex = index; errorMessage = ''">
          {{ group.title }} <span class="nce-book-tab-count">{{ group.lessonCount }}</span>
        </button>
      </div>
      <input v-model="searchQuery" type="search" class="nce-search" placeholder="搜索年份..." spellcheck="false" @click.stop>
      <div class="nce-list">
        <p v-if="errorMessage" class="nce-empty">{{ errorMessage }}</p>
        <button v-for="lesson in filteredLessons" :key="lesson.id" type="button" class="nce-item" :disabled="Boolean(loadingLessonId)" @click="selectLesson(activeGroup, lesson)">
          <span class="nce-num">{{ lesson.year }}</span>
          <span class="nce-title">{{ lesson.title }}<small> · {{ lesson.pageCount }} 页</small></span>
        </button>
        <p v-if="!errorMessage && filteredLessons.length === 0" class="nce-empty">{{ groups.length ? "没有匹配的年份" : "正在加载考研英语目录..." }}</p>
      </div>
    </div>
  </div>
</template>
