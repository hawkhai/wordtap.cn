import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import { followReadingSentence } from "../utils/readingFollow";

export function useReadingInteraction(reader: Ref<HTMLElement | null>, options: {
  playingId: () => string;
  paused: () => boolean;
}) {
  let followTimer: ReturnType<typeof setTimeout> | undefined;
  let stopAnimation: (() => void) | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const stop = () => {
    stopAnimation?.();
    stopAnimation = undefined;
    clearTimeout(followTimer);
  };
  const follow = () => {
    stop();
    const playingId = options.playingId();
    if (options.paused() || !playingId || !reader.value) return;
    const sentence = Array.from(reader.value.querySelectorAll<HTMLElement>("[data-sentence-id]"))
      .find(element => element.dataset.sentenceId === playingId);
    if (sentence) stopAnimation = followReadingSentence(reader.value, sentence);
  };
  const scheduleFollow = () => {
    clearTimeout(followTimer);
    followTimer = setTimeout(follow, 160);
  };
  const scroll = (event: Event) => {
    const target = event.target;
    if (target !== document && target !== window &&
      !(target instanceof Node && reader.value && (reader.value.contains(target) || target.contains(reader.value)))) return;
    scheduleFollow();
  };
  const manualScroll = () => { stop(); scheduleFollow(); };
  watch([options.playingId, options.paused], follow, { flush: "post" });
  onMounted(() => {
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("wheel", manualScroll, { passive: true });
    window.addEventListener("touchmove", manualScroll, { passive: true });
    window.addEventListener("resize", scheduleFollow);
    window.visualViewport?.addEventListener("resize", scheduleFollow);
    window.visualViewport?.addEventListener("scroll", scheduleFollow);
    resizeObserver = new ResizeObserver(scheduleFollow);
    if (reader.value) resizeObserver.observe(reader.value);
  });
  onBeforeUnmount(() => {
    stop();
    resizeObserver?.disconnect();
    window.removeEventListener("scroll", scroll, true);
    window.removeEventListener("wheel", manualScroll);
    window.removeEventListener("touchmove", manualScroll);
    window.removeEventListener("resize", scheduleFollow);
    window.visualViewport?.removeEventListener("resize", scheduleFollow);
    window.visualViewport?.removeEventListener("scroll", scheduleFollow);
  });
}
