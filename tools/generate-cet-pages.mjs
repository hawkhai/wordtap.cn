import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const sectionDir = path.join(distDir, "cet");
const manifest = JSON.parse(await readFile(path.join(sectionDir, "manifest.json"), "utf8"));
const newestFirst = (lessons) => [...lessons].sort((left, right) => (
  right.year - left.year || right.month - left.month || left.setNo - right.setNo
));
const allLessons = manifest.groups.flatMap((group) => newestFirst(group.lessons).map((lesson) => ({ group, lesson })));

function lessonPage(group, detail, previous, next) {
  const canonicalUrl = `${siteUrl}/cet/${detail.id}/`;
  const paragraphs = detail.blocks.map((block) => `<p class="en" lang="en">${escapeHtml(block.text)}</p>`).join("\n");
  const previousLink = previous ? `<a href="../${escapeHtml(previous.id)}/">← 上一份</a>` : `<a href="../">← 返回目录</a>`;
  const nextLink = next ? `<a href="../${escapeHtml(next.id)}/">下一份 →</a>` : `<a href="../">返回目录 →</a>`;
  const description = `${detail.title}英文试卷正文，支持单词点读查词和全文朗读。`;
  const body = `<main><p class="meta">${escapeHtml(group.title)} · ${detail.year} 年 ${detail.month} 月 · ${detail.setNo ? `第 ${detail.setNo} 套` : "全套合卷"}</p><h1>${escapeHtml(detail.title)}</h1><p class="intro">从原始真题 PDF 的可检索文本层收录，共 ${detail.pageCount} 页。试题版式已转换为适合点读和朗读的连续文本。</p><article class="reading">${paragraphs}</article><nav class="page-nav" aria-label="真题导航">${previousLink}${nextLink}</nav></main>`;
  return pageShell({
    title: `${detail.title}｜英语四六级真题点读与朗读 - WordTap`,
    description,
    keywords: `${group.title},四六级真题,${detail.year}年${detail.month}月英语真题,英语点读,英语朗读`,
    canonicalUrl,
    body,
    structuredData: JSON.stringify({ "@context": "https://schema.org", "@type": ["LearningResource", "Article"], name: detail.title, description, inLanguage: "en", educationalLevel: group.id === "cet4" ? "大学英语四级" : "大学英语六级", provider: { "@type": "Organization", name: "WordTap", url: siteUrl }, url: canonicalUrl }),
    activeCourse: "cet",
    depth: 2,
    toolHref: lessonToolHref("cet", detail.id),
    toolLabel: "在 WordTap 中学习",
  });
}

function indexPage() {
  const groupHtml = manifest.groups.map((group) => {
    const lessons = newestFirst(group.lessons).map((lesson) => `<li><a href="${escapeHtml(lesson.id)}/">${escapeHtml(lesson.title)}</a></li>`).join("\n");
    return `<section class="collection-card"><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.subtitle)}</p><ol class="lesson-list">${lessons}</ol></section>`;
  }).join("\n");
  const canonicalUrl = `${siteUrl}/cet/`;
  const description = `英语四级、六级历年真题目录，共收录 ${manifest.totalLessons} 份可检索试卷，支持点读查词和全文朗读。`;
  const body = `<main><p class="meta">CET-4 & CET-6 · ${manifest.totalLessons} papers</p><h1>英语四六级真题</h1><p class="intro">收录来源文件中具有可靠文本层的英语四级、六级真题。扫描件、答案解析和作文模板未混入正文。</p>${groupHtml}</main>`;
  return pageShell({ title: "英语四六级历年真题｜CET-4、CET-6 点读与朗读 - WordTap", description, keywords: "英语四级真题,英语六级真题,CET4,CET6,四六级历年真题,英语点读", canonicalUrl, body, structuredData: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "英语四六级真题", description, url: canonicalUrl }), activeCourse: "cet", depth: 1, toolHref: "../", ogType: "website" });
}

for (let index = 0; index < allLessons.length; index += 1) {
  const { group, lesson } = allLessons[index];
  const detail = JSON.parse(await readFile(path.join(distDir, lesson.jsonPath), "utf8"));
  const pageDir = path.join(sectionDir, lesson.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "index.html"), lessonPage(group, detail, allLessons[index - 1]?.lesson, allLessons[index + 1]?.lesson), "utf8");
}
await writeFile(path.join(sectionDir, "index.html"), indexPage(), "utf8");
if (siteUrl) {
  const lastmod = new Date(manifest.generatedAt).toISOString().slice(0, 10);
  const urls = [`${siteUrl}/cet/`, ...allLessons.map(({ lesson }) => `${siteUrl}/cet/${lesson.id}/`)];
  const entries = urls.map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join("\n");
  const sitemapPath = path.join(distDir, "sitemap.xml");
  const sitemap = (await readFile(sitemapPath, "utf8")).replace("</urlset>", `${entries}\n</urlset>`);
  await writeFile(sitemapPath, sitemap, "utf8");
}
console.log(`Generated ${allLessons.length} CET pages${siteUrl ? " and updated sitemap.xml" : ""}.`);
