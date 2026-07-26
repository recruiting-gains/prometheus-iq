import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  inspectRouteIqPrivateDashboardCsp
} from "../scripts/refresh-route-iq-private-dashboard-csp.mjs";
import {
  inspectRouteIqPrivateDashboardDeployAssets
} from "../scripts/sync-route-iq-private-dashboard-deploy-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

test("governed private CSP exactly pins the current Dashboard inline runtime", () => {
  const inspection = inspectRouteIqPrivateDashboardCsp();
  assert.equal(inspection.ok, true);
  assert.equal(inspection.indexHashes.length, 1);
  assert.equal(inspection.headerHashes.length, 1);
  assert.equal(inspection.indexHashes[0], inspection.expectedHash);
  assert.equal(inspection.headerHashes[0], inspection.expectedHash);
});

test("private deploy mirror is exact after CSP and Dashboard synchronization", () => {
  const inspection = inspectRouteIqPrivateDashboardDeployAssets();
  assert.equal(inspection.ok, true);
  assert.deepEqual(inspection.retired, []);
  assert.equal(inspection.mirrored.every(item => item.status === "in_sync"), true);
  assert.equal(
    read("deploy/cloudflare-pages/index.html"),
    read("index.html")
  );
  assert.equal(
    read("deploy/cloudflare-pages/_headers"),
    read("_headers")
  );
});

test("Dashboard module cache key remains versioned without weakening CSP", () => {
  const index = read("index.html");
  assert.match(
    index,
    /route-iq-dashboard-platform\.mjs\?paid-customer-preview-v1/u
  );
  assert.doesNotMatch(index, /script-src[^;]*'unsafe-inline'/iu);
});
