import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const courses = [
  ["english-vocabulary", "englishVocabulary", "EnglishVocabulary"],
  ["shuimu", "shuimu", "Shuimu"],
  ["postgraduate", "postgraduate", "Postgraduate"],
  ["cet", "cet", "Cet"],
  ["kaoyan-english", "kaoyanEnglish", "KaoyanEnglish"],
  ["nce", "nce", "Nce"],
  ["pep-english", "pepEnglish", "PepEnglish"],
  ["college-english", "collegeEnglish", "CollegeEnglish"],
];
const sw = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

// Execute the shipped worker with an old cache and a separately changing server.
function worker({ cached = "old", offline = false, status = 200 } = {}) {
  const handlers = {};
  const requests = [];
  const writes = [];
  vm.runInNewContext(sw, {
    URL,
    self: {
      location: { origin: "https://wordtap.cn" },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    caches: {
      match: async () => cached == null ? undefined : new Response(cached),
      open: async () => ({ put: async (request, response) => {
        cached = await response.text();
        writes.push(request.url);
      } }),
    },
    fetch: async (request, options) => {
      requests.push({ url: request.url, cache: options?.cache });
      if (offline) throw new TypeError("offline");
      return new Response("new", { status });
    },
  });
  return {
    requests, writes,
    fetch(path) {
      let response;
      handlers.fetch({
        request: new Request(`https://wordtap.cn/${path}`),
        respondWith: value => { response = value; },
      });
      return response;
    },
  };
}

for (const [course, file, name] of courses) {
  test(`${course}: old lesson and manifest caches are replaced online`, async () => {
    const w = worker();
    for (const path of [`${course}/manifest.json`, `${course}/lessons/book/001.json`]) {
      assert.equal(await (await w.fetch(path)).text(), "new");
    }
    assert.equal(w.requests.length, 2);
    assert.ok(w.requests.every(r => r.cache === "no-cache"));
    assert.equal(w.writes.length, 2);
  });

  test(`${course}: loader revalidates without a controlling worker`, async () => {
    const source = fs.readFileSync(new URL(`../src/shared/data/${file}Lessons.ts`, import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    const requests = [];
    vm.runInNewContext(code, {
      exports,
      require: specifier => {
        assert.equal(specifier, "../utils/assetUrls");
        return { appAssetUrl: path => path };
      },
      fetch: async (url, options) => {
        requests.push({ url, cache: options.cache });
        return Response.json({ schemaVersion: 1, entries: [], typingText: "Practice.", text: options.cache === "no-cache" ? "new" : "old" });
      },
    });
    assert.equal((await exports[`load${name}Lesson`](`${course}/lessons/book/001.json`)).text, "new");
    await exports[`load${name}Manifest`]();
    assert.equal(requests.length, 2);
    assert.ok(requests.every(r => r.cache === "no-cache"));
  });
}

test("offline reading retains cached lessons", async () => {
  const w = worker({ offline: true });
  assert.equal(await (await w.fetch("nce/lessons/nce1/001.json")).text(), "old");
  assert.equal(w.writes.length, 0);
});

test("missing offline content is not fabricated", async () => {
  const w = worker({ cached: null, offline: true });
  assert.equal(await w.fetch("nce/lessons/nce1/001.json"), undefined);
});

test("HTTP failures do not overwrite a valid cached lesson", async () => {
  const w = worker({ status: 404 });
  assert.equal((await w.fetch("nce/lessons/nce1/001.json")).status, 404);
  assert.equal(w.writes.length, 0);
});

test("versioned dictionary and audio assets remain cache-first", async () => {
  const w = worker();
  for (const path of ["dict/shards/ab.json?v=1", "ipa/yp/050.mp3"]) {
    assert.equal(await (await w.fetch(path)).text(), "old");
  }
  assert.equal(w.requests.length, 0);
});

test("vocabulary search indexes revalidate and remain available offline", async () => {
  const path = "english-vocabulary/indexes/evjunior.json";
  const online = worker();
  assert.equal(await (await online.fetch(path)).text(), "new");
  assert.equal(online.requests[0].cache, "no-cache");
  const offline = worker({ offline: true });
  assert.equal(await (await offline.fetch(path)).text(), "old");
});
