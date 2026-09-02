import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const sectionDir = path.join(distDir, "pep-english");
const manifest = JSON.parse(await readFile(path.join(sectionDir, "manifest.json"), "utf8"));

function lessonSeo(group, detail) {
  const unit = detail.unitNo ? `Unit ${detail.unitNo}` : "";
  const location = [unit, detail.section].filter(Boolean).join(" ");
  const bookLabel = `${group.stageTitle}${group.title}`;
  const title = `\u4eba\u6559\u7248${bookLabel}\u82f1\u8bed ${location} ${detail.title}\uff5cPEP\u8bfe\u6587\u539f\u6587 - WordTap`;
  const pages = detail.source?.pageStart
    ? `\u6559\u6750\u7b2c${detail.source.pageStart}${detail.source.pageEnd > detail.source.pageStart ? `\u2013${detail.source.pageEnd}` : ""}\u9875`
    : "";
  const description = `\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793ePEP\u4eba\u6559\u7248${bookLabel}\u82f1\u8bed ${location}\u300a${detail.title}\u300b${pages}\u8bfe\u6587\u539f\u6587\uff0c\u63d0\u4f9b\u5b8c\u6574\u82f1\u6587\u9605\u8bfb\u3001\u9010\u53e5\u70b9\u8bfb\u3001\u5355\u8bcd\u67e5\u8be2\u548c\u5168\u6587\u6717\u8bfb\uff0c\u9002\u5408\u8bfe\u524d\u9884\u4e60\u3001\u8bfe\u540e\u590d\u4e60\u548c\u8ddf\u8bfb\u7ec3\u4e60\u3002`;
  const keywords = [
    "\u4eba\u6559\u7248\u82f1\u8bed", "PEP\u82f1\u8bed", "\u4eba\u6559\u82f1\u8bed", "\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793e\u82f1\u8bed",
    `${bookLabel}\u82f1\u8bed`, `\u4eba\u6559\u7248${group.title}\u82f1\u8bed`, unit, detail.section, detail.title,
    "\u82f1\u8bed\u8bfe\u6587\u539f\u6587", "\u6559\u6750\u8bfe\u6587", "\u82f1\u8bed\u70b9\u8bfb", "\u5168\u6587\u6717\u8bfb", "\u8bfe\u5185\u82f1\u8bed",
  ].filter(Boolean).join(",");
  return { title, description, keywords, unit, location, bookLabel };
}

function lessonPage(group, detail, previous, next) {
  const seo = lessonSeo(group, detail);
  const canonicalUrl = `${siteUrl}/pep-english/${detail.id}/`;
  const paragraphs = detail.blocks.map((block) => `<p lang="en">${escapeHtml(block.text)}</p>`).join("\n");
  const previousLink = previous ? `<a href="../${escapeHtml(previous.id)}/">← 上一篇</a>` : '<a href="../">← 返回目录</a>';
  const nextLink = next ? `<a href="../${escapeHtml(next.id)}/">下一篇 →</a>` : '<a href="../">返回目录 →</a>';
  const body = `<main><p class="meta">${escapeHtml(group.stageTitle)} · ${escapeHtml(group.title)} · ${escapeHtml(seo.location)}</p><h1>${escapeHtml(detail.title)}</h1><article class="reading">${paragraphs}</article><nav class="page-nav" aria-label="课文导航">${previousLink}${nextLink}</nav></main>`;
  return pageShell({
    title: seo.title, description: seo.description, keywords: seo.keywords, canonicalUrl, body,
    structuredData: JSON.stringify({
      "@context": "https://schema.org", "@type": ["LearningResource", "Article"], headline: seo.title, name: detail.title,
      description: seo.description, keywords: seo.keywords, inLanguage: "en",
      learningResourceType: ["\u6559\u6750\u8bfe\u6587", "\u82f1\u8bed\u9605\u8bfb"], educationalUse: ["\u9884\u4e60", "\u590d\u4e60", "\u8ddf\u8bfb"],
      educationalLevel: group.stageTitle, teaches: detail.title,
      publisher: { "@type": "Organization", name: "\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793e" },
      provider: { "@type": "Organization", name: "WordTap", url: `${siteUrl}/` },
      isPartOf: { "@type": "Course", name: `PEP\u4eba\u6559\u7248${seo.bookLabel}\u82f1\u8bed`, url: `${siteUrl}/pep-english/` },
      position: detail.sequenceNo, url: canonicalUrl,
    }),
    activeCourse: "pep-english", depth: 2, toolHref: lessonToolHref("pep-english", detail.id), toolLabel: "在 WordTap 中学习",
  });
}

