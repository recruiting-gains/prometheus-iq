import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildGovernedCodexEvidenceBundle,
  validateGovernedCodexEvidenceBundle,
  verifyFitnessConnectionEvidencePreservation
} from "../data/route-iq-commercial-readiness-v1/governed-codex-evidence-bundle.mjs";
import { verifyRouteIqCommercialProductContract } from "./verify-route-iq-commercial-product-contract.mjs";
import { verifyRouteIqCommercialReadinessIntelligence } from "./verify-route-iq-commercial-readiness-intelligence.mjs";
import { runRouteIqCommercialCapacityHarness } from "../workers/infrastructure/route-iq-commercial-capacity-harness.mjs";

const root = resolve(import.meta.dirname, "..");
const batchId = "BATCH-20260718-002";
const startingCommit = "8f0484ea4edbab086db8d4d5f2424acf9c8bee74";
const startingTree = "0a9b3171426e0b4fc5e230e6ddef32461969021b";
const legacyIntelligenceCommit = "9f9cb75dd8122bc07dda72d61e9ced119d409063";
const intelligenceOwnershipSuccessor = "a8068271e110f3b260624c3df6a3b39054421123";
const intelligenceProvenancePath = "intelligence/provenance/route-iq-commercial-readiness-founder-snapshot-owner-reconstruction-v1.json";
const canonicalPrincipal = "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4";
const accidentalArchiveSha256 = "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765";

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

function changedPaths(commit) {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").filter(Boolean).sort() : [];
}

function commitIdentity(commit) {
  const [author, committer] = git("show", "-s", "--format=%ae%n%ce", commit).split("\n");
  return { author, committer };
}

function ownerAllowsPath(email, path) {
  const rules = {
    "crm@prometheus.local": /^(?:crm\/.*|tests\/crm-route-iq-request-lifecycle\.test\.mjs)$/u,
    "data@prometheus.local": /^(?:data\/route-iq-commercial-readiness-v1\/.*|scripts\/build-route-iq-governed-codex-evidence-bundle\.mjs|tests\/route-iq-commercial-readiness-data\.test\.mjs)$/u,
    "dashboard@prometheus.local": /^(?:_headers|index\.html|sw\.js|deploy\/cloudflare-pages\/(?:_headers|index\.html|sw\.js)|scripts\/verify-dashboard-(?:runtime-workflows|workspace-switcher)\.mjs|tests\/dashboard-route-iq-product-focus\.test\.mjs)$/u,
    "infrastructure@prometheus.local": /^(?:docs\/route-iq-(?:request-crm-infrastructure|founder-daily-snapshot-infrastructure)-v1\.md|integrations\/shared-workspace-lead-intake-contract\.js|workers\/(?:infrastructure\/route-iq-(?:commercial-capacity-harness|request-crm-[^/]+)\.(?:mjs|js|json)|prometheus-iq-worker\.js)|wrangler\.prometheusrouteiq-website\.jsonc|scripts\/verify-route-iq-(?:request-crm|founder-daily-snapshot)-infrastructure\.mjs|tests\/route-iq-(?:request-crm|founder-daily-snapshot)-infrastructure\.test\.mjs)$/u,
    "intelligence@prometheus.local": /^(?:intelligence\/.*|scripts\/(?:verify-route-iq-commercial-readiness-intelligence|verify-shadow-decision-readiness)\.mjs|tests\/(?:route-iq-commercial-readiness-intelligence[^/]*|shadow-decision-readiness)\.test\.mjs)$/u,
    "route-iq@prometheus.local": /^(?:docs\/route-iq-commercial-product-contract-v1\.json|scripts\/verify-route-iq-commercial-product-contract\.mjs|tests\/route-iq-commercial-product-contract\.test\.mjs)$/u,
    "website@prometheus.local": /^(?:src\/.*|landing\.html|public-site-static\/.*|deploy\/prometheusrouteiq-website\/.*|tests\/website-route-iq-product-focus\.test\.mjs)$/u,
    "overwatch@prometheus.local": /^(?:overwatch\/.*|scripts\/verify-(?:cross-subsystem-artifact-contracts|overwatch-route-iq-commercial-readiness)\.mjs|tests\/(?:cross-subsystem-artifact-contracts|overwatch-route-iq-commercial-readiness)\.test\.mjs)$/u
  };
  return rules[email]?.test(path) === true;
}

