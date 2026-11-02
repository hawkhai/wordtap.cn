declare const __WORDTAP_GATEWAY_VERSION__: string;

// The bundled release is a reliable baseline even when the online manifest is unavailable.
export const bundledGatewayVersion = __WORDTAP_GATEWAY_VERSION__;

type Version = { parts: number[]; prerelease: string[] };

function parseVersion(value: unknown): Version | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some(part => /^0\d+$/.test(part))) return null;
  return parts.every(Number.isSafeInteger) ? { parts, prerelease } : null;
}

export function gatewayVersion(value: unknown): string | null {
  return parseVersion(value) ? value as string : null;
}

export function compareGatewayVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error("Invalid Gateway version");
  for (let i = 0; i < 3; i++) {
    if (a.parts[i] !== b.parts[i]) return a.parts[i] < b.parts[i] ? -1 : 1;
  }
  if (!a.prerelease.length || !b.prerelease.length) {
    return Number(!a.prerelease.length) - Number(!b.prerelease.length);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return BigInt(x) < BigInt(y) ? -1 : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
