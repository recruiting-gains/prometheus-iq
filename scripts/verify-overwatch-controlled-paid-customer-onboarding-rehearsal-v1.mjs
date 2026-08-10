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
import {
  hasFieldSessionReportTypeInfrastructureSuccessor,
  hasLiveCanonicalIdentityOwnerEvidenceSuccessor,
  hasRetentionDeletionPayloadInfrastructureSuccessor,
  hasRetentionDeletionPayloadQualificationInfrastructureSuccessor,
  evaluatePrivateWorkflowV2RetentionDeletionIntelligenceSuccessors
} from "./verify-overwatch-github-actions-private-worker-deployment.mjs";

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

export const controlledRehearsalIntelligenceSuccessor = Object.freeze({
  commit: "c025fd95a8f5141dc4c32af3ca83292711fb1df7",
  parent: "bc21696a653661ac0b90cd58e3f1744ade10ba70",
  tree: "06e35bc660be3b07da373c4242e1f1724002ec24",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: accept revenue readiness provenance successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-paid-customer-revenue-readiness-worker-v1.json",
      sha256: "3f21d2b71b85510671a7d76c9043d4ff31421c0cfcc9ff937a16915a5c38b07a"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "705925ee8a523725a195a116b62febc49bc97184b0ad6eeace34df901fca0da0"
    }),
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "9e3d7e6a9ac089d56b7b761758547dca82fac166412bbb74e9f75ba2e257c72f"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "6f69166053117abe4c26a02c26f6492b6bea2649f07565083eb474f094153f53"
    })
  ])
});

export const fullSystemHarmonyIntelligenceSuccessor = Object.freeze({
  commit: "2f8992476ca37276b0ee388fe2e33a2158f9d906",
  parent: "9c841ae7833ca51e2dc7a81243ed9fd34f5dcfdc",
  tree: "09e61f884b11a1fa66e772fdba1e320f843af8c0",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: adopt full-system harmony successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-full-system-harmony-v1.json",
      sha256: "a7c9965e96c71c105276904d57ca2cf7264f47462ba9629429510e1ab7817446"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "dbf40b94b7a28aa6ec1a20b7a6148014f72f2057af005e23f4bef2c0c31adb34"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "f0e1795811b098067c5ac8245a040e3790cb7710492f2975fabeb4c0dd4b34e2"
    })
  ])
});

export const liveCanonicalIdentityIntelligenceSuccessor = Object.freeze({
  commit: "56f67124c1beba2f9289538d65e782cd808eacb2",
  parent: "dc0f6f96d9208a1041c60f609d1b5dabb294e956",
  tree: "841aaee1f02c3aa09dde1dc333c2db68cf296f9f",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: adopt canonical identity protected successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-live-canonical-identity-v1.json",
      sha256: "cfb89774373db0928ad5e360ec642a4e49eef3d2d68583aecdab71f61114e562"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "5ee03775a417d214e075881815ef9886520bf9e083c2c912ff6d7a2a85617ea5"
    }),
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "9a7c35d96a326364e023c26fcd8eb1f9ef19be8e8074dcb81862c8cc05fabe66"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "8cd7c6caa9e5557cb50a36d1edd609cf83ce0962cf89651c8ed64e469e0bf944"
    })
  ])
});

export const fieldSessionReportTypeContractIntelligenceSuccessor = Object.freeze({
  commit: "d9aae1a1da5779f3a59bc5e955a851fef4f5fe18",
  parent: "bbed83c62e6c8d2c73ce287161df282005f99187",
  tree: "38ce2be37f66f49202967a285a003755ebc21dcc",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose field-session report contract repair",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-field-session-report-type-contract-v1.json",
      sha256: "77c88bc9a18d852c4b937303918be47a17b2423eba46c142cf5d2d4e9d5a0198"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "9ecd9ca37e8d42209aaf7b53cb0bcae06f431bee29059a81fd5b1333863118c1"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "04014936bb2bebbb1b17c22048449b325e8667c8809f9ba382e7532ee6a4ff4b"
    })
  ])
});

export const fieldSessionReportTypeDriftFixtureSuccessor = Object.freeze({
  commit: "655224332c65ec28d5c45b1accd2eae3d12555c2",
  parent: "d9aae1a1da5779f3a59bc5e955a851fef4f5fe18",
  tree: "5eeb4224f913faafcd3114e713092a8d6e668ec0",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: bind drift rejection to report successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "0fe879e56ff462e8b18b0fcee0515d082edbdfb16b1ae90fc3137a48d85fa41d"
    })
  ])
});

export const fullSystemHarmonyShadowReadinessSuccessor = Object.freeze({
  commit: "029ef1254aa41b6ba129424e9b3deaf3afe6a2f8",
  parent: "0e312cbef36af838dd9f8ba434f2370605f384d4",
  tree: "6658d930458909a4ba627f39c4f49d3f18c1de9f",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose harmony scoring successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/verify-shadow-decision-readiness.mjs",
      sha256: "856b7f43150cc4eba0a9fee6d2df2f4254f32026dd64d92829cd4df74f17e364"
    })
  ])
});

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

