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

test("Gateway versions compare numeric components and prereleases, rejecting malformed versions", () => {
  const h = harness();
  try {
    const { compareGatewayVersions: compare, gatewayVersion } = h.load('src/shared/utils/gatewayVersion.ts');
    for (const [a, b, result] of [
      ['0.2.1', '0.2.2', -1], ['0.2.2', '0.2.2', 0], ['0.2.10', '0.2.2', 1],
      ['1.0.0', '0.9.99', 1], ['0.2.2-beta.2', '0.2.2-beta.10', -1],
      ['0.2.2-rc.1', '0.2.2', -1], ['0.2.2+build.1', '0.2.2', 0],
    ]) assert.equal(compare(a, b), result);
    for (const value of [null, 2, '', 'unknown', '0.2', '0.02.2', '<script>', '0.2.2-rc.01', '99999999999999999.0.0']) {
      assert.equal(gatewayVersion(value), null);
    }
  } finally { h.dispose(); }
});

test("Gateway status probing retains versions, handles legacy bodies and clears timeout timers", async () => {
  const h = harness();
  try {
    const probe = h.load('src/shared/utils/gatewaySpeech.ts').readLocalGatewayStatus;
    const baseline = h.timers.size;
    for (const [response, expected] of [
      [{ ok: true, json: async () => ({ ok: true, version: '0.2.1' }) }, { running: true, version: '0.2.1' }],
      [{ ok: true, json: async () => ({ version: '0.2.2' }) }, { running: true, version: '0.2.2' }],
      [{ ok: true, json: async () => ({ version: 'invalid' }) }, { running: true, version: null }],
      [{ ok: true, json: async () => { throw new Error('legacy'); } }, { running: true, version: null }],
      [{ ok: false }, { running: false, version: null }],
      [{ ok: true, json: async () => ({ ok: false, version: '0.2.1' }) }, { running: false, version: null }],
    ]) {
      h.window.fetch = async () => response;
      assert.deepEqual(plain(await probe()), expected);
      assert.equal(h.timers.size, baseline);
    }
    h.window.fetch = (_url, { signal }) => new Promise((_yes, no) => signal.addEventListener('abort', () => no(new DOMException('timeout', 'AbortError'))));
    const pending = probe(123);
    [...h.timers.values()].at(-1)();
    assert.deepEqual(plain(await pending), { running: false, version: null });
    assert.equal(h.timers.size, baseline);
  } finally { h.dispose(); }
});

test("old Gateway prompts persist until installation is detected; current/newer and offline services do not prompt", async () => {
  const h = harness();
  try {
    for (const [version, running, update] of [['0.2.1', true, true], ['0.2.2', true, false], ['0.2.10', true, false], [undefined, true, true], ['bad', true, true], ['0.2.1', false, false]]) {
      h.window.fetch = async () => ({ ok: running, json: async () => ({ ok: running, version }) });
      await h.app.refreshGatewayStatus('auto');
      assert.equal(h.app.gatewayUpdateAvailable.value, update);
      assert.equal(h.app.isGatewayRunning.value, running);
    }
    h.window.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.1' }) });
    const diagnostic = await h.app.checkGatewayStatus();
    assert.equal(diagnostic.status, 'warn');
    assert.match(diagnostic.detail, /0\.2\.1.*0\.2\.2/);
    h.window.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.2' }) });
    await h.app.refreshGatewayStatus('auto');
    assert.equal(h.app.gatewayUpdateAvailable.value, false);
  } finally { h.dispose(); }
});

test("release checks use the bundled baseline offline and ignore stale or invalid manifests", async () => {
  const h = harness();
  try {
    for (const version of ['0.2.1', 'garbage', undefined]) {
      h.window.fetch = async () => ({ ok: true, json: async () => ({ version }) });
      await h.app.refreshGatewayReleaseVersion();
      assert.equal(h.app.latestGatewayVersion.value, '0.2.2');
    }
    h.window.fetch = async () => { throw new Error('offline'); };
    await h.app.refreshGatewayReleaseVersion();
    assert.equal(h.app.latestGatewayVersion.value, '0.2.2');
    h.window.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.10' }) });
    await h.app.refreshGatewayReleaseVersion();
    assert.equal(h.app.latestGatewayVersion.value, '0.2.10');
    h.window.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.2' }) });
    await h.app.refreshGatewayReleaseVersion();
    assert.equal(h.app.latestGatewayVersion.value, '0.2.10');
  } finally { h.dispose(); }
});

test("version heartbeats during consecutive sentences preserve playback feedback and the update notice", async () => {
  const h = harness();
  try {
    h.text('First sentence here. Second sentence here.');
    await h.app.readFullText();
    h.utterances[0].onstart();
    const feedback = h.app.status.value;
    h.window.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.1' }) });
    await h.app.refreshGatewayStatus('auto');
    assert.equal(h.app.gatewayUpdateAvailable.value, true);
    h.utterances[0].onend(); await tick();
    h.utterances[1].onstart();
    await h.app.refreshGatewayStatus('auto');
    assert.equal(h.app.status.value, feedback);
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    assert.equal(h.app.gatewayUpdateAvailable.value, true);
    h.app.cancelSpeech();
    assert.equal(h.app.gatewayUpdateAvailable.value, true);
  } finally { h.dispose(); }
});

