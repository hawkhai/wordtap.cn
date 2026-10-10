<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Segment } from "../types/app";
import type { TypingSentence, TypingState } from "../utils/articleTyping";
import { segmentReadingLine } from "../utils/readingWords";
import { isTypingKeyboardInput, nextTypingWord, typingFeedback } from "../utils/articleTyping";

const props = defineProps<{
  sentences: TypingSentence[];
  state: TypingState;
  currentSentence: TypingSentence | null;
  currentDraft: string;
  completedCount: number;
  finished: boolean;
  speechDisabled: boolean;
  selectedId: string;
  learnedClass: (word: string) => string;
}>();

const emit = defineEmits<{
  choose: [index: number];
  input: [value: string, afterKeyboardInput: boolean];
  submit: [];
  restartSentence: [];
  restartAll: [];
  speak: [text: string];
  word: [segment: Extract<Segment, { type: "word" }>, event: MouseEvent, context: string];
}>();

const input = ref<HTMLTextAreaElement | null>(null);
const result = ref<HTMLElement | null>(null);
const composing = ref(false);
const submittedEarly = ref(false);
const feedback = computed(() => typingFeedback(props.currentSentence?.target ?? "", props.currentDraft));
const currentWord = computed(() => nextTypingWord(props.currentSentence?.target ?? "", props.currentDraft));
const currentCompleted = computed(() => props.state.completed.includes(props.state.current));
const lastSentence = computed(() => props.completedCount === props.sentences.length - 1);
const referenceSegments = computed(() => {
  if (!props.currentSentence) return [];
  let offset = 0;
  let charOffset = 0;
  return segmentReadingLine(props.currentSentence.target, `typing-${props.currentSentence.id}`).map((segment) => {
    const start = offset;
    offset += segment.text.length;
    const chars = Array.from(segment.text, (text) => ({ text, index: charOffset++ }));
    return { segment, start, chars };
  });
});

function charClass(index: number): string {
  const letterIndex = feedback.value.targetLetterIndices[index] ?? -1;
  if (composing.value || letterIndex < 0 || letterIndex >= feedback.value.actual.length) return "study-typing-pending";
  return feedback.value.actual[letterIndex]?.toLowerCase() === feedback.value.expected[letterIndex]?.toLowerCase() ? "study-typing-correct" : "study-typing-error";
}

const statusText = computed(() => {
  if (composing.value) return "请切换到英文键盘，确认输入后继续。";
  const { firstError, expected, actual, ready } = feedback.value;
  if (firstError >= 0) return expected[firstError] === undefined
    ? `多输入了 ${actual.length - expected.length} 个英文字母，请删除。`
    : `第 ${firstError + 1} 个英文字母应为“${expected[firstError]}”，当前是“${actual[firstError]}”。`;
  if (ready) return `输入正确，按 Enter ${lastSentence.value ? "完成练习" : "继续下一句"}。`;
  if (submittedEarly.value) return "本句还没输完，请继续输入。";
  return "只校验英文字母，不区分大小写；输完按 Enter 继续。";
});

