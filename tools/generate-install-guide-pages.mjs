import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { escapeHtml, pageShell, xmlEscape } from "./course-page-shared.mjs";

const siteUrl = (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, "");
const distDir = path.join(process.cwd(), "dist");
const installDir = path.join(distDir, "install");
const generatedAt = new Date().toISOString();

const gatewayDownloadStep = {
  image: "gateway.jpg",
  width: 1089,
  height: 108,
  title: "确认下载已完成",
  text: "浏览器底部或下载列表里出现安装包后，点击文件名即可开始安装。请确认文件名和你刚才点击的下载按钮一致。",
};

const setupDownloadStep = {
  image: "setup.jpg",
  width: 1098,
  height: 101,
  title: "确认下载已完成",
  text: "浏览器底部或下载列表里出现安装包后，点击文件名即可开始安装。请确认文件名和你刚才点击的下载按钮一致。",
};

const guides = [
  {
    id: "gateway",
    title: "WordTap 全文朗读服务安装指引",
    shortTitle: "全文朗读服务",
    fileName: "WordTapGatewaySetup.exe",
    downloadHref: "../../downloads/WordTapGatewaySetup.exe",
    canonicalPath: "/install/gateway/",
    description:
      "WordTap 全文朗读服务 WordTapGatewaySetup.exe 的 Windows 10 安装说明，解释 SmartScreen 风险提示，并用截图指引用户完成安装、开机启动和卸载入口确认。",
    keywords: "WordTapGatewaySetup.exe,WordTap全文朗读服务,Windows 10安装,SmartScreen,仍要运行,WordTap安装说明",
    heroLead:
      "如果 Windows 10 出现 SmartScreen 提示，请先核对下载来源和文件名。确认无误后，可按下面步骤继续安装。",
    reassure: [
      "只从 WordTap 官方 HTTPS 页面下载。",
      "文件名应为 WordTapGatewaySetup.exe。",
      "安装完成后可在 Windows 系统设置中卸载。",
    ],
    asideTitle: "它负责什么？",
    asideText: "全文朗读服务在本机 127.0.0.1 端口提供语音能力，让 WordTap 网页可以进行更稳定的全文朗读。",
    steps: [
      gatewayDownloadStep,
      {
        image: "01.jpg",
        width: 934,
        height: 878,
        title: "看到 Windows 保护提示",
        text: "在提示页点击“更多信息”。",
      },
      {
        image: "02.jpg",
        width: 934,
        height: 878,
        title: "选择“仍要运行”",
        text: "确认文件名无误后，点击“仍要运行”。",
      },
      {
        image: "03.jpg",
        width: 902,
        height: 626,
        title: "进入安装向导",
        text: "看到 WordTap 全文朗读服务安装界面后，继续下一步。",
      },
      {
        image: "05.jpg",
        width: 902,
        height: 626,
        title: "保留开机启动",
        text: "建议保留开机启动，这样打开 WordTap 网页时，全文朗读服务更容易自动可用。",
      },
      {
        image: "06.jpg",
        width: 902,
        height: 626,
        title: "完成安装",
        text: "安装完成后回到 WordTap 页面，稍等片刻，网页会自动检测本地服务状态。",
      },
    ],
    otherGuideHref: "../windows/",
    otherGuideLabel: "查看 Windows 桌面版安装",
  },
  {
    id: "windows",
    title: "WordTap Windows 桌面版安装指引",
    shortTitle: "Windows 桌面版",
    fileName: "WordTap-Setup.exe",
    downloadHref: "../../downloads/WordTap-Setup.exe",
    canonicalPath: "/install/windows/",
    description:
      "WordTap Windows 桌面版 WordTap-Setup.exe 的 Windows 10 安装说明，解释 SmartScreen 风险提示，并用截图指引用户完成安装、首次运行、点词听读和卸载入口确认。",
    keywords: "WordTap-Setup.exe,WordTap Windows桌面版,Windows 10安装,SmartScreen,仍要运行,点词听读",
    heroLead:
      "如果 Windows 10 出现 SmartScreen 提示，请先核对下载来源和文件名。确认无误后，可按下面步骤继续安装。",
    reassure: [
      "只从 WordTap 官方 HTTPS 页面下载。",
      "文件名应为 WordTap-Setup.exe。",
      "安装完成后可在 Windows 系统设置中卸载。",
    ],
    asideTitle: "桌面版适合什么？",
    asideText: "桌面版更适合长期使用、离线学习和本地阅读。网页点词能力仍然保留，桌面版提供另一种更稳定的入口。",
    steps: [
      setupDownloadStep,
      {
        image: "11.jpg",
        width: 934,
        height: 878,
        title: "看到 Windows 保护提示",
        text: "在提示页点击“更多信息”。",
      },
      {
        image: "12.jpg",
        width: 934,
        height: 878,
        title: "点击“仍要运行”",
        text: "确认文件名无误后，点击“仍要运行”。",
      },
      {
        image: "13.jpg",
        width: 902,
        height: 626,
        title: "开始安装桌面版",
        text: "进入 WordTap 安装向导后，按提示继续。",
      },
      {
        image: "15.jpg",
        width: 902,
        height: 626,
        title: "等待文件写入",
        text: "安装过程中请保持窗口打开，等待进度条完成。",
      },
      {
        image: "16.jpg",
        width: 902,
        height: 626,
        title: "继续等待安装完成",
        text: "不同电脑速度不同，看到进度继续前进即可。",
      },
      {
        image: "17.jpg",
        width: 902,
        height: 626,
        title: "安装完成",
        text: "完成后可以直接启动 WordTap 桌面版。",
      },
      {
        image: "18.jpg",
        width: 1508,
        height: 1211,
        title: "打开运行界面",
        text: "桌面版打开后可以粘贴文章、选择课程内容或继续使用自己的学习文本。",
      },
      {
        image: "19.jpg",
        width: 1508,
        height: 1211,
        title: "点词听读",
        text: "点击英文单词可以查看释义并朗读，适合边读边听、边查边记。",
      },
    ],
    otherGuideHref: "../gateway/",
    otherGuideLabel: "查看全文朗读服务安装",
  },
];

