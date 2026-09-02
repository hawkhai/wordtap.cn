import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);
const trackedSet = new Set(tracked);

for (const required of [
  "LICENSE",
  "NOTICE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
]) {
  invariant(trackedSet.has(required), `Missing open-source document: ${required}`);
}

const forbiddenPrefixes = [
  "node_modules/",
  "dist/",
  ".vite/",
  "coverage/",
  "tools/graduate/",
  "tools/College-English/",
  "content/NCE-Flow/",
  "content/English-for-post-graduate/",
];
const forbiddenSegments = ["/raw/", "/reports/"];
for (const file of tracked) {
  invariant(!forbiddenPrefixes.some((prefix) => file.startsWith(prefix)), `Generated or local path is tracked: ${file}`);
  invariant(!forbiddenSegments.some((segment) => file.includes(segment)), `Raw or report path is tracked: ${file}`);
  invariant(!/\.(?:exe|pfx|p12|pem|key|keystore|jks|log|tmp|bak|orig|rej)$/i.test(file), `Sensitive or generated file type is tracked: ${file}`);
  invariant(statSync(path.join(root, file)).size <= 5 * 1024 * 1024, `Tracked file exceeds 5 MiB: ${file}`);
}

const codeOrConfig = tracked.filter((file) =>
  !file.startsWith("content/")
  && !file.startsWith("public/")
  && /(?:^|\.)((?:m?js)|ts|vue|py|html|css|json|md|xml|yml|yaml)$/i.test(file),
);
const highConfidenceSecrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /https?:\/\/[^/@\s]+:[^/@\s]+@/,
];
const developerPath = new RegExp(
  String.raw`(?:\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][A-Za-z0-9._-]+[\\/]|\/(?:Users|home)\/[A-Za-z0-9._-]+\/)`,
  "u",
);
const hardCodedPathConstructor = /\bPath\(r?["'][A-Za-z]:[\\/]/u;
for (const file of codeOrConfig) {
  const text = readFileSync(path.join(root, file), "utf8");
  invariant(!highConfidenceSecrets.some((pattern) => pattern.test(text)), `Possible credential in tracked file: ${file}`);
  invariant(!developerPath.test(text), `Developer home path in tracked file: ${file}`);
  invariant(!hardCodedPathConstructor.test(text), `Hard-coded Windows path in tracked file: ${file}`);
}

const readme = readFileSync(path.join(root, "README.md"), "utf8");
invariant(readme.includes("https://github.com/hawkhai/wordtap.cn"), "README is missing the original project URL");
invariant(readme.includes("https://wordtap.cn/"), "README is missing the project website URL");

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
invariant(packageJson.license === "Apache-2.0", "package.json license must be Apache-2.0");

console.log(`Verified open-source repository hygiene for ${tracked.length} tracked files.`);
