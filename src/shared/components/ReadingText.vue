<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useReadingInteraction } from "../composables/useReadingInteraction";
import { isProbablyMobileBrowser } from "../utils/device";
import { phoneticWordKey } from "../utils/readingPhonetics";
import type { ReadingDisplayMode, WordPhonetic, Segment } from "../types/app";
import type { ReadingRun, ReadingSelection, ReadingSentence } from "../utils/readingSentences";
import ReadingSegment from "./ReadingSegment.vue";
import SentenceReadButton from "./SentenceReadButton.vue";
const props = defineProps<{
  runs: ReadingRun[];
  snapshot: string;
  displayMode?: ReadingDisplayMode;
  phonetics?: Record<string, WordPhonetic>;
  selectedId: string;
  learnedClass: (word: string) => string;
  activeSentenceId: string;
  playingSentenceId: string;
  paused: boolean;
  preparing: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{
  word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent];
  sentence: [id: string];
  selection: [selection: ReadingSelection];
  notice: [message: string];
  select: [];
}>();
const reader = ref<HTMLElement | null>(null);
const touchRange = ref(navigator.maxTouchPoints > 0 || isProbablyMobileBrowser() || window.matchMedia("(any-pointer: coarse)").matches);
const canChooseRange = computed(() => !props.disabled && props.runs.some(run => run.sentence));
const choosingRange = ref(false);
const rangeStart = ref<ReadingSentence | null>(null);
const rangeNotice = computed(() => {
  if (!choosingRange.value) return "";
  return rangeStart.value ? "点结束句开始朗读。" : "点起始句，再点结束句。同一句点两次可只读一句。";
});

function cancelRange() {
  choosingRange.value = false;
  rangeStart.value = null;
}

function toggleRange() {
  if (choosingRange.value) { cancelRange(); return; }
  if (!canChooseRange.value) return;
  const native = window.getSelection();
  if (native?.anchorNode && reader.value?.contains(native.anchorNode)) native.removeAllRanges();
  choosingRange.value = true;
  emit("select");
  reader.value?.focus({ preventScroll: true });
}

function handleClick(event: MouseEvent) {
  if (!choosingRange.value) { clickCapture(event); return; }
  const id = (event.target as Element).closest<HTMLElement>("[data-sentence-id]")?.dataset.sentenceId;
  if (!id) return;
  event.preventDefault();
  event.stopPropagation();
  const sentence = props.runs.find(run => run.sentence?.id === id)?.sentence;
  if (!sentence) return;
  const start = rangeStart.value;
  if (!start) {
    rangeStart.value = sentence;
    return;
  }
  cancelRange();
  emit("selection", {
    snapshot: props.snapshot,
    start: Math.min(start.start, sentence.start),
    end: Math.max(start.end, sentence.end),
  });
}

const { menu, selection, adjustingInline, position, pointerDown, touchStart, holdMenu, clickCapture, read, copy } = useReadingInteraction(reader, {
  snapshot: () => props.snapshot,
  playingId: () => props.playingSentenceId,
  paused: () => props.paused,
  floatingMenu: () => !touchRange.value,
  choosingRange: () => choosingRange.value,
  cancelRange,
  read: value => emit("selection", value), notice: message => emit("notice", message), select: () => emit("select"),
});

function handleTouchStart(event: TouchEvent) {
  touchRange.value = true;
  touchStart(event);
}

watch([() => props.snapshot, canChooseRange], cancelRange);
defineExpose({ touchRange, canChooseRange, choosingRange, rangeNotice, toggleRange, cancelRange });

function setMenu(element: unknown) {
  if (element === null || element instanceof HTMLElement) menu.value = element;
}

const positionedRuns = computed(() => {
  let offset = 0;
  return props.runs.map(run => ({ ...run, positionedSegments: run.segments.map(segment => {
    const start = offset;
    offset += segment.text.length + (segment.type === "word" ? segment.trailingText?.length ?? 0 : 0);
    return { segment, start, end: offset };
  }) }));
});
</script>

<template>
  <div ref="reader" tabindex="-1" class="study-reader overflow-auto whitespace-pre-wrap text-2xl leading-[2.4rem]" :class="{ 'study-reader-phonetics': displayMode && displayMode !== 'original', 'study-reader-choosing-range': choosingRange }" lang="en" data-testid="study-text"
    @pointerdown="pointerDown" @touchstart.passive="handleTouchStart" @click.capture="handleClick">
    <span v-for="run in positionedRuns" :key="run.id" :class="{ 'study-sentence': run.sentence, 'study-sentence-playing': run.sentence?.id === playingSentenceId, 'study-sentence-range-start': rangeStart && run.sentence?.id === rangeStart.id }" :data-sentence-id="run.sentence?.id"><template v-for="{ segment, start, end } in run.positionedSegments" :key="segment.id"><ReadingSegment
        :source-start="start" :display-mode="displayMode" :phonetic="phonetics?.[phoneticWordKey(segment.text)]"
        :segment="segment" :selected-id="selectedId" :learned-class="learnedClass" :skip-word-tab="choosingRange"
        @word="(word, event) => $emit('word', word, event)"
      /><Teleport v-if="selection && start < selection.end && selection.end <= end" to="body" :disabled="touchRange">
        <span :ref="setMenu" class="study-selection-menu"
          :class="[touchRange ? 'study-selection-menu-inline' : 'study-selection-menu-floating', { 'study-selection-menu-adjusting': touchRange && adjustingInline }]"
          role="group" aria-label="选中文字操作" lang="zh-CN"
          :data-testid="touchRange ? 'reading-selection-inline' : 'reading-selection-menu'"
          :style="touchRange ? undefined : { left: `${position.left}px`, top: `${position.top}px` }"
          @pointerdown.stop.prevent="holdMenu" @mousedown.prevent>
          <button type="button" class="study-button" :disabled="disabled" title="朗读选区所在的完整句子（一次）" @click="read">朗读</button>
          <button type="button" class="study-button" @click="copy">复制</button>
        </span>
      </Teleport></template><SentenceReadButton
      v-if="run.sentence"
      :active="run.sentence.id === activeSentenceId"
      :preparing="run.sentence.id === activeSentenceId && preparing"
      :disabled="disabled && run.sentence.id !== activeSentenceId" :text="run.sentence.text"
      :range-action="choosingRange ? (rangeStart ? '选为结束句并朗读' : '选为起始句') : undefined"
      @play="$emit('sentence', run.sentence.id)"
    /></span>
  </div>
</template>
