import assert from "node:assert/strict";
import test from "node:test";

import canonicalArtifact from "../intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json" with { type: "json" };
import {
  verifyRouteIqGovernedLearningAdvisorySecurity
} from "../security/verify-route-iq-governed-learning-advisory-v1.mjs";
import {
  ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH,
  handleRouteIqGovernedLearningAdvisoryRequest
} from "../workers/infrastructure/route-iq-governed-learning-advisory-runtime.js";

const now = new Date("2026-08-12T12:00:00.000Z");

function request(search = "") {
  return new Request(`https://prometheus-iq.example${ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH}${search}`);
}

function founder(overrides = {}) {
  return {
    identityContextSource: "server_verified_identity_mapping",
    authenticationAuthority: "cloudflare_access",
    authenticated: true,
    callerSupplied: false,
    role: "founder",
    mappingId: "route-iq-founder-access-cruz-v1",
    immutablePrincipalId: "riq_principal_test",
    mappingStatus: "securely_mapped",
    ...overrides
  };
}

const workspace = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness"
});

test("Security/Aegis governed-learning advisory verifier passes", () => {
  const result = verifyRouteIqGovernedLearningAdvisorySecurity();
  assert.equal(result.status, "PASS");
  assert.equal(result.founderOnly, true);
  assert.equal(result.browserPersistenceWrites, 0);
  assert.equal(result.publicWorkerExposure, false);
  assert.equal(result.prohibitedOutputFields, 0);
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
});

test("Security rejects representative, manager, caller-selected, and cross-tenant reads", async () => {
  for (const principal of [
    founder({ role: "representative" }),
    founder({ role: "manager" }),
    founder({ callerSupplied: true }),
    founder({ identityContextSource: "client_claim" })
  ]) {
    const response = await handleRouteIqGovernedLearningAdvisoryRequest(request(), {
      founderPrincipal: principal,
      workspace,
      now
    });
    assert.equal(response.status, 404);
  }

  for (const search of [
    "?workspace_id=fitness_connection",
    "?customer_id=fitness_connection_research",
    "?representative_id=cruz",
    "?operating_profile_id=fitness"
  ]) {
    const response = await handleRouteIqGovernedLearningAdvisoryRequest(request(search), {
      founderPrincipal: founder(),
      workspace,
      now
    });
    assert.equal(response.status, 404);
  }

  const crossTenant = await handleRouteIqGovernedLearningAdvisoryRequest(request(), {
    founderPrincipal: founder(),
    workspace: { workspaceId: "northstar_outside_sales_synthetic", operatingProfileId: "fitness" },
    now
  });
  assert.equal(crossTenant.status, 503);
});

test("Security response exposes neither raw evidence nor Shadow Decision outputs", async () => {
  const response = await handleRouteIqGovernedLearningAdvisoryRequest(request(), {
    founderPrincipal: founder(),
    workspace,
    artifact: canonicalArtifact,
    now
  });
  const serialized = JSON.stringify(await response.json());
  assert.equal(response.status, 200);
  for (const forbidden of [
    '"notes":',
    '"address":',
    '"contacts":',
    '"phone":',
    '"email":',
    '"gpsAttached":',
    '"stressTestEvidence":',
    "shadow",
    "candidate",
    "probability",
    "brier"
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
