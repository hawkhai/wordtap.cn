import { spawnSync } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "cmd.exe" : "npm";
const npmBuildArgs = isWindows ? ["/d", "/s", "/c", "npm.cmd", "run", "build"] : ["run", "build"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdio: "inherit",
    shell: options.shell ?? false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npmCommand, npmBuildArgs);

for (const script of [
  "verify:shuimu",
  "verify:postgraduate:complete",
  "verify:pep-english",
  "verify:college-english:complete",
  "verify:cet",
  "verify:kaoyan-english",
]) {
  const args = isWindows
    ? ["/d", "/s", "/c", "npm.cmd", "run", script]
    : ["run", script];
  run(npmCommand, args);
}
