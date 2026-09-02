export function appAssetUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  return new URL(normalizedPath, baseUrl).toString();
}

export function appSectionUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const parts = window.location.pathname.split("/").filter(Boolean);
  const sectionIndex = parts.findIndex((part) => part === "exam" || part === "nce" || part === "shuimu" || part === "postgraduate" || part === "pep-english" || part === "college-english" || part === "cet" || part === "kaoyan-english");
  const baseParts = sectionIndex >= 0 ? parts.slice(0, sectionIndex) : parts;
  const lastPart = baseParts.at(-1) ?? "";
  const baseDirectory = lastPart.includes(".") ? baseParts.slice(0, -1) : baseParts;
  const basePath = `/${baseDirectory.join("/")}${baseDirectory.length ? "/" : ""}`;
  return new URL(normalizedPath, window.location.origin + basePath).toString();
}

const cdnDownloadBaseUrl = "https://cdn.sunocean.life/wordtap/";
const officialDownloadHosts = new Set(["sunocean.life", "www.sunocean.life", "wordtap.cn", "www.wordtap.cn"]);

export function appDownloadUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  if (officialDownloadHosts.has(window.location.hostname.toLowerCase())) {
    return new URL(normalizedPath, cdnDownloadBaseUrl).toString();
  }

  return appAssetUrl(path);
}
