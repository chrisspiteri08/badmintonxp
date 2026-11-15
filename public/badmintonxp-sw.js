const prefix = "badmintonxp-shell-";
const cacheName = prefix + "v1";
const offline = "/badmintonxp-offline.html";
const shell = [offline, "/manifest.webmanifest", "/icons/badmintonxp-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shell)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("authorization")) return;
  if (request.mode === "navigate" && /^\/play(?:\/|$)/.test(url.pathname)) {
    // Never write HTML or account responses into the cache.
    event.respondWith(fetch(request).catch(() => caches.match(offline)));
    return;
  }
  const staticFile = /^\/_next\/static\//.test(url.pathname)
    || /^\/(?:icons|demo)\/[^/]+\.(?:png|jpe?g|webp|ico)$/.test(url.pathname)
    || shell.includes(url.pathname);
  if (!staticFile) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected) await cache.put(request, response.clone()).catch(() => {});
    return response;
  })());
});
self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data.json(); } catch { return; }
  if (typeof payload.title !== "string") return;
  const url = payload.url === "/play/predict" ? payload.url : "/play/quiz";
  event.waitUntil(self.registration.showNotification(payload.title, {
    icon: "/icons/badmintonxp-192.png", tag: url, data: { url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url === "/play/predict" ? "/play/predict" : "/play/quiz";
  event.waitUntil(self.clients.openWindow(url));
});
