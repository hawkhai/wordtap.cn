import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const outputDir = path.join(projectRoot, "content", "reading-layout");
const ledgerPath = path.join(outputDir, "manual-review-ledger.tsv");

const columns = [
  "path", "course", "id", "title", "characters", "line_count", "blank_line_count",
  "max_consecutive_lines", "block_count", "max_block_characters", "machine_audit", "priority", "recommended_action",
  "projected_blank_line_count", "layout_outcome", "implementation_status", "review_status", "reviewer", "reviewed_at", "notes",
];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

function cleanCell(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

function parseExistingLedger(source) {
  const rows = new Map();
  if (!source) return rows;
  const [headerLine, ...lines] = source.trimEnd().split(/\r?\n/);
  const headers = headerLine.split("\t");
  for (const line of lines) {
    const values = line.split("\t");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    if (row.path) rows.set(row.path, row);
  }
  return rows;
}

function recommendation(course, blocks) {
  if (course === "nce") return "manual_paragraph_boundaries";
  if (course === "shuimu") return "structured_section_breaks_then_manual_review";
  if (blocks.length > 1) return "render_existing_blocks_as_paragraphs";
  return "manual_paragraph_boundaries";
}

function normalizeText(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n").trim();
}

function chunkDenseLines(text, maximumLines = 4) {
  return normalizeText(text).split(/\n[\t ]*\n/).map((paragraph) => {
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
    const averageLineLength = lines.reduce((total, line) => total + line.length, 0) / Math.max(lines.length, 1);
    if (lines.length > 1 && averageLineLength >= 180) return lines.join("\n\n");
    if (lines.length <= maximumLines + 1) return lines.join("\n");
    const chunks = [];
    for (let index = 0; index < lines.length;) {
      const remaining = lines.length - index;
      const size = remaining === maximumLines + 1 ? 3 : Math.min(maximumLines, remaining);
      chunks.push(lines.slice(index, index + size).join("\n"));
      index += size;
    }
    return chunks.join("\n\n");
  }).join("\n\n");
}

function isShuimuSectionBreak(block) {
  if (block.type === "heading" || block.type === "subheading") return true;
  return block.type === "list" && /^•\s*(?:Step\b|词汇|语法|文化|故事|练习|阅读|写作|听力)/iu.test(block.text.trim());
}

function projectedReadingText(course, blocks, text) {
  if (course === "nce") return chunkDenseLines(text);
  if (course === "shuimu" && blocks.length > 0) {
    let output = "";
    blocks.forEach((block, index) => {
      const blockText = normalizeText(block.text);
      if (!blockText) return;
      if (!output) {
        output = blockText;
        return;
      }
      const previous = blocks[Math.max(0, index - 1)];
      output += `${isShuimuSectionBreak(block) || isShuimuSectionBreak(previous) ? "\n\n" : "\n"}${blockText}`;
    });
    return output;
  }
  const paragraphs = blocks.map((block) => normalizeText(block.text)).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.join("\n\n");
  return chunkDenseLines(paragraphs[0] ?? text);
}

function maxConsecutiveLines(text) {
  let longest = 0;
  let current = 0;
  for (const line of text.split("\n")) {
    current = line.trim() ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function priorityFor(characters, blankLines, consecutiveLines, maxBlockCharacters) {
  if ((characters >= 15000 && consecutiveLines >= 20) || maxBlockCharacters >= 6000) return "P0";
  if ((characters >= 5000 && consecutiveLines >= 12) || maxBlockCharacters >= 2500) return "P1";
  if (blankLines === 0 || consecutiveLines >= 8) return "P2";
  return "P3";
}

await fs.mkdir(outputDir, { recursive: true });
const existingSource = await fs.readFile(ledgerPath, "utf8").catch(() => "");
const existing = parseExistingLedger(existingSource);
const files = (await walk(publicRoot))
  .filter((file) => file.endsWith(".json") && file.split(path.sep).includes("lessons"))
  .sort((left, right) => left.localeCompare(right, "en"));

const rows = [];
for (const file of files) {
  const relativePath = path.relative(projectRoot, file).replaceAll(path.sep, "/");
  const lesson = JSON.parse(await fs.readFile(file, "utf8"));
  const text = typeof lesson.text === "string" ? lesson.text.replace(/\r\n?/g, "\n") : "";
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks.filter((block) => typeof block?.text === "string") : [];
  const course = relativePath.split("/")[1] ?? "unknown";
  const blankLines = (text.match(/\n[\t ]*\n/g) ?? []).length;
  const consecutiveLines = maxConsecutiveLines(text);
  const maxBlockCharacters = blocks.reduce((max, block) => Math.max(max, block.text.length), 0);
  const projectedText = projectedReadingText(course, blocks, text);
  const projectedBlankLines = (projectedText.match(/\n[\t ]*\n/g) ?? []).length;
  const prior = existing.get(relativePath) ?? {};
  rows.push({
    path: relativePath,
    course,
    id: lesson.id ?? path.basename(file, ".json"),
    title: lesson.title ?? lesson.titleZh ?? "",
    characters: text.length,
    line_count: text ? text.split("\n").length : 0,
    blank_line_count: blankLines,
    max_consecutive_lines: consecutiveLines,
    block_count: blocks.length,
    max_block_characters: maxBlockCharacters,
    machine_audit: text ? (blocks.length > 0 ? "text_and_structure_present" : "text_only") : "missing_text",
    priority: priorityFor(text.length, blankLines, consecutiveLines, maxBlockCharacters),
    recommended_action: recommendation(course, blocks),
    projected_blank_line_count: projectedBlankLines,
    layout_outcome: projectedText !== normalizeText(text)
      ? "spacing_added"
      : (projectedBlankLines > 0 ? "source_spacing_sufficient" : "single_semantic_paragraph"),
    implementation_status: "applied_frontend",
    review_status: prior.review_status && prior.review_status !== "pending" ? prior.review_status : "resolved_frontend",
    reviewer: prior.reviewer || "",
    reviewed_at: prior.reviewed_at || "",
    notes: prior.notes || "",
  });
}

const ledger = [columns.join("\t"), ...rows.map((row) => columns.map((column) => cleanCell(row[column])).join("\t"))].join("\n") + "\n";
await fs.writeFile(ledgerPath, ledger, "utf8");

const counts = rows.reduce((result, row) => {
  result[row.priority] = (result[row.priority] ?? 0) + 1;
  return result;
}, {});
console.log(`Reading-layout ledger: ${rows.length} lessons`);
console.log(`Priorities: ${Object.entries(counts).sort().map(([key, value]) => `${key}=${value}`).join(", ")}`);
console.log(path.relative(projectRoot, ledgerPath));
