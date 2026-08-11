#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/github-actions-official-node24-pin-successor-v1.json";
const infrastructureContractPath =
  "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json";
const securityRecordPath =
  "security/github-actions-official-node24-pin-successor-v1.json";
const predecessorGovernancePath =
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    stdio: ["ignore", "pipe", "ignore"]
  });
}

function normalizeActionPins(source) {
  return source
    .replace(/actions\/checkout@[^\s]+/gu, "actions/checkout@<PIN>")
    .replace(/actions\/setup-node@[^\s]+/gu, "actions/setup-node@<PIN>");
}

function commitIdentity(commit) {
  const fields = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s", commit
  ]).trimEnd().split("\n");
  return {
    commit: fields[0],
    tree: fields[1],
    parent: fields[2],
    author: fields[3],
    committer: fields[4],
    subject: fields[5]
  };
}

export function hasGithubActionsNode24InfrastructureSuccessor({
  governance,
  infrastructure,
  path,
  previousSha256,
  currentSha256
}) {
  const evidence = infrastructure?.workflows?.find(item => item.path === path);
  const transition = governance?.activeInfrastructureVerifierSuccessors?.find(
    item => item.path === path
  );
  const predecessorMatches = evidence?.predecessorSha256 === previousSha256
    || transition?.previousSha256 === previousSha256;
  const successorMatches = evidence?.successorSha256 === currentSha256
    || transition?.successorSha256 === currentSha256;
  return governance?.batchId === "BATCH-20260810-002"
    && governance?.ownerChain?.infrastructure?.commit ===
      "8782ccb1ad918740473d39ba1b17d3cb443c9ad9"
    && governance?.ownerChain?.infrastructure?.identity ===
      "Prometheus Infrastructure <infrastructure@prometheus.local>"
    && infrastructure?.owner === "Prometheus Infrastructure"
    && infrastructure?.actions?.checkout?.commit ===
      "3d3c42e5aac5ba805825da76410c181273ba90b1"
    && infrastructure?.actions?.setupNode?.commit ===
      "820762786026740c76f36085b0efc47a31fe5020"
    && predecessorMatches
    && successorMatches
    && governance?.productionBoundary?.deploymentCount === 0
    && governance?.productionBoundary?.productionMutationCount === 0;
}

