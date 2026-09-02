import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, lessonToolHref, pageShell, xmlEscape } from "./course-page-shared.mjs";

const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const sectionDir = path.join(distDir, "postgraduate");
const manifest = JSON.parse(await readFile(path.join(sectionDir, "manifest.json"), "utf8"));

function volumeSeoName(volume) {
  if (volume.id === "volume1") return "研究生英语综合教程上册";
  if (volume.id === "volume2") return "研究生英语综合教程下册";
  if (volume.id === "reading-writing-translation") return "研究生英语读写译教程（第二版）";
  return `研究生英语${volume.title}`;
}

function volumeEditor(volume) {
  return volume.id === "reading-writing-translation" ? "李知宇" : "熊海虹";
}

function lessonSeo(volume, detail) {
  const textLabel = detail.textLabel ? ` ${detail.textLabel}` : "";
  const author = detail.author ? `，作者 ${detail.author}` : "";
  const languageLabel = volume.languageMode === "bilingual" ? "中英双语" : "英文";
  const bookName = volumeSeoName(volume);
  const editor = volumeEditor(volume);
  const bookSeries = volume.id === "reading-writing-translation" ? "研究生英语读写译教程" : "研究生英语综合教程";
  const title = `${bookName} 第${detail.unitNo}单元${textLabel} ${detail.title}｜${languageLabel}课文、翻译与朗读 - WordTap`;
  const description = `${editor}主编的《${bookName}》第${detail.unitNo}单元${textLabel}《${detail.title}》${author}，主题：${detail.theme}。提供${languageLabel}课文阅读、${volume.languageMode === "bilingual" ? "中文翻译、" : ""}单词点读查义与全文朗读，适合研究生公共英语教材预习、复习和跟读。`;
  const keywords = [
    "研究生英语",
    bookSeries,
    "研究生公共英语",
    bookName,
    editor,
    `${editor}主编`,
    `第${detail.unitNo}单元`,
    detail.textLabel,
    detail.title,
    detail.theme,
    detail.author,
    `${languageLabel}课文`,
    volume.languageMode === "bilingual" ? "课文翻译" : "",
    "英语点读",
    "英语朗读",
  ].filter(Boolean).join(",");
  return { title, description, keywords, bookName, editor };
}

function lessonPage(volume, detail, previous, next) {
  const articleLabel = detail.textLabel ? ` ${detail.textLabel}` : "";
  const authorLabel = detail.author ? ` · ${detail.author}` : "";
  const bilingual = volume.languageMode === "bilingual";
  const seo = lessonSeo(volume, detail);
  const canonicalUrl = `${siteUrl}/postgraduate/${detail.id}/`;
  const paragraphs = detail.blocks
    .map((block) => `<p class="${escapeHtml(block.lang)}" lang="${block.lang === "zh" ? "zh-CN" : "en"}">${escapeHtml(block.text)}</p>`)
    .join("\n");
  const previousLink = previous ? `<a href="../${escapeHtml(previous.id)}/">← 上一篇</a>` : `<a href="../">← 返回目录</a>`;
  const nextLink = next ? `<a href="../${escapeHtml(next.id)}/">下一篇 →</a>` : `<a href="../">返回目录 →</a>`;
  const body = `<main><p class="meta">${escapeHtml(volume.title)} · 第 ${detail.unitNo} 单元${escapeHtml(articleLabel)} · ${escapeHtml(detail.theme)}${escapeHtml(authorLabel)}</p><h1>${escapeHtml(detail.title)}</h1><article class="reading">${paragraphs}</article><nav class="page-nav" aria-label="课文导航">${previousLink}${nextLink}</nav></main>`;
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
      keywords: seo.keywords,
      inLanguage: bilingual ? ["en", "zh-CN"] : "en",
      learningResourceType: "教材课文",
      educationalUse: ["预习", "复习", "阅读", "跟读"],
      educationalLevel: "研究生",
      teaches: detail.theme,
      author: detail.author ? { "@type": "Person", name: detail.author } : undefined,
      editor: { "@type": "Person", name: seo.editor },
      provider: { "@type": "Organization", name: "WordTap", url: siteUrl },
      isPartOf: { "@type": "Course", name: seo.bookName, editor: { "@type": "Person", name: seo.editor }, url: `${siteUrl}/postgraduate/` },
      position: detail.unitNo,
      url: canonicalUrl,
    }),
    activeCourse: "postgraduate",
    depth: 2,
    toolHref: lessonToolHref("postgraduate", detail.id),
    toolLabel: "在 WordTap 中学习",
  });
}

