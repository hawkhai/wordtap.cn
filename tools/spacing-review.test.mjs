import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { analyzeText, displayFields, onlySpacesAdded, patchSource, scalarSpans, applyFile, scan, check, replay, recordReview, COURSES } from './spacing-review.mjs';

test('source-backed review blocks legacy writes and keeps scans read-only', t => {
  const { root, file } = fixture(t);
  applyFile(root, file); scan(root);
  const authority = path.join(root, 'content/article-review');
  fs.mkdirSync(authority, { recursive: true });
  // Even partial/missing ledgers must not reopen legacy write access.
  fs.writeFileSync(path.join(authority, 'events.jsonl'), 'signed evidence');
  const paths = [file, 'public/shuimu/manifest.json',
    'content/reading-layout/spacing-review-events.jsonl',
    'content/reading-layout/spacing-review-ledger.tsv', 'content/article-review/events.jsonl'];
  const before = paths.map(p => fs.readFileSync(path.join(root, p)));
  for (const operation of [() => applyFile(root, file), () => applyFile(root, file, {}),
    () => replay(root), () => replay(root, true), () => recordReview(root, file, {})]) {
    assert.throws(operation, /Source-backed article review/);
  }
  const rows = scan(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mode, 'read_only_candidates');
  assert.equal(rows[0].review_status, 'see_article_review_ledger');
  assert.throws(() => check(root, true), /Published article verification failed/);
  paths.forEach((p, i) => assert.deepEqual(fs.readFileSync(path.join(root, p)), before[i]));
});

test('requested bilingual, numeric, punctuation and phonetic examples', () => {
  const input = '听Freya朗读\n第1课\n2026年10月\nThank you!谢谢你！\nn.手提包\nbook[bʊk]书\n3M公司\n他有50%的股份';
  const expected = '听 Freya 朗读\n第 1 课\n2026 年 10 月\nThank you! 谢谢你！\nn. 手提包\nbook [bʊk] 书\n3M 公司\n他有 50% 的股份';
  assert.equal(analyzeText(input).result, expected);
  assert.equal(analyzeText(expected).insertions.length, 0);
  assert.ok(onlySpacesAdded(input, expected));
});

test('URLs, email, code, Windows paths, models, decimals and punctuation remain intact', () => {
  const input = 'https://example.com/中文A?q=1.2 test@example.com `第1课` C:\\课程1\\test.json\n3M 12.5% GPT-4 H.M.S. U.S.A.\n你好，World！';
  assert.equal(analyzeText(input).result, input);
});

test('OCR glyphs inside English words are reported and never blindly spaced', () => {
  const input = '10. A) People血erested m science\nImag皿 you are wande门ng about on a Thai island or the血ns of Angkor.\nThe following text is enterta血ng and there are other English words.';
  const result = analyzeText(input);
  assert.equal(result.result, input);
  assert.ok(result.issues.some(issue => issue.rule === 'possible_ocr'));
});

test('English punctuation is a review candidate, not an automatic word correction', () => {
  const input = 'This is a sentence.Next sentence.';
  assert.equal(analyzeText(input).result, input);
  assert.equal(analyzeText(input).issues[0].rule, 'possible_english_spacing');
});

test('vocabulary labels are not OCR; Chinese semicolons do not inherit an earlier English word', () => {
  const input = '• yes [jes] adv.是；是的\n• student [stju:dənt] n.学生\n• this [ðɪs] pron. 这，这个;这事，这人;这时;下面所说的事';
  assert.equal(analyzeText(input).result, input.replace('adv.是', 'adv. 是').replace('n.学生', 'n. 学生'));
});

test('non-display metadata is excluded', () => {
  assert.deepEqual(displayFields({ id: '课1', title: '第1课', source: { text: '第1课' }, audio: { title: '第1课' }, videos: [{ title: '中级24.3' }], blocks: [{ text: '听A说' }] }), [['/title', '第1课'], ['/blocks/0/text', '听A说']]);
});

test('patch preserves raw JSON format, escaped untouched strings and CRLF', () => {
  const source = '{\r\n\t"title" : "第1课", "untouched": "\\u4e2d", "blocks": [{"text":"A中文"}], "empty": [], "other": {}\r\n}\r\n';
  const result = patchSource(source, [{ pointer: '/title', before: '第1课', after: '第 1 课' }]);
  assert.equal(result, source.replace('第1课', '第 1 课'));
  assert.equal(scalarSpans(result).get('/blocks/0/text').value, 'A中文');
  assert.equal(patchSource(result, [{ pointer: '/title', before: '第1课', after: '第 1 课' }]), result);
  assert.throws(() => patchSource(source, [{ pointer: '/title', before: '第2课', after: '第 2 课' }]), /conflict/);
  assert.throws(() => patchSource(source, [{ pointer: '/title', before: '第1课', after: '第 2 课' }]), /insertion-only/);
  assert.ok(onlySpacesAdded('😀第1课', '😀第 1 课'));
  assert.ok(!onlySpacesAdded('a\nb', 'a b'));
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wordtap-spacing-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const course of COURSES) fs.mkdirSync(path.join(root, 'public', course, 'lessons'), { recursive: true });
  const file = 'public/shuimu/lessons/001.json';
  const detail = { id: 'test-001', title: '第1课', text: '听Freya朗读', characterCount: 8, blocks: [{ text: '听Freya朗读' }] };
  const manifest = { levels: [{ lessons: [{ id: detail.id, title: detail.title, characterCount: 8, jsonPath: file.slice(7) }] }] };
  const original = JSON.stringify(detail, null, 2) + '\r\n', originalManifest = JSON.stringify(manifest, null, 2) + '\r\n';
  fs.writeFileSync(path.join(root, file), original);
  fs.writeFileSync(path.join(root, 'public/shuimu/manifest.json'), originalManifest);
  return { root, file, original, originalManifest };
}

