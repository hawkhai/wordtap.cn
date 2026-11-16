<script setup lang="ts">
import { computed, useId } from "vue";
import type { ReadingSpeechState } from "../types/app";

const props = defineProps<{ state: ReadingSpeechState; disabled: boolean; text: string; paragraph?: boolean }>();
const active = computed(() => props.state !== "idle");
const sandClipId = useId();
const label = computed(() => {
  const unit = props.paragraph ? "本段" : "本句";
  if (props.disabled) return `当前设备暂时无法朗读${unit}`;
  switch (props.state) {
    case "idle": return `朗读${unit}`;
    case "preparing": return `正在准备朗读${unit}，点击停止`;
    case "playing": return `正在朗读${unit}，点击停止`;
    case "paused": return `${unit}朗读已暂停，点击停止`;
    case "buffering": return `正在等待${unit}后续音频，点击停止`;
  }
});
defineEmits<{ play: [] }>();
</script>

<template>
  <button
    type="button"
    class="study-sentence-button"
    :class="{ 'study-paragraph-button': paragraph, 'study-sentence-button-active': active }"
    :disabled="disabled"
    :aria-label="`${label}：${text}`"
    :title="disabled || active ? label : `${label}（一次）`"
    :aria-pressed="active"
    @click.stop="$emit('play')"
  >
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 7.75h3L9.5 4.5v11l-4-3.25h-3Z" />
      <path v-if="disabled" d="m13 8 4 4m0-4-4 4" />
      <template v-else-if="state === 'preparing'">
        <circle cx="15.3" cy="10" r="3.4" stroke-width="1.15" />
        <path class="study-speaker-clock-hand" d="M15.3 10V7.8" stroke-width="1.1" />
      </template>
      <g v-else-if="state === 'buffering'" class="study-speaker-hourglass">
        <defs fill="currentColor" stroke="none">
          <clipPath :id="`${sandClipId}-top`"><path d="M13.15 5.95h4.4l-2.2 3.8Z" /></clipPath>
          <clipPath :id="`${sandClipId}-bottom`"><path d="M15.35 10.25l2.2 3.8h-4.4Z" /></clipPath>
        </defs>
        <g fill="currentColor" stroke="none">
          <g :clip-path="`url(#${sandClipId}-top)`">
            <rect class="study-speaker-sand" x="13.15" y="5.95" width="4.4" height="3.8" />
          </g>
          <g :clip-path="`url(#${sandClipId}-bottom)`">
            <rect class="study-speaker-sand study-speaker-sand-bottom" x="13.15" y="10.25" width="4.4" height="3.8" />
          </g>
          <g class="study-speaker-sand-stream">
            <circle v-for="grain in 3" :key="grain" cx="15.35" cy="8.5" r=".47" />
          </g>
        </g>
        <path d="M12.15 5.45h6.4m-6.4 9.1h6.4M12.7 5.45l5.3 9.1m0-9.1-5.3 9.1" stroke-width=".95" />
      </g>
      <path v-else-if="state === 'paused'" d="M13 6.5v7m3.5-7v7" stroke-width="2" />
      <template v-else-if="state === 'playing'">
        <path class="study-speaker-wave" d="M12.5 7a4.25 4.25 0 0 1 0 6" />
        <path class="study-speaker-wave" d="M15.5 4.5a7.75 7.75 0 0 1 0 11" />
      </template>
      <path v-else d="M14.6 6.75a4.8 4.8 0 0 1 0 6.5" stroke-width="1.2" />
    </svg>
  </button>
</template>
