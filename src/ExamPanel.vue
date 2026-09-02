<script setup lang="ts">
import { ref } from "vue";
import type {
  ExamProgressRecord,
  ExamProgressStatus,
  ExamReviewState,
  ExamWordEncounterRecord,
} from "./shared/stores/historyStore";

type ExamCategory = "all" | "e1" | "e2" | "cet4" | "cet6";
type ExamStatusFilter = "all" | "not-started" | "in-progress" | "completed";
type ExamSubView = "papers" | "words";
type ExamWordDisplay = "list" | "cards";
type ExamPaper = {
  course: "cet" | "kaoyan-english";
  id: string;
  path: string;
  title: string;
  category: Exclude<ExamCategory, "all">;
  categoryLabel: string;
  sortValue: number;
};

const props = defineProps<{
  notice: { title: string; message: string };
  loading: boolean;
  storageAvailable: boolean;
  stats: { inProgress: number; completed: number; words: number };
  recent: ExamProgressRecord[];
  papers: ExamPaper[];
  words: ExamWordEncounterRecord[];
  lessonOptions: Array<{ value: string; label: string }>;
  subView: ExamSubView;
  search: string;
  category: ExamCategory;
  statusFilter: ExamStatusFilter;
  wordSearch: string;
  wordStateFilter: "all" | ExamReviewState;
  wordLessonFilter: string;
  wordDisplay: ExamWordDisplay;
  revealedWordKey: string;
  importing: boolean;
  feedback: string;
  paperStatus: (paper: ExamPaper) => "not-started" | ExamProgressStatus;
}>();

const emit = defineEmits<{
  (event: "update:subView", value: ExamSubView): void;
  (event: "update:search", value: string): void;
  (event: "update:category", value: ExamCategory): void;
  (event: "update:statusFilter", value: ExamStatusFilter): void;
  (event: "update:wordSearch", value: string): void;
  (event: "update:wordStateFilter", value: "all" | ExamReviewState): void;
  (event: "update:wordLessonFilter", value: string): void;
  (event: "update:wordDisplay", value: ExamWordDisplay): void;
  (event: "openPaper", paper: ExamPaper | ExamProgressRecord): void;
  (event: "completePaper", paper: ExamPaper): void;
  (event: "resetPaper", paper: ExamPaper): void;
  (event: "openWord", record: ExamWordEncounterRecord): void;
  (event: "setWordState", record: ExamWordEncounterRecord, state: ExamReviewState): void;
  (event: "toggleWord", record: ExamWordEncounterRecord): void;
  (event: "exportData"): void;
  (event: "importData", value: Event): void;
}>();

const importInput = ref<HTMLInputElement | null>(null);

function statusLabel(status: "not-started" | ExamProgressStatus): string {
  return status === "completed" ? "已完成" : status === "in-progress" ? "学习中" : "未开始";
}

function categoryChanged(event: Event): void {
  emit("update:category", (event.target as HTMLSelectElement).value as ExamCategory);
}
</script>

