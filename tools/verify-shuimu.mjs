import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "public", "shuimu", "manifest.json"), "utf8"));
const reviewedCorrections = JSON.parse(await readFile(path.join(root, "tools", "shuimu-reviewed-corrections.json"), "utf8"));
const reviewedVideoMap = JSON.parse(await readFile(path.join(root, "tools", "shuimu-video-map.json"), "utf8"));
const absolutePathPattern = /(?:\b[A-Za-z]:\\[^\\\s]+\\|\b[A-Za-z]:\/(?:Users|Documents and Settings)\/[^/\s]+\/|\/(?:Users|home)\/[^/\s]+\/)/u;
const expectedCounts = new Map([
  ["phonetics", 12],
  ["beginner", 50],
  ["intermediate", 70],
  ["upper", 60],
]);
const videoUrls = new Set();
let lessonCount = 0;
const knownTypos = [
  "nationaliy", "magzines", "theif", "shalll", "hadbag", "dolllars",
  "Goerge", "Austrilia", "meeing", "moring", "stilll", "strictlly",
  "wonderfull", "ballon", "untile", "meseum", "sandwitch", "defamtion",
  "beingtold", "unkown", "investigaing", "quitetly", "youun", "descision",
];

invariant(manifest.schemaVersion === 1, "Unsupported Water & Wood English manifest schema");
invariant(manifest.generatorVersion === "1.1.0", "Unexpected Water & Wood English generator version");
invariant(manifest.levels.length === expectedCounts.size, "Expected four course levels");
const correctionCount = Object.values(reviewedCorrections).reduce((total, corrections) => total + corrections.length, 0);
invariant(correctionCount === 304, `Expected 304 reviewed corrections, got ${correctionCount}`);
for (const [lessonId, corrections] of Object.entries(reviewedCorrections)) {
  invariant(Array.isArray(corrections) && corrections.length > 0, `${lessonId}: invalid reviewed corrections`);
  for (const correction of corrections) {
    invariant(Array.isArray(correction.before) && Array.isArray(correction.after), `${lessonId}: invalid correction shape`);
  }
}

for (const level of manifest.levels) {
  invariant(level.lessonCount === expectedCounts.get(level.id), `${level.id}: unexpected lesson count`);
  invariant(level.lessons.length === level.lessonCount, `${level.id}: manifest count mismatch`);
  for (const lesson of level.lessons) {
    const detail = JSON.parse(await readFile(path.join(root, "public", lesson.jsonPath), "utf8"));
    invariant(detail.id === lesson.id, `${lesson.id}: detail ID mismatch`);
    invariant(detail.unitNo === lesson.unitNo, `${lesson.id}: unit number mismatch`);
    invariant(detail.text.trim().length > 100, `${lesson.id}: lesson text is unexpectedly short`);
    invariant(detail.blocks.length > 3, `${lesson.id}: lesson blocks are unexpectedly sparse`);
    invariant(detail.text === detail.blocks.map((block) => block.text).join("\n"), `${lesson.id}: text and blocks differ`);
    invariant(!absolutePathPattern.test(detail.text), `${lesson.id}: leaked absolute source path`);
    invariant(!/[\uE000-\uF8FF]/u.test(detail.text), `${lesson.id}: private-use character remains`);
    invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFFD]/u.test(detail.text), `${lesson.id}: unsafe or invisible character remains`);
    for (const block of detail.blocks) {
      invariant(
        !/^[•◦▪▫▶➢◆]/u.test(block.text) || block.type === "list",
        `${lesson.id}: bullet-prefixed block is not classified as a list`,
      );
    }
    for (const typo of knownTypos) {
      invariant(!detail.text.includes(typo), `${lesson.id}: uncorrected OCR typo ${typo}`);
    }
    invariant(!/^\?(?:——|When |What |That's |It's )/m.test(detail.text), `${lesson.id}: uncorrected dialogue prefix`);
    if (level.id === "upper") {
      for (const block of detail.blocks.filter((item) => item.type === "heading")) {
        const headingNumber = block.text.match(/^(\d+)\.[123](?=【)/)?.[1];
        invariant(!headingNumber || Number(headingNumber) === lesson.unitNo, `${lesson.id}: stale converted heading ${block.text}`);
      }
    }
    for (const video of detail.videos) {
      invariant(/^https:\/\/www\.bilibili\.com\/cheese\/play\/ep\d+$/.test(video.url), `${lesson.id}: invalid Bilibili URL`);
      invariant(!videoUrls.has(video.url), `${lesson.id}: duplicate Bilibili URL`);
      videoUrls.add(video.url);
    }
    if (level.id === "intermediate") {
      const expectedVideos = reviewedVideoMap[String(lesson.unitNo)] ?? [];
      invariant(JSON.stringify(detail.videos) === JSON.stringify(expectedVideos), `${lesson.id}: video mapping drift`);
    }
    lessonCount += 1;
  }
}

invariant(lessonCount === manifest.totalLessons && lessonCount === 192, "Total lesson count mismatch");
invariant(videoUrls.size === 50, `Expected 50 Bilibili links, got ${videoUrls.size}`);
invariant(
  Object.values(reviewedVideoMap).reduce((total, videos) => total + videos.length, 0) === 50,
  "Reviewed video mapping must contain 50 links",
);
const unit24 = JSON.parse(await readFile(path.join(root, "public", "shuimu", "lessons", "intermediate", "024.json"), "utf8"));
invariant(unit24.videos.some((video) => video.title.includes("中级24.3") && video.url.endsWith("/ep53067")), "Missing supplied 中级24.3 → ep53067 mapping");

console.log(`Verified ${lessonCount} Water & Wood English lessons and ${videoUrls.size} Bilibili links.`);
