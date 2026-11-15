import { readFile, writeFile } from "node:fs/promises";

// Actual metadata rollout date, not the build date. Advance only after a real change.
const metadataUpdatedAt = "2026-11-09";
const lessonCourses = new Set(["nce", "shuimu", "postgraduate", "pep-english", "college-english", "cet", "kaoyan-english"]);
const updatedCatalogs = new Set(["college-english", "cet", "kaoyan-english"]);
const sitemapPath = process.argv[2] ?? "dist/sitemap.xml";
const sitemap = await readFile(sitemapPath, "utf8");
let changed = 0;
const result = sitemap.replace(/<url>[\s\S]*?<\/url>/g, (entry) => {
  const loc = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1];
  if (!loc) throw new Error("Missing sitemap location");
  const parts = new URL(loc).pathname.split("/").filter(Boolean);
  if (!(parts.length === 2 && lessonCourses.has(parts[0])) && !(parts.length === 1 && updatedCatalogs.has(parts[0]))) return entry;
  const previous = /<lastmod>([^<]+)<\/lastmod>/.exec(entry)?.[1];
  if (previous && previous.slice(0, 10) >= metadataUpdatedAt) return entry;
  changed += 1;
  return previous ? entry.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${metadataUpdatedAt}</lastmod>`)
    : entry.replace("</loc>", `</loc>\n    <lastmod>${metadataUpdatedAt}</lastmod>`);
});
await writeFile(sitemapPath, result, "utf8");
console.log(`Updated ${changed} sitemap modification dates for the actual ${metadataUpdatedAt} metadata rollout.`);
