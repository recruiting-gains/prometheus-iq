import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  approvedBusinessIdentitySet,
  getWorkspaceBusinessArtifactManifest,
  loadWorkspaceBusinessArtifactManifestRegistry,
  validateWorkspaceBusinessArtifactManifestRegistry,
  workspaceBusinessArtifactFallbackPolicy
} from "../data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

function clone(value) {
  return structuredClone(value);
}

test("workspace manifests bind each profile to one immutable approved-business source", () => {
  const registry = loadWorkspaceBusinessArtifactManifestRegistry({ repoRoot });
  assert.equal(registry.fallbackPolicy, workspaceBusinessArtifactFallbackPolicy);
  assert.equal(registry.manifests.length, 2);
  assert.equal(new Set(registry.manifests.map(manifest => manifest.workspaceId)).size, 2);
  assert.equal(registry.manifests.every(manifest => manifest.demoFallbackAllowed === false), true);
  assert.equal(registry.manifests.every(manifest => manifest.crossWorkspaceFallbackAllowed === false), true);
  assert.equal(registry.manifests.every(manifest => manifest.freshness.maximumAgeHours <= 24), true);

  const fitness = getWorkspaceBusinessArtifactManifest("fitness_connection", { registry });
  assert.equal(fitness.operatingProfileId, "fitness");
  assert.equal(fitness.classification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(fitness.approvalState, "PENDING_FOUNDER_APPROVAL");
  assert.equal(fitness.productionUseAuthorized, false);
  assert.equal(fitness.approvedRecordCount, 0);
  assert.equal(approvedBusinessIdentitySet("fitness_connection", { registry }).size, 0);

  const outsideSales = getWorkspaceBusinessArtifactManifest(
    "northstar_outside_sales_synthetic",
    { registry }
  );
  assert.equal(outsideSales.operatingProfileId, "general_outside_sales");
  assert.equal(outsideSales.classification, "SYNTHETIC_NONCANONICAL");
  assert.equal(outsideSales.approvalState, "APPROVED_SYNTHETIC_VALIDATION");
  assert.equal(outsideSales.approvedRecordCount, 3);
  assert.equal(outsideSales.productionUseAuthorized, false);
});

test("synthetic outside-sales data is isolated and visibly noncanonical", () => {
  const fixture = JSON.parse(readFileSync(
    resolve(
      repoRoot,
      "data/route-iq-commercial-readiness-v1/fixtures/general-outside-sales-synthetic-approved-businesses-v1.json"
    ),
    "utf8"
  ));
  const registry = loadWorkspaceBusinessArtifactManifestRegistry({ repoRoot });
  const fitness = getWorkspaceBusinessArtifactManifest("fitness_connection", { registry });
  const syntheticIds = new Set(fixture.records.map(record => record.recordId));

  assert.equal(fixture.workspaceId, "northstar_outside_sales_synthetic");
  assert.equal(fixture.operatingProfileId, "general_outside_sales");
  assert.equal(fixture.classification, "SYNTHETIC_NONCANONICAL");
  assert.equal(fixture.records.every(record => record.approvalState === "APPROVED_SYNTHETIC_VALIDATION"), true);
  assert.equal(fitness.approvedRecordIds.some(id => syntheticIds.has(id)), false);
});

test("manifest validation fails closed on pending approvals, fallbacks, drift, and unknown workspaces", () => {
  const registry = loadWorkspaceBusinessArtifactManifestRegistry({ repoRoot });

  const pendingAdmission = clone(registry);
  pendingAdmission.manifests[0].approvedRecordCount = 1;
  pendingAdmission.manifests[0].approvedRecordIds = ["unauthorized_record"];
  assert.throws(
    () => validateWorkspaceBusinessArtifactManifestRegistry(pendingAdmission, { repoRoot }),
    error => error.code === "route_iq_business_manifest_pending_approval_invalid"
  );

  const fallback = clone(registry);
  fallback.manifests[0].demoFallbackAllowed = true;
  assert.throws(
    () => validateWorkspaceBusinessArtifactManifestRegistry(fallback, { repoRoot }),
    error => error.code === "route_iq_business_manifest_contract_invalid"
  );

  const drift = clone(registry);
  drift.manifests[0].artifactSha256 = "0".repeat(64);
  assert.throws(
    () => validateWorkspaceBusinessArtifactManifestRegistry(drift, { repoRoot }),
    error => error.code === "route_iq_business_manifest_hash_mismatch"
  );

  assert.throws(
    () => getWorkspaceBusinessArtifactManifest("unknown_workspace", { registry }),
    error => error.code === "route_iq_business_manifest_workspace_unknown"
  );
});
