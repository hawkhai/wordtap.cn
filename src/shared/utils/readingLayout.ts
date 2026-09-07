export interface ReadingBlock {
  type: string;
  text: string;
}

function normalizeBlockText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function chunkDenseLines(text: string, maximumLines = 4): string {
  return normalizeBlockText(text)
    .split(/\n[\t ]*\n/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
      const averageLineLength = lines.reduce((total, line) => total + line.length, 0) / Math.max(lines.length, 1);
      if (lines.length > 1 && averageLineLength >= 180) return lines.join("\n\n");
      if (lines.length <= maximumLines + 1) return lines.join("\n");

      const chunks: string[] = [];
      for (let index = 0; index < lines.length;) {
        const remaining = lines.length - index;
        const size = remaining === maximumLines + 1 ? 3 : Math.min(maximumLines, remaining);
        chunks.push(lines.slice(index, index + size).join("\n"));
        index += size;
      }
      return chunks.join("\n\n");
    })
    .join("\n\n");
}

/**
 * Some sources expose sentence/turn line breaks but no paragraph blocks (NCE,
 * and a small number of PEP extracts). Keep every source line intact while
 * grouping long uninterrupted runs into short visual reading chunks.
 */
export function formatLineStructuredTextForReading(text: string): string {
  return chunkDenseLines(text);
}

/**
 * Turn the paragraph structure already present in lesson JSON into visible
 * breathing room. The source JSON remains authoritative and untouched.
 */
export function formatProseForReading(blocks: ReadingBlock[], fallbackText: string): string {
  const paragraphs = blocks.map((block) => normalizeBlockText(block.text)).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.join("\n\n");
  if (paragraphs.length === 1) return chunkDenseLines(paragraphs[0]);
  return chunkDenseLines(fallbackText);
}

function isShuimuSectionBreak(block: ReadingBlock): boolean {
  if (block.type === "heading" || block.type === "subheading") return true;
  if (block.type !== "list") return false;

  return /^•\s*(?:Step\b|词汇|语法|文化|故事|练习|阅读|写作|听力)/iu.test(block.text.trim());
}

/**
 * Shuimu blocks are often line-sized vocabulary and exercise items, so adding
 * a paragraph gap between every block would be excessive. Only section-level
 * blocks receive blank-line separation.
 */
export function formatShuimuForReading(blocks: ReadingBlock[], fallbackText: string): string {
  const populated = blocks
    .map((block) => ({ ...block, text: normalizeBlockText(block.text) }))
    .filter((block) => block.text);

  if (populated.length === 0) return normalizeBlockText(fallbackText);

  let output = "";
  populated.forEach((block, index) => {
    if (index === 0) {
      output = block.text;
      return;
    }

    const previous = populated[index - 1];
    const separator = isShuimuSectionBreak(block) || isShuimuSectionBreak(previous) ? "\n\n" : "\n";
    output += `${separator}${block.text}`;
  });
  return output;
}

export function withReadingTitle(title: string, text: string): string {
  const cleanTitle = title.trim();
  const cleanText = normalizeBlockText(text);
  if (!cleanTitle) return cleanText;
  if (!cleanText) return cleanTitle;
  return `${cleanTitle}\n\n${cleanText}`;
}
