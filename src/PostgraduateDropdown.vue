<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  loadPostgraduateLesson,
  loadPostgraduateManifest,
  type PostgraduateLessonSummary,
  type PostgraduateVolume,
} from "./shared/data/postgraduateLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();

const open = ref(false);
const activeVolumeIndex = ref(0);
const searchQuery = ref("");
const volumes = ref<PostgraduateVolume[]>([]);
const manifestError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");

const activeVolume = computed(() => volumes.value[activeVolumeIndex.value] ?? volumes.value[0]);

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

async function selectLesson(volume: PostgraduateVolume, lesson: PostgraduateLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadPostgraduateLesson(lesson.jsonPath);
    const articleLabel = detail.textLabel ? ` · ${detail.textLabel}` : "";
    const authorLabel = detail.author ? ` · ${detail.author}` : "";
    const lessonLabel = `${volume.title} 第 ${lesson.unitNo} 单元${articleLabel} ${detail.title}`;
    const heading = `研究生英语 ${lessonLabel}${authorLabel}\n`;
    emit("select", {
      course: "postgraduate",
      id: lesson.id,
      path: lesson.jsonPath,
      title: lessonLabel,
      text: heading + detail.text,
    });
    close();
  } catch (error) {
    console.warn("Unable to load postgraduate English lesson", error);
    lessonError.value = "课文暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}

const filteredLessons = computed(() => {
  const volume = activeVolume.value;
  if (!volume) return [];
  const rawQuery = searchQuery.value.trim();
  if (!rawQuery) return volume.lessons;
  const query = rawQuery.toLowerCase();
  return volume.lessons.filter((lesson) => (
    lesson.title.toLowerCase().includes(query) ||
    lesson.theme.toLowerCase().includes(query) ||
    (lesson.author?.toLowerCase().includes(query) ?? false) ||
    (lesson.textLabel?.toLowerCase().includes(query) ?? false) ||
    String(lesson.unitNo).includes(query)
  ));
});

function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="postgraduate"]')) close();
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadPostgraduateManifest()
    .then((manifest) => {
      volumes.value = manifest.volumes;
      manifestError.value = "";
    })
    .catch((error: unknown) => {
      console.warn("Unable to load postgraduate English manifest", error);
      manifestError.value = "课文目录暂时无法加载";
    });
});

onBeforeUnmount(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div class="nce-dropdown" data-course-dropdown="postgraduate">
    <button
      type="button"
      class="study-button"
      :class="{ 'nce-button-active': open }"
      @click="toggle"
    >
      研究生英语
      <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>

    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button
          v-for="(volume, index) in volumes"
          :key="volume.id"
          type="button"
          class="nce-book-tab"
          :class="{ 'nce-book-tab-active': activeVolumeIndex === index }"
          @click="activeVolumeIndex = index; lessonError = ''"
        >
          {{ volume.title }}
          <span class="nce-book-tab-count">
            {{ volume.lessonCount }}
          </span>
        </button>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        class="nce-search"
        placeholder="搜索研究生英语课文..."
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
          @click="selectLesson(activeVolume, lesson)"
        >
          <span class="nce-num">{{ lesson.textLabel ? `${lesson.unitNo}${lesson.textLabel.endsWith("A") ? "A" : "B"}` : lesson.unitNo }}</span>
          <span class="nce-title">
            {{ lesson.title }}
            <small v-if="lesson.author"> · {{ lesson.author }}</small>
          </span>
        </button>
        <p v-if="filteredLessons.length === 0" class="nce-empty">
          {{ volumes.length ? "没有匹配的课文" : "正在加载课文..." }}
        </p>
      </div>
    </div>
  </div>
</template>
