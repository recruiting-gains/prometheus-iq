#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createControlledPaidCustomerRehearsalDraft,
  validateControlledPaidCustomerRehearsalDefinition,
  validateControlledPaidCustomerRehearsalDraft
} from "../administration/contracts/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  extractControlledRehearsalRunScripts,
  verifyControlledPaidCustomerOnboardingRehearsalV1
} from "./verify-controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  executeControlledPaidCustomerOnboardingRehearsal
} from "../workers/infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.js";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/controlled-paid-customer-onboarding-rehearsal-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260730-002-controlled-paid-customer-onboarding-rehearsal-v1.json";
const definitionPath =
  "administration/workspace-configurations/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json";
const workflowPath =
  ".github/workflows/controlled-paid-customer-onboarding-rehearsal-v1.yml";
const infrastructureContractPath =
  "workers/infrastructure/controlled-paid-customer-onboarding-rehearsal-v1.json";

const expectedCommits = Object.freeze([
  Object.freeze({
    commit: "160c7aff786c7444622cda4587c1c73d306b9a33",
    parent: "50fa933f45e82224959386bd30d0e57becfb7d3c",
    tree: "16beda602bd9f67f4d7529283e4416a1bac8c55e",
    identity: "Prometheus Administration <administration@prometheus.local>",
    subject: "administration: define controlled customer rehearsal"
  }),
  Object.freeze({
    commit: "e66aea108f1487f7fa933707bd0e2ceb75eb93b3",
    parent: "160c7aff786c7444622cda4587c1c73d306b9a33",
    tree: "f08ec30ffe0db13c407852f099c6835a03416528",
    identity: "Prometheus Administration <administration@prometheus.local>",
    subject: "administration: harden controlled customer rehearsal"
  }),
  Object.freeze({
    commit: "96c8210b94c3b0214dede252aba3d6d46121cd05",
    parent: "e66aea108f1487f7fa933707bd0e2ceb75eb93b3",
    tree: "8e7decf92b5d55e613d8a5ddc4bb2d1e3bd200af",
    identity: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    subject: "infrastructure: execute controlled onboarding rehearsal"
  }),
  Object.freeze({
    commit: "2c094403709415004c07269ea9bbd6e8c950bb68",
    parent: "96c8210b94c3b0214dede252aba3d6d46121cd05",
    tree: "b8d0a364f10e1288e6886e7951ff5f2c29e59d40",
    identity: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    subject: "infrastructure: govern controlled onboarding rehearsal"
  }),
  Object.freeze({
    commit: "41679ab6742dc9fd8639bbc7cfe6a1dc2328d540",
    parent: "ab544fd393f6dffa86a3fc603e72ef5d1883109c",
    tree: "34b0f9922aa1dbcb7d391c0ab829f2efb2febfb1",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: adopt controlled rehearsal smoke contract"
  }),
  Object.freeze({
    commit: "68b396623f6ef0190d4cd938aa6812326b5067f1",
    parent: "29173688b48f20d5ade5a105345b5de974a01c95",
    tree: "479f3097ad3b40038163b2b9fe6a67922511b45b",
    identity: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    subject: "infrastructure: verify rehearsal guard successor"
  }),
  Object.freeze({
    commit: "488837c74eb91950bb8cd37e9b9764490dead98e",
    parent: "3dc74e3a2f783cbed7610e503a89f4c7c59e0239",
    tree: "cb523b32db075887c0bcac81816d4c47c85b0c66",
    identity: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    subject: "infrastructure: repair rehearsal owner preflight"
  })
]);

const protectedState = Object.freeze({
  collection: "OFF",
  activeCohorts: 0,
  recommendationInfluence: "OFF",
  providerRefresh: "OFF",
  scheduler: "OFF",
  customerActivation: "OFF",
  anthonyMapped: false,
  activeBusinesses: 0,
  reserveBusinesses: 0,
  quarantinedBusinesses: 398,
  crmReceipt: "riq_receipt_e74e57903a211291a9f1f37a",
  crmMutationAllowed: false,
  publicWorkerMutationAllowed: false
});

