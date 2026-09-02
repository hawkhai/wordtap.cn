import { lessonShortCode } from "../src/shared/utils/lessonShortProtocol.js";

const courses = [
  { id: "exam", label: "考试学习" },
  { id: "pep-english", label: "人教英语" },
  { id: "college-english", label: "大学英语" },
  { id: "postgraduate", label: "研究生英语" },
  { id: "cet", label: "英语四六级" },
  { id: "kaoyan-english", label: "考研英语" },
  { id: "nce", label: "新概念英语" },
  { id: "shuimu", label: "水木英语" },
];

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function xmlEscape(value) {
  return escapeHtml(value).replaceAll("&#39;", "&apos;");
}

function relativeRoot(depth) {
  return Array.from({ length: depth }, () => "..").join("/");
}

export function lessonToolHref(courseId, lessonId, depth = 2) {
  return `${relativeRoot(depth)}/?l=${lessonShortCode(courseId, lessonId)}#study`;
}

function courseHeader({ activeCourse, depth, toolHref, toolLabel }) {
  const root = relativeRoot(depth);
  const courseLinks = courses
    .map((course) => {
      const active = course.id === activeCourse;
      return `<a class="course-link${active ? " course-link-active" : ""}" href="${root}/${course.id}/"${active ? ' aria-current="page"' : ""}>${course.label}</a>`;
    })
    .join("");

  return `<header class="topbar">
      <a class="brand" href="${root}/"><span>WordTap</span><small>英语课程</small></a>
      <nav class="course-nav" aria-label="英语课程导航">
        ${courseLinks}
        <a class="tool-link" href="${escapeHtml(toolHref)}">${escapeHtml(toolLabel)}</a>
      </nav>
    </header>`;
}

function courseFooter(depth) {
  const root = relativeRoot(depth);
  return `<footer class="site-footer" aria-label="网站底部信息">
      <div class="feedback-row">
        <span class="feedback-label">意见反馈：</span>
        <a href="https://github.com/hawkhai/wordtap.cn/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
      </div>
      <nav class="footer-links" aria-label="网站相关链接">
        <a href="${root}/exam/">考试学习</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/pep-english/">人教英语</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/college-english/">大学英语</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/postgraduate/">研究生英语</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/cet/">英语四六级</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/kaoyan-english/">考研英语</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/nce/">新概念英语</a>
        <span aria-hidden="true">·</span>
        <a href="${root}/shuimu/">水木英语</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/hawkhai/wordtap.cn" target="_blank" rel="noopener noreferrer">项目源码</a>
        <span aria-hidden="true">·</span>
        <span>粤ICP备17134686号-3</span>
      </nav>
    </footer>`;
}

