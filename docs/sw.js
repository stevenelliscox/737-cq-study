const CACHE = "ak737cq-locked-9c73e801";
const ASSETS = ["./","./index.html","./css/styles.css","./js/vendor/crypto-js.min.js",
"./js/data.locked.js","./js/srs.js","./js/app.js","./js/lock.js","./manifest.webmanifest",
"./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)).catch(()=>{}); return res; })
    .catch(() => caches.match(e.request).then(h => h || caches.match("./index.html"))));
});