function indexPage() {
  const seoTitle = "\u4eba\u6559\u7248PEP\u82f1\u8bed\u8bfe\u6587\u76ee\u5f55\uff5c\u521d\u4e2d\u9ad8\u4e2d\u6559\u6750\u539f\u6587 - WordTap";
  const seoDescription = `\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793ePEP\u4eba\u6559\u7248\u521d\u4e2d\u3001\u9ad8\u4e2d\u82f1\u8bed\u6559\u6750\u8bfe\u6587\u76ee\u5f55\uff0c\u5df2\u6536\u5f55 ${manifest.availableBookCount}/17 \u518c\u3001${manifest.totalLessons} \u7bc7\u5b8c\u6574\u9605\u8bfb\u3001\u8303\u6587\u548c\u8fde\u8d2f\u5bf9\u8bdd\uff0c\u6309\u5e74\u7ea7\u3001\u518c\u6b21\u3001Unit\u548cSection\u68c0\u7d22\uff0c\u652f\u6301\u70b9\u8bfb\u3001\u67e5\u8bcd\u4e0e\u6717\u8bfb\u3002`;
  const keywords = "\u4eba\u6559\u7248\u82f1\u8bed,PEP\u82f1\u8bed,\u4eba\u6559\u82f1\u8bed,\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793e,\u4eba\u6559\u7248\u521d\u4e2d\u82f1\u8bed,\u4eba\u6559\u7248\u9ad8\u4e2d\u82f1\u8bed,\u521d\u4e2d\u82f1\u8bed\u8bfe\u6587,\u9ad8\u4e2d\u82f1\u8bed\u8bfe\u6587,\u82f1\u8bed\u6559\u6750\u539f\u6587,\u8bfe\u5185\u82f1\u8bed,\u82f1\u8bed\u70b9\u8bfb";
  const stages = [["junior", "初中英语"], ["senior", "高中英语"]].map(([stage, stageTitle]) => {
    const groups = manifest.groups.filter((group) => group.stage === stage).map((group) => {
      const lessons = group.lessons.map((lesson) => `<li><a href="${escapeHtml(lesson.id)}/">${lesson.unitNo ? `Unit ${lesson.unitNo} · ` : ""}${escapeHtml(lesson.section)} · ${escapeHtml(lesson.title)}</a></li>`).join("\n");
      return `<section class="collection-card"><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.subtitle)} · ${group.lessonCount} 篇</p><ol class="lesson-list">${lessons}</ol></section>`;
    }).join("\n");
    return groups ? `<h2>${stageTitle}</h2>${groups}` : "";
  }).join("\n");
  const canonicalUrl = `${siteUrl}/pep-english/`;
  const body = `<main><p class="meta">PEP English · ${manifest.availableBookCount}/17 books</p><h1>人教英语课文</h1><p class="intro">已收录 ${manifest.availableBookCount}/17 册、${manifest.totalLessons} 篇完整阅读、范文和连贯对话。缺失教材不会出现在选择菜单中。</p>${stages}</main>`;
  return pageShell({
    title: seoTitle, description: seoDescription, keywords, canonicalUrl, body,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: seoTitle, description: seoDescription, keywords, url: canonicalUrl },
        {
          "@type": "Course", name: "PEP\u4eba\u6559\u7248\u521d\u9ad8\u4e2d\u82f1\u8bed", alternateName: "PEP English",
          description: seoDescription, educationalLevel: ["\u521d\u4e2d", "\u9ad8\u4e2d"],
          provider: { "@type": "Organization", name: "WordTap", url: `${siteUrl}/` },
          publisher: { "@type": "Organization", name: "\u4eba\u6c11\u6559\u80b2\u51fa\u7248\u793e" },
        },
      ],
    }),
    activeCourse: "pep-english", depth: 1, toolHref: "../", ogType: "website",
  });
}

const allLessons = manifest.groups.flatMap((group) => group.lessons.map((lesson) => ({ group, lesson })));
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
  const entries = [`${siteUrl}/pep-english/`, ...allLessons.map(({ lesson }) => `${siteUrl}/pep-english/${lesson.id}/`)]
    .map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join("\n");
  const sitemapPath = path.join(distDir, "sitemap.xml");
  const sitemap = (await readFile(sitemapPath, "utf8")).replace("</urlset>", `${entries}\n</urlset>`);
  await writeFile(sitemapPath, sitemap, "utf8");
}
console.log(`Generated ${allLessons.length} PEP English pages and updated sitemap.xml.`);
