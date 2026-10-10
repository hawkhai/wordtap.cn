<script setup lang="ts">
defineEmits<{ focus: [] }>();
</script>

<template>
  <button type="button" class="study-input-edit-hint" title="在下方输入或粘贴文章"
    @click="$emit('focus')">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m14 5 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-5-5L4 14l-1 6Z" />
      <path d="M13 20h8" />
    </svg>
    <span>输入或粘贴文章</span>
  </button>
</template>
