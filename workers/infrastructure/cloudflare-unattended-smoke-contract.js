export const cloudflareUnattendedSmokeContractVersion =
  "cloudflare-unattended-smoke-runtime-guard-v1";

export const CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN =
  "https://prometheus-iq.prometheusrouteiq.workers.dev";

export const CLOUDFLARE_UNATTENDED_SMOKE_MARKER = Object.freeze({
  requestHeader: "X-Prometheus-Unattended-Smoke",
  requestValue: "service-principal-read-only-v1",
  responseHeader: "X-Prometheus-Unattended-Smoke-Guard",
  responseValue: "verified-read-only-v1"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_VERSION = Object.freeze({
  binding: "CF_VERSION_METADATA",
  responseHeader: "X-Prometheus-Private-Worker-Version"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION = Object.freeze({
  jwksTimeoutMilliseconds: 5_000,
  responseSafetyMarginMilliseconds: 3_000
});

export const CLOUDFLARE_UNATTENDED_SMOKE_ENV = Object.freeze({
  enabled: "PROMETHEUS_UNATTENDED_SMOKE_GUARD",
  teamDomain: "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
  audience: "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
  serviceTokenClientId: "PROMETHEUS_UNATTENDED_SMOKE_SERVICE_TOKEN_CLIENT_ID"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS = Object.freeze([
  "GET",
  "HEAD"
]);

export const CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS = Object.freeze([
  "/",
  "/index.html",
  "/sw.js",
  "/manifest.webmanifest",
  "/icons/prometheus.svg",
  "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  "/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  "/intelligence/continuous-adaptive-route-replenishment.mjs",
  "/intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
  "/intelligence/profiles/operating-profiles.json",
  "/intelligence/contracts/operating-profile-contracts.json",
  "/intelligence/route-business-hours-eligibility.mjs",
  "/scripts/lib/business-hours-governance.mjs",
  "/api/dashboard/route-iq/paid-customer-onboarding/internal/controlled-rehearsal"
]);

export const CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS = Object.freeze([
  ...CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS
    .filter(path => (
      path
        !== "/api/dashboard/route-iq/paid-customer-onboarding/internal/controlled-rehearsal"
    ))
    .map(path => Object.freeze({
      method: "GET",
      path
    })),
  Object.freeze({ method: "HEAD", path: "/" })
]);

export function isCloudflareUnattendedSmokeRequestAllowed(method, url) {
  return CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS.includes(method)
    && url.origin === CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
    && CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS.includes(url.pathname)
    && url.search === ""
    && url.hash === "";
}
