<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  loadCollegeEnglishLesson,
  loadCollegeEnglishManifest,
  type CollegeEnglishGroup,
  type CollegeEnglishLessonSummary,
} from "./shared/data/collegeEnglishLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();

const open = ref(false);
const activeGroupIndex = ref(0);
const searchQuery = ref("");
const groups = ref<CollegeEnglishGroup[]>([]);
const manifestError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");

const activeGroup = computed(() => groups.value[activeGroupIndex.value] ?? groups.value[0]);
const publishedArticleCount = computed(() => groups.value.reduce((total, group) => total + group.publishedArticleCount, 0));

const filteredLessons = computed(() => {
  const group = activeGroup.value;
  if (!group) return [];
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return group.lessons;
  return group.lessons.filter((lesson) => (
    lesson.title.toLocaleLowerCase().includes(query)
    || lesson.unitTitle.toLocaleLowerCase().includes(query)
    || String(lesson.unitNo).includes(query)
    || lesson.section.toLocaleLowerCase() === query
    || String(lesson.printedPageStart).includes(query)
  ));
});

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

async function selectLesson(group: CollegeEnglishGroup, lesson: CollegeEnglishLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadCollegeEnglishLesson(lesson.jsonPath);
    const title = `${group.title} · Unit ${detail.unitNo} · Section ${detail.section} · ${detail.title}`;
    emit("select", {
      course: "college-english",
      id: detail.id,
      path: detail.jsonPath,
      title,
      text: `新视野大学英语（第四版）${title}\n${detail.text}`,
    });
    close();
  } catch (error) {
    console.warn("Unable to load College English article", error);
    lessonError.value = "教材文章暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}

function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="college-english"]')) close();
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadCollegeEnglishManifest()
    .then((manifest) => {
      groups.value = manifest.groups;
      manifestError.value = "";
    })
    .catch((error: unknown) => {
      console.warn("Unable to load College English manifest", error);
      manifestError.value = "教材目录暂时无法加载";
    });
});

onBeforeUnmount(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div v-if="publishedArticleCount > 0" class="nce-dropdown" data-course-dropdown="college-english">
    <button
      type="button"
      class="study-button"
      :class="{ 'nce-button-active': open }"
      :aria-expanded="open"
      @click="toggle"
    >
      大学英语
      <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>

    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button
          v-for="(group, index) in groups"
          :key="group.id"
          type="button"
          class="nce-book-tab"
          :class="{ 'nce-book-tab-active': activeGroupIndex === index }"
          @click="activeGroupIndex = index; lessonError = ''"
        >
          读写 {{ index + 1 }}
          <span class="nce-book-tab-count">{{ group.lessonCount }}</span>
        </button>
      </div>

      <input
        v-model="searchQuery"
        type="search"
        class="nce-search"
        placeholder="搜索标题、单元或页码..."
        spellcheck="false"
        @click.stop
        @input="lessonError = ''"
      >

      <p v-if="manifestError" class="nce-empty">{{ manifestError }}</p>
      <div v-else class="nce-list">
        <p v-if="lessonError" class="nce-empty">{{ lessonError }}</p>
        <button
          v-for="lesson in filteredLessons"
          :key="lesson.id"
          type="button"
          class="nce-item"
          :disabled="Boolean(loadingLessonId)"
          @click="selectLesson(activeGroup, lesson)"
        >
          <span class="nce-num">{{ lesson.unitNo }}{{ lesson.section }}</span>
          <span class="nce-title">
            {{ lesson.title }}
            <small> · Unit {{ lesson.unitNo }} · Section {{ lesson.section }} · p{{ lesson.printedPageStart }}</small>
          </span>
        </button>
        <p v-if="filteredLessons.length === 0" class="nce-empty">
          {{ groups.length ? "没有匹配的已校对文章" : "正在加载教材目录..." }}
        </p>
      </div>
    </div>
  </div>
</template>
