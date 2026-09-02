import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

// Canonical URLs must always use the public origin, including local preview builds.
const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const shuimuDir = path.join(distDir, "shuimu");
const manifestPath = path.join(shuimuDir, "manifest.json");

function lessonLinkFromLesson(lesson) {
  return `../${lesson.id}/`;
}

function lessonLinkFromIndex(lesson) {
  return `${lesson.id}/`;
}

function lessonPageTitle(level, detail) {
  return `\u6c34\u6728\u82f1\u8bed${level.title}\u7b2c${detail.unitNo}\u5355\u5143 ${detail.title}\uff5c\u8bb2\u4e49\u539f\u6587\u3001\u70b9\u8bfb\u6717\u8bfb\u4e0e\u89c6\u9891\u8bfe - WordTap`;

}

function lessonDescription(level, detail) {
  return `\u6c34\u6728\u82f1\u8bed${level.title}\uff08${level.subtitle}\uff09\u7b2c${detail.unitNo}\u5355\u5143\u300a${detail.title}\u300b\u5b66\u4e60\u8bb2\u4e49\uff0c\u63d0\u4f9b\u8bb2\u4e49\u539f\u6587\u3001\u82f1\u8bed\u9605\u8bfb\u3001\u5355\u8bcd\u70b9\u8bfb\u67e5\u4e49\u4e0e\u5168\u6587\u6717\u8bfb\u3002${detail.videos?.length ? `\u9644 ${detail.videos.length} \u4e2a\u5bf9\u5e94\u89c6\u9891\u8bfe\u7a0b\u5165\u53e3\uff0c\u9002\u5408\u9884\u4e60\u3001\u590d\u4e60\u548c\u8ddf\u8bfb\u3002` : "\u53ef\u5728 WordTap \u4e2d\u8fb9\u8bfb\u8fb9\u542c\u3001\u8bb0\u5f55\u751f\u8bcd\uff0c\u9002\u5408\u9884\u4e60\u548c\u590d\u4e60\u3002"}`;

}

function levelSearchTerms(level) {
  const terms = {
    phonetics: ["\u82f1\u8bed\u96f6\u57fa\u7840", "26\u4e2a\u82f1\u6587\u5b57\u6bcd", "\u56fd\u9645\u97f3\u6807", "\u82f1\u8bed\u53d1\u97f3"],
    beginner: ["\u82f1\u8bed\u521d\u7ea7", "\u65e5\u5e38\u82f1\u8bed\u5bf9\u8bdd", "\u57fa\u7840\u8bed\u6cd5", "\u57fa\u7840\u8bcd\u6c47"],
    intermediate: ["\u82f1\u8bed\u4e2d\u7ea7", "\u82f1\u8bed\u6545\u4e8b", "\u82f1\u8bed\u8bed\u6cd5", "\u82f1\u8bed\u6587\u5316"],
    upper: ["\u82f1\u8bed\u4e2d\u9ad8\u7ea7", "\u82f1\u8bed\u7cbe\u8bfb", "\u9605\u8bfb\u7406\u89e3", "\u82f1\u8bed\u5199\u4f5c"],
  };
  return terms[level.id] ?? [];
}

function lessonKeywords(level, detail) {
  return ["\u6c34\u6728\u82f1\u8bed", `\u6c34\u6728\u82f1\u8bed${level.title}`, level.subtitle, ...levelSearchTerms(level), `\u7b2c${detail.unitNo}\u5355\u5143`, detail.title, "\u82f1\u8bed\u8bb2\u4e49", "\u82f1\u8bed\u8bfe\u6587", "\u82f1\u8bed\u70b9\u8bfb", "\u82f1\u8bed\u6717\u8bfb", detail.videos?.length ? "\u82f1\u8bed\u89c6\u9891\u8bfe" : ""].filter(Boolean).join(",");
}

function structuredLessonData(level, detail, url) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["LearningResource", "Article"],
    headline: lessonPageTitle(level, detail),
    name: detail.title,
    description: lessonDescription(level, detail),
    keywords: lessonKeywords(level, detail),
    inLanguage: ["zh-CN", "en"],
    learningResourceType: ["\u82f1\u8bed\u8bb2\u4e49", "\u8bfe\u7a0b\u8bfe\u6587"],
    educationalUse: ["\u9884\u4e60", "\u590d\u4e60", "\u9605\u8bfb", "\u8ddf\u8bfb"],
    educationalLevel: level.title,
    teaches: detail.title,
    provider: { "@type": "Organization", name: "WordTap", url: siteUrl },
    isPartOf: {
      "@type": "Course",
      name: `水木英语 ${level.title}`,
      url: siteUrl ? `${siteUrl}/shuimu/` : "../",
    },
    position: detail.unitNo,
    url,
  }).replaceAll("<", "\\u003c");
}

function renderVideos(videos) {
  if (!videos?.length) return "";
  const links = videos.map((video) => `<a class="video" href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(video.title)}</strong><span>${escapeHtml(video.duration || "去 B 站学习")}</span></a>`).join("\n");
  return `<aside class="videos"><h2>对应视频课程</h2><div class="video-list">${links}</div></aside>`;
}

