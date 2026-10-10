import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as vue from "vue";
import { lessonShortCode, parseLessonShortCode } from "../src/shared/utils/lessonShortProtocol.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../public/english-vocabulary/manifest.json", import.meta.url), "utf8"));
const read = path => JSON.parse(fs.readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8"));

test("all 23 vocabularies retain every source position, search word and short link", () => {
  assert.equal(manifest.groups.length, 23);
  let count = 0;
  for (const group of manifest.groups) {
    const index = read(group.indexPath);
    assert.equal(group.lessonCount, Math.ceil(group.wordCount / 20));
    assert.equal(index.lessons.length, group.lessonCount);
    for (const [number, lesson] of group.lessons.entries()) {
      const detail = read(lesson.jsonPath);
      assert.equal(detail.id, lesson.id);
      assert.equal(detail.wordCount, Math.min(20, group.wordCount - number * 20));
      assert.equal(detail.entries.length, detail.wordCount);
      assert.equal(detail.source.lineStart, number * 20 + 1);
      assert.equal(detail.source.lineEnd, number * 20 + detail.wordCount);
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
  const scope = vue.effectScope();
  const mocks = {
    vue: { ...vue, onBeforeUnmount: () => {} },
    "./shared/composables/useCourseMenuProgress": { useCourseMenuProgress: () => ({
      activeGroupId: vue.ref(group.id), selectedLessonId: vue.ref(""), listElement: vue.ref(null),
      syncGroups: () => {}, restoreScroll: () => {}, rememberScroll: () => {}, setGroup: () => {}, rememberLesson: () => {},
    }) },
    "./shared/data/englishVocabularyLessons": {
      loadEnglishVocabularyManifest: async () => manifest,
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
  exports.searchQuery.value = "strawberry";
  assert.equal(exports.filteredLessons.value[0].id, "evpep3-007");
  delete exports.indexes.value[group.id];
  fail = true;
  await exports.loadIndex();
  assert.match(exports.indexError.value, /重试/);
  fail = false;
  await exports.loadIndex();
  assert.equal(exports.indexError.value, "");
  assert.equal(exports.filteredLessons.value[0].id, "evpep3-007");
  scope.stop();
});
