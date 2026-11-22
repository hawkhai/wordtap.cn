export const MOBILE_LAYOUT_BREAKPOINT_PX = 768;

export function isIpadBrowser(): boolean {
  const { userAgent, maxTouchPoints } = window.navigator;
  // iPadOS can report a desktop Mac user agent in Safari.
  return /\biPad\b/i.test(userAgent)
    || (/\bMacintosh\b/i.test(userAgent) && maxTouchPoints > 1);
}

export function isProbablyMobileBrowser(): boolean {
  return /Android|iPhone|iPod|Mobile/i.test(window.navigator.userAgent) || isIpadBrowser();
}

export function isNarrowLayoutViewport(): boolean {
  return window.innerWidth < MOBILE_LAYOUT_BREAKPOINT_PX;
}

export function isWindows(): boolean {
  return /Windows/i.test(window.navigator.userAgent);
}