function harness() {
  const timers = new Map();
  const timerDelays = new Map();
  let timerId = 0;
  const utterances = [];
  const gateways = [];
  const wordAudio = [];
  const writes = [];
  const unmount = [];
  const storage = new Map();
  const speech = {
    paused: false, cancels: 0, resumes: 0,
    pause() { this.paused = true; },
    resume() { this.paused = false; this.resumes++; },
    cancel() { this.cancels++; },
    speak(utterance) { if (utterance.text) utterances.push(utterance); },
    getVoices: () => [],
  };
  class Utterance { constructor(text) { this.text = text; } }
  class WordAudio {
    constructor(src) { this.src = src; wordAudio.push(this); }
    play() { return Promise.resolve(); }
    pause() {}
    removeAttribute() {}
    load() {}
  }
  class FakeGateway {
    cancelled = false;
    constructor() { this.pending = deferred(); gateways.push(this); }
    speak(text, options) { this.text = text; this.options = options; this.pending = deferred(); return this.pending.promise; }
    cancel() { this.cancelled = true; }
  }
  const setTimer = (fn, delay) => { timers.set(++timerId, fn); timerDelays.set(timerId, delay); return timerId; };
  const clearTimer = (id) => { timers.delete(id); timerDelays.delete(id); };
  const window = {
    speechSynthesis: speech, SpeechSynthesisUtterance: Utterance,
    Audio: WordAudio, URL, fetch: () => {}, innerWidth: 1280, innerHeight: 900,
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
      if (id.endsWith("/assetUrls")) return mocks["../utils/assetUrls"];
      if (id.endsWith("gatewaySpeech")) return {
        GatewaySpeechSession: FakeGateway,
        readLocalGatewayStatus: (...args) => load("src/shared/utils/gatewaySpeech.ts").readLocalGatewayStatus(...args),
        isGatewaySpeechCancelError: error => error?.name === "AbortError",
      };
      if (id.includes("/data/")) return {};
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
      return load(/\.(js|json|ts)$/.test(target) ? target : `${target}.ts`);
    };
    vm.runInNewContext(output, {
      exports, require, window, console, URL, AbortController, DOMException, Error,
      __WORDTAP_GATEWAY_VERSION__: JSON.parse(fs.readFileSync(new URL("public/downloads/wordtap-gateway-release.json", root), "utf8")).version,
      fetch: (...args) => window.fetch(...args),
      SpeechSynthesisUtterance: Utterance, Audio: WordAudio, HTMLElement: class {},
      setTimeout: setTimer, clearTimeout: clearTimer, setInterval: setTimer, clearInterval: clearTimer,
      navigator: { userAgent: "test" },
    }, { filename: file });
    return exports;
  }
  const scope = vue.effectScope();
  const app = scope.run(() => load("src/shared/composables/useWordTap.ts").useWordTap());
  return {
    app, load, timers, utterances, gateways, wordAudio, writes, speech, history, window,
    bufferTimer() { return [...timers].find(([id]) => timerDelays.get(id) === 600); },
    fireBufferTimer() {
      const [id, fn] = this.bufferTimer() ?? [];
      assert.ok(fn, 'expected a delayed buffering notice');
      clearTimer(id); fn();
    },
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

test("mixed-language sentence stays intact on screen but English browser speech is filtered", async () => {
  const h = harness();
  try {
    h.text('Hello，中文也保留在句子里面 world。下一句。');
    const first = h.app.sentences.value[0];
    assert.equal(first.text, 'Hello，中文也保留在句子里面 world。');
    const pending = h.app.readSentence(first.id);
    assert.equal(h.utterances.at(-1).text, 'Hello, world.');
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

test("phonetic display keeps original word and sentence speech without recording display changes", async () => {
  const h = harness();
  try {
    h.text('Hello world.');
    const original = plain(h.app.segments.value);
    h.app.readingDisplayMode.value = 'phonetic'; await tick();
    assert.deepEqual(h.writes, []);
    assert.deepEqual(plain(h.app.segments.value), original);
    h.app.cacheTranslation('world', ['world'], '世界', 'local-dictionary');
    await h.app.studyWord(h.app.segments.value.find(s => s.text === 'world'), { clientX: 100, clientY: 100, currentTarget: null });
    assert.deepEqual(h.writes, ['world']);
    assert.equal(h.utterances.at(-1).text, 'world');
    h.app.cancelSpeech();
    const pending = h.app.readSentence(h.app.sentences.value[0].id);
    assert.equal(h.utterances.at(-1).text, 'Hello world.');
    h.utterances.at(-1).onend(); await pending;
    h.app.readingDisplayMode.value = 'annotated'; await tick();
    assert.deepEqual(h.writes, ['world']);
    assert.equal(h.app.sourceText.value, 'Hello world.');
    await h.app.readFullText();
    assert.equal(h.utterances.at(-1).text, 'Hello world.');
    h.app.cancelSpeech();
  } finally { h.dispose(); }
});

test("dictionary shard failures can be retried and successful requests are shared", async () => {
  const h = harness();
  try {
    let calls = 0;
    h.window.fetch = async () => { calls++; return { ok: calls > 1, status: 503, json: async () => ({ hello: { word: 'hello', phonetic: 'hello' } }) }; };
    assert.equal(await h.app.loadShard('he'), null);
    const [a, b] = await Promise.all([h.app.loadShard('he'), h.app.loadShard('he')]);
    assert.equal(a.hello.phonetic, 'hello'); assert.equal(a, b); assert.equal(calls, 2);
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

function gatewayHarness({ cache, fetch, play } = {}) {
  const audio = [], writes = [], revoked = [], keys = [];
  class Audio {
    constructor(src) { this.src = src; audio.push(this); }
    play() { this.plays = (this.plays ?? 0) + 1; this.paused = false; return this.src === "blob:test" && play ? play() : Promise.resolve(); }
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
        makeAudioCacheKey: async parts => { keys.push(plain(parts)); return JSON.stringify(parts); },
        getCachedAudio: cache ?? (async () => ({ blob: new Blob(['audio']), size: 5 })),
        putCachedAudio: async (...args) => writes.push(args),
      };
      if (id === '../copy/siteCopy') return h.load('src/shared/copy/siteCopy.ts');
      if (id === './timeoutConstants') return h.load('src/shared/utils/timeoutConstants.ts');
      if (id === './gatewayVersion') return h.load('src/shared/utils/gatewayVersion.ts');
      if (id === './speechText') return h.load('src/shared/utils/speechText.ts');
      throw new Error(id);
    },
  });
  h.dispose();
  return { session: new exports.GatewaySpeechSession(), audio, writes, revoked, keys, control: new (h.load("src/shared/utils/speechPlaybackControl.ts").SpeechPlaybackControl)() };
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


test("full text pauses the same utterance, suspends watchdog and does not auto-resume", async () => {
  const h = harness();
  try {
    h.text('First sentence here. Second sentence here.');
    await h.app.readFullText();
    const current = h.utterances.at(-1);
    current.onstart();
    const before = h.timers.size;
    await h.app.readFullText();
    assert.equal(h.app.fullTextSpeechLabel.value, '继续');
    assert.equal(h.app.isSpeaking.value, true);
    assert.equal(h.speech.paused, true);
    assert.equal(h.timers.size, before - 1);
    const resumes = h.speech.resumes;
    [...h.timers.values()].at(-1)(); // 14-second recovery interval
    assert.equal(h.speech.resumes, resumes);
    await h.app.readFullText();
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.speech.paused, false);
    assert.equal(h.utterances.at(-1), current);
    assert.equal(h.timers.size, before);
    current.onend(); await tick();
    assert.equal(h.utterances.at(-1).text, 'Second sentence here.');
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.app.fullTextSpeechLabel.value, '全文朗读');
    assert.equal(h.app.isFullTextPaused.value, false);
  } finally { h.dispose(); }
});

test("pause during history save persists until resume; stop clears paused playback", async () => {
  const h = harness();
  try {
    h.text('Hello world.');
    const save = deferred(); h.history.recordStudyText = () => save.promise;
    const reading = h.app.readFullText();
    await h.app.readFullText();
    save.resolve({ id: 'test', text: 'Hello world.' }); await reading;
    assert.equal(h.utterances.length, 0);
    assert.equal(h.app.isFullTextPaused.value, true);
    await h.app.readFullText();
    assert.equal(h.utterances.length, 1);
    await h.app.readFullText();
    h.app.cancelSpeech(); await tick();
    assert.equal(h.app.fullTextSpeechLabel.value, '全文朗读');
    assert.equal(h.utterances[0].onend, null);
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});

test("pausing at a sentence or repeat boundary holds the next utterance", async () => {
  const h = harness();
  try {
    h.text('Hello world.'); h.app.selectedRepeat.value = 2;
    await h.app.readFullText();
    h.utterances[0].onend();
    await h.app.readFullText(); await tick();
    assert.equal(h.utterances.length, 1);
    assert.equal(h.app.isFullTextPaused.value, true);
    await h.app.readFullText();
    assert.equal(h.utterances.length, 2);
    await h.app.readFullText();
    h.app.sourceText.value = 'A different article.';
    await tick();
    assert.equal(h.app.isFullTextPaused.value, false);
    assert.equal(h.app.isFullTextSpeaking.value, false);
    assert.equal(h.utterances[1].onend, null);
  } finally { h.dispose(); }
});

test("Gateway failure while paused keeps browser fallback silent until resume", async () => {
  const h = harness();
  try {
    h.text('Hello world.'); h.app.isGatewayRunning.value = true;
    await h.app.readFullText(); await h.app.readFullText();
    const gateway = h.gateways.at(-1);
    gateway.options.onProgress({ phase: 'playing' });
    assert.match(h.app.status.value, /已暂停/);
    gateway.pending.reject(new Error('network failed')); await tick();
    assert.equal(h.app.isFullTextPaused.value, true);
    assert.equal(h.utterances.length, 0);
    await h.app.readFullText();
    assert.equal(h.utterances.at(-1).text, 'Hello world.');
    await h.app.readFullText();
    h.app.isGatewayRunning.value = false;
    const sentence = h.app.readSentence(h.app.sentences.value[0].id);
    assert.equal(h.app.isFullTextPaused.value, false);
    h.utterances.at(-1).onend(); await sentence;
  } finally { h.dispose(); }
});

test("Gateway audio resumes at its current time and holds the next chunk while paused", async () => {
  const h = gatewayHarness();
  const text = ('A long sentence with words. ').repeat(80);
  const pending = h.session.speak(text, { playbackControl: h.control });
  await tick();
  const first = h.audio.at(-1); first.currentTime = 3.5;
  const plays = first.plays;
  h.control.setPaused(true);
  assert.equal(first.paused, true);
  assert.equal(first.src, 'blob:test');
  h.control.setPaused(false);
  assert.equal(first.currentTime, 3.5);
  assert.equal(first.plays, plays + 1);
  first.onended(); h.control.setPaused(true); await tick();
  const next = h.audio.at(-1);
  assert.notEqual(next, first);
  assert.equal(next.plays ?? 0, 0);
  h.control.setPaused(false);
  assert.equal(next.plays, 1);
  h.control.setPaused(true); h.session.cancel();
  await assert.rejects(pending, { name: 'GatewaySpeechCancelledError' });
  h.control.setPaused(false);
  assert.equal(next.plays, 1);
  assert.equal(next.onended, null);
});

test("Gateway audio prepared during pause waits and can be stopped before first sound", async () => {
  const h = gatewayHarness(); h.control.setPaused(true);
  const pending = h.session.speak('Hello.', { playbackControl: h.control });
  await tick();
  const audio = h.audio.at(-1);
  // Only the muted activation sound has been played.
  assert.equal(audio.plays, 1);
  assert.equal(audio.paused, true);
  h.session.cancel();
  await assert.rejects(pending, { name: 'GatewaySpeechCancelledError' });
  h.control.setPaused(false);
  assert.equal(audio.plays, 1);
});


test("rapid Gateway pause/resume ignores the obsolete interrupted play promise", async () => {
  const attempts = [];
  const h = gatewayHarness({ play: () => { const d = deferred(); attempts.push(d); return d.promise; } });
  const pending = h.session.speak('Hello.', { playbackControl: h.control }); await tick();
  h.control.setPaused(true); h.control.setPaused(false);
  attempts[0].reject(new DOMException('Interrupted by pause', 'AbortError')); await tick();
  assert.equal(typeof h.audio.at(-1).onended, 'function');
  attempts[1].resolve(); h.audio.at(-1).onended(); await pending;
  assert.equal(h.revoked.length, 1);
});


test("full-text guidance covers saving and browser queue until actual speech starts", async () => {
  const h = harness();
  try {
    h.text('Hello world. Another sentence.');
    const save = deferred(); h.history.recordStudyText = () => save.promise;
    const pending = h.app.readFullText();
    assert.equal(h.app.fullTextSpeechLabel.value, '准备中…');
    assert.match(h.app.fullTextSpeechNotice.value, /无需重复点击/);
    save.resolve({ id: 'test', text: h.app.sourceText.value }); await pending;
    assert.equal(h.app.fullTextSpeechWaiting.value, true);
    h.utterances.at(-1).onstart();
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    await h.app.readFullText();
    assert.equal(h.app.fullTextSpeechWaiting.value, false);
    assert.equal(h.app.fullTextSpeechLabel.value, '继续');
    h.app.cancelSpeech();
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    assert.equal(h.app.isFullTextPreparing.value, false);
  } finally { h.dispose(); }
});

test("Gateway prefetch cannot replace playing with loading; stale events cannot restore guidance", async () => {
  const h = harness();
  try {
    h.text('Hello world.'); h.app.isGatewayRunning.value = true;
    await h.app.readFullText();
    const gateway = h.gateways.at(-1);
    assert.equal(h.app.fullTextSpeechLabel.value, '准备中…');
    gateway.options.onProgress({phase: 'playing', chunkIndex: 0});
    const playing = h.app.status.value;
    for (const phase of ['connecting', 'receiving', 'cache-hit']) {
      gateway.options.onProgress({phase, chunkIndex: 1});
      assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
      assert.equal(h.app.status.value, playing);
    }
    gateway.options.onProgress({phase: 'buffering', chunkIndex: 1});
    assert.equal(h.app.fullTextSpeechWaiting.value, false);
    assert.equal(h.app.status.value, playing);
    h.app.cancelSpeech();
    gateway.options.onProgress({phase: 'buffering', chunkIndex: 1});
    assert.equal(h.app.fullTextSpeechNotice.value, '');
  } finally { h.dispose(); }
});

test("Gateway reports playing only from audio events and clears all event handlers", async () => {
  const progress = [];
  const h = gatewayHarness();
  const pending = h.session.speak('Hello.', {onProgress: p => progress.push(p.phase)});
  await tick();
  assert.ok(progress.includes('buffering'));
  assert.equal(progress.includes('playing'), false);
  const audio = h.audio.at(-1);
  audio.onplaying(); assert.equal(progress.at(-1), 'playing');
  audio.onwaiting(); assert.equal(progress.at(-1), 'buffering');
  audio.onplaying(); assert.equal(progress.at(-1), 'playing');
  audio.onended(); await pending;
  assert.equal(audio.onplaying, null);
  assert.equal(audio.onwaiting, null);
});

test("browser sentences and repeats keep playback UI stable and debounce the next sound", async () => {
  const h = harness();
  try {
    h.text('First sentence here. Second sentence here.'); h.app.selectedRepeat.value = 2;
    await h.app.readFullText();
    for (let index = 0; index < 4; index++) {
      const current = h.utterances[index];
      assert.ok(current);
      current.onstart();
      const playing = h.app.status.value;
      assert.equal(h.bufferTimer(), undefined);
      current.onend(); await tick();
      if (index === 3) break;
      assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
      assert.equal(h.app.fullTextSpeechNotice.value, '');
      assert.equal(h.app.status.value, playing);
      assert.ok(h.bufferTimer());
      if (index === 1) {
        h.fireBufferTimer();
        assert.match(h.app.status.value, /等待后续/);
        assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
        assert.equal(h.app.fullTextSpeechNotice.value, '');
      }
    }
    assert.equal(h.app.fullTextSpeechLabel.value, '全文朗读');
    assert.equal(h.bufferTimer(), undefined);
  } finally { h.dispose(); }
});

test("Gateway chunk buffering and repeats never restore preparation or accept old repeat events", async () => {
  const h = harness();
  try {
    h.text('Hello world.'); h.app.selectedRepeat.value = 2; h.app.isGatewayRunning.value = true;
    await h.app.readFullText();
    const gateway = h.gateways.at(-1);
    const progress = gateway.options.onProgress;
    progress({ phase: 'playing', chunkIndex: 0 });
    const playing = h.app.status.value;
    progress({ phase: 'buffering', chunkIndex: 1 });
    assert.equal(h.app.status.value, playing);
    progress({ phase: 'playing', chunkIndex: 1 });
    assert.equal(h.bufferTimer(), undefined);
    progress({ phase: 'buffering', chunkIndex: 2 });
    h.fireBufferTimer();
    const waiting = h.app.status.value;
    assert.match(waiting, /等待后续/);
    for (const phase of ['cache-hit', 'connecting', 'receiving']) progress({ phase, chunkIndex: 3 });
    assert.equal(h.app.status.value, waiting);
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    progress({ phase: 'playing', chunkIndex: 2 });
    assert.equal(h.app.status.value, playing);
    gateway.pending.resolve(); await tick();
    const repeatProgress = gateway.options.onProgress;
    assert.notEqual(repeatProgress, progress);
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    progress({ phase: 'playing', chunkIndex: 0 });
    assert.ok(h.bufferTimer(), 'old repeat must not cancel the new repeat buffer');
    repeatProgress({ phase: 'playing', chunkIndex: 0 });
    gateway.pending.resolve(); await tick();
    const done = h.app.status.value;
    repeatProgress({ phase: 'buffering', chunkIndex: 1 });
    assert.equal(h.app.status.value, done);
    assert.equal(h.bufferTimer(), undefined);
    assert.equal(h.app.fullTextSpeechLabel.value, '全文朗读');
  } finally { h.dispose(); }
});

test("pausing a buffered browser sentence cancels feedback until resume and actual sound", async () => {
  const h = harness();
  try {
    h.text('First sentence here. Second sentence here.');
    await h.app.readFullText();
    h.utterances[0].onstart(); h.utterances[0].onend(); await tick();
    await h.app.readFullText();
    assert.equal(h.bufferTimer(), undefined);
    assert.match(h.app.fullTextSpeechNotice.value, /已暂停/);
    await h.app.readFullText();
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    h.fireBufferTimer();
    assert.match(h.app.status.value, /等待后续/);
    h.utterances[1].onstart();
    assert.doesNotMatch(h.app.status.value, /等待后续/);
    h.utterances[1].onend(); await tick();
    assert.equal(h.bufferTimer(), undefined);
  } finally { h.dispose(); }
});

test("stop, edit, completion and failure discard buffered feedback and stale Gateway events", async () => {
  for (const action of ['stop', 'edit', 'complete', 'fail']) {
    const h = harness();
    try {
      h.text('Hello world.'); h.app.isGatewayRunning.value = true;
      await h.app.readFullText();
      const gateway = h.gateways.at(-1);
      const progress = gateway.options.onProgress;
      progress({ phase: 'playing' }); progress({ phase: 'buffering' });
      const [, lateTimer] = h.bufferTimer();
      if (action === 'stop') h.app.cancelSpeech('Stopped');
      if (action === 'edit') { h.app.sourceText.value = 'A different article.'; await tick(); }
      if (action === 'complete') { gateway.pending.resolve(); await tick(); }
      if (action === 'fail') {
        delete h.window.speechSynthesis;
        gateway.pending.reject(new Error('network failed')); await tick();
      }
      const status = h.app.status.value;
      assert.equal(h.bufferTimer(), undefined, action);
      lateTimer(); progress({ phase: 'buffering' }); progress({ phase: 'playing' });
      assert.equal(h.app.status.value, status, action);
      assert.equal(h.app.isFullTextSpeaking.value, false, action);
      assert.equal(h.app.fullTextSpeechNotice.value, '', action);
      await h.app.readFullText();
      const nextProgress = h.gateways.at(-1).options.onProgress;
      nextProgress({ phase: 'playing' }); nextProgress({ phase: 'buffering' });
      const currentTimer = h.bufferTimer();
      lateTimer(); progress({ phase: 'playing' });
      assert.deepEqual(h.bufferTimer(), currentTimer, action);
      h.fireBufferTimer();
      assert.match(h.app.status.value, /等待后续/);
      nextProgress({ phase: 'playing' });
      assert.equal(h.bufferTimer(), undefined, action);
    } finally { h.dispose(); }
  }
});

test("Gateway fallback after first sound keeps the browser UI out of preparation", async () => {
  const h = harness();
  try {
    h.text('Hello world. Another sentence.'); h.app.isGatewayRunning.value = true;
    await h.app.readFullText();
    const gateway = h.gateways.at(-1);
    gateway.options.onProgress({ phase: 'playing' });
    gateway.options.onProgress({ phase: 'buffering' });
    gateway.pending.reject(new Error('network failed')); await tick();
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    assert.equal(h.app.fullTextSpeechNotice.value, '');
    const waiting = h.app.status.value;
    gateway.options.onProgress({ phase: 'playing' });
    assert.equal(h.app.status.value, waiting);
    h.fireBufferTimer();
    assert.match(h.app.status.value, /等待后续/);
    h.utterances[0].onstart();
    assert.doesNotMatch(h.app.status.value, /等待后续/);
    h.app.cancelSpeech();
    assert.equal(h.bufferTimer(), undefined);
  } finally { h.dispose(); }
});

test("English preparation preserves readable tokens, punctuation and word boundaries", () => {
  const h = harness();
  try {
    const { prepareSpeechText, gatewaySpeechTextMode } = h.load('src/shared/utils/speechText.ts');
    const examples = [
      ['Hello中文world。', 'Hello world.'],
      ['简体繁體𠮷𠀀日本語かなカナ한국어РусскийالعربيةΕλληνικά Hello!', 'Hello!'],
      ['café nai\u0308ve co-operate don’t stop. Mr. Smith paid $3.14 at 10:30.', 'café nai\u0308ve co-operate don’t stop. Mr. Smith paid $3.14 at 10:30.'],
      ['ＡＢＣ１２３，中文。', 'ABC123.'],
      ['Hello（中文）[注释] {翻译} “说明” world。', 'Hello world.'],
      ['Hello😀world\u200Bnext\u0000word. 🇨🇳', 'Hello world next word.'],
      ['Hello👍🏽world\u034Fnext a\u093Eword.', 'Hello world next a word.'],
      ['中文说明。\n\nHello world. 中文翻译。 Next sentence!', 'Hello world. Next sentence!'],
      ['Version 2.0: https://example.com/a?x=1&y=2; user@example.com', 'Version 2.0: https://example.com/a?x=1&y=2; user@example.com'],
      ['中文（繁體）。😀\n日本語 한국어', ''],
      ['？！ … () [] “ ”', ''],
      ['2026，3.14，50%。', '2026,3.14,50%.'],
    ];
    for (const [input, expected] of examples) {
      assert.equal(prepareSpeechText(input), expected, input);
      assert.equal(prepareSpeechText(expected), expected, `idempotent: ${input}`);
    }
    assert.equal(prepareSpeechText('Hello，中文也读。', 'multilingual'), 'Hello，中文也读。');
    assert.equal(prepareSpeechText('你好😀\u200B world', 'multilingual'), '你好   world');
    assert.equal(prepareSpeechText('Hello👍🏽world', 'multilingual'), 'Hello  world');
    assert.equal(gatewaySpeechTextMode('unknown-Emma-Multilingual'), 'english');
    assert.equal(gatewaySpeechTextMode('en-US-EmmaNeural'), 'english');
    assert.equal(gatewaySpeechTextMode(), 'multilingual');
  } finally { h.dispose(); }
});

const configuredVoices = harness();
const voiceCases = plain(configuredVoices.app.gatewayVoiceOptions);
configuredVoices.dispose();
for (const voice of voiceCases) {
  test(`sentence and repeated full text follow the exact capability of ${voice.value}`, async () => {
    const h = harness();
    try {
      const original = 'Hello中文world。';
      const expected = voice.textMode === 'multilingual' ? original : 'Hello world.';
      h.text(original); h.app.isGatewayRunning.value = true; h.app.selectedGatewayVoice.value = voice.value;
      const pending = h.app.readSentence(h.app.sentences.value[0].id);
      assert.equal(h.gateways.at(-1).text, expected);
      h.gateways.at(-1).pending.resolve(); await pending;
      h.app.selectedRepeat.value = 2;
      await h.app.readFullText();
      const gateway = h.gateways.at(-1);
      assert.equal(gateway.text, expected);
      gateway.options.onProgress({ phase: 'playing' }); gateway.pending.resolve(); await tick();
      assert.equal(gateway.text, expected);
      assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
      assert.equal(h.app.fullTextSpeechNotice.value, '');
      gateway.pending.resolve(); await tick();
      assert.equal(h.app.isSpeaking.value, false);
      assert.equal(h.app.sourceText.value, original);
      assert.equal(h.app.sentences.value[0].text, original);
      assert.equal(h.writes.length, 0);
    } finally { h.dispose(); }
  });
}

test("filtered-empty word, sentence, typing and full text never enter playback or preparation", async () => {
  for (const gateway of [false, true]) {
    const h = harness();
    try {
      h.text('只有中文。'); h.app.isGatewayRunning.value = gateway; h.app.selectedGatewayVoice.value = 'en-US-JennyNeural';
      await h.app.readSentence(h.app.sentences.value[0].id);
      await h.app.speakArticleTypingSentence('只有中文。');
      h.app.speakArticleTypingWord('中文😀');
      h.app.speakWord('中文', '中文');
      await h.app.readFullText();
      assert.equal(h.gateways.length, 0);
      assert.equal(h.utterances.length, 0);
      assert.equal(h.wordAudio.length, 0);
      assert.equal(h.app.isSpeaking.value, false);
      assert.equal(h.app.isFullTextPreparing.value, false);
      assert.equal(h.app.fullTextSpeechNotice.value, '');
      assert.equal(h.bufferTimer(), undefined);
      assert.equal(h.app.status.value, '当前声音没有可朗读的英文内容，可选择 Emma 多语言。');
      assert.equal(h.app.sourceText.value, '只有中文。');
    } finally { h.dispose(); }
  }
});

test("browser full text skips Chinese paragraphs and keeps English sentences on every repeat", async () => {
  const h = harness();
  try {
    h.text('中文前言。\nFirst English sentence.\n中文翻译。\nSecond English sentence.\n中文结尾。');
    h.app.selectedRepeat.value = 2;
    await h.app.readFullText();
    for (let i = 0; i < 4; i++) {
      const utterance = h.utterances[i];
      assert.ok(utterance);
      assert.doesNotMatch(utterance.text, /\p{Script=Han}/u);
      utterance.onstart();
      assert.equal(h.app.fullTextSpeechNotice.value, '');
      utterance.onend(); await tick();
    }
    assert.deepEqual(h.utterances.map(u => u.text), ['First English sentence.', 'Second English sentence.', 'First English sentence.', 'Second English sentence.']);
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});

test("multilingual sentence and full-text fallback re-filter the original for English browsers", async () => {
  for (const fullText of [false, true]) {
    const h = harness();
    try {
      h.text('Hello中文world。'); h.app.isGatewayRunning.value = true;
      const pending = fullText ? h.app.readFullText() : h.app.readSentence(h.app.sentences.value[0].id);
      if (fullText) await pending;
      const gateway = h.gateways.at(-1);
      assert.equal(gateway.text, 'Hello中文world。');
      gateway.options.onProgress({ phase: 'playing' });
      gateway.pending.reject(new Error('offline')); await tick();
      assert.equal(h.utterances.at(-1).text, 'Hello world.');
      if (fullText) assert.equal(h.app.fullTextSpeechNotice.value, '');
      h.utterances.at(-1).onend(); await pending; await tick();
      assert.equal(h.app.isSpeaking.value, false);
    } finally { h.dispose(); }
  }
});

test("Chinese-only multilingual fallback clears preparation without submitting empty English speech", async () => {
  for (const fullText of [false, true]) {
    const h = harness();
    try {
      h.text('只有中文。'); h.app.isGatewayRunning.value = true;
      const pending = fullText ? h.app.readFullText() : h.app.readSentence(h.app.sentences.value[0].id);
      if (fullText) await pending;
      const gateway = h.gateways.at(-1);
      const oldProgress = gateway.options.onProgress;
      gateway.pending.reject(new Error('offline')); await pending; await tick();
      oldProgress({ phase: 'playing' });
      assert.equal(h.utterances.length, 0);
      assert.equal(h.app.isSpeaking.value, false);
      assert.equal(h.app.fullTextSpeechNotice.value, '');
      assert.equal(h.bufferTimer(), undefined);
      assert.match(h.app.status.value, /没有可朗读的英文/);
    } finally { h.dispose(); }
  }
});

test("typing sentence, word and Youdao fallback all use filtered English copies", async () => {
  const h = harness();
  try {
    const pending = h.app.speakArticleTypingSentence('Hello（中文）world。');
    assert.equal(h.utterances.at(-1).text, 'Hello world.');
    h.utterances.at(-1).onend(); await pending;
    h.app.speakWord('café中文word', 'original');
    assert.equal(h.utterances.at(-1).text, 'café word');
    h.utterances.at(-1).onerror({ error: 'not-allowed' }); await tick();
    const audio = h.wordAudio.at(-1);
    assert.equal(new URL(audio.src).searchParams.get('audio'), 'café word');
    audio.onended(); await tick();
    assert.equal(h.app.isSpeaking.value, false);
    assert.equal(h.writes.length, 0);
  } finally { h.dispose(); }
});

test("Gateway filtering precedes chunks, cache keys and requests and cache hits reuse the same copy", async () => {
  const requests = [], stored = new Map();
  const h = gatewayHarness({
    cache: async key => stored.get(key),
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, blob: async () => new Blob(['real-test-audio']) };
    },
  });
  const text = ('Hello中文world. ' + '中文翻译'.repeat(50) + '\n').repeat(100);
  const pending = h.session.speak(text, { voice: 'en-US-JennyNeural' });
  let ended = 0;
  for (let i = 0; i < 10; i++) {
    await tick();
    const audio = h.audio.at(-1);
    if (audio?.onended) { ended++; audio.onended(); }
  }
  await pending;
  assert.ok(requests.length > 1);
  assert.equal(requests.length, ended);
  assert.equal(requests.map(r => r.text).join(' '), Array(100).fill('Hello world.').join(' '));
  assert.ok(h.keys.every(parts => !/\p{Script=Han}/u.test(parts[0]) && new TextEncoder().encode(parts[0]).length <= 1000));
  for (const [key, blob] of h.writes) stored.set(key, { blob, size: blob.size });
  const before = requests.length;
  const cached = h.session.speak(text, { voice: 'en-US-JennyNeural' });
  for (let i = 0; i < 10; i++) { await tick(); h.audio.at(-1)?.onended?.(); }
  await cached;
  assert.equal(requests.length, before);
});

test("Gateway and browser low-level guards reject filtered-empty input before any audio or timer", async () => {
  const gateway = gatewayHarness({ fetch: () => assert.fail('must not fetch') });
  await assert.rejects(gateway.session.speak('中文😀。', { voice: 'en-US-JennyNeural' }), { name: 'NoSpeechTextError' });
  assert.equal(gateway.audio.length, 0);
  assert.equal(gateway.keys.length, 0);
  const h = harness();
  try {
    const baseline = h.timers.size;
    await assert.rejects(h.load('src/shared/utils/browserSpeech.ts').playBrowserSpeech('中文。', {
      signal: new AbortController().signal, voice: null, rate: 1,
    }), { name: 'NoSpeechTextError' });
    assert.equal(h.utterances.length, 0);
    assert.equal(h.timers.size, baseline);
  } finally { h.dispose(); }
});

test("immediate full-text playback flushes the pending edit split before starting speech", async () => {
  const h = harness();
  try {
    h.app.sourceText.value = 'Hello中文world. Another English sentence.';
    assert.ok(h.timers.size > 0);
    await h.app.readFullText();
    assert.equal(h.app.readingRuns.value.flatMap(run => run.segments).map(s => s.text + (s.trailingText ?? '')).join(''), h.app.sourceText.value);
    assert.equal(h.utterances.at(-1).text, 'Hello world.');
    h.utterances.at(-1).onstart();
    assert.equal(h.app.fullTextSpeechLabel.value, '暂停');
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.utterances.at(-1).text, 'Another English sentence.');
    h.utterances.at(-1).onend(); await tick();
    assert.equal(h.app.isSpeaking.value, false);
  } finally { h.dispose(); }
});
