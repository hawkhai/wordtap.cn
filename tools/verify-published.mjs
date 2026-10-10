import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const courses = read('content/release/courses.json');
const vocabulary = read('content/release/vocabulary.json');
const pending = read('content/release/pending-source-checks.json');
const issues = read('content/release/vocabulary-issues.json');
const updateHashes = process.argv.includes('--update-hashes');

function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${prefix}${entry.name}`);
    const relative = prefix + entry.name;
    return entry.isDirectory() ? files(path.join(directory, entry.name), relative + '/') : [relative];
  }).sort();
}

assert.match(courses.sourceCommit, /^[a-f\d]{40}$/);
assert.match(vocabulary.commit, /^[a-f\d]{40}$/);
assert.equal(pending.sourceCommit, courses.sourceCommit);
assert.equal(issues.commit, vocabulary.commit);
assert.equal(pending.articles.length, courses.pending);
const actualCourses = {};
const actualVocabulary = {};
const publishedPaths = new Set();
const pendingPaths = new Set();
let totalLessons = 0;
for (const [course, expectedCount] of [...Object.entries(courses.courses), ['english-vocabulary', 5860]]) {
  const directory = `public/${course}/`;
  const manifest = read(directory + 'manifest.json');
  assert.equal(manifest.schemaVersion, course === 'college-english' ? 2 : 1, `${course}: manifest schema`);
  const collections = manifest.groups ?? manifest.books ?? manifest.levels ?? manifest.volumes;
  assert.ok(Array.isArray(collections) && collections.length, `${course}: empty catalog`);
  assert.equal(new Set(collections.map(group => group.id)).size, collections.length, `${course}: duplicate group`);
  const lessonPaths = [];
  const identities = new Set();
  let count = 0;
  let wordCount = 0;
  for (const group of collections) {
    assert.equal(group.lessons.length, group.lessonCount, `${course}/${group.id}: count`);
    let groupWords = 0;
    const index = group.indexPath ? read('public/' + group.indexPath) : null;
    if (index) {
      assert.ok(group.indexPath.startsWith(course + '/indexes/'), 'Index must belong to its course');
      assert.equal(index.groupId, group.id);
      assert.equal(index.lessons.length, group.lessons.length);
    }
    for (const [number, lesson] of group.lessons.entries()) {
      const file = 'public/' + lesson.jsonPath;
      assert.ok(lesson.jsonPath.startsWith(course + '/lessons/'), `${course}: invalid detail path`);
      assert.ok(!lesson.jsonPath.split('/').some(segment => segment === '..' || segment === '.'), 'Unsafe detail path');
      assert.ok(!identities.has(lesson.id) && !publishedPaths.has(file), `Duplicate lesson: ${file}`);
      identities.add(lesson.id); publishedPaths.add(file); lessonPaths.push(file);
      const detail = read(file);
      assert.equal(detail.schemaVersion, course === 'college-english' ? 2 : 1, `${file}: schema`);
      assert.equal(detail.id, lesson.id, `${file}: identity`);
      assert.equal(detail.groupId ?? detail.bookId ?? detail.levelId ?? detail.volumeId, group.id, `${file}: group`);
      if (detail.jsonPath !== undefined) assert.equal(detail.jsonPath, lesson.jsonPath);
      assert.ok(typeof detail.title === 'string' && detail.title.length, `${file}: missing title`);
      assert.ok(typeof detail.text === 'string' && detail.text.trim().length, `${file}: missing text`);
      if (detail.blocks) assert.equal(detail.text, detail.blocks.map(block => block.text).join('\n'), `${file}: text/blocks`);
      if (detail.characterCount !== undefined) assert.equal(detail.characterCount, detail.text.length);
      if (course === 'english-vocabulary') {
        assert.equal(detail.entries.length, lesson.wordCount);
        assert.equal(detail.wordCount, lesson.wordCount);
        assert.equal(detail.unitNo, number + 1);
        assert.equal(detail.source.commit, vocabulary.commit);
        assert.equal(detail.source.lineStart, number * 20 + 1);
        assert.equal(detail.source.lineEnd, number * 20 + detail.wordCount);
        assert.deepEqual(index.lessons[number], { id: detail.id, words: detail.entries.map(entry => entry.word) });
        assert.equal(detail.typingText, detail.entries.flatMap(entry => {
          const sentences = (entry.sentences ?? []).filter(item => /[A-Za-z]/.test(item.sentence)).map(item => item.sentence);
          return sentences.length ? sentences : [entry.word];
        }).join('\n\n'));
        groupWords += detail.wordCount;
      }
      count++;
    }
    if (course === 'english-vocabulary') {
      assert.equal(groupWords, group.wordCount);
      assert.equal(group.lessonCount, Math.ceil(groupWords / 20));
      wordCount += groupWords;
    }
  }
  assert.equal(count, expectedCount, `${course}: published count`);
  assert.equal(count, manifest.totalLessons, `${course}: manifest total`);
  const courseFiles = files(path.join(root, directory));
  assert.deepEqual(courseFiles.filter(file => file.startsWith('lessons/')).map(file => directory + file), lessonPaths.sort(), `${course}: stale or missing details`);
  for (const relative of courseFiles) {
    const hash = createHash('sha256').update(readFileSync(path.join(root, directory, relative))).digest('hex');
    if (course === 'english-vocabulary') actualVocabulary[relative] = hash;
    else actualCourses[directory + relative] = hash;
  }
  if (course === 'english-vocabulary') {
    assert.equal(collections.length, 23);
    assert.equal(wordCount, 116953);
    assert.equal(wordCount, manifest.totalWords);
    assert.equal(manifest.source.commit, vocabulary.commit);
    assert.equal(manifest.knownIssueCount, issues.issues.length);
    assert.equal(issues.issues.length, 16);
  } else totalLessons += count;
}
for (const article of pending.articles) {
  assert.equal(article.status, 'needs_source_check');
  assert.ok(courses.courses[article.course] && publishedPaths.has(article.path));
  assert.equal(read(article.path).id, article.id);
  assert.ok(!pendingPaths.has(article.path), `Duplicate pending identity: ${article.path}`);
  pendingPaths.add(article.path);
}
if (updateHashes) {
  // Explicit contribution action: counts, provenance and limitations are never rewritten automatically.
  courses.files = actualCourses; vocabulary.files = actualVocabulary;
  for (const [name, snapshot] of [['courses', courses], ['vocabulary', vocabulary]]) {
    writeFileSync(path.join(root, `content/release/${name}.json`), JSON.stringify(snapshot, null, 2) + '\n');
  }
  console.log('Updated published-file hashes. Review the snapshot diff before committing.');
} else {
  for (const [actual, expected] of [[actualCourses, courses.files], [actualVocabulary, vocabulary.files]]) {
    assert.equal(Object.keys(actual).sort().join('\n'), Object.keys(expected).sort().join('\n'), 'Published file set differs');
    for (const [file, hash] of Object.entries(actual)) assert.equal(hash, expected[file], `Published bytes differ: ${file}`);
  }
}
console.log(`Verified ${totalLessons} course lessons; 23 vocabularies, 116953 words, 5860 units. ${pending.articles.length} articles await source confirmation; ${issues.issues.length} vocabulary source issues remain. This is a publication check, not historical review.`);
