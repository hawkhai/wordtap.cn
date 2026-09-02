<script setup lang="ts">
import { computed, shallowRef, defineAsyncComponent } from "vue";
import { isNarrowLayoutViewport, isProbablyMobileBrowser } from "./shared/utils/device";

const DesktopShell = defineAsyncComponent(() => import("./desktop/components/DesktopShell.vue"));
const MobileShell = defineAsyncComponent(() => import("./mobile/components/MobileShell.vue"));

const isMobile = computed(() => isProbablyMobileBrowser() || isNarrowLayoutViewport());
const activeShell = computed(() => (isMobile.value ? MobileShell : DesktopShell));
</script>

<template>
  <component :is="activeShell" />
</template>
