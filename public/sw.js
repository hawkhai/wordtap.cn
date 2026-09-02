const CACHE_NAME = "wordtap-v6";
const PRECACHE = [
  "./",
  "./manifest.json",
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  const isCourseManifest = /\/(?:pep-english|nce|shuimu|postgraduate|college-english|cet|kaoyan-english)\/manifest\.json$/.test(url.pathname);
  if (isCourseManifest) {
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
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetchAndCache(event.request);
      }),
    );
  }
});
