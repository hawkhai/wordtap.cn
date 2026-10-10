<script setup lang="ts">
defineProps<{
  autoSpeak: boolean;
  autoWord: boolean;
  speechDisabled: boolean;
  wordSpeechDisabled: boolean;
}>();
defineEmits<{ autoSpeak: [value: boolean]; autoWord: [value: boolean] }>();
</script>

<template>
  <div class="study-typing-controls">
    <label class="study-typing-toggle">
      <input type="checkbox" :checked="autoSpeak" :disabled="speechDisabled"
        @change="$emit('autoSpeak', ($event.target as HTMLInputElement).checked)" />
      自动朗读新句
    </label>
    <label class="study-typing-toggle">
      <input type="checkbox" :checked="autoWord" :disabled="wordSpeechDisabled"
        @change="$emit('autoWord', ($event.target as HTMLInputElement).checked)" />
      输入后自动朗读下一个单词
    </label>
    <span v-if="speechDisabled && wordSpeechDisabled" class="study-typing-hint">语音暂不可用，仍可跟打。</span>
  </div>
</template>
