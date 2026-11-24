<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId, watch } from "vue";

defineProps<{ title: string; closeLabel?: string; focusTitle?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const open = defineModel<boolean>({ required: true });
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
let backdropPointerDown = false;

function updateViewport(): void {
  if (!open.value) return;
  const viewport = window.visualViewport;
  const style = dialog.value?.style;
  if (!style) return;

  if (viewport && viewport.scale === 1) {
    style.setProperty("--wt-dialog-viewport-height", `${viewport.height}px`);
    style.setProperty("--wt-dialog-viewport-top", `${viewport.offsetTop}px`);
  } else {
    style.removeProperty("--wt-dialog-viewport-height");
    style.removeProperty("--wt-dialog-viewport-top");
  }
}

watch(open, (visible) => {
  if (visible) {
    backdropPointerDown = false;
    updateViewport();
    dialog.value?.showModal();
  } else {
    dialog.value?.close();
  }
}, { flush: "post" });

function handleClose(): void {
  if (dialog.value?.open) return;
  open.value = false;
  emit("close");
}

function rememberPointerDown(event: PointerEvent): void {
  backdropPointerDown = event.target === dialog.value;
}

function closeFromBackdrop(): void {
  if (backdropPointerDown) open.value = false;
}

onMounted(() => {
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
});

onUnmounted(() => {
  window.visualViewport?.removeEventListener("resize", updateViewport);
  window.visualViewport?.removeEventListener("scroll", updateViewport);
});
</script>

<template>
  <dialog ref="dialog" class="study-mobile-dialog study-material-dialog" :aria-labelledby="titleId"
    @close="handleClose"
    @pointerdown="rememberPointerDown"
    @click.self="closeFromBackdrop">
    <div class="study-mobile-dialog-layout">
      <header class="study-mobile-dialog-head">
        <h2 :id="titleId" :tabindex="focusTitle ? -1 : undefined" :autofocus="focusTitle">{{ title }}</h2>
        <button type="button" class="study-button"
          :class="closeLabel ? 'study-button-primary' : 'study-mobile-quiet-action study-mobile-end-action'"
          @click="open = false">{{ closeLabel ?? "关闭" }}</button>
      </header>
      <div class="study-mobile-dialog-body">
        <slot />
      </div>
    </div>
  </dialog>
</template>
