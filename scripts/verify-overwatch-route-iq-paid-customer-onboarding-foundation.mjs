import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { hasGithubActionsNode24InfrastructureSuccessor } from
  "./verify-overwatch-github-actions-node24-pin-successor.mjs";

const rootUrl = new URL("../", import.meta.url);
const root = fileURLToPath(rootUrl);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

const ledgerPath =
  "overwatch/governance/route-iq-paid-customer-production-gate-ledger-v1.json";
const lineagePath =
  "overwatch/governance/route-iq-private-worker-lineage-reconciliation-v1.json";
const fixturesPath =
  "administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json";
const runtimePath =
  "workers/infrastructure/route-iq-paid-customer-onboarding-runtime-v1.json";
const privateWorkflowPath =
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json";
const liveIdentityGovernancePath =
  "overwatch/governance/live-canonical-identity-migration-v1.json";
const toolchainGovernancePath =
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json";
const node24ActionPinGovernancePath =
  "overwatch/governance/github-actions-official-node24-pin-successor-v1.json";
const node24ActionPinInfrastructurePath =
  "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json";
const gymPreviewGovernancePath =
  "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json";
const activeToolchainOwnerCommit = "d55a983134be40bf10777df293ca593e7583f138";
const activeToolchainOwnerTree = "fcc850958e92d1f75eece476d6047b58972249d0";
const activeToolchainOwnerParent = "3d646bffde28b1ef995ae03af5976a6db1105430";
const activeToolchainPublicPath =
  "workers/infrastructure/github-actions-public-worker-deployment-v2.json";

const expectedGateIds = Object.freeze([
  "private_dashboard_production",
  "paid_customer_intake_contract",
  "tenant_isolation",
  "workspace_provisioning",
  "industry_terminology",
  "customer_metrics",
  "territory_authorization",
  "verified_business_acquisition",
  "eligibility_and_freshness",
  "dashboard_configuration",
  "representative_invitation_and_roles",
  "crm_workflows",
  "website_secure_intake",
  "billing_readiness",
  "monitoring_and_incident_ownership",
  "suspension_and_offboarding",
  "end_to_end_paid_customer_acceptance"
]);

const expectedLineage = Object.freeze([
  "43c614e8-ed24-413b-9901-27241e720094",
  "5a75f799-22cc-4e29-9a2f-29333defd6f2",
  "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
  "dbcbaabb-d599-49e0-bace-7413998572f0",
  "e303f3ca-8d2b-4248-85a5-eaad938219a9",
  "f3882be4-ddde-4156-a2b3-d84ac37d7637",
  "9ffb32d3-313a-4209-ad1d-0a6702ba8a83",
  "8b67798a-1cff-40df-b570-2b35ab0fc81c",
  "4147db04-2226-4cad-aa30-20453b35f42f",
  "16e40509-0173-4712-9138-0393a2ae1924"
]);

const ownerEmails = Object.freeze({
  "Prometheus Administration": "administration@prometheus.local",
  "Prometheus CRM": "crm@prometheus.local",
  "Prometheus Dashboard": "dashboard@prometheus.local",
  "Prometheus Data": "data@prometheus.local",
  "Prometheus Infrastructure": "infrastructure@prometheus.local",
  "Prometheus Intelligence": "intelligence@prometheus.local",
  "Prometheus Security": "security@prometheus.local"
});