function indexPage() {
  const coverage = `${manifest.totalLessons}/${manifest.expectedTotalLessons}`;
  const seoTitle = "研究生英语课文大全｜综合教程、读写译教程原文翻译与朗读 - WordTap";
  const seoDescription = `研究生英语教材课文目录，收录熊海虹主编的《研究生英语综合教程》上、下册，以及李知宇主编的《研究生英语读写译教程》，当前共 ${coverage} 篇。提供中英双语原文、中文翻译、点读查词和全文朗读。`;
  const keywords = ["研究生英语", "研究生英语课文", "研究生英语综合教程", "熊海虹", "熊海虹主编", "熊海虹研究生英语综合教程", "研究生英语综合教程上册", "研究生英语综合教程下册", "研究生英语读写译教程", "李知宇", "李知宇主编", "李知宇研究生英语读写译教程", "研究生公共英语", "英语课文翻译", "中英双语课文", "英语点读", "英语朗读"].join(",");
  const volumeHtml = manifest.volumes.map((volume) => {
    const lessons = volume.lessons.map((lesson) => `<li><a href="${escapeHtml(lesson.id)}/">第 ${lesson.unitNo} 单元${lesson.textLabel ? ` · ${escapeHtml(lesson.textLabel)}` : ""} · ${escapeHtml(lesson.title)}${lesson.author ? ` · ${escapeHtml(lesson.author)}` : ""}</a></li>`).join("\n");
    return `<section class="collection-card"><h2>${escapeHtml(volumeSeoName(volume))}</h2><p>${escapeHtml(volumeEditor(volume))}主编 · ${escapeHtml(volume.subtitle)}</p><ol class="lesson-list">${lessons}</ol></section>`;
  }).join("\n");
  const canonicalUrl = `${siteUrl}/postgraduate/`;
  const missingNotice = manifest.complete
    ? ""
    : `<p class="intro">当前教材目录覆盖 ${coverage} 篇；缺失单元会在取得可再分发的合法文本后补入。</p>`;
  const body = `<main><p class="meta">English for Postgraduates · ${coverage} articles</p><h1>研究生英语课文</h1><p class="intro">熊海虹主编的《研究生英语综合教程》提供上、下册中英对照课文；李知宇主编的《研究生英语读写译教程》提供英文正文。点击课文可阅读独立页面，也可直接进入 WordTap 点读、查词和朗读。</p>${missingNotice}${volumeHtml}</main>`;
  return pageShell({
    title: seoTitle,
    description: seoDescription,
    keywords,
    canonicalUrl,
    body,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: seoTitle, description: seoDescription, keywords, url: canonicalUrl, mainEntity: { "@id": `${canonicalUrl}#course` } },
        { "@id": `${canonicalUrl}#course`, "@type": "Course", name: "研究生英语", description: seoDescription, educationalLevel: "研究生", provider: { "@type": "Organization", name: "WordTap", url: siteUrl }, hasPart: manifest.volumes.map((volume) => ({ "@type": "LearningResource", name: volumeSeoName(volume), editor: { "@type": "Person", name: volumeEditor(volume) } })), hasCourseInstance: manifest.volumes.map((volume) => ({ "@type": "CourseInstance", name: volumeSeoName(volume), courseMode: "online" })) },
      ],
    }),
    activeCourse: "postgraduate",
    depth: 1,
    toolHref: "../",
    ogType: "website",
  });
}

const allLessons = manifest.volumes.flatMap((volume) => volume.lessons.map((lesson) => ({ volume, lesson })));
for (let index = 0; index < allLessons.length; index += 1) {
  const { volume, lesson } = allLessons[index];
  const detail = JSON.parse(await readFile(path.join(distDir, lesson.jsonPath), "utf8"));
  const pageDir = path.join(sectionDir, lesson.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "index.html"), lessonPage(volume, detail, allLessons[index - 1]?.lesson, allLessons[index + 1]?.lesson), "utf8");
}

await writeFile(path.join(sectionDir, "index.html"), indexPage(), "utf8");

if (siteUrl) {
  const lastmod = new Date(manifest.generatedAt).toISOString().slice(0, 10);
  const entries = [`${siteUrl}/postgraduate/`, ...allLessons.map(({ lesson }) => `${siteUrl}/postgraduate/${lesson.id}/`)]
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

console.log(`Generated ${allLessons.length} postgraduate English pages${siteUrl ? " and updated sitemap.xml" : ""}.`);
