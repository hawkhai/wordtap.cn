import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { lessonToolHref } from "./course-page-shared.mjs";
import {
  compactLessonId,
  lessonShortCode,
  lessonShortCodeConfig,
  parseLessonShortCode,
} from "../src/shared/utils/lessonShortProtocol.js";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const courseSpecs = [
  { id: "pep-english", collections: "groups" },
  { id: "nce", collections: "books" },
  { id: "shuimu", collections: "levels" },
  { id: "postgraduate", collections: "volumes" },
  { id: "college-english", collections: "groups" },
  { id: "cet", collections: "groups" },
  { id: "kaoyan-english", collections: "groups" },
];
const protocolEntries = Object.entries(lessonShortCodeConfig);
const prefixes = protocolEntries.map(([, protocol]) => protocol.prefix);
const shortCodeOwners = new Map();
const lessonPathOwners = new Map();
let lessonCount = 0;
const appStyles = await readFile(path.join(root, "src", "style.css"), "utf8");
const serviceWorkerPath = path.join(root, "public", "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
const forbiddenLongCodeTokens = [
  ...courseSpecs.map(({ id }) => `${id}Lesson`),
  ["legacy", "Url"].join(""),
  ["build", "Legacy", "Lesson", "Url"].join(""),
];

async function sourceFilesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFilesUnder(entryPath));
    } else if (/\.(?:ts|vue|js|mjs|md|json|html|css|xml|svg|txt|webmanifest)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

const protocolSourceFiles = [
  ...await sourceFilesUnder(path.join(root, "src")),
  ...await sourceFilesUnder(path.join(root, "tools")),
  ...await sourceFilesUnder(path.join(root, "public")),
  path.join(root, "package.json"),
  path.join(root, "README.md"),
  path.join(root, "index.html"),
  path.join(root, "vite.config.ts"),
];

for (const sourcePath of protocolSourceFiles) {
  const source = await readFile(sourcePath, "utf8");
  for (const token of forbiddenLongCodeTokens) {
    invariant(
      !new RegExp(`\\b${token}\\b`).test(source),
      `${path.relative(root, sourcePath)}: forbidden long-code token ${token}`,
    );
  }
}

function verifyServiceWorker(text, label) {
  const cacheVersion = Number(/CACHE_NAME\s*=\s*"wordtap-v(\d+)"/.exec(text)?.[1] ?? 0);
  const courseManifestBranchIndex = text.indexOf("const isCourseManifest");
  const genericCacheFirstIndex = text.indexOf("caches.match(event.request).then");
  invariant(cacheVersion >= 4, `${label}: cache version must invalidate pre-manifest-fix caches`);
  invariant(
    /async function fetchAndCache[\s\S]*?await cache\.put\(request, response\.clone\(\)\)/.test(text),
    `${label}: cache writes must keep the Service Worker alive until completion`,
  );
  invariant(
    courseManifestBranchIndex >= 0 && courseManifestBranchIndex < genericCacheFirstIndex,
    `${label}: course manifests must be handled before the generic cache-first branch`,
  );
  invariant(
    /isCourseManifest[\s\S]*?fetchAndCache\(event\.request, \{ cache: "no-cache" \}\)[\s\S]*?\.catch\(\(\) => caches\.match\(event\.request\)\)/.test(text),
    `${label}: course manifests must use network-first no-cache with an offline cache fallback`,
  );
}

verifyServiceWorker(serviceWorker, path.relative(root, serviceWorkerPath));
const builtServiceWorkerPath = path.join(root, "dist", "sw.js");
verifyServiceWorker(await readFile(builtServiceWorkerPath, "utf8"), path.relative(root, builtServiceWorkerPath));

for (const dropdownName of ["PepEnglishDropdown.vue", "NceDropdown.vue", "ShuimuDropdown.vue", "PostgraduateDropdown.vue", "CollegeEnglishDropdown.vue", "CetDropdown.vue", "KaoyanEnglishDropdown.vue"]) {
  const dropdown = await readFile(path.join(root, "src", dropdownName), "utf8");
  invariant(!/\bfetch\s*\(/.test(dropdown), `${dropdownName}: Dropdowns must load course data through adapters`);
}

const manifestAdapterChecks = [
  ["pepEnglishLessons.ts", /pep-english\/manifest\.json", "no-cache"/],
  ["nceLessons.ts", /nce\/manifest\.json", "no-cache"/],
  ["shuimuLessons.ts", /shuimu\/manifest\.json"\), \{ cache: "no-cache" \}/],
  ["postgraduateLessons.ts", /postgraduate\/manifest\.json", "no-cache"/],
  ["collegeEnglishLessons.ts", /college-english\/manifest\.json", "no-cache"/],
  ["cetLessons.ts", /cet\/manifest\.json", "no-cache"/],
  ["kaoyanEnglishLessons.ts", /kaoyan-english\/manifest\.json", "no-cache"/],
];
for (const [fileName, pattern] of manifestAdapterChecks) {
  const adapter = await readFile(path.join(root, "src", "shared", "data", fileName), "utf8");
  invariant(pattern.test(adapter), `${fileName}: course manifest must explicitly use no-cache`);
}

const readingTokens = ["font-family", "font-size", "line-height"].map((suffix) => {
  const name = `--wordtap-reading-${suffix}`;
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(appStyles);
  invariant(match, `Homepage is missing the shared reading token ${name}`);
  return { name, value: match[1].trim() };
});

invariant(
  appStyles.includes("font-family: var(--wordtap-reading-font-family);")
    && appStyles.includes("font-size: var(--wordtap-reading-font-size);")
    && appStyles.includes("line-height: var(--wordtap-reading-line-height);"),
  "Homepage reader must consume all shared reading typography tokens",
);

invariant(new Set(prefixes).size === prefixes.length, "Lesson short-code prefixes must be unique");
invariant(
  protocolEntries.length === courseSpecs.length
    && courseSpecs.every(({ id }) => lessonShortCodeConfig[id]),
  "Short-code configuration must contain exactly the registered courses",
);
for (const [course, protocol] of protocolEntries) {
  invariant(/^[a-z]{1,3}$/.test(protocol.prefix), `${course}: invalid short-code prefix`);
  invariant(Number.isInteger(protocol.padding) && protocol.padding > 0, `${course}: invalid lesson-number padding`);
  invariant(Array.isArray(protocol.groups), `${course}: groups must be a list, not an alias mapping`);
  invariant(protocol.groups.length > 0 && new Set(protocol.groups).size === protocol.groups.length, `${course}: groups must be present and unique`);
  invariant(protocol.groups.every((group) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group)), `${course}: invalid lesson group`);
}

// Configuration errors must fail before a lesson using the new group exists.
// The protocol module performs these source-level assertions when imported;
// these probes also ensure malformed and ambiguous URL spellings stay rejected.
for (const invalidCode of ["pep:j7a-01", "pep:unknown-001", "nce:1-1", "sm:p-001", "pg:rwt-2a", "pg:rwt-002a", "pg:unknown-01"]) {
  invariant(parseLessonShortCode(invalidCode) === null, `${invalidCode}: invalid short code was accepted`);
}

const readabilityExamples = new Map([
  ["pep-english/pepj7a-001", "pep:j7a-001"],
  ["pep-english/pephr1-001", "pep:hr1-001"],
  ["nce/nce1-001", "nce:1-001"],
  ["shuimu/phonetics-001", "sm:pho-001"],
  ["shuimu/beginner-001", "sm:beg-001"],
  ["shuimu/intermediate-001", "sm:int-001"],
  ["shuimu/upper-001", "sm:upp-001"],
  ["postgraduate/volume1-01", "pg:v1-01"],
  ["postgraduate/reading-writing-translation-02a", "pg:rwt-02a"],
  ["college-english/rw1-u01-a", "ce:r1-u01-a"],
  ["cet/cet4-20180601", "cet:c4-20180601"],
  ["kaoyan-english/e1-1980", "ky:e1-1980"],
]);

for (const spec of courseSpecs) {
  const manifestPath = path.join(root, "public", spec.id, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const lessons = manifest[spec.collections].flatMap((collection) => collection.lessons);

  for (const lesson of lessons) {
    const compactId = compactLessonId(spec.id, lesson.id);
    const code = lessonShortCode(spec.id, lesson.id);
    const parsed = parseLessonShortCode(code);
    invariant(parsed?.course === spec.id && parsed.id === lesson.id, `${code}: short code does not round-trip to ${lesson.id}`);
    invariant(compactId.length <= lesson.id.length, `${spec.id}/${lesson.id}: compact lesson ID is longer than its source`);
    const sourceNumber = /-(\d+)[a-z]?$/.exec(lesson.id)?.[1];
    const compactNumber = /-(\d+)[a-z]?$/.exec(compactId)?.[1];
    invariant(compactNumber === sourceNumber, `${code}: compact code did not preserve the original number and leading zeroes`);
    const expectedReadableCode = readabilityExamples.get(`${spec.id}/${lesson.id}`);
    invariant(!expectedReadableCode || code === expectedReadableCode, `${code}: expected readable code ${expectedReadableCode}`);
    const owner = `${spec.id}/${lesson.id}`;
    invariant(!shortCodeOwners.has(code), `${code}: maps to both ${shortCodeOwners.get(code)} and ${owner}`);
    shortCodeOwners.set(code, owner);
    invariant(
      !lessonPathOwners.has(lesson.jsonPath),
      `${lesson.jsonPath}: is shared by both ${lessonPathOwners.get(lesson.jsonPath)} and ${owner}`,
    );
    lessonPathOwners.set(lesson.jsonPath, owner);

    const detailPath = path.join(root, "public", lesson.jsonPath);
    const detail = JSON.parse(await readFile(detailPath, "utf8"));
    invariant(detail.id === lesson.id, `${owner}: detail ID ${detail.id} does not match its manifest ID`);
    if (detail.jsonPath !== undefined) {
      invariant(detail.jsonPath === lesson.jsonPath, `${owner}: detail path ${detail.jsonPath} does not match its manifest path`);
    }

    const expectedHref = lessonToolHref(spec.id, lesson.id);
    const pagePath = path.join(root, "dist", spec.id, lesson.id, "index.html");
    const html = await readFile(pagePath, "utf8");
    invariant(
      html.includes(`<a class="tool-link" href="${expectedHref}">`),
      `${spec.id}/${lesson.id}: generated page does not use ${expectedHref}`,
    );
    for (const token of readingTokens) {
      invariant(
        html.includes(`${token.name}: ${token.value};`),
        `${spec.id}/${lesson.id}: reading typography differs from the homepage ${token.name}`,
      );
      invariant(
        html.split(`${token.name}:`).length === 2,
        `${spec.id}/${lesson.id}: reading typography token is overridden`,
      );
    }
    invariant(
      html.includes("font-size: var(--wordtap-reading-font-size);")
        && html.includes("line-height: var(--wordtap-reading-line-height);"),
      `${spec.id}/${lesson.id}: generated reading content does not consume the shared typography tokens`,
    );
    lessonCount += 1;
  }
}

const distTextFiles = await sourceFilesUnder(path.join(root, "dist"));

for (const distPath of distTextFiles) {
  const text = await readFile(distPath, "utf8");
  for (const token of forbiddenLongCodeTokens) {
    invariant(!new RegExp(`\\b${token}\\b`).test(text), `${path.relative(root, distPath)}: forbidden long-code token ${token}`);
  }
}

console.log(`Verified ${lessonCount} lesson pages and scanned ${distTextFiles.length} dist text files with one compact-code and reading-typography protocol.`);
