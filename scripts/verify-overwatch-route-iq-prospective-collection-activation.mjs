import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const batchId = "BATCH-20260714-003";
const checkpointCommit = "119d37f154ee99df1591863e745f4d1033953c71";
const checkpointTree = "52d248178b85d46f26d4a8a12c95f56597a8b304";
const governancePath = "overwatch/governance/route-iq-prospective-collection-activation-v1.json";
const reportPath = "overwatch/reports/BATCH-20260714-003-route-iq-prospective-collection-activation-readiness.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";

const ownerCommits = Object.freeze({
  "Prometheus Data": Object.freeze([
    "a5bd1d431e778cec045d1e8412efb396674ea321",
    "4803d7aca5810abfc1cbca84eb2f461046a10da4",
    "fdacf00da221ae5cc473fb57173a7940483deeb7"
  ]),
  "Prometheus Infrastructure": Object.freeze([
    "2280c6dae9d07bcfd744e99e9d28126188653eb2",
    "46658265248b03f7b52f9e1ec0b1ca61ca2b5920"
  ]),
  "Prometheus Intelligence Engine": Object.freeze([
    "6e4d9f70dc5a00949773f1e9fbb5206f30ea6c8a",
    "925fa5e18ab0dd816e55ce56814efadc7fef2556",
    "8479bb47195dee1c227d15064e49d988142c709a"
  ])
});

const expectedOverwatchFiles = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-route-iq-prospective-collection-activation.mjs",
  "scripts/verify-release-provenance-repair.mjs",
  "tests/overwatch-route-iq-prospective-collection-activation.test.mjs",
  "tests/overwatch-shadow-decision-readiness-gate.test.mjs"
].sort());

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const historicalBytes = path => execFileSync("git", ["show", `${checkpointCommit}:${path}`]);
const historicalJson = path => JSON.parse(historicalBytes(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function changedPaths(commit) {
  const result = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return result ? result.split("\n").sort() : [];
}

function unionChangedPaths(commits) {
  return [...new Set(commits.flatMap(changedPaths))].sort();
}

export function verifyOverwatchRouteIqProspectiveCollectionActivation() {
  assert.equal(git("rev-parse", `${checkpointCommit}^{tree}`), checkpointTree);

  const governance = historicalJson(governancePath);
  const report = historicalJson(reportPath);
  const registry = historicalJson(registryPath);
  const retentionPolicy = historicalJson(governance.retentionBoundary.policyPath);
  const activationTemplate = historicalJson(governance.activationCohort.templatePath);
  const intelligenceSpec = historicalJson(governance.intelligenceAdmission.specificationPath);

  assert.equal(governance.batchId, batchId);
  assert.equal(governance.status, "SOURCE_COMPLETE_ACTIVATION_BLOCKED");
  assert.equal(governance.owningSubsystem, "Prometheus Overwatch");
  assert.equal(governance.ownership.implementationOriginatedFromSubsystemOwners, true);
  assert.equal(governance.ownership.overwatchImplementationOwnershipViolation, false);
  assert.equal(report.dispatchAudit.implementationOwnershipRespected, true);
  assert.equal(report.dispatchAudit.overwatchModifiedSubsystemImplementation, false);

  const reportedOwners = new Map(report.dispatchAudit.subsystems.map(record => [record.subsystem, record]));
  for (const [owner, commits] of Object.entries(ownerCommits)) {
    const record = reportedOwners.get(owner);
    assert.ok(record, `Missing historical dispatch record for ${owner}.`);
    assert.deepEqual(record.commits, commits);
    assert.deepEqual(record.files.slice().sort(), unionChangedPaths(commits));
    for (const commit of commits) {
      assert.equal(git("cat-file", "-t", commit), "commit");
      execFileSync("git", ["merge-base", "--is-ancestor", commit, checkpointCommit]);
    }
  }

  assert.deepEqual(report.dispatchAudit.filesChangedByOverwatch.slice().sort(), expectedOverwatchFiles);
  assert.deepEqual(changedPaths(checkpointCommit), expectedOverwatchFiles);
  assert.equal(
    sha256(historicalBytes(governance.retentionBoundary.policyPath)),
    governance.retentionBoundary.policySha256
  );
  assert.equal(retentionPolicy.status, "defined_fail_closed_pending_explicit_retention_boundary");
  assert.equal(retentionPolicy.retentionDecision.numericDurationSelected, false);
  assert.equal(retentionPolicy.retentionDecision.activationEligible, false);
  assert.equal(activationTemplate.templateState, "INERT_DEFAULT_OFF");
  assert.equal(activationTemplate.collection, "OFF");
  assert.equal(activationTemplate.activeCohortCount, 0);
  assert.equal(intelligenceSpec.currentState.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligenceSpec.currentState.collection, "OFF");
  assert.equal(intelligenceSpec.currentState.recommendationInfluence, "OFF");

  const fitnessWorkspace = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const artifactIds = new Set(fitnessWorkspace.canonicalArtifacts.map(artifact => artifact.artifactId));
  for (const artifactId of [
    "fitness_connection_route_iq_prospective_retention_policy",
    "fitness_connection_route_iq_collection_activation_governance",
    "fitness_connection_route_iq_collection_activation_batch_record"
  ]) {
    assert.equal(artifactIds.has(artifactId), true, `${artifactId} was not registered at the historical checkpoint.`);
  }

  assert.equal(report.currentBoundaries.productionAccessUsed, false);
  assert.equal(report.currentBoundaries.deploymentAuthorized, false);
  assert.equal(report.release.activationReadiness, "HOLD_NOT_ACTIVATION_READY");
  assert.equal(governance.architectureBoundary.productionAccessPerformed, false);
  assert.equal(governance.architectureBoundary.productionMutationPerformed, false);
  assert.equal(governance.architectureBoundary.collectionActivated, false);
  assert.equal(governance.architectureBoundary.recommendationInfluence, "OFF");

  return {
    status: "PASS",
    batchId,
    ownerCommits: Object.values(ownerCommits).flat().length,
    retentionPolicy: "FAIL_CLOSED_PENDING_EXPLICIT_BOUNDARY",
    activationReadiness: "HOLD_NOT_ACTIVATION_READY",
    activeCohorts: 0,
    dispositionConsumers: 7,
    dispositionExcludedDomains: 12,
    productionAccessUsed: false,
    deploymentAuthorized: false,
    collection: "OFF",
    recommendationInfluence: "OFF"
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchRouteIqProspectiveCollectionActivation(), null, 2));
}