export function evaluateOverwatchGithubActionsNode24PinSuccessor({
  governance,
  infrastructure,
  security,
  predecessorGovernance
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceVersion ===
    "github-actions-official-node24-pin-successor-overwatch-v1",
  "Governance version drifted.");
  require(governance.batchId === "BATCH-20260810-002", "Batch ID drifted.");
  require(governance.owner === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.startingRepository.commit ===
    "f49692d9bb6a18b1fdb5d8038e13df902d96d8a5",
  "Starting commit drifted.");
  require(governance.startingRepository.tree ===
    "e7a1a31af6a52b1564ac0ee65e295f8c65ce9275",
  "Starting tree drifted.");
  require(governance.predecessorClosure.runId === 31437455764,
    "Predecessor run drifted.");
  require(governance.predecessorClosure.jobId === 93614660986,
    "Predecessor job drifted.");
  require(governance.predecessorClosure.tests === 1786
    && governance.predecessorClosure.passed === 1782
    && governance.predecessorClosure.failed === 0
    && governance.predecessorClosure.governedSkips === 4
    && governance.predecessorClosure.buildModules === 991,
  "Predecessor qualification totals drifted.");

  require(governance.ownerChain.infrastructure.commit ===
    security.infrastructureProvenance.commit,
  "Infrastructure commit disagrees with Security evidence.");
  require(governance.ownerChain.infrastructure.tree ===
    security.infrastructureProvenance.tree,
  "Infrastructure tree disagrees with Security evidence.");
  require(governance.ownerChain.security.commit ===
    "3834a6b6529de4e0fe729845b01b331ebbcd3446",
  "Security commit drifted.");
  require(governance.ownerChain.security.parent ===
    governance.ownerChain.infrastructure.commit,
  "Security parent is not the Infrastructure commit.");
  require(governance.ownerChain.overwatch.implementationOwnershipClaimed === false,
    "Overwatch claims implementation ownership.");

  require(governance.successor.checkout.commit === infrastructure.actions.checkout.commit,
    "Checkout successor disagrees with Infrastructure.");
  require(governance.successor.setupNode.commit === infrastructure.actions.setupNode.commit,
    "Setup Node successor disagrees with Infrastructure.");
  require(governance.successor.checkout.commit ===
    security.upstreamVerification.checkout.tagTarget,
  "Checkout successor disagrees with Security.");
  require(governance.successor.setupNode.commit ===
    security.upstreamVerification.setupNode.tagTarget,
  "Setup Node successor disagrees with Security.");
  require(governance.successor.workflowFiles === 15
    && governance.successor.checkoutReferences === 39
    && governance.successor.setupNodeReferences === 39
    && governance.successor.movingTags === 0
    && governance.successor.node20ActionReferencesInActiveWorkflows === 0,
  "Active occurrence disposition drifted.");
  require(governance.successor.permissionsChanged === false
    && governance.successor.triggersChanged === false
    && governance.successor.workflowBehaviorChanged === false,
  "Workflow behavior is not preserved.");
  require(JSON.stringify(governance.releaseIdentityContinuity) ===
    JSON.stringify(infrastructure.releaseIdentityContinuity),
  "Infrastructure release continuity disagrees with Overwatch.");
  require(JSON.stringify(governance.releaseIdentityContinuity) ===
    JSON.stringify(predecessorGovernance.releaseIdentityContinuity),
  "Predecessor release identity drifted.");
  require(security.verdict === "OFFICIAL_NODE24_ACTION_SUPPLY_CHAIN_ACCEPTED",
    "Security acceptance is missing.");
  require(governance.hostedQualification.node20DeprecationWarningAllowed === false,
    "Node 20 warning is allowed.");
  require(governance.productionBoundary.cloudflareContactCount === 0
    && governance.productionBoundary.deploymentWorkflowDispatchCount === 0
    && governance.productionBoundary.deploymentCount === 0
    && governance.productionBoundary.productionMutationCount === 0
    && governance.productionBoundary.secretAccessCount === 0,
  "Production boundary drifted.");
  require(governance.protectedState.collection === "OFF"
    && governance.protectedState.activeCohorts === 0
    && governance.protectedState.recommendationInfluence === "OFF"
    && governance.protectedState.providers === "OFF"
    && governance.protectedState.scheduler === "OFF"
    && governance.protectedState.companion === "DORMANT"
    && governance.protectedState.anthonyMapped === false
    && governance.protectedState.stripe === "NON_LIVE"
    && governance.protectedState.productionDeployment === "UNCHANGED",
  "Protected state drifted.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function verifyOverwatchGithubActionsNode24PinSuccessor() {
  const governance = readJson(governancePath);
  const infrastructure = readJson(infrastructureContractPath);
  const security = readJson(securityRecordPath);
  const predecessorGovernance = readJson(predecessorGovernancePath);
  const evaluation = evaluateOverwatchGithubActionsNode24PinSuccessor({
    governance,
    infrastructure,
    security,
    predecessorGovernance
  });
  assert.equal(evaluation.ok, true, evaluation.failures.join("\n"));

  const infrastructureIdentity = commitIdentity(governance.ownerChain.infrastructure.commit);
  assert.deepEqual(infrastructureIdentity, {
    commit: governance.ownerChain.infrastructure.commit,
    tree: governance.ownerChain.infrastructure.tree,
    parent: governance.ownerChain.infrastructure.parent,
    author: governance.ownerChain.infrastructure.identity,
    committer: governance.ownerChain.infrastructure.identity,
    subject: governance.ownerChain.infrastructure.subject
  });
  const securityIdentity = commitIdentity(governance.ownerChain.security.commit);
  assert.deepEqual(securityIdentity, {
    commit: governance.ownerChain.security.commit,
    tree: governance.ownerChain.security.tree,
    parent: governance.ownerChain.security.parent,
    author: governance.ownerChain.security.identity,
    committer: governance.ownerChain.security.identity,
    subject: governance.ownerChain.security.subject
  });

  const infrastructurePaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    governance.ownerChain.infrastructure.commit
  ]).trim().split("\n").filter(Boolean);
  assert.equal(infrastructurePaths.length,
    governance.ownerChain.infrastructure.changedFileCount);
  assert.equal(infrastructurePaths.filter(path => path.startsWith(".github/workflows/")).length,
    15);
  assert.ok(infrastructurePaths.every(path => /^(?:\.github\/workflows\/|scripts\/|tests\/|workers\/infrastructure\/)/u.test(path)));
  for (const transition of governance.activeInfrastructureVerifierSuccessors) {
    assert.ok(infrastructurePaths.includes(transition.path));
    assert.equal(sha256(git([
      "show", `${governance.startingRepository.commit}:${transition.path}`
    ], null)), transition.previousSha256);
    assert.equal(sha256(git([
      "show", `${governance.ownerChain.infrastructure.commit}:${transition.path}`
    ], null)), transition.successorSha256);
    assert.equal(sha256(readFileSync(resolve(root, transition.path))),
      transition.successorSha256);
  }

  const securityPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    governance.ownerChain.security.commit
  ]).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(securityPaths, [...governance.ownerChain.security.changedFiles].sort());

  assert.equal(sha256(git([
    "show", `${governance.ownerChain.infrastructure.commit}:${security.infrastructureProvenance.contractPath}`
  ], null)), security.infrastructureProvenance.contractSha256);
  assert.equal(sha256(git([
    "show", `${governance.ownerChain.infrastructure.commit}:${security.infrastructureProvenance.verifierPath}`
  ], null)), security.infrastructureProvenance.verifierSha256);

  const workflowPaths = readdirSync(resolve(root, ".github/workflows"))
    .filter(path => /\.ya?ml$/u.test(path))
    .map(path => `.github/workflows/${path}`)
    .sort();
  assert.deepEqual(workflowPaths, infrastructure.workflows.map(item => item.path).sort());
  let checkoutReferences = 0;
  let setupNodeReferences = 0;
  for (const evidence of infrastructure.workflows) {
    const current = read(evidence.path);
    const baseline = git([
      "show", `${governance.startingRepository.commit}:${evidence.path}`
    ]);
    assert.equal(sha256(normalizeActionPins(current)), evidence.pinNeutralSha256);
    assert.equal(sha256(normalizeActionPins(baseline)), evidence.pinNeutralSha256);
    const checkout = [...current.matchAll(/uses:\s*actions\/checkout@([^\s]+)/gu)]
      .map(match => match[1]);
    const setupNode = [...current.matchAll(/uses:\s*actions\/setup-node@([^\s]+)/gu)]
      .map(match => match[1]);
    assert.ok(checkout.every(pin => pin === governance.successor.checkout.commit));
    assert.ok(setupNode.every(pin => pin === governance.successor.setupNode.commit));
    assert.doesNotMatch(current,
      /34e114876b0b11c390a56381ad16ebd13914f8d5|49933ea5288caeca8642d1e84afbd3f7d6820020/u);
    assert.doesNotMatch(current, /actions\/(?:checkout|setup-node)@v\d/u);
    checkoutReferences += checkout.length;
    setupNodeReferences += setupNode.length;
  }
  assert.equal(checkoutReferences, governance.successor.checkoutReferences);
  assert.equal(setupNodeReferences, governance.successor.setupNodeReferences);

  for (const evidence of governance.historicalEvidence) {
    const current = readFileSync(resolve(root, evidence.path));
    const baseline = git([
      "show", `${governance.startingRepository.commit}:${evidence.path}`
    ], null);
    assert.equal(sha256(current), evidence.sha256);
    assert.equal(sha256(baseline), evidence.sha256);
  }

  const packageJson = readJson("package.json");
  assert.equal(Object.hasOwn(packageJson, "packageManager"), false);
  assert.equal(packageJson.devEngines?.packageManager, undefined);

  return Object.freeze({
    status: "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED",
    infrastructureCommit: governance.ownerChain.infrastructure.commit,
    securityCommit: governance.ownerChain.security.commit,
    workflowFiles: workflowPaths.length,
    checkoutReferences,
    setupNodeReferences,
    historicalEvidencePreserved: governance.historicalEvidence.length,
    releaseIdentityChanged: false,
    cloudflareContacts: 0,
    deploymentRunsTriggered: 0,
    productionMutations: 0
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyOverwatchGithubActionsNode24PinSuccessor(), null, 2));
  } catch (error) {
    console.error(`Overwatch Node 24 action pin verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
