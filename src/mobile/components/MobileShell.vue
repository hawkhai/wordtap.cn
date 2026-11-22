<script setup lang="ts">
import GatewayUpdateNotice from "../../shared/components/GatewayUpdateNotice.vue";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ReadingDisplayControls from "../../shared/components/ReadingDisplayControls.vue";
import ReadingText from "../../shared/components/ReadingText.vue";
import ArticleTypingPanel from "../../shared/components/ArticleTypingPanel.vue";
import BrandIdentity from "../../shared/components/BrandIdentity.vue";
import ThemeSelect from "../../shared/components/ThemeSelect.vue";
import ProjectLink from "../../shared/components/ProjectLink.vue";
import ArticleTypingOptions from "../../shared/components/ArticleTypingOptions.vue";
import MaterialSubmission from "../../shared/components/MaterialSubmission.vue";
import ArticleInputHint from "../../shared/components/ArticleInputHint.vue";
import SpeechLanguageHint from "../../shared/components/SpeechLanguageHint.vue";
import MobileStudyDialog from "./MobileStudyDialog.vue";
import { useWordTap } from "../../shared/composables/useWordTap";
import { useArticleTyping } from "../../shared/composables/useArticleTyping";
import { isIpadBrowser, isWindows } from "../../shared/utils/device";
import IpaPanel from "../../IpaPanel.vue";
import ExamPanel from "../../ExamPanel.vue";
import NceDropdown from "../../NceDropdown.vue";
import ShuimuDropdown from "../../ShuimuDropdown.vue";
import EnglishVocabularyDropdown from "../../EnglishVocabularyDropdown.vue";
import PostgraduateDropdown from "../../PostgraduateDropdown.vue";
import PepEnglishDropdown from "../../PepEnglishDropdown.vue";
import CollegeEnglishDropdown from "../../CollegeEnglishDropdown.vue";
import CetDropdown from "../../CetDropdown.vue";
import KaoyanEnglishDropdown from "../../KaoyanEnglishDropdown.vue";
import { loadCollegeEnglishManifest } from "../../shared/data/collegeEnglishLessons";
import type { CourseLessonSelection } from "../../shared/types/app";

const showGatewayGuide = computed(() => !isGatewayRunning.value && isWindows());
const isIpad = isIpadBrowser();

function appSectionUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const parts = window.location.pathname.split("/").filter(Boolean);
  const sectionIndex = parts.findIndex((part) => part === "exam" || part === "pep-english" || part === "nce" || part === "shuimu" || part === "postgraduate" || part === "college-english" || part === "cet" || part === "kaoyan-english" || part === "english-vocabulary");
  const baseParts = sectionIndex >= 0 ? parts.slice(0, sectionIndex) : parts;
  const lastPart = baseParts.at(-1) ?? "";
  const baseDirectory = lastPart.includes(".") ? baseParts.slice(0, -1) : baseParts;
  const basePath = `/${baseDirectory.join("/")}${baseDirectory.length ? "/" : ""}`;
  return new URL(normalizedPath, window.location.origin + basePath).toString();
}

const shuimuUrl = computed(() => appSectionUrl("shuimu/"));
const nceUrl = computed(() => appSectionUrl("nce/"));
const vocabularyUrl = computed(() => appSectionUrl("english-vocabulary/"));
const postgraduateUrl = computed(() => appSectionUrl("postgraduate/"));
const pepEnglishUrl = computed(() => appSectionUrl("pep-english/"));
const collegeEnglishUrl = computed(() => appSectionUrl("college-english/"));
const cetUrl = computed(() => appSectionUrl("cet/"));
const kaoyanEnglishUrl = computed(() => appSectionUrl("kaoyan-english/"));
const examUrl = computed(() => appSectionUrl("exam/"));
const collegeEnglishAvailable = ref(false);

onMounted(() => {
  void loadCollegeEnglishManifest()
    .then((collegeManifest) => {
      collegeEnglishAvailable.value = collegeManifest.publishedArticleCount > 0;
    })
    .catch(() => {
      collegeEnglishAvailable.value = false;
    });
});

