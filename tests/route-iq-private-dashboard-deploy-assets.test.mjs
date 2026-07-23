import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS,
  inspectRouteIqPrivateDashboardDeployAssets
} from "../scripts/sync-route-iq-private-dashboard-deploy-assets.mjs";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("private dashboard deploy assets are in exact parity and contain no retired business literal", () => {
  const inspection = inspectRouteIqPrivateDashboardDeployAssets();
  const scriptSource = read("scripts/sync-route-iq-private-dashboard-deploy-assets.mjs");

  assert.equal(inspection.ok, true);
  assert.deepEqual(inspection.retired, []);
  assert.equal(inspection.mirrored.every(item => item.status === "in_sync"), true);
  assert.equal(ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS.length > 10, true);
  assert.doesNotMatch(scriptSource, /smoothie[_ -]?depot|Smoothie Depot/u);
});
