import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const sectionDir = path.join(distDir, "college-english");
const manifest = JSON.parse(await readFile(path.join(sectionDir, "manifest.json"), "utf8"));

function lessonSeo(group, detail) {
  const bookName = `新视野大学英语（第四版）${group.title}`;
  const title = `${bookName} Unit ${detail.unitNo} Section ${detail.section} ${detail.title}｜课文点读与朗读 - WordTap`;
  const description = `${bookName} Unit ${detail.unitNo} Section ${detail.section}《${detail.title}》人工全文校对文本，支持英语点读查词、全文朗读和学习链接。`;
  const keywords = [
    "新视野大学英语",
    "新视野大学英语第四版",
    bookName,
    group.title,
    `Unit ${detail.unitNo}`,
    `Section ${detail.section}`,
    detail.title,
    "大学英语课文",
    "英语点读",
    "英语朗读",
  ].join(",");
  return { title, description, keywords, bookName };
}

function lessonPage(group, detail, previous, next) {
  const seo = lessonSeo(group, detail);
  const canonicalUrl = `${siteUrl}/college-english/${detail.id}/`;
  const paragraphs = detail.blocks
    .map((block) => `<p class="${escapeHtml(block.lang)}" lang="${block.lang === "zh" ? "zh-CN" : "en"}">${escapeHtml(block.text)}</p>`)
    .join("\n");
  const previousLink = previous ? `<a href="../${escapeHtml(previous.id)}/">← 上一篇</a>` : '<a href="../">← 返回目录</a>';
  const nextLink = next ? `<a href="../${escapeHtml(next.id)}/">下一篇 →</a>` : '<a href="../">返回目录 →</a>';
  const body = `<main><p class="meta">${escapeHtml(group.title)} · Unit ${detail.unitNo} · Section ${detail.section} · p${detail.printedPageStart}–${detail.printedPageEnd}</p><h1>${escapeHtml(detail.title)}</h1><article class="reading">${paragraphs}</article><nav class="page-nav" aria-label="教材文章导航">${previousLink}${nextLink}</nav></main>`;
  return pageShell({
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    canonicalUrl,
    body,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@type": ["LearningResource", "Article"],
      headline: seo.title,
      name: detail.title,
      description: seo.description,
      inLanguage: ["en", "zh-CN"],
      learningResourceType: "教材课文",
      educationalUse: ["预习", "复习", "阅读", "跟读"],
      educationalLevel: "大学",
      provider: { "@type": "Organization", name: "WordTap", url: siteUrl },
      isPartOf: { "@type": "Course", name: seo.bookName, url: `${siteUrl}/college-english/` },
      position: detail.sequenceNo,
      url: canonicalUrl,
    }),
    activeCourse: "college-english",
    depth: 2,
    toolHref: lessonToolHref("college-english", detail.id),
    toolLabel: "在 WordTap 中学习",
  });
}

function indexPage() {
  const title = "新视野大学英语第四版｜读写教程 1–4 册课文点读 - WordTap";
  const description = `新视野大学英语（第四版）读写教程 1–4 册目录规定的 72 篇课文，当前 ${manifest.publishedArticleCount} 篇已完成逐篇全文校对。`;
  const canonicalUrl = `${siteUrl}/college-english/`;
  const groups = manifest.groups.map((group) => {
    const lessons = group.lessons
      .map((lesson) => `<li><a href="${escapeHtml(lesson.id)}/">Unit ${lesson.unitNo} · Section ${lesson.section} · ${escapeHtml(lesson.title)}</a></li>`)
      .join("\n");
    return `<section class="collection-card"><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.subtitle)}</p><ol class="lesson-list">${lessons}</ol></section>`;
  }).join("\n");
  const body = `<main><p class="meta">New Horizon College English · ${manifest.publishedArticleCount}/72 reviewed articles</p><h1>新视野大学英语</h1><p class="intro">只收录教材目录中的 Text A、Text B 和 Stories of China。文章按教材顺序逐篇全文校对，未签字内容不会发布。</p>${groups}</main>`;
  return pageShell({
    title,
    description,
    keywords: "新视野大学英语,新视野大学英语第四版,大学英语读写教程,大学英语课文,英语点读,英语朗读",
    canonicalUrl,
    body,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: title, description, url: canonicalUrl },
        {
          "@type": "Course",
          name: "新视野大学英语（第四版）",
          description,
          educationalLevel: "大学",
          provider: { "@type": "Organization", name: "WordTap", url: siteUrl },
          hasPart: manifest.groups.map((group) => ({ "@type": "LearningResource", name: group.title })),
        },
      ],
    }),
    activeCourse: "college-english",
    depth: 1,
    toolHref: "../",
    ogType: "website",
  });
}

const allLessons = manifest.groups.flatMap((group) => group.lessons.map((lesson) => ({ group, lesson })));
for (let index = 0; index < allLessons.length; index += 1) {
  const { group, lesson } = allLessons[index];
  const detail = JSON.parse(await readFile(path.join(distDir, lesson.jsonPath), "utf8"));
  const pageDir = path.join(sectionDir, lesson.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(
    path.join(pageDir, "index.html"),
    lessonPage(group, detail, allLessons[index - 1]?.lesson, allLessons[index + 1]?.lesson),
    "utf8",
  );
}

await writeFile(path.join(sectionDir, "index.html"), indexPage(), "utf8");

if (siteUrl) {
  const lastmod = new Date(manifest.generatedAt).toISOString().slice(0, 10);
  const entries = [`${siteUrl}/college-english/`, ...allLessons.map(({ lesson }) => `${siteUrl}/college-english/${lesson.id}/`)]
    .map((url) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join("\n");
  const sitemapPath = path.join(distDir, "sitemap.xml");
  const sitemap = (await readFile(sitemapPath, "utf8")).replace("</urlset>", `${entries}\n</urlset>`);
  await writeFile(sitemapPath, sitemap, "utf8");
}

console.log(`Generated ${allLessons.length} College English pages${siteUrl ? " and updated sitemap.xml" : ""}.`);