const {
  copy, defaultText, rateOptions, rateOptionLabels, repeatOptions,
  translateModeOptions, defaultGatewayVoice, gatewayVoiceOptions, fallbackDictionary,
  logoMarkUrl, feedbackEmailUrl, wordTapWindowsDownloadUrl,
  gatewayDownloadUrl, gatewayReleaseManifestUrl,
  readingDisplayMode, phonetics, phoneticCounts, retryPhonetics, phoneticNotice,
  readingRuns, readingParagraphs, activeParagraphId, activeSentenceId, playingSentenceId, isFullTextPaused, sentenceSpeechState, paragraphSpeechState, sentenceSpeechDisabled, readSentence, readParagraph,
  speakArticleTypingSentence, speakArticleTypingWord,
  sourceText, sourceReady, segments, selectedSegmentId, status,
  dictionaryInfo, selectedRate, selectedRepeat, selectedTranslateMode,
  isWordSpeaking, isFullTextSpeaking, browserSpeechSupported, isGatewayRunning,
  manifest, availableShardNames, availableVoices, historyRecords, textHistoryRecords,
  selectedTextHistoryId, reviewSearch, selectedReviewKey, historyImportInput, reviewList,
  historyImporting, markLearned, selectedBrowserVoiceUri, selectedGatewayVoice,
  examNotice, examPapers, examProgressRecords, examWordRecords, examLoading, examStorageAvailable,
  examSearch, examCategory, examStatusFilter, examSubView, examWordSearch,
  examWordStateFilter, examWordLessonFilter, examWordDisplay, revealedExamWordKey, examDataImporting, examDataFeedback,
  activeView, diagnostics, diagnosticsRunning, diagnosticsUpdatedAt,
  audioCacheClearing, audioCacheSummary, translationCacheClearing, translationCacheSummary,
  activeCourseLesson, lessonShareUrlCopied, wordPopover, reviewContextMenu,
  wordCount, wordCountLabel, isSpeaking, historyStats, learnedWordKeys,
  filteredHistory, reviewContextRecord, textHistoryEmptyLabel, reviewEmptyText,
  mobileBrowser, browserVoiceOptions, browserVoiceSelectOptions, isHttpsPage,
  gatewayStatusLabel, gatewayUpdateAvailable, installedGatewayVersion, latestGatewayVersion, refreshGatewayStatus, diagnosticsSummary,
  examStats, recentExamProgress, filteredExamPapers, filteredExamWords, examWordLessonOptions,
  setActiveView, announceTranslateModeChange, learnedClassForWord,
  hideWordPopover, hideReviewContextMenu,
  cleanDictionaryText, readFullText, fullTextSpeechLabel, fullTextSpeechWaiting, fullTextSpeechNotice, fullTextSpeechDisabled, wordSpeechDisabled, cancelSpeech, splitWords,
  loadTextHistoryRecord, deleteSelectedTextHistoryRecord,
  deleteHistoryRecord, refreshReviewRecords, exportReviewRecords,
  chooseHistoryImportFile, importReviewRecords, formatHistoryTime,
  selectReviewRecord, showReviewContextMenu, showReviewContextMenuAt, handleReviewRowKeydown,
  speakHistoryRecord, speakReviewContextRecord, deleteReviewContextRecord,
  diagnosticStatusText, diagnosticStatusClass, runDiagnostics,
  clearGatewayAudioCache, clearStoredTranslationCache,
  handleGatewayDownload, handleWordTapWindowsDownload, studyWord,
  loadCourseLessonSelection, copyActiveCourseLessonUrl,
  openExamPaper, openExamWordSource, examPaperStatus, markExamPaperCompleted, resetExamPaper,
  setExamWordReviewState, toggleExamWordReveal, exportCompleteLearningData, importCompleteLearningData,
} = useWordTap();

const articleSourceInput = ref<HTMLTextAreaElement | null>(null);
const readingTitle = ref<HTMLElement | null>(null);
const readingSurface = ref<HTMLElement | null>(null);
const coursesOpen = ref(false);
const editorOpen = ref(false);
const articleToolsOpen = ref(false);
const moreOpen = ref(false);
let dialogTrigger: HTMLElement | null = null;
let lessonSelected = false;
let nextArticleAction: "courses" | "editor" | "typing" | null = null;

function openDialog(event: MouseEvent, target: "courses" | "editor" | "article-tools" | "more"): void {
  dialogTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  hideWordPopover();
  if (target === "courses") coursesOpen.value = true;
  else if (target === "editor") editorOpen.value = true;
  else if (target === "article-tools") articleToolsOpen.value = true;
  else moreOpen.value = true;
}

function restoreDialogFocus(): void {
  const target = dialogTrigger?.isConnected ? dialogTrigger : readingTitle.value;
  target?.focus({ preventScroll: true });
  dialogTrigger = null;
}

function handleCourseDialogClose(): void {
  const selected = lessonSelected;
  lessonSelected = false;
  if (!selected || activeView.value !== "study") {
    restoreDialogFocus();
    return;
  }
  dialogTrigger = null;
  readingTitle.value?.focus({ preventScroll: true });
  readingSurface.value?.scrollIntoView({ block: "start", behavior: "instant" });
}

function chooseArticleAction(action: NonNullable<typeof nextArticleAction>): void {
  nextArticleAction = action;
  articleToolsOpen.value = false;
}

function handleArticleToolsClose(): void {
  const action = nextArticleAction;
  nextArticleAction = null;
  if (activeView.value === "study") {
    if (action === "courses") {
      coursesOpen.value = true;
      return;
    }
    if (action === "editor") {
      editorOpen.value = true;
      return;
    }
  }
  restoreDialogFocus();
  if (action === "typing" && activeView.value === "study") startArticleTyping();
}

async function revealCourseMenu(event: MouseEvent): Promise<void> {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest(".nce-dropdown > .study-button");
  if (!button) return;

  await nextTick();
  button.parentElement?.querySelector(".nce-panel")?.scrollIntoView({ block: "nearest" });
}

