import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as vue from "vue";

const root = new URL("../", import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness() {
  const timers = new Map();
  let timerId = 0;
  const utterances = [];
  const gateways = [];
  const writes = [];
  const unmount = [];
  const storage = new Map();
  const speech = {
    paused: false, cancels: 0,
    cancel() { this.cancels++; },
    speak(utterance) { if (utterance.text) utterances.push(utterance); },
    getVoices: () => [],
  };
  class Utterance { constructor(text) { this.text = text; } }
  class FakeGateway {
    cancelled = false;
    constructor() { this.pending = deferred(); gateways.push(this); }
    speak(text, options) { this.text = text; this.options = options; return this.pending.promise; }
    cancel() { this.cancelled = true; }
  }
  const setTimer = (fn) => { timers.set(++timerId, fn); return timerId; };
  const clearTimer = (id) => timers.delete(id);
  const window = {
    speechSynthesis: speech, SpeechSynthesisUtterance: Utterance,
    Audio: class {}, URL, fetch: () => {}, innerWidth: 1280, innerHeight: 900,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    location: { hash: "#study", origin: "http://localhost", pathname: "/", protocol: "http:" },
    setTimeout: setTimer, clearTimeout: clearTimer, setInterval: setTimer, clearInterval: clearTimer,
    removeEventListener() {},
  };
  const history = new Proxy({
    normalizeHistoryWord: word => word.toLowerCase(),
    recordWordStudy: async word => { writes.push(word); },
    recordStudyText: async text => ({ id: "test", text }),
    listStudyHistory: async () => [], listStudyTexts: async () => [],
  }, { get: (target, key) => target[key] ?? (async () => undefined) });
  const mocks = {
    vue: { ...vue, onMounted: () => {}, onBeforeUnmount: fn => unmount.push(fn) },
    "../stores/historyStore": history,
    "../utils/gatewayTranslate": { translateWithBaiduSugGateway: async () => null },
    "../utils/lessonUrls": { buildLessonShortUrl: () => '', lessonShortCode: () => '', parseLessonShortCode: () => null },
    "../utils/assetUrls": { appAssetUrl: s => s, appDownloadUrl: s => s },
    "../utils/device": { isNarrowLayoutViewport: () => false, isProbablyMobileBrowser: () => false, isWindows: () => true },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(new URL(file, root), "utf8");
    if (file.endsWith(".json")) return JSON.parse(source);
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    cache.set(file, exports);
    const require = (id) => {
      if (mocks[id]) return mocks[id];
      if (id.endsWith("gatewaySpeech")) return {
        GatewaySpeechSession: FakeGateway,
        isGatewaySpeechCancelError: error => error?.name === "AbortError",
      };
      if (id.includes("/data/")) return {};
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
      return load(/\.(js|json|ts)$/.test(target) ? target : `${target}.ts`);
    };
    vm.runInNewContext(output, {
      exports, require, window, console, URL, AbortController, DOMException, Error,
      SpeechSynthesisUtterance: Utterance, HTMLElement: class {},
      setTimeout: setTimer, clearTimeout: clearTimer, setInterval: setTimer, clearInterval: clearTimer,
      navigator: { userAgent: "test" },
    }, { filename: file });
    return exports;
  }
  const scope = vue.effectScope();
  const app = scope.run(() => load("src/shared/composables/useWordTap.ts").useWordTap());
  return {
    app, load, timers, utterances, gateways, writes, speech, history, window,
    text(text) {
      app.sourceText.value = text;
      // Exercise the production splitWords via its real debounced input path.
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
      app.splitWords({ recordTextHistory: false });
    },
    dispose() { for (const fn of unmount) fn(); scope.stop(); },
  };
}

test("sentence ranges keep short replies, abbreviations, decimals, URLs and quotes intact", () => {
  const h = harness();
  try {
    h.text('  Mr. Smith paid 3.14 dollars. "Yes?" Visit https://example.com/a?x=1.\nGo!\nNo punctuation\n中文说明\nHello!  ');
    assert.deepEqual(plain(h.app.sentences.value.map(s => s.text)), [
      'Mr. Smith paid 3.14 dollars.', '"Yes?"', 'Visit https://example.com/a?x=1.', 'Go!', 'No punctuation', '中文说明', 'Hello!',
    ]);
    for (const sentence of h.app.sentences.value) {
      assert.equal(h.app.sourceText.value.trim().slice(sentence.start, sentence.end), sentence.text);
    }
  } finally { h.dispose(); }
});

test("render runs preserve every original word ID, index, punctuation and blank line", () => {
  const h = harness();
  try {
    for (const text of ['\n  Yes? No!\n\n\nHello中文world.  ', 'Price: 3.14; really?! “Yes.”', 'Go!Next. A test.']) {
      h.text(text);
      const old = h.app.segments.value;
      const rendered = h.app.readingRuns.value.flatMap(r => r.segments);
      const words = values => values.filter(s => s.type === 'word').map(({ id, text, index }) => ({ id, text, index }));
      const reconstruct = values => values.map(s => s.text + (s.trailingText ?? '')).join('');
      assert.deepEqual(plain(words(rendered)), plain(words(old)));
      assert.equal(reconstruct(rendered), text.trim());
      assert.equal(rendered.filter(s => s.type === 'blank-line').length, old.filter(s => s.type === 'blank-line').length);
      assert.ok(h.app.sentences.value.every(s => text.trim().slice(s.start, s.end) === s.text));
    }
  } finally { h.dispose(); }
});

test("single sentence ignores repeat count, completes, rereads and never writes word history", async () => {
  const h = harness();
  try {
    h.text('Hello world. Yes?');
    h.app.selectedRepeat.value = 3;
    const id = h.app.sentences.value[0].id;
    const first = h.app.readSentence(id);
    assert.equal(h.app.sentenceSpeechState.value, 'preparing');
    const utterance = h.utterances.at(-1);
    assert.equal(utterance.text, 'Hello world.');
    utterance.onstart();
    assert.equal(h.app.sentenceSpeechState.value, 'playing');
    utterance.onend();
    await first;
    assert.equal(h.app.isSpeaking.value, false);
    assert.equal(h.utterances.length, 1);
    const second = h.app.readSentence(id);
    h.utterances.at(-1).onend();
    await second;
    assert.equal(h.utterances.length, 2);
    assert.equal(h.writes.length, 0);
  } finally { h.dispose(); }
});

test("Chinese-only paragraphs remain visible even without clickable English words", () => {
  const h = harness();
  try {
    const text = '中文必须完整显示。\n\n第二段也保持原来的换行。';
    h.text(text);
    assert.equal(h.app.wordCount.value, 0);
    const rendered = h.app.readingRuns.value.flatMap(r => r.segments);
    assert.equal(rendered.map(s => s.text + (s.trailingText ?? '')).join(''), text);
    assert.equal(rendered.filter(s => s.type === 'blank-line').length, 1);
    assert.deepEqual(plain(h.app.sentences.value.map(s => s.text)), ['中文必须完整显示。', '第二段也保持原来的换行。']);
  } finally { h.dispose(); }
});

test("mixed-language sentence is sent intact to the speech engine", async () => {
  const h = harness();
  try {
    h.text('Hello，中文也保留在句子里面 world。下一句。');
    const first = h.app.sentences.value[0];
    assert.equal(first.text, 'Hello，中文也保留在句子里面 world。');
    const pending = h.app.readSentence(first.id);
    assert.equal(h.utterances.at(-1).text, first.text);
    h.utterances.at(-1).onend(); await pending;
    assert.equal(h.writes.length, 0);
  } finally { h.dispose(); }
});

test("stop while preparing settles browser speech and removes handlers and timers", async () => {
  const h = harness();
  try {
    h.text('Hello world.');
    const baseline = h.timers.size;
    const id = h.app.sentences.value[0].id;
    const pending = h.app.readSentence(id);
    await h.app.readSentence(id);
    await pending;
    assert.equal(h.app.activeSentenceId.value, '');
    assert.equal(h.utterances.at(-1).onend, null);
    assert.equal(h.timers.size, baseline);
  } finally { h.dispose(); }
});

test("late Gateway callbacks cannot revive cancelled sentences or replace a newer sentence", async () => {
  const h = harness();
  try {
    h.text('One. Two.');
    h.app.isGatewayRunning.value = true;
    const [one, two] = h.app.sentences.value;
    const first = h.app.readSentence(one.id);
    const old = h.gateways[0];
    const second = h.app.readSentence(two.id);
    assert.equal(old.cancelled, true);
    old.options.onProgress({ phase: 'playing' });
    old.pending.reject(new Error('offline'));
    await first;
    assert.equal(h.utterances.length, 0);
    assert.equal(h.app.activeSentenceId.value, two.id);
    h.gateways[1].options.onProgress({ phase: 'playing' });
    h.gateways[1].pending.resolve();
    await second;
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});

test("Gateway failure falls back to browser; browser failure allows retry", async () => {
  const h = harness();
  try {
    h.text('Read this.'); h.app.isGatewayRunning.value = true;
    const pending = h.app.readSentence(h.app.sentences.value[0].id);
    h.gateways[0].pending.reject(new Error('offline'));
    await tick();
    assert.equal(h.gateways[0].cancelled, true);
    assert.equal(h.utterances.at(-1).text, 'Read this.');
    h.utterances.at(-1).onerror({ error: 'not-allowed' });
    await pending;
    assert.match(h.app.status.value, /失败/);
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});

test("word playback interrupts a sentence; a sentence interrupts word repeats and full text", async () => {
  const h = harness();
  try {
    h.text('Hello world. Next sentence.');
    const id = h.app.sentences.value[0].id;
    const sentence = h.app.readSentence(id);
    h.app.speakWord('world', 'world');
    await sentence;
    assert.equal(h.app.activeSentenceId.value, '');
    assert.equal(h.utterances.at(-1).text, 'world');
    const wordUtterance = h.utterances.at(-1);
    const next = h.app.readSentence(id);
    assert.equal(wordUtterance.onend, null);
    assert.equal(h.app.isWordSpeaking.value, false);
    await h.app.readFullText();
    await next;
    assert.equal(h.app.activeSentenceId.value, '');
    assert.equal(h.app.isFullTextSpeaking.value, true);
    const full = h.utterances.at(-1);
    const last = h.app.readSentence(id);
    assert.equal(full.onend, null);
    assert.equal(h.app.isFullTextSpeaking.value, false);
    h.app.cancelSpeech(); await last;
  } finally { h.dispose(); }
});

test("editing and navigation cancel synchronously, reject stale sentence IDs and dispose audio", async () => {
  const h = harness();
  try {
    h.text('Old sentence.');
    const id = h.app.sentences.value[0].id;
    const pending = h.app.readSentence(id);
    h.app.sourceText.value = 'New sentence.';
    assert.equal(h.app.activeSentenceId.value, '');
    assert.equal(h.app.sentenceSpeechDisabled.value, true);
    await h.app.readSentence(id); await pending;
    assert.equal(h.utterances.length, 1);
    h.text('Another sentence.');
    const second = h.app.readSentence(h.app.sentences.value[0].id);
    h.app.activeView.value = 'review'; await second;
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
  assert.equal(h.timers.size, 0);
});

test("pending full-text history save cannot start audio after a newer sentence", async () => {
  const h = harness();
  try {
    h.text('A sentence.');
    const saved = deferred();
    h.history.recordStudyText = () => saved.promise;
    const full = h.app.readFullText();
    const sentence = h.app.readSentence(h.app.sentences.value[0].id);
    saved.resolve({ id: 'saved', text: 'A sentence.' }); await full;
    assert.equal(h.utterances.length, 1);
    assert.notEqual(h.app.activeSentenceId.value, '');
    h.app.cancelSpeech(); await sentence;
  } finally { h.dispose(); }
});

test("immediate article splitting clears the queued split before sentence playback", async () => {
  const h = harness();
  try {
    h.app.sourceText.value = 'Newly loaded article.';
    const queuedSplits = [...h.timers.keys()];
    assert.equal(queuedSplits.length, 1);
    h.app.splitWords({ recordTextHistory: false });
    const id = h.app.sentences.value[0].id;
    const pending = h.app.readSentence(id);
    for (const timerId of queuedSplits) {
      const callback = h.timers.get(timerId);
      if (callback) { h.timers.delete(timerId); callback(); }
    }
    assert.equal(h.app.activeSentenceId.value, id);
    h.utterances.at(-1).onend();
    await pending;
  } finally { h.dispose(); }
});

test("word tap still shows meanings, records one encounter and respects word repeats", async () => {
  const h = harness();
  try {
    h.text('Hello world.');
    h.app.cacheTranslation('world', ['world'], '世界', 'local-dictionary');
    h.app.selectedRepeat.value = 2;
    h.app.markLearned.value = true;
    const sentence = h.app.readSentence(h.app.sentences.value[0].id);
    const word = h.app.segments.value.find(s => s.text === 'world');
    await h.app.studyWord(word, { clientX: 100, clientY: 100, currentTarget: null });
    await sentence;
    assert.equal(h.app.selectedSegmentId.value, word.id);
    assert.equal(h.app.wordPopover.value.meaning, '世界');
    assert.deepEqual(h.writes, ['world']);
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.utterances.filter(u => u.text === 'world').length, 2);
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});

test("unsupported speech disables sentences; browser watchdog terminates stalled playback", async () => {
  const h = harness();
  try {
    h.text('Hello.');
    const pending = h.app.readSentence(h.app.sentences.value[0].id);
    const watchdog = [...h.timers.values()].at(-2);
    watchdog(); await pending;
    assert.match(h.app.status.value, /没有响应/);
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
  const unsupported = harness();
  try {
    delete unsupported.window.speechSynthesis;
    unsupported.text('Changed text.');
    assert.equal(unsupported.app.sentenceSpeechDisabled.value, true);
  } finally { unsupported.dispose(); }
});

test("real course samples round-trip without changing text, word IDs or blank lines", () => {
  const h = harness();
  try {
    for (const file of ['public/nce/lessons/nce1/001.json', 'public/shuimu/lessons/upper/060.json']) {
      const { text } = JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));
      h.text(text);
      const rendered = h.app.readingRuns.value.flatMap(r => r.segments);
      assert.equal(rendered.map(s => s.text + (s.trailingText ?? '')).join(''), text.trim());
      assert.deepEqual(plain(rendered.filter(s => s.type === 'word').map(s => s.id)), plain(h.app.segments.value.filter(s => s.type === 'word').map(s => s.id)));
      assert.ok(h.app.sentences.value.every(s => text.trim().slice(s.start, s.end) === s.text));
    }
  } finally { h.dispose(); }
});

function gatewayHarness({ cache, fetch } = {}) {
  const audio = [], writes = [], revoked = [];
  class Audio {
    constructor(src) { this.src = src; audio.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
  }
  const h = harness();
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('src/shared/utils/gatewaySpeech.ts', root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, AbortController, DOMException, Error, Blob, Audio, TextEncoder,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) },
    fetch: fetch ?? (async () => ({ ok: true, blob: async () => new Blob(['audio']) })),
    require: id => {
      if (id === './assetUrls') return { appAssetUrl: s => s, appDownloadUrl: s => s };
      if (id === '../stores/historyStore') return {
        makeAudioCacheKey: async () => 'key',
        getCachedAudio: cache ?? (async () => ({ blob: new Blob(['audio']), size: 5 })),
        putCachedAudio: async (...args) => writes.push(args),
      };
      if (id === '../copy/siteCopy') return h.load('src/shared/copy/siteCopy.ts');
      if (id === './timeoutConstants') return h.load('src/shared/utils/timeoutConstants.ts');
      throw new Error(id);
    },
  });
  h.dispose();
  return { session: new exports.GatewaySpeechSession(), audio, writes, revoked };
}

test("Gateway cancellation settles active audio, detaches callbacks and releases its URL", async () => {
  const h = gatewayHarness();
  const pending = h.session.speak('Hello.');
  await tick();
  const audio = h.audio.at(-1);
  assert.equal(typeof audio.onended, 'function');
  h.session.cancel();
  await assert.rejects(pending, { name: 'GatewaySpeechCancelledError' });
  assert.equal(audio.onended, null);
  assert.equal(audio.onerror, null);
  assert.equal(audio.paused, true);
  assert.deepEqual(h.revoked, ['blob:test']);
});

test("Gateway cancel during cache lookup never starts a late synthesis request", async () => {
  const lookup = deferred(); let requests = 0;
  const h = gatewayHarness({ cache: () => lookup.promise, fetch: () => { requests++; } });
  const pending = h.session.speak('Hello.'); await tick();
  h.session.cancel(); lookup.resolve(undefined);
  await assert.rejects(pending, { name: 'GatewaySpeechCancelledError' });
  assert.equal(requests, 0);
});

test("Gateway cancel also aborts response-body reading and prevents late cache writes", async () => {
  const body = deferred(); let signal;
  const h = gatewayHarness({ cache: async () => undefined, fetch: async (_url, options) => {
    signal = options.signal;
    return { ok: true, blob: () => body.promise };
  } });
  const pending = h.session.speak('Hello.'); await tick();
  h.session.cancel();
  assert.equal(signal.aborted, true);
  body.resolve(new Blob(['late audio']));
  await assert.rejects(pending, { name: 'GatewaySpeechCancelledError' });
  assert.equal(h.writes.length, 0);
});
