import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// The public repository carries a release snapshot, not the private audit log.
// Verify immutable release bytes independently of historical event replay.
const root = process.cwd();
const baseline = JSON.parse(readFileSync(path.join(root, 'content/web-sync/course-publication.json'), 'utf8'));
assert.equal(baseline.sourceCommit, '7bb26c968179681b83676c74696cf66560d31b56');
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
const ledger = readFileSync(path.join(root, 'content/article-review/ledger.tsv'), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const columns = ledger.shift().split('\t');
const status = columns.indexOf('status');
assert.ok(status >= 0);
assert.equal(ledger.length, 1054);
const pending = ledger.filter(row => row.split('\t')[status] === 'needs_source_check').length;
assert.equal(pending, baseline.pending);
console.log(`Verified pinned release: 1054 lessons across seven courses; ${pending} remain awaiting source confirmation. Audit history was excluded.`);
if (process.argv.includes('--require-complete')) assert.equal(pending, 0, 'Full review is incomplete: 120 source-check articles remain');