watch(activeView, () => {
  coursesOpen.value = false;
  editorOpen.value = false;
  articleToolsOpen.value = false;
  moreOpen.value = false;
});

const {
  active: typingActive, loading: typingLoading, message: typingMessage,
  sentences: typingSentences, state: typingState, autoSpeak: typingAutoSpeak, autoWord: typingAutoWord,
  currentSentence: typingCurrentSentence, currentDraft: typingCurrentDraft,
  completedCount: typingCompletedCount, finished: typingFinished,
  start: startTyping, close: closeTyping, chooseSentence: chooseTypingSentence,
  typeDraft: typeTypingDraft, submitSentence: submitTypingSentence, restartSentence: restartTypingSentence,
  restartAll: restartTypingAll, setAutoSpeak: setTypingAutoSpeak, setAutoWord: setTypingAutoWord,
} = useArticleTyping({
  sourceText, activeCourseLesson, activeView, speechDisabled: fullTextSpeechDisabled, wordSpeechDisabled,
  speak: speakArticleTypingSentence, speakWord: speakArticleTypingWord, stopSpeech: () => cancelSpeech(),
});

function startArticleTyping(): void {
  void startTyping(articleSourceInput.value?.selectionStart ?? 0, articleSourceInput.value?.selectionEnd ?? 0);
}

async function exitArticleTyping(): Promise<void> {
  closeTyping();
  await nextTick();
  readingTitle.value?.focus({ preventScroll: true });
}

function handleCourseLessonSelect(selection: CourseLessonSelection): void {
  if (!coursesOpen.value) return;
  lessonSelected = true;
  void loadCourseLessonSelection(selection);
  coursesOpen.value = false;
}

// Long-press support for mobile review context menu
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
const longPressRecord = ref<InstanceType<typeof Object> | null>(null);

function onTouchStart(record: any, event: TouchEvent) {
  longPressRecord.value = record;
  const touch = event.touches[0];
  longPressTimer = setTimeout(() => {
    showReviewContextMenuAt(record, touch.clientX, touch.clientY);
    longPressTimer = null;
  }, 500);
}

function onTouchMove(event: TouchEvent) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

onUnmounted(() => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
});
</script>

