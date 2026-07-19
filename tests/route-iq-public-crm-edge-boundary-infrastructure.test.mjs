import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY,
  validateRouteIqPublicCrmEdgeBoundary,
  verifyRouteIqPublicCrmEdgeBoundaryInfrastructure
} from "../scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs";

const root = resolve(import.meta.dirname, "..");
const canonical = Object.freeze({
  publicConfigText: readFileSync(resolve(root, ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY.publicConfigPath), "utf8"),
  privateConfigText: readFileSync(resolve(root, ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY.privateConfigPath), "utf8"),
  contractText: readFileSync(resolve(root, ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY.contractPath), "utf8")
});

function mutatePublic(mutator) {
  const config = JSON.parse(canonical.publicConfigText);
  mutator(config);
  return `${JSON.stringify(config, null, 2)}\n`;
}

function validate(overrides = {}) {
  return validateRouteIqPublicCrmEdgeBoundary({ ...canonical, ...overrides });
}

test("canonical public edge flags target only the public Worker", () => {
  assert.deepEqual(validate(), {
    status: "ROUTE_IQ_PUBLIC_CRM_EDGE_BOUNDARY_INFRASTRUCTURE_VERIFIED",
    publicWorker: "prometheusrouteiq-website",
    privateWorker: "prometheus-iq"
  });
  assert.equal(
    verifyRouteIqPublicCrmEdgeBoundaryInfrastructure(root).status,
    "ROUTE_IQ_PUBLIC_CRM_EDGE_BOUNDARY_INFRASTRUCTURE_VERIFIED"
  );
});

test("missing or enabled public exposure flags fail closed", () => {
  for (const publicConfigText of [
    mutatePublic(config => { delete config.workers_dev; }),
    mutatePublic(config => { delete config.preview_urls; }),
    mutatePublic(config => { config.workers_dev = true; }),
    mutatePublic(config => { config.preview_urls = true; })
  ]) {
    assert.throws(() => validate({ publicConfigText }));
  }
});

test("public Worker identity and runtime entrypoint drift fail closed", () => {
  for (const publicConfigText of [
    mutatePublic(config => { config.name = "prometheus-iq"; }),
    mutatePublic(config => { config.main = "workers/private-worker.js"; })
  ]) {
    assert.throws(() => validate({ publicConfigText }));
  }
});

test("public bindings, migrations, variables, and assets remain byte-governed", () => {
  const mutations = [
    config => { config.durable_objects.bindings = []; },
    config => { config.migrations[0].tag = "changed"; },
    config => { config.vars.META_GRAPH_API_VERSION = "changed"; },
    config => { config.assets.directory = "./deploy/other"; },
    config => { config.kv_namespaces = []; },
    config => { config.send_email = []; }
  ];
  for (const mutation of mutations) {
    assert.throws(() => validate({ publicConfigText: mutatePublic(mutation) }));
  }
});

test("private Worker configuration drift fails closed", () => {
  assert.throws(() => validate({ privateConfigText: `${canonical.privateConfigText}\n` }));
  assert.throws(() => validate({
    privateConfigText: canonical.privateConfigText.replace('"name": "prometheus-iq"', '"name": "prometheusrouteiq-website"')
  }));
});

test("contract target or preservation claims cannot broaden the release", () => {
  const contract = JSON.parse(canonical.contractText);
  contract.target.privateWorkerMutationAllowed = true;
  assert.throws(() => validate({ contractText: JSON.stringify(contract) }));

  const hashDrift = JSON.parse(canonical.contractText);
  hashDrift.preservation.privateConfigSha256 = "0".repeat(64);
  assert.throws(() => validate({ contractText: JSON.stringify(hashDrift) }));
});
