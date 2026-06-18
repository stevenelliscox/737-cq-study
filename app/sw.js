/* Service worker — offline-capable with auto-refresh.
 *
 * Strategy: NETWORK-FIRST for same-origin app assets. When you have signal the
 * app always loads the latest content (so reconnecting refreshes your decks);
 * when you're offline (e.g., at altitude) it falls back to the last cached
 * copy. First load online primes the cache for offline use.
 */
const CACHE = "ak737cq-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/data.js",
  "./js/srs.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// The page sends this when the user taps the "Update available" banner.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // ignore cross-origin

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // refresh the cache with the latest copy
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        // offline: serve cached copy, falling back to the app shell
        caches.match(e.request).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
