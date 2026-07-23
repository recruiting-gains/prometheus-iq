import assert from "node:assert/strict";
import test from "node:test";

import {
  ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS,
  inspectRouteIqPrivateDashboardDeployAssets
} from "../scripts/sync-route-iq-private-dashboard-deploy-assets.mjs";

test("private dashboard deploy assets are in exact parity and contain no retired business literal", () => {
  const inspection = inspectRouteIqPrivateDashboardDeployAssets();

  assert.equal(inspection.ok, true);
  assert.deepEqual(inspection.retired, []);
  assert.equal(inspection.mirrored.every(item => item.status === "in_sync"), true);
  assert.equal(ROUTE_IQ_PRIVATE_DASHBOARD_DEPLOY_MIRRORS.length > 10, true);
});