function verifyOwnership() {
  assert.equal(git("rev-parse", `${startingCommit}^{tree}`), startingTree);
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", startingCommit, "HEAD"], { cwd: root });
  const commits = git("rev-list", "--reverse", `${startingCommit}..HEAD`).split("\n").filter(Boolean);
  assert.ok(commits.length >= 1, "Commercial-readiness batch has no commits.");
  assert.equal(git("rev-list", "--min-parents=2", `${startingCommit}..HEAD`), "", "Batch must not contain merge commits.");

  let legacyGapObserved = false;
  for (const commit of commits) {
    const identity = commitIdentity(commit);
    const paths = changedPaths(commit);
    if (commit === legacyIntelligenceCommit) {
      legacyGapObserved = true;
      assert.deepEqual(identity, {
        author: "overwatch-rollback@prometheus.local",
        committer: "overwatch-rollback@prometheus.local"
      });
      assert.ok(paths.every(path => ownerAllowsPath("intelligence@prometheus.local", path)), "Legacy provenance gap contains a non-Intelligence path.");
      continue;
    }
    assert.equal(identity.author, identity.committer, `Author/committer ownership mismatch in ${commit}.`);
    assert.ok(paths.length > 0, `Empty commit is not allowed: ${commit}.`);
    assert.ok(paths.every(path => ownerAllowsPath(identity.author, path)), `Owner path violation in ${commit} (${identity.author}).`);
  }
  assert.equal(legacyGapObserved, true, "Disclosed Intelligence provenance gap is missing from the preserved chain.");

  const provenance = readJson(intelligenceProvenancePath);
  assert.equal(provenance.legacyCommit, legacyIntelligenceCommit);
  assert.equal(provenance.classification, "DISCLOSED_LOCAL_AUTHOR_IDENTITY_CONTAMINATION");
  assert.equal(provenance.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(provenance.legacyCommitMetadata?.retroactiveOwnershipClaimed, false);
  assert.equal(provenance.legacyCommitMetadata?.historyRewritten, false);
  assert.equal(provenance.reconstruction?.comparisonResult, "IDENTICAL");
  assert.equal(provenance.comparisonSummary?.result, "IDENTICAL");
  assert.ok(Array.isArray(provenance.affectedPaths));
  assert.ok(provenance.affectedPaths.length >= 4);
  for (const file of provenance.affectedPaths) {
    assert.equal(file.canonicalSha256, file.reconstructedSha256);
    assert.equal(file.canonicalSha256, sha256(read(file.path)));
    assert.equal(file.result, "IDENTICAL");
  }
  const successor = commits.find(commit => {
    const identity = commitIdentity(commit);
    return identity.author === "intelligence@prometheus.local" && changedPaths(commit).includes(intelligenceProvenancePath);
  });
  assert.ok(successor, "Intelligence owner reconstruction successor commit is missing.");

  return { commits, successor };
}

function verifyCommercialConfiguration() {
  const registry = readJson("data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json");
  assert.equal(registry.product, "route_iq");
  assert.equal(registry.activeProduct, true);
  assert.equal(registry.recommendationInfluence, "OFF");
  assert.equal(registry.prospectiveCollection, "OFF");
  const fitness = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const smoothie = registry.workspaces.find(workspace => workspace.workspaceId === "smoothie_depot");
  const synthetic = registry.workspaces.find(workspace => workspace.workspaceId === "summit_roofing_synthetic");
  assert.equal(fitness.business.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(fitness.business.publicRelationshipClaimsAllowed, false);
  assert.equal(fitness.evidenceGovernance.crossWorkspaceEvidenceAllowed, false);
  const cruz = fitness.users.find(user => user.representativeId === "cruz");
  const anthony = fitness.users.find(user => user.representativeId === "anthony");
  assert.equal(cruz.authenticatedPrincipalId, canonicalPrincipal);
  assert.equal(cruz.identityMappingStatus, "exact_authenticated_identity_mapped");
  assert.equal(anthony.authenticatedPrincipalId, null);
  assert.equal(anthony.identityMappingStatus, "pending_exact_authenticated_identity");
  assert.equal(smoothie.workspaceState, "inactive_historical");
  assert.equal(smoothie.normalOperationVisible, false);
  assert.equal(smoothie.intelligenceEligibility.governedEvidenceLearningEligible, false);
  assert.equal(synthetic.business.businessType, "roofing_outside_sales");
  assert.equal(synthetic.operatingProfileId, "roofing");
  assert.equal(synthetic.productionActivationAuthorized, false);
  assert.equal(synthetic.evidenceGovernance.classification, "SYNTHETIC_NONCANONICAL");
  return { registry, fitness, smoothie, synthetic };
}

function verifyEvidenceAndConsumers() {
  const preservation = verifyFitnessConnectionEvidencePreservation({ repoRoot: root });
  assert.equal(preservation.fileCount, 9);
  assert.equal(preservation.aggregateSha256, "f7c328fc5da300e70355a6363049323ca6699eab2c54a12f0f1ed83ff07a02fd");
  const manifest = readJson("data/route-iq-commercial-readiness-v1/fitness-connection-evidence-preservation-v1.json");
  assert.equal(manifest.accidentalArchiveBoundary.rawSha256, accidentalArchiveSha256);
  assert.equal(manifest.accidentalArchiveBoundary.protectedArtifactCount, 7);
  assert.equal(manifest.accidentalArchiveBoundary.state, "EXCLUDED_FROM_ANALYTICS");
  assert.equal(manifest.accidentalArchiveBoundary.productionDispositionVerification, "NOT_READ_IN_THIS_BATCH");
  for (const file of manifest.files) {
    const bytes = readFileSync(resolve(root, file.path));
    assert.equal(bytes.byteLength, file.byteLength, `${file.path} byte length drifted.`);
    assert.equal(sha256(bytes), file.sha256, `${file.path} hash drifted.`);
  }
  for (const path of [
    "intelligence/contracts/read-only-field-session-learning-contracts.json",
    "intelligence/contracts/off-route-learning-intelligence-contracts.json",
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
    "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-retention-policy-v1.json"
  ]) {
    assert.ok(read(path).includes(accidentalArchiveSha256), `${path} lost the exact accidental-archive exclusion boundary.`);
  }
  return preservation;
}

function verifyDashboardWebsiteAndRuntime() {
  const dashboard = read("index.html");
  const dashboardDeploy = read("deploy/cloudflare-pages/index.html");
  assert.equal(dashboard, dashboardDeploy);
  assert.equal(dashboard.includes("Smoothie Depot"), false);
  assert.equal(/\bGaia\b|\bAthena\b/u.test(dashboard), false);
  assert.ok(dashboard.includes("/api/dashboard/route-iq/intelligence/daily-snapshot"));
  assert.ok(dashboard.includes("businessConfigurationSha256"));

  const website = `${read("src/main.jsx")}\n${read("src/styles.css")}\n${read("src/route-iq-request-form.js")}`;
  assert.ok(website.includes("REQUEST ROUTE IQ"));
  assert.ok(website.includes("Prometheus"));
  assert.ok(website.includes("Route IQ"));
  assert.equal(/Fitness Connection|Smoothie Depot|\bGaia\b|\bAthena\b/u.test(website), false);
  assert.equal(/customer partner|official partner|sponsor|endorsed by/iu.test(website), false);

  const crm = readJson("crm/route-iq-request-crm-contract-v1.json");
  assert.equal(crm.authorization.authorizedImmutablePrincipal, canonicalPrincipal);
  assert.equal(crm.authorization.displayNameAuthorizationProhibited, true);
  assert.equal(crm.authorization.representativeAuthorization, false);
  assert.equal(crm.durability.requiresAtomicPutIfAbsent, true);
  assert.equal(crm.minimalPii.unknownFieldsRejected, true);

  const runtime = readJson("workers/infrastructure/route-iq-request-crm-runtime-v1.json");
  assert.equal(runtime.storage.backend, "sqlite_backed_durable_object");
  assert.equal(runtime.storage.productionProvisioned, false);
  assert.equal(runtime.boundaries.prospectiveCollection, "OFF");
  assert.equal(runtime.boundaries.activeCohorts, 0);
  assert.equal(runtime.boundaries.recommendationInfluence, "OFF");

  const worker = read("workers/prometheus-iq-worker.js");
  assert.ok(worker.includes("/api/dashboard/route-iq/intelligence/daily-snapshot"));
  assert.ok(worker.includes(canonicalPrincipal));
  assert.ok(worker.includes("route-iq-commercial-readiness-intelligence-v1"));
  assert.ok(worker.includes('"Cache-Control": "no-store"'));
  assert.ok(worker.includes('authorized: true'));
  assert.ok(worker.includes('callerSupplied: false'));
  assert.ok(worker.includes('mappingStatus: "securely_mapped"'));
  return { crm, runtime };
}

export async function verifyOverwatchRouteIqCommercialReadiness({ requireClean = true } = {}) {
  const governance = readJson("overwatch/governance/route-iq-commercial-readiness-v1.json");
  assert.equal(governance.batchId, batchId);
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.productState.soleActiveProduct, "route_iq");
  assert.equal(governance.productState.gaia, "PAUSED");
  assert.equal(governance.productState.athena, "ARCHITECTURE_ONLY");
  assert.equal(governance.safety.recommendationInfluence, "OFF");
  assert.equal(governance.safety.prospectiveCollection, "OFF");
  assert.equal(governance.safety.activeCohorts, 0);
  assert.equal(governance.safety.deploymentAuthorized, false);
  assert.equal(governance.dispatchAudit.verificationOwner, "Prometheus Overwatch");
  assert.equal(governance.dispatchAudit.overwatchImplementationAllowed, false);
  assert.equal(governance.startingRepositoryState.commit, startingCommit);
  assert.equal(governance.startingRepositoryState.tree, startingTree);
  assert.equal(governance.retainedProductionBehaviorSourceBaseline.commit, "dec2ba1b137b0123b6f072ada4b3dd184f88c80d");
  assert.equal(governance.retainedProductionBehaviorSourceBaseline.tree, "61258b4edcafe2af6e94f76b9e011e2486cb2fe6");
  assert.equal(governance.retainedProductionBehaviorSourceBaseline.liveProductionQueriedByBatch, false);
  assert.equal(governance.retainedProductionBehaviorSourceBaseline.liveProductionStateClaimed, false);
  assert.equal(governance.ownershipProvenance.legacyCommit, legacyIntelligenceCommit);
  assert.equal(governance.ownershipProvenance.successorCommit, intelligenceOwnershipSuccessor);
  assert.equal(governance.ownershipProvenance.ownerEvidence, intelligenceProvenancePath);
  assert.equal(governance.ownershipProvenance.semanticComparison, "IDENTICAL");
  assert.equal(governance.ownershipProvenance.byteComparison, "IDENTICAL");
  assert.equal(governance.ownershipProvenance.retroactiveOwnershipClaimed, false);
  assert.equal(governance.ownershipProvenance.historyRewritten, false);

  const ownership = verifyOwnership();
  assert.equal(ownership.successor, intelligenceOwnershipSuccessor);
  verifyCommercialConfiguration();
  const preservation = verifyEvidenceAndConsumers();
  verifyDashboardWebsiteAndRuntime();

  const product = verifyRouteIqCommercialProductContract();
  assert.equal(product.status, "passed");
  assert.equal(product.acceptanceGateCount, 15);
  assert.equal(product.recommendationInfluence, "OFF");
  assert.equal(product.prospectiveCollection, "OFF");
  assert.equal(product.founderDailySnapshotLifecycle.status, "integrated");

  const intelligence = verifyRouteIqCommercialReadinessIntelligence();
  assert.equal(intelligence.status, "passed");
  assert.equal(intelligence.learningState, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligence.recommendationInfluence, "OFF");

  const bundle = buildGovernedCodexEvidenceBundle({ repoRoot: root });
  validateGovernedCodexEvidenceBundle(bundle);
  assert.equal(bundle.canonicalProductionDatabase, false);
  assert.equal(bundle.manifest.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(bundle.manifest.redactionStatus, "REDACTED_ALLOWLIST_ONLY");
  assert.ok(bundle.manifest.exclusions.some(exclusion => exclusion.sourceRecordSha256 === accidentalArchiveSha256));

  const capacity = await runRouteIqCommercialCapacityHarness();
  assert.deepEqual(capacity.verifiedSafeInitialCapacity, { workspaceCount: 10, totalUsers: 100, concurrentUsers: 25 });
  assert.equal(capacity.recordIntegrity.lostAcceptedRecords, 0);
  assert.equal(capacity.recordIntegrity.duplicateAcceptedRecords, 0);
  assert.equal(capacity.isolation.crossWorkspaceExposure, 0);
  assert.equal(capacity.isolation.crossUserExposure, 0);
  assert.equal(capacity.boundaries.productionCapacityClaim, false);

  if (requireClean) assert.equal(git("status", "--porcelain=v1"), "", "Final working tree must be clean.");
  const head = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  return Object.freeze({
    status: "PASS",
    batchId,
    head,
    tree,
    outgoingCommitCount: ownership.commits.length,
    ownershipRepairCommit: ownership.successor,
    acceptanceGates: 15,
    configuredSyntheticBusiness: "summit_roofing_synthetic",
    preservedEvidenceFiles: preservation.fileCount,
    preservedEvidenceAggregateSha256: preservation.aggregateSha256,
    accidentalArchiveSha256,
    codexBundleRecordCount: bundle.manifest.authorizedRecordCount,
    codexBundleSha256: bundle.integrity.payloadSha256,
    capacity,
    readiness: intelligence.learningState,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    deploymentPerformed: false
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(await verifyOverwatchRouteIqCommercialReadiness(), null, 2));
}
