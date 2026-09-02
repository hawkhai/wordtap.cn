<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { loadNceLesson, loadNceManifest, nceBooks, type NceBook, type NceLessonSummary } from "./shared/data/nceLessons";
import type { CourseLessonSelection } from "./shared/types/app";

const emit = defineEmits<{ select: [selection: CourseLessonSelection] }>();

const open = ref(false);
const activeBookIndex = ref(0);
const searchQuery = ref("");
const loadedBooks = ref<NceBook[] | null>(null);
const manifestError = ref("");
const lessonError = ref("");
const loadingLessonId = ref("");

const books = computed(() => loadedBooks.value ?? nceBooks);
const activeBook = computed(() => books.value[activeBookIndex.value] ?? books.value[0]);

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

async function selectLesson(book: NceBook, lesson: NceLessonSummary): Promise<void> {
  if (loadingLessonId.value) {
    return;
  }

  loadingLessonId.value = lesson.id;
  lessonError.value = "";
  try {
    const detail = await loadNceLesson(lesson.jsonPath);
    const bookLabel = book.title.replace("新概念英语 ", "");
    const header = `${bookLabel} Lesson ${lesson.lessonNo} ${detail.titleZh}\n`;
    emit("select", {
      course: "nce",
      id: lesson.id,
      path: lesson.jsonPath,
      title: `${book.title} L${lesson.lessonNo} ${detail.titleZh} ${detail.title}`,
      text: header + detail.text,
    });
    close();
  } catch (error) {
    console.warn("Unable to load NCE lesson", error);
    lessonError.value = "课文暂时无法加载";
  } finally {
    loadingLessonId.value = "";
  }
}

const filteredLessons = computed(() => {
  const book = activeBook.value;
  if (!book || !searchQuery.value.trim()) {
    return book?.lessons ?? [];
  }

  const rawQuery = searchQuery.value.trim();
  const q = rawQuery.toLowerCase();
  return book.lessons.filter((lesson) => {
    const lessonRange = lesson.lessonRange.join("-");
    return (
      lesson.title.toLowerCase().includes(q) ||
      lesson.titleZh.includes(rawQuery) ||
      String(lesson.lessonNo).includes(q) ||
      lessonRange.includes(q)
    );
  });
});

function handleClickOutside(e: MouseEvent): void {
  const target = e.target;
  if (!(target instanceof Element) || !target.closest('[data-course-dropdown="nce"]')) {
    close();
  }
}

async function loadManifest(): Promise<void> {
  try {
    const manifest = await loadNceManifest();
    loadedBooks.value = manifest.books;
    manifestError.value = "";
  } catch (error) {
    console.warn("Unable to load NCE manifest", error);
    manifestError.value = "课文目录暂时无法加载";
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
  <div class="nce-dropdown" data-course-dropdown="nce">
    <button
      type="button"
      class="study-button"
      :class="{ 'nce-button-active': open }"
      @click="toggle"
    >
      新概念英语
      <span class="nce-caret" :class="{ 'nce-caret-open': open }">▼</span>
    </button>

    <div v-if="open" class="nce-panel" @click.stop>
      <div class="nce-book-tabs">
        <button
          v-for="(book, i) in books"
          :key="book.id"
          type="button"
          class="nce-book-tab"
          :class="{ 'nce-book-tab-active': activeBookIndex === i }"
          @click="activeBookIndex = i; lessonError = ''"
        >
          {{ book.title.replace("新概念英语 ", "") }}
          <span class="nce-book-tab-count">{{ book.lessonCount || book.lessons.length }}</span>
        </button>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        class="nce-search"
        placeholder="搜索课文..."
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
          @click="selectLesson(activeBook, lesson)"
        >
          <span class="nce-num">{{ lesson.lessonNo }}</span>
          <span class="nce-title">{{ lesson.titleZh }} {{ lesson.title }}</span>
        </button>
        <p v-if="filteredLessons.length === 0" class="nce-empty">
          {{ loadedBooks ? "没有匹配的课文" : "正在加载课文..." }}
        </p>
      </div>
    </div>
  </div>
</template>
