import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const tokens = (await readFile(new URL("../src/design-tokens.css", import.meta.url), "utf8")).trim();
const sections = ["nce", "shuimu", "postgraduate", "pep-english", "college-english", "cet", "kaoyan-english", "exam", "install"];
let count = 0;
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await verify(file);
    else if (entry.name.endsWith(".html")) {
      const html = await readFile(file, "utf8");
      const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
      assert.ok(styles.includes(tokens), `${file}: shared design tokens missing`);
      assert.match(styles, /background:\s*var\(--wt-background\)/, `${file}: page theme missing`);
      assert.match(styles, /width:\s*min\(calc\(100% - 48px\), var\(--wt-content-max-width\)\)/, `${file}: shared page width missing`);
      assert.doesNotMatch(styles, /960px/, `${file}: legacy page width remains`);
      assert.doesNotMatch(styles, /#(?:1f6754|27735f|edf6f2|d2e1db)\b/i, `${file}: legacy green theme remains`);
      count++;
    }
  }
}
for (const section of sections) await verify(resolve("dist", section));
assert.ok(count > 0, "No generated static pages verified");
console.log(`Verified shared CF Design theme in ${count} static pages across ${sections.length} sections.`);
