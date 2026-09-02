import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "public", "pep-english", "manifest.json"), "utf8"));
const requireComplete = process.argv.includes("--require-complete");
const expectedGroups = [
  "pepj7a", "pepj7b", "pepj8a", "pepj8b", "pepj9",
  "pephr1", "pephr2", "pephr3", "pephs1", "pephs2", "pephs3", "pephs4",
  "pephe1", "pephe2", "pephe3", "pephg", "pephw",
];
const ids = new Set();
const paths = new Set();
let total = 0;

invariant(manifest.schemaVersion === 1, "Unsupported PEP English manifest schema");
invariant(manifest.generatorVersion === "1.2.0", "Unexpected PEP English generator version");
invariant(manifest.expectedBookCount === 17, "PEP English must declare 17 expected books");
invariant(manifest.availableBookCount === manifest.groups.length, "Available-book count mismatch");
invariant(manifest.availableBookCount + manifest.missingBooks.length === 17, "Available and missing books must cover the catalog");
invariant(manifest.complete === (manifest.missingBooks.length === 0), "Completeness flag mismatch");

const presentGroups = new Set(manifest.groups.map((group) => group.id));
const missingGroups = new Set(manifest.missingBooks.map((book) => book.id));
invariant(expectedGroups.every((id) => presentGroups.has(id) || missingGroups.has(id)), "Manifest does not cover every expected PEP English book");

for (const group of manifest.groups) {
  invariant(expectedGroups.includes(group.id), `${group.id}: unexpected group`);
  invariant(["junior", "senior"].includes(group.stage), `${group.id}: invalid stage`);
  invariant(group.sourceStatus === "available", `${group.id}: available group has invalid source status`);
  invariant(group.lessonCount > 0 && group.lessonCount === group.lessons.length, `${group.id}: lesson count mismatch`);
  for (const lesson of group.lessons) {
    invariant(lesson.groupId === group.id, `${lesson.id}: group mismatch`);
    invariant(lesson.id === `${group.id}-${String(lesson.sequenceNo).padStart(3, "0")}`, `${lesson.id}: unstable lesson ID`);
    invariant(!ids.has(lesson.id), `${lesson.id}: duplicate ID`);
    invariant(!paths.has(lesson.jsonPath), `${lesson.id}: duplicate JSON path`);
    ids.add(lesson.id);
    paths.add(lesson.jsonPath);
    const detail = JSON.parse(await readFile(path.join(root, "public", lesson.jsonPath), "utf8"));
    invariant(detail.id === lesson.id && detail.groupId === group.id, `${lesson.id}: detail identity mismatch`);
    invariant(detail.unitNo === lesson.unitNo && detail.sequenceNo === lesson.sequenceNo, `${lesson.id}: numbering mismatch`);
    invariant(typeof detail.section === "string" && detail.section.length > 0, `${lesson.id}: missing section`);
    invariant(typeof detail.title === "string" && detail.title.length > 1, `${lesson.id}: missing title`);
    invariant(detail.source?.pageStart > 0 && detail.source?.pageEnd >= detail.source.pageStart, `${lesson.id}: invalid source pages`);
    invariant(typeof detail.source?.pdfMd5 === "string" && /^[a-f\d]{32}$/i.test(detail.source.pdfMd5), `${lesson.id}: missing source hash`);
    invariant(detail.text.length >= 120, `${lesson.id}: passage is too short`);
    invariant(detail.blocks.length > 0 && detail.blocks.every((block) => block.lang === "en"), `${lesson.id}: invalid blocks`);
    invariant(detail.text === detail.blocks.map((block) => block.text).join("\n"), `${lesson.id}: text and blocks differ`);
    invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(detail.text), `${lesson.id}: unsafe character remains`);
    invariant(!detail.text.includes("D:\\kSource"), `${lesson.id}: absolute path leaked`);
    invariant(!/^(?:Listen|Match|Complete|Fill|Choose|Circle|Discuss|Work in|Answer)\b/im.test(detail.text), `${lesson.id}: exercise instruction remains`);
    total += 1;
  }
}

invariant(total === manifest.totalLessons, "PEP English total lesson count mismatch");
if (requireComplete) invariant(manifest.complete, `PEP English is incomplete: ${manifest.missingBooks.length} missing book(s)`);
console.log(`Verified ${total} PEP English lessons from ${manifest.availableBookCount}/17 books${manifest.complete ? " (complete)" : ""}.`);
