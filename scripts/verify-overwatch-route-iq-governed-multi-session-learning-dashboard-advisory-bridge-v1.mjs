import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  verifyDashboardPublicVisualIdentitySuccessor,
  verifyGovernedMultiSessionLearningAdvisorySuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
import {
  routeIqGovernedLearningArtifactPath,
  verifyCanonicalRouteIqGovernedLearningArtifact
} from "../intelligence/provenance/verify-route-iq-governed-multi-session-learning-v1.mjs";
import {
  verifyRouteIqGovernedLearningAdvisorySecurity
} from "../security/verify-route-iq-governed-learning-advisory-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json";
const privateSessionRepairBranch = "codex/private-session-v2-compatibility-repair";
const privateSessionRepairBase = "c7119fcee140ab8a130cdb888439277fdcbeb6b0";
const privateSessionRepairPreservedDiffSha256 =
  "7bb1d11d90ff4c6916ecc6bfec5f4078aac18ee54c6b5b62248e6c9068f28740";
const privateSessionRepairPreservedPaths = Object.freeze([
  "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs",
  governancePath,
  "scripts/verify-dashboard-runtime-workflows.mjs",
  "tests/dashboard-route-iq-customer-pwa.test.mjs",
  "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
  "tests/route-iq-august-1-launch-envelope.test.mjs",
  "tests/route-iq-multi-company-runtime-infrastructure.test.mjs",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js"
]);
const privateSessionRepairPaths = Object.freeze([
  ...privateSessionRepairPreservedPaths,
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json",
  "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs"
].sort());

