<script setup lang="ts">
import { computed, ref } from "vue";
import { useReadingInteraction } from "../composables/useReadingInteraction";
import { isProbablyMobileBrowser } from "../utils/device";
import { phoneticWordKey } from "../utils/readingPhonetics";
import type { ReadingDisplayMode, ReadingSpeechState, WordPhonetic, Segment } from "../types/app";
import type { ReadingParagraph, ReadingRun, ReadingSelection } from "../utils/readingSentences";
import ReadingSegment from "./ReadingSegment.vue";
import SentenceReadButton from "./SentenceReadButton.vue";
const props = defineProps<{
  runs: ReadingRun[];
  paragraphs: ReadingParagraph[];
  snapshot: string;
  displayMode?: ReadingDisplayMode;
  phonetics?: Record<string, WordPhonetic>;
  selectedId: string;
  learnedClass: (word: string) => string;
  activeSentenceId: string;
  activeParagraphId: string;
  playingSentenceId: string;
  paused: boolean;
  sentenceState: ReadingSpeechState;
  paragraphState: ReadingSpeechState;
  disabled: boolean;
}>();
const emit = defineEmits<{
  word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent];
  sentence: [id: string];
  paragraph: [id: string];
  selection: [selection: ReadingSelection];
  notice: [message: string];
  select: [];
}>();
const reader = ref<HTMLElement | null>(null);
const touchDevice = ref(navigator.maxTouchPoints > 0 || isProbablyMobileBrowser() || window.matchMedia("(any-pointer: coarse)").matches);
const { menu, selection, position, pointerDown, holdMenu, clickCapture, read, copy } = useReadingInteraction(reader, {
  snapshot: () => props.snapshot,
  playingId: () => props.playingSentenceId,
  paused: () => props.paused,
  desktopSelection: () => !touchDevice.value,
  read: value => emit("selection", value), notice: message => emit("notice", message), select: () => emit("select"),
});

function handleTouchStart() {
  touchDevice.value = true;
}

function setMenu(element: unknown) {
  if (element === null || element instanceof HTMLElement) menu.value = element;
}

const positionedRuns = computed(() => {
  const paragraphStarts = new Map(touchDevice.value ? props.paragraphs.map((paragraph, index) =>
    [paragraph.start, { id: paragraph.id, text: `第 ${index + 1} 段` }] as const) : []);
  let offset = 0;
  return props.runs.map(run => ({ ...run, positionedSegments: run.segments.map(segment => {
    const start = offset;
    offset += segment.text.length + (segment.type === "word" ? segment.trailingText?.length ?? 0 : 0);
    const paragraph = paragraphStarts.get(start);
    // Empty blank-line segments can share the next paragraph's source offset.
    return { segment, start, paragraph: segment.type === "blank-line" || !segment.text.trim() ? undefined : paragraph };
  }) }));
});
</script>

<template>
  <div ref="reader" tabindex="-1" class="study-reader overflow-auto whitespace-pre-wrap text-2xl leading-[2.4rem]" :class="{ 'study-reader-phonetics': displayMode && displayMode !== 'original' }" lang="en" data-testid="study-text"
    @pointerdown="pointerDown" @touchstart.passive="handleTouchStart" @click.capture="clickCapture">
    <span v-for="run in positionedRuns" :key="run.id" :class="{ 'study-sentence': run.sentence, 'study-sentence-playing': run.sentence?.id === playingSentenceId }" :data-sentence-id="run.sentence?.id"><template v-for="{ segment, start, paragraph } in run.positionedSegments" :key="segment.id"><SentenceReadButton
        v-if="paragraph" paragraph lang="zh-CN"
        :state="paragraph.id === activeParagraphId ? paragraphState : 'idle'"
        :disabled="disabled && paragraph.id !== activeParagraphId" :text="paragraph.text"
        @play="$emit('paragraph', paragraph.id)"
      /><ReadingSegment
        :source-start="start" :display-mode="displayMode" :phonetic="phonetics?.[phoneticWordKey(segment.text)]"
        :segment="segment" :selected-id="selectedId" :learned-class="learnedClass"
        @word="(word, event) => $emit('word', word, event)"
      /></template><SentenceReadButton
      v-if="run.sentence"
      :state="run.sentence.id === activeSentenceId ? sentenceState : 'idle'"
      :disabled="disabled && run.sentence.id !== activeSentenceId" :text="run.sentence.text"
      @play="$emit('sentence', run.sentence.id)"
    /></span>
  </div>
  <Teleport v-if="!touchDevice && selection" to="body">
    <span :ref="setMenu" class="study-selection-menu study-selection-menu-floating"
      role="group" aria-label="选中文字操作" lang="zh-CN" data-testid="reading-selection-menu"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      @pointerdown.stop="holdMenu" @mousedown.prevent>
      <button type="button" class="study-button" :disabled="disabled" title="朗读选区所在的完整句子（一次）" @click="read">朗读</button>
      <button type="button" class="study-button" @click="copy">复制</button>
    </span>
  </Teleport>
</template>