const sharedStyles = `
      :root {
        color-scheme: light;
        --wordtap-reading-font-family: "Itim", "Microsoft YaHei UI", "Segoe UI", Arial, sans-serif;
        --wordtap-reading-font-size: 1.5rem;
        --wordtap-reading-line-height: 2.4rem;
        --text-xs: 0.8125rem;
        --text-sm: 0.875rem;
        --text-base: 1rem;
        --text-md: 1.0625rem;
        --text-lg: 1.125rem;
        --title-page: clamp(2rem, 5vw, 3rem);
        --title-section: 1.5rem;
        --title-card: 1.25rem;
        font-family: "Microsoft YaHei UI", "Segoe UI", Arial, sans-serif;
        font-size: 16px;
        color: #1f2937;
        background: #f4f8f6;
      }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; background: linear-gradient(180deg, #edf6f2 0, #f7faf8 220px, #f7faf8 100%); }
      a { color: inherit; }
      .wrap { display: flex; width: min(100% - 36px, 960px); min-height: 100vh; margin: 0 auto; flex-direction: column; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        gap: 18px;
        align-items: center;
        justify-content: space-between;
        min-height: 72px;
        padding: 12px 0;
        border-bottom: 1px solid rgba(190, 214, 204, .86);
        background: rgba(244, 248, 246, .94);
        backdrop-filter: blur(14px);
      }
      .brand { display: inline-flex; flex: none; align-items: baseline; gap: 7px; color: #174b3d; text-decoration: none; }
      .brand span { font-size: 1.375rem; font-weight: 900; letter-spacing: -.025em; }
      .brand small { color: #64748b; font-size: var(--text-xs); font-weight: 700; }
      .course-nav { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; justify-content: flex-end; }
      .course-link, .tool-link {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        padding: 0 12px;
        border: 1px solid #c8dcd4;
        border-radius: 9px;
        background: rgba(255, 255, 255, .82);
        color: #315c50;
        font-size: var(--text-sm);
        font-weight: 750;
        text-decoration: none;
        transition: border-color .16s ease, background .16s ease, color .16s ease, transform .16s ease;
      }
      .course-link:hover, .tool-link:hover { border-color: #5a9a86; transform: translateY(-1px); }
      .course-link-active { border-color: #27735f; background: #e0f0e9; color: #174b3d; box-shadow: inset 0 -2px 0 #27735f; }
      .tool-link { border-color: #1f6754; background: #1f6754; color: #fff; }
      main { flex: 1; padding: 38px 0 56px; }
      .eyebrow, .meta { margin: 0 0 9px; color: #64748b; font-size: var(--text-sm); font-weight: 650; }
      h1 { margin: 0 0 18px; color: #183f35; font-size: var(--title-page); line-height: 1.1; letter-spacing: -.01em; }
      h2 { margin: 0 0 10px; color: #205746; font-size: var(--title-section); line-height: 1.25; }
      .intro, .question {
        margin: 0 0 24px;
        padding: 14px 16px;
        border: 1px solid #c9e0d7;
        border-left: 4px solid #2f806a;
        border-radius: 0 10px 10px 0;
        background: #e8f4ef;
        color: #244f43;
        font-size: var(--text-base);
        line-height: 1.72;
      }
      .collection-card, .reading, .lesson-text {
        margin-top: 18px;
        padding: 26px;
        border: 1px solid #d2e1db;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 14px 38px rgba(28, 75, 61, .07);
      }
      .collection-card + .collection-card { margin-top: 16px; }
      .collection-card h2 { font-size: var(--title-card); }
      .collection-card > p { margin: 0 0 15px; color: #64748b; font-size: var(--text-base); line-height: 1.65; }
      .lesson-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 8px 24px; margin-bottom: 0; padding-left: 24px; }
      .lesson-list li { min-width: 0; padding-right: 8px; }
      .lesson-list a { display: inline-block; max-width: 100%; padding: 5px 0; color: #246b58; font-size: var(--text-base); overflow-wrap: anywhere; text-decoration-thickness: 1px; text-underline-offset: 3px; }
      .reading, .lesson-text { font-family: var(--wordtap-reading-font-family); }
      .reading p, .lesson-text p {
        margin: 0 0 .8rem;
        font-size: var(--wordtap-reading-font-size);
        line-height: var(--wordtap-reading-line-height);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .reading p:last-child, .lesson-text p:last-child { margin-bottom: 0; }
      .reading .heading { margin: 28px 0 12px; color: #205746; font-size: 1.65rem; font-weight: 850; }
      .reading .heading:first-child { margin-top: 0; }
      .reading .subheading { margin-top: 20px; color: #2b715d; font-weight: 800; }
      .reading .list { padding-left: 14px; border-left: 2px solid #9ecbbc; }
      .reading p.zh { margin-top: -3px; padding: 10px 12px; border-left: 3px solid #9ecbbc; background: #f1f8f5; color: #315c50; }
      .videos { margin: 0 0 22px; padding: 20px; border: 1px solid #ead6a4; border-radius: 12px; background: #fffbeb; }
      .videos h2 { margin-top: 0; color: #854d0e; }
      .video-list { display: grid; gap: 10px; }
      .video { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px; border-radius: 9px; background: #fff; text-decoration: none; }
      .video span:last-child { flex: none; color: #92400e; font-size: var(--text-sm); }
      .page-nav { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-top: 22px; }
      .page-nav a { padding: 9px 12px; border: 1px solid #c8dcd4; border-radius: 9px; background: #fff; color: #245f4f; font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
      .site-footer {
        display: grid;
        flex: none;
        justify-content: center;
        gap: 7px;
        padding: 18px 0 12px;
        border-top: 1px solid rgba(96, 120, 105, .2);
        color: #5e7167;
        font-size: var(--text-sm);
        text-align: center;
      }
      .feedback-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 7px; }
      .feedback-label { font-weight: 600; }
      .feedback-row a { color: #0f5a45; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
      .footer-links { color: #738279; font-size: var(--text-xs); line-height: 1.8; }
      .footer-links a { color: #0f5a45; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
      .footer-links span { margin: 0 5px; }
      @media (max-width: 767px) {
        .topbar { position: static; align-items: stretch; flex-direction: column; gap: 10px; padding: 16px 0; }
        .brand { justify-content: center; }
        .course-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .course-link, .tool-link { padding: 0 8px; }
        main { padding-top: 28px; }
      }
      @media (max-width: 520px) {
        :root {
          --title-page: clamp(1.85rem, 9vw, 2.35rem);
          --title-section: 1.35rem;
        }
        .wrap { width: min(100% - 24px, 960px); }
        .collection-card, .reading, .lesson-text { padding: 20px 15px; }
        .lesson-list { display: block; padding-left: 22px; }
        .lesson-list li + li { margin-top: 5px; }
        .video { align-items: flex-start; flex-direction: column; }
      }`;

export function pageShell({
  title,
  description,
  keywords = "",
  canonicalUrl,
  body,
  structuredData,
  activeCourse,
  depth,
  toolHref,
  toolLabel = "进入学习工具",
  extraStyles = "",
  ogType = "article",
}) {
  const root = relativeRoot(depth);
  const canonicalTag = canonicalUrl ? `\n    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : "";
  const ogUrl = canonicalUrl ? `\n    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">` : "";
  const keywordsTag = keywords ? `\n    <meta name="keywords" content="${escapeHtml(keywords)}">` : "";
  const safeStructuredData = String(structuredData ?? "").replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <meta name="description" content="${escapeHtml(description)}">${keywordsTag}
    <meta name="author" content="WordTap">
    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">${ogUrl}
    <meta property="og:site_name" content="WordTap">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">${canonicalTag}
    <link rel="icon" href="${root}/favicon.ico" sizes="any">
    <link rel="icon" href="${root}/favicon-512.png" type="image/png" sizes="512x512">
    <title>${escapeHtml(title)}</title>
    <script type="application/ld+json">${safeStructuredData}</script>
    <style>@font-face {
        font-family: "Itim";
        src: url("${root}/fonts/Itim/Itim-Regular.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
${sharedStyles}
${extraStyles}
    </style>
  </head>
  <body>
    <div class="wrap">
      ${courseHeader({ activeCourse, depth, toolHref, toolLabel })}
      ${body}
      ${courseFooter(depth)}
    </div>
  </body>
</html>
`;
}
