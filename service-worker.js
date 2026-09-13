// Bump this on every change to this file's own logic (browsers only check
// for a new service worker when this file's bytes differ) — and also
// whenever the precached URL list changes, so old caches get cleared out.
const CACHE_NAME = "simple_cc-v3";
const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/app.js",
  "js/db.js",
  "js/foods.js",
  "js/recipes.js",
  "js/log.js",
  "js/export.js",
  "data/foods.json",
  "data/international-foods.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version when online, and
// only fall back to the cached copy when offline. This is the opposite of
// cache-first — it costs a network round-trip on every load, but it means
// a change pushed to the app actually reaches the phone on the next visit
// instead of silently serving a stale cached copy indefinitely.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept calls to the Open Food Facts API — those need to
  // reach the network live, not fall back to a stale cache.
  if (url.hostname.endsWith("openfoodfacts.org")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
