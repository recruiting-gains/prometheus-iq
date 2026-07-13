const CACHE_NAME = "prometheus-v43-representative-saved-places";
const APP_SHELL = [
  "./manifest.webmanifest",
  "./manifest-founder.webmanifest",
  "./icons/prometheus.svg",
  "./intelligence/continuous-adaptive-route-replenishment.mjs",
  "./intelligence/route-business-hours-eligibility.mjs",
  "./scripts/lib/business-hours-governance.mjs"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => new Response(
        "Prometheus IQ requires a secure connection. Reconnect and sign in again.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
      ))
    );
    return;
  }

  const cacheablePath = APP_SHELL.some(path => requestUrl.pathname.endsWith(path.replace("./", "/")));
  if (!cacheablePath) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
