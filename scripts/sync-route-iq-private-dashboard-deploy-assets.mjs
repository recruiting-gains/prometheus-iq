import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const deployRoot = "deploy/cloudflare-pages";

export const ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS = Object.freeze([
  ["_headers", "deploy/cloudflare-pages/_headers"],
  ["index.html", "deploy/cloudflare-pages/index.html"],
  ["manifest.webmanifest", "deploy/cloudflare-pages/manifest.webmanifest"],
  ["manifest-founder.webmanifest", "deploy/cloudflare-pages/manifest-founder.webmanifest"],
  ["sw.js", "deploy/cloudflare-pages/sw.js"],
  ["dashboard/route-iq-dashboard-platform.mjs", "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs"],
  [
    "administration/contracts/route-iq-workspace-configuration-v2-validation.mjs",
    "deploy/cloudflare-pages/administration/contracts/route-iq-workspace-configuration-v2-validation.mjs"
  ],
  [
    "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
    "deploy/cloudflare-pages/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json"
  ],
  [
    "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
    "deploy/cloudflare-pages/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json"
  ],
  [
    "data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-approved-businesses-v1.json",
    "deploy/cloudflare-pages/data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-approved-businesses-v1.json"
  ],
  [
    "data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json",
    "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json"
  ],
  [
    "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
    "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
  ],
  [
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
    "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"
  ],
  [
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
    "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"
  ],
  [
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
    "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json"
  ],
  [
    "intelligence/continuous-adaptive-route-replenishment.mjs",
    "deploy/cloudflare-pages/intelligence/continuous-adaptive-route-replenishment.mjs"
  ],
  [
    "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
    "deploy/cloudflare-pages/intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json"
  ],
  [
    "intelligence/contracts/operating-profile-contracts.json",
    "deploy/cloudflare-pages/intelligence/contracts/operating-profile-contracts.json"
  ],
  [
    "intelligence/contracts/route-business-hours-eligibility-contracts.json",
    "deploy/cloudflare-pages/intelligence/contracts/route-business-hours-eligibility-contracts.json"
  ],
  [
    "intelligence/profiles/operating-profiles.json",
    "deploy/cloudflare-pages/intelligence/profiles/operating-profiles.json"
  ],
  [
    "intelligence/route-business-hours-eligibility.mjs",
    "deploy/cloudflare-pages/intelligence/route-business-hours-eligibility.mjs"
  ],
  [
    "intelligence/route-iq-governed-runtime-scope.mjs",
    "deploy/cloudflare-pages/intelligence/route-iq-governed-runtime-scope.mjs"
  ],
  [
    "scripts/lib/business-hours-governance.mjs",
    "deploy/cloudflare-pages/scripts/lib/business-hours-governance.mjs"
  ]
]);

export const ROUTE_IQ_PRIVATE_DASHBOARD_ALLOWED_TOP_LEVEL_DIRECTORIES = Object.freeze(new Set([
  "administration",
  "dashboard",
  "data",
  "intelligence",
  "scripts"
]));

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function read(path) {
  return readFileSync(resolve(root, path));
}

function pathStatus(source, target) {
  const sourceBuffer = read(source);
  if (!existsSync(resolve(root, target))) {
    return {
      source,
      target,
      status: "missing",
      sourceSha256: sha256(sourceBuffer),
      targetSha256: null
    };
  }
  const targetBuffer = read(target);
  const sourceSha256 = sha256(sourceBuffer);
  const targetSha256 = sha256(targetBuffer);
  return {
    source,
    target,
    status: sourceSha256 === targetSha256 ? "in_sync" : "drifted",
    sourceSha256,
    targetSha256
  };
}

function writeMirror(source, target) {
  const absoluteTarget = resolve(root, target);
  mkdirSync(dirname(absoluteTarget), { recursive: true });
  copyFileSync(resolve(root, source), absoluteTarget);
}

export function inspectRouteIqPrivateDashboardDeployAssets() {
  const mirrored = ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS.map(([source, target]) => (
    pathStatus(source, target)
  ));
  const retired = [];
  const absoluteDeployRoot = resolve(root, deployRoot);
  if (existsSync(absoluteDeployRoot)) {
    for (const entry of readdirSync(absoluteDeployRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (ROUTE_IQ_PRIVATE_DASHBOARD_ALLOWED_TOP_LEVEL_DIRECTORIES.has(entry.name)) continue;
      if (entry.name === "demo-dashboard" || entry.name.endsWith("-dashboard")) {
        retired.push(`${deployRoot}/${entry.name}`);
      }
    }
  }
  return {
    ok: mirrored.every(item => item.status === "in_sync") && retired.length === 0,
    mirrored,
    retired
  };
}

export function syncRouteIqPrivateDashboardDeployAssets({ write = false } = {}) {
  const inspection = inspectRouteIqPrivateDashboardDeployAssets();
  if (!write) return inspection;

  for (const item of inspection.mirrored) {
    if (item.status !== "in_sync") writeMirror(item.source, item.target);
  }
  for (const retiredPath of inspection.retired) {
    rmSync(resolve(root, retiredPath), { recursive: true, force: true });
  }
  return inspectRouteIqPrivateDashboardDeployAssets();
}

function cli() {
  const args = new Set(process.argv.slice(2));
  const write = args.has("--write");
  const result = syncRouteIqPrivateDashboardDeployAssets({ write });
  process.stdout.write(`${JSON.stringify({
    status: result.ok ? "PASS" : "FAIL",
    write,
    drifted: result.mirrored.filter(item => item.status === "drifted").map(item => item.target),
    missing: result.mirrored.filter(item => item.status === "missing").map(item => item.target),
    retired: result.retired
  }, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
