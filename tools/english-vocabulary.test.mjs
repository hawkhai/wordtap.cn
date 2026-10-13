import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as vue from "vue";
import { lessonShortCode, parseLessonShortCode } from "../src/shared/utils/lessonShortProtocol.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../public/english-vocabulary/manifest.json", import.meta.url), "utf8"));
const read = path => JSON.parse(fs.readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8"));
function adapter(fetch) {
  const source = fs.readFileSync(new URL("../src/shared/data/englishVocabularyLessons.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => ({ appAssetUrl: path => path }), fetch });
  return exports;
}

test("all 23 vocabularies retain every source position, search word and short link", () => {
  assert.equal(manifest.groups.length, 23);
  assert.equal(manifest.wordsPerArticle, 100);
  assert.equal(manifest.totalLessons, 1181);
  let count = 0;
  for (const group of manifest.groups) {
    const index = read(group.indexPath);
    assert.equal(group.lessonCount, Math.ceil(group.wordCount / 100));
    assert.equal(index.lessons.length, group.lessonCount);
    for (const [number, lesson] of group.lessons.entries()) {
      const detail = read(lesson.jsonPath);
      assert.equal(detail.id, lesson.id);
      assert.equal(detail.wordCount, Math.min(100, group.wordCount - number * 100));
      assert.equal(detail.entries.length, detail.wordCount);
      assert.equal(detail.source.lineStart, number * 100 + 1);
      assert.equal(detail.source.lineEnd, number * 100 + detail.wordCount);
      assert.equal(detail.unitNo, number + 1);
      assert.equal(detail.id, `${group.id}-${String(number * 5 + 1).padStart(3, '0')}`);
      assert.deepEqual(index.lessons[number], { id: detail.id, words: detail.entries.map(entry => entry.word) });
      assert.deepEqual(parseLessonShortCode(lessonShortCode("english-vocabulary", lesson.id)), { course: "english-vocabulary", id: lesson.id });
      assert.ok(detail.text.length <= 120000);
      assert.equal(detail.typingText, detail.entries.flatMap(entry => {
        const sentences = (entry.sentences ?? []).filter(item => /[A-Za-z]/.test(item.sentence)).map(item => item.sentence);
        return sentences.length ? sentences : [entry.word];
      }).join("\n\n"));
      count += detail.wordCount;
    }
  }
  assert.equal(count, manifest.totalWords);
});

test("all old short links resolve to the article containing the original source words", () => {
  const { resolveEnglishVocabularyLesson: resolve } = adapter(() => {});
  for (const group of manifest.groups) {
    const oldCount = Math.ceil(group.wordCount / 20);
    for (let number = 1; number <= oldCount; number++) {
      const article = resolve(manifest.groups, `${group.id}-${String(number).padStart(3, '0')}`);
      assert.equal(article.id, group.lessons[Math.floor((number - 1) / 5)].id);
    }
    assert.equal(resolve(manifest.groups, `${group.id}-${String(oldCount + 1).padStart(3, '0')}`), undefined);
  }
  for (const id of ['evjunior-000', 'evjunior-1', 'evunknown-001']) assert.equal(resolve(manifest.groups, id), undefined);
});

test("saved 20-word articles retain their exact reading and typing hashes without old JSON files", async () => {
  // Frozen hashes from the published 20-word data, including final units and known source issues.
  const samples = [
    ["evjunior/001", "0b6e9cf0f5ea52fa605917c021787d23fc9df054b101a21b3e108e759e8e6510", "a6c6a700c3669cdc743aef1abdc37f4c1ff0fd97fee86622b2bfc14d34bc0750"],
    ["evjunior/162", "5a192929259a5993aef1085671a348620dc8e907778894816024c55fec8284a6", "6c6f5c5b963d1fbfeafaa6bb34ba93b41f00d3ed2e8de33d876c71ecef49a8f6"],
    ["evpep3/007", "b8e649e1e9a15e2c0482f575273cdd18b9f7aaccac8ed43ae1568b99015c6d19", "5eb3ed1e6f325944b630f8dee90510ab715997279dba62ffff1952b68fb3ea99"],
    ["evtoefl/201", "1a3f93f5c2ff11defb8a5fde75cf5c90541e4fb75dfb59507122fc32825b0945", "9c96a3b99a242375921e631978f027420bdea204a206bde2705a98456bfbc252"],
    ["evcet4/193", "fb15884e86034e456d7dcc7194341b568c46c8d75e4a4e16d1c1d97468256fd2", "f339d4f5a279f0ab45f27c68724e0b81491fac7edd123f146fe34978ebd3ba92"],
    ["evfltrp/086", "aa08542c1be49df9ef42ea7f5c4f5777c929b97c7eb2698d4dcf36c0bd9475d3", "a7ce6a45ad9cabc2d1b6f284816ecd00c85d980192e22192bfd0d8fabec2066c"],
  ];
  const calls = [];
  const { loadEnglishVocabularyLesson: load } = adapter(async path => { calls.push(path); return Response.json(read(path)); });
  for (const [suffix, textHash, typingHash] of samples) {
    const path = `english-vocabulary/lessons/${suffix}.json`;
    assert.equal(fs.existsSync(new URL(`../public/${path}`, import.meta.url)), false);
    const old = await load(path);
    assert.equal(old.jsonPath, path);
    assert.equal(old.id, suffix.replace('/', '-'));
    const number = Number(suffix.split('/')[1]);
    assert.equal(old.source.lineStart, (number - 1) * 20 + 1);
    assert.equal(old.source.lineEnd, old.source.lineStart + old.wordCount - 1);
    assert.equal(createHash('sha256').update(old.text).digest('hex'), textHash);
    assert.equal(createHash('sha256').update(old.typingText).digest('hex'), typingHash);
  }
  assert.ok(calls.every(path => path.startsWith('english-vocabulary/articles/')));
  await assert.rejects(load('english-vocabulary/lessons/evpep3/008.json'), /Invalid vocabulary unit/);
});

test("unit loader rejects HTTP failures and missing typing bodies, and supports retry", async () => {
  const source = fs.readFileSync(new URL("../src/shared/data/englishVocabularyLessons.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  let response = new Response("", { status: 503 });
  vm.runInNewContext(code, { exports, require: () => ({ appAssetUrl: path => path }), fetch: async () => response });
  await assert.rejects(exports.loadEnglishVocabularyLesson("unit.json"), /503/);
  response = Response.json({ schemaVersion: 1, text: "word", entries: [] });
  await assert.rejects(exports.loadEnglishVocabularyLesson("unit.json"), /Invalid vocabulary unit/);
  const detail = read(manifest.groups[0].lessons[0].jsonPath);
  response = Response.json(detail);
  assert.equal((await exports.loadEnglishVocabularyLesson("unit.json")).id, detail.id);
});

test("restored book loads its index after the catalog arrives; failed indexes can retry", async () => {
  const component = fs.readFileSync(new URL("../src/EnglishVocabularyDropdown.vue", import.meta.url), "utf8");
  const script = component.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const exports = {};
  const calls = [];
  let fail = false;
  const group = manifest.groups.find(group => group.id === "evpep3");
  const selected = vue.ref("evpep3-007");
  const scope = vue.effectScope();
  const mocks = {
    vue: { ...vue, onBeforeUnmount: () => {} },
    "./shared/composables/useCourseMenuProgress": { useCourseMenuProgress: () => ({
      activeGroupId: vue.ref(group.id), selectedLessonId: selected, listElement: vue.ref(null),
      syncGroups: () => {}, restoreScroll: () => {}, rememberScroll: () => {}, setGroup: () => {}, rememberLesson: (_, id) => { selected.value = id; },
    }) },
    "./shared/data/englishVocabularyLessons": {
      loadEnglishVocabularyManifest: async () => manifest,
      resolveEnglishVocabularyLesson: adapter(() => {}).resolveEnglishVocabularyLesson,
      loadEnglishVocabularyIndex: async path => { calls.push(path); if (fail) throw new Error("offline"); return read(path); },
    },
  };
  const code = ts.transpileModule(script + "\nexport { loadMenu, loadIndex, filteredLessons, searchQuery, indexes, indexError };", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  scope.run(() => vm.runInNewContext(code, { exports, require: name => mocks[name], defineEmits: () => () => {} }));
  await exports.loadMenu();
  await vue.nextTick();
  await Promise.resolve();
  assert.deepEqual(calls, [group.indexPath]);
  assert.equal(selected.value, "evpep3-006");
  exports.searchQuery.value = "strawberry";
  assert.equal(exports.filteredLessons.value[0].id, "evpep3-006");
  delete exports.indexes.value[group.id];
  fail = true;
  await exports.loadIndex();
  assert.match(exports.indexError.value, /重试/);
  fail = false;
  await exports.loadIndex();
  assert.equal(exports.indexError.value, "");
  assert.equal(exports.filteredLessons.value[0].id, "evpep3-006");
  scope.stop();
});
