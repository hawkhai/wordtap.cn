import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lessonsRoot = path.join(projectRoot, "public", "shuimu", "lessons");
const markerPattern = /^第[一二三四五六七八九十百零〇两\d]+单元$/u;

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
}

let changed = 0;
for (const file of (await walk(lessonsRoot)).filter((item) => item.endsWith(".json"))) {
  const detail = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(detail.blocks) || !markerPattern.test(detail.blocks.at(-1)?.text ?? "")) continue;

  detail.blocks.pop();
  detail.text = detail.blocks.map((block) => block.text).join("\n");
  await fs.writeFile(file, `${JSON.stringify(detail, null, 2)}\n`, "utf8");
  changed += 1;
}

console.log(`Removed trailing unit markers from ${changed} Shuimu lessons.`);
