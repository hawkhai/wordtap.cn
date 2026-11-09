<script setup lang="ts">
import { computed, ref } from "vue";
import { useReadingInteraction } from "../composables/useReadingInteraction";
import { phoneticWordKey } from "../utils/readingPhonetics";
import type { ReadingDisplayMode, WordPhonetic, Segment } from "../types/app";
import type { ReadingRun, ReadingSelection } from "../utils/readingSentences";
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
const { menu, selection, position, pointerDown, clickCapture, read, copy } = useReadingInteraction(reader, {
  snapshot: () => props.snapshot,
  playingId: () => props.playingSentenceId,
  paused: () => props.paused,
  read: value => emit("selection", value), notice: message => emit("notice", message), select: () => emit("select"),
});
const positionedRuns = computed(() => {
  let offset = 0;
  return props.runs.map(run => ({ ...run, positionedSegments: run.segments.map(segment => {
    const start = offset;
    offset += segment.text.length + (segment.type === "word" ? segment.trailingText?.length ?? 0 : 0);
    return { segment, start };
  }) }));
});
</script>

<template>
  <div ref="reader" tabindex="-1" class="study-reader overflow-auto whitespace-pre-wrap text-2xl leading-[2.4rem]" :class="{ 'study-reader-phonetics': displayMode && displayMode !== 'original' }" lang="en" data-testid="study-text"
    @pointerdown="pointerDown" @click.capture="clickCapture">
    <span v-for="run in positionedRuns" :key="run.id" :class="{ 'study-sentence': run.sentence, 'study-sentence-playing': run.sentence?.id === playingSentenceId }" :data-sentence-id="run.sentence?.id"><ReadingSegment
      v-for="{ segment, start } in run.positionedSegments" :source-start="start"
      :display-mode="displayMode" :phonetic="phonetics?.[phoneticWordKey(segment.text)]"
      :key="segment.id" :segment="segment" :selected-id="selectedId" :learned-class="learnedClass"
      @word="(word, event) => $emit('word', word, event)"
    /><SentenceReadButton
      v-if="run.sentence"
      :active="run.sentence.id === activeSentenceId"
      :preparing="run.sentence.id === activeSentenceId && preparing"
      :disabled="disabled && run.sentence.id !== activeSentenceId" :text="run.sentence.text"
      @play="$emit('sentence', run.sentence.id)"
    /></span>
  </div>
  <Teleport to="body">
    <div v-if="selection" ref="menu" class="study-selection-menu" role="toolbar" aria-label="选中文字操作" data-testid="reading-selection-menu"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }" @mousedown.prevent>
      <button type="button" class="study-button" :disabled="disabled" title="朗读选区所在的完整句子（一次）" @click="read">朗读</button>
      <button type="button" class="study-button" @click="copy">复制</button>
    </div>
  </Teleport>
</template>
