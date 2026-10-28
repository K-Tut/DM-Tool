// DM Tool offline cache. Cache names start with "dm-" so the Character Builder (same website) leaves them alone.
const VERSION = "dm-v2";
const IMG = "dm-img";   // monster pictures from aidedd.org, kept for offline use
const FILES = ["./", "index.html", "config.js", "dm.css", "qr.js", "mapview.js", "names.js", "dmstore.js", "dm.js", "dice.js", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => fetch(f, { cache: "no-cache" }).then(r => r.ok && c.put(f, r)).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("dm-") && k !== VERSION && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname.endsWith("aidedd.org") && e.request.destination === "image") {   // cache first
    e.respondWith(caches.open(IMG).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (u.origin !== location.origin || u.pathname.includes("/api/")) return;
  // network first (updates arrive immediately); cached copy when offline
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const copy = r.clone(); if (r.ok) caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
