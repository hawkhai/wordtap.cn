import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

// Canonical URLs must always use the public origin, including local preview builds.
const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const nceDir = path.join(distDir, "nce");
const manifestPath = path.join(nceDir, "manifest.json");

function normalizeTitleZh(value) {
  return String(value ?? "").replace(/[?]+$/g, "").trim();
}

function lessonLinkFromLesson(lesson) {
  return `../${lesson.id}/`;
}

function lessonLinkFromIndex(lesson) {
  return `${lesson.id}/`;
}

function lessonPageTitle(book, lesson, detail) {
  const seoZhTitle = normalizeTitleZh(detail.titleZh || lesson.titleZh);
  const seoLessonName = [seoZhTitle, detail.title].filter(Boolean).join(" ");
  return `\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c${book.bookNo}\u518c\u7b2c${lesson.lessonNo}\u8bfe ${seoLessonName}\uff5c\u8bfe\u6587\u539f\u6587\u3001\u4e2d\u6587\u7ffb\u8bd1\u4e0e\u97f3\u9891 - WordTap`;

}

function lessonDescription(book, lesson, detail) {
  const seoQuestion = detail.question || lesson.question;
  const seoLessonName = normalizeTitleZh(detail.titleZh || lesson.titleZh) || detail.title;
  const range = lesson.lessonRange?.length > 1 ? `\uff08Lesson ${lesson.lessonRange.join("\u2013")}\uff09` : "";
  return `\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c${book.bookNo}\u518c\u7b2c${lesson.lessonNo}\u8bfe${range}\u300a${seoLessonName} / ${detail.title}\u300b\u5b66\u4e60\u9875\u9762\uff0c\u63d0\u4f9b\u82f1\u6587\u8bfe\u6587\u539f\u6587\u3001\u4e2d\u6587\u7ffb\u8bd1\u3001\u8bfe\u6587\u5f55\u97f3\u3001\u9010\u53e5\u70b9\u8bfb\u3001\u5355\u8bcd\u91ca\u4e49\u548c\u5168\u6587\u6717\u8bfb\u3002${seoQuestion ? `\u672c\u8bfe\u95ee\u9898\uff1a${seoQuestion}` : "\u9002\u5408\u65b0\u6982\u5ff5\u82f1\u8bed\u81ea\u5b66\u3001\u590d\u4e60\u4e0e\u8ddf\u8bfb\u3002"}`;

}

function lessonKeywords(book, lesson, detail) {
  const zhTitle = normalizeTitleZh(detail.titleZh || lesson.titleZh);
  return [
    "\u65b0\u6982\u5ff5\u82f1\u8bed", `\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c${book.bookNo}\u518c`, `\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c${book.bookNo}\u518c\u7b2c${lesson.lessonNo}\u8bfe`,
    `New Concept English Book ${book.bookNo}`, `Lesson ${lesson.lessonNo}`, detail.title, zhTitle,
    "\u65b0\u6982\u5ff5\u82f1\u8bed\u8bfe\u6587", "\u82f1\u6587\u539f\u6587", "\u4e2d\u6587\u7ffb\u8bd1", "\u8bfe\u6587\u97f3\u9891", "\u82f1\u8bed\u70b9\u8bfb", "\u5355\u8bcd\u91ca\u4e49", "\u5168\u6587\u6717\u8bfb",
  ].filter(Boolean).join(",");
}

function structuredLessonData(book, lesson, detail, url) {
  const keywords = lessonKeywords(book, lesson, detail);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["LearningResource", "Article"],
    headline: lessonPageTitle(book, lesson, detail),
    name: detail.title,
    alternateName: normalizeTitleZh(detail.titleZh || lesson.titleZh) || undefined,
    description: lessonDescription(book, lesson, detail),
    inLanguage: ["en", "zh-CN"],
    learningResourceType: ["\u8bfe\u6587", "\u82f1\u8bed\u9605\u8bfb", "\u542c\u529b\u6750\u6599"],
    educationalUse: ["\u81ea\u5b66", "\u590d\u4e60", "\u8ddf\u8bfb", "\u8bcd\u6c47\u5b66\u4e60"],
    educationalLevel: `\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c${book.bookNo}\u518c`,
    teaches: detail.question || lesson.question || detail.title,
    keywords,
    provider: { "@type": "Organization", name: "WordTap", url: `${siteUrl}/` },
    isPartOf: {
      "@type": "Course",
      name: `新概念英语第 ${book.bookNo} 册`,
      url: siteUrl ? `${siteUrl}/nce/` : "../",
    },
    position: lesson.lessonNo,
    url,
  }).replaceAll("<", "\\u003c");
}

function lessonHtml(book, lesson, detail, previousLesson, nextLesson) {
  const title = lessonPageTitle(book, lesson, detail);
  const canonicalUrl = siteUrl ? `${siteUrl}/nce/${lesson.id}/` : "";
  const description = lessonDescription(book, lesson, detail);
  const keywords = lessonKeywords(book, lesson, detail);
  const paragraphs = detail.bodyText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n          ");
  const question = detail.question ? `<p class="question">${escapeHtml(detail.question)}</p>` : "";
  const navLinks = [
    previousLesson ? `<a href="${escapeHtml(lessonLinkFromLesson(previousLesson))}">上一篇 Lesson ${previousLesson.lessonNo}</a>` : `<a href="../">返回目录</a>`,
    nextLesson ? `<a href="${escapeHtml(lessonLinkFromLesson(nextLesson))}">下一篇 Lesson ${nextLesson.lessonNo}</a>` : `<a href="../">返回目录</a>`,
  ].join("");
  const body = `
      <main>
        <p class="meta">Book ${book.bookNo} · Lesson ${lesson.lessonNo}</p>
        <h1>${escapeHtml(detail.title)}</h1>
        ${question}
        <article class="lesson-text">
          ${paragraphs}
        </article>
        <nav class="page-nav" aria-label="课文导航">${navLinks}</nav>
      </main>`;

  return pageShell({
    title,
    description,
    keywords,
    canonicalUrl,
    structuredData: structuredLessonData(book, lesson, detail, canonicalUrl),
    body,
    activeCourse: "nce",
    depth: 2,
    toolHref: lessonToolHref("nce", lesson.id),
    toolLabel: "在 WordTap 中学习",
  });
}

