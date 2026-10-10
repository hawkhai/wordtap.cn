import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const VERSION = '1.2.0';
export const COURSES = ['shuimu', 'postgraduate', 'cet', 'kaoyan-english', 'nce', 'pep-english', 'college-english'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRECTORY = 'content/reading-layout';
const LEDGER = `${DIRECTORY}/spacing-review-ledger.tsv`;
const EVENTS = `${DIRECTORY}/spacing-review-events.jsonl`;
const journalCache = new Map();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const han = (c) => /\p{Script=Han}/u.test(c || '');
const latinDigit = (c) => /[A-Za-z0-9]/.test(c || '');
const columns = ['path', 'course', 'id', 'title', 'rule_version', 'candidate_count', 'inserted_spaces', 'implementation_status', 'review_status', 'validation', 'reviewer', 'reviewed_at', 'before_sha256', 'after_sha256', 'remaining_issue_count', 'notes'];

// The later, source-backed review owns published text and its revision history.
// Keep the older spacing journal as evidence, never rebase it onto new prose.
function hasArticleReview(root) {
  const directory = path.join(root, 'content/article-review');
  return ['ledger.tsv', 'events.jsonl', 'revisions'].some(name => fs.existsSync(path.join(directory, name)));
}
function requireLegacyWorkflow(root) {
  if (hasArticleReview(root)) throw new Error('Source-backed article review owns this content; use tools/review-articles.py and the course generator. Legacy spacing writes/replay are disabled.');
}
function checkPublishedArticles(root, requireComplete) {
  const result = spawnSync(process.env.PYTHON || 'python', ['-X', 'utf8', path.join(root, 'tools/review-articles.py'), 'verify-published', ...(requireComplete ? ['--require-complete'] : [])], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Published article verification failed: ${(result.stderr || result.stdout).trim()}`);
  return { authority: 'content/article-review', verification: result.stdout.trim() };
}

// Only values used as article display text. Never traverse source/audio/videos metadata.
export function displayFields(detail) {
  const fields = [];
  for (const key of ['title', 'titleZh', 'question', 'questionZh', 'text', 'bodyText', 'bodyTextZh', 'unitTitle', 'theme', 'author', 'section', 'textLabel']) {
    if (typeof detail[key] === 'string') fields.push([`/${key}`, detail[key]]);
  }
  for (const [i, block] of (detail.blocks || []).entries()) {
    if (typeof block.text === 'string') fields.push([`/blocks/${i}/text`, block.text]);
  }
  for (const [i, sentence] of (detail.sentences || []).entries()) {
    for (const language of ['en', 'zh']) if (typeof sentence[language] === 'string') fields.push([`/sentences/${i}/${language}`, sentence[language]]);
  }
  return fields;
}

export function analyzeText(text, course = '') {
  const insertions = new Map(), issues = [];
  const protectedRanges = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|`[^`\n]*`|[A-Za-z]:\\[^\s]+/gu)].map(m => [m.index, m.index + m[0].length]);
  const protectedAt = (index) => protectedRanges.some(([a, b]) => index >= a && index <= b);
  let start = 0;
  for (const line of text.split('\n')) {
    const chinese = [...line.matchAll(/\p{Script=Han}/gu)];
    const englishWords = [...line.matchAll(/[A-Za-z]{2,}/g)];
    const vocabularyLine = /^\s*(?:[•◦▪▫▶➢◆-]\s*)?[A-Za-z][A-Za-z'’ .-]*\s*\[[^\]\n]+\]/u.test(line);
    // A stray CJK glyph in an English OCR line is not a bilingual phrase.
    const corruptControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(line);
    const suspicious = corruptControl || (!vocabularyLine && chinese.length > 0 && chinese.length <= 3 && englishWords.length >= 4 && !/\p{Script=Han}{2}/u.test(line));
    if (corruptControl) issues.push({ offset: start, rule: 'possible_ocr_control', context: line.slice(0, 180), reason: '原文控制字符或替换字符；整行保留待查' });
    const suspectRanges = [];
    for (const m of line.matchAll(/\p{Script=Han}+/gu)) {
      const nearby = line.slice(Math.max(0, m.index - 45), m.index + m[0].length + 45);
      const embedded = m[0].length <= 2 && /[A-Za-z]/.test(line[m.index - 1] || '') && /[A-Za-z]/.test(line[m.index + m[0].length] || '');
      if (suspicious || (!vocabularyLine && (embedded || (m[0].length <= 2 && !/\p{Script=Han}{3}/u.test(nearby) && (nearby.match(/[A-Za-z]{2,}/g) || []).length >= 3)))) {
        suspectRanges.push([m.index, m.index + m[0].length]);
        issues.push({ offset: start + m.index, rule: 'possible_ocr', context: nearby, reason: '英文上下文中孤立汉字，保留原文待核对来源' });
      }
    }
    for (let i = 1; i < line.length; i++) {
      const left = line[i - 1], right = line[i], offset = start + i;
      let rule;
      if ((han(left) && latinDigit(right)) || (latinDigit(left) && han(right))) rule = /[0-9]/.test(left + right) ? 'han_number' : 'han_latin';
      if (han(right) && /(?:[A-Za-z][.!?;:]|[A-Za-z]\.\.\.)$/.test(line.slice(0, i))) rule = 'latin_punctuation_han';
      if (han(right) && left === '%' && /\d%$/.test(line.slice(0, i))) rule = 'percent_han';
      if (rule && !suspicious && !suspectRanges.some(([a, b]) => i >= a && i <= b) && !protectedAt(offset)) {
        if (course === 'cet' && rule === 'han_latin') issues.push({ offset, rule: 'cet_mixed_boundary', context: line.slice(Math.max(0, i - 40), i + 40), reason: '四六级混入字形较多，中英边界需核对后单独应用' });
        else insertions.set(offset, rule);
      }
    }
    // Brackets are interpreted as phonetics only in a vocabulary-shaped line.
    for (const m of line.matchAll(/\b([A-Za-z][A-Za-z'-]*)\s*(\[[^\]\n]{1,70}\])/g)) {
      const contents = m[2].slice(1, -1);
      const phonetic = /^[\p{L}\sˈˌ:ːˑəɜɪʊæɑɔθðʃʒŋʌɒɡʧʤ()'’.-]+$/u.test(contents) && !/\p{Script=Han}/u.test(contents);
      const end = m.index + m[0].length;
      if (phonetic && /\p{Script=Han}/u.test(line.slice(end)) && !suspicious) {
        const opening = m.index + m[0].indexOf('[');
        if (opening === m.index + m[1].length && !protectedAt(start + opening)) insertions.set(start + opening, 'word_phonetic');
        if (han(line[end]) && !protectedAt(start + end)) insertions.set(start + end, 'phonetic_han');
      }
    }
    for (const m of line.matchAll(/[a-z][.!?][A-Z][a-z]/g)) {
      const offset = start + m.index + 2;
      if (!protectedAt(offset)) issues.push({ offset, rule: 'possible_english_spacing', context: line.slice(Math.max(0, m.index - 40), m.index + 70), reason: '英文标点或缩写边界需要逐处判断' });
    }
    start += line.length + 1;
  }
  const additions = [...insertions].sort(([a], [b]) => a - b).map(([offset, rule]) => ({ offset, rule, before: text.slice(Math.max(0, offset - 28), offset + 28), reason: '展示文本中明确的字种、数字、标点或词表音标边界' }));
  let result = text;
  for (const { offset } of additions.toReversed()) result = result.slice(0, offset) + ' ' + result.slice(offset);
  return { result, insertions: additions, issues };
}

export function analyze(detail, course = '') {
  const changes = [], issues = [];
  for (const [pointer, value] of displayFields(detail)) {
    const result = analyzeText(value, course);
    if (result.result !== value) changes.push({ pointer, before: value, after: result.result, insertions: result.insertions });
    issues.push(...result.issues.map(issue => ({ pointer, ...issue })));
  }
  return { changes, issues };
}

// Locate JSON scalar tokens so whitespace, key ordering, escapes in untouched
// fields, CRLF and final newline survive an edit. JSON.parse validates first.
export function scalarSpans(source) {
  JSON.parse(source);
  const spans = new Map(); let i = 0;
  const whitespace = () => { while (/\s/.test(source[i] || '') && i < source.length) i++; };
  const stringEnd = () => { i++; while (i < source.length) { if (source[i] === '\\') i += 2; else if (source[i++] === '"') break; } };
  function visit(pointer) {
    whitespace();
    if (source[i] === '{') {
      i++; whitespace();
      while (source[i] !== '}') {
        const begin = i; stringEnd(); const key = JSON.parse(source.slice(begin, i));
        whitespace(); i++; visit(`${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`); whitespace();
        if (source[i] !== ',') break;
        i++; whitespace();
      }
      i++; return;
    }
    if (source[i] === '[') {
      i++; whitespace(); let index = 0;
      while (source[i] !== ']') {
        visit(`${pointer}/${index++}`); whitespace(); if (source[i] !== ',') break;
        i++; whitespace();
      }
      i++; return;
    }
    const begin = i;
    if (source[i] === '"') stringEnd(); else while (i < source.length && !/[\s,}\]]/.test(source[i])) i++;
    spans.set(pointer, { begin, end: i, value: JSON.parse(source.slice(begin, i)) });
  }
  visit(''); return spans;
}

export function patchSource(source, changes) {
  const spans = scalarSpans(source), patches = [];
  for (const { pointer, before, after } of changes) {
    const span = spans.get(pointer);
    if (!span) throw new Error(`Missing JSON pointer: ${pointer}`);
    if (span.value === after) continue;
    if (span.value !== before) throw new Error(`Source conflict at ${pointer}`);
    if (typeof before === 'string' && !onlySpacesAdded(before, after)) throw new Error(`Not an insertion-only edit: ${pointer}`);
    patches.push({ ...span, replacement: JSON.stringify(after) });
  }
  for (const patch of patches.sort((a, b) => b.begin - a.begin)) source = source.slice(0, patch.begin) + patch.replacement + source.slice(patch.end);
  JSON.parse(source); return source;
}

export function onlySpacesAdded(before, after) {
  const original = [...before];
  let i = 0;
  for (const c of after) { if (c === original[i]) i++; else if (c !== ' ') return false; }
  return i === original.length;
}

function files(root) {
  return COURSES.flatMap(course => fs.readdirSync(path.join(root, 'public', course, 'lessons'), { recursive: true })
    .filter(file => file.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en'))
    .map(file => `public/${course}/lessons/${file.replaceAll(path.sep, '/')}`));
}
function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function atomicWrite(root, file, source) {
  const target = path.join(root, file), temporary = `${target}.spacing-tmp`;
  fs.writeFileSync(temporary, source, 'utf8'); fs.renameSync(temporary, target);
}
function journal(root) {
  if (!fs.existsSync(path.join(root, EVENTS))) return [];
  const stamp = fs.statSync(path.join(root, EVENTS)), cached = journalCache.get(root);
  if (cached?.size === stamp.size && cached?.modified === stamp.mtimeMs) return cached.events;
  const events = read(root, EVENTS).trim().split('\n').filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`Invalid journal line ${i + 1}; restore the partial final line before continuing`); }
  });
  journalCache.set(root, { size: stamp.size, modified: stamp.mtimeMs, events });
  return events;
}
function append(root, event) {
  fs.mkdirSync(path.join(root, DIRECTORY), { recursive: true });
  const previous = journal(root), record = { at: new Date().toISOString(), version: VERSION, ...event };
  fs.appendFileSync(path.join(root, EVENTS), JSON.stringify(record) + '\n');
  previous.push(record);
  const stamp = fs.statSync(path.join(root, EVENTS));
  journalCache.set(root, { size: stamp.size, modified: stamp.mtimeMs, events: previous });
}
function transactions(events) {
  const completed = new Set(events.filter(e => e.kind === 'commit').map(e => e.transaction));
  const reverted = new Set(events.filter(e => e.kind === 'rollback').map(e => e.transaction));
  return events.filter(e => e.kind === 'prepare' && completed.has(e.transaction) && !reverted.has(e.transaction));
}
function ensureNoPending(events) {
  const completed = new Set(events.filter(e => e.kind === 'commit').map(e => e.transaction));
  if (events.some(e => e.kind === 'prepare' && !completed.has(e.transaction))) throw new Error('Unfinished transaction; run recover before continuing');
}
function manifestChanges(root, file, detail, changedKeys = null) {
  const manifestPath = `public/${file.split('/')[1]}/manifest.json`, source = read(root, manifestPath);
  const spans = scalarSpans(source), changes = [];
  const identity = [...spans].find(([pointer, span]) => pointer.endsWith('/jsonPath') && span.value === file.slice('public/'.length));
  if (!identity) throw new Error(`No manifest entry: ${file}`);
  const parent = identity[0].slice(0, -'/jsonPath'.length);
  for (const key of ['title', 'titleZh', 'question', 'questionZh', 'unitTitle', 'theme', 'author', 'section', 'textLabel', 'characterCount']) {
    if (changedKeys && !changedKeys.has(key)) continue;
    const pointer = `${parent}/${key}`, existing = spans.get(pointer);
    if (existing && detail[key] !== undefined && existing.value !== detail[key]) {
      const baseline = { 'phonetics-002': ['第一课 ：语音基础知识', '第一课：语音基础知识'], 'phonetics-012': ['第十一课 ：6 个单辅音', '第十一课：6 个单辅音'], 'pepj9-011': ['Could You Please ...?', 'Could You Please...?'] }[detail.id];
      if (key === 'title' && baseline && baseline[0] === existing.value && baseline[1] === detail[key]) continue;
      changes.push({ pointer, before: existing.value, after: detail[key] });
    }
  }
  return { path: manifestPath, beforeSha256: hash(source), afterSha256: hash(patchSource(source, changes)), changes };
}

export function applyFile(root, file, decisions = null) {
  requireLegacyWorkflow(root);
  if (!files(root).includes(file)) throw new Error('Expected a known article path');
  const events = journal(root); ensureNoPending(events);
  const source = read(root, file), detail = JSON.parse(source), audit = analyze(detail, file.split('/')[1]);
  if (decisions) {
    const fields = new Map(displayFields(detail));
    if (decisions.path !== file || decisions.sha256 !== hash(source) || !decisions.note) throw new Error('Manual decision path/hash/note mismatch');
    if (new Set(decisions.fields.map(f => f.pointer)).size !== decisions.fields.length) throw new Error('Duplicate decision pointer');
    audit.changes = decisions.fields.map(item => {
      const before = fields.get(item.pointer);
      if (typeof before !== 'string' || !Array.isArray(item.offsets) || !item.offsets.length) throw new Error('Invalid display-field decision');
      const offsets = [...new Set(item.offsets)].sort((a, b) => a - b);
      if (offsets.some(i => !Number.isInteger(i) || i <= 0 || i >= before.length || /\s/u.test(before[i]) || /\s/u.test(before[i - 1]))) throw new Error('Invalid insertion offset');
      let after = before;
      for (const offset of offsets.toReversed()) after = after.slice(0, offset) + ' ' + after.slice(offset);
      return { pointer: item.pointer, before, after, insertions: offsets.map(offset => ({ offset, rule: 'reviewed_context', before: before.slice(Math.max(0, offset - 28), offset + 28), reason: decisions.note })) };
    });
  }
  if (!audit.changes.length) return { path: file, inserted: 0, issues: audit.issues.length };
  if (detail.manualReview?.textSha256 && audit.changes.some(c => c.pointer === '/text' || c.pointer.startsWith('/blocks/'))) throw new Error(`${file}: signed content must be updated through its existing source review workflow`);
  let next = patchSource(source, audit.changes), updated = JSON.parse(next);
  if (typeof detail.characterCount === 'number' && updated.text !== detail.text) {
    const change = { pointer: '/characterCount', before: detail.characterCount, after: detail.characterCount + updated.text.length - detail.text.length };
    audit.changes.push(change); next = patchSource(next, [change]); updated = JSON.parse(next);
  }
  if (detail.blocks && detail.text === detail.blocks.map(b => b.text).join('\n') && updated.text !== updated.blocks.map(b => b.text).join('\n')) throw new Error('Decision must update both text and blocks');
  if (detail.sentences) for (const [key, language] of [['bodyText', 'en'], ['bodyTextZh', 'zh']]) {
    if (detail[key] === detail.sentences.filter(s => s.role === 'body').map(s => s[language]).join('\n').trim() && updated[key] !== updated.sentences.filter(s => s.role === 'body').map(s => s[language]).join('\n').trim()) throw new Error(`Decision must update ${key} and sentences`);
  }
  const linked = manifestChanges(root, file, updated, new Set(audit.changes.map(c => c.pointer.slice(1))));
  const transaction = crypto.randomUUID();
  const event = { kind: 'prepare', transaction, path: file, rationale: decisions ? decisions.note : 'approved spacing rules; automated application, full reading separately attested', files: [{ path: file, beforeSha256: hash(source), afterSha256: hash(next), changes: audit.changes }, ...(linked.changes.length ? [linked] : [])], issues: audit.issues };
  // Journal first. recover can finish either side of an interrupted two-file write.
  append(root, event);
  for (const entry of event.files) atomicWrite(root, entry.path, patchSource(read(root, entry.path), entry.changes));
  append(root, { kind: 'commit', transaction });
  return { path: file, inserted: audit.changes.reduce((sum, c) => sum + (c.insertions?.length || 0), 0), issues: audit.issues.length };
}

export function scan(root = ROOT) {
  if (hasArticleReview(root)) {
    // Suggestions only: do not append attestations or overwrite the old ledger.
    return files(root).map(file => {
      const detail = JSON.parse(read(root, file)), audit = analyze(detail, file.split('/')[1]);
      return { path: file, mode: 'read_only_candidates', authority: 'content/article-review',
        candidate_count: audit.changes.reduce((n, c) => n + c.insertions.length, 0),
        remaining_issue_count: audit.issues.length, review_status: 'see_article_review_ledger' };
    });
  }
  const events = journal(root); ensureNoPending(events);
  const edits = transactions(events), rows = [];
  for (const file of files(root)) {
    const source = read(root, file), detail = JSON.parse(source), sha = hash(source), audit = analyze(detail, file.split('/')[1]);
    if (!events.some(e => e.kind === 'audit' && e.path === file && e.sha256 === sha && e.version === VERSION)) {
      append(root, { kind: 'audit', path: file, sha256: sha, candidateCount: audit.changes.reduce((n, c) => n + c.insertions.length, 0), issues: audit.issues, fullRead: false });
    }
    const history = edits.filter(e => e.path === file), latest = history.at(-1)?.files[0];
    const review = events.filter(e => e.kind === 'review' && e.path === file && e.sha256 === sha && e.version === VERSION).at(-1);
    const inserted = history.reduce((sum, e) => sum + e.files[0].changes.reduce((n, c) => n + (c.insertions?.length || 0), 0), 0);
    rows.push({ path: file, course: file.split('/')[1], id: detail.id, title: detail.title, rule_version: VERSION,
      candidate_count: audit.changes.reduce((n, c) => n + c.insertions.length, 0), inserted_spaces: inserted,
      implementation_status: latest ? (latest.afterSha256 === sha ? 'applied' : 'source_changed') : 'scanned',
      review_status: review ? review.status : 'pending', validation: latest && latest.afterSha256 !== sha ? 'source_changed' : 'json_valid',
      reviewer: review?.reviewer || '', reviewed_at: review?.at || '', before_sha256: history[0]?.files[0].beforeSha256 || sha,
      after_sha256: sha, remaining_issue_count: (review?.resolvedFindings ? 0 : audit.issues.length) + (review?.issues?.length || 0), notes: review?.note || '规则扫描不等于全文复核；待逐篇完整阅读' });
  }
  fs.mkdirSync(path.join(root, DIRECTORY), { recursive: true });
  const clean = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ');
  atomicWrite(root, LEDGER, [columns.join('\t'), ...rows.map(row => columns.map(key => clean(row[key])).join('\t'))].join('\n') + '\n');
  return rows;
}

export function replay(root = ROOT, recover = false) {
  requireLegacyWorkflow(root);
  const events = journal(root), committed = new Set(events.filter(e => e.kind === 'commit').map(e => e.transaction));
  const selected = recover ? events.filter(e => e.kind === 'prepare' && !committed.has(e.transaction)) : transactions(events);
  // Preflight all changes in memory; a conflict leaves every public file untouched.
  const staged = new Map(), chains = new Map();
  for (const event of selected) for (const entry of event.files) {
    const fields = chains.get(entry.path) ?? new Map(); chains.set(entry.path, fields);
    for (const change of entry.changes) {
      const chain = fields.get(change.pointer) ?? [change.before];
      if (chain.at(-1) !== change.before) throw new Error(`Broken replay chain: ${entry.path}${change.pointer}`);
      chain.push(change.after); fields.set(change.pointer, chain);
    }
  }
  for (const [file, fields] of chains) {
    const source = read(root, file), spans = scalarSpans(source), changes = [];
    for (const [pointer, chain] of fields) {
      const current = spans.get(pointer)?.value;
      if (!chain.includes(current)) throw new Error(`Source conflict: ${file}${pointer}`);
      changes.push({ pointer, before: current, after: chain.at(-1) });
    }
    staged.set(file, patchSource(source, changes));
  }
  let changed = 0;
  for (const [file, source] of staged) if (read(root, file) !== source) { atomicWrite(root, file, source); changed++; }
  if (recover) for (const event of selected) append(root, { kind: 'commit', transaction: event.transaction, recovered: true });
  return { changed };
}

export function check(root = ROOT, requireComplete = false) {
  if (hasArticleReview(root)) return checkPublishedArticles(root, requireComplete);
  const events = journal(root); ensureNoPending(events);
  const reviews = new Map(events.filter(e => e.kind === 'review').map(e => [e.path, e]));
  const rows = read(root, LEDGER).trimEnd().split('\n').slice(1).map(line => Object.fromEntries(columns.map((key, i) => [key, line.split('\t')[i]])));
  const actual = files(root), errors = [];
  if (new Set(rows.map(r => r.path)).size !== actual.length || rows.length !== actual.length || actual.some(f => !rows.some(r => r.path === f))) errors.push('Ledger coverage mismatch');
  for (const row of rows) {
    const source = read(root, row.path), detail = JSON.parse(source);
    if (hash(source) !== row.after_sha256) errors.push(`${row.path}: stale ledger hash`);
    if (row.implementation_status === 'source_changed') errors.push(`${row.path}: source changed after application`);
    if (row.review_status !== 'pending' && !events.some(e => e.kind === 'review' && e.path === row.path && e.sha256 === hash(source) && e.status === row.review_status)) errors.push(`${row.path}: missing review evidence`);
    if (requireComplete && !['edited', 'passed', 'needs_source_check'].includes(row.review_status)) errors.push(`${row.path}: full reading pending`);
    const review = reviews.get(row.path);
    if (row.review_status !== 'pending' && review?.sha256 === hash(source)) {
      try { locateReviewIssues(detail, review.issues ?? []); }
      catch (error) { errors.push(`${row.path}: ${error.message}`); }
    }
    if (detail.blocks && detail.text !== detail.blocks.map(b => b.text).join('\n')) errors.push(`${row.path}: text/blocks mismatch`);
    if (row.course === 'nce') {
      for (const [key, language] of [['bodyText', 'en'], ['bodyTextZh', 'zh']]) if (detail[key] !== detail.sentences.filter(s => s.role === 'body').map(s => s[language]).join('\n').trim()) errors.push(`${row.path}: ${key}/sentences mismatch`);
      // Existing NCE text already normalizes a few spaces from LRC subtitles.
      if (detail.text.replaceAll(' ', '') !== `${detail.question}\n\n${detail.bodyText}`.trim().replaceAll(' ', '')) errors.push(`${row.path}: question/bodyText mismatch`);
    }
    if (typeof detail.characterCount === 'number' && detail.characterCount !== detail.text.length) errors.push(`${row.path}: characterCount mismatch`);
    if (manifestChanges(root, row.path, detail).changes.length) errors.push(`${row.path}: manifest mismatch`);
  }
  for (const event of transactions(events)) for (const entry of event.files) for (const c of entry.changes) {
    if (typeof c.before === 'string' && !onlySpacesAdded(c.before, c.after)) errors.push(`${entry.path}${c.pointer}: non-space edit`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { files: rows.length, changed: rows.filter(r => r.implementation_status === 'applied').length, fullRead: rows.filter(r => r.review_status !== 'pending').length, pending: rows.filter(r => r.review_status === 'pending').length };
}

function locateReviewIssues(detail, issues) {
  if (!Array.isArray(issues)) throw new Error('Review issues must be an array');
  const fields = new Map(displayFields(detail));
  return issues.map(issue => {
    const text = fields.get(issue.pointer);
    if (typeof text !== 'string' || typeof issue.context !== 'string' || !issue.context || typeof issue.reason !== 'string' || !issue.reason.trim()) throw new Error('Review issue requires a display field, exact context and reason');
    const offset = issue.offset ?? text.indexOf(issue.context);
    if (!Number.isInteger(offset) || offset < 0 || text.slice(offset, offset + issue.context.length) !== issue.context) throw new Error(`Review issue context mismatch: ${issue.pointer}`);
    return { ...issue, offset };
  });
}

export function recordReview(root, file, { sha256, status, reviewer, note, resolveFindings = false, issues = [] }) {
  requireLegacyWorkflow(root);
  ensureNoPending(journal(root));
  if (!files(root).includes(file) || !note || !reviewer) throw new Error('Review requires article, reviewer and full-reading note');
  const source = read(root, file);
  if (hash(source) !== sha256) throw new Error('Review hash mismatch');
  if (!['edited', 'passed', 'needs_source_check'].includes(status)) throw new Error('Invalid review status');
  const audit = analyze(JSON.parse(source), file.split('/')[1]);
  issues = locateReviewIssues(JSON.parse(source), issues);
  if (audit.changes.length && status !== 'needs_source_check') throw new Error('Unresolved spacing candidates remain');
  if ((issues.length || (audit.issues.length && !resolveFindings)) && status !== 'needs_source_check') throw new Error('Resolve findings explicitly or record needs_source_check');
  append(root, { kind: 'review', path: file, sha256, reviewer, status, note, resolvedFindings: resolveFindings ? audit.issues : null, issues });
}

async function main() {
  const [command, ...args] = process.argv.slice(2), option = key => args[args.indexOf(key) + 1];
  const file = args.includes('--file') ? option('--file').replaceAll('\\', '/') : null;
  if (command === 'scan') {
    const rows = scan();
    console.log(JSON.stringify({ files: rows.length, candidates: rows.reduce((n, r) => n + r.candidate_count, 0),
      ...(hasArticleReview(ROOT) ? { mode: 'read_only_candidates', authority: 'content/article-review' } : { pending: rows.filter(r => r.review_status === 'pending').length }) }));
  }
  else if (command === 'inspect') {
    if (!file || !files(ROOT).includes(file)) throw new Error('--file must identify an article');
    const source = read(ROOT, file), detail = JSON.parse(source);
    console.log(JSON.stringify({ path: file, sha256: hash(source), ...analyze(detail, file.split('/')[1]) }, null, 2));
  }
  else if (command === 'read') {
    if (!file || !files(ROOT).includes(file)) throw new Error('--file must identify an article');
    const source = read(ROOT, file), detail = JSON.parse(source);
    const fields = displayFields(detail).filter(([pointer]) => !pointer.startsWith('/blocks/') && !pointer.startsWith('/sentences/'));
    const represented = new Set(fields.flatMap(([, value]) => [value, ...value.split('\n')]));
    if (detail.sentences) fields.push(...displayFields(detail).filter(([pointer, value]) => pointer.startsWith('/sentences/') && !represented.has(value)));
    const output = fields.map(([pointer, value]) => `${pointer}\n${value}`).join('\n\n');
    const offset = Number(args.includes('--offset') ? option('--offset') : 0), length = Number(args.includes('--length') ? option('--length') : 12000);
    console.log(JSON.stringify({ path: file, sha256: hash(source), offset, end: Math.min(offset + length, output.length), total: output.length }));
    console.log(output.slice(offset, offset + length));
  }
  else if (command === 'apply') {
    const selected = file ? [file] : files(ROOT).filter(f => args.includes('--course') && f.split('/')[1] === option('--course'));
    if (!selected.length) throw new Error('Use --file or --course; no implicit global application');
    let inserted = 0, changed = 0;
    if (args.includes('--decisions') && !file) throw new Error('--decisions requires --file');
    const decisions = args.includes('--decisions') ? JSON.parse(fs.readFileSync(option('--decisions'), 'utf8')) : null;
    for (const target of selected) { const result = applyFile(ROOT, target, decisions); inserted += result.inserted; if (result.inserted) changed++; }
    scan(); console.log(JSON.stringify({ files: selected.length, changed, inserted }));
  }
  else if (command === 'review') {
    if (!file || !files(ROOT).includes(file) || !args.includes('--sha256') || !args.includes('--note') || !args.includes('--reviewer')) throw new Error('review requires --file --sha256 --reviewer --note after actual full reading');
    recordReview(ROOT, file, { sha256: option('--sha256'), reviewer: option('--reviewer'), status: option('--status'), note: option('--note'), resolveFindings: args.includes('--resolve-findings'), issues: args.includes('--issues') ? JSON.parse(fs.readFileSync(option('--issues'), 'utf8')) : [] });
    scan(); console.log('Review recorded');
  }
  else if (command === 'replay' || command === 'recover') { console.log(replay(ROOT, command === 'recover')); scan(); }
  else if (command === 'check') console.log(check(ROOT, args.includes('--require-complete')));
  else throw new Error('Commands: scan, inspect, read, apply, review, replay, recover, check');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
