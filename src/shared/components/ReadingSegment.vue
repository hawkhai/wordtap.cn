<script setup lang="ts">
import { computed } from "vue";
import type { ReadingDisplayMode, WordPhonetic, Segment } from "../types/app";
const props = defineProps<{ segment: Segment; selectedId: string; learnedClass: (word: string) => string;
  displayMode?: ReadingDisplayMode; phonetic?: WordPhonetic }>();
const showPhonetic = computed(() => props.displayMode && props.displayMode !== "original");
const ready = computed(() => showPhonetic.value && props.phonetic?.status === "ready");
const note = computed(() => !showPhonetic.value ? undefined : props.phonetic?.status === "missing" ? "暂无音标"
  : props.phonetic?.status === "error" ? "音标加载失败，请重试" : props.phonetic?.status === "loading" ? "正在加载音标" : undefined);
defineEmits<{ word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent] }>();
</script>

<template>
  <span v-if="segment.type === 'text'" :class="{ 'vocabulary-source-ipa': segment.phonetic }">{{ segment.text }}</span>
  <span v-else-if="segment.type === 'blank-line'" class="study-blank-line" aria-hidden="true"></span>
  <span v-else class="study-word-cluster"><button
    type="button"
    class="study-word inline px-0.5 align-baseline leading-[inherit]"
    :class="[segment.id === selectedId ? 'study-word-selected' : learnedClass(segment.text), {
      'study-word-annotated': ready && displayMode === 'annotated',
      'study-word-phonetic': ready,
      'study-word-phonetic-missing': showPhonetic && phonetic?.status === 'missing',
      'study-word-phonetic-error': showPhonetic && phonetic?.status === 'error',
    }]"
    :title="note" :aria-label="showPhonetic ? `${segment.text}${note ? '，' + note : ''}` : undefined"
    :data-word-index="segment.index"
    @click="$emit('word', segment, $event)"
  ><template v-if="ready"><span v-if="displayMode === 'annotated'" class="study-word-spelling">{{ segment.text }}</span><span class="study-word-ipa">{{ phonetic?.text }}</span></template><template v-else>{{ segment.text }}</template></button>{{ segment.trailingText ?? '' }}</span>
</template>
