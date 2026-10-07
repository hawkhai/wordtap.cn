<script setup lang="ts">
defineProps<{ active: boolean; preparing: boolean; disabled: boolean; text: string }>();
defineEmits<{ play: [] }>();
</script>

<template>
  <button
    type="button"
    class="study-sentence-button"
    :class="{ 'study-sentence-button-active': active }"
    :disabled="disabled"
    :aria-label="`${active ? '停止朗读本句' : '朗读本句'}：${text}`"
    :title="disabled ? '当前设备暂时无法朗读本句' : active ? (preparing ? '正在准备，点击停止' : '停止朗读本句') : '朗读本句（一次）'"
    :aria-pressed="active"
    @click.stop="$emit('play')"
  >
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect v-if="active" x="5" y="5" width="10" height="10" rx="1" fill="currentColor" />
      <path v-else d="M7 4.5 15 10l-8 5.5v-11Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  </button>
</template>
