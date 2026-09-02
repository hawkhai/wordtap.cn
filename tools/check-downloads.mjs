import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const downloadsDir = path.join(process.cwd(), "public", "downloads");
const windowsInstaller = path.join(downloadsDir, "WordTap-Setup.exe");
const gatewayInstaller = path.join(downloadsDir, "WordTapGatewaySetup.exe");
const gatewaySha256 = path.join(downloadsDir, "WordTapGatewaySetup.exe.sha256");
const gatewayManifest = path.join(downloadsDir, "wordtap-gateway-release.json");

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const hasWindowsInstaller = await exists(windowsInstaller);
const hasGatewayInstaller = await exists(gatewayInstaller);

if (!hasWindowsInstaller && !hasGatewayInstaller) {
  console.warn(`Release installers are missing; skipping download artifact checks.`);
  console.warn(`Expected ${windowsInstaller} or ${gatewayInstaller}.`);
  process.exit(0);
}

if (!hasGatewayInstaller) {
  console.warn(`Gateway installer is missing; skipping gateway download artifact checks.`);
  console.warn(`Expected ${gatewayInstaller}.`);
  process.exit(0);
}

try {
  await access(gatewaySha256);
  await access(gatewayManifest);
} catch {
  console.error(`Missing companion files for ${gatewayInstaller}.`);
  console.error(`Expected ${gatewaySha256} and ${gatewayManifest}.`);
  console.error("Provide the matching SHA-256 file and release manifest with the Gateway installer.");
  process.exit(1);
}

const installer = await readFile(gatewayInstaller);
const actualHash = createHash("sha256").update(installer).digest("hex").toUpperCase();
const sha256Text = await readFile(gatewaySha256, "utf8");
const listedHash = sha256Text.trim().split(/\s+/)[0]?.toUpperCase();
if (listedHash !== actualHash) {
  console.error(`Gateway installer SHA256 file is stale: expected ${actualHash}, found ${listedHash || "<empty>"}.`);
  process.exit(1);
}

const manifest = JSON.parse((await readFile(gatewayManifest, "utf8")).replace(/^\uFEFF/, ""));
if (
  manifest.fileName !== "WordTapGatewaySetup.exe" ||
  String(manifest.sha256).toUpperCase() !== actualHash ||
  manifest.sizeBytes !== installer.length
) {
  console.error("Gateway release manifest does not match the installer artifact.");
  process.exit(1);
}
