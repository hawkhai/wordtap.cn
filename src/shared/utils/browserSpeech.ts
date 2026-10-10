import { SPEECH_WATCHDOG_BASE, SPEECH_BROWSER_CHAR_MS } from "./timeoutConstants";
import type { SpeechPlaybackControl } from "./speechPlaybackControl";

export function browserSpeechAvailable(): boolean {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Cancellation settles immediately even on browsers that omit onend after cancel(). */
export function playBrowserSpeech(text: string, options: {
  signal: AbortSignal;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  onStart?: () => void;
  playbackControl?: SpeechPlaybackControl;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { signal, voice } = options;
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    if (!browserSpeechAvailable()) { reject(new Error("当前浏览器不能直接朗读。")); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = options.rate;
    if (voice) utterance.voice = voice;
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout>;
    let resumeTimer: ReturnType<typeof setInterval>;
    let unsubscribe: (() => void) | undefined;
    let submitted = false;
    let remaining = Math.max(SPEECH_WATCHDOG_BASE, text.length * SPEECH_BROWSER_CHAR_MS / options.rate);
    let watchdogStarted = 0;
    const armWatchdog = () => {
      watchdogStarted = Date.now();
      watchdog = setTimeout(() => {
        finish(new Error("直接朗读没有响应，请重试。"));
        window.speechSynthesis.cancel();
      }, remaining);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      clearInterval(resumeTimer);
      unsubscribe?.();
      signal.removeEventListener("abort", abort);
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      if (error) reject(error); else resolve();
    };
    const abort = () => {
      finish(new DOMException("Cancelled", "AbortError"));
      window.speechSynthesis.cancel();
    };
    signal.addEventListener("abort", abort, { once: true });
    utterance.onstart = () => {
      if (options.playbackControl?.paused) window.speechSynthesis.pause();
      options.onStart?.();
    };
    utterance.onend = () => finish();
    utterance.onerror = (event) => finish(new Error(`直接朗读失败：${event.error}`));
    const updatePlayback = () => {
      if (settled) return;
      try {
        if (options.playbackControl?.paused) {
          if (submitted) {
            clearTimeout(watchdog);
            remaining = Math.max(1, remaining - (Date.now() - watchdogStarted));
            window.speechSynthesis.pause();
          }
        } else {
          armWatchdog();
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          if (!submitted) {
            submitted = true;
            window.speechSynthesis.speak(utterance);
          }
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error("直接朗读失败。"));
      }
    };
    unsubscribe = options.playbackControl?.subscribe(updatePlayback);
    updatePlayback();
    if (!settled) resumeTimer = setInterval(() => {
      try {
        if (!options.playbackControl?.paused && window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {
        // Some speech engines reject resume while their queue is being cleared.
      }
    }, 14000);
  });
}
