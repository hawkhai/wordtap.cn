<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  loadShuimuLesson,
  loadShuimuManifest,
  type ShuimuLevel,
  type ShuimuLessonSummary,
} from "./shared/data/shuimuLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();

const open = ref(false);
const activeLevelIndex = ref(0);
const searchQuery = ref("");
const levels = ref<ShuimuLevel[]>([]);
const manifestError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");

const activeLevel = computed(() => levels.value[activeLevelIndex.value] ?? levels.value[0]);
const levelLabels: Record<string, string> = {
  phonetics: "国际音标",
  beginner: "初级",
  intermediate: "中级",
  upper: "中高级",
};

function levelLabel(level: ShuimuLevel): string {
  return levelLabels[level.id] ?? level.title;
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) {
    searchQuery.value = "";
    lessonError.value = "";
  }
}

function close(): void {
  open.value = false;
}

async function selectLesson(level: ShuimuLevel, lesson: ShuimuLessonSummary): Promise<void> {
  if (loadingLessonId.value) {
    return;
  }

  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadShuimuLesson(lesson.jsonPath);
    const header = `水木英语 ${level.title} 第 ${lesson.unitNo} 单元 ${detail.title}\n`;
    emit("select", {
      course: "shuimu",
      id: lesson.id,
      path: lesson.jsonPath,
      title: `${level.title} 第 ${lesson.unitNo} 单元 ${detail.title}`,
      text: header + detail.text,
    });
    close();
  } catch (error) {
    console.warn("Unable to load Water & Wood English lesson", error);
    lessonError.value = "课程暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}

const filteredLessons = computed(() => {
  const level = activeLevel.value;
  if (!level) {
    return [];
  }

  const rawQuery = searchQuery.value.trim();
  if (!rawQuery) {
    return level.lessons;
  }

  const q = rawQuery.toLowerCase();
  return level.lessons.filter((lesson) => (
    lesson.title.toLowerCase().includes(q) ||
    lesson.levelId.toLowerCase().includes(q) ||
    String(lesson.unitNo).includes(q)
  ));
});

function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="shuimu"]')) {
    close();
  }
}

async function loadManifest(): Promise<void> {
  try {
    const manifest = await loadShuimuManifest();
    levels.value = manifest.levels;
    manifestError.value = "";
  } catch (error) {
    console.warn("Unable to load Water & Wood English manifest", error);
    manifestError.value = "课程目录暂时无法加载";
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadManifest();
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div class="nce-dropdown" data-course-dropdown="shuimu">
    <button
      type="button"
      class="study-button"
      :class="{ 'nce-button-active': open }"
      @click="toggle"
    >
      水木英语
      <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>

    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button
          v-for="(level, index) in levels"
          :key="level.id"
          type="button"
          class="nce-book-tab"
          :class="{ 'nce-book-tab-active': activeLevelIndex === index }"
          @click="activeLevelIndex = index; lessonError = ''"
        >
          {{ levelLabel(level) }}
          <span class="nce-book-tab-count">{{ level.lessonCount || level.lessons.length }}</span>
        </button>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        class="nce-search"
        placeholder="搜索水木课程..."
        spellcheck="false"
        @click.stop
        @input="lessonError = ''"
      >

      <p v-if="manifestError" class="nce-empty">
        {{ manifestError }}
      </p>

      <div v-else class="nce-list">
        <p v-if="lessonError" class="nce-empty">
          {{ lessonError }}
        </p>
        <button
          v-for="lesson in filteredLessons"
          :key="lesson.id"
          type="button"
          class="nce-item"
          :disabled="Boolean(loadingLessonId)"
          @click="selectLesson(activeLevel, lesson)"
        >
          <span class="nce-num">{{ lesson.unitNo }}</span>
          <span class="nce-title">{{ lesson.title }}</span>
        </button>
        <p v-if="filteredLessons.length === 0" class="nce-empty">
          {{ levels.length ? "没有匹配的课程" : "正在加载课程..." }}
        </p>
      </div>
    </div>
  </div>
</template>