const installStyles = `
      .install-main { padding-top: 32px; }
      .install-main, .install-hero, .install-actions, .install-side, .trust-item, .install-step { min-width: 0; }
      .install-main h1 { letter-spacing: 0; overflow-wrap: anywhere; }
      .install-lead, .install-action, .trust-item, .install-step h3, .install-step p { overflow-wrap: anywhere; }
      .course-link, .tool-link { min-width: 0; white-space: normal; text-align: center; }
      .course-nav { width: 100%; }
      .install-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr);
        gap: 22px;
        align-items: start;
        margin-bottom: 22px;
      }
      .install-kicker { margin: 0 0 10px; color: #9a5b30; font-size: var(--text-sm); font-weight: 800; }
      .install-lead { max-width: 44rem; margin: 0 0 18px; color: #2f4f45; font-size: var(--text-md); line-height: 1.78; }
      .install-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .install-action {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        border: 1px solid #c8dcd4;
        border-radius: 8px;
        background: #fff;
        color: #245f4f;
        font-size: var(--text-sm);
        font-weight: 800;
        text-decoration: none;
        text-align: center;
        min-width: 0;
        max-width: 100%;
      }
      .install-action-primary { border-color: #1f6754; background: #1f6754; color: #fff; }
      .install-action:hover { border-color: #9a5b30; }
      .install-side {
        padding: 18px;
        border: 1px solid #d7dfd8;
        border-radius: 8px;
        background: #fffdf7;
        box-shadow: 0 14px 30px rgba(40, 68, 57, .07);
      }
      .install-side h2 { margin: 0 0 8px; color: #18483b; font-size: var(--title-card); line-height: 1.3; }
      .install-side p { margin: 0; color: #52635c; font-size: var(--text-base); line-height: 1.72; }
      .trust-band {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 0 0 28px;
      }
      .trust-item {
        min-height: 74px;
        padding: 13px 14px;
        border: 1px solid #d5e1dc;
        border-radius: 8px;
        background: #fff;
        color: #294d42;
        font-size: var(--text-base);
        font-weight: 750;
        line-height: 1.55;
      }
      .trust-index {
        display: inline-flex;
        width: 22px;
        height: 22px;
        align-items: center;
        justify-content: center;
        margin-right: 6px;
        border-radius: 999px;
        background: #f0d2b7;
        color: #7b3d1c;
        font-size: var(--text-xs);
        font-weight: 900;
      }
      .install-section-head { margin-bottom: 14px; }
      .install-section-head h2 { margin-bottom: 8px; font-size: var(--title-section); }
      .install-section-head p { margin: 0; color: #60736a; font-size: var(--text-base); line-height: 1.7; }
      .step-list { display: grid; gap: 16px; }
      .install-step {
        display: grid;
        grid-template-columns: minmax(220px, .7fr) minmax(0, 1.3fr);
        gap: 18px;
        align-items: center;
        padding: 18px;
        border: 1px solid #d4e0db;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 12px 26px rgba(35, 72, 60, .06);
      }
      .step-copy { min-width: 0; }
      .step-number {
        display: inline-flex;
        min-width: 34px;
        height: 34px;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
        border-radius: 999px;
        background: #245f4f;
        color: #fff;
        font-size: var(--text-sm);
        font-weight: 900;
      }
      .install-step h3 { margin: 0 0 8px; color: #163f35; font-size: var(--title-card); line-height: 1.3; }
      .install-step p { margin: 0; color: #50645c; font-size: var(--text-base); line-height: 1.76; }
      .install-step figure { margin: 0; min-width: 0; }
      .install-step img {
        display: block;
        width: 100%;
        height: auto;
        border: 1px solid #d8e0dc;
        border-radius: 8px;
        background: #f7faf8;
      }
      .install-step figcaption { margin-top: 7px; color: #75847e; font-size: var(--text-xs); line-height: 1.5; }
      .install-note {
        margin-top: 22px;
        padding: 18px;
        border: 1px solid #ead6a4;
        border-radius: 8px;
        background: #fff8e4;
        color: #664210;
        font-size: var(--text-base);
        line-height: 1.72;
      }
      .install-note strong { color: #7a3f16; }
      @media (max-width: 767px) {
        .install-hero, .install-step { grid-template-columns: 1fr; }
        .install-actions { align-items: stretch; flex-direction: column; }
        .install-action { width: 100%; }
        .trust-band { grid-template-columns: 1fr; }
        .install-main { padding-top: 24px; }
        .tool-link { grid-column: 1 / -1; }
      }
      @media (max-width: 520px) {
        .install-actions { align-items: stretch; flex-direction: column; }
        .install-action { width: 100%; }
        .install-step, .install-side, .install-note { padding: 14px; }
      }`;

