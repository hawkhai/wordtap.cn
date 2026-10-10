import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import { parse, compileScript } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';

const root = new URL('../', import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness({ stored = null, blocked = false } = {}) {
  const cache = new Map(), unmount = [], storage = new Map([['wordtap.readingDisplayMode', stored]]);
  const window = { localStorage: {
    getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key); },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); },
  } };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(new URL(file, root), 'utf8');
    if (file.endsWith('.vue')) source = compileScript(parse(source).descriptor, { id: file, inlineTemplate: true }).content;
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(output, { exports, window, console, require: id => {
      if (id === 'vue') return { ...vue, onBeforeUnmount: fn => unmount.push(fn) };
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
      return load(/\.(ts|vue)$/.test(target) ? target : target + '.ts');
    } }, { filename: file });
    return exports;
  }
  const scope = vue.effectScope();
  const words = load('src/shared/utils/readingWords.ts');
  const options = { sourceText: vue.ref(''), snapshot: vue.ref(''), segments: vue.ref([]), enabled: vue.ref(true),
    prepare: async () => true, lookup: async () => ({ status: 'ready', text: 'test' }) };
  const app = scope.run(() => load('src/shared/composables/useReadingPhonetics.ts').useReadingPhonetics(options));
  return { app, options, load, storage,
    text(value) { options.sourceText.value = value; options.snapshot.value = value.trim(); options.segments.value = words.segmentReadingLine(value.trim(), 'test'); },
    dispose() { unmount.forEach(fn => fn()); scope.stop(); } };
}

test('lookup preserves contractions and inflections; normalization only changes unambiguous notation', async () => {
  const h = harness();
  try {
    const { normalizePhonetic, phoneticWordKey, lookupWordPhonetic } = h.load('src/shared/utils/readingPhonetics.ts');
    assert.equal(normalizePhonetic(" 'θiәtә kɑ:nt .kɒnvә'seiʃәn "), 'ˈθiətə kɑːnt .kɒnvəˈseiʃən');
    assert.equal(phoneticWordKey('CAN’T'), "can't");
    const load = async () => ({ cant: { phonetic: 'wrong' }, turn: { phonetic: 'wrong' }, "can't": { phonetic: 'kɑ:nt' } });
    assert.equal((await lookupWordPhonetic('CAN’T', () => ['c'], load)).text, 'kɑːnt');
    assert.equal((await lookupWordPhonetic('turned', () => ['t'], load)).status, 'missing');
    assert.equal((await lookupWordPhonetic('test', () => ['t'], async () => null)).status, 'error');
    h.text('It’s well-known. CAN’T!');
    assert.deepEqual(plain(h.options.segments.value.filter(s => s.type === 'word').map(s => s.text)), ['It’s', 'well-known', 'CAN’T']);
  } finally { h.dispose(); }
});

test('queries are lazy, deduplicate words and retain display preference without requiring storage', async () => {
  const h = harness();
  try {
    const calls = [];
    h.options.lookup = async word => { calls.push(word); return { status: 'ready', text: 'test' }; };
    h.text('Hello hello HELLO.'); await tick();
    assert.equal(calls.length, 0);
    h.app.readingDisplayMode.value = 'annotated'; await tick();
    assert.deepEqual(calls, ['hello']);
    assert.equal(h.storage.get('wordtap.readingDisplayMode'), 'annotated');
    assert.equal(h.options.sourceText.value, 'Hello hello HELLO.');
  } finally { h.dispose(); }
  const blocked = harness({ blocked: true });
  try { blocked.app.readingDisplayMode.value = 'phonetic'; blocked.text('Hi.'); await tick(); assert.equal(blocked.app.phonetics.value.hi.status, 'ready'); }
  finally { blocked.dispose(); }
  const restored = harness({ stored: 'phonetic' });
  try {
    assert.equal(restored.app.readingDisplayMode.value, 'annotated');
    assert.equal(restored.storage.get('wordtap.readingDisplayMode'), 'annotated');
  } finally { restored.dispose(); }
});

test('show IPA defaults off and persists both checkbox choices immediately for reload', () => {
  const h = harness();
  try {
    assert.equal(h.app.readingDisplayMode.value, 'original');
    for (const choice of ['annotated', 'original']) {
      h.app.readingDisplayMode.value = choice;
      const stored = h.storage.get('wordtap.readingDisplayMode');
      assert.equal(stored, choice);
      const reloaded = harness({ stored });
      try { assert.equal(reloaded.app.readingDisplayMode.value, choice); }
      finally { reloaded.dispose(); }
    }
  } finally { h.dispose(); }
});

test('editing invalidates in-flight results before segmentation; retry distinguishes missing from failures', async () => {
  const h = harness();
  try {
    const old = deferred();
    let failed = true;
    h.options.lookup = async word => word === 'old' ? old.promise : word === 'missing' ? { status: 'missing' }
      : failed ? { status: 'error' } : { status: 'ready', text: 'njuː' };
    h.app.readingDisplayMode.value = 'phonetic'; h.text('Old.'); await tick();
    h.options.sourceText.value = 'New missing.';
    old.resolve({ status: 'ready', text: 'old' }); await tick();
    assert.deepEqual(plain(h.app.phonetics.value), {});
    h.text('New missing.'); await tick();
    assert.deepEqual(plain(h.app.phoneticCounts.value), { loading: 0, missing: 1, error: 1 });
    failed = false; await h.app.retryPhonetics();
    assert.deepEqual(plain(h.app.phoneticCounts.value), { loading: 0, missing: 1, error: 0 });
    assert.equal(h.app.phoneticNotice('missing'), '暂无音标');
    h.options.enabled.value = false; await tick();
    assert.deepEqual(plain(h.app.phonetics.value), {});
  } finally { h.dispose(); }
});

