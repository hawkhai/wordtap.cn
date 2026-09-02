import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const [html, sitemap, cet, kaoyan, historyStore, examPanel, desktopShell, mobileShell, notice] = await Promise.all([
  readFile(path.join(dist, "exam", "index.html"), "utf8"),
  readFile(path.join(dist, "sitemap.xml"), "utf8"),
  readFile(path.join(dist, "cet", "manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(dist, "kaoyan-english", "manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(process.cwd(), "src", "shared", "stores", "historyStore.ts"), "utf8"),
  readFile(path.join(process.cwd(), "src", "ExamPanel.vue"), "utf8"),
  readFile(path.join(process.cwd(), "src", "desktop", "components", "DesktopShell.vue"), "utf8"),
  readFile(path.join(process.cwd(), "src", "mobile", "components", "MobileShell.vue"), "utf8"),
  readFile(path.join(process.cwd(), "src", "shared", "config", "examNotice.json"), "utf8").then(JSON.parse),
]);

for (const needle of [
  "<link rel=\"canonical\" href=\"https://wordtap.cn/exam/\">",
  "考研英语一",
  "考研英语二",
  "英语四级",
  "英语六级",
  "全部功能均可使用",
  "href=\"../#exam\"",
]) {
  if (!html.includes(needle)) throw new Error(`Exam portal is missing: ${needle}`);
}
if (!sitemap.includes("<loc>https://wordtap.cn/exam/</loc>")) throw new Error("Exam portal is missing from sitemap");
const expectedTotal = cet.totalLessons + kaoyan.totalLessons;
if (!html.includes(`${expectedTotal} papers`)) throw new Error(`Exam portal total does not match ${expectedTotal}`);
for (const needle of [
  "const dbVersion = 5",
  'const examProgressStoreName = "exam_progress"',
  'const examWordEncountersStoreName = "exam_word_encounters"',
  "recordExamOpen",
  "recordExamWordEncounter",
  "exportCompleteLearningDataJson",
  "importCompleteLearningDataJson",
]) {
  if (!historyStore.includes(needle)) throw new Error(`Exam storage is missing: ${needle}`);
}
for (const needle of ["真题与进度", "考试生词", "标记完成", "认识", "再看", "回到试卷"]) {
  if (!examPanel.includes(needle)) throw new Error(`Exam panel is missing: ${needle}`);
}
for (const [name, shell] of [["desktop", desktopShell], ["mobile", mobileShell]]) {
  if (!shell.includes("<ExamPanel") || !shell.includes("activeView === 'exam'")) throw new Error(`${name} shell is missing the exam panel`);
}
if (!notice.title || !notice.message) throw new Error("Exam local-data notice is incomplete");
console.log(`Verified exam portal for ${expectedTotal} papers.`);
