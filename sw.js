// Minimal service worker: exists mainly to satisfy PWA installability
// (manifest + service worker + HTTPS) and to let the pet raise real OS
// notifications via showNotification(). Caching is network-first with a
// cache fallback for offline use only — never cache-first — because this
// project has been bitten before by stale assets sticking around after a
// deploy. Bump CACHE_NAME whenever the cached asset list changes.
const CACHE_NAME = "pocketpet-v1";
const CORE_ASSETS = ["app.html", "index.html", "manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const existing = list.find((c) => c.url.includes("app.html"));
      if (existing) return existing.focus();
      return self.clients.openWindow("app.html");
    })
  );
});