function stepHtml(step, index) {
  const imageHref = `../images/${step.image}`;
  return `<article class="install-step">
          <div class="step-copy">
            <span class="step-number">${index + 1}</span>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.text)}</p>
          </div>
          <figure>
            <img src="${escapeHtml(imageHref)}" width="${step.width}" height="${step.height}" alt="${escapeHtml(step.title)}截图" loading="${index < 2 ? "eager" : "lazy"}" decoding="async">
            <figcaption>${escapeHtml(step.image)} · ${step.width} x ${step.height}</figcaption>
          </figure>
        </article>`;
}

function guideHtml(guide) {
  const canonicalUrl = siteUrl ? `${siteUrl}${guide.canonicalPath}` : "";
  const body = `<main class="install-main">
        <section class="install-hero">
          <div>
            <p class="install-kicker">Windows 10 安装提示 · ${escapeHtml(guide.fileName)}</p>
            <h1>${escapeHtml(guide.title)}</h1>
            <p class="install-lead">${escapeHtml(guide.heroLead)}</p>
            <div class="install-actions">
              <a class="install-action install-action-primary" href="${escapeHtml(guide.downloadHref)}" download>重新下载 ${escapeHtml(guide.fileName)}</a>
              <a class="install-action" href="${escapeHtml(guide.otherGuideHref)}">${escapeHtml(guide.otherGuideLabel)}</a>
              <a class="install-action" href="../../">返回 WordTap</a>
            </div>
          </div>
          <aside class="install-side">
            <h2>${escapeHtml(guide.asideTitle)}</h2>
            <p>${escapeHtml(guide.asideText)}</p>
          </aside>
        </section>
        <section class="trust-band" aria-label="安装前确认">
          ${guide.reassure.map((item, index) => `<div class="trust-item"><span class="trust-index">${index + 1}</span>${escapeHtml(item)}</div>`).join("\n          ")}
        </section>
        <section class="install-section-head">
          <h2>按截图一步一步来</h2>
          <p>界面文字可能因 Windows 版本略有不同。按截图确认关键按钮即可。</p>
        </section>
        <section class="step-list" aria-label="${escapeHtml(guide.shortTitle)}安装步骤">
          ${guide.steps.map(stepHtml).join("\n          ")}
        </section>
        <section class="install-note">
          <strong>安全提醒：</strong>请只使用 WordTap 官方页面提供的下载入口。
        </section>
      </main>`;

  return pageShell({
    title: `${guide.title} - WordTap`,
    description: guide.description,
    keywords: guide.keywords,
    canonicalUrl,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: guide.title,
      description: guide.description,
      inLanguage: "zh-CN",
      totalTime: "PT5M",
      tool: [{ "@type": "HowToTool", name: "Windows 10" }],
      supply: [{ "@type": "HowToSupply", name: guide.fileName }],
      provider: { "@type": "Organization", name: "WordTap", url: `${siteUrl}/` },
      step: guide.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
        image: `${siteUrl}/install/images/${step.image}`,
      })),
      url: canonicalUrl,
    }),
    body,
    activeCourse: "install",
    depth: 2,
    toolHref: "../../",
    toolLabel: "进入 WordTap",
    ogType: "article",
    extraStyles: installStyles,
  });
}

async function updateSitemap() {
  if (!siteUrl) return;

  const sitemapPath = path.join(distDir, "sitemap.xml");
  let sitemap;
  try {
    sitemap = await readFile(sitemapPath, "utf8");
  } catch {
    sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;
  }

  const lastmod = generatedAt.slice(0, 10);
  const entries = guides
    .map((guide) => `${siteUrl}${guide.canonicalPath}`)
    .filter((url) => !sitemap.includes(`<loc>${xmlEscape(url)}</loc>`))
    .map((url) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`)
    .join("\n");

  if (!entries) return;
  await writeFile(sitemapPath, sitemap.replace("</urlset>", `${entries}\n</urlset>`), "utf8");
}

for (const guide of guides) {
  const pageDir = path.join(installDir, guide.id);
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "index.html"), guideHtml(guide), "utf8");
}

await updateSitemap();

console.log(`Generated ${guides.length} install guide pages${siteUrl ? " and updated sitemap.xml" : ""}.`);
