import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredHelperUsers = [
  "src/App.vue",
  "src/shared/composables/useWordTap.ts",
];
const courseShellFiles = [
  "src/desktop/components/DesktopShell.vue",
  "src/mobile/components/MobileShell.vue",
];
const allowedBreakpoints = new Set([420, 520, 640, 641, 767, 768, 1023, 1024, 1279, 1280]);
const numericWidthComparison = /(?:window\.)?innerWidth\s*[<>]=?\s*\d+|\d+\s*[<>]=?\s*(?:window\.)?innerWidth/;
const errors = [];

function collectSourceFiles(relativeDirectory) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.(?:css|js|mjs|ts|vue)$/.test(entry.name)) {
        files.push(relative(root, absolutePath).replaceAll("\\", "/"));
      }
    }
  };
  visit(resolve(root, relativeDirectory));
  return files;
}

const sourceFiles = [...collectSourceFiles("src"), ...collectSourceFiles("tools")];
const appStyles = readFileSync(resolve(root, "src/style.css"), "utf8");

for (const relativePath of sourceFiles) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  for (const mediaQuery of source.matchAll(/@media\s+([^\{]+)/g)) {
    for (const match of mediaQuery[1].matchAll(/(?:min|max)-width:\s*(\d+)px/g)) {
      const breakpoint = Number(match[1]);
      if (!allowedBreakpoints.has(breakpoint)) {
        errors.push(`${relativePath}: 未登记的响应式断点 ${breakpoint}px`);
      }
    }
  }
  if (relativePath.startsWith("src/") && numericWidthComparison.test(source)) {
    errors.push(`${relativePath}: 禁止直接用数字判断 window.innerWidth`);
  }
}

const deviceSource = readFileSync(resolve(root, "src/shared/utils/device.ts"), "utf8");
if (!/MOBILE_LAYOUT_BREAKPOINT_PX\s*=\s*768\b/.test(deviceSource)) {
  errors.push("src/shared/utils/device.ts: MOBILE_LAYOUT_BREAKPOINT_PX 必须是统一的 768px");
}

for (const relativePath of requiredHelperUsers) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  if (!source.includes("isNarrowLayoutViewport")) {
    errors.push(`${relativePath}: 窄视口判断必须复用 isNarrowLayoutViewport()`);
  }
}

for (const relativePath of courseShellFiles) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  for (const stage of ["junior", "senior"]) {
    const declaration = `<PepEnglishDropdown stage="${stage}"`;
    if (source.split(declaration).length !== 2) {
      errors.push(`${relativePath}: 必须且只能显式声明一次 PEP ${stage} 课程入口`);
    }
  }
  const courseRows = [...source.matchAll(/<div class="study-course-row">([\s\S]*?)<\/div>/g)];
  if (courseRows.length !== 2 || courseRows.some((row) => [...row[1].matchAll(/<\w+Dropdown\b/g)].length !== 4)) {
    errors.push(`${relativePath}: 课程入口必须保持两行、每行四项`);
  }
}

if (!/\.study-course-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/.test(appStyles)) {
  errors.push("src/style.css: 课程行必须使用四列网格");
}
if (/\.study-course-row\s*\{\s*display:\s*contents;/.test(appStyles)) {
  errors.push("src/style.css: 禁止摊平课程行，否则宽屏会破坏 4+4 分组");
}

if (errors.length > 0) {
  console.error("Responsive breakpoint verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Responsive layout verified: 6 canonical bands, explicit PEP stage slots, no numeric JS width checks.");
}
