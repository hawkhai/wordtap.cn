<script setup lang="ts">
import { useTheme } from "../composables/useTheme";

const { preference, available } = useTheme();
</script>

<template>
  <label v-if="available" class="wt-theme-control">
    <span>主题</span>
    <select :value="preference" data-wt-theme>
      <option value="system">跟随系统</option>
      <option value="light">浅色</option>
      <option value="dark">深色</option>
    </select>
  </label>
</template>
