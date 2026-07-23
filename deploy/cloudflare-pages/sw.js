const CACHE_NAME = "prometheus-v50-route-iq-configurable-dashboard";
const APP_SHELL = [
  "./manifest.webmanifest",
  "./manifest-founder.webmanifest",
  "./icons/prometheus.svg",
  "./dashboard/route-iq-dashboard-platform.mjs"
];
const GOVERNED_NETWORK_ONLY_PATHS = [
  "/app",
  "/api/dashboard/",
  "/administration/workspace-configurations/",
  "/data/route-iq-commercial-readiness-v1/",
  "/data/qualified-prospects/",
  "/intelligence/",
  "/scripts/lib/business-hours-governance.mjs"
];

function isGovernedNetworkOnlyPath(pathname) {
  return GOVERNED_NETWORK_ONLY_PATHS.some(path => pathname === path || pathname.startsWith(path));
}

function unavailableResponse(contentType = "text/plain; charset=utf-8") {
  return new Response(
    "Route IQ requires a secure connection and current governed data. Reconnect and sign in again.",
    {
      status: 503,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store"
      }
    }
  );
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME && key.startsWith("prometheus-"))
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" && event.request.method !== "HEAD") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || isGovernedNetworkOnlyPath(requestUrl.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => unavailableResponse())
    );
    return;
  }

  const cacheablePath = APP_SHELL.some(path => requestUrl.pathname.endsWith(path.replace("./", "/")));
  if (!cacheablePath) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request, { cache: "no-store" })));
});
