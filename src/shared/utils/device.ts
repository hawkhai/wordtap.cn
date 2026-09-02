const MOBILE_LAYOUT_BREAKPOINT_PX = 768;

export function isProbablyMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

export function isNarrowLayoutViewport(): boolean {
  return window.innerWidth < MOBILE_LAYOUT_BREAKPOINT_PX;
}

export function isWindows(): boolean {
  return /Windows/i.test(window.navigator.userAgent);
}
