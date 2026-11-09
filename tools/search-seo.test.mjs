import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { lessonSeoTitle } from "./course-seo.mjs";
import { buildSearchRedirects } from "./generate-search-redirects.mjs";

test("long textbook search titles keep course location and brand without cutting English words", () => {
  const title = lessonSeoTitle("新视野大学英语4版 读写教程 1 U1A", "Toward a brighter future for all");
  assert.ok(Array.from(title).length <= 70);
  assert.ok(title.includes("Toward a brighter future for all"));
  const long = lessonSeoTitle("新概念英语4第13课", "The search for oil and the extraordinarily complicated history of exploration");
  assert.ok(Array.from(long).length <= 70);
  assert.match(long, /^新概念英语4第13课 .*… - WordTap$/u);
  assert.ok(!long.includes("extraordina…"));
  assert.equal(lessonSeoTitle("教材第1课", "A & B"), "教材第1课 A & B - WordTap");
});

test("redirect generation rejects missing destinations and ambiguous root IDs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wordtap-search-"));
  try {
    const specs = [["nce", "books"], ["shuimu", "levels"], ["postgraduate", "volumes"], ["pep-english", "groups"], ["college-english", "groups"], ["cet", "groups"], ["kaoyan-english", "groups"]];
    for (const [course, key] of specs) {
      await mkdir(path.join(root, course), { recursive: true });
      await writeFile(path.join(root, course, "manifest.json"), JSON.stringify({ [key]: [{ lessons: [{ id: `${course}-001` }] }] }));
      await mkdir(path.join(root, course, `${course}-001`));
      await writeFile(path.join(root, course, `${course}-001`, "index.html"), "published");
    }
    const result = await buildSearchRedirects(root);
    assert.equal(result.count, 7);
    assert.match(result.config, /rewrite \^\/\(kaoyan-english-001\)\/\?\$ https:\/\/wordtap\.cn\/kaoyan-english\/\$1\/ permanent;/);
    assert.ok(!result.config.includes("english-vocabulary"));
    await rm(path.join(root, "nce", "nce-001", "index.html"));
    await assert.rejects(buildSearchRedirects(root), /ENOENT/);
    await writeFile(path.join(root, "nce", "nce-001", "index.html"), "published");
    await writeFile(path.join(root, "shuimu", "manifest.json"), JSON.stringify({ levels: [{ lessons: [{ id: "nce-001" }] }] }));
    await assert.rejects(buildSearchRedirects(root), /Ambiguous root lesson path/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
