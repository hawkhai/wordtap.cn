import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as vue from "vue";

const root = new URL("../", import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const cache = new Map();
  const saved = new Map();
  const speech = [];
  const wordSpeech = [];
  const localStorage = new Map();
  const mocks = {
    vue: { ...vue, onBeforeUnmount: () => {} },
    "../stores/historyStore": {
      articleTypingSourceId: async (text) => `source:${text}`,
      getArticleTypingProgress: async (key) => saved.get(key) ?? null,
      latestArticleTypingProgress: async (sourceId) =>
        [...saved.values()].filter((record) => record.sourceId === sourceId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
      putArticleTypingProgress: async (record) => { saved.set(record.key, plain(record)); },
    },
    "../utils/articleTypingSource": { loadArticleTypingBody: options.loadBody ?? (async (lesson) => lesson.course === "pep-english" ? "Hello world. Go now!" : null) },
  };
  const window = { localStorage: { getItem: (key) => localStorage.get(key) ?? null, setItem: (key, value) => localStorage.set(key, value) } };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(new URL(file, root), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    cache.set(file, exports);
    const require = (id) => {
      if (mocks[id]) return mocks[id];
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
      return load(target.endsWith(".ts") ? target : `${target}.ts`);
    };
    vm.runInNewContext(output, { exports, require, window, console, structuredClone }, { filename: file });
    return exports;
  }
  return { load, saved, speech, wordSpeech, window };
}

test("English body extraction and target projection leave source text intact", () => {
  const { load } = harness();
  const typing = load("src/shared/utils/articleTyping.ts");
  const blocks = [
    { type: "heading", lang: "en", text: "Title" },
    { type: "paragraph", lang: "en", text: "Hello world." },
    { type: "paragraph", lang: "zh", text: "你好。" },
    { type: "paragraph", lang: "en", text: "Go now!" },
  ];
  assert.equal(typing.englishBlocks(blocks), "Hello world.\n\nGo now!");
  assert.equal(typing.nceBodyText({ bodyText: " Body only. ", text: "Question?\n\nBody only." }), "Body only.");
  const shuimu = JSON.parse(fs.readFileSync(new URL("public/shuimu/lessons/intermediate/065.json", root), "utf8"));
  const shuimuBody = typing.shuimuBodyText(shuimu.blocks);
  assert.ok(shuimuBody.startsWith("I have just received a letter from my old school"));
  assert.ok(shuimuBody.endsWith("one is never too old to learn."));
  assert.equal(shuimuBody.split("\n\n").length, 8);
  assert.ok(!shuimuBody.includes("Question:") && !shuimuBody.includes("CONNECTIONS POINTS"));
  const sentences = typing.buildTypingSentences("Hello (中文注释) world.\n你好。\nGo now!");
  assert.deepEqual(plain(sentences.map(({ display, target }) => ({ display, target }))), [
    { display: "Hello (中文注释) world.", target: "Hello world." },
    { display: "Go now!", target: "Go now!" },
  ]);
});

test("typing reference uses the same word boundaries and preserves the displayed sentence", () => {
  const { load } = harness();
  const { segmentReadingLine } = load("src/shared/utils/readingWords.ts");
  const sentence = "Mr. Page's school—still open! 中文";
  const segments = segmentReadingLine(sentence, "typing-sentence-1");
  assert.equal(segments.map((part) => part.text).join(""), sentence);
  assert.deepEqual(plain(segments.filter((part) => part.type === "word").map((part) => part.text)),
    ["Mr", "Page's", "school", "still", "open"]);
  assert.ok(segments.every((part) => part.id.startsWith("typing-sentence-1-")));
});

test("next word follows the correct letter prefix regardless of case or separators", () => {
  const { nextTypingWord } = harness().load("src/shared/utils/articleTyping.ts");
  const target = "Hello, world!";
  assert.deepEqual(plain(nextTypingWord(target, "")), { text: "Hello", start: 0 });
  assert.deepEqual(plain(nextTypingWord(target, "Hello")), { text: "world", start: 7 });
  assert.deepEqual(plain(nextTypingWord(target, "Hello,")), { text: "world", start: 7 });
  assert.deepEqual(plain(nextTypingWord(target, "Hello, wr")), { text: "world", start: 7 });
  assert.deepEqual(plain(nextTypingWord(target, "Hello, world!")), null);
  assert.deepEqual(plain(nextTypingWord(target, "HELLO123w")), { text: "world", start: 7 });
  assert.equal(nextTypingWord(target, "helloworld"), null);
  assert.deepEqual(plain(nextTypingWord("Don't stop!", "DONT")), { text: "stop", start: 6 });
});

test("letter-only feedback ignores nonletters and case while mapping errors to the actual input", () => {
  const { typingFeedback } = harness().load("src/shared/utils/articleTyping.ts");
  for (const draft of ["Hello  world.", "helloworld", "HELLO, WORLD!!!", "hello中文123😀\nworld"]) {
    assert.equal(typingFeedback("Hello world.", draft).ready, true, draft);
  }
  assert.equal(typingFeedback("Don't stop!", "dontstop").ready, true);
  assert.equal(typingFeedback("Hello world.", "Hello worl").ready, false);
  assert.equal(typingFeedback("Hello.", "中文123!").ready, false);
  const extra = typingFeedback("Hello.", "Hello. X");
  assert.equal(extra.firstError, 5);
  assert.equal(extra.expected[extra.firstError], undefined);
  assert.equal(extra.ready, false);
  const unicode = typingFeedback("Hi 😀!", "Hi 😀x");
  assert.equal(unicode.firstError, 2);
  assert.equal(unicode.errorOffset, 5);
  assert.equal(typingFeedback("Hello.", "Hello.").ready, true);
  assert.equal(typingFeedback("Hello.", "Hello").firstError, -1);
  const wrong = typingFeedback("Hi, Tom!", "hi 😀 1中文 xom");
  assert.equal(wrong.firstError, 2);
  assert.equal(wrong.errorOffset, 10);
  assert.deepEqual(plain(wrong.targetLetterIndices), [0, 1, -1, -1, 2, 3, 4, -1]);
});

test("restoring a draft preserves ignored characters without truncating later letters", () => {
  const { normalizeTypingState, typingFeedback } = harness().load("src/shared/utils/articleTyping.ts");
  const draft = "123 ".repeat(40) + "hello WORLD";
  const state = normalizeTypingState({ current: 0, completed: [], drafts: { 0: draft } }, [{ target: "Hello world." }]);
  assert.equal(state.drafts[0], draft);
  assert.equal(typingFeedback("Hello world.", state.drafts[0]).ready, true);
});

test("only explicit correct submission completes a sentence and skips completed sentences", () => {
  const { buildTypingSentences, initialTypingState, updateTypingDraft, submitTypingSentence } = harness().load("src/shared/utils/articleTyping.ts");
  const sentences = buildTypingSentences("One. Two. Three.");
  let state = updateTypingDraft(initialTypingState(), "On");
  assert.equal(submitTypingSentence(state, sentences), state);
  state = updateTypingDraft(state, "OneX ");
  assert.equal(submitTypingSentence(state, sentences), state);
  state = updateTypingDraft({ ...state, completed: [1] }, "o n e 123");
  assert.equal(state.current, 0);
  state = submitTypingSentence(state, sentences);
  assert.equal(state.current, 2);
  assert.deepEqual(plain(state.completed), [0, 1]);
  assert.equal(submitTypingSentence(state, sentences), state);
  state = submitTypingSentence(updateTypingDraft(state, "Three."), sentences);
  assert.equal(state.completed.length, 3);
  assert.equal(submitTypingSentence(state, sentences), state);
});

test("a correct unsubmitted draft survives reopening and IME commit speaks only once", async () => {
  const h = harness();
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText: vue.ref("Hello world. Go now!"), activeCourseLesson: vue.ref(null), activeView: vue.ref("study"),
    speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: async () => {}, speakWord: word => h.wordSpeech.push(word), stopSpeech: () => {},
  });
  await app.start();
  app.typeDraft("H", false); // IME intermediate text is saved silently.
  assert.deepEqual(h.wordSpeech, []);
  app.typeDraft("H", true); // compositionend can repeat the same value.
  app.typeDraft("H", true); // browser's final input event must not duplicate speech.
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.typeDraft("Hello world.", true);
  app.close();
  await app.start();
  assert.equal(app.currentDraft.value, "Hello world.");
  assert.equal(app.state.value.current, 0);
  assert.equal(app.completedCount.value, 0);
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.submitSentence();
  assert.equal(app.state.value.current, 1);
  assert.equal(app.completedCount.value, 1);
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.close();
});

