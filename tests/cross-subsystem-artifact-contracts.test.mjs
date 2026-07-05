import assert from "node:assert/strict";
import test from "node:test";

import { verifyCrossSubsystemArtifactContracts } from "../scripts/verify-cross-subsystem-artifact-contracts.mjs";

test("Cross-subsystem artifact contracts verify canonical paths and consumers", () => {
  const result = verifyCrossSubsystemArtifactContracts();

  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.equal(result.registry.contractId, "prometheus-cross-subsystem-artifact-contract-v1");
  assert.equal(result.registry.owningSubsystem, "Prometheus Overwatch");
});

test("Cross-subsystem artifact registry records current incomplete links and fixture policy", () => {
  const result = verifyCrossSubsystemArtifactContracts();
  const smoothieDepot = result.registry.workspaces.find(workspace => workspace.workspaceId === "smoothie_depot");

  assert.ok(smoothieDepot, "Smoothie Depot workspace must be registered.");
  assert.deepEqual(smoothieDepot.auditFindings.brokenLinksIdentified, []);
  assert.ok(
    smoothieDepot.auditFindings.incompleteLinksIdentified.some(item => item.includes("Cranky Carrot")),
    "Audit must preserve the missing canonical dossier finding for Cranky Carrot / LEEMOO."
  );
  assert.ok(
    smoothieDepot.auditFindings.fixtureDataLocationsIdentified.every(finding => finding.productionConsumerAllowed === false),
    "Fixture/demo locations must remain non-production only."
  );
});
