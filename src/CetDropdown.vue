<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { loadCetLesson, loadCetManifest, type CetGroup, type CetLessonSummary } from "./shared/data/cetLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();
const open = ref(false);
const activeGroupIndex = ref(0);
const searchQuery = ref("");
const groups = ref<CetGroup[]>([]);
const errorMessage = ref("");
const loadingLessonId = ref("");
const activeGroup = computed(() => groups.value[activeGroupIndex.value] ?? groups.value[0]);
const filteredLessons = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!activeGroup.value) return [];
  const matchingLessons = !query ? activeGroup.value.lessons : activeGroup.value.lessons.filter((lesson) => (
    lesson.title.toLocaleLowerCase().includes(query)
    || `${lesson.year}-${lesson.month}`.includes(query)
    || (lesson.setNo > 0 && String(lesson.setNo) === query)
  ));
  return [...matchingLessons].sort((left, right) => (
    right.year - left.year
    || right.month - left.month
    || left.setNo - right.setNo
  ));
});

function close(): void { open.value = false; }
function toggle(): void {
  open.value = !open.value;
  if (open.value) { searchQuery.value = ""; errorMessage.value = ""; }
}
async function selectLesson(group: CetGroup, lesson: CetLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  errorMessage.value = "";
  try {
    const detail = await loadCetLesson(lesson.jsonPath);
    emit("select", {
      course: "cet",
      id: detail.id,
      path: detail.jsonPath,
      title: detail.title,
      text: `${group.title} · ${detail.title}\n${detail.text}`,
    });
    close();
  } catch (error) {
    console.warn("Unable to load CET paper", error);
    errorMessage.value = "真题暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}
function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="cet"]')) close();
}
onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadCetManifest().then((manifest) => { groups.value = manifest.groups; }).catch((error: unknown) => {
    console.warn("Unable to load CET manifest", error);
    errorMessage.value = "四六级目录暂时无法加载";
  });
});
onBeforeUnmount(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div class="nce-dropdown" data-course-dropdown="cet">
    <button type="button" class="study-button" :class="{ 'nce-button-active': open }" :aria-expanded="open" @click="toggle">
      英语四六级 <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>
    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button v-for="(group, index) in groups" :key="group.id" type="button" class="nce-book-tab" :class="{ 'nce-book-tab-active': activeGroupIndex === index }" @click="activeGroupIndex = index; errorMessage = ''">
          {{ group.title }} <span class="nce-book-tab-count">{{ group.lessonCount }}</span>
        </button>
      </div>
      <input v-model="searchQuery" type="search" class="nce-search" placeholder="搜索年份、月份或套数..." spellcheck="false" @click.stop>
      <div class="nce-list">
        <p v-if="errorMessage" class="nce-empty">{{ errorMessage }}</p>
        <button v-for="lesson in filteredLessons" :key="lesson.id" type="button" class="nce-item" :disabled="Boolean(loadingLessonId)" @click="selectLesson(activeGroup, lesson)">
          <span class="nce-num">{{ lesson.year }}</span>
          <span class="nce-title">{{ lesson.title }}<small> · {{ lesson.pageCount }} 页</small></span>
        </button>
        <p v-if="!errorMessage && filteredLessons.length === 0" class="nce-empty">{{ groups.length ? "没有匹配的真题" : "正在加载四六级目录..." }}</p>
      </div>
    </div>
  </div>
</template>