const sorted = values => [...values].sort((left, right) => left.localeCompare(right));
const read = path => readFileSync(resolve(root, path));
const readJson = path => JSON.parse(read(path).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

function assertExactKeys(value, keys, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} object`);
  assert.deepEqual(sorted(Object.keys(value)), sorted(keys), `${label} keys drifted`);
}

function verifyOwnerCommit(record, expected) {
  const metadata = git([
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    expected.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    expected.commit,
    expected.parent,
    expected.tree,
    expected.identity,
    expected.identity,
    expected.subject
  ], `owner provenance drifted for ${expected.commit}`);
  assert.equal(record.commit, expected.commit);
  assert.equal(record.parent, expected.parent);
  assert.equal(record.tree, expected.tree);
  assert.equal(record.identity, expected.identity);
  assert.equal(record.subject, expected.subject);
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", expected.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(paths, record.evidence.map(item => item.path));
  for (const item of record.evidence) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/u);
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${expected.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256, `owner evidence drifted: ${item.path}`);
  }
}

export function validateControlledRehearsalGovernance(governance) {
  assertExactKeys(governance, [
    "acceptedBaseline",
    "batchId",
    "fictionalScope",
    "governanceId",
    "ownerSubsystem",
    "ownership",
    "protectedState",
    "releaseBoundary",
    "requiredEvidence",
    "status"
  ], "governance");
  assert.equal(governance.governanceId,
    "controlled-paid-customer-onboarding-rehearsal-v1");
  assert.equal(governance.batchId, "BATCH-20260730-002");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.status,
    "SOURCE_GOVERNED_QUALIFICATION_PENDING_NOT_DISPATCHED");
  assert.deepEqual(governance.acceptedBaseline, {
    commit: "50fa933f45e82224959386bd30d0e57becfb7d3c",
    tree: "6d30998444d6660de7c42f5988e5f2f56f9966da",
    privateWorker: "5a636567-4268-4179-8015-12a12557d286",
    publicWorker: "6a8713c0-0712-4cda-8a13-daa893ca45f2"
  });
  assert.deepEqual(governance.ownership.implementationOwners, [
    "Prometheus Administration",
    "Prometheus Infrastructure",
    "Prometheus Intelligence Engine"
  ]);
  assert.equal(governance.ownership.verificationOwner, "Prometheus Overwatch");
  assert.equal(governance.ownership.overwatchModifiedSubsystemImplementation, false);
  assert.equal(governance.ownership.ownerCommits.length, expectedCommits.length);
  governance.ownership.ownerCommits.forEach((record, index) => {
    verifyOwnerCommit(record, expectedCommits[index]);
  });
  assert.deepEqual(governance.fictionalScope, {
    classification: "SYNTHETIC_EPHEMERAL_PRODUCTION_REHEARSAL",
    companyId: "company_orion_facility_safety_rehearsal",
    workspaceId: "workspace_orion_facility_safety_rehearsal",
    locationIds: [
      "location_orion_cedar_plains_rehearsal",
      "location_orion_lake_junction_rehearsal"
    ],
    managerPrincipalId: "principal_orion_rehearsal_manager",
    representativePrincipalIds: [
      "principal_orion_rehearsal_rep_alpha",
      "principal_orion_rehearsal_rep_beta"
    ],
    realCustomerDataAllowed: false,
    existingCrmDataAllowed: false
  });
  assert.deepEqual(governance.requiredEvidence, {
    draftCreated: true,
    controlledValidationFailurePreserved: true,
    draftRestored: true,
    finalLifecycleState: "VALIDATED",
    activationImpliedByValidation: false,
    multiLocationAssociationRequired: true,
    tenantAndWorkspaceIsolationRequired: true,
    managerRepresentativeSeparationRequired: true,
    representativeFounderBillingGovernanceAccessAllowed: false,
    operatingHoursFailClosedRequired: true,
    safeEmptyStateRequired: true,
    billingMode: "SIMULATED_ONLY",
    billingActivation: "BLOCKED",
    customerActivation: "OFF",
    invitationDelivery: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    cleanupStatus: "REMOVED",
    remainingRehearsalRecords: 0
  });
  assert.deepEqual(governance.protectedState, protectedState);
  assert.deepEqual(governance.releaseBoundary, {
    workflowTrigger: "workflow_dispatch",
    workflowDispatched: false,
    deploymentPerformed: false,
    cloudflareContacted: false,
    secretValuesAccessed: false,
    sourceBuildCount: 1,
    deploymentRebuildAllowed: false,
    publicWorkerMutationAllowed: false,
    privateWorkerArtifactV2Reused: true,
    pairedForwardRollbackRequired: true,
    rollbackMayCountAsAcceptance: false,
    desktopViewport: "1440x900",
    mobileViewport: "390x844"
  });
  return governance;
}

export function validateControlledRehearsalReport(report) {
  assert.equal(report.batchId, "BATCH-20260730-002");
  assert.equal(report.owner, "Prometheus Overwatch");
  assert.equal(report.status, "SOURCE_ACCEPTED_QUALIFICATION_AND_DEPLOYMENT_PENDING");
  assert.deepEqual(report.acceptedOwnerCommits, expectedCommits.map(item => item.commit));
  assert.deepEqual(report.sourceDetermination, {
    fictionalCompanyOnly: true,
    draftToValidated: "PASS",
    validationFailureEvidence: "PASS",
    multiLocationIntegrity: "PASS",
    tenantIsolation: "PASS",
    authorizationSeparation: "PASS",
    representativeRestrictions: "PASS",
    operatingHours: "PASS",
    safeEmptyState: "PASS",
    billingBlocked: "PASS",
    activationBlocked: "PASS",
    cleanupRemoval: "PASS"
  });
  assert.deepEqual(report.externalAction, {
    workflowDispatched: false,
    workerDeployed: false,
    productionMutation: false,
    crmReadOrWrite: false,
    secretValueAccess: false,
    cloudflareContact: false
  });
  return report;
}

function verifyCurrentOwnerFiles(governance) {
  const governedSuccessors = new Map([
    ["workers/prometheus-iq-worker.js", {
      commit: "54c7e4277e6ed17d3d9cce2921ff7bac77bb94ff",
      sha256: "0ee3fb5426f5104fc70d97c0ce284d149fb5e13d2f521c04214bd361fa39ea61"
    }],
    ["scripts/lib/github-actions-private-worker-workflow-v2.mjs", {
      commit: "7d4110f2d51e3aaf75bd9ac184e91ed6d9d550c5",
      sha256: "bd07a1971bab290a62adb8084fdfd86aeff82380a9f1204feefaf6fa80baa75b"
    }],
    ["workers/infrastructure/github-actions-private-worker-deployment-v2.json", {
      commit: "7d4110f2d51e3aaf75bd9ac184e91ed6d9d550c5",
      sha256: "574db6b4b5edadd53f06c6788aa942ca0221cd4d56278ad341579eda2f1174f7"
    }]
  ]);
  for (const record of governance.ownership.ownerCommits.slice(1)) {
    for (const item of record.evidence) {
      const laterOwnerRecord = governance.ownership.ownerCommits
        .slice(governance.ownership.ownerCommits.indexOf(record) + 1)
        .find(candidate => candidate.evidence.some(next => next.path === item.path));
      if (!laterOwnerRecord) {
        const actual = sha256(read(item.path));
        const successor = governedSuccessors.get(item.path);
        if (successor && actual === successor.sha256) {
          assert.equal(git([
            "merge-base", "--is-ancestor", successor.commit, "HEAD"
          ]), "");
          const changedPaths = git([
            "diff-tree", "--no-commit-id", "--name-only", "-r",
            successor.commit
          ]).split("\n").filter(Boolean);
          assert.ok(changedPaths.includes(item.path),
            `governed successor omitted path: ${item.path}`);
        } else {
          assert.equal(actual, item.sha256,
            `current owner file drifted: ${item.path}`);
        }
      }
    }
  }
}

function verifyWorkflowBoundary() {
  const workflow = read(workflowPath).toString("utf8");
  assert.match(workflow, /^on:\n  workflow_dispatch:/mu);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/mu);
  assert.match(workflow,
    /environment:\s*(?:\n\s+name:\s*)?prometheus-private-worker-production/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  for (const script of extractControlledRehearsalRunScripts(workflow)) {
    assert.doesNotMatch(script, /\$\{\{\s*inputs\.[^}]+\}\}/u,
      "dispatch inputs must not be interpolated into shell scripts");
  }
  assert.match(workflow, /current_public_version/u);
  assert.match(workflow, /!cancelled\(\)/u);
  assert.doesNotMatch(workflow, /\|\|\s*true/u);
}

async function verifyRuntimeEvidence() {
  const evidence = await executeControlledPaidCustomerOnboardingRehearsal();
  assert.equal(evidence.lifecycle.draft, "CREATED");
  assert.equal(evidence.lifecycle.controlledValidation, "FAILED_AS_EXPECTED");
  assert.equal(evidence.lifecycle.failureEvidence, "PRESERVED");
  assert.equal(evidence.lifecycle.recovery, "DRAFT_RESTORED");
  assert.equal(evidence.lifecycle.finalState, "VALIDATED");
  assert.equal(evidence.lifecycle.activated, false);
  assert.equal(evidence.topology.locationCount, 2);
  assert.equal(evidence.topology.representativeCount, 2);
  assert.equal(evidence.topology.managerCount, 1);
  assert.equal(evidence.authorization.managerWorkspaceRead, "AUTHORIZED");
  assert.equal(evidence.authorization.representativeOwnRecordRead, "AUTHORIZED");
  for (const key of [
    "representativeWorkspaceRead",
    "representativePrivilegedAccess",
    "crossUserAccess",
    "crossCompanyAccess",
    "crossWorkspaceAccess"
  ]) assert.equal(evidence.authorization[key], "DENIED");
  assert.equal(evidence.operatingHours.openLocation,
    "ADMISSION_ELIGIBLE_VALIDATION_ONLY");
  assert.equal(evidence.operatingHours.closedLocation, "BUSINESS_NOT_OPEN_NOW");
  assert.equal(evidence.safety.billing, "BLOCKED");
  assert.equal(evidence.safety.customerActivation, "OFF");
  assert.equal(evidence.safety.liveStripe, "DISABLED");
  assert.equal(evidence.safety.invitations, "NOT_SENT");
  assert.equal(evidence.safety.providerRefresh, "OFF");
  assert.equal(evidence.safety.scheduler, "OFF");
  assert.equal(evidence.safety.collection, "OFF");
  assert.equal(evidence.safety.activeCohorts, 0);
  assert.equal(evidence.safety.recommendationInfluence, "OFF");
  assert.equal(evidence.safeEmptyState, "PRESERVED");
  assert.deepEqual(evidence.cleanup, { status: "REMOVED", remainingRecords: 0 });
}

function verifyFictionalDefinition() {
  const definition = validateControlledPaidCustomerRehearsalDefinition(
    readJson(definitionPath)
  );
  const draft = validateControlledPaidCustomerRehearsalDraft(
    createControlledPaidCustomerRehearsalDraft(definition)
  );
  assert.equal(draft.lifecycleState, "DRAFT");
  assert.equal(draft.locations.length, 2);
  assert.equal(draft.principals.filter(item =>
    item.principalKind === "REPRESENTATIVE").length, 2);
  assert.equal(draft.principals.filter(item =>
    item.principalKind === "OWNER_MANAGER").length, 1);
  const serialized = JSON.stringify(definition);
  assert.doesNotMatch(serialized,
    /Fitness Connection|Anthony|riq_receipt_|stripe_(?:live|test)/iu);
}

function verifyNoSecretMaterial() {
  const paths = [
    governancePath,
    reportPath,
    definitionPath,
    workflowPath,
    infrastructureContractPath,
    "workers/infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.js"
  ];
  const serialized = paths.map(path => read(path).toString("utf8")).join("\n");
  assert.doesNotMatch(serialized,
    /(?:cfut_|CF-Access-Client-Secret\s*[:=]\s*["'][^"']+|BEGIN (?:RSA |EC )?PRIVATE KEY|sk_live_)/u);
}

function verifyPackageWiring() {
  const scripts = readJson("package.json").scripts;
  const command =
    "node scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs && node --test tests/overwatch-controlled-paid-customer-onboarding-rehearsal-v1.test.mjs";
  assert.equal(scripts["overwatch:controlled-paid-customer-rehearsal:check"], command);
  assert.ok(scripts.pretest.split(" && ")
    .includes("npm run overwatch:controlled-paid-customer-rehearsal:check"));
  assert.ok(scripts.test.split(" && ")
    .includes("npm run overwatch:controlled-paid-customer-rehearsal:check"));
  assert.ok(scripts["test:overwatch"].includes(
    "tests/overwatch-controlled-paid-customer-onboarding-rehearsal-v1.test.mjs"
  ));
}

export async function verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1() {
  const governance = validateControlledRehearsalGovernance(readJson(governancePath));
  const report = validateControlledRehearsalReport(readJson(reportPath));
  verifyCurrentOwnerFiles(governance);
  verifyWorkflowBoundary();
  verifyFictionalDefinition();
  verifyNoSecretMaterial();
  verifyPackageWiring();
  await verifyRuntimeEvidence();
  const infrastructure = verifyControlledPaidCustomerOnboardingRehearsalV1();
  assert.equal(infrastructure.status,
    "CONTROLLED_REHEARSAL_INFRASTRUCTURE_VERIFICATION_PASSED");
  assert.equal(git(["merge-base", "--is-ancestor",
    "2c094403709415004c07269ea9bbd6e8c950bb68", "HEAD"]), "");
  return Object.freeze({
    status: "CONTROLLED_PAID_CUSTOMER_ONBOARDING_REHEARSAL_OVERWATCH_PASS",
    ownerCommitCount: expectedCommits.length,
    fictionalCompanyCount: 1,
    locationCount: 2,
    representativeCount: 2,
    privateWorkerBaseline: governance.acceptedBaseline.privateWorker,
    publicWorkerBaseline: governance.acceptedBaseline.publicWorker,
    protectedState: governance.protectedState,
    externalAction: report.externalAction
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1();
    process.stdout.write(
      "CONTROLLED_PAID_CUSTOMER_ONBOARDING_REHEARSAL_OVERWATCH_PASS\n"
    );
  } catch {
    process.stdout.write(
      "CONTROLLED_PAID_CUSTOMER_ONBOARDING_REHEARSAL_OVERWATCH_FAIL\n"
    );
    process.exitCode = 1;
  }
}
