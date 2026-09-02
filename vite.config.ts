import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { siteCopy } from "./src/shared/copy/siteCopy";

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function structuredDataJson(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteCopy.brand.fullName,
    url: "https://wordtap.cn/",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    inLanguage: ["zh-CN", "en"],
    description: siteCopy.metadata.jsonLdDescription,
    image: siteCopy.metadata.socialImageUrl,
    screenshot: siteCopy.metadata.socialImageUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
    featureList: siteCopy.metadata.featureList,
  }).replaceAll("<", "\\u003c");
}

function seoFallbackHtml(): string {
  const metadata = siteCopy.metadata;
  const items = metadata.featureList.map((item) => `<li>${escapeHtmlText(item)}</li>`).join("");
  return [
    '<section class="seo-fallback">',
    `<h1>${escapeHtmlText(metadata.fallbackTitle)}</h1>`,
    `<p>${escapeHtmlText(metadata.fallbackDescription)}</p>`,
    `<ul>${items}</ul>`,
    "</section>",
  ].join("");
}

function replaceMetaContent(html: string, key: "name" | "property", value: string, content: string): string {
  const escapedContent = escapeHtmlAttribute(content);
  const pattern = new RegExp(`(<meta\\s+${key}="${value}"\\s+content=")[^"]*(")`, "i");
  const next = html.replace(pattern, `$1${escapedContent}$2`);
  if (next === html) {
    throw new Error(`Unable to inject SEO copy for meta ${key}="${value}".`);
  }
  return next;
}

function replaceRequired(html: string, pattern: RegExp, replacement: string, label: string): string {
  const next = html.replace(pattern, replacement);
  if (next === html) {
    throw new Error(`Unable to inject SEO copy for ${label}.`);
  }
  return next;
}

function injectSeoCopy(html: string): string {
  const metadata = siteCopy.metadata;
  return [
    (next: string) => replaceRequired(next, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlText(metadata.title)}</title>`, "title"),
    (next: string) => replaceMetaContent(next, "name", "description", metadata.description),
    (next: string) => replaceMetaContent(next, "name", "keywords", metadata.keywords),
    (next: string) => replaceMetaContent(next, "property", "og:site_name", siteCopy.brand.fullName),
    (next: string) => replaceMetaContent(next, "property", "og:title", metadata.ogTitle),
    (next: string) => replaceMetaContent(next, "property", "og:description", metadata.ogDescription),
    (next: string) => replaceMetaContent(next, "property", "og:image", metadata.socialImageUrl),
    (next: string) => replaceMetaContent(next, "property", "og:image:secure_url", metadata.socialImageUrl),
    (next: string) => replaceMetaContent(next, "property", "og:image:type", metadata.socialImageType),
    (next: string) => replaceMetaContent(next, "property", "og:image:alt", metadata.socialImageAlt),
    (next: string) => replaceMetaContent(next, "name", "twitter:title", metadata.twitterTitle),
    (next: string) => replaceMetaContent(next, "name", "twitter:description", metadata.twitterDescription),
    (next: string) => replaceMetaContent(next, "name", "twitter:image", metadata.socialImageUrl),
    (next: string) => replaceMetaContent(next, "name", "twitter:image:alt", metadata.socialImageAlt),
    (next: string) =>
      replaceRequired(
        next,
        /<script\s+id="structured-data"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
        `<script id="structured-data" type="application/ld+json">${structuredDataJson()}</script>`,
        "structured data",
      ),
    (next: string) =>
      replaceRequired(
        next,
        /<noscript\s+id="seo-fallback">[\s\S]*?<\/noscript>/i,
        `<noscript id="seo-fallback">${seoFallbackHtml()}</noscript>`,
        "SEO fallback",
      ),
  ].reduce((next, transform) => transform(next), html);
}

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    hmr: {
      host: "localhost",
      protocol: "ws",
      clientPort: 5173,
    },
  },
  plugins: [
    {
      name: "wordtap-seo-copy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) {
            next();
            return;
          }

          const pathname = new URL(req.url, "http://localhost").pathname;
          const parts = pathname.split("/").filter(Boolean);
          const sectionIndex = parts.findIndex((part) => part === "pep-english" || part === "nce" || part === "shuimu" || part === "postgraduate" || part === "college-english" || part === "cet" || part === "kaoyan-english" || part === "install");
          if (sectionIndex < 0) {
            next();
            return;
          }

          const section = parts[sectionIndex];
          const rest = parts.slice(sectionIndex + 1);
          const lastPart = rest.at(-1) ?? "";
          if (lastPart.includes(".")) {
            next();
            return;
          }

          const htmlPath = path.join(process.cwd(), "dist", section, ...rest, "index.html");
          try {
            const html = await readFile(htmlPath, "utf8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          } catch {
            next();
          }
        });
      },
      transformIndexHtml: {
        order: "pre",
        handler: injectSeoCopy,
      },
    },
    vue(),
    tailwindcss(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