function resizeInput(): void {
  const el = input.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`;
}

function onInput(event: Event): void {
  submittedEarly.value = false;
  emit("input", (event.target as HTMLTextAreaElement).value,
    !composing.value && !(event as InputEvent).isComposing && isTypingKeyboardInput(event as InputEvent));
  resizeInput();
}

function onCompositionEnd(event: CompositionEvent): void {
  composing.value = false;
  emit("input", (event.target as HTMLTextAreaElement).value, true);
}

function submit(): void {
  if (composing.value) return;
  if (feedback.value.ready) { emit("submit"); return; }
  submittedEarly.value = true;
  input.value?.focus();
  if (feedback.value.firstError >= 0) {
    const offset = feedback.value.errorOffset;
    input.value?.setSelectionRange(offset, offset + (feedback.value.actual[feedback.value.firstError]?.length ?? 1));
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" || event.isComposing || composing.value || event.keyCode === 229) return;
  event.preventDefault();
  if (!event.repeat) submit();
}

function onBeforeInput(event: Event): void {
  const entry = event as InputEvent;
  if (!composing.value && !entry.isComposing && /^(insertLineBreak|insertParagraph)$/.test(entry.inputType)) {
    event.preventDefault();
    submit();
  }
}

let resizeObserver: ResizeObserver | undefined;
watch(input, (el) => {
  resizeObserver?.disconnect();
  if (!el) return;
  let width = -1;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry && width !== entry.contentRect.width) { width = entry.contentRect.width; resizeInput(); }
  });
  resizeObserver.observe(el);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

watch(() => [props.state.current, props.finished, currentCompleted.value], async () => {
  composing.value = false;
  submittedEarly.value = false;
  await nextTick();
  resizeInput();
  if (props.finished) result.value?.focus();
  else {
    input.value?.focus({ preventScroll: true });
    input.value?.scrollIntoView({ block: "center" });
  }
}, { immediate: true });
</script>

<template>
  <div class="study-typing" data-testid="article-typing">
    <div v-if="finished" ref="result" class="study-typing-finished" role="status" tabindex="-1">
      <strong>已完成这篇文章的跟打</strong>
      <button type="button" class="study-button" @click="emit('restartSentence')">重练所选句</button>
      <button type="button" class="study-button study-button-primary" @click="emit('restartAll')">重新练习</button>
    </div>

    <template v-else-if="currentSentence">
      <div class="study-typing-current">
        <div class="study-typing-current-head">
          <span>第 {{ state.current + 1 }} / {{ sentences.length }} 句</span>
          <button type="button" class="study-button" :disabled="speechDisabled"
            @click="emit('speak', currentSentence.target)">朗读本句</button>
        </div>
        <p class="study-typing-reference" aria-label="跟打原句"><template
          v-for="part in referenceSegments" :key="part.segment.id"><button
            v-if="part.segment.type === 'word'" type="button" class="study-word study-typing-word"
            :class="[learnedClass(part.segment.text), {
              'study-word-selected': selectedId === part.segment.id,
              'study-typing-word-current': !currentCompleted && !feedback.ready && part.start === currentWord?.start,
            }]" :aria-label="part.segment.text" title="点击查词"
            @click="emit('word', part.segment, $event, currentSentence.display)"><span
              v-for="char in part.chars" :key="char.index" :class="charClass(char.index)"
            >{{ char.text }}</span></button><template v-else><span
              v-for="char in part.chars" :key="char.index" :class="charClass(char.index)"
            >{{ char.text }}</span></template></template></p>
        <details v-if="currentSentence.display !== currentSentence.target" class="study-typing-context">
          <summary>查看完整原文</summary>
          <p>{{ currentSentence.display }}</p>
        </details>
        <label v-if="!currentCompleted" class="study-typing-label" for="article-typing-input">在这里跟打</label>
        <textarea v-if="!currentCompleted" id="article-typing-input" ref="input" class="study-typing-input"
          :key="state.current" :value="currentDraft" rows="1" spellcheck="false" lang="en"
          placeholder="跟着上方原句，开始输入…" enterkeyhint="next"
          autocomplete="off" autocapitalize="off" autocorrect="off"
          :aria-invalid="!composing && feedback.firstError >= 0" aria-describedby="article-typing-status"
          @input="onInput" @keydown="onKeydown" @beforeinput="onBeforeInput"
          @compositionstart="composing = true" @compositionend="onCompositionEnd" />
        <div v-else class="study-typing-completed">
          <span>本句已完成。</span>
          <button type="button" class="study-button" @click="emit('restartSentence')">重练本句</button>
        </div>
        <div v-if="!currentCompleted" class="study-typing-feedback">
          <p id="article-typing-status" class="study-typing-status" role="status"
            :class="{ 'study-typing-error-message': !composing && feedback.firstError >= 0,
              'study-typing-ready': !composing && feedback.ready }">{{ statusText }}</p>
          <button type="button" class="study-button" :class="{ 'study-button-primary': feedback.ready }"
            :disabled="composing" @click="submit">{{ lastSentence ? '完成练习' : '下一句' }} <kbd>↵</kbd></button>
        </div>
      </div>
    </template>

    <details class="study-typing-directory">
      <summary>句子目录 <span>{{ sentences.length }} 句 · 可跳转练习</span></summary>
      <nav class="study-typing-nav" aria-label="跟打句子导航">
      <button v-for="(sentence, index) in sentences" :key="sentence.id" type="button"
        class="study-typing-nav-item"
        :class="{ 'study-typing-nav-current': index === state.current, 'study-typing-nav-done': state.completed.includes(index) }"
        :aria-current="index === state.current ? 'step' : undefined"
        @click="emit('choose', index)">
        <span>{{ index + 1 }}. {{ state.completed.includes(index) ? '✓' : '' }}</span>
        <span class="study-typing-nav-preview">{{ sentence.target }}</span>
      </button>
      </nav>
    </details>
  </div>
</template>