function indexHtml(manifest) {
  const seoTitle = "\u65b0\u6982\u5ff5\u82f1\u8bed1-4\u518c\u8bfe\u6587\u76ee\u5f55\uff5c\u539f\u6587\u3001\u7ffb\u8bd1\u3001\u97f3\u9891\u4e0e\u70b9\u8bfb - WordTap";
  const seoDescription = `\u5b8c\u6574\u6574\u7406\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c\u4e00\u518c\u3001\u7b2c\u4e8c\u518c\u3001\u7b2c\u4e09\u518c\u548c\u7b2c\u56db\u518c\u5171 ${manifest.totalLessons} \u8bfe\uff0c\u6309\u518c\u6b21\u548c\u8bfe\u53f7\u63d0\u4f9b\u82f1\u6587\u8bfe\u6587\u539f\u6587\u3001\u4e2d\u6587\u7ffb\u8bd1\u3001\u8bfe\u6587\u97f3\u9891\u3001\u9010\u53e5\u70b9\u8bfb\u3001\u5355\u8bcd\u67e5\u8be2\u4e0e\u5168\u6587\u6717\u8bfb\uff0c\u9002\u5408\u65b0\u6982\u5ff5\u82f1\u8bed\u81ea\u5b66\u548c\u590d\u4e60\u3002`;
  const keywords = "\u65b0\u6982\u5ff5\u82f1\u8bed,\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c\u4e00\u518c,\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c\u4e8c\u518c,\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c\u4e09\u518c,\u65b0\u6982\u5ff5\u82f1\u8bed\u7b2c\u56db\u518c,\u65b0\u6982\u5ff5\u82f1\u8bed\u8bfe\u6587,\u65b0\u6982\u5ff5\u82f1\u8bed\u539f\u6587,\u65b0\u6982\u5ff5\u82f1\u8bed\u7ffb\u8bd1,\u65b0\u6982\u5ff5\u82f1\u8bed\u97f3\u9891,New Concept English,\u82f1\u8bed\u81ea\u5b66,\u82f1\u8bed\u70b9\u8bfb";
  const canonicalUrl = siteUrl ? `${siteUrl}/nce/` : "";
  const books = manifest.books
    .map((book) => {
      const lessons = book.lessons
        .map((lesson) => `<li><a href="${escapeHtml(lessonLinkFromIndex(lesson))}">Lesson ${lesson.lessonNo} ${escapeHtml(lesson.title)}</a></li>`)
        .join("\n              ");
      return `<section class="collection-card">
          <h2>新概念英语第 ${book.bookNo} 册</h2>
          <ol class="lesson-list">${lessons}</ol>
        </section>`;
    })
    .join("\n        ");
  const body = `
      <main>
        <p class="meta">New Concept English · ${manifest.totalLessons} lessons</p>
        <h1>新概念英语课文目录</h1>
        <p class="question">每篇课文都有独立页面，顶部按钮可跳转到 WordTap 并自动注入对应课文。</p>
        ${books}
      </main>`;
  return pageShell({
    title: seoTitle,
    description: seoDescription,
    keywords,
    canonicalUrl,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seoTitle,
      description: seoDescription,
      keywords,
      url: canonicalUrl || "./",
    }),
    body,
    activeCourse: "nce",
    depth: 1,
    toolHref: "../",
    ogType: "website",
  });
}

function sitemapXml(manifest) {
  const urls = [
    { loc: `${siteUrl}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${siteUrl}/nce/`, priority: "0.9", changefreq: "weekly" },
    ...manifest.books.flatMap((book) =>
      book.lessons.map((lesson) => ({
        loc: `${siteUrl}/nce/${lesson.id}/`,
        priority: "0.8",
        changefreq: "monthly",
      })),
    ),
  ];
  const lastmod = new Date(manifest.generatedAt).toISOString().slice(0, 10);
  const body = urls
    .map(
      (url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allLessons = manifest.books.flatMap((book) => book.lessons.map((lesson) => ({ book, lesson })));

for (let i = 0; i < allLessons.length; i += 1) {
  const { book, lesson } = allLessons[i];
  const detailPath = path.join(distDir, lesson.jsonPath);
  const detail = JSON.parse(await readFile(detailPath, "utf8"));
  const pageDir = path.join(nceDir, lesson.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(
    path.join(pageDir, "index.html"),
    lessonHtml(book, lesson, detail, allLessons[i - 1]?.lesson, allLessons[i + 1]?.lesson),
    "utf8",
  );
}

await writeFile(path.join(nceDir, "index.html"), indexHtml(manifest), "utf8");

if (siteUrl) {
  await writeFile(path.join(distDir, "sitemap.xml"), sitemapXml(manifest), "utf8");
  console.log(`Generated ${allLessons.length} NCE lesson pages and sitemap.xml.`);
} else {
  console.log(`Generated ${allLessons.length} NCE lesson pages. (Set SITE_URL to also generate sitemap.xml)`);
}
