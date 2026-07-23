import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  verifyRouteIqBusinessAvailabilityRefreshPackage
} from "../scripts/verify-route-iq-business-availability-refresh-package.mjs";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("availability refresh package stays default-OFF and no-credential", () => {
  const result = verifyRouteIqBusinessAvailabilityRefreshPackage();
  assert.equal(result.status, "PASS");
  assert.equal(result.targetWorker, "prometheus-iq");
  assert.equal(result.defaultState, "OFF");
  assert.equal(result.scheduleCron, "0 4 * * *");
});

test("refresh package sources keep the governed scheduler lane separate from deployment", () => {
  const packageSource = read("workers/infrastructure/route-iq-business-availability-refresh-package-v1.json");
  const verifierSource = read("scripts/verify-route-iq-business-availability-refresh-package.mjs");
  const docSource = read("docs/route-iq-business-availability-infrastructure-v1.md");

  assert.doesNotMatch(packageSource, /cfut_|access[_-]?token|client[_-]?secret/iu);
  assert.doesNotMatch(verifierSource, /cfut_|access[_-]?token|client[_-]?secret/iu);
  assert.match(packageSource, /"productionActivationAuthorized": false/u);
  assert.match(packageSource, /"automaticRefreshActive": false/u);
  assert.match(docSource, /No credential, paid provider, Google dependency, scheduled trigger, deployment, production data migration, cache purge, or activation is authorized/u);
});