test("letter-only input, sentence switching and saved drafts resume on the same article", async () => {
  const h = harness();
  const scope = vue.effectScope();
  const sourceText = vue.ref("Hello world. Go now!");
  const activeCourseLesson = vue.ref(null);
  const activeView = vue.ref("study");
  const speechDisabled = vue.ref(false);
  const make = () => scope.run(() => h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText, activeCourseLesson, activeView, speechDisabled, wordSpeechDisabled: vue.ref(false),
    speak: async (text) => { h.speech.push(text); }, speakWord: (word) => { h.wordSpeech.push(word); }, stopSpeech: () => {},
  }));
  const app = make();
  await app.start();
  assert.equal(app.sentences.value.length, 2);
  app.typeDraft("hello world.", true);
  assert.equal(app.completedCount.value, 0);
  app.chooseSentence(1);
  app.typeDraft("Go", true);
  app.chooseSentence(0);
  assert.equal(app.currentDraft.value, "hello world.");
  app.typeDraft("Hello world.", true);
  assert.equal(app.state.value.current, 0);
  assert.equal(app.completedCount.value, 0);
  app.submitSentence();
  assert.equal(app.state.value.current, 1);
  assert.equal(app.currentDraft.value, "Go");
  app.typeDraft("Go now!", true);
  assert.equal(app.finished.value, false);
  app.submitSentence();
  assert.equal(app.finished.value, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  app.close();
  const restored = make();
  await restored.start();
  assert.equal(restored.finished.value, true);
  restored.chooseSentence(0);
  restored.restartSentence();
  assert.equal(restored.finished.value, false);
  assert.equal(restored.currentDraft.value, "");
  scope.stop();
});