<template>
  <main class="study-shell study-mobile-shell mx-auto grid min-h-screen w-full max-w-[88rem] gap-4 py-5"
    :class="{ 'study-mobile-shell-tablet': isIpad }">
    <section class="study-workspace" :aria-label="copy.template.workspaceAria">
      <header class="study-brandbar">
        <div class="brand-lockup">
          <img :src="logoMarkUrl" alt="" class="brand-mark" aria-hidden="true">
          <BrandIdentity :name="copy.brand.name" :domain="copy.brand.domain" :tagline="copy.template.brandTagline" />
        </div>
        <div class="study-mobile-nav-row">
          <nav class="study-nav" :aria-label="copy.template.mainNavAria">
            <button
              type="button"
              class="study-nav-button"
              :class="{ 'study-nav-button-active': activeView === 'study' }"
              :aria-current="activeView === 'study' ? 'page' : undefined"
              @click="setActiveView('study')"
            >
              {{ copy.template.navStudy }}
            </button>
            <button
              type="button"
              class="study-nav-button"
              :class="{ 'study-nav-button-active': activeView === 'review' }"
              :aria-current="activeView === 'review' ? 'page' : undefined"
              @click="setActiveView('review')"
            >
              {{ copy.template.navReview }}
            </button>
            <button
              type="button"
              class="study-nav-button"
              :class="{ 'study-nav-button-active': activeView === 'ipa' }"
              :aria-current="activeView === 'ipa' ? 'page' : undefined"
              @click="setActiveView('ipa')"
            >
              {{ copy.template.navIpa }}
            </button>
          </nav>
          <button type="button" class="study-button study-mobile-quiet-action study-mobile-more" aria-haspopup="dialog"
            @click="openDialog($event, 'more')">更多</button>
        </div>
      </header>

      <div v-if="activeView === 'study'" class="study-mobile-learning">
        <section
          ref="readingSurface"
          class="study-reading-surface"
          aria-labelledby="study-title"
        >
          <div class="study-reading-head study-mobile-reading-head">
            <div class="study-mobile-reading-title">
              <h2 id="study-title" ref="readingTitle" tabindex="-1" class="study-panel-title">
                {{ typingActive ? '文章跟打' : copy.template.readerTitle }}
              </h2>
              <p v-if="sourceReady && sourceText.trim()" class="study-count"
                data-testid="word-count" :aria-live="typingActive ? 'polite' : 'off'">
                <template v-if="typingActive">已完成 {{ typingCompletedCount }} / {{ typingSentences.length }} 句</template>
                <template v-else>{{ wordCountLabel }}</template>
              </p>
            </div>
            <button v-if="typingActive" type="button" class="study-button study-mobile-quiet-action study-mobile-end-action"
              @click="exitArticleTyping">
              退出跟打
            </button>
            <button v-else-if="sourceReady && sourceText.trim()" type="button"
              class="study-button study-mobile-quiet-action study-mobile-end-action"
              aria-haspopup="dialog" @click="openDialog($event, 'courses')">
              选课程
            </button>
          </div>
          <ReadingDisplayControls v-if="sourceText.trim() || typingActive" :show-modes="!typingActive" :show-toggle="false"
            :speech-notice="fullTextSpeechNotice"
            v-model="readingDisplayMode" :counts="phoneticCounts" @retry="retryPhonetics"
          >
            <template #actions>
              <div class="study-mobile-reading-actions">
                <button
                  type="button"
                  class="study-button study-fulltext-button study-mobile-speech-button"
                  :class="{ 'study-mobile-quiet-action': typingActive }"
                  :disabled="fullTextSpeechDisabled && !isFullTextSpeaking"
                  :title="fullTextSpeechDisabled && !isFullTextSpeaking ? copy.status.fullTextSpeechUnavailable : fullTextSpeechWaiting ? '点击可暂停准备中的朗读' : undefined"
                  @click="readFullText()"
                >
                  <span class="study-mobile-speech-label">
                    <span v-if="fullTextSpeechWaiting" class="study-speech-spinner" aria-hidden="true"></span>
                    {{ fullTextSpeechLabel }}
                  </span>
                </button>
                <button
                  v-if="isSpeaking"
                  type="button"
                  class="study-button study-mobile-quiet-action"
                  @click="cancelSpeech(copy.status.stoppedSpeech)"
                >
                  {{ copy.template.stop }}
                </button>
                <button type="button" class="study-button study-mobile-quiet-action study-mobile-end-action"
                  aria-haspopup="dialog" @click="openDialog($event, 'article-tools')">
                  文章工具
                </button>
              </div>
            </template>
          </ReadingDisplayControls>
          <p class="study-mobile-feedback" role="status" data-testid="status-text">
            {{ sourceReady ? (typingMessage || status) : "正在打开文章…" }}
          </p>
          <div v-if="sourceReady && !sourceText.trim()" class="study-mobile-empty-actions">
            <button type="button" class="study-button study-button-primary" aria-haspopup="dialog"
              @click="openDialog($event, 'courses')">选课程</button>
            <button type="button" class="study-button study-mobile-quiet-action" aria-haspopup="dialog"
              @click="openDialog($event, 'editor')">粘贴文章</button>
          </div>
          <ArticleTypingPanel v-if="typingActive"
            :sentences="typingSentences" :state="typingState"
            :current-sentence="typingCurrentSentence" :current-draft="typingCurrentDraft"
            :completed-count="typingCompletedCount" :finished="typingFinished"
            :speech-disabled="fullTextSpeechDisabled"
            :selected-id="selectedSegmentId" :learned-class="learnedClassForWord"
            @choose="chooseTypingSentence" @input="typeTypingDraft" @submit="submitTypingSentence"
            @restart-sentence="restartTypingSentence" @restart-all="restartTypingAll"
            @speak="speakArticleTypingSentence"
            @word="studyWord"
          />
          <ReadingText v-else-if="sourceText.trim()"
            :runs="readingRuns" :paragraphs="readingParagraphs" :active-paragraph-id="activeParagraphId" :paragraph-state="paragraphSpeechState"
            :playing-sentence-id="playingSentenceId" :paused="isFullTextPaused" :display-mode="readingDisplayMode" :phonetics="phonetics"
            :selected-id="selectedSegmentId"
            :learned-class="learnedClassForWord"
            :active-sentence-id="activeSentenceId"
            :sentence-state="sentenceSpeechState"
            :disabled="sentenceSpeechDisabled"
            @word="studyWord"
            @sentence="readSentence" @paragraph="readParagraph"
          />
        </section>
        <aside
          v-if="wordPopover.visible"
          class="study-word-popover study-word-popover-mobile"
          role="dialog"
          aria-live="polite"
          :aria-label="copy.template.wordPopoverAria"
        >
          <strong class="study-word-popover-word">{{ wordPopover.word }}</strong>
          <p v-if="!typingActive && phoneticNotice(wordPopover.word)" class="study-phonetic-notice">{{ phoneticNotice(wordPopover.word) }}</p>
          <div class="study-word-popover-meaning whitespace-pre-wrap">
            {{ wordPopover.meaning }}
          </div>
        </aside>
      </div>

      <ExamPanel
        v-else-if="activeView === 'exam'"
        v-model:sub-view="examSubView"
        v-model:search="examSearch"
        v-model:category="examCategory"
        v-model:status-filter="examStatusFilter"
        v-model:word-search="examWordSearch"
        v-model:word-state-filter="examWordStateFilter"
        v-model:word-lesson-filter="examWordLessonFilter"
        v-model:word-display="examWordDisplay"
        :notice="examNotice"
        :loading="examLoading"
        :storage-available="examStorageAvailable"
        :stats="examStats"
        :recent="recentExamProgress"
        :papers="filteredExamPapers"
        :words="filteredExamWords"
        :lesson-options="examWordLessonOptions"
        :revealed-word-key="revealedExamWordKey"
        :importing="examDataImporting"
        :feedback="examDataFeedback"
        :paper-status="examPaperStatus"
        @open-paper="openExamPaper"
        @complete-paper="markExamPaperCompleted"
        @reset-paper="resetExamPaper"
        @open-word="openExamWordSource"
        @set-word-state="setExamWordReviewState"
        @toggle-word="toggleExamWordReveal"
        @export-data="exportCompleteLearningData"
        @import-data="importCompleteLearningData"
      />

      <section
        v-else-if="activeView === 'review'"
        class="study-review"
        aria-labelledby="review-title"
      >
        <div class="study-review-head flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="review-title"
              class="study-panel-title text-lg font-semibold"
            >
              {{ copy.template.navReview }}
            </h2>
            <p class="study-review-summary mt-1 text-sm">
              {{ copy.template.reviewSummary(historyStats.wordTotal, historyStats.clickTotal) }}
            </p>
          </div>
          <div class="study-toolbar flex flex-wrap">
            <button
              type="button"
              class="study-button"
              :disabled="historyImporting"
              @click="chooseHistoryImportFile"
            >
              {{ historyImporting ? copy.template.importingWords : copy.template.importWords }}
            </button>
            <button
              type="button"
              class="study-button"
              :disabled="!historyRecords.length"
              @click="exportReviewRecords"
            >
              {{ copy.template.exportWords }}
            </button>
            <input
              ref="historyImportInput"
              class="sr-only"
              type="file"
              accept="application/json,.json"
              @change="importReviewRecords"
            >
          </div>
        </div>
        <input
          v-model="reviewSearch"
          class="study-search mt-4 h-10 w-full rounded-md px-3"
          type="search"
          :aria-label="copy.template.historySearchPlaceholder"
          :placeholder="copy.template.historySearchPlaceholder"
          data-testid="history-search"
        >
        <div
          v-if="!filteredHistory.length"
          class="study-review-empty mt-4 rounded-md p-4 text-sm"
        >
          {{ reviewEmptyText }}
        </div>
        <div
          v-else
          ref="reviewList"
          class="study-review-list mt-4"
          data-testid="history-list"
        >
          <article
            v-for="record in filteredHistory"
            :key="record.key"
            class="study-review-row"
            :class="{ 'study-review-row-selected': record.key === selectedReviewKey }"
            tabindex="0"
            :aria-current="record.key === selectedReviewKey ? 'true' : undefined"
            @click="speakHistoryRecord(record)"
            @contextmenu="showReviewContextMenu(record, $event)"
            @keydown="handleReviewRowKeydown($event, record)"
            @touchstart.passive="onTouchStart(record, $event)"
            @touchmove.passive="onTouchMove($event)"
            @touchend="onTouchEnd()"
          >
            <span class="study-review-word">
              {{ record.word }}
            </span>
            <div class="study-review-meaning whitespace-pre-wrap">
              {{ record.meaning || copy.template.noMeaning }}
            </div>
            <div class="study-review-meta">
              <span>{{ copy.template.recordCount(record.count) }}</span>
              <span>{{ copy.template.firstSeen(formatHistoryTime(record.firstSeen)) }}</span>
              <span>{{ copy.template.lastSeen(formatHistoryTime(record.lastSeen)) }}</span>
            </div>
            <button
              type="button"
              class="study-review-delete"
              @click.stop="deleteHistoryRecord(record)"
              @dblclick.stop
              @keydown.stop
            >
              {{ copy.template.deleteWord }}
            </button>
          </article>
        </div>
        <aside
          v-if="reviewContextMenu.visible && reviewContextRecord"
          class="study-review-context-menu"
          :style="{ left: `${reviewContextMenu.x}px`, top: `${reviewContextMenu.y}px` }"
          role="menu"
          :aria-label="copy.template.wordActionsAria(reviewContextRecord.word)"
          @click.stop
          @touchstart.stop.prevent
          @contextmenu.prevent
        >
          <button
            type="button"
            role="menuitem"
            @click="speakReviewContextRecord"
          >
            {{ copy.template.speak }}
          </button>
          <button
            type="button"
            role="menuitem"
            class="study-review-context-danger"
            @click="deleteReviewContextRecord"
          >
            {{ copy.template.deleteWord }}
          </button>
        </aside>
      </section>

      <IpaPanel v-else-if="activeView === 'ipa'" />

      <section
        v-else
        class="study-diagnostics"
        aria-labelledby="diagnostics-title"
      >
        <div class="study-diagnostics-head flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="diagnostics-title"
              class="study-panel-title text-lg font-semibold"
            >
              {{ copy.template.navDiagnostics }}
            </h2>
            <p class="study-diagnostics-summary mt-1 text-sm">
              {{ diagnostics.length ? diagnosticsSummary : copy.template.diagnosticsSummaryEmpty }}
            </p>
          </div>
          <button
            type="button"
            class="study-button study-button-primary"
            :disabled="diagnosticsRunning"
            @click="runDiagnostics"
          >
            {{ diagnosticsRunning ? copy.template.diagnosticsRunning : copy.template.diagnosticsStart }}
          </button>
        </div>
        <div
          v-if="diagnosticsUpdatedAt"
          class="study-diagnostics-updated mt-3 text-sm"
        >
          {{ copy.template.diagnosticsUpdated(diagnosticsUpdatedAt) }}
        </div>
        <div class="study-diagnostics-list mt-4">
          <article
            v-for="item in diagnostics"
            :key="item.id"
            class="study-diagnostic-row"
          >
            <div>
              <h3 class="study-diagnostic-label">
                {{ item.label }}
              </h3>
              <p class="study-diagnostic-detail">
                {{ item.detail }}
              </p>
            </div>
            <span
              class="study-diagnostic-status"
              :class="diagnosticStatusClass(item.status)"
            >
              {{ diagnosticStatusText(item.status) }}
            </span>
          </article>
        </div>
        <details class="study-secondary-tools mt-4">
          <summary class="study-secondary-tools-summary">
            {{ copy.template.clearSavedContent }}
          </summary>
          <div class="study-cache-tool-list mt-3">
            <div class="study-cache-tools">
              <div>
                <h3 class="study-cache-tools-title">
                  {{ copy.template.savedAudioTitle }}
                </h3>
                <p class="study-cache-tools-detail">
                  {{ audioCacheSummary }}
                </p>
              </div>
              <button
                type="button"
                class="study-button"
                :disabled="audioCacheClearing"
                @click="clearGatewayAudioCache"
              >
                {{ audioCacheClearing ? copy.template.clearing : copy.template.clearAudio }}
              </button>
            </div>
            <div class="study-cache-tools">
              <div>
                <h3 class="study-cache-tools-title">
                  {{ copy.template.savedLookupTitle }}
                </h3>
                <p class="study-cache-tools-detail">
                  {{ translationCacheSummary }}
                </p>
              </div>
              <button
                type="button"
                class="study-button"
                :disabled="translationCacheClearing"
                @click="clearStoredTranslationCache"
              >
                {{ translationCacheClearing ? copy.template.clearing : copy.template.clearLookup }}
              </button>
            </div>
          </div>
        </details>
      </section>
    </section>

    <section
      v-if="activeView === 'study'"
      class="study-info py-8"
      aria-labelledby="about-wordtap-title"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article class="space-y-3">
          <h2
            id="about-wordtap-title"
            class="text-xl font-semibold"
          >
            {{ copy.template.aboutTitle }}
          </h2>
          <p class="leading-7">
            {{ copy.template.aboutParagraphs[0] }}
          </p>
          <p class="leading-7">
            {{ copy.template.aboutParagraphs[1] }}
          </p>
        </article>

        <article class="space-y-3">
          <h2 class="text-xl font-semibold">{{ copy.template.quietTitle }}</h2>
          <p class="leading-7">
            {{ copy.template.quietParagraphs[0] }}
          </p>
          <p class="leading-7">
            {{ copy.template.quietParagraphs[1] }}
          </p>
        </article>
      </div>

      <div class="mt-7 grid gap-4 md:grid-cols-3">
        <section>
          <h3 class="text-base font-semibold">{{ copy.template.audienceCards[0].title }}</h3>
          <p class="mt-2 leading-7">
            {{ copy.template.audienceCards[0].body }}
          </p>
        </section>
        <section>
          <h3 class="text-base font-semibold">{{ copy.template.audienceCards[1].title }}</h3>
          <p class="mt-2 leading-7">
            {{ copy.template.audienceCards[1].body }}
          </p>
        </section>
        <section>
          <h3 class="text-base font-semibold">{{ copy.template.audienceCards[2].title }}</h3>
          <p class="mt-2 leading-7">
            {{ copy.template.audienceCards[2].body }}
          </p>
        </section>
      </div>
    </section>

    <MobileStudyDialog v-model="articleToolsOpen" title="文章工具" @close="handleArticleToolsClose">
      <div class="study-mobile-action-list">
        <button v-if="typingActive" type="button" class="study-button study-mobile-quiet-action study-mobile-action-row"
          aria-haspopup="dialog" @click="chooseArticleAction('courses')">选课程</button>
        <button type="button" class="study-button study-mobile-quiet-action study-mobile-action-row"
          aria-haspopup="dialog" @click="chooseArticleAction('editor')">编辑文章</button>
        <button v-if="!typingActive" type="button" class="study-button study-mobile-quiet-action study-mobile-action-row"
          :disabled="typingLoading" @click="chooseArticleAction('typing')">
          {{ typingLoading ? '正在准备…' : '文章跟打' }}
        </button>
      </div>
      <ArticleTypingOptions v-if="typingActive" :auto-speak="typingAutoSpeak" :auto-word="typingAutoWord"
        :speech-disabled="fullTextSpeechDisabled" :word-speech-disabled="wordSpeechDisabled"
        @auto-speak="setTypingAutoSpeak" @auto-word="setTypingAutoWord" />
      <label v-else class="study-phonetic-toggle study-mobile-tool-setting">
        <input type="checkbox" :checked="readingDisplayMode !== 'original'"
          @change="readingDisplayMode = ($event.target as HTMLInputElement).checked ? 'annotated' : 'original'">
        显示音标
      </label>
    </MobileStudyDialog>

    <MobileStudyDialog v-model="coursesOpen" title="选课程" @close="handleCourseDialogClose">
      <template v-if="coursesOpen">
        <div class="study-course-grid" @click="revealCourseMenu">
          <div class="study-course-row">
            <PepEnglishDropdown stage="junior" @select="handleCourseLessonSelect" />
            <PepEnglishDropdown stage="senior" @select="handleCourseLessonSelect" />
            <CollegeEnglishDropdown @select="handleCourseLessonSelect" />
            <PostgraduateDropdown @select="handleCourseLessonSelect" />
          </div>
          <div class="study-course-row">
            <CetDropdown @select="handleCourseLessonSelect" />
            <KaoyanEnglishDropdown @select="handleCourseLessonSelect" />
            <NceDropdown @select="handleCourseLessonSelect" />
            <ShuimuDropdown @select="handleCourseLessonSelect" />
          </div>
          <div class="study-course-row">
            <EnglishVocabularyDropdown @select="handleCourseLessonSelect" />
          </div>
        </div>
        <MaterialSubmission :email-image-url="feedbackEmailUrl" />
      </template>
    </MobileStudyDialog>

    <MobileStudyDialog v-model="editorOpen" title="编辑文章" close-label="完成" @close="restoreDialogFocus">
      <div class="study-input-wrap">
        <div class="study-input-header">
          <ArticleInputHint @focus="articleSourceInput?.focus()" />
          <button
            type="button"
            class="study-input-url-hint"
            :class="{ 'study-input-url-hint-active': activeCourseLesson }"
            :disabled="!activeCourseLesson"
            :title="activeCourseLesson ? activeCourseLesson.url : '选择课程文章后生成网址'"
            @click="copyActiveCourseLessonUrl"
          >
            {{ lessonShareUrlCopied ? "已复制" : "网址" }}
          </button>
        </div>
        <textarea
          ref="articleSourceInput"
          v-model="sourceText"
          class="study-input w-full resize-y p-4 outline-none"
          :placeholder="copy.template.sourcePlaceholder"
          aria-label="文章正文"
          :autofocus="!sourceText.trim()"
          spellcheck="false"
        />
      </div>
      <div class="study-text-history-bar study-mobile-editor-history">
        <label
          class="study-text-history-label text-sm"
          for="text-history-select"
        >
          {{ copy.template.savedArticles }}
        </label>
        <select
          id="text-history-select"
          v-model="selectedTextHistoryId"
          class="study-select study-text-history-select h-9 rounded-md px-3"
          :disabled="!textHistoryRecords.length"
          @change="loadTextHistoryRecord"
        >
          <option value="">{{ textHistoryEmptyLabel }}</option>
          <option
            v-for="record in textHistoryRecords"
            :key="record.id"
            :value="record.id"
          >
            {{ copy.template.savedArticleOption(record.title, record.count) }}
          </option>
        </select>
        <button
          type="button"
          class="study-button study-mobile-quiet-action study-mobile-end-action"
          :disabled="!selectedTextHistoryId"
          :title="copy.template.deleteSelectedArticleTitle"
          @click="deleteSelectedTextHistoryRecord"
        >
          {{ copy.template.deleteArticle }}
        </button>
      </div>
      <p v-if="editorOpen" class="study-mobile-feedback" role="status">{{ status }}</p>
    </MobileStudyDialog>

    <MobileStudyDialog v-model="moreOpen" title="更多" @close="restoreDialogFocus">
      <ThemeSelect class="study-mobile-field" />
      <div class="study-mobile-action-list">
        <button type="button" class="study-button study-mobile-quiet-action study-mobile-action-row"
          @click="setActiveView('exam'); moreOpen = false">考试学习</button>
        <button type="button" class="study-button study-mobile-quiet-action study-mobile-action-row"
          @click="setActiveView('diagnostics'); moreOpen = false">
          {{ copy.template.navDiagnostics }}
        </button>
        <a class="study-link" :href="wordTapWindowsDownloadUrl" :download="mobileBrowser ? undefined : true"
          @click="handleWordTapWindowsDownload">
          {{ mobileBrowser ? copy.template.desktopUse : copy.template.desktopDownload }}
        </a>
        <ProjectLink />
      </div>
      <details class="study-mobile-settings">
        <summary>查词与朗读设置</summary>
        <label class="study-control study-mobile-field">
          <span>{{ copy.template.translateModeLabel }}</span>
          <select
            v-model="selectedTranslateMode"
            class="study-select h-9 rounded-md px-3"
            @change="announceTranslateModeChange"
          >
            <option
              v-for="mode in translateModeOptions"
              :key="mode.value"
              :value="mode.value"
            >
              {{ mode.label }}
            </option>
          </select>
        </label>

        <label class="study-control study-mobile-field">
          <span>{{ copy.template.rateLabel }}</span>
          <select
            v-model="selectedRate"
            class="study-select h-9 rounded-md px-3"
          >
            <option
              v-for="rate in rateOptions"
              :key="rate"
              :value="rate"
            >
              {{ rateOptionLabels[rate] ?? rate }}
            </option>
          </select>
        </label>

        <label class="study-control study-mobile-field">
          <span>{{ copy.template.repeatLabel }}</span>
          <select
            v-model.number="selectedRepeat"
            class="study-select h-9 rounded-md px-3"
          >
            <option
              v-for="repeat in repeatOptions"
              :key="repeat"
              :value="repeat"
            >
              {{ copy.template.repeatTimes(repeat) }}
            </option>
          </select>
        </label>

        <label class="study-control study-mobile-field">
          <span>{{ copy.template.wordVoiceLabel }}</span>
          <select
            v-model="selectedBrowserVoiceUri"
            class="study-select h-9 rounded-md px-3"
          >
            <option value="">{{ copy.template.autoVoice }}</option>
            <option
              v-for="voice in browserVoiceSelectOptions"
              :key="voice.value"
              :value="voice.value"
            >
              {{ voice.label }}
            </option>
          </select>
        </label>

        <label class="study-control study-mobile-field">
          <span>{{ copy.template.fullTextVoiceLabel }}</span>
          <select
            v-model="selectedGatewayVoice"
            class="study-select h-9 rounded-md px-3"
          >
            <option
              v-for="voice in gatewayVoiceOptions"
              :key="voice.value"
              :value="voice.value"
            >
              {{ voice.label }}
            </option>
          </select>
        </label>

        <SpeechLanguageHint />

        <label class="study-toggle mt-4 flex items-center gap-2 text-sm">
          <input
            v-model="markLearned"
            type="checkbox"
          >
          <span>{{ copy.template.markLearnedLabel }}</span>
        </label>
      </details>
      <p v-if="!browserSpeechSupported" class="study-mobile-feedback">{{ copy.template.browserSpeechAlert }}</p>
      <div v-if="dictionaryInfo" class="study-dictionary-info mb-3 text-sm">
        {{ dictionaryInfo }}
      </div>
      <GatewayUpdateNotice
        v-if="gatewayUpdateAvailable"
        :current-version="installedGatewayVersion"
        :latest-version="latestGatewayVersion"
        :download-url="gatewayDownloadUrl"
        @download="handleGatewayDownload"
        @check="refreshGatewayStatus()"
      />
      <div
        v-if="showGatewayGuide"
        class="study-gateway-guide mt-3 rounded-md p-3 text-sm leading-6"
      >
        {{ copy.template.gatewayGuide }}
        <a
          class="study-link ml-1"
          :href="gatewayDownloadUrl"
          download
          @click="handleGatewayDownload"
        >
          {{ copy.template.installGateway }}
        </a>
      </div>
      <p v-if="moreOpen" class="study-mobile-feedback" role="status">{{ status }}</p>
    </MobileStudyDialog>

    <footer
      class="study-feedback"
      :aria-label="copy.template.footerAria"
    >
      <div class="study-feedback-row">
        <span class="study-feedback-label">{{ copy.template.feedbackLabel }}</span>
        <a class="study-link" href="https://github.com/hawkhai/wordtap.cn/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
        <img
          :src="feedbackEmailUrl"
          :alt="copy.template.feedbackEmailAlt"
          class="study-feedback-email"
          width="156"
          height="21"
        >
      </div>
      <div class="study-icp">
        <template v-if="collegeEnglishAvailable">
          <a class="study-link" :href="collegeEnglishUrl">大学英语</a>
          <span class="study-icp-sep">·</span>
        </template>
        <a class="study-link" :href="pepEnglishUrl">人教英语</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="postgraduateUrl">研究生英语</a>
        <span>·</span>
        <a class="study-link" :href="vocabularyUrl">英语词汇</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="cetUrl">英语四六级</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="kaoyanEnglishUrl">考研英语</a>
        <a class="study-link" :href="examUrl">考试学习</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="nceUrl">新概念英语</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="shuimuUrl">水木英语</a>
        <span class="study-icp-sep">·</span>
        <a
          class="study-link"
          href="https://omniscient-house-4e0.notion.site/385148a126c1807bb8dcc63bab2ea096"
          target="_blank"
          rel="noopener noreferrer"
        >高级软件工程</a>
        <span class="study-icp-sep">·</span>
        <button
          type="button"
          class="study-link"
          @click="setActiveView('diagnostics')"
        >
          {{ copy.template.navDiagnostics }}
        </button>
        <span class="study-icp-sep">·</span>
        <a
          class="study-link"
          href="https://github.com/hawkhai/wordtap.cn"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub</a>
        <span class="study-icp-sep">·</span>
        {{ copy.template.icp }}
      </div>
    </footer>
  </main>
</template>
