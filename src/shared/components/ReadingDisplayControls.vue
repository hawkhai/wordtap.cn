<script setup lang="ts">
import type { ReadingDisplayMode } from "../types/app";
withDefaults(defineProps<{ modelValue: ReadingDisplayMode; counts: { loading: number; missing: number; error: number }; speechNotice?: string; showModes?: boolean }>(), { showModes: true });
defineEmits<{ 'update:modelValue': [mode: ReadingDisplayMode]; retry: [] }>();
</script>

<template>
  <div class="study-display-controls">
    <div class="study-display-toolbar">
      <slot name="settings" />
      <label v-if="showModes" class="study-phonetic-toggle">
        <input type="checkbox" :checked="modelValue !== 'original'"
          @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked ? 'annotated' : 'original')" />
        显示音标
      </label>
      <slot name="actions" />
    </div>
    <div role="status" aria-live="polite" aria-atomic="true"><p v-if="speechNotice" class="study-speech-notice">{{ speechNotice }}</p></div>
    <div v-if="showModes && modelValue !== 'original'" class="study-phonetic-notice">
      <p>词典音标供认读参考，实际朗读可能不同。</p>
      <p role="status" aria-live="polite">
        <span v-if="counts.loading">正在加载 {{ counts.loading }} 个词的音标。 </span>
        <span v-if="counts.missing">{{ counts.missing }} 个不同单词暂无音标，已保留原词。 </span>
        <span v-if="counts.error">{{ counts.error }} 个不同单词音标加载失败。 </span>
      </p>
      <button v-if="counts.error" type="button" class="study-button" :disabled="counts.loading > 0" @click="$emit('retry')">重试音标加载</button>
    </div>
  </div>
</template>
