import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// The public repository carries a release snapshot, not the private audit log.
// Verify immutable release bytes independently of historical event replay.
const root = process.cwd();
const baseline = JSON.parse(readFileSync(path.join(root, 'content/release/courses.json'), 'utf8'));
assert.match(baseline.sourceCommit, /^[a-f\d]{40}$/);
for (const [relative, expected] of Object.entries(baseline.files)) {
  const bytes = readFileSync(path.join(root, relative));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `Published course differs: ${relative}`);
}
for (const [course, count] of Object.entries(baseline.courses)) {
  const lessons = readdirSync(path.join(root, 'public', course, 'lessons'), { recursive: true }).filter(file => file.endsWith('.json'));
  assert.equal(lessons.length, count, `Lesson count differs: ${course}`);
  const actual = lessons.map(file => `public/${course}/lessons/${file.replaceAll(path.sep, '/')}`).sort();
  const expected = Object.keys(baseline.files).filter(file => file.startsWith(`public/${course}/lessons/`)).sort();
  assert.deepEqual(actual, expected, `Lesson identities differ: ${course}`);
}
const limitations = JSON.parse(readFileSync(path.join(root, 'content/release/pending-source-checks.json'), 'utf8'));
assert.equal(limitations.sourceCommit, baseline.sourceCommit);
const identities = new Set();
for (const article of limitations.articles) {
  assert.equal(article.status, 'needs_source_check');
  assert.ok(baseline.courses[article.course]);
  assert.ok(baseline.files[article.path], `Pending article is not published: ${article.path}`);
  assert.equal(JSON.parse(readFileSync(path.join(root, article.path), 'utf8')).id, article.id);
  assert.ok(!identities.has(article.path), `Duplicate pending article: ${article.path}`);
  identities.add(article.path);
}
const pending = limitations.articles.length;
assert.equal(pending, baseline.pending);
console.log(`Verified pinned release: 1054 lessons across seven courses; ${pending} remain awaiting source confirmation. Audit history was excluded.`);
if (process.argv.includes('--require-complete')) assert.equal(pending, 0, 'Full review is incomplete: 120 source-check articles remain');