test("automatic next-word speech waits for typing, advances once per word and can be turned off", async () => {
  const h = harness();
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText: vue.ref("Hello world. Go now!"), activeCourseLesson: vue.ref(null), activeView: vue.ref("study"),
    speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: async () => {}, speakWord: (word) => { h.wordSpeech.push(word); }, stopSpeech: () => {},
  });
  await app.start();
  assert.equal(app.autoWord.value, true);
  assert.deepEqual(h.wordSpeech, []);
  app.typeDraft("Hel", true);
  app.typeDraft("Helx", true);
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.typeDraft("Hello", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world"]);
  app.typeDraft("Hello ", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world"]);
  app.typeDraft("Hello wro", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world"]);
  app.setAutoWord(false);
  assert.equal(h.window.localStorage.getItem("wordtap.articleTyping.autoWord"), "false");
  app.typeDraft("Hello world.", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world"]);
  app.setAutoWord(true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world"]);
  app.submitSentence();
  app.typeDraft("G", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world", "Go"]);
  app.typeDraft("Go ", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "world", "Go", "now"]);
  app.close();
});

test("whole-sentence auto speech finishes before next-word speech and stale sentences stay silent", async () => {
  const h = harness();
  const pending = [];
  h.window.localStorage.setItem("wordtap.articleTyping.autoSpeak", "true");
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText: vue.ref("Hello world. Go now!"), activeCourseLesson: vue.ref(null), activeView: vue.ref("study"),
    speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: (sentence) => new Promise((resolve) => { h.speech.push(sentence); pending.push(resolve); }),
    speakWord: (word) => { h.wordSpeech.push(word); }, stopSpeech: () => {},
  });
  await app.start();
  assert.deepEqual(h.speech, ["Hello world."]);
  assert.deepEqual(h.wordSpeech, []);
  app.setAutoWord(false);
  app.setAutoWord(true);
  assert.deepEqual(h.wordSpeech, []);
  app.chooseSentence(1);
  pending.shift()();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(h.wordSpeech, []);
  pending.shift()();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(h.wordSpeech, []);
  app.typeDraft("G", true);
  assert.deepEqual(h.wordSpeech, ["Go"]);
  app.close();
});

test("courses start directly even without body metadata; selection remains optional", async () => {
  const h = harness();
  const sourceText = vue.ref("Question?\n\nArticle starts here. Next line.");
  const activeCourseLesson = vue.ref({ course: "cet", path: "cet.json", id: "test", title: "Test", code: "", url: "" });
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText, activeCourseLesson, activeView: vue.ref("study"), speechDisabled: vue.ref(false),
    wordSpeechDisabled: vue.ref(false),
    speak: async (text) => { h.speech.push(text); }, speakWord: (word) => { h.wordSpeech.push(word); }, stopSpeech: () => {},
  });
  await app.start();
  assert.equal(app.active.value, true);
  assert.equal(app.sentences.value.length, 3);
  assert.equal(app.message.value, "");
  app.close();
  const start = sourceText.value.indexOf("Article");
  await app.start(start, sourceText.value.length);
  assert.equal(app.active.value, true);
  assert.equal(app.sentences.value.length, 2);
  assert.equal(h.speech.length, 0);
  app.setAutoSpeak(true);
  assert.equal(h.speech.at(-1), "Article starts here.");
  app.typeDraft("Article starts here.", true);
  app.submitSentence();
  assert.equal(h.speech.at(-1), "Next line.");
});

