import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const titles = new Set();
const descriptions = new Set();
assert.equal(new Set(locations).size, locations.length, "Sitemap contains duplicate URLs");
for (const location of locations) {
  const url = new URL(location);
  assert.equal(url.origin, (process.env.SITE_URL ?? "https://wordtap.cn").replace(/\/$/, ""));
  assert.equal(url.search, "", `Sitemap includes a workspace query: ${location}`);
  const html = await readFile(path.join(root, decodeURIComponent(url.pathname), "index.html"), "utf8");
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1];
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
  assert.ok(title, `Missing title: ${location}`);
  const decodedTitle = title.replace(/&(?:amp|lt|gt|quot|#39);/g, "x");
  assert.ok(Array.from(decodedTitle).length <= 70, `Overlong title: ${location}: ${title}`);
  assert.ok(description, `Missing description: ${location}`);
  assert.ok(!titles.has(title), `Duplicate title: ${location}`);
  assert.ok(!descriptions.has(description), `Duplicate description: ${location}`);
  titles.add(title);
  descriptions.add(description);
  assert.equal(canonical, location, `Incorrect canonical: ${location}`);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `Expected one source H1: ${location}`);
  assert.ok(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `Sitemap page disallows indexing: ${location}`);
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    JSON.parse(match[1]);
  }
}
console.log(`Verified ${locations.length} sitemap pages: unique titles and descriptions, title budget, source H1, canonical, robots and JSON-LD.`);
