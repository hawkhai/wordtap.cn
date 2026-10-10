import path from "node:path";
import { escapeHtml as esc, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

export async function generatePages(context) {
  const { readFile, mkdir, writeFile } = context;
const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const dist = context.dataRoot;
const section = path.join(dist, "english-vocabulary");
const manifest = JSON.parse(await readFile(path.join(section, "manifest.json"), "utf8"));
const urls = [];
const source = '<p class="meta">词库来源：<a href="https://github.com/KyleBing/english-vocabulary">KyleBing/english-vocabulary</a> · <a href="LICENSE.txt">BSD-3-Clause 许可证</a></p>';

async function save(relative, { title, description, body, depth, toolHref, ogType = "website" }) {
  if (!context.wants(`english-vocabulary/${relative}index.html`)) return;
  const canonicalUrl = `${siteUrl}/english-vocabulary/${relative}`;
  const root = Array(depth).fill("..").join("/");
  const extraStyles = `@font-face { font-family: "Charis"; src: url("${root}/fonts/Charis/Charis-Regular.woff2") format("woff2"); font-weight: 400; font-display: swap; }
    .vocabulary-ipa { font-family: "Charis", serif; font-size: 0.8em; color: var(--wt-secondary); font-synthesis: none; }
    .vocabulary-entry { white-space: pre-wrap; overflow-wrap: anywhere; }
    .vocabulary-index { overflow-wrap: anywhere; }`;
  const html = pageShell({ title: `${title} - WordTap`, description, canonicalUrl, body,
    activeCourse: "english-vocabulary", depth, toolHref, toolLabel: "在 WordTap 中学习", extraStyles, ogType,
    structuredData: JSON.stringify({ "@context": "https://schema.org", "@type": ogType === "article" ? "LearningResource" : "CollectionPage",
      name: title, description, url: canonicalUrl, inLanguage: ["en", "zh-CN"],
      isBasedOn: manifest.source.repository, license: `${siteUrl}/english-vocabulary/LICENSE.txt` }) });
  const directory = path.join(section, relative);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), html, "utf8");
  urls.push(canonicalUrl);
}

for (const group of manifest.groups) {
  for (const [index, lesson] of group.lessons.entries()) {
    if (!context.wants(`english-vocabulary/${lesson.id}/index.html`)) continue;
    const detail = JSON.parse(await readFile(path.join(dist, lesson.jsonPath), "utf8"));
    // Same generated text as the workspace, only adding escaped semantic markup.
    const paragraphs = detail.text.split("\n\n").map(part => `<p class="vocabulary-entry">${part.split("\n").map(line => line.startsWith("音标：") ? `<span class="vocabulary-ipa">${esc(line)}</span>` : esc(line)).join("\n")}</p>`).join("\n");
    const previous = group.lessons[index - 1];
    const next = group.lessons[index + 1];
    const nav = `<nav class="page-nav" aria-label="单元导航">${previous ? `<a href="../${previous.id}/">← 上一单元</a>` : ""}<a href="../books/${group.id}/">${esc(group.title)}目录</a>${next ? `<a href="../${next.id}/">下一单元 →</a>` : ""}</nav>`;
    const title = `${group.title} · 第 ${lesson.unitNo} 单元 · ${lesson.title}`;
    await save(`${lesson.id}/`, { title, description: `${group.title}词汇第 ${lesson.unitNo} 单元，${lesson.wordCount} 词，提供音标、释义、短语、例句、点读和跟打。`,
      body: `<main><h1>${esc(title)}</h1><p class="meta">${lesson.wordCount} 词</p><article class="reading">${paragraphs}</article>${nav}${source.replace('href="LICENSE.txt"', 'href="../LICENSE.txt"')}</main>`,
      depth: 2, toolHref: lessonToolHref("english-vocabulary", lesson.id), ogType: "article" });
  }
  const list = group.lessons.map(lesson => `<li><a href="../../${lesson.id}/">第 ${lesson.unitNo} 单元 · ${esc(lesson.title)}</a> · ${lesson.wordCount} 词</li>`).join("\n");
  await save(`books/${group.id}/`, { title: `${group.title}词汇目录`, description: `${group.wordCount} 个词条，${group.lessonCount} 个学习单元。`,
    body: `<main class="vocabulary-index"><h1>${esc(group.title)}词汇</h1><p class="intro">${group.wordCount} 词 · 每单元最多 20 词</p><ol class="lesson-list">${list}</ol><nav class="page-nav"><a href="../../">全部词库</a></nav>${source.replace('href="LICENSE.txt"', 'href="../../LICENSE.txt"')}</main>`,
    depth: 3, toolHref: lessonToolHref("english-vocabulary", group.lessons[0].id, 3) });
}
const books = manifest.groups.map(group => `<section class="collection-card"><h2><a href="books/${group.id}/">${esc(group.title)}</a></h2><p>${group.wordCount} 词 · ${group.lessonCount} 单元</p></section>`).join("\n");
await save("", { title: "英语词汇学习", description: `23 套正序词库，共 ${manifest.totalWords} 个词条，支持点读、朗读和例句跟打。`,
  body: `<main><h1>英语词汇</h1><p class="intro">按词库选择，每单元最多 20 词。提供原有音标、释义、短语和例句。</p>${books}${source}</main>`, depth: 1, toolHref: "../" });
if (siteUrl && context.writeSitemap) {
  const sitemapPath = path.join(dist, "sitemap.xml");
  // Permit rerunning the generator without duplicate sitemap entries.
  const sitemap = (await readFile(sitemapPath, "utf8")).replace(/\s*<url>\s*<loc>[^<]*\/english-vocabulary\/[^<]*<\/loc>[\s\S]*?<\/url>/g, "");
  const entries = urls.map(url => `  <url><loc>${xmlEscape(url)}</loc><lastmod>${manifest.generatedAt.slice(0, 10)}</lastmod></url>`).join("\n");
  await writeFile(sitemapPath, sitemap.replace("</urlset>", `${entries}\n</urlset>`));
}
context.log(`Generated ${urls.length} vocabulary pages`);

}
