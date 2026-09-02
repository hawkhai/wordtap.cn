<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  loadPepEnglishLesson,
  loadPepEnglishManifest,
  type PepEnglishGroup,
  type PepEnglishLessonSummary,
} from "./shared/data/pepEnglishLessons";
import type { CourseLessonSelection } from "./shared/types/app";

type PepEnglishStage = "junior" | "senior";

const props = defineProps<{ stage: PepEnglishStage }>();
const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();

const stageLabel = computed(() => (props.stage === "junior" ? "初中英语" : "高中英语"));
const open = ref(false);
const activeGroupId = ref("");
const searchQuery = ref("");
const groups = ref<PepEnglishGroup[]>([]);
const manifestError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");

const stageGroups = computed(() => {
  return groups.value.filter((group) => group.stage === props.stage);
});

const activeGroup = computed(() => {
  return stageGroups.value.find((group) => group.id === activeGroupId.value) ?? stageGroups.value[0];
});

const filteredLessons = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) {
    return activeGroup.value?.lessons.map((lesson) => ({ group: activeGroup.value!, lesson })) ?? [];
  }
  return stageGroups.value.flatMap((group) => group.lessons
    .filter((lesson) => `${group.title} ${lesson.unitNo} ${lesson.section} ${lesson.title}`.toLocaleLowerCase().includes(query))
    .map((lesson) => ({ group, lesson })));
});

function toggle(): void {
  open.value = !open.value;
  searchQuery.value = "";
  lessonError.value = "";
}

function close(): void {
  open.value = false;
}

async function selectLesson(group: PepEnglishGroup, lesson: PepEnglishLessonSummary): Promise<void> {
  if (loadingLessonId.value) return;
  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadPepEnglishLesson(lesson.jsonPath);
    const unit = detail.unitNo ? `Unit ${detail.unitNo}` : detail.section;
    emit("select", {
      course: "pep-english",
      id: detail.id,
      path: detail.jsonPath,
      title: `${group.stageTitle}${group.title} · ${unit} · ${detail.title}`,
      text: `人教英语 ${group.stageTitle}${group.title} · ${unit} · ${detail.section}\n${detail.title}\n${detail.text}`,
    });
    close();
  } catch (error) {
    console.warn("Unable to load PEP English lesson", error);
    lessonError.value = "课文暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}

function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(`[data-course-dropdown="pep-english-${props.stage}"]`)) close();
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  void loadPepEnglishManifest()
    .then((manifest) => {
      groups.value = manifest.groups;
      activeGroupId.value = manifest.groups.find((group) => group.stage === props.stage)?.id ?? "";
      manifestError.value = "";
    })
    .catch((error: unknown) => {
      console.warn("Unable to load PEP English manifest", error);
      manifestError.value = "人教英语目录暂时无法加载";
    });
});

onBeforeUnmount(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div
    class="nce-dropdown"
    :data-course-dropdown="`pep-english-${stage}`"
  >
    <button
      type="button"
      class="study-button"
      :class="{ 'nce-button-active': open }"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ stageLabel }}
      <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>

    <div v-if="open" class="nce-panel" @click.stop>
      <select
        v-if="stageGroups.length"
        v-model="activeGroupId"
        class="nce-search"
        aria-label="选择教材册"
        @change="lessonError = ''"
      >
        <option v-for="group in stageGroups" :key="group.id" :value="group.id">
          {{ group.title }} · {{ group.lessonCount }} 篇
        </option>
      </select>

      <input
        v-model="searchQuery"
        type="search"
        class="nce-search"
        :placeholder="`搜索${stageLabel}课文...`"
        spellcheck="false"
        @click.stop
        @input="lessonError = ''"
      >

      <p v-if="manifestError" class="nce-empty">{{ manifestError }}</p>
      <div v-else class="nce-list">
        <p v-if="lessonError" class="nce-empty">{{ lessonError }}</p>
        <button
          v-for="item in filteredLessons"
          :key="item.lesson.id"
          type="button"
          class="nce-item"
          :disabled="Boolean(loadingLessonId)"
          @click="selectLesson(item.group, item.lesson)"
        >
          <span class="nce-num">{{ item.lesson.unitNo || item.lesson.sequenceNo }}</span>
          <span class="nce-title">
            {{ item.lesson.title }}<small> · {{ item.group.title }} · {{ item.lesson.section }}</small>
          </span>
        </button>
        <p v-if="filteredLessons.length === 0" class="nce-empty">
          {{ groups.length ? "没有匹配的课文" : "正在加载课文..." }}
        </p>
      </div>
    </div>
  </div>
</template>
