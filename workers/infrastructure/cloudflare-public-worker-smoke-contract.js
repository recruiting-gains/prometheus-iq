export const cloudflarePublicWorkerSmokeContractVersion =
  "cloudflare-public-worker-read-only-smoke-v1";

export const CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN =
  "https://prometheusrouteiq.com";

export const CLOUDFLARE_PUBLIC_WORKER_PUBLIC_PATHS = Object.freeze([
  "/",
  "/privacy/",
  "/terms/",
  "/data-deletion/",
  "/robots.txt",
  "/sitemap.xml",
  "/site.webmanifest"
]);

export const CLOUDFLARE_PUBLIC_WORKER_FOUNDER_PATH =
  "/api/partner-intake/founder/requests";

export const CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS = Object.freeze([
  ...CLOUDFLARE_PUBLIC_WORKER_PUBLIC_PATHS.flatMap(path => [
    Object.freeze({ kind: "public_asset", method: "GET", path }),
    Object.freeze({ kind: "public_asset", method: "HEAD", path })
  ]),
  Object.freeze({ kind: "public_intake_guard", method: "GET", path: "/api/partner-intake" }),
  Object.freeze({ kind: "public_intake_guard", method: "HEAD", path: "/api/partner-intake" }),
  Object.freeze({ kind: "founder_access_challenge", method: "GET", path: CLOUDFLARE_PUBLIC_WORKER_FOUNDER_PATH }),
  Object.freeze({ kind: "founder_access_challenge", method: "HEAD", path: CLOUDFLARE_PUBLIC_WORKER_FOUNDER_PATH })
]);

export function isCloudflarePublicWorkerSmokeRequestAllowed(method, url) {
  return ["GET", "HEAD"].includes(method)
    && url.origin === CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN
    && CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS.some(entry => (
      entry.method === method && entry.path === url.pathname
    ))
    && url.search === ""
    && url.hash === "";
}