test('single-file apply syncs manifest and count, keeps review pending, replay is idempotent', t => {
  const { root, file, original, originalManifest } = fixture(t);
  scan(root);
  assert.equal(applyFile(root, file).inserted, 6);
  scan(root);
  assert.deepEqual(check(root), { files: 1, changed: 1, fullRead: 0, pending: 1 });
  assert.throws(() => check(root, true), /full reading pending/);
  assert.equal(applyFile(root, file).inserted, 0);
  assert.equal(replay(root).changed, 0);
  fs.writeFileSync(path.join(root, file), original);
  fs.writeFileSync(path.join(root, 'public/shuimu/manifest.json'), originalManifest);
  assert.equal(replay(root).changed, 2);
  scan(root); check(root);
});

test('replay conflicts do not partially write files', t => {
  const { root, file, original, originalManifest } = fixture(t);
  applyFile(root, file);
  fs.writeFileSync(path.join(root, file), original);
  const changedManifest = originalManifest.replace('第1课', '另一个标题');
  fs.writeFileSync(path.join(root, 'public/shuimu/manifest.json'), changedManifest);
  assert.throws(() => replay(root), /conflict/);
  assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), original);
});

test('write-ahead recovery resumes an interrupted article/manifest transaction', t => {
  const { root, file, originalManifest } = fixture(t);
  applyFile(root, file);
  const log = path.join(root, 'content/reading-layout/spacing-review-events.jsonl');
  const prepare = fs.readFileSync(log, 'utf8').trim().split('\n').filter(line => JSON.parse(line).kind !== 'commit');
  fs.writeFileSync(log, prepare.join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'public/shuimu/manifest.json'), originalManifest);
  assert.throws(() => scan(root), /Unfinished transaction/);
  assert.equal(replay(root, true).changed, 1);
  scan(root); check(root);
});

test('existing signed text cannot be silently changed', t => {
  const { root, file, original } = fixture(t);
  const detail = JSON.parse(original); detail.manualReview = { textSha256: 'old-signed-hash' };
  fs.writeFileSync(path.join(root, file), JSON.stringify(detail));
  assert.throws(() => applyFile(root, file), /signed content/);
});

test('manual decisions must preserve duplicate text and accept only the reviewed hash', t => {
  const { root, file } = fixture(t);
  const source = fs.readFileSync(path.join(root, file), 'utf8'), sha256 = crypto.createHash('sha256').update(source).digest('hex');
  const decision = { path: file, sha256, note: 'Read the whole example; insert after the Chinese verb', fields: [{ pointer: '/text', offsets: [1] }] };
  assert.throws(() => applyFile(root, file, { ...decision, sha256: 'stale' }), /mismatch/);
  assert.throws(() => applyFile(root, file, decision), /both text and blocks/);
  decision.fields.push({ pointer: '/blocks/0/text', offsets: [1] });
  assert.equal(applyFile(root, file, decision).inserted, 2);
  applyFile(root, file); // A second edit to the same fields exercises replay chains.
  assert.equal(replay(root).changed, 0);
  scan(root); check(root);
});

test('review evidence survives scans, and a changed file invalidates the attestation', t => {
  const { root, file } = fixture(t);
  applyFile(root, file); scan(root);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  recordReview(root, file, { sha256, status: 'edited', reviewer: 'test', note: 'Test fixture explicitly read' });
  scan(root); assert.equal(check(root, true).fullRead, 1);
  fs.appendFileSync(path.join(root, file), '\n');
  const rows = scan(root);
  assert.equal(rows[0].review_status, 'pending');
  assert.throws(() => check(root), /source changed/);
});

test('review issues must point to exact current display text', t => {
  const { root, file } = fixture(t);
  applyFile(root, file); scan(root);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const review = { sha256, status: 'needs_source_check', reviewer: 'test', note: 'Read the entire fixture', issues: [{ pointer: '/text', context: 'Freya', reason: 'Check spelling against source' }] };
  for (const issue of [
    { ...review.issues[0], context: 'absent' },
    { ...review.issues[0], offset: 0 },
    { ...review.issues[0], pointer: '/id' },
  ]) assert.throws(() => recordReview(root, file, { ...review, issues: [issue] }), /Review issue/);
  recordReview(root, file, review);
  scan(root); assert.equal(check(root, true).fullRead, 1);
  const log = path.join(root, 'content/reading-layout/spacing-review-events.jsonl');
  const event = JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n').at(-1));
  assert.equal(event.issues[0].offset, 2);
  fs.appendFileSync(log, JSON.stringify({ ...event, issues: [{ ...event.issues[0], offset: 0 }] }) + '\n');
  assert.throws(() => check(root), /Review issue context mismatch/);
});
