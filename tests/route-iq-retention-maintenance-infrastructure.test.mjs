import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createCloudflareKvFieldSessionStore,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqRetentionMaintenanceCapabilityVersion
} from "../data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs";
import {
  RouteIqRetentionMaintenanceInfrastructureError,
  createRouteIqRetentionMaintenanceStore,
  routeIqRetentionMaintenanceRuntimeContractVersion,
  routeIqRetentionMaintenanceStoreBinding,
  validateRouteIqRetentionMaintenanceBindings
} from "../workers/infrastructure/route-iq-retention-maintenance-runtime.js";

function binding({ deleteCapable = false } = {}) {
  const data = new Map();
  const value = {
    get(key) {
      return Promise.resolve(data.get(key) ?? null);
    },
    put(key, entry) {
      data.set(key, String(entry));
      return Promise.resolve();
    },
    list() {
      return Promise.resolve({
        keys: [...data.keys()].map(name => ({ name })),
        list_complete: true
      });
    }
  };
  if (deleteCapable) {
    value.delete = key => {
      data.delete(key);
      return Promise.resolve();
    };
  }
  return value;
}

test("ordinary archive ingestion remains valid without a delete-capable maintenance binding", () => {
  const ordinary = binding();
  const store = createCloudflareKvFieldSessionStore({
    [routeIqFieldSessionStoreBinding]: ordinary
  });
  assert.equal(typeof store.get, "function");
  assert.equal(typeof store.put, "function");
  assert.equal(typeof store.list, "function");
  assert.equal(typeof store.delete, "undefined");
});

test("maintenance capability requires an exact separate delete-capable binding", async () => {
  const ordinary = binding();
  const maintenance = binding({ deleteCapable: true });
  const env = {
    [routeIqFieldSessionStoreBinding]: ordinary,
    [routeIqRetentionMaintenanceStoreBinding]: maintenance
  };
  const validation = validateRouteIqRetentionMaintenanceBindings(env);
  assert.equal(validation.ok, true);
  assert.equal(validation.contractVersion, routeIqRetentionMaintenanceRuntimeContractVersion);
  assert.equal(validation.schedulerConfigured, false);
  assert.equal(validation.routeConfigured, false);
  assert.equal(validation.productionDeploymentAuthorized, false);
  const store = createRouteIqRetentionMaintenanceStore(env);
  assert.equal(store.retentionMaintenanceCapability, routeIqRetentionMaintenanceCapabilityVersion);
  await store.put("fixture", "value");
  assert.equal(await store.get("fixture"), "value");
  await store.delete("fixture");
  assert.equal(await store.get("fixture"), null);
});

test("same-binding, missing-delete, and missing-maintenance configurations fail closed", () => {
  const ordinary = binding();
  for (const env of [
    { [routeIqFieldSessionStoreBinding]: ordinary },
    {
      [routeIqFieldSessionStoreBinding]: ordinary,
      [routeIqRetentionMaintenanceStoreBinding]: ordinary
    },
    {
      [routeIqFieldSessionStoreBinding]: ordinary,
      [routeIqRetentionMaintenanceStoreBinding]: binding()
    }
  ]) {
    assert.throws(
      () => createRouteIqRetentionMaintenanceStore(env),
      error => error instanceof RouteIqRetentionMaintenanceInfrastructureError
    );
  }
});

test("the dormant Infrastructure boundary exposes no route, scheduler, alarm, queue, or deployment mutation", () => {
  const source = readFileSync("workers/infrastructure/route-iq-retention-maintenance-runtime.js", "utf8");
  const contract = JSON.parse(readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
    "utf8"
  ));
  assert.doesNotMatch(source, /\bfetch\s*\(|\bscheduled\s*\(|\balarm\s*\(|\bqueue\s*\(/);
  assert.equal(contract.status, "source_complete_dormant_not_deployed");
  assert.equal(contract.maintenanceBinding.mustBeSeparateFromOrdinaryArchiveBinding, true);
  assert.equal(contract.activation.workerRouteConfigured, false);
  assert.equal(contract.activation.schedulerConfigured, false);
  assert.equal(contract.activation.productionBindingConfigured, false);
  assert.equal(contract.activation.productionDeploymentAuthorized, false);
  assert.equal(contract.activation.productionDeletionAuthorized, false);
  assert.deepEqual(contract.protectedState, {
    collection: "off",
    activeCohorts: 0,
    recommendationInfluence: "off",
    providers: "off",
    scheduler: "off"
  });
});