function lessonPage(level, detail, previous, next) {
  const title = lessonPageTitle(level, detail);
  const description = lessonDescription(level, detail);
  const keywords = lessonKeywords(level, detail);
  const canonicalUrl = siteUrl ? `${siteUrl}/shuimu/${detail.id}/` : "";
  const blocks = detail.blocks.map((block) => `<p class="${escapeHtml(block.type)}">${escapeHtml(block.text)}</p>`).join("\n");
  const previousLink = previous ? `<a href="${escapeHtml(lessonLinkFromLesson(previous))}">← 上一单元</a>` : `<a href="../">← 返回目录</a>`;
  const nextLink = next ? `<a href="${escapeHtml(lessonLinkFromLesson(next))}">下一单元 →</a>` : `<a href="../">返回目录 →</a>`;
  const body = `<main><p class="eyebrow">${escapeHtml(level.title)} · 第 ${detail.unitNo} 单元</p><h1>${escapeHtml(detail.title)}</h1>${renderVideos(detail.videos)}<article class="reading">${blocks}</article><nav class="page-nav" aria-label="课程导航">${previousLink}${nextLink}</nav></main>`;
  return pageShell({
    title,
    description,
    keywords,
    canonicalUrl,
    structuredData: structuredLessonData(level, detail, canonicalUrl),
    body,
    activeCourse: "shuimu",
    depth: 2,
    toolHref: lessonToolHref("shuimu", detail.id),
    toolLabel: "在 WordTap 中学习",
  });
}

function indexPage() {
  const levelHtml = manifest.levels.map((level) => {
    const lessons = level.lessons.map((lesson) => `<li><a href="${escapeHtml(lessonLinkFromIndex(lesson))}">第 ${lesson.unitNo} 单元 · ${escapeHtml(lesson.title)}</a>${lesson.videoCount ? " · 🎬" : ""}</li>`).join("\n");
    return `<section class="collection-card"><h2>${escapeHtml(level.title)}</h2><p>${escapeHtml(level.subtitle)} · ${level.lessonCount} 个学习单元</p><ol class="lesson-list">${lessons}</ol></section>`;
  }).join("\n");
  const seoTitle = "水木英语全套课程讲义｜零基础、初级、中级、中高级英语视频课 - WordTap";
  const seoDescription = `水木英语全套课程目录，收录${manifest.levels.map((level) => level.title).join("、")}四套讲义，共 ${manifest.totalLessons} 个学习单元。覆盖字母音标、基础词汇语法、日常对话、英语精读与写作，提供讲义原文、点读查词、全文朗读及配套视频课。`;
  const keywords = ["水木英语", "水木英语课程", "水木英语讲义", "英语零基础", "英语初级", "英语中级", "英语中高级", "国际音标", "英语语法", "英语精读", "英语视频课", "英语点读", ...manifest.levels.flatMap((level) => [level.title, level.subtitle])].join(",");
  const body = `<main><p class="eyebrow">Water & Wood English · ${manifest.totalLessons} units</p><h1>水木英语课程目录</h1><p class="intro">讲义按原版 PDF 校对并重建课程层级。点击单元可直接阅读；带 🎬 的中级单元可跳转到对应的 B 站课程。</p>${levelHtml}</main>`;
  const canonicalUrl = siteUrl ? `${siteUrl}/shuimu/` : "";
  return pageShell({
    title: seoTitle,
    description: seoDescription,
    keywords,
    canonicalUrl,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: seoTitle, description: seoDescription, keywords, url: canonicalUrl || "./", mainEntity: { "@id": `${canonicalUrl}#course` } },
        { "@id": `${canonicalUrl}#course`, "@type": "Course", name: "\u6c34\u6728\u82f1\u8bed", description: seoDescription, provider: { "@type": "Organization", name: "WordTap", url: siteUrl }, hasCourseInstance: manifest.levels.map((level) => ({ "@type": "CourseInstance", name: `${level.title} ${level.subtitle}`, courseMode: "online" })) },
      ],
    }).replaceAll("<", "\\u003c"),
    body,
    activeCourse: "shuimu",
    depth: 1,
    toolHref: "../",
    ogType: "website",
  });
}

function sitemapEntries(allLessons) {
  const lastmod = new Date(manifest.generatedAt).toISOString().slice(0, 10);
  return [
    `${siteUrl}/shuimu/`,
    ...allLessons.map(({ lesson }) => `${siteUrl}/shuimu/${lesson.id}/`),
  ].map((url) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join("\n");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allLessons = [];
for (const level of manifest.levels) {
  for (const lesson of level.lessons) allLessons.push({ level, lesson });
}

for (let index = 0; index < allLessons.length; index += 1) {
  const { level, lesson } = allLessons[index];
  const detail = JSON.parse(await readFile(path.join(distDir, lesson.jsonPath), "utf8"));
  const pageDir = path.join(shuimuDir, lesson.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "index.html"), lessonPage(level, detail, allLessons[index - 1]?.lesson, allLessons[index + 1]?.lesson), "utf8");
}

await writeFile(path.join(shuimuDir, "index.html"), indexPage(), "utf8");

if (siteUrl) {
  const sitemapPath = path.join(distDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  sitemap = sitemap.replace("</urlset>", `${sitemapEntries(allLessons)}\n</urlset>`);
  await writeFile(sitemapPath, sitemap, "utf8");
}

console.log(`Generated ${allLessons.length} Water & Wood English pages${siteUrl ? " and updated sitemap.xml" : ""}.`);
