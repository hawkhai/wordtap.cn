import { siteCopy } from "../copy/siteCopy";

type ProbeResult = { status: "ok" | "warn" | "fail"; detail: string };
const copy = siteCopy.diagnostics;

function isCrossOrigin(url: string): boolean {
  return new URL(url, window.location.href).origin !== window.location.origin;
}

export async function probeDownload(url: string, head: () => Promise<Response>): Promise<ProbeResult> {
  if (isCrossOrigin(url)) return { status: "warn", detail: copy.downloadUnknown };
  try {
    const response = await head();
    return response.ok
      ? { status: "ok", detail: copy.downloadReady }
      : { status: "fail", detail: copy.downloadUnavailable };
  } catch {
    return { status: "warn", detail: copy.downloadUnknown };
  }
}

export async function probeGatewayRelease(url: string, load: () => Promise<unknown>): Promise<ProbeResult> {
  // The public client does not package Gateway releases. Metadata is optional.
  if (isCrossOrigin(url)) return { status: "warn", detail: copy.gatewayReleaseUnknown };
  try {
    const payload = await load() as { sha256?: unknown; sizeBytes?: unknown } | null;
    if (typeof payload?.sha256 !== "string" || !/^[a-f\d]{64}$/i.test(payload.sha256)
      || typeof payload.sizeBytes !== "number" || !Number.isSafeInteger(payload.sizeBytes) || payload.sizeBytes <= 0) {
      return { status: "warn", detail: copy.gatewayReleaseIncomplete };
    }
    return { status: "ok", detail: copy.gatewayReleaseReady };
  } catch {
    return { status: "warn", detail: copy.gatewayReleaseUnknown };
  }
}
