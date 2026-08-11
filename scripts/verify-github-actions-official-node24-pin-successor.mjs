#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const contractPath =
  "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json";
const predecessorGovernancePath =
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeActionPins(source) {
  return source
    .replace(/actions\/checkout@[^\s]+/gu, "actions/checkout@<PIN>")
    .replace(/actions\/setup-node@[^\s]+/gu, "actions/setup-node@<PIN>");
}

function actionPins(source, action) {
  return [...source.matchAll(new RegExp(`uses:\\s*actions/${action}@([^\\s]+)`, "gu"))]
    .map(match => match[1]);
}

function committedSource(commit, path) {
  return execFileSync("/usr/bin/git", ["show", `${commit}:${path}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
}

export function verifyGithubActionsOfficialNode24PinSuccessor() {
  const contract = JSON.parse(read(contractPath));
  const predecessorGovernance = JSON.parse(read(predecessorGovernancePath));
  const checkoutPin = contract.actions.checkout.commit;
  const setupNodePin = contract.actions.setupNode.commit;
  const workflowDirectory = resolve(root, ".github/workflows");
  const actualPaths = readdirSync(workflowDirectory)
    .filter(path => /\.ya?ml$/u.test(path))
    .map(path => `.github/workflows/${path}`)
    .sort();
  const governedPaths = contract.workflows.map(entry => entry.path).sort();

  assert.equal(contract.contractVersion, "github-actions-official-node24-pin-successor-v1");
  assert.equal(contract.batchId, "BATCH-20260810-002");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.startingRepository.commit,
    "f49692d9bb6a18b1fdb5d8038e13df902d96d8a5");
  assert.equal(contract.startingRepository.tree,
    "e7a1a31af6a52b1564ac0ee65e295f8c65ce9275");
  assert.equal(contract.predecessorQualification.runId, 31437455764);
  assert.equal(contract.predecessorQualification.jobId, 93614660986);
  assert.deepEqual({
    invocations: contract.predecessorQualification.testInvocations,
    tests: contract.predecessorQualification.tests,
    passed: contract.predecessorQualification.passed,
    failed: contract.predecessorQualification.failed,
    skipped: contract.predecessorQualification.governedSkips,
    modules: contract.predecessorQualification.buildModules
  }, {
    invocations: 75,
    tests: 1786,
    passed: 1782,
    failed: 0,
    skipped: 4,
    modules: 991
  });

  for (const [name, expected] of Object.entries({
    checkout: {
      repository: "actions/checkout",
      version: "7.0.1",
      commit: "3d3c42e5aac5ba805825da76410c181273ba90b1",
      runtime: "node24",
      actionYamlSha256: "d59219cb79590abdb877deaa14e3b65a00c05318bf5a6f3b989b9162b5d08c35"
    },
    setupNode: {
      repository: "actions/setup-node",
      version: "7.0.0",
      commit: "820762786026740c76f36085b0efc47a31fe5020",
      runtime: "node24",
      actionYamlSha256: "5d765941ab5d8bef27f08e81b0b041cdb2df2050ea0261dc925d157a2bafbd2b"
    }
  })) {
    const action = contract.actions[name];
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(action[field], value, `${name}.${field} drifted`);
    }
    assert.equal(action.owner, "actions");
    assert.equal(action.ownerType, "Organization");
    assert.equal(action.tagResolvedDirectlyToCommit, true);
    assert.equal(action.commitSignatureVerified, true);
    assert.equal(action.commitSignatureReason, "valid");
    assert.match(action.commit, /^[0-9a-f]{40}$/u);
  }

  assert.deepEqual(actualPaths, governedPaths);
  let checkoutOccurrences = 0;
  let setupNodeOccurrences = 0;
  let existingCacheInputs = 0;
  let exactNodeVersions = 0;
  let majorNodeVersions = 0;
  let artifactUploadWriteWorkflows = 0;

  for (const evidence of contract.workflows) {
    const current = read(evidence.path);
    const predecessor = committedSource(contract.startingRepository.commit, evidence.path);
    assert.equal(sha256(predecessor), evidence.predecessorSha256,
      `${evidence.path} predecessor hash drifted`);
    assert.equal(sha256(current), evidence.successorSha256,
      `${evidence.path} successor hash drifted`);
    assert.equal(sha256(normalizeActionPins(predecessor)), evidence.pinNeutralSha256,
      `${evidence.path} predecessor pin-neutral hash drifted`);
    assert.equal(sha256(normalizeActionPins(current)), evidence.pinNeutralSha256,
      `${evidence.path} changed outside action pins`);

    const checkout = actionPins(current, "checkout");
    const setupNode = actionPins(current, "setup-node");
    assert.equal(checkout.length, evidence.checkoutOccurrences);
    assert.equal(setupNode.length, evidence.setupNodeOccurrences);
    assert.ok(checkout.every(pin => pin === checkoutPin),
      `${evidence.path} checkout pin drifted`);
    assert.ok(setupNode.every(pin => pin === setupNodePin),
      `${evidence.path} setup-node pin drifted`);
    const permissions = current.match(/^permissions:\n((?:  [a-z-]+: [a-z]+\n)+)/mu);
    assert.ok(permissions, `${evidence.path} permissions block is missing`);
    assert.match(permissions[1], /^  contents: read$/mu,
      `${evidence.path} contents permission is not read-only`);
    assert.doesNotMatch(permissions[1], /^  contents: write$/mu,
      `${evidence.path} grants repository-content write permission`);
    if (/^  actions: write$/mu.test(permissions[1])) {
      assert.match(current, /uses: actions\/upload-artifact@[0-9a-f]{40}/u,
        `${evidence.path} actions write is not bound to artifact upload`);
      artifactUploadWriteWorkflows += 1;
    }
    assert.doesNotMatch(current, /^  (?:pull_request_target|workflow_run):/mu);
    assert.doesNotMatch(current, /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/u);

    if (/^  pull_request:/mu.test(current)) {
      assert.doesNotMatch(current, /\$\{\{\s*secrets\./u);
      assert.doesNotMatch(current, /^\s+environment:/mu);
    }

    const allActions = [...current.matchAll(/^\s*-?\s*uses:\s*([^\s]+)$/gmu)]
      .map(match => match[1]);
    assert.ok(allActions.every(reference => /^actions\/[a-z0-9-]+@[0-9a-f]{40}$/u.test(reference)),
      `${evidence.path} contains a moving or third-party action reference`);

    checkoutOccurrences += checkout.length;
    setupNodeOccurrences += setupNode.length;
    existingCacheInputs += (current.match(/^\s+cache:\s*\S+/gmu) ?? []).length;
    exactNodeVersions += (current.match(/^\s+node-version:\s*"24\.4\.1"$/gmu) ?? []).length;
    majorNodeVersions += (current.match(/^\s+node-version:\s*"24"$/gmu) ?? []).length;
  }

  assert.equal(checkoutOccurrences, 39);
  assert.equal(setupNodeOccurrences, 39);
  assert.equal(existingCacheInputs, 1);
  assert.equal(exactNodeVersions, 35);
  assert.equal(majorNodeVersions, 4);
  assert.equal(artifactUploadWriteWorkflows, 3);
  assert.equal(contract.occurrenceInventory.activeWorkflowActionReferences.movingTagsAfter, 0);
  assert.equal(contract.workflowBehavior.existingCacheInputOccurrencesBefore, 1);
  assert.equal(contract.workflowBehavior.existingCacheInputOccurrencesAfter, 1);
  assert.equal(contract.workflowBehavior.artifactUploadActionsWriteWorkflowCountBefore, 3);
  assert.equal(contract.workflowBehavior.artifactUploadActionsWriteWorkflowCountAfter, 3);

  const packageJson = JSON.parse(read("package.json"));
  assert.equal(Object.hasOwn(packageJson, "packageManager"), false);
  assert.deepEqual(contract.releaseIdentityContinuity,
    predecessorGovernance.releaseIdentityContinuity);
  assert.equal(contract.releaseIdentityContinuity.applicationOrRollbackSourceChanged, false);
  assert.deepEqual(contract.productionBoundary, {
    cloudflareAuthentication: false,
    cloudflareContactCount: 0,
    deploymentWorkflowDispatchCount: 0,
    deploymentCount: 0,
    productionMutationCount: 0,
    secretAccessCount: 0
  });

  const handoffWorkflow = read(".github/workflows/early-github-handoff-v1.yml");
  assert.match(handoffWorkflow,
    new RegExp(`uses: actions/checkout@${checkoutPin}`, "u"));
  assert.match(handoffWorkflow,
    new RegExp(`uses: actions/setup-node@${setupNodePin}`, "u"));
  assert.match(handoffWorkflow, /node-version: "24\.4\.1"/u);
  assert.match(handoffWorkflow, /fetch-depth: 0/u);
  assert.match(handoffWorkflow, /persist-credentials: false/u);
  assert.match(handoffWorkflow, /clean: true/u);

  return Object.freeze({
    status: "OFFICIAL_NODE24_ACTION_PIN_SOURCE_VERIFIED",
    workflowFiles: actualPaths.length,
    checkoutOccurrences,
    setupNodeOccurrences,
    movingTags: 0,
    newCacheInputs: 0,
    cloudflareContacts: 0,
    deploymentRunsTriggered: 0,
    productionMutations: 0
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyGithubActionsOfficialNode24PinSuccessor(), null, 2));
  } catch (error) {
    console.error(`Official Node 24 action pin verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
