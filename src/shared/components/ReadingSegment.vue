<script setup lang="ts">
import type { Segment } from "../types/app";
defineProps<{ segment: Segment; selectedId: string; learnedClass: (word: string) => string }>();
defineEmits<{ word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent] }>();
</script>

<template>
  <span v-if="segment.type === 'text'">{{ segment.text }}</span>
  <span v-else-if="segment.type === 'blank-line'" class="study-blank-line" aria-hidden="true"></span>
  <span v-else class="study-word-cluster"><button
    type="button"
    class="study-word inline px-0.5 align-baseline leading-[inherit]"
    :class="segment.id === selectedId ? 'study-word-selected' : learnedClass(segment.text)"
    :data-word-index="segment.index"
    @click="$emit('word', segment, $event)"
  >{{ segment.text }}</button>{{ segment.trailingText ?? '' }}</span>
</template>
