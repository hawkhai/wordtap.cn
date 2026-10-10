<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ name: string; domain: string; tagline: string }>();
const wordmark = computed(() => props.name.endsWith("Tap")
  ? { word: props.name.slice(0, -3), tap: "Tap" }
  : { word: props.name, tap: "" });
</script>

<template>
  <a class="brand-identity brand-home-link" href="https://wordtap.cn" draggable="false">
    <h1 class="brand-title"><span>{{ wordmark.word }}</span><span class="brand-tap">{{ wordmark.tap }}</span><span class="brand-domain">{{ domain }}</span></h1>
    <p class="brand-tagline">{{ tagline }}</p>
  </a>
</template>