export function validateControlledRehearsalIntelligenceSuccessor(record) {
  assert.deepEqual(record, controlledRehearsalIntelligenceSuccessor,
    "controlled rehearsal Intelligence successor drifted");
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "controlled rehearsal Intelligence successor provenance drifted");
  const changedPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(changedPaths, record.evidence.map(item => item.path));
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `controlled rehearsal Intelligence successor evidence drifted: ${item.path}`);
  }
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
}

export function validateFullSystemHarmonyIntelligenceSuccessor(record) {
  assert.deepEqual(record, fullSystemHarmonyIntelligenceSuccessor,
    "Full-System Harmony Intelligence successor drifted");
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Full-System Harmony Intelligence successor provenance drifted");
  const changedPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(changedPaths, record.evidence.map(item => item.path));
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Full-System Harmony Intelligence successor evidence drifted: ${item.path}`);
  }
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
}

export function validateLiveCanonicalIdentityIntelligenceSuccessor(record) {
  assert.deepEqual(record, liveCanonicalIdentityIntelligenceSuccessor,
    "live canonical identity Intelligence successor drifted");
  verifyOwnerCommit(record, liveCanonicalIdentityIntelligenceSuccessor);
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
}

export function validateFieldSessionReportTypeContractIntelligenceSuccessor(record) {
  assert.deepEqual(record, fieldSessionReportTypeContractIntelligenceSuccessor,
    "field-session report-type Intelligence successor drifted");
  verifyOwnerCommit(record, fieldSessionReportTypeContractIntelligenceSuccessor);
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
}

export function validateFieldSessionReportTypeDriftFixtureSuccessor(record) {
  assert.deepEqual(record, fieldSessionReportTypeDriftFixtureSuccessor,
    "field-session report-type drift fixture successor drifted");
  verifyOwnerCommit(record, fieldSessionReportTypeDriftFixtureSuccessor);
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
}

export function validateFullSystemHarmonyShadowReadinessSuccessor(record) {
  assert.deepEqual(record, fullSystemHarmonyShadowReadinessSuccessor,
    "Full-System Harmony shadow-readiness successor drifted");
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n");
  assert.deepEqual(metadata, [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Full-System Harmony shadow-readiness successor provenance drifted");
  const changedPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", record.commit
  ]).split("\n").filter(Boolean);
  assert.deepEqual(changedPaths, record.evidence.map(item => item.path));
  for (const item of record.evidence) {
    const bytes = execFileSync("/usr/bin/git", [
      "show", `${record.commit}:${item.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(sha256(bytes), item.sha256,
      `Full-System Harmony shadow-readiness evidence drifted: ${item.path}`);
  }
  assert.equal(git([
    "merge-base", "--is-ancestor", record.commit, "HEAD"
  ]), "");
  return record;
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
  const liveCanonicalIdentityGovernance = readJson(
    "overwatch/governance/live-canonical-identity-migration-v1.json"
  );
  const currentReadinessSuccessors = readJson(
    "overwatch/governance/route-iq-august-1-readiness-successors-v1.json"
  );
  const fieldSessionReportTypeGovernance = readJson(
    "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json"
  );
  const privateWorkflowGovernance = readJson(
    "overwatch/governance/github-actions-private-worker-deployment-v2.json"
  );
  const retentionDeletionGovernance = readJson(
    "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json"
  );
  const retentionMaintenanceConsumerSuccessor = readJson(
    "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json"
  );
  const retentionDeletionEvaluation =
    evaluatePrivateWorkflowV2RetentionDeletionIntelligenceSuccessors({
      governance: retentionDeletionGovernance
    });
  assert.equal(retentionDeletionEvaluation.ok, true,
    retentionDeletionEvaluation.failures.join("\n"));
  validateControlledRehearsalIntelligenceSuccessor(
    controlledRehearsalIntelligenceSuccessor
  );
  validateFullSystemHarmonyIntelligenceSuccessor(
    fullSystemHarmonyIntelligenceSuccessor
  );
  validateLiveCanonicalIdentityIntelligenceSuccessor(
    liveCanonicalIdentityIntelligenceSuccessor
  );
  validateFieldSessionReportTypeContractIntelligenceSuccessor(
    fieldSessionReportTypeContractIntelligenceSuccessor
  );
  const fieldSessionDriftFixtureSuccessor =
    validateFieldSessionReportTypeDriftFixtureSuccessor(
      fieldSessionReportTypeDriftFixtureSuccessor
    );
  const fieldSessionDriftFixtureEvidence = new Map(
    fieldSessionDriftFixtureSuccessor.evidence.map(item => [item.path, item])
  );
  validateFullSystemHarmonyShadowReadinessSuccessor(
    fullSystemHarmonyShadowReadinessSuccessor
  );
  const maintenanceCoherence =
    retentionMaintenanceConsumerSuccessor.coherenceSourceTransition;
  assert.equal(retentionMaintenanceConsumerSuccessor.batchId, "BATCH-20260809-002");
  assert.equal(retentionMaintenanceConsumerSuccessor.ownerSubsystem,
    "Prometheus Intelligence Engine");
  assert.equal(maintenanceCoherence.path,
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs");
  assert.equal(maintenanceCoherence.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(maintenanceCoherence.commit,
    "0faca7bb91b3e4ddbe7c1996ca84cc9247cd205a");
  assert.equal(maintenanceCoherence.previousSha256,
    "d03c0ffa8d42b671ad447038415ee4ae003514a163c3ffaf3b943f8d37bf5f14");
  assert.equal(maintenanceCoherence.currentSha256,
    "ce1ab3876750043b251cb6029d0c0709159a8ff9c58c4266411883e6f9542e2c");
  assert.equal(retentionMaintenanceConsumerSuccessor.composition.historicalPinsRewritten,
    false);
  const governedSuccessors = new Map([
    ["workers/prometheus-iq-worker.js", {
      commit: "4b81819c861ca7326b4749c06e69654eab8f3166",
      sha256: "95eeefa91c1d27f9a3dca1e60c377f8f860d0eb1125d6d915279f82187095051"
    }],
    ["scripts/lib/github-actions-private-worker-workflow-v2.mjs", {
      commit: "fd52da7db16993f79c2286f35089d0b06e114070",
      sha256: "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0"
    }],
    ["workers/infrastructure/github-actions-private-worker-deployment-v2.json", {
      commit: "fd52da7db16993f79c2286f35089d0b06e114070",
      sha256: "30810573fc0926c03a6bbc5337db4ce7030c419a4b08c64b219db7c3abeb371b"
    }],
    ["workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json", {
      commit: "4b81819c861ca7326b4749c06e69654eab8f3166",
      sha256: "0c38be17c0823b1e247f1781353bbce543d66deb46f775c7a905b4164cb6d951"
    }],
    ["intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs", {
      commit: maintenanceCoherence.commit,
      sha256: maintenanceCoherence.currentSha256
    }],
    ["tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs", {
      commit: "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0",
      sha256: "84f124dc1137926c86687ab61274392c16dae53dc11f723300c5982557fd4118"
    }],
    ["tests/read-only-field-session-learning.test.mjs", {
      commit: fieldSessionDriftFixtureSuccessor.commit,
      sha256: fieldSessionDriftFixtureEvidence.get(
        "tests/read-only-field-session-learning.test.mjs"
      ).sha256
    }],
    ["scripts/verify-shadow-decision-readiness.mjs", {
      commit: "f37a1e16a73d89c57fb988c53c472a570fdbc15f",
      sha256: "bda4488c6015751fe24ddd36dd5dec38a8106a0a2a061a56e3232785b325c911"
    }],
    ["tests/shadow-decision-readiness.test.mjs", {
      commit: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
      sha256: "90bf943f8296d8c7e5ab14e57b5a2f02801260ebf2968f5bbbd4ce8b42af9d88"
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
        } else if (hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
          governance: privateWorkflowGovernance,
          fieldSessionReportTypeGovernance,
          liveCanonicalIdentityGovernance,
          readinessSuccessors: currentReadinessSuccessors,
          path: item.path,
          previousSha256: successor?.sha256 ?? item.sha256,
          currentSha256: actual
        })) {
          assert.notEqual(actual, item.sha256,
            `retention-deletion qualification successor did not advance owner evidence: ${item.path}`);
        } else if (hasRetentionDeletionPayloadInfrastructureSuccessor({
          governance: privateWorkflowGovernance,
          fieldSessionReportTypeGovernance,
          liveCanonicalIdentityGovernance,
          readinessSuccessors: currentReadinessSuccessors,
          path: item.path,
          previousSha256: successor?.sha256 ?? item.sha256,
          currentSha256: actual
        })) {
          assert.notEqual(actual, item.sha256,
            `retention-deletion successor did not advance owner evidence: ${item.path}`);
        } else if (hasFieldSessionReportTypeInfrastructureSuccessor({
          governance: fieldSessionReportTypeGovernance,
          liveCanonicalIdentityGovernance,
          readinessSuccessors: currentReadinessSuccessors,
          path: item.path,
          previousSha256: successor?.sha256 ?? item.sha256,
          currentSha256: actual
        })) {
          assert.notEqual(actual, item.sha256,
            `field-session successor did not advance owner evidence: ${item.path}`);
        } else if (hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
          governance: liveCanonicalIdentityGovernance,
          readinessSuccessors: currentReadinessSuccessors,
          path: item.path,
          previousSha256: successor?.sha256 ?? item.sha256,
          currentSha256: actual
        })) {
          assert.notEqual(actual, item.sha256,
            `canonical successor did not advance owner evidence: ${item.path}`);
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
