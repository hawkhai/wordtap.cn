import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "public", "cet", "manifest.json"), "utf8"));
if (manifest.courseId !== "cet" || manifest.schemaVersion !== 1) throw new Error("Invalid CET manifest identity");
if (!Array.isArray(manifest.groups) || manifest.groups.length !== 2) throw new Error("CET manifest must contain CET-4 and CET-6 groups");
const lessons = manifest.groups.flatMap((group) => group.lessons);
if (lessons.length !== manifest.totalLessons || lessons.length < 1) throw new Error("CET lesson count mismatch");
if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) throw new Error("Duplicate CET lesson id");
for (const lesson of lessons) {
  if (!/^cet[46]-(?:20\d{2})(?:0[1-9]|1[0-2])(?:0[0-3])$/.test(lesson.id)) throw new Error(`Invalid CET lesson id: ${lesson.id}`);
  const expectedId = `${lesson.groupId}-${lesson.year}${String(lesson.month).padStart(2, "0")}${String(lesson.setNo).padStart(2, "0")}`;
  if (lesson.id !== expectedId) throw new Error(`CET lesson ID is not date-stable: ${lesson.id} != ${expectedId}`);
  const detail = JSON.parse(await readFile(path.join(root, "public", lesson.jsonPath), "utf8"));
  if (detail.id !== lesson.id || detail.text.length !== lesson.characterCount) throw new Error(`CET detail mismatch: ${lesson.id}`);
  if (detail.text.length < 6_000 || !Array.isArray(detail.blocks) || detail.blocks.length < 1) throw new Error(`CET lesson is incomplete: ${lesson.id}`);
  if (!/^[a-f0-9]{64}$/.test(detail.source?.pdfSha256 ?? "")) throw new Error(`Missing CET source hash: ${lesson.id}`);
}
console.log(`Verified ${lessons.length} CET papers.`);
