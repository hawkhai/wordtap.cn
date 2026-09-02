<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWordTap } from "../../shared/composables/useWordTap";
import { appSectionUrl } from "../../shared/utils/assetUrls";
import { isWindows } from "../../shared/utils/device";
import IpaPanel from "../../IpaPanel.vue";
import ExamPanel from "../../ExamPanel.vue";
import NceDropdown from "../../NceDropdown.vue";
import ShuimuDropdown from "../../ShuimuDropdown.vue";
import PostgraduateDropdown from "../../PostgraduateDropdown.vue";
import PepEnglishDropdown from "../../PepEnglishDropdown.vue";
import CollegeEnglishDropdown from "../../CollegeEnglishDropdown.vue";
import CetDropdown from "../../CetDropdown.vue";
import KaoyanEnglishDropdown from "../../KaoyanEnglishDropdown.vue";
import { loadCollegeEnglishManifest } from "../../shared/data/collegeEnglishLessons";
import type { CourseLessonSelection } from "../../shared/types/app";

const showGatewayGuide = computed(() => !isGatewayRunning.value && isWindows());

const shuimuUrl = computed(() => appSectionUrl("shuimu/"));
const nceUrl = computed(() => appSectionUrl("nce/"));
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
  logoMarkUrl, wordTapWindowsDownloadUrl,
  gatewayDownloadUrl, gatewayReleaseManifestUrl,
  sourceText, segments, selectedSegmentId, currentWord, meaning, status,
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
  gatewayStatusLabel, diagnosticsSummary,
  examStats, recentExamProgress, filteredExamPapers, filteredExamWords, examWordLessonOptions,
  setActiveView, announceTranslateModeChange, learnedClassForWord,
  showWordPopover, hideWordPopover, hideReviewContextMenu, handlePopoverKeydown,
  cleanDictionaryText, readFullText, fullTextSpeechDisabled, cancelSpeech, splitWords,
  loadTextHistoryRecord, deleteSelectedTextHistoryRecord,
  deleteHistoryRecord, refreshReviewRecords, exportReviewRecords,
  chooseHistoryImportFile, importReviewRecords, formatHistoryTime,
  selectReviewRecord, showReviewContextMenu, handleReviewRowKeydown,
  speakHistoryRecord, speakReviewContextRecord, deleteReviewContextRecord,
  diagnosticStatusText, diagnosticStatusClass, runDiagnostics,
  clearGatewayAudioCache, clearStoredTranslationCache,
  handleGatewayDownload, handleWordTapWindowsDownload, studyWord,
  loadCourseLessonSelection, copyActiveCourseLessonUrl,
  openExamPaper, openExamWordSource, examPaperStatus, markExamPaperCompleted, resetExamPaper,
  setExamWordReviewState, toggleExamWordReveal, exportCompleteLearningData, importCompleteLearningData,
} = useWordTap();

function handleCourseLessonSelect(selection: CourseLessonSelection): void {
  void loadCourseLessonSelection(selection);
}
</script>