test("learning-data import accepts old payloads and round-trips typing progress", async () => {
  const stores = new Map();
  const database = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name) {
      const data = new Map();
      stores.set(name, data);
      return { createIndex() {} };
    },
    transaction(names) {
      let pending = 0;
      let finished = false;
      const tx = {
        _oncomplete: null,
        set oncomplete(fn) { this._oncomplete = fn; queueMicrotask(complete); },
        get oncomplete() { return this._oncomplete; },
        objectStore(name) {
          const data = stores.get(name);
          const request = (getResult) => {
            pending += 1;
            const req = {};
            queueMicrotask(() => {
              req.result = getResult();
              req.onsuccess?.();
              pending -= 1;
              complete();
            });
            return req;
          };
          return {
            getAll: () => request(() => [...data.values()]),
            get: (key) => request(() => data.get(key)),
            put: (record) => request(() => { data.set(record.key ?? record.id ?? record.word, record); return record.key; }),
            delete: (key) => request(() => data.delete(key)),
          };
        },
      };
      function complete() {
        if (!finished && pending === 0 && tx.oncomplete) {
          finished = true;
          queueMicrotask(() => tx.oncomplete());
        }
      }
      return tx;
    },
  };
  const indexedDB = {
    open() {
      const req = { result: database };
      queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
  const source = fs.readFileSync(new URL("src/shared/stores/historyStore.ts", root), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, require: () => ({ siteCopy: { historyStore: {} } }), indexedDB,
    console, TextEncoder, crypto: globalThis.crypto, Date,
  });
  const old = { schemaVersion: 2, words: [{ word: "hello", meaning: "你好", count: 1 }], examProgress: [], examWords: [] };
  const oldResult = await exports.importCompleteLearningDataJson(JSON.stringify(old));
  assert.equal(oldResult.words, 1);
  assert.equal(oldResult.articleTyping, 0);
  const progress = {
    key: "source:full:0:0", sourceId: "source", mode: "full",
    selectionStart: 0, selectionEnd: 0,
    state: { current: 1, completed: [0], drafts: { 1: "Go" } },
    updatedAt: "2026-10-07T00:00:00.000Z",
  };
  const result = await exports.importCompleteLearningDataJson(JSON.stringify({ schemaVersion: 3, articleTyping: [progress] }));
  assert.equal(result.articleTyping, 1);
  const exported = JSON.parse(await exports.exportCompleteLearningDataJson());
  assert.equal(exported.schemaVersion, 4);
  assert.ok(Array.isArray(exported.texts));
  const textResult = await exports.importCompleteLearningDataJson(JSON.stringify({schemaVersion: 3, texts: [{text: "Saved article.", count: 2}]}));
  assert.equal(textResult.texts, 1);
  const backup = JSON.parse(await exports.exportCompleteLearningDataJson());
  assert.equal(backup.texts[0].text, "Saved article.");
  await exports.importCompleteLearningDataJson(JSON.stringify(backup));
  assert.equal((await exports.listStudyTexts()).length, 1);
  const invalid = [
    {...progress, state: {...progress.state, current: -1}},
    {...progress, state: {...progress.state, completed: [-1]}},
    {...progress, state: {...progress.state, drafts: {1: 42}}},
    {...progress, mode: "selection", selectionStart: 5, selectionEnd: 2},
    {...progress, key: "mismatched"},
  ];
  for (const record of invalid) {
    await assert.rejects(exports.importCompleteLearningDataJson(JSON.stringify({articleTyping: [record]})));
  }
  const arrayResult = await exports.importCompleteLearningDataJson(JSON.stringify([{word: "legacy", count: 1}]));
  assert.equal(arrayResult.words, 1);
  assert.deepEqual(plain(exported.articleTyping), [progress]);
});