const ownerPathRules = Object.freeze({
  "Prometheus Administration": [
    /^administration\//u,
    /^tests\/route-iq-paid-customer-administration-/u
  ],
  "Prometheus CRM": [
    /^crm\//u,
    /^tests\/route-iq-paid-customer-crm-/u
  ],
  "Prometheus Dashboard": [
    /^dashboard\//u,
    /^deploy\/cloudflare-pages\/dashboard\//u,
    /^deploy\/cloudflare-pages\/index\.html$/u,
    /^index\.html$/u,
    /^tests\/route-iq-paid-customer-dashboard-/u
  ],
  "Prometheus Data": [
    /^data\//u,
    /^tests\/route-iq-paid-customer-data/u
  ],
  "Prometheus Infrastructure": [
    /^_headers$/u,
    /^deploy\/cloudflare-pages\/_headers$/u,
    /^deploy\/cloudflare-pages\/index\.html$/u,
    /^index\.html$/u,
    /^scripts\/lib\/github-actions-private-worker-workflow-v2\.mjs$/u,
    /^scripts\/refresh-route-iq-private-dashboard-csp\.mjs$/u,
    /^scripts\/run-github-actions-private-worker-deployment-v2\.mjs$/u,
    /^scripts\/verify-dashboard-runtime-pool-consumption\.mjs$/u,
    /^scripts\/verify-github-actions-private-worker-workflow-v2\.mjs$/u,
    /^scripts\/verify-route-iq-private-paid-customer-production-browser-acceptance\.mjs$/u,
    /^tests\/route-iq-paid-customer-infrastructure/u,
    /^workers\//u
  ],
  "Prometheus Intelligence": [
    /^intelligence\//u,
    /^tests\/route-iq-paid-customer-intelligence/u
  ],
  "Prometheus Security": [
    /^security\//u,
    /^tests\/route-iq-paid-customer-security/u
  ]
});

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const sha256At = (commit, path) => createHash("sha256").update(execFileSync("git", [
  "show", `${commit}:${path}`
], { cwd: root, encoding: null })).digest("hex");

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} keys drifted`);
}

export function validatePaidCustomerProductionGateLedger(ledger) {
  assert.equal(ledger.governanceId, "route-iq-paid-customer-production-gate-ledger-v1");
  assert.equal(ledger.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(ledger.classification, "ACTIVE_PAID_CUSTOMER_PRODUCTION_READINESS_AUTHORITY");
  assert.equal(ledger.percentageReadinessAllowed, false);
  assert.equal(ledger.historicalEvidenceMutationAuthorized, false);
  assert.equal(ledger.evidenceRules.documentationAloneCanPassGate, false);
  assert.equal(ledger.evidenceRules.fixturesAloneCanPassGate, false);
  assert.equal(ledger.evidenceRules.hiddenFeatureFlagCanPassGate, false);
  assert.equal(ledger.evidenceRules.unexecutedWorkflowCanPassGate, false);
  assert.equal(ledger.evidenceRules.crossCompanyIsolationRequired, true);
  assert.equal(ledger.evidenceRules.exactArtifactDeploymentRequiredForProductionOperational, true);
  assert.equal(ledger.evidenceRules.automatedProductionAcceptanceRequiredForProductionOperational, true);

  assert.equal(ledger.releaseBaseline.sourceCommit,
    "404f8bf6a5aa04ab73ddfa658c0f084c3da916a6");
  assert.equal(ledger.releaseBaseline.sourceTree,
    "acc32e95c2bfd46e4b51e8058efd288e07d80cf1");
  assert.equal(ledger.releaseBaseline.privateWorker,
    "16e40509-0173-4712-9138-0393a2ae1924");
  assert.equal(ledger.releaseBaseline.publicWorker,
    "6a8713c0-0712-4cda-8a13-daa893ca45f2");
  assert.equal(ledger.releaseBaseline.publicWorkerMutationAuthorized, false);

  const ids = ledger.gates.map(gate => gate.gateId);
  assert.deepEqual(ids, expectedGateIds);
  assert.equal(new Set(ids).size, expectedGateIds.length);
  const statuses = new Set(ledger.statusVocabulary);
  for (const gate of ledger.gates) {
    assert.ok(statuses.has(gate.status), `Unknown gate status for ${gate.gateId}`);
    assert.ok(typeof gate.evidence === "string" && gate.evidence.length >= 40);
  }
  const status = Object.fromEntries(ledger.gates.map(gate => [gate.gateId, gate.status]));
  assert.equal(status.verified_business_acquisition, "NOT_READY");
  assert.equal(status.representative_invitation_and_roles, "NOT_READY");
  assert.equal(status.billing_readiness, "NOT_READY");
  assert.equal(status.monitoring_and_incident_ownership, "NOT_READY");
  assert.equal(status.end_to_end_paid_customer_acceptance, "SEPARATELY_GATED");

  assert.deepEqual(ledger.protectedOperatingState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    customerActivation: "OFF",
    anthonyMapping: "UNMAPPED",
    businessPools: {
      active: 0,
      reserve: 0,
      quarantine: 398
    },
    crmReceipt: "riq_receipt_e74e57903a211291a9f1f37a",
    crmReceiptMutationAuthorized: false
  });

  const serialized = JSON.stringify(ledger);
  assert.doesNotMatch(serialized, /readinessPercent|readinessPercentage|percentageComplete/u);
  return ledger;
}

export function validatePrivateWorkerLineage(lineage) {
  assert.equal(lineage.governanceId, "route-iq-private-worker-lineage-reconciliation-v1");
  assert.equal(lineage.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(lineage.worker, "prometheus-iq");
  assert.deepEqual(lineage.lineage.map(entry => entry.version), expectedLineage);
  assert.equal(lineage.lineage.at(-1).trafficPercent, 100);
  assert.equal(lineage.reconciliation.finalDeploymentOldVersion,
    "4147db04-2226-4cad-aa30-20453b35f42f");
  assert.equal(lineage.reconciliation.finalDeploymentNewVersion,
    "16e40509-0173-4712-9138-0393a2ae1924");
  assert.equal(lineage.reconciliation.finalDeploymentRollbackOccurred, false);
  assert.equal(lineage.reconciliation.earlierCampaignRollbackOccurred, true);
  assert.equal(lineage.productionMutationPerformedByAudit, false);
  assert.match(lineage.reconciliation.meaningOf4147db04, /not an alias/u);
  return lineage;
}

function verifyOwnerCommits(ownerCommits) {
  assert.ok(ownerCommits.length >= 14);
  assert.equal(new Set(ownerCommits.map(entry => entry.commit)).size, ownerCommits.length);
  for (const entry of ownerCommits) {
    assert.equal(git(["merge-base", "--is-ancestor", entry.commit, "HEAD"]), "");
    const [authorName, authorEmail, committerName, committerEmail, subject] = git([
      "show",
      "-s",
      "--format=%an%n%ae%n%cn%n%ce%n%s",
      entry.commit
    ]).split("\n");
    assert.equal(authorName, entry.subsystem);
    assert.equal(authorEmail, ownerEmails[entry.subsystem]);
    assert.equal(committerName, entry.subsystem);
    assert.equal(committerEmail, ownerEmails[entry.subsystem]);
    assert.equal(subject, entry.subject);
    const rules = ownerPathRules[entry.subsystem];
    assert.ok(rules);
    const paths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", entry.commit])
      .split("\n")
      .filter(Boolean);
    assert.ok(paths.length > 0);
    for (const path of paths) {
      assert.ok(rules.some(rule => rule.test(path)),
        `${entry.subsystem} commit ${entry.commit} crossed ownership at ${path}`);
    }
  }
}

const paidCustomerPublicPaths = Object.freeze([
  ".github/workflows/deploy-prometheus-public-worker.yml",
  ".github/workflows/qualify-prometheus-public-worker.yml",
  "deploy/prometheusrouteiq-website",
  "src",
  "workers/infrastructure/github-actions-public-worker-deployment-v2.json",
  "workers/infrastructure/prometheusrouteiq-website-entry.mjs",
  "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
]);

export function validateGovernedPublicLaneSuccessor({
  governance,
  baselineCommit,
  changedPaths,
  supersededPaths = []
}) {
  assert.equal(governance.governanceId, "live-canonical-identity-migration-v1");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  const reconciliation = governance.historicalVerifierReconciliations
    ?.paidCustomerOnboardingFoundation;
  assert.ok(reconciliation);
  assert.equal(reconciliation.classification, "GOVERNED_PUBLIC_IDENTITY_SUCCESSOR");
  assert.equal(reconciliation.authorizedMigration, governance.governanceId);
  assert.equal(reconciliation.baselineCommit, baselineCommit);
  assert.equal(reconciliation.publicWorkflowChanged, false);
  assert.equal(reconciliation.routesBindingsAndSchemaUnchanged, true);
  assert.deepEqual(reconciliation.ownerCommits, [
    "aa0c50ade9b66fd579c3609107a02e4c70de4179",
    "c4cb9150fb8ad218e34026a63fa577271860c270",
    "e225b9e6380416cceddbfe10ee7aa318b123e75c"
  ]);
  assert.deepEqual(
    [...changedPaths, ...supersededPaths].sort(),
    [...reconciliation.changedPaths].sort()
  );
  assert.equal(new Set([...changedPaths, ...supersededPaths]).size,
    reconciliation.changedPaths.length);
  return reconciliation;
}

export function validateGymPreviewPublicLaneSuccessor({
  governance,
  changedPaths
}) {
  const successor = governance?.paidCustomerPublicLaneSuccessor;
  assert.equal(governance?.batchId, "BATCH-20260814-002");
  assert.equal(governance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor?.classification, "GYM_FIRST_PREVIEW_PUBLIC_LANE_SUCCESSOR");
  assert.equal(successor?.baselineCommit, governance.startingRepository.commit);
  assert.deepEqual(successor?.ownerCommits, [
    "c42576db4330e2ba42373df247e6a6c65172ff55",
    "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac"
  ]);
  assert.equal(governance.releaseIdentities.websiteCommit, successor.ownerCommits[0]);
  assert.deepEqual(changedPaths, successor.changedPaths);
  assert.deepEqual(successor.supersededHistoricalPaths, [
    "deploy/prometheusrouteiq-website/assets/IntelligenceScene-BLFmJFP3.js",
    "deploy/prometheusrouteiq-website/assets/landing-C2NZ4sqg.js"
  ]);
  assert.deepEqual(successor.historicalRenameChain, [
    {
      baselinePath: "deploy/prometheusrouteiq-website/assets/IntelligenceScene-C_J7bBXb.js",
      canonicalPath:
        "deploy/prometheusrouteiq-website/assets/IntelligenceScene-BLFmJFP3.js",
      previewPath:
        "deploy/prometheusrouteiq-website/assets/IntelligenceScene-B1-h6ijC.js"
    },
    {
      baselinePath: "deploy/prometheusrouteiq-website/assets/landing-DL0VmnXB.js",
      canonicalPath: "deploy/prometheusrouteiq-website/assets/landing-C2NZ4sqg.js",
      previewPath: "deploy/prometheusrouteiq-website/assets/landing-BeMJF6LH.js"
    }
  ]);
  assert.equal(successor.productionDeploymentAuthorized, false);
  assert.equal(successor.publicWorkflowChanged, false);
  assert.equal(successor.routesBindingsAndSchemaChanged, false);
  return successor;
}

export function validateActiveToolchainPublicLaneSuccessor({
  governance,
  additionalChangedPaths
}) {
  const successor = governance?.activeDeploymentPolicySuccessor;
  assert.equal(governance?.batchId, "BATCH-20260810-001");
  assert.equal(successor?.infrastructureCommit, activeToolchainOwnerCommit);
  assert.equal(successor?.infrastructureTree, activeToolchainOwnerTree);
  assert.equal(successor?.parent, activeToolchainOwnerParent);
  assert.equal(successor?.wranglerVersion, "4.120.1");
  assert.equal(successor?.historicalRecordsRewritten, false);
  assert.equal(successor?.publicWorkerTargetChanged, false);
  assert.equal(successor?.workflowChanged, false);
  assert.equal(successor?.deploymentPerformed, false);
  assert.equal(successor?.productionMutationCount, 0);
  assert.match(successor?.currentEvidence?.[activeToolchainPublicPath] ?? "",
    /^[0-9a-f]{64}$/u);
  assert.deepEqual(additionalChangedPaths, [activeToolchainPublicPath]);
  return successor;
}

export function validateNode24PublicLaneSuccessor({
  governance,
  infrastructure,
  additionalChangedPaths
}) {
  const expectedPaths = [
    ".github/workflows/deploy-prometheus-public-worker.yml",
    ".github/workflows/qualify-prometheus-public-worker.yml"
  ];
  assert.equal(governance?.batchId, "BATCH-20260810-002");
  assert.equal(governance?.ownerChain?.infrastructure?.commit,
    "8782ccb1ad918740473d39ba1b17d3cb443c9ad9");
  assert.equal(governance?.ownerChain?.infrastructure?.identity,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.equal(infrastructure?.owner, "Prometheus Infrastructure");
  assert.deepEqual([...additionalChangedPaths].sort(), expectedPaths);
  for (const path of expectedPaths) {
    const evidence = infrastructure.workflows.find(item => item.path === path);
    assert.ok(evidence);
    assert.equal(hasGithubActionsNode24InfrastructureSuccessor({
      governance,
      infrastructure,
      path,
      previousSha256: evidence.predecessorSha256,
      currentSha256: evidence.successorSha256
    }), true);
  }
  return governance.ownerChain.infrastructure;
}

function verifyPublicLaneCompatibility(baselineCommit) {
  const changedPaths = git([
    "diff",
    "--name-only",
    baselineCommit,
    "--",
    ...paidCustomerPublicPaths
  ]).split("\n").filter(Boolean);
  if (changedPaths.length === 0) return;

  const governance = readJson(liveIdentityGovernancePath);
  const toolchainGovernance = readJson(toolchainGovernancePath);
  const node24ActionPinGovernance = readJson(node24ActionPinGovernancePath);
  const node24ActionPinInfrastructure = readJson(node24ActionPinInfrastructurePath);
  const gymPreviewGovernance = readJson(gymPreviewGovernancePath);
  const node24Paths = node24ActionPinInfrastructure.workflows
    .map(item => item.path)
    .filter(path => paidCustomerPublicPaths.includes(path));
  const historicalChangedPaths = changedPaths.filter(path => (
    governance.historicalVerifierReconciliations.paidCustomerOnboardingFoundation
      .changedPaths.includes(path)
  ));
  const node24ChangedPaths = changedPaths.filter(path => node24Paths.includes(path));
  const activeToolchainChangedPaths = changedPaths.filter(path =>
    path === activeToolchainPublicPath);
  const gymPreviewChangedPaths = git([
    "diff",
    "--name-only",
    gymPreviewGovernance.startingRepository.commit,
    "HEAD",
    "--",
    ...paidCustomerPublicPaths
  ]).split("\n").filter(Boolean);
  const gymPreviewSuccessor = validateGymPreviewPublicLaneSuccessor({
    governance: gymPreviewGovernance,
    changedPaths: gymPreviewChangedPaths
  });
  const reconciliation = validateGovernedPublicLaneSuccessor({
    governance,
    baselineCommit,
    changedPaths: historicalChangedPaths,
    supersededPaths: gymPreviewSuccessor.supersededHistoricalPaths
  });
  const toolchainSuccessor = validateActiveToolchainPublicLaneSuccessor({
    governance: toolchainGovernance,
    additionalChangedPaths: activeToolchainChangedPaths
  });
  validateNode24PublicLaneSuccessor({
    governance: node24ActionPinGovernance,
    infrastructure: node24ActionPinInfrastructure,
    additionalChangedPaths: node24ChangedPaths
  });
  assert.equal(git([
    "merge-base",
    "--is-ancestor",
    governance.startingRepository.commit,
    "HEAD"
  ]), "");
  for (const commit of reconciliation.ownerCommits) {
    assert.equal(git(["merge-base", "--is-ancestor", commit, "HEAD"]), "");
  }
  for (const commit of gymPreviewSuccessor.ownerCommits) {
    assert.equal(git(["merge-base", "--is-ancestor", commit, "HEAD"]), "");
  }
  assert.deepEqual(git([
    "log",
    "--format=%H",
    `${baselineCommit}..HEAD`,
    "--",
    ...paidCustomerPublicPaths
  ]).split("\n").filter(Boolean), [
    "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac",
    "c42576db4330e2ba42373df247e6a6c65172ff55",
    "8782ccb1ad918740473d39ba1b17d3cb443c9ad9",
    activeToolchainOwnerCommit,
    "e225b9e6380416cceddbfe10ee7aa318b123e75c",
    "c4cb9150fb8ad218e34026a63fa577271860c270",
    "aa0c50ade9b66fd579c3609107a02e4c70de4179"
  ]);
  const historicalRenames = git([
    "diff",
    "--name-status",
    "--find-renames",
    baselineCommit,
    reconciliation.ownerCommits.at(-1),
    "--",
    "deploy/prometheusrouteiq-website/assets"
  ]).split("\n").filter(Boolean);
  const gymPreviewTransitions = git([
    "diff",
    "--name-status",
    "--find-renames",
    gymPreviewSuccessor.baselineCommit,
    "HEAD",
    "--",
    "deploy/prometheusrouteiq-website/assets"
  ]).split("\n").filter(Boolean);
  for (const rename of gymPreviewSuccessor.historicalRenameChain) {
    assert.ok(historicalRenames.some(line => {
      const [status, baselinePath, canonicalPath] = line.split("\t");
      return status.startsWith("R") && baselinePath === rename.baselinePath &&
        canonicalPath === rename.canonicalPath;
    }), `historical public asset rename is not governed: ${rename.baselinePath}`);
    const renamedInPreview = gymPreviewTransitions.some(line => {
      const [status, canonicalPath, previewPath] = line.split("\t");
      return status.startsWith("R") && canonicalPath === rename.canonicalPath &&
        previewPath === rename.previewPath;
    });
    const replacedInPreview =
      gymPreviewTransitions.includes(`D\t${rename.canonicalPath}`) &&
      gymPreviewTransitions.includes(`A\t${rename.previewPath}`);
    assert.ok(renamedInPreview || replacedInPreview,
      `gym preview asset transition is not governed: ${rename.canonicalPath}`);
    assert.ok(gymPreviewChangedPaths.includes(rename.previewPath));
  }
  assert.deepEqual(git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    activeToolchainOwnerCommit
  ]).split("\n"), [
    activeToolchainOwnerCommit,
    activeToolchainOwnerParent,
    activeToolchainOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: align active Wrangler deployment policies"
  ]);
  assert.deepEqual(git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", activeToolchainOwnerCommit
  ]).split("\n").filter(Boolean).sort(), Object.keys(toolchainSuccessor.currentEvidence).sort());
  assert.equal(sha256At(activeToolchainOwnerCommit, activeToolchainPublicPath),
    toolchainSuccessor.currentEvidence[activeToolchainPublicPath]);
  assert.equal(sha256At(activeToolchainOwnerParent, activeToolchainPublicPath),
    sha256At(baselineCommit, activeToolchainPublicPath));
  assert.deepEqual(git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    node24ActionPinGovernance.ownerChain.infrastructure.commit
  ]).split("\n"), [
    node24ActionPinGovernance.ownerChain.infrastructure.commit,
    node24ActionPinGovernance.ownerChain.infrastructure.parent,
    node24ActionPinGovernance.ownerChain.infrastructure.tree,
    node24ActionPinGovernance.ownerChain.infrastructure.identity,
    node24ActionPinGovernance.ownerChain.infrastructure.identity,
    node24ActionPinGovernance.ownerChain.infrastructure.subject
  ]);
  for (const path of node24ChangedPaths) {
    const evidence = node24ActionPinInfrastructure.workflows.find(item =>
      item.path === path);
    assert.equal(sha256At(node24ActionPinGovernance.startingRepository.commit, path),
      evidence.predecessorSha256);
    assert.equal(sha256At(node24ActionPinGovernance.ownerChain.infrastructure.commit, path),
      evidence.successorSha256);
    assert.equal(sha256(read(path)), evidence.successorSha256);
  }
}

function verifyPaidCustomerRuntimeBoundaries() {
  const fixtures = readJson(fixturesPath);
  const runtime = readJson(runtimePath);
  const privateWorkflow = readJson(privateWorkflowPath);

  assert.equal(fixtures.classification, "SYNTHETIC_NONCUSTOMER_CONFIGURATION_ONLY");
  assert.equal(fixtures.productionUseAuthorized, false);
  assert.equal(fixtures.configurations.length, 2);
  assert.equal(new Set(fixtures.configurations.map(config =>
    config.operatingProfile.industryTemplateId)).size, 2);
  for (const configuration of fixtures.configurations) {
    assert.equal(configuration.safety.customerActivation, "OFF");
    assert.equal(configuration.safety.collection, "OFF");
    assert.equal(configuration.safety.activeCohorts, 0);
    assert.equal(configuration.safety.recommendationInfluence, "OFF");
    assert.equal(configuration.safety.providerRefresh, "OFF");
    assert.equal(configuration.safety.scheduler, "OFF");
  }

  assert.equal(runtime.worker, "prometheus-iq");
  assert.equal(runtime.deliveryState, "AUTHENTICATED_NON_ACTIVATING_FOUNDATION");
  assert.equal(runtime.routes.dashboardPreviewMethod, "GET");
  assert.equal(runtime.authentication.callerSuppliedIdentityAccepted, false);
  assert.equal(runtime.authentication.displayNameAuthorizationAccepted, false);
  assert.equal(runtime.authentication.crossCompanyAccess, "DENIED_WITHOUT_ENUMERATION");
  assert.equal(runtime.authentication.crossWorkspaceAccess, "DENIED_WITHOUT_ENUMERATION");
  assert.equal(runtime.safety.customerActivation, "OFF");
  assert.equal(runtime.safety.collection, "OFF");
  assert.equal(runtime.safety.activeCohorts, 0);
  assert.equal(runtime.safety.recommendationInfluence, "OFF");
  assert.equal(runtime.safety.providerRefresh, "OFF");
  assert.equal(runtime.safety.scheduler, "OFF");

  assert.equal(privateWorkflow.target.privateWorker, "prometheus-iq");
  assert.equal(privateWorkflow.target.publicWorker, "prometheusrouteiq-website");
  assert.equal(privateWorkflow.runtimeBoundaries.publicWorkerDeploymentAllowed, false);
  assert.equal(privateWorkflow.runtimeBoundaries.crmMutationAllowed, false);
  assert.equal(privateWorkflow.runtimeBoundaries.productionDataMutationAllowed, false);
  assert.equal(privateWorkflow.runtimeBoundaries.prospectiveCollection, "OFF");
  assert.equal(privateWorkflow.runtimeBoundaries.activeCohortCount, 0);
  assert.equal(privateWorkflow.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(privateWorkflow.runtimeBoundaries.businessAvailabilityMode, "OFF");
  assert.equal(privateWorkflow.runtimeBoundaries.scheduler, "OFF");
  assert.equal(privateWorkflow.runtimeBoundaries.customerActivation, "OFF");
  assert.equal(privateWorkflow.runtimeBoundaries.anthonyMapped, false);

  const activePaidCustomerSources = [
    fixturesPath,
    "administration/contracts/route-iq-paid-customer-onboarding-v1.schema.json",
    "crm/paid-customer-workflow-contract-v1.json",
    "dashboard/route-iq-dashboard-platform.mjs",
    "intelligence/contracts/route-iq-paid-customer-intelligence-v1.json",
    "workers/infrastructure/route-iq-paid-customer-onboarding-runtime-v1.json"
  ].map(read).join("\n");
  assert.doesNotMatch(activePaidCustomerSources,
    /Fitness Connection|Anthony|beta tester|controlled beta|pilot tester/iu);
}

export function verifyOverwatchRouteIqPaidCustomerOnboardingFoundation() {
  const ledger = validatePaidCustomerProductionGateLedger(readJson(ledgerPath));
  const lineage = validatePrivateWorkerLineage(readJson(lineagePath));
  verifyOwnerCommits(ledger.ownerCommits);
  verifyPublicLaneCompatibility(ledger.releaseBaseline.sourceCommit);
  verifyPaidCustomerRuntimeBoundaries();

  const runtime = readJson(runtimePath);
  assertExactKeys(runtime.safety, [
    "activeCohorts",
    "collection",
    "customerActivation",
    "crmMutationPerformed",
    "providerRefresh",
    "productionMutationPerformed",
    "recommendationInfluence",
    "scheduler",
    "usersProvisioned"
  ], "paid-customer runtime safety");

  return Object.freeze({
    status: "PASS",
    batchId: ledger.batchId,
    ownerCommitCount: ledger.ownerCommits.length,
    gateCount: ledger.gates.length,
    syntheticCompanyCount: 2,
    privateWorkerBaseline: ledger.releaseBaseline.privateWorker,
    publicWorkerBaseline: ledger.releaseBaseline.publicWorker,
    finalBaselineRollbackOccurred: lineage.reconciliation.finalDeploymentRollbackOccurred,
    protectedOperatingState: ledger.protectedOperatingState
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(
    verifyOverwatchRouteIqPaidCustomerOnboardingFoundation(),
    null,
    2
  )}\n`);
}