test('manifest failure is retryable, and mode changes or disposal reject late results', async () => {
  const h = harness();
  try {
    h.options.prepare = async () => false;
    h.text('Hello.'); h.app.readingDisplayMode.value = 'phonetic'; await tick();
    assert.equal(h.app.phonetics.value.hello.status, 'error');
    h.options.prepare = async () => true;
    await h.app.retryPhonetics();
    assert.equal(h.app.phonetics.value.hello.status, 'ready');
    const slow = deferred(); h.options.lookup = () => slow.promise;
    h.text('Late.'); await tick();
    h.app.readingDisplayMode.value = 'original'; await tick();
    slow.resolve({ status: 'ready', text: 'late' }); await tick();
    assert.deepEqual(plain(h.app.phonetics.value), {});
    const final = deferred(); h.options.lookup = () => final.promise;
    h.app.readingDisplayMode.value = 'phonetic'; await tick();
    h.dispose(); final.resolve({ status: 'ready', text: 'late' }); await tick();
    assert.deepEqual(plain(h.app.phonetics.value), {});
  } finally { h.dispose(); }
});

test('shared limiter never exceeds four tasks, including queued work after rejection', async () => {
  const h = harness();
  try {
    const run = h.load('src/shared/utils/readingPhonetics.ts').createTaskLimiter(4);
    const gate = deferred(); let active = 0, peak = 0;
    const results = Array.from({ length: 15 }, (_, i) => run(async () => {
      peak = Math.max(peak, ++active); await gate.promise; active--; if (i === 2) throw Error('retryable'); return i;
    }));
    assert.equal(active, 4); gate.resolve(); await Promise.allSettled(results);
    assert.equal(peak, 4); assert.equal(active, 0);
  } finally { h.dispose(); }
});

test('all display modes render original punctuation and map clicks to the original segment', async () => {
  const h = harness();
  try {
    const component = h.load('src/shared/components/ReadingSegment.vue').default;
    const segment = { type: 'word', text: 'Hello', trailingText: '!', id: 'word-0', index: 0 };
    const base = { segment, selectedId: '', learnedClass: () => '', phonetic: { status: 'ready', text: 'həˈləʊ' } };
    for (const mode of ['original', 'annotated', 'phonetic']) {
      const html = await renderToString(vue.createSSRApp(component, { ...base, displayMode: mode }));
      assert.match(html, /<\/button>!<\/span>/);
      assert.equal(html.includes('study-word-ipa'), mode !== 'original');
      assert.equal(html.includes('study-word-spelling'), mode === 'annotated');
      if (mode === 'phonetic') assert.ok(!html.includes('>Hello<'));
    }
    const missing = await renderToString(vue.createSSRApp(component, { ...base, displayMode: 'phonetic', phonetic: { status: 'missing' } }));
    assert.match(missing, /暂无音标/); assert.match(missing, /Hello/);
    const events = [];
    const render = component.setup({ ...base, displayMode: 'phonetic' }, { expose() {}, emit: (...args) => events.push(args) });
    const vnode = render({ $emit: (...args) => events.push(args) }, []);
    const button = vnode.children.find(child => child.type === 'button');
    const event = { clientX: 10 };
    button.props.onClick(event);
    assert.equal(events[0][0], 'word'); assert.equal(events[0][1], segment); assert.equal(events[0][2], event);
  } finally { h.dispose(); }
});

test('user lesson fixture has 66 unique words with exactly three explicit dictionary gaps', async () => {
  const h = harness();
  try {
    const text = fs.readFileSync(new URL('tools/fixtures/reading-phonetics-lesson.txt', root), 'utf8');
    h.text(text);
    const { phoneticWordKey, lookupWordPhonetic } = h.load('src/shared/utils/readingPhonetics.ts');
    const manifest = JSON.parse(fs.readFileSync(new URL('public/dict/manifest.json', root), 'utf8'));
    const names = new Set(manifest.shardNames), shards = new Map();
    const words = [...new Set(h.options.segments.value.filter(s => s.type === 'word').map(s => phoneticWordKey(s.text)))];
    const missing = [];
    for (const word of words) {
      const result = await lookupWordPhonetic(word, key => Array.from({ length: key.length }, (_, i) => key.slice(0, key.length - i)).filter(x => names.has(x)), async name => {
        if (!shards.has(name)) shards.set(name, JSON.parse(fs.readFileSync(new URL('public/dict/shards/' + manifest.shardFiles[name], root), 'utf8')));
        return shards.get(name);
      });
      if (result.status !== 'ready') missing.push(word);
    }
    assert.equal(words.length, 66); assert.deepEqual(missing, ['theatre', 'actors', 'turned']);
  } finally { h.dispose(); }
});