<template>
  <section
    v-if="!browserSpeechSupported"
    class="study-browser-speech-alert"
    role="alert"
    :aria-label="copy.template.alertAria"
  >
    {{ copy.template.browserSpeechAlert }}
  </section>

  <section
    class="study-top-download"
    :aria-label="copy.template.desktopDownloadAria"
  >
    <div class="study-top-download-inner">
      <span class="study-top-download-copy">{{ copy.template.desktopDownloadCopy }}</span>
      <a
        class="study-top-download-link"
        :href="wordTapWindowsDownloadUrl"
        :download="mobileBrowser ? undefined : true"
        @click="handleWordTapWindowsDownload"
      >
        {{ mobileBrowser ? copy.template.desktopUse : copy.template.desktopDownload }}
      </a>
    </div>
  </section>

  <main class="study-shell mx-auto grid min-h-screen w-full max-w-[88rem] gap-4 px-4 py-5 sm:px-6">
    <section
      class="study-workspace"
      :aria-label="copy.template.workspaceAria"
    >
      <header class="study-brandbar px-4 py-3">
        <div class="brand-lockup">
          <img
            :src="logoMarkUrl"
            alt=""
            class="brand-mark"
            aria-hidden="true"
          >
          <div>
            <h1 class="brand-title font-bold leading-none">
              {{ copy.brand.name }}<span class="brand-domain">{{ copy.brand.domain }}</span>
            </h1>
            <p class="brand-tagline mt-2 text-sm">&nbsp; {{ copy.template.brandTagline }}</p>
            <nav class="study-course-links" aria-label="英语课程目录">
              <a :href="pepEnglishUrl">初中英语</a>
              <a :href="pepEnglishUrl">高中英语</a>
              <a v-if="collegeEnglishAvailable" :href="collegeEnglishUrl">大学英语</a>
              <a :href="postgraduateUrl">研究生英语</a>
              <a :href="cetUrl">英语四六级</a>
              <a :href="kaoyanEnglishUrl">考研英语</a>
              <button
                type="button"
                class="study-course-exam-entry"
                :aria-current="activeView === 'exam' ? 'page' : undefined"
                @click="setActiveView('exam')"
              >
                考试学习
              </button>
              <a :href="nceUrl">新概念英语</a>
              <a :href="shuimuUrl">水木英语</a>
            </nav>
          </div>
        </div>
        <div class="study-header-actions">
          <nav
            class="study-nav"
            :aria-label="copy.template.mainNavAria"
          >
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
          <div
            class="study-status max-w-full px-3 py-2 text-sm sm:max-w-md"
            :class="{ 'study-status-hidden': activeView !== 'study' }"
            :aria-hidden="activeView !== 'study' ? 'true' : undefined"
            role="status"
            data-testid="status-text"
          >
            <span class="study-status-text">{{ status }}</span>
          </div>
        </div>
      </header>

      <section
        v-if="activeView === 'study'"
        class="study-desk"
      >
        <aside
          class="study-word-card p-4"
          aria-labelledby="word-title"
        >
          <h2
            id="word-title"
            class="study-panel-title mb-3 text-base font-semibold"
          >
            {{ copy.template.currentWordTitle }}
          </h2>
          <div
            class="study-current-word mb-3 min-h-11 break-words pb-3 text-2xl font-bold"
            data-testid="current-word"
          >
            {{ currentWord }}
          </div>
          <div
            class="study-meaning whitespace-pre-wrap rounded-md p-3 leading-7"
            data-testid="meaning-box"
          >
            {{ meaning }}
          </div>

          <label class="study-control mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
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

          <label class="study-control mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
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

          <label class="study-control mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
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

          <label class="study-control mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
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

          <label class="study-control mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
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

          <label class="study-toggle mt-4 flex items-center gap-2 text-sm">
            <input
              v-model="markLearned"
              type="checkbox"
            >
            <span>{{ copy.template.markLearnedLabel }}</span>
          </label>

          <div
            class="study-history-mini mt-4 grid grid-cols-2 gap-2 text-sm"
            data-testid="history-stats"
          >
            <div>
              <strong>{{ historyStats.wordTotal }}</strong>
              <span>{{ copy.template.savedWordsStat }}</span>
            </div>
            <div>
              <strong>{{ historyStats.clickTotal }}</strong>
              <span>{{ copy.template.clickTotalStat }}</span>
            </div>
          </div>
        </aside>

        <div class="study-main">
          <section
            class="study-compose"
            :aria-label="copy.template.editorTitle"
          >
            <div class="study-compose-head flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div class="study-toolbar">
                <div class="study-course-grid">
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
                </div>
                <div class="study-reading-actions">
                  <button
                    type="button"
                    class="study-button study-button-primary"
                    :disabled="fullTextSpeechDisabled"
                    :title="fullTextSpeechDisabled ? copy.status.fullTextSpeechUnavailable : undefined"
                    @click="readFullText"
                  >
                    {{ copy.template.readFullText }}
                  </button>
                  <button
                    type="button"
                    class="study-button"
                    :disabled="!isSpeaking"
                    @click="cancelSpeech(copy.status.stoppedSpeech)"
                  >
                    {{ copy.template.stop }}
                  </button>
                </div>
              </div>
            </div>
            <div class="study-text-history-bar mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                class="study-button study-text-history-delete h-9"
                :disabled="!selectedTextHistoryId"
                :title="copy.template.deleteSelectedArticleTitle"
                @click="deleteSelectedTextHistoryRecord"
              >
                {{ copy.template.deleteArticle }}
              </button>
            </div>
            <div v-if="dictionaryInfo" class="study-dictionary-info mb-3 text-sm">
              {{ dictionaryInfo }}
            </div>
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
            <div class="study-input-wrap">
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
              <textarea
                v-model="sourceText"
                class="study-input w-full resize-y p-4 outline-none"
                :placeholder="copy.template.sourcePlaceholder"
                spellcheck="false"
              />
            </div>
          </section>

          <section
            class="study-reading-surface"
            aria-labelledby="study-title"
          >
            <div class="study-reading-head flex items-center justify-between gap-3">
              <h2
                id="study-title"
                class="study-panel-title text-base font-semibold"
              >
                {{ copy.template.readerTitle }}
              </h2>
              <span
                class="study-count text-sm"
                data-testid="word-count"
              >
                {{ wordCountLabel }}
              </span>
            </div>
            <div
              class="study-reader overflow-auto whitespace-pre-wrap p-4 text-2xl leading-[2.4rem]"
              lang="en"
              data-testid="study-text"
            >
              <template
                v-for="segment in segments"
                :key="segment.id"
              >
                <span v-if="segment.type === 'text'">{{ segment.text }}</span>
                <span v-else class="study-word-cluster">
                  <button
                    type="button"
                    class="study-word inline px-0.5 align-baseline leading-[inherit]"
                    :class="segment.id === selectedSegmentId ? 'study-word-selected' : learnedClassForWord(segment.text)"
                    :data-word-index="segment.index"
                    @click="studyWord(segment, $event)"
                  >
                    {{ segment.text }}
                  </button>{{ segment.trailingText ?? "" }}
                </span>
              </template>
            </div>
          </section>
        </div>
        <aside
          v-if="wordPopover.visible && !wordPopover.mobile"
          class="study-word-popover"
          :class="{ 'study-word-popover-mobile': wordPopover.mobile }"
          :style="wordPopover.mobile ? {} : { left: `${wordPopover.x}px`, top: `${wordPopover.y}px` }"
          role="dialog"
          aria-live="polite"
          :aria-label="copy.template.wordPopoverAria"
        >
          <strong class="study-word-popover-word">{{ wordPopover.word }}</strong>
          <div class="study-word-popover-meaning whitespace-pre-wrap">
            {{ wordPopover.meaning }}
          </div>
        </aside>
      </section>

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

    <footer
      class="study-feedback"
      :aria-label="copy.template.footerAria"
    >
      <div class="study-feedback-row">
        <span class="study-feedback-label">{{ copy.template.feedbackLabel }}</span>
        <a
          class="study-link"
          href="https://github.com/hawkhai/wordtap.cn/issues"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub Issues</a>
      </div>
      <div class="study-icp">
        <template v-if="collegeEnglishAvailable">
          <a class="study-link" :href="collegeEnglishUrl">大学英语</a>
          <span class="study-icp-sep">·</span>
        </template>
        <a class="study-link" :href="pepEnglishUrl">人教英语</a>
        <span class="study-icp-sep">·</span>
        <a class="study-link" :href="postgraduateUrl">研究生英语</a>
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
          href="https://github.com/hawkhai/wordtap.cn"
          target="_blank"
          rel="noopener noreferrer"
        >项目源码</a>
        <span class="study-icp-sep">·</span>
        <button
          type="button"
          class="study-link"
          @click="setActiveView('diagnostics')"
        >
          {{ copy.template.navDiagnostics }}
        </button>
        <span class="study-icp-sep">·</span>
        {{ copy.template.icp }}
      </div>
    </footer>
  </main>
</template>
