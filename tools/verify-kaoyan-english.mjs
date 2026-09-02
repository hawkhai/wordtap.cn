import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "public", "kaoyan-english", "manifest.json"), "utf8"));
if (manifest.courseId !== "kaoyan-english" || manifest.schemaVersion !== 1) throw new Error("Invalid Kaoyan English manifest identity");
if (!Array.isArray(manifest.groups) || manifest.groups.length !== 2) throw new Error("Kaoyan English manifest must contain English I and English II");

const expectedYears = { e1: [1980, 2026], e2: [2010, 2026] };
const lessons = manifest.groups.flatMap((group) => {
  const range = expectedYears[group.id];
  if (!range) throw new Error(`Unexpected Kaoyan English group: ${group.id}`);
  const years = group.lessons.map((lesson) => lesson.year);
  const expected = Array.from({ length: range[1] - range[0] + 1 }, (_, index) => range[0] + index);
  if (JSON.stringify(years) !== JSON.stringify(expected)) throw new Error(`${group.id}: years are incomplete or out of order`);
  if (group.lessonCount !== group.lessons.length) throw new Error(`${group.id}: lesson count mismatch`);
  return group.lessons;
});

if (lessons.length !== 64 || manifest.totalLessons !== 64) throw new Error("Kaoyan English must contain exactly 64 papers");
if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) throw new Error("Duplicate Kaoyan English lesson id");

for (const lesson of lessons) {
  if (!/^e[12]-(?:19|20)\d{2}$/.test(lesson.id)) throw new Error(`Invalid Kaoyan English lesson id: ${lesson.id}`);
  if (lesson.id !== `${lesson.groupId}-${lesson.year}`) throw new Error(`Kaoyan English ID is not year-stable: ${lesson.id}`);
  const detail = JSON.parse(await readFile(path.join(root, "public", lesson.jsonPath), "utf8"));
  if (detail.id !== lesson.id || detail.text.length !== lesson.characterCount) throw new Error(`Kaoyan English detail mismatch: ${lesson.id}`);
  if (detail.text.length < 6_000 || !Array.isArray(detail.blocks) || detail.blocks.length < 1) throw new Error(`Kaoyan English paper is incomplete: ${lesson.id}`);
  if (!detail.blocks.every((block) => block.type === "paragraph" && block.lang === "en" && block.text.trim())) throw new Error(`Invalid text block: ${lesson.id}`);
  if (!/^[a-f0-9]{64}$/.test(detail.source?.pdfSha256 ?? "")) throw new Error(`Missing source hash: ${lesson.id}`);
  if (!/^https:\/\//.test(detail.source?.sourcePage ?? "") || !/^https:\/\//.test(detail.source?.downloadUrl ?? "")) throw new Error(`Missing source URL: ${lesson.id}`);
}

console.log("Verified 64 Kaoyan English papers (English I 1980-2026; English II 2010-2026).");