<template>
  <section class="exam-panel" aria-labelledby="exam-panel-title">
    <header class="exam-panel-head">
      <div>
        <p class="exam-eyebrow">考试内容＋生词复习＋进度记录</p>
        <h2 id="exam-panel-title">考试学习</h2>
        <p>考研英语和英语四六级真题集中学习，所有记录只保存在当前浏览器。</p>
      </div>
      <div class="exam-backup-actions">
        <button type="button" @click="emit('exportData')">导出学习数据</button>
        <button type="button" :disabled="importing" @click="importInput?.click()">
          {{ importing ? "正在导入" : "导入学习数据" }}
        </button>
        <input
          ref="importInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          @change="emit('importData', $event)"
        >
      </div>
    </header>

    <p v-if="feedback" class="exam-data-feedback" role="status">{{ feedback }}</p>

    <div class="exam-notice-banner" role="note">
      <strong>{{ notice.title }}</strong>
      <span>{{ notice.message }}</span>
    </div>
    <p v-if="!storageAvailable" class="exam-storage-alert" role="alert">
      本地进度暂时不可用。你仍可打开真题并点读查词，但本次进度不会保存。
    </p>

    <div class="exam-stats" aria-label="考试学习统计">
      <article><strong>{{ stats.inProgress }}</strong><span>学习中</span></article>
      <article><strong>{{ stats.completed }}</strong><span>已完成</span></article>
      <article><strong>{{ stats.words }}</strong><span>考试生词</span></article>
    </div>

    <nav class="exam-subnav" aria-label="考试面板">
      <button type="button" :class="{ active: subView === 'papers' }" @click="emit('update:subView', 'papers')">真题与进度</button>
      <button type="button" :class="{ active: subView === 'words' }" @click="emit('update:subView', 'words')">考试生词</button>
    </nav>

    <div v-if="loading" class="exam-empty">正在载入考试目录…</div>

    <template v-else-if="subView === 'papers'">
      <section v-if="recent.length" class="exam-recent" aria-labelledby="exam-recent-title">
        <h3 id="exam-recent-title">继续学习</h3>
        <div class="exam-recent-list">
          <button v-for="record in recent" :key="record.key" type="button" @click="emit('openPaper', record)">
            <span>{{ record.title }}</span><small>{{ statusLabel(record.status) }} · 打开 {{ record.openCount }} 次</small>
          </button>
        </div>
      </section>

      <div class="exam-filters">
        <input :value="search" type="search" placeholder="搜索年份或试卷" aria-label="搜索试卷" @input="emit('update:search', ($event.target as HTMLInputElement).value)">
        <select :value="category" aria-label="考试分类" @change="categoryChanged">
          <option value="all">全部考试</option><option value="e1">考研英语一</option><option value="e2">考研英语二</option><option value="cet4">英语四级</option><option value="cet6">英语六级</option>
        </select>
        <select :value="statusFilter" aria-label="学习状态" @change="emit('update:statusFilter', ($event.target as HTMLSelectElement).value as ExamStatusFilter)">
          <option value="all">全部状态</option><option value="not-started">未开始</option><option value="in-progress">学习中</option><option value="completed">已完成</option>
        </select>
      </div>

      <div v-if="!papers.length" class="exam-empty">没有符合条件的试卷。</div>
      <div v-else class="exam-paper-list">
        <article v-for="paper in papers" :key="`${paper.course}:${paper.id}`" class="exam-paper-row">
          <div>
            <span class="exam-category">{{ paper.categoryLabel }}</span>
            <h3>{{ paper.title }}</h3>
          </div>
          <span class="exam-status" :data-status="paperStatus(paper)">{{ statusLabel(paperStatus(paper)) }}</span>
          <div class="exam-row-actions">
            <button type="button" class="primary" @click="emit('openPaper', paper)">{{ paperStatus(paper) === "not-started" ? "开始学习" : "继续学习" }}</button>
            <button v-if="paperStatus(paper) !== 'completed'" type="button" @click="emit('completePaper', paper)">标记完成</button>
            <button v-else type="button" @click="emit('resetPaper', paper)">重置进度</button>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="exam-filters exam-word-filters">
        <input :value="wordSearch" type="search" placeholder="搜索单词、释义或原句" aria-label="搜索考试生词" @input="emit('update:wordSearch', ($event.target as HTMLInputElement).value)">
        <select :value="category" aria-label="考试分类" @change="categoryChanged">
          <option value="all">全部考试</option><option value="e1">考研英语一</option><option value="e2">考研英语二</option><option value="cet4">英语四级</option><option value="cet6">英语六级</option>
        </select>
        <select :value="wordStateFilter" aria-label="复习状态" @change="emit('update:wordStateFilter', ($event.target as HTMLSelectElement).value as 'all' | ExamReviewState)">
          <option value="learning">待复习</option><option value="known">已认识</option><option value="all">全部生词</option>
        </select>
        <select :value="wordLessonFilter" aria-label="来源试卷" @change="emit('update:wordLessonFilter', ($event.target as HTMLSelectElement).value)">
          <option value="all">全部试卷</option><option v-for="option in lessonOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
      <div class="exam-display-toggle" aria-label="生词显示方式">
        <button type="button" :class="{ active: wordDisplay === 'list' }" @click="emit('update:wordDisplay', 'list')">列表</button>
        <button type="button" :class="{ active: wordDisplay === 'cards' }" @click="emit('update:wordDisplay', 'cards')">卡片</button>
      </div>
      <div v-if="!words.length" class="exam-empty">还没有符合条件的考试生词。打开一套真题并点击生词后，它会出现在这里。</div>
      <div v-else :class="wordDisplay === 'cards' ? 'exam-word-cards' : 'exam-word-list'">
        <article v-for="record in words" :key="record.key" class="exam-word-item">
          <button class="exam-word-main" type="button" :aria-expanded="revealedWordKey === record.key" @click="emit('toggleWord', record)">
            <strong>{{ record.word }}</strong><span>{{ record.lessonTitle }}</span><small>遇到 {{ record.count }} 次 · {{ record.reviewState === "known" ? "已认识" : "待复习" }}</small>
          </button>
          <div v-if="revealedWordKey === record.key" class="exam-word-detail">
            <p class="exam-word-meaning">{{ record.meaning || "暂无释义" }}</p>
            <p v-if="record.context" lang="en">{{ record.context }}</p>
          </div>
          <div class="exam-row-actions">
            <button type="button" class="primary" @click="emit('setWordState', record, 'known')">认识</button>
            <button type="button" @click="emit('setWordState', record, 'learning')">再看</button>
            <button type="button" @click="emit('openWord', record)">回到试卷</button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
