import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import {
  buildGovernedCodexEvidenceBundle,
  validateGovernedCodexEvidenceBundle,
  verifyFitnessConnectionEvidencePreservation
} from "../data/route-iq-commercial-readiness-v1/governed-codex-evidence-bundle.mjs";
import { runRouteIqCommercialCapacityHarness } from "../workers/infrastructure/route-iq-commercial-capacity-harness.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyRouteIqCommercialReadinessIntelligence } from "./verify-route-iq-commercial-readiness-intelligence.mjs";

const git = (...args) => execFileSync("/usr/bin/git", args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

export async function verifyOverwatchRouteIqCommercialReadiness({ requireClean = true } = {}) {
  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
  const preservation = verifyFitnessConnectionEvidencePreservation();
  const bundle = buildGovernedCodexEvidenceBundle();
  validateGovernedCodexEvidenceBundle(bundle);
  const intelligence = verifyRouteIqCommercialReadinessIntelligence();
  const capacity = await runRouteIqCommercialCapacityHarness();

  assert.equal(preservation.fileCount, 9);
  assert.equal(bundle.canonicalProductionDatabase, false);
  assert.equal(bundle.manifest.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(bundle.manifest.redactionStatus, "REDACTED_ALLOWLIST_ONLY");
  assert.deepEqual(capacity.verifiedSafeInitialCapacity, {
    workspaceCount: 10,
    totalUsers: 100,
    concurrentUsers: 25
  });
  assert.equal(capacity.recordIntegrity.lostAcceptedRecords, 0);
  assert.equal(capacity.recordIntegrity.duplicateAcceptedRecords, 0);
  assert.equal(capacity.isolation.crossWorkspaceExposure, 0);
  assert.equal(capacity.isolation.crossUserExposure, 0);
  assert.equal(intelligence.learningState, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligence.recommendationInfluence, "OFF");
  if (requireClean) assert.equal(git("status", "--porcelain=v1"), "");

  return Object.freeze({
    status: "PASS",
    batchId: "BATCH-20260723-001",
    acceptanceGates: 17,
    configuredSyntheticBusiness: "northstar_outside_sales_synthetic",
    preservedEvidenceFiles: preservation.fileCount,
    preservedEvidenceAggregateSha256: preservation.aggregateSha256,
    capacity,
    readiness: intelligence.learningState,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    deploymentPerformed: false,
    head: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}")
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(await verifyOverwatchRouteIqCommercialReadiness(), null, 2));
}
