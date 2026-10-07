import { createHash } from "node:crypto";
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
  // This immutable proof covers all 1,054 lessons and is referenced by signed events.
  const isCleanupProof = file === "content/article-review/cleanup-2026-10-06.json"
    && createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex") === "cea27c1c69e32939ff83196bd29cce9a128d8d0d6f248611217179e037971889";
  // Lossless archive of the historical JSON revisions required by the event chain.
  const isReviewArchive = file === "content/article-review/history.zip"
    && createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex") === "21c70dc2eaf21c714990864cfe3f4b2c3903e916500a228d486185cc71153693";
  invariant(statSync(path.join(root, file)).size <= (isReviewArchive ? 20 : isCleanupProof ? 16 : 5) * 1024 * 1024, `Tracked file exceeds size limit: ${file}`);
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
