import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "public", "postgraduate", "manifest.json"), "utf8"));
const requireComplete = process.argv.includes("--require-complete");
const expectedCounts = new Map([
  ["volume1", 10],
  ["volume2", 10],
  ["reading-writing-translation", 20],
]);
let lessonCount = 0;

invariant(manifest.schemaVersion === 1, "Unsupported postgraduate manifest schema");
invariant(manifest.generatorVersion === "1.2.0", "Unexpected postgraduate generator version");
invariant(manifest.volumes.length === 3, "Expected three postgraduate volumes");
invariant(manifest.expectedTotalLessons === 40, "Expected catalog must contain 40 lessons");
invariant(manifest.complete === (manifest.missingLessons.length === 0), "Manifest completeness flag mismatch");

for (const volume of manifest.volumes) {
  const expectedCount = expectedCounts.get(volume.id);
  invariant(expectedCount, `${volume.id}: unexpected volume`);
  invariant(!/(?:\?{2,}|\uFFFD)/u.test(volume.title), `${volume.id}: title contains mojibake`);
  invariant(!/(?:\?{2,}|\uFFFD)/u.test(volume.subtitle), `${volume.id}: subtitle contains mojibake`);
  invariant(volume.expectedLessonCount === expectedCount, `${volume.id}: expected lesson count mismatch`);
  const isReader = volume.id === "reading-writing-translation";
  invariant(
    isReader
      ? volume.lessonCount === 20 && volume.missingUnitNos.length === 0
      : volume.lessonCount + volume.missingUnitNos.length === expectedCount,
    `${volume.id}: coverage count mismatch`,
  );
  invariant(volume.lessons.length === volume.lessonCount, `${volume.id}: manifest count mismatch`);
  const presentUnitNos = new Set(volume.lessons.map((lesson) => lesson.unitNo));
  invariant(
    presentUnitNos.size === (isReader ? 10 : volume.lessonCount),
    `${volume.id}: unexpected unit coverage`,
  );
  invariant(volume.missingUnitNos.every((unitNo) => !presentUnitNos.has(unitNo)), `${volume.id}: missing unit is present`);
  invariant(
    [...presentUnitNos, ...volume.missingUnitNos].sort((a, b) => a - b).join(",") === "1,2,3,4,5,6,7,8,9,10",
    `${volume.id}: units do not cover the expected catalog`,
  );
  if (isReader) {
    invariant(volume.languageMode === "en", `${volume.id}: language mode must be English`);
    invariant(
      [...presentUnitNos].sort((a, b) => a - b).join(",") === "1,2,3,4,5,6,7,8,9,10",
      `${volume.id}: expected units 1-10`,
    );
    for (let unitNo = 1; unitNo <= 10; unitNo += 1) {
      const unitLessons = volume.lessons.filter((lesson) => lesson.unitNo === unitNo);
      invariant(unitLessons.length === 2, `${volume.id}: unit ${unitNo} must contain Text A and Text B`);
      invariant(
        unitLessons.map((lesson) => lesson.textLabel).sort().join(",") === "Text A,Text B",
        `${volume.id}: unit ${unitNo} has invalid text labels`,
      );
    }
  } else {
    invariant(volume.languageMode === "bilingual", `${volume.id}: language mode must be bilingual`);
  }
  for (const lesson of volume.lessons) {
    const detail = JSON.parse(await readFile(path.join(root, "public", lesson.jsonPath), "utf8"));
    invariant(detail.id === lesson.id, `${lesson.id}: detail ID mismatch`);
    invariant(detail.unitNo === lesson.unitNo, `${lesson.id}: unit number mismatch`);
    invariant(detail.text.length > (isReader ? 3000 : 500), `${lesson.id}: lesson text is unexpectedly short`);
    invariant(detail.blocks.length > (isReader ? 2 : 4), `${lesson.id}: lesson blocks are unexpectedly sparse`);
    invariant(detail.text === detail.blocks.map((block) => block.text).join("\n"), `${lesson.id}: text and blocks differ`);
    invariant(detail.blocks.some((block) => block.lang === "en"), `${lesson.id}: missing English content`);
    if (isReader) {
      invariant(detail.textLabel === lesson.textLabel, `${lesson.id}: text label mismatch`);
      invariant(typeof detail.author === "string" && detail.author.length > 1, `${lesson.id}: missing author`);
      invariant(detail.blocks.every((block) => block.lang === "en"), `${lesson.id}: unexpected non-English block`);
      invariant(!/[\u3400-\u9fff]/u.test(detail.text), `${lesson.id}: Chinese OCR bleed-through remains`);
      invariant(!/\b(?:NEW WORDS|READING COMPREHENSION)\b/i.test(detail.text), `${lesson.id}: exercise content remains`);
      invariant(!/研\s*究\s*生\s*英\s*语\s*读\s*写\s*译\s*教\s*程/u.test(detail.text), `${lesson.id}: page header remains`);
    } else {
      invariant(detail.blocks.some((block) => block.lang === "zh"), `${lesson.id}: missing Chinese content`);
    }
    invariant(!/\\(?:newpar|section|textcolor|elegantpar|footnote)\b/.test(detail.text), `${lesson.id}: LaTeX command remains`);
    invariant(!detail.text.includes("D:\\kSource"), `${lesson.id}: leaked absolute source path`);
    invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(detail.text), `${lesson.id}: unsafe character remains`);
    lessonCount += 1;
  }
}

invariant(lessonCount === manifest.totalLessons, "Total lesson count mismatch");
invariant(lessonCount + manifest.missingLessons.length === manifest.expectedTotalLessons, "Total coverage mismatch");
const volumeMissingKeys = manifest.volumes
  .flatMap((volume) => volume.missingUnitNos.map((unitNo) => `${volume.id}:${unitNo}`))
  .sort();
const manifestMissingKeys = manifest.missingLessons
  .map((lesson) => `${lesson.volumeId}:${lesson.unitNo}`)
  .sort();
invariant(
  volumeMissingKeys.join(",") === manifestMissingKeys.join(","),
  "Manifest and volume missing-lesson lists differ",
);
if (requireComplete) {
  invariant(manifest.complete, `Postgraduate course is incomplete: ${manifest.missingLessons.length} lesson(s) missing`);
}
const suffix = manifest.complete ? "complete" : `${manifest.missingLessons.length} missing`;
console.log(`Verified ${lessonCount}/${manifest.expectedTotalLessons} postgraduate English lessons (${suffix}).`);
