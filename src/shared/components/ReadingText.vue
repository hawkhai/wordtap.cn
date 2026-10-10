<script setup lang="ts">
import { phoneticWordKey } from "../utils/readingPhonetics";
import type { ReadingDisplayMode, WordPhonetic, Segment } from "../types/app";
import type { ReadingRun } from "../utils/readingSentences";
import ReadingSegment from "./ReadingSegment.vue";
import SentenceReadButton from "./SentenceReadButton.vue";
defineProps<{
  runs: ReadingRun[];
  displayMode?: ReadingDisplayMode;
  phonetics?: Record<string, WordPhonetic>;
  selectedId: string;
  learnedClass: (word: string) => string;
  activeSentenceId: string;
  preparing: boolean;
  disabled: boolean;
}>();
defineEmits<{
  word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent];
  sentence: [id: string];
}>();
</script>

<template>
  <div class="study-reader overflow-auto whitespace-pre-wrap text-2xl leading-[2.4rem]" :class="{ 'study-reader-phonetics': displayMode && displayMode !== 'original' }" lang="en" data-testid="study-text">
    <span v-for="run in runs" :key="run.id" :class="{ 'study-sentence': run.sentence }" :data-sentence-id="run.sentence?.id"><ReadingSegment
      v-for="segment in run.segments"
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
</template>
