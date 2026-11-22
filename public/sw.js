const CACHE_NAME = "wordtap-v9";
const WORDTAP_SITE_CACHE = /^wordtap-v\d+(?:-[a-f0-9]+)?$/;
const APP_ASSETS = [/* __WORDTAP_APP_ASSETS__ */];
const appAssetPaths = new Set(APP_ASSETS.map((asset) => new URL(asset, self.location.href).pathname));
const PRECACHE = [
  "./",
  "./manifest.json",
  "./theme.js?v=1",
  "./favicon.ico",
  "./favicon-192.png",
  "./favicon-512.png",
  "./apple-touch-icon.png",
  "./logo-mark.png",
];

async function fetchAndCache(request, options) {
  const response = await fetch(request, options);
  if (response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...PRECACHE, ...APP_ASSETS])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => WORDTAP_SITE_CACHE.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // The built worker also serves the production preview on localhost.
  if (CACHE_NAME === "wordtap-v9" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return;

  // Installers and their integrity metadata must use normal HTTPS downloads,
  // never an older response retained in the offline cache.
  if (/\/downloads\//.test(url.pathname)) return;

  // Course JSON keeps stable URLs across content corrections. Revalidate both
  // catalogs and lessons; retain cached copies for offline reading.
  const isCourseData = /\/(?:pep-english|nce|shuimu|postgraduate|college-english|cet|kaoyan-english|english-vocabulary)\/(?:manifest\.json|(?:lessons|articles|indexes)\/.+\.json)$/.test(url.pathname);
  if (isCourseData) {
    event.respondWith(
      fetchAndCache(event.request, { cache: "no-cache" })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Network-first for HTML, cache-first for static assets
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetchAndCache(event.request)
        .catch(() => caches.match(event.request)),
    );
  } else {
    // Module and stylesheet requests can send Origin even when the precache
    // request did not. The build output is public and content-hashed.
    event.respondWith(
      caches.match(event.request, { cacheName: CACHE_NAME, ignoreVary: appAssetPaths.has(url.pathname) }).then((cached) => {
        if (cached) return cached;
        return fetchAndCache(event.request);
      }),
    );
  }
});
