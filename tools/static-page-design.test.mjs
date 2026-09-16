import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageShell } from "./course-page-shared.mjs";

test("static pages embed the same design tokens as the Vue workspace", () => {
  const tokens = readFileSync(new URL("../src/design-tokens.css", import.meta.url), "utf8");
  for (const depth of [1, 2, 3]) {
    const html = pageShell({ title: "Design regression", description: "Test", depth,
      body: '<main><article class="reading"><p>Read English.</p></article></main>',
      extraStyles: ".fixture { display: grid; }" });
    assert.ok(html.includes(tokens.trim()));
    assert.match(html, /body\s*\{[^}]*background:\s*var\(--wt-background\)/);
    assert.match(html, /\.tool-link\s*\{[^}]*background:\s*var\(--wt-primary\)/);
    assert.match(html, /:focus-visible/);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /width:\s*min\(calc\(100% - 48px\), var\(--wt-content-max-width\)\)/);
    assert.doesNotMatch(html, /960px/);
    assert.match(html, /\.fixture \{ display: grid; \}/);
    assert.ok(html.includes(`${Array(depth).fill("..").join("/")}/fonts/Itim/Itim-Regular.ttf`));
  }
});
