import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { followReadingSentence, readingViewport } from "../utils/readingFollow";
import { selectionFromRange, selectionMenuPosition } from "../utils/readingSelection";
import type { ReadingSelection } from "../utils/readingSentences";

type SelectionGesture = { kind: "reader-pointer" | "action"; id: number };

type RangeBounds = Pick<Range, "startContainer" | "startOffset" | "endContainer" | "endOffset">;

function sameBounds(range: Range, bounds: RangeBounds | null) {
  return bounds && range.startContainer === bounds.startContainer && range.startOffset === bounds.startOffset &&
    range.endContainer === bounds.endContainer && range.endOffset === bounds.endOffset;
}

export function useReadingInteraction(reader: Ref<HTMLElement | null>, options: {
  snapshot: () => string;
  playingId: () => string;
  paused: () => boolean;
  desktopSelection: () => boolean;
  read: (selection: ReadingSelection) => void;
  notice: (message: string) => void;
  select: () => void;
}) {
  const menu = ref<HTMLElement | null>(null);
  const selection = ref<ReadingSelection | null>(null);
  const position = ref({ left: 8, top: 8 });
  let anchor: DOMRect | null = null;
  let committedBounds: RangeBounds | null = null;
  let gesture: SelectionGesture | null = null;
  let suppressClickUntil = 0;
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let followTimer: ReturnType<typeof setTimeout> | undefined;
  let stopAnimation: (() => void) | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let disposed = false;
  const stop = () => { stopAnimation?.(); stopAnimation = undefined; clearTimeout(followTimer); };
  const follow = () => {
    stop();
    if (gesture || selection.value || options.paused() || !options.playingId() || !reader.value) return;
    const sentence = Array.from(reader.value.querySelectorAll<HTMLElement>("[data-sentence-id]"))
      .find(element => element.dataset.sentenceId === options.playingId());
    if (sentence) stopAnimation = followReadingSentence(reader.value, sentence);
  };
  const scheduleFollow = () => { clearTimeout(followTimer); if (!disposed) followTimer = setTimeout(follow, 160); };
  const placeMenu = () => {
    if (!selection.value || !anchor || !menu.value) return;
    const rect = menu.value.getBoundingClientRect();
    position.value = selectionMenuPosition(anchor, readingViewport(), rect.width, rect.height);
  };
  const clearCapture = () => {
    clearTimeout(captureTimer);
  };
  const close = () => {
    clearCapture();
    gesture = null;
    selection.value = null;
    committedBounds = null;
    anchor = null;
    scheduleFollow();
  };
  const readerRange = (native: Selection | null) => {
    if (!reader.value || !native?.rangeCount || native.isCollapsed) return null;
    const range = native.getRangeAt(0);
    return reader.value.contains(range.startContainer) && reader.value.contains(range.endContainer) ? range : null;
  };
  const retainsMenuFocus = () => menu.value?.contains(document.activeElement);
  const captureSelection = async () => {
    if (disposed || gesture || !options.desktopSelection() || !reader.value) return;
    const native = window.getSelection();
    const range = readerRange(native);
    if (!range) {
      if (!retainsMenuFocus()) close();
      return;
    }
    if (!sameBounds(range, committedBounds)) {
      const selected = selectionFromRange(reader.value, range, options.snapshot());
      if (!selected) { close(); return; }
      if (selection.value?.snapshot !== selected.snapshot || selection.value.start !== selected.start || selection.value.end !== selected.end) {
        options.select();
        selection.value = selected;
      }
      const { startContainer, startOffset, endContainer, endOffset } = range;
      committedBounds = { startContainer, startOffset, endContainer, endOffset };
    }
    stop();
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
  const queueCapture = () => {
    if (gesture) return;
    clearCapture();
    captureTimer = setTimeout(captureSelection, 180);
  };
  const onSelectionChange = () => {
    if (gesture) return;
    const range = readerRange(window.getSelection());
    if (!range && (!selection.value || retainsMenuFocus())) return;
    queueCapture();
  };
  const pointerDown = (event: PointerEvent) => {
    if (gesture || !options.desktopSelection() || event.pointerType === "touch") return;
    gesture = { kind: "reader-pointer", id: event.pointerId };
    clearCapture();
    stop();
    suppressClickUntil = 0;
    selection.value = null;
    committedBounds = null;
  };
  const holdMenu = (event: PointerEvent) => {
    if (gesture) return;
    clearCapture();
    gesture = { kind: "action", id: event.pointerId };
  };
  const pointerUp = (event: PointerEvent) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { kind } = gesture;
    gesture = null;
    if (kind === "reader-pointer") {
      if (readerRange(window.getSelection())) suppressClickUntil = performance.now() + 500;
      void captureSelection();
      scheduleFollow();
    } else {
      queueCapture();
    }
  };
  const clickCapture = (event: MouseEvent) => {
    if (!options.desktopSelection()) return;
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const outside = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
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
  const scroll = (event: Event) => {
    const target = event.target;
    if (target !== window.visualViewport && target !== document && target !== window &&
      !(target instanceof Node && reader.value && (reader.value.contains(target) || target.contains(reader.value)))) return;
    if (selection.value) {
      if (!retainsMenuFocus()) queueCapture();
      return;
    }
    scheduleFollow();
  };
  const interruptGesture = () => {
    if (!gesture) return;
    gesture = null;
    queueCapture();
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
  watch(options.desktopSelection, (enabled, _, onCleanup) => {
    if (!enabled) return;
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerUp);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    window.addEventListener("blur", interruptGesture);
    onCleanup(() => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerUp);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", interruptGesture);
      close();
    });
  }, { immediate: true, flush: "sync" });
  onMounted(() => {
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
    clearCapture();
    resizeObserver?.disconnect();
    window.removeEventListener("scroll", scroll, true);
    window.removeEventListener("wheel", manualScroll);
    window.removeEventListener("touchmove", manualScroll);
    window.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("scroll", resize);
  });
  return { menu, selection, position, pointerDown, holdMenu, clickCapture, read, copy };
}
