import * as fs from 'node:fs/promises';
import path from 'node:path';

export const staticSections = ['nce', 'shuimu', 'postgraduate', 'pep-english', 'college-english', 'cet', 'kaoyan-english', 'english-vocabulary', 'exam', 'install'];

async function renderer(section) {
  return (await import(`./generate-${section === 'install' ? 'install-guide' : section}-pages.mjs`)).generatePages;
}

export async function generateStaticSite(dataRoot = path.resolve('dist')) {
  const context = { dataRoot, ...fs, wants: () => true, writeSitemap: true, log: console.log };
  // NCE creates the sitemap; subsequent renderers append their own entries.
  for (const section of staticSections) await (await renderer(section))(context);
}

// Read current published files for each request. Never read or write build output.
export async function renderStaticPage(pathname, dataRoot = path.resolve('public')) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const parts = decoded.split('/').filter(Boolean);
  if (!staticSections.includes(parts[0])) return undefined;
  if (parts.some(part => part === '.' || part === '..' || part.includes('\\'))) return null;
  if (parts.at(-1) === 'index.html') parts.pop();
  if (parts.some(part => part.includes('.'))) return undefined;
  const requested = parts.join('/') + '/index.html';
  let html = null;
  const context = {
    dataRoot,
    readFile: fs.readFile,
    mkdir: async () => {},
    writeFile: async (file, contents) => {
      if (path.relative(dataRoot, file).split(path.sep).join('/') === requested) html = contents;
    },
    wants: relative => relative === requested,
    writeSitemap: false,
    log: () => {},
  };
  await (await renderer(parts[0]))(context);
  return html;
}
