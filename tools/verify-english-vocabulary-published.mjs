import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Publication checks need only committed artifacts; source reconstruction belongs to the full project.
const root = process.cwd();
const directory = path.join(root, "public/english-vocabulary");
const baseline = JSON.parse(readFileSync(path.join(root, "content/release/vocabulary.json"), "utf8"));
const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
assert.match(baseline.commit, /^[a-f\d]{40}$/);
assert.equal(manifest.source.commit, baseline.commit);
assert.equal(manifest.groups.length, 23);
assert.equal(manifest.totalWords, 116953);
assert.equal(manifest.totalLessons, 5860);
function files(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${relative}`);
    return entry.isDirectory() ? files(path.join(dir, entry.name), relative + "/") : [relative];
  });
}
assert.deepEqual(files(directory).sort(), Object.keys(baseline.files).sort(), "Missing or stale vocabulary artifacts");
for (const [relative, expected] of Object.entries(baseline.files)) {
  assert.equal(createHash("sha256").update(readFileSync(path.join(directory, relative))).digest("hex"), expected,
    `Published vocabulary differs from the pinned baseline: ${relative}`);
}
assert.ok(readFileSync(path.join(directory, "LICENSE.txt"), 'utf8').includes('Redistribution'));
const issues = JSON.parse(readFileSync(path.join(root, "content/release/vocabulary-issues.json"), "utf8"));
assert.equal(issues.commit, baseline.commit);
assert.equal(issues.issues.length, 16);
console.log(`Verified ${Object.keys(baseline.files).length} pinned vocabulary artifacts; 23 books, 116953 words, 5860 units, 16 retained source issues.`);
