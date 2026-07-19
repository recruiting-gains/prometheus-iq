import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GOVERNANCE_PATH,
  validatePublicCrmReadinessGovernance,
  verifyOverwatchPublicCrmFounderAccessDeploymentReadiness
} from "../scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs";

function governance() {
  return JSON.parse(readFileSync(GOVERNANCE_PATH, "utf8"));
}

test("Overwatch independently verifies owner provenance and the public CRM release boundary", () => {
  const result = verifyOverwatchPublicCrmFounderAccessDeploymentReadiness();
  assert.equal(result.ok, true);
  assert.equal(result.batchId, "BATCH-20260719-005");
  assert.deepEqual(result.infrastructureCommits, [
    "2be88021bfc9107c200a2fef5fd065da875e52c6",
    "d9c1b3322c5ad2fb12f3ae5dbfc7f42e807d61a8",
    "1791728ad6a6777e828220dac6a7e93b207f95bc",
    "1490d4722867a5e203eb159ffbaf01c9645fb127"
  ]);
  assert.deepEqual(result.excludedCommits, [
    "0aac4732670bde05596c1c8cde60c533172663f7",
    "5a3339f465cbcd81b1c7eeca5c9d384afbcf4d1c"
  ]);
  assert.equal(result.rollbackArtifactSha256, "4636e18bd3d99a803803a7ab78dcd2dbf634de8d9e34386c5c43f4df6fcb1ad1");
});

test("release reconstruction fails closed on ownership, archive, or implementation-loss drift", () => {
  const mixedOwnership = governance();
  mixedOwnership.recovery.mixedOwnershipPresent = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(mixedOwnership), /release reconstruction integrity/u);

  const implementationLoss = governance();
  implementationLoss.recovery.noIntendedImplementationLost = false;
  assert.throws(() => validatePublicCrmReadinessGovernance(implementationLoss), /release reconstruction integrity/u);

  const pushableArchive = governance();
  pushableArchive.recovery.archivalEvidence.pushAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(pushableArchive), /archive isolation drifted/u);

  const alteredHash = governance();
  alteredHash.recovery.infrastructureRepairComparison.files["scripts/lib/route-iq-public-forward-rollback.mjs"] = "0".repeat(64);
  assert.throws(() => validatePublicCrmReadinessGovernance(alteredHash), /reconstructed file evidence drifted/u);
});

test("Everyone, Bypass, and display-name Founder authorization fail closed", () => {
  for (const field of ["everyoneAllowed", "bypassAllowed", "displayNameAllowed"]) {
    const value = governance();
    value.cloudflareAccess.policy[field] = true;
    assert.throws(() => validatePublicCrmReadinessGovernance(value), /broad Founder authorization/u);
  }
});

test("public website and request intake cannot be pulled behind Founder Access", () => {
  for (const field of ["publicWebsiteRemainsPublic", "publicRequestSubmissionRemainsPublic"]) {
    const value = governance();
    value.cloudflareAccess[field] = false;
    assert.throws(() => validatePublicCrmReadinessGovernance(value), /HTTP boundary drifted/u);
  }
});

test("deployment and smoke controls reject private targeting, concurrency, and write methods", () => {
  const privateTarget = governance();
  privateTarget.deploymentControl.privateWorkerDeploymentAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(privateTarget), /private Worker deployment/u);

  const concurrent = governance();
  concurrent.deploymentControl.simultaneousDeploymentsAllowed = true;
  assert.throws(() => validatePublicCrmReadinessGovernance(concurrent), /deployment attempt guard/u);

  const writeSmoke = governance();
  writeSmoke.deploymentControl.smokeMethods.push("POST");
  assert.throws(() => validatePublicCrmReadinessGovernance(writeSmoke), /smoke contract permits writes/u);
});
