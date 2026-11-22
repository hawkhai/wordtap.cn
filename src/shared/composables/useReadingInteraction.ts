import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { followReadingSentence, readingViewport } from "../utils/readingFollow";
import { selectionFromRange, selectionMenuPosition } from "../utils/readingSelection";
import type { ReadingSelection } from "../utils/readingSentences";

export function useReadingInteraction(reader: Ref<HTMLElement | null>, options: {
  snapshot: () => string;
  playingId: () => string;
  paused: () => boolean;
  read: (selection: ReadingSelection) => void;
  notice: (message: string) => void;
  select: () => void;
}) {
  const menu = ref<HTMLElement | null>(null);
  const selection = ref<ReadingSelection | null>(null);
  const position = ref({ left: 8, top: 8 });
  let anchor: DOMRect | null = null;
  let dragging = false;
  let suppressClickUntil = 0;
  let selectionTimer: ReturnType<typeof setTimeout> | undefined;
  let followTimer: ReturnType<typeof setTimeout> | undefined;
  let stopAnimation: (() => void) | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let disposed = false;
  const stop = () => { stopAnimation?.(); stopAnimation = undefined; clearTimeout(followTimer); };
  const follow = () => {
    stop();
    if (dragging || selection.value || options.paused() || !options.playingId() || !reader.value) return;
    const sentence = Array.from(reader.value.querySelectorAll<HTMLElement>("[data-sentence-id]"))
      .find(element => element.dataset.sentenceId === options.playingId());
    if (sentence) stopAnimation = followReadingSentence(reader.value, sentence);
  };
  const scheduleFollow = () => { clearTimeout(followTimer); followTimer = setTimeout(follow, 160); };
  const placeMenu = () => {
    if (!selection.value || !anchor || !menu.value) return;
    const rect = menu.value.getBoundingClientRect();
    position.value = selectionMenuPosition(anchor, readingViewport(), rect.width, rect.height);
  };
  const close = () => {
    clearTimeout(selectionTimer);
    selection.value = null;
    anchor = null;
    scheduleFollow();
  };
  const captureSelection = async () => {
    if (disposed || dragging || !reader.value) return;
    const native = window.getSelection();
    if (menu.value?.contains(document.activeElement)) return;
    const range = native?.rangeCount ? native.getRangeAt(0) : null;
    const selected = range ? selectionFromRange(reader.value, range, options.snapshot()) : null;
    if (!selected || !range) { close(); return; }
    stop();
    options.select();
    selection.value = selected;
    // Use the release end of a forward or reverse selection for the menu anchor.
    const focus = document.createRange();
    if (native?.focusNode) {
      focus.setStart(native.focusNode, native.focusOffset);
      focus.collapse(true);
    }
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width || rect.height);
    const focusRect = focus.getBoundingClientRect();
    anchor = focusRect.height ? focusRect : rects.at(-1) ?? range.getBoundingClientRect();
    await nextTick();
    placeMenu();
  };
  const onSelectionChange = () => {
    clearTimeout(selectionTimer);
    if (dragging) return;
    selectionTimer = setTimeout(() => { void captureSelection(); }, 180);
  };
  const pointerDown = () => {
    suppressClickUntil = 0;
    dragging = true;
    stop();
    clearTimeout(selectionTimer);
    selection.value = null;
  };
  const pointerUp = () => {
    if (!dragging) return;
    dragging = false;
    const native = window.getSelection();
    if (native && !native.isCollapsed && reader.value && native.rangeCount &&
      selectionFromRange(reader.value, native.getRangeAt(0), options.snapshot())) {
      suppressClickUntil = performance.now() + 500;
    }
    void captureSelection();
    scheduleFollow();
  };
  const clickCapture = (event: MouseEvent) => {
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const outside = (event: PointerEvent) => {
    if (menu.value?.contains(event.target as Node) || reader.value?.contains(event.target as Node)) return;
    close();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !selection.value) return;
    event.preventDefault();
    const hadFocus = menu.value?.contains(document.activeElement);
    window.getSelection()?.removeAllRanges();
    close();
    if (hadFocus) reader.value?.focus({ preventScroll: true });
  };
  const scroll = () => {
    if (selection.value) {
      // Re-anchor on scroll without stealing focus or losing the native selection handles.
      if (!menu.value?.contains(document.activeElement)) onSelectionChange();
      return;
    }
    scheduleFollow();
  };
  const manualScroll = () => { stop(); scheduleFollow(); };
  const resize = () => { placeMenu(); scheduleFollow(); };
  const read = () => {
    const selected = selection.value;
    if (!selected || selected.snapshot !== options.snapshot()) { close(); return; }
    window.getSelection()?.removeAllRanges();
    close();
    reader.value?.focus({ preventScroll: true });
    options.read(selected);
  };
  const copy = async () => {
    const selected = selection.value;
    if (!selected || selected.snapshot !== options.snapshot()) { close(); return; }
    try {
      await navigator.clipboard.writeText(selected.snapshot.slice(selected.start, selected.end));
      if (disposed || selection.value !== selected || selected.snapshot !== options.snapshot()) return;
      options.notice("已复制选中的原文。");
      window.getSelection()?.removeAllRanges();
      close();
      reader.value?.focus({ preventScroll: true });
    } catch {
      if (!disposed && selection.value === selected && selected.snapshot === options.snapshot()) {
        options.notice("复制未成功，请使用系统复制操作。选区已保留。");
      }
    }
  };
  watch([options.playingId, options.paused], () => { stop(); void nextTick().then(() => { if (!disposed) follow(); }); });
  watch(options.snapshot, () => { close(); stop(); });
  onMounted(() => {
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerUp);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("wheel", manualScroll, { passive: true });
    window.addEventListener("touchmove", manualScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    resizeObserver = new ResizeObserver(resize);
    if (reader.value) resizeObserver.observe(reader.value);
  });
  onBeforeUnmount(() => {
    disposed = true;
    stop();
    clearTimeout(selectionTimer);
    resizeObserver?.disconnect();
    document.removeEventListener("selectionchange", onSelectionChange);
    document.removeEventListener("pointerup", pointerUp);
    document.removeEventListener("pointercancel", pointerUp);
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", keydown);
    window.removeEventListener("scroll", scroll, true);
    window.removeEventListener("wheel", manualScroll);
    window.removeEventListener("touchmove", manualScroll);
    window.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("scroll", resize);
  });
  return { menu, selection, position, pointerDown, clickCapture, read, copy };
}
