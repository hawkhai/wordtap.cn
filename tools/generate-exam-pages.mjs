import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, pageShell, xmlEscape } from "./course-page-shared.mjs";

const root = process.cwd();
const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(root, "dist");
const sectionDir = path.join(distDir, "exam");
const [cet, kaoyan, notice] = await Promise.all([
  readFile(path.join(distDir, "cet", "manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(distDir, "kaoyan-english", "manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src", "shared", "config", "examNotice.json"), "utf8").then(JSON.parse),
]);

const categories = [
  ...kaoyan.groups.map((group) => ({ title: group.title, count: group.lessonCount, href: "../kaoyan-english/", note: "历年真题正文，支持点词查词和全文朗读" })),
  ...cet.groups.map((group) => ({ title: group.title, count: group.lessonCount, href: "../cet/", note: "可检索真题正文，学习记录保存在本设备" })),
];
const total = categories.reduce((sum, category) => sum + category.count, 0);
const canonicalUrl = `${siteUrl}/exam/`;
const description = `WordTap 考试学习中心，聚合 ${total} 份考研英语和英语四六级真题，支持点词积累生词、本地复习和试卷进度记录。`;
const categoryHtml = categories.map((category) => `
  <article class="exam-card">
    <p>${escapeHtml(category.count)} 份真题</p>
    <h2>${escapeHtml(category.title)}</h2>
    <span>${escapeHtml(category.note)}</span>
    <a href="${category.href}">查看真题目录 →</a>
  </article>`).join("");
const body = `<main>
  <p class="meta">Exam Learning · ${total} papers</p>
  <h1>考试学习</h1>
  <p class="intro">选择真题，点词积累生词，在本地复习并记录每套试卷的学习进度。首版覆盖考研英语一、英语二、英语四级和英语六级。</p>
  <section class="exam-notice" aria-label="本地数据说明"><strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.message)}</span></section>
  <section class="exam-grid" aria-label="考试分类">${categoryHtml}</section>
  <section class="loop-card">
    <p class="eyebrow">本地学习闭环</p><h2>一次打开，持续积累</h2>
    <ol><li>选择并打开一套真题</li><li>点击生词查看释义并保存原句</li><li>在考试生词中用列表或卡片复习</li><li>标记试卷完成，下次继续最近进度</li></ol>
    <a class="primary-action" href="../#exam">进入考试学习面板</a>
  </section>
</main>`;
const extraStyles = `
  .exam-notice { display:grid; gap:5px; margin: 0 0 22px; padding:16px; border:1px solid #c9e0d7; border-left:4px solid #27735f; border-radius:10px; background:#e8f4ef; }
  .exam-notice span { color:#4d6a60; }
  .exam-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
  .exam-card, .loop-card { padding:24px; border:1px solid #d2e1db; border-radius:12px; background:#fff; box-shadow:0 14px 38px rgba(28,75,61,.07); }
  .exam-card p { margin:0 0 7px; color:#64748b; font-size:.875rem; font-weight:700; }
  .exam-card span { display:block; min-height:48px; color:#64748b; line-height:1.55; }
  .exam-card a { display:inline-block; margin-top:14px; color:#246b58; font-weight:800; }
  .loop-card { margin-top:18px; }
  .loop-card ol { display:grid; gap:8px; padding-left:22px; line-height:1.65; }
  .primary-action { display:inline-flex; min-height:42px; align-items:center; margin-top:8px; padding:0 16px; border-radius:9px; background:#1f6754; color:#fff; font-weight:800; text-decoration:none; }
  @media (max-width: 767px) { .exam-grid { grid-template-columns:1fr; } .exam-card span { min-height:0; } }
`;

await mkdir(sectionDir, { recursive: true });
await writeFile(path.join(sectionDir, "index.html"), pageShell({
  title: "考试学习｜考研英语、英语四六级真题与生词复习 - WordTap",
  description,
  keywords: "考研英语真题,英语四级真题,英语六级真题,考试生词,学习进度,WordTap",
  canonicalUrl,
  body,
  structuredData: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "WordTap 考试学习", description, url: canonicalUrl }),
  activeCourse: "exam",
  depth: 1,
  toolHref: "../#exam",
  toolLabel: "进入考试面板",
  extraStyles,
  ogType: "website",
}), "utf8");

if (siteUrl) {
  const sitemapPath = path.join(distDir, "sitemap.xml");
  const entry = `  <url>\n    <loc>${xmlEscape(canonicalUrl)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`;
  const sitemap = (await readFile(sitemapPath, "utf8")).replace("</urlset>", `${entry}\n</urlset>`);
  await writeFile(sitemapPath, sitemap, "utf8");
}

console.log(`Generated exam portal for ${total} papers.`);
