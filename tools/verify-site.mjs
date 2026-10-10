import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
let pages = 0;
const checked = new Set();
async function checkReference(reference, from) {
  const value = reference.replaceAll('&amp;', '&');
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
  if (!pathname) return;
  const target = pathname.startsWith('/') ? path.resolve(root, '.' + pathname) : path.resolve(path.dirname(from), pathname);
  assert.ok(target === root || target.startsWith(root + path.sep), `${from}: reference escapes site: ${value}`);
  if (checked.has(target)) return;
  let info;
  try { info = await stat(target); } catch { throw new Error(`${path.relative(root, from)}: missing resource ${value}`); }
  if (info.isDirectory()) await access(path.join(target, 'index.html'));
  checked.add(target);
}
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) await checkReference(value, file);
      for (const [, value] of html.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) await checkReference(value, file);
      pages++;
    }
  }
}
await visit(root);
assert.ok(pages >= 6914, 'Lesson pages are missing');
console.log(`Verified local navigation and resources across ${pages} HTML pages (${checked.size} targets).`);