test("opening, restoring, navigation, restarting and switches never initiate word speech", async () => {
  const h = harness();
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText: vue.ref("Hello world. Go now!"), activeCourseLesson: vue.ref(null), activeView: vue.ref("study"),
    speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: async () => {}, speakWord: word => h.wordSpeech.push(word), stopSpeech: () => {},
  });
  await app.start();
  app.typeDraft("", true);
  app.setAutoWord(false); app.setAutoWord(true);
  app.chooseSentence(1); app.restartSentence(); app.restartAll();
  app.setAutoSpeak(true); await Promise.resolve(); await Promise.resolve();
  app.setAutoSpeak(false);
  assert.deepEqual(h.wordSpeech, []);
  app.typeDraft("H", true);
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.chooseSentence(1); app.chooseSentence(0);
  app.restartSentence(); app.restartAll();
  app.close(); await app.start();
  assert.deepEqual(h.wordSpeech, ["Hello"]);
  app.typeDraft("He", true);
  assert.deepEqual(h.wordSpeech, ["Hello", "Hello"]);
  app.close();
});

test("paste and confirmation stay silent; each sentence waits for actual text input to speak words", async () => {
  const h = harness();
  const { isTypingKeyboardInput } = h.load("src/shared/utils/articleTyping.ts");
  const app = h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText: vue.ref("Hello world. Go now!"), activeCourseLesson: vue.ref(null), activeView: vue.ref("study"),
    speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: async () => {}, speakWord: word => h.wordSpeech.push(word), stopSpeech: () => {},
  });
  await app.start();
  app.typeDraft("H");
  app.typeDraft("Hello ", isTypingKeyboardInput({inputType: 'insertFromPaste'}));
  app.typeDraft("Hello world.", isTypingKeyboardInput({inputType: 'insertFromDrop'}));
  app.submitSentence();
  assert.equal(app.state.value.current, 1);
  assert.deepEqual(h.wordSpeech, []);
  app.typeDraft("G", isTypingKeyboardInput({inputType: 'insertText'}));
  assert.deepEqual(h.wordSpeech, ["Go"]);
  app.restartAll();
  app.typeDraft("Hello world.", true);
  app.submitSentence();
  assert.deepEqual(h.wordSpeech, ["Go"]);
  app.typeDraft("G", true);
  assert.deepEqual(h.wordSpeech, ["Go", "Go"]);
  for (const inputType of ['deleteContentBackward', 'insertCompositionText']) {
    assert.equal(isTypingKeyboardInput({inputType}), true);
  }
  for (const inputType of ['', 'insertFromPaste', 'insertFromDrop', 'deleteByCut', 'historyUndo']) {
    assert.equal(isTypingKeyboardInput({inputType}), false);
  }
  app.close();
});


test("vocabulary extraction failure does not practice metadata; retry and saved drafts work", async () => {
  let fail = true;
  const h = harness({ loadBody: async () => {
    if (fail) throw new Error("offline");
    return "A real example.\n\nwell-known";
  } });
  const scope = vue.effectScope();
  const sourceText = vue.ref("英语词汇 · Test\nword\n音标：英 /wɜːd/\nn. 词语");
  const make = () => scope.run(() => h.load("src/shared/composables/useArticleTyping.ts").useArticleTyping({
    sourceText, activeCourseLesson: vue.ref({ course: "english-vocabulary", id: "evjunior-001", path: "unit.json" }),
    activeView: vue.ref("study"), speechDisabled: vue.ref(false), wordSpeechDisabled: vue.ref(false),
    speak: async () => {}, speakWord: () => {}, stopSpeech: () => {},
  }));
  const app = make();
  await app.start();
  assert.equal(app.active.value, false);
  assert.match(app.message.value, /重试/);
  fail = false;
  await app.start();
  assert.equal(app.active.value, true);
  assert.deepEqual(plain(app.sentences.value.map(s => s.target)), ["A real example.", "well-known"]);
  app.typeDraft("A real", true);
  await new Promise(resolve => setTimeout(resolve, 0));
  app.close();
  const restored = make();
  await restored.start();
  assert.equal(restored.currentDraft.value, "A real");
  restored.close();
  scope.stop();
});