const expectedChangedPaths = new Map([
  ["ff06fb0723e0842c970fd344049b999ba774faa4", [
    "data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs",
    "data/route-iq-field-sessions-v1/route-iq-governed-learning-source-v1.json",
    "tests/helpers/route-iq-governed-learning-fixtures.mjs",
    "tests/route-iq-eligible-session-manifest.test.mjs"
  ]],
  ["eff79c156b1820621cf80b4e4eb87c030d8c5024", [
    "intelligence/off-route-learning-intelligence.mjs",
    "intelligence/read-only-field-session-learning.mjs",
    "intelligence/route-iq-governed-multi-session-learning.mjs",
    "tests/route-iq-governed-multi-session-learning.test.mjs"
  ]],
  ["53d080494c7377789b697d8bcc47fd0e8958b722", [
    "dashboard/route-iq-dashboard-platform.mjs",
    "index.html",
    "tests/dashboard-route-iq-governed-learning-advisory.test.mjs"
  ]],
  ["9568ccfcbb72035bbd4ff56994209a09b6e06143", [
    "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
    "intelligence/provenance/verify-route-iq-governed-multi-session-learning-v1.mjs",
    "tests/route-iq-governed-multi-session-learning.test.mjs"
  ]],
  ["267225d51e32acc6f50ce932a945e2749783734e", [
    "_headers",
    "deploy/cloudflare-pages/_headers",
    "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs",
    "deploy/cloudflare-pages/index.html",
    "index.html",
    "tests/route-iq-governed-learning-advisory-infrastructure.test.mjs",
    "workers/infrastructure/route-iq-governed-learning-advisory-runtime.js",
    "workers/prometheus-iq-worker.js"
  ]],
  ["5a96af214010d7b446b0f209b6239933c86cc838", [
    "security/route-iq-governed-learning-advisory-v1.json",
    "security/verify-route-iq-governed-learning-advisory-v1.mjs",
    "tests/route-iq-governed-learning-advisory-security.test.mjs"
  ]],
  ["da3f9ff739ecb883ac2bddb169aefb1b9632b525", [
    "patents/route-iq/GOVERNED_MULTI_SESSION_LEARNING_DASHBOARD_ADVISORY_BRIDGE_V1.md",
    "patents/route-iq/INVENTION_EVIDENCE_REGISTER.md"
  ]],
  ["0e3d720f09e65cea066c5181afdff44d96a4e8ca", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["76946be76fea7dd9ec558739f63bd7310a766a66", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["7633c44d5e43ca64e32ece2da38f6e9925d34d4c", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["f1b889bb45e357a757656d992e91d95580cc8880", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["2f86078e53d80f72f8ff02e36e00aa564120f9c6", [
    "intelligence/provenance/protected-baseline-synchronization-governed-multi-session-learning-advisory-v1.json"
  ]],
  ["ab4940262d2eb843b2f8bf6f451e881cedf91cf9", [
    "scripts/verify-dashboard-runtime-workflows.mjs"
  ]],
  ["a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392", [
    "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
    "intelligence/operating-profile-engine.mjs",
    "intelligence/read-only-field-session-learning.mjs",
    "intelligence/route-iq-governed-multi-session-learning.mjs",
    "tests/operating-profile-engine.test.mjs",
    "tests/route-iq-governed-multi-session-learning.test.mjs"
  ]],
  ["18d317b2ff6d7e7b755ff86d820128a87ac96729", [
    "intelligence/provenance/protected-baseline-synchronization-governed-multi-session-learning-advisory-v1.json",
    "intelligence/provenance/protected-baseline-synchronization-outcome-semantic-integrity-v1.json"
  ]]
]);

function read(path) {
  return readFileSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(read(path).toString("utf8"));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function git(args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function changedPaths(commit) {
  return git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
    .trim().split("\n").filter(Boolean).sort();
}

export function canonicalGitHubRepositoryIdentity(remote) {
  const value = String(remote || "").trim();
  const match = value.match(
    /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/u
  );
  if (!match) return null;
  const repository = match[2].replace(/\.git$/u, "");
  if (!repository) return null;
  return `${match[1].toLowerCase()}/${repository.toLowerCase()}`;
}

export function isGovernedMainCheckout({
  branch,
  head,
  originMain,
  environment = {}
}) {
  if (branch === "main") return true;
  return ["", "HEAD"].includes(branch)
    && head === originMain
    && environment.GITHUB_ACTIONS === "true"
    && environment.GITHUB_REPOSITORY === "PrometheusRouteIQ/prometheus-iq"
    && environment.GITHUB_REF === "refs/heads/main"
    && environment.GITHUB_REF_NAME === "main"
    && environment.GITHUB_REF_TYPE === "branch"
    && environment.GITHUB_EVENT_NAME === "workflow_dispatch"
    && environment.GITHUB_SHA === head;
}

function isExactPrivateSessionRepairCheckout({ branch, head, originMain }) {
  if (branch !== privateSessionRepairBranch || originMain !== privateSessionRepairBase) {
    return false;
  }
  try {
    if (git(["merge-base", head, originMain]).trim() !== originMain) return false;
    if (git(["rev-list", "--merges", `${originMain}..${head}`]).trim()) return false;
    const statusLines = git(["status", "--porcelain=v1", "--untracked-files=all"])
      .trim().split("\n").filter(Boolean);
    if (statusLines.some(line => line.startsWith("?? "))) return false;
    const changed = git(["diff", "--name-only", originMain, "--"])
      .trim().split("\n").filter(Boolean).sort();
    if (changed.length !== privateSessionRepairPaths.length
      || changed.some((path, index) => path !== privateSessionRepairPaths[index])) {
      return false;
    }
    const preservedDiff = execFileSync("/usr/bin/git", [
      "diff", "--binary", originMain, "--", ...privateSessionRepairPreservedPaths
    ], { cwd: root, encoding: null, maxBuffer: 16 * 1024 * 1024 });
    return createHash("sha256").update(preservedDiff).digest("hex")
      === privateSessionRepairPreservedDiffSha256;
  } catch {
    return false;
  }
}

function verifyOwnerCommits(governance) {
  assert.equal(governance.ownerCommits.length, expectedChangedPaths.size);
  for (const ownerCommit of governance.ownerCommits) {
    const fields = git([
      "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      ownerCommit.commit
    ]).trim().split("\n");
    assert.deepEqual(fields, [
      ownerCommit.commit,
      ownerCommit.tree,
      ownerCommit.owner,
      ownerCommit.owner,
      ownerCommit.subject
    ], `Owner identity drifted: ${ownerCommit.commit}`);
    assert.deepEqual(
      changedPaths(ownerCommit.commit),
      [...expectedChangedPaths.get(ownerCommit.commit)].sort(),
      `Owner scope drifted: ${ownerCommit.commit}`
    );
    execFileSync("/usr/bin/git", [
      "merge-base", "--is-ancestor", ownerCommit.commit, "HEAD"
    ], { cwd: root, stdio: "ignore" });
  }
}

function verifyGeneratedParity() {
  for (const [source, mirror] of [
    ["index.html", "deploy/cloudflare-pages/index.html"],
    ["_headers", "deploy/cloudflare-pages/_headers"],
    [
      "dashboard/route-iq-dashboard-platform.mjs",
      "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs"
    ]
  ]) {
    assert.deepEqual(read(source), read(mirror), `Generated mirror drifted: ${mirror}`);
  }
}

export function governedLearningAdvisoryBatchDiffRange(governance) {
  assert.equal(typeof governance?.startingRepository?.commit, "string");
  assert.ok(Array.isArray(governance?.ownerCommits) && governance.ownerCommits.length > 0);
  const finalOwnerCommit = governance.ownerCommits.at(-1)?.commit;
  assert.match(finalOwnerCommit, /^[0-9a-f]{40}$/u);
  return `${governance.startingRepository.commit}..${finalOwnerCommit}`;
}

function verifyRepositoryBoundaries(governance) {
  assert.equal(
    git(["rev-parse", `${governance.startingRepository.commit}^{tree}`]).trim(),
    governance.startingRepository.tree
  );
  assert.equal(
    canonicalGitHubRepositoryIdentity(git(["remote", "get-url", "origin"]).trim()),
    canonicalGitHubRepositoryIdentity(governance.startingRepository.remote),
    "Repository identity drifted."
  );
  const head = git(["rev-parse", "HEAD"]).trim();
  const originMain = git(["rev-parse", "refs/remotes/origin/main"]).trim();
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  assert.equal(isGovernedMainCheckout({
    branch,
    head,
    originMain,
    environment: process.env
  }) || isExactPrivateSessionRepairCheckout({ branch, head, originMain }), true,
  "Repository is neither governed main nor the exact authorized private-session repair checkout.");
  const batchDiffRange = governedLearningAdvisoryBatchDiffRange(governance);
  for (const path of governance.unchangedBehaviorPaths) {
    execFileSync("/usr/bin/git", [
      "diff", "--quiet", batchDiffRange, "--", path
    ], { cwd: root, stdio: "ignore" });
  }
  execFileSync("/usr/bin/git", [
    "diff", "--quiet", batchDiffRange, "--",
    governance.historicalEvidence.path
  ], { cwd: root, stdio: "ignore" });
  const changed = git([
    "diff", "--name-only", batchDiffRange
  ]).trim().split("\n").filter(Boolean);
  assert.equal(changed.some(path => path.startsWith(".github/workflows/")), false);
  assert.equal(changed.some(path => /^wrangler(?:\.|\/)/u.test(path)), false);
}

function verifyOutcomeSemanticIntegrity(governance) {
  const record = readJson(governance.semanticIntegritySuccessor.provenancePath);
  const artifact = readJson(routeIqGovernedLearningArtifactPath);
  assert.equal(record.batchId, governance.semanticIntegritySuccessor.batchId);
  assert.equal(record.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(record.status, "OWNER_IMPLEMENTED_PROTECTED_SUCCESSOR");
  assert.equal(
    record.semanticContract.version,
    governance.semanticIntegritySuccessor.semanticContractVersion
  );
  assert.equal(
    record.canonicalArtifact.successorArtifactId,
    governance.canonicalArtifact.artifactId
  );
  assert.equal(
    record.canonicalArtifact.logicalSha256,
    governance.canonicalArtifact.artifactSha256
  );
  assert.equal(record.canonicalArtifact.truthState, "INSUFFICIENT_EVIDENCE");
  assert.equal(record.verifiedInvariants.zeroPositiveLeakageFromReviewRequiredEvidence, true);
  assert.equal(record.verifiedInvariants.historicalFieldSessionArchivesChanged, false);
  assert.equal(record.nextTask.title,
    "Route IQ Prospective Calibration Production Admission + Future-Window Readiness v1");

  for (const transition of record.protectedSourceTransitions) {
    assert.equal(
      sha256(transition.path),
      transition.currentSha256,
      `Outcome semantic successor drifted: ${transition.path}`
    );
    assert.equal(
      createHash("sha256").update(git(["show", `${record.implementation.parent}:${transition.path}`], null)).digest("hex"),
      transition.previousSha256,
      `Outcome semantic predecessor drifted: ${transition.path}`
    );
  }

  const outcomeNodes = new Map(artifact.customerGraphSnapshot.nodes
    .filter(node => node.nodeType === "Outcome")
    .map(node => [node.nodeId, node]));
  const outcomeRelationships = artifact.customerGraphSnapshot.relationships.filter(
    relationship => outcomeNodes.has(relationship.toNodeId)
  );
  const noContactNode = [...outcomeNodes.values()].find(node => (
    node.attributes.rawOutcome === "No contact"
  ));
  const membershipNode = [...outcomeNodes.values()].find(node => (
    node.attributes.rawOutcome === "Membership"
  ));
  const noContactRelationship = outcomeRelationships.find(relationship => (
    relationship.toNodeId === noContactNode?.nodeId
  ));
  const membershipRelationship = outcomeRelationships.find(relationship => (
    relationship.toNodeId === membershipNode?.nodeId
  ));
  assert.equal(noContactNode?.attributes.normalizedOutcome, null);
  assert.equal(noContactNode?.attributes.evidenceStatus, "Review Required");
  assert.equal(noContactRelationship?.relationshipType, "Visited");
  assert.equal(noContactRelationship?.semanticDisposition.successEligible, false);
  assert.equal(membershipNode?.attributes.normalizedOutcome, "sale");
  assert.equal(membershipRelationship?.relationshipType, "Successful");
  assert.equal(
    membershipRelationship?.semanticDisposition.authority.source,
    "active_operating_profile.successEvents"
  );
  for (const relationship of outcomeRelationships.filter(item => (
    ["Successful", "Follow-up"].includes(item.relationshipType)
  ))) {
    assert.equal(relationship.admittedEvidence?.admitted, true);
    assert.notEqual(relationship.reviewState, "human_review_required");
    assert.ok(relationship.sourceEvidenceIds.length > 0);
    assert.ok(relationship.semanticDisposition?.mappingRule?.authority);
  }
  assert.equal(artifact.dashboardAdvisory.evidenceMaturity.truthState, "Insufficient Evidence");
  assert.equal(artifact.dashboardAdvisory.evidenceMaturity.reviewRequiredOutcomeCount, 1);
  return Object.freeze({
    successfulRelationships: outcomeRelationships.filter(item => (
      item.relationshipType === "Successful"
    )).length,
    followUpRelationships: outcomeRelationships.filter(item => (
      item.relationshipType === "Follow-up"
    )).length,
    reviewRequiredOutcomes: artifact.normalizedOutcomes.filter(item => (
      item.semanticDisposition.reviewRequired
    )).length
  });
}

export function verifyOverwatchRouteIqGovernedLearningAdvisoryBridge() {
  const governance = readJson(governancePath);
  assert.equal(governance.batchId, "BATCH-20260812-001");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(
    governance.status,
    "SOURCE_COMPLETE_UNDEPLOYED_HOSTED_QUALIFICATION_PENDING"
  );
  verifyOwnerCommits(governance);
  const dashboardVisualIdentity = verifyDashboardPublicVisualIdentitySuccessor();
  for (const pin of governance.criticalPins) {
    const transitions = dashboardVisualIdentity.transitionsByPath.get(pin.path);
    if (transitions) {
      assert.equal(
        transitions[0].previousSha256,
        pin.sha256,
        `Critical source successor disconnected: ${pin.path}`
      );
      assert.equal(
        sha256(pin.path),
        transitions.at(-1).currentSha256,
        `Critical source successor drifted: ${pin.path}`
      );
    } else {
      assert.equal(sha256(pin.path), pin.sha256, `Critical source drifted: ${pin.path}`);
    }
  }
  verifyGeneratedParity();
  verifyRepositoryBoundaries(governance);

  const artifact = verifyCanonicalRouteIqGovernedLearningArtifact();
  assert.deepEqual(artifact, {
    status: "PASS",
    artifactId: governance.canonicalArtifact.artifactId,
    artifactSha256: governance.canonicalArtifact.artifactSha256,
    manifestSha256: governance.canonicalArtifact.manifestSha256,
    sessions: governance.canonicalArtifact.sessions,
    visits: governance.canonicalArtifact.visits,
    recommendationInfluence: "OFF",
    productionRuntimeActivated: false
  });
  const successor = verifyGovernedMultiSessionLearningAdvisorySuccessor();
  assert.equal(successor.successor.batchId, governance.batchId);
  const semanticIntegrity = verifyOutcomeSemanticIntegrity(governance);
  const security = verifyRouteIqGovernedLearningAdvisorySecurity();
  assert.equal(security.status, "PASS");
  assert.equal(security.founderOnly, true);
  assert.equal(security.publicWorkerExposure, false);
  assert.deepEqual(governance.protectedState, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    confidencePropagation: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    productionStorageAccess: 0,
    cloudflareContacts: 0,
    deployments: 0,
    crmBehaviorChanged: false,
    companionBehaviorChanged: false,
    anthonyMappingChanged: false,
    representativeShadowOutputExposed: false,
    stripeOrLiveBillingChanged: false
  });
  assert.equal(governance.delivery.deploymentAuthorized, false);
  assert.equal(governance.release.productionMutationAuthorized, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: governance.ownerCommits.length,
    artifactId: artifact.artifactId,
    artifactSha256: artifact.artifactSha256,
    manifestSha256: artifact.manifestSha256,
    sessions: artifact.sessions,
    visits: artifact.visits,
    truthState: governance.canonicalArtifact.truthState,
    founderOnly: security.founderOnly,
    publicWorkerExposure: security.publicWorkerExposure,
    historicalEvidence: "UNCHANGED",
    deploymentPerformed: false,
    collection: governance.protectedState.prospectiveCollection,
    activeCohorts: governance.protectedState.activeCohorts,
    recommendationInfluence: governance.protectedState.recommendationInfluence,
    semanticIntegrityBatchId: governance.semanticIntegritySuccessor.batchId,
    successfulRelationships: semanticIntegrity.successfulRelationships,
    followUpRelationships: semanticIntegrity.followUpRelationships,
    reviewRequiredOutcomes: semanticIntegrity.reviewRequiredOutcomes,
    dashboardVisualIdentityBatchId: dashboardVisualIdentity.successor.batchId
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(
    verifyOverwatchRouteIqGovernedLearningAdvisoryBridge(),
    null,
    2
  )}\n`);
}
