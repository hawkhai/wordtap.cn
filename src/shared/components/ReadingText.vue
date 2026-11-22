<script setup lang="ts">
import { computed, ref } from "vue";
import { useReadingInteraction } from "../composables/useReadingInteraction";
import { phoneticWordKey } from "../utils/readingPhonetics";
import type { ReadingDisplayMode, ReadingSpeechState, WordPhonetic, Segment } from "../types/app";
import type { ReadingParagraph, ReadingRun } from "../utils/readingSentences";
import ReadingSegment from "./ReadingSegment.vue";
import SentenceReadButton from "./SentenceReadButton.vue";
const props = defineProps<{
  runs: ReadingRun[];
  paragraphs: ReadingParagraph[];
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
defineEmits<{
  word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent];
  sentence: [id: string];
  paragraph: [id: string];
}>();
const reader = ref<HTMLElement | null>(null);
useReadingInteraction(reader, {
  playingId: () => props.playingSentenceId,
  paused: () => props.paused,
});

let mouseDown: { x: number; y: number } | undefined;
function rememberMouseDown(event: PointerEvent) {
  mouseDown = event.pointerType === "mouse" && event.button === 0 ? { x: event.clientX, y: event.clientY } : undefined;
}

function ignoreSelectionClick(event: MouseEvent) {
  const start = mouseDown;
  mouseDown = undefined;
  if (!event.detail || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 3) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && reader.value?.contains(selection.anchorNode)) {
    event.stopPropagation();
  }
}

const paragraphRuns = computed(() => {
  const groups: { key: string; paragraph?: { id: string; text: string }; runs: ReadingRun[] }[] = [];
  let paragraphIndex = 0;
  let offset = 0;
  for (const run of props.runs) {
    let groupedRun: ReadingRun | undefined;
    for (const segment of run.segments) {
      while (paragraphIndex < props.paragraphs.length && props.paragraphs[paragraphIndex].end <= offset) paragraphIndex++;
      const next = props.paragraphs[paragraphIndex];
      // An empty blank-line segment can share the next paragraph's source offset.
      const paragraph = next && offset >= next.start && segment.type !== "blank-line" ? next : undefined;
      let group = groups.at(-1);
      if (!group || group.paragraph?.id !== paragraph?.id) {
        group = {
          key: paragraph?.id ?? `gap-${offset}`,
          paragraph: paragraph && { id: paragraph.id, text: `第 ${paragraphIndex + 1} 段` },
          runs: [],
        };
        groups.push(group);
        groupedRun = undefined;
      }
      if (!groupedRun) {
        groupedRun = { ...run, segments: [] };
        group.runs.push(groupedRun);
      }
      groupedRun.segments.push(segment);
      offset += segment.text.length + (segment.type === "word" ? segment.trailingText?.length ?? 0 : 0);
    }
  }
  return groups;
});
</script>

<template>
  <div ref="reader" class="study-reader overflow-auto whitespace-pre-wrap text-2xl leading-[2.4rem]" :class="{ 'study-reader-phonetics': displayMode && displayMode !== 'original' }" lang="en" data-testid="study-text"
    @pointerdown="rememberMouseDown" @click.capture="ignoreSelectionClick">
    <span v-for="{ key, paragraph, runs } in paragraphRuns" :key="key" :class="{ 'study-paragraph': paragraph }"><span v-for="(run, runIndex) in runs" :key="run.id" :class="{ 'study-sentence': run.sentence, 'study-sentence-playing': run.sentence?.id === playingSentenceId }" :data-sentence-id="run.sentence?.id"><template v-for="(segment, segmentIndex) in run.segments" :key="segment.id"><SentenceReadButton
        v-if="paragraph && runIndex === 0 && segmentIndex === 0" paragraph lang="zh-CN"
        :state="paragraph.id === activeParagraphId ? paragraphState : 'idle'"
        :disabled="disabled && paragraph.id !== activeParagraphId" :text="paragraph.text"
        @play="$emit('paragraph', paragraph.id)"
      /><ReadingSegment
        :display-mode="displayMode" :phonetic="phonetics?.[phoneticWordKey(segment.text)]"
        :segment="segment" :selected-id="selectedId" :learned-class="learnedClass"
        @word="(word, event) => $emit('word', word, event)"
      /></template><SentenceReadButton
      v-if="run.sentence"
      :state="run.sentence.id === activeSentenceId ? sentenceState : 'idle'"
      :disabled="disabled && run.sentence.id !== activeSentenceId" :text="run.sentence.text"
      @play="$emit('sentence', run.sentence.id)"
    /></span></span>
  </div>
</template>
