import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateAutomaticPushEligibility,
  verifyAutomaticCommitPushGovernance
} from "../scripts/verify-overwatch-auto-push-governance.mjs";

const gateFamilies = [
  "directive_acceptance",
  "security",
  "secret_scan",
  "aegis",
  "contracts",
  "workspace_isolation",
  "lint",
  "typecheck",
  "build",
  "diff_integrity",
  "index_integrity",
  "git_integrity",
  "ownership",
  "release"
];

const founderReviewTriggers = [
  "production_deployment",
  "recommendation_influence",
  "representative_facing_shadow_recommendations",
  "automated_business_actions",
  "new_or_materially_changed_representative_or_customer_behavior",
  "mandatory_workflow_changes",
  "new_pii_collection",
  "material_privacy_tracking_retention_permission_or_data_sharing_change",
  "new_subsystem_or_major_architecture",
  "new_production_event_architecture",
  "new_vendor_model_provider_external_service_or_material_recurring_cost",
  "destructive_migration_or_historical_archive_rewrite",
  "material_authentication_authorization_or_security_boundary_change",
  "public_release_or_external_publication",
  "material_legal_licensing_or_intellectual_property_commitment",
  "waived_failed_or_incomplete_verification_gate",
  "work_outside_authorized_directive"
];

function passingManifest() {
  const commit = "a".repeat(40);
  return {
    batchId: "BATCH-20260713-TEST",
    directive: {
      founderAuthorized: true,
      chiefArchitectDraftOnly: false
    },
    scope: {
      insideAuthorizedDirective: true,
      noUnrelatedWork: true
    },
    ownership: {
      everyCommitMapped: true,
      provenanceVerified: true
    },
    acceptanceCriteriaPassed: true,
    allTrackedChangesCommitted: true,
    candidate: {
      head: "b".repeat(40),
      tree: "c".repeat(40),
      expectedOriginMain: "d".repeat(40),
      frozen: true,
      completeApplicableSuitePassed: true
    },
    repository: {
      headMatchesCandidate: true,
      treeMatchesCandidate: true,
      headAndTreeUnchangedAfterVerification: true,
      workingTreeClean: true,
      indexClean: true,
      noUntrackedFiles: true,
      noConflicts: true,
      originMatchesExpectedBase: true,
      normalFastForward: true
    },
    gates: Object.fromEntries(gateFamilies.map(gate => [gate, "PASS"])),
    outgoingCommits: [
      {
        sha: commit,
        owner: "Prometheus Overwatch",
        files: ["overwatch/governance/example.json"],
        verified: true,
        safeForwardRevert: true,
        blocked: false,
        unrelated: false
      }
    ],
    rollback: {
      manifestComplete: true,
      everyCommitHasSafeForwardRevert: true,
      dataAndContractConsiderationsRecorded: true,
      reverseCommitOrder: [commit],
      isolatedExerciseRequired: true,
      isolatedExercisePassed: true,
      statefulMigrationPresent: false
    },
    productionSmoke: {
      required: false
    },
    externalActionAudit: {
      liveProviderCheckCompleted: true,
      deployment: false,
      migration: false,
      publication: false,
      externalMessaging: false,
      productionDataMutation: false,
      recommendationActivation: false,
      otherUnauthorizedAction: false
    },
    recommendationInfluence: {
      authorized: "OFF",
      actual: "OFF"
    },
    productReadiness: {
      state: "INSUFFICIENT_EVIDENCE",
      describedAsRecommendationReadiness: false
    },
    founderReviewTriggers: Object.fromEntries(founderReviewTriggers.map(trigger => [trigger, false]))
  };
}

test("Overwatch canonical automatic commit and push policy verifies", () => {
  assert.deepEqual(verifyAutomaticCommitPushGovernance(), {
    status: "PASS",
    policyId: "verified-engineering-batch-automatic-commit-push-governance-v1",
    installationBatchId: "BATCH-20260713-003",
    automaticPushRequirements: 14,
    founderReviewTriggers: 17,
    deploymentFounderGated: true,
    recommendationInfluenceActivationAuthorized: false
  });
});

test("autonomous predeployment closure persists across sessions without granting deployment authority", () => {
  const policy = JSON.parse(readFileSync(
    "overwatch/governance/verified-engineering-batch-auto-push-v1.json",
    "utf8"
  ));
  const closure = policy.autonomousPredeploymentClosure;

  assert.equal(closure.appliesAcrossOverwatchSessions, true);
  assert.equal(closure.intermediateHoldForFixableEngineeringFailureAllowed, false);
  assert.equal(closure.deploymentAuthorizationMayBeRequestedWhileCandidateChanges, false);
  assert.equal(closure.candidateMutationAfterFreezeAllowed, false);
  assert.equal(closure.sourceChangeInvalidatesFrozenCandidate, true);
  assert.equal(closure.unchangedCandidateSurvivesPreBoundaryExternalFailure, true);
  assert.equal(closure.deploymentWithoutExactFounderAuthorizationAllowed, false);
  assert.equal(closure.productionMutationDuringPredeploymentClosureAllowed, false);
  assert.equal(closure.secretValueAccessDuringNoSecretClosureAllowed, false);
  assert.equal(closure.founderReturnConditions.length, 5);
});

test("master engineering state preserves intake history while current CRM truth cannot regress", () => {
  const state = readFileSync("PROMETHEUS_MASTER_ENGINEERING_STATE.md", "utf8");
  const duplicateRegister = state.slice(state.indexOf("## Duplicate Prevention Register"));
  const nextTask = state.slice(state.lastIndexOf("## Next Recommended Engineering Task"));

  assert.match(state, /### 2026-07-02: Prometheus Website - Enterprise Lead Intake/u);
  assert.match(state, /### 2026-07-03: Prometheus Website - Lead Submission Trace/u);
  assert.match(state, /Historical record as of 2026-07-02\.[\s\S]*superseded/u);
  assert.match(state, /Historical record as of 2026-07-03\.[\s\S]*superseded/u);
  assert.match(state, /### 2026-08-07: Founder Notification Reconciliation \+ Master-State Supersession v1/u);
  assert.match(state, /`POST \/api\/partner-intake`/u);
  assert.match(state, /RouteIqRequestCrmCoordinator/u);
  assert.match(state, /notification result is terminally classified `failed`/u);
  assert.match(state, /missing external Cloudflare email-destination configuration/u);
  assert.match(state, /### 2026-08-07: Email Routing Domain Onboarding \+ Final Founder Delivery Acceptance v1/u);
  assert.match(state, /`riq_receipt_e74e57903a211291a9f1f37a` remains terminal `failed`/u);
  assert.match(state, /`riq_receipt_b06adcc8fb2a58449ecf52a3` remains terminal `delivery_ambiguous`/u);
  assert.match(state, /`riq_receipt_ba75a444905b0f6e78624b30`/u);
  assert.match(state, /final delivery classification is `delivered_inbox`/u);
  assert.match(state, /SPF `pass`, DKIM `pass`, and DMARC `not-reported`/u);
  assert.match(state, /No DMARC record, active routing rule, catch-all forwarding rule, paid Email Sending domain/u);
  assert.match(state, /Founder notification delivery is production-proven/u);

  assert.match(duplicateRegister, /Current production accepts validated `POST \/api\/partner-intake` requests into durable CRM storage/u);
  assert.match(duplicateRegister, /production-proven through the verified Cloudflare Email destination/u);
  assert.match(duplicateRegister, /preserve both earlier terminal failure records as immutable evidence/u);
  assert.doesNotMatch(duplicateRegister, /current production flow is browser-local `localStorage` plus `mailto:` only/u);
  assert.match(nextTask, /entity formation, EIN, banking, pricing, contracts, and Stripe Live eligibility/u);
  assert.match(nextTask, /Additional email-routing engineering is not the current constraint/u);
  assert.match(nextTask, /first-customer evidence/u);
  assert.doesNotMatch(nextTask, /Current active highest-priority task:\s+Operation Aegis Phase II/u);
});

test("A complete Founder-authorized batch is auto-push eligible", () => {
  assert.deepEqual(evaluateAutomaticPushEligibility(passingManifest()), {
    status: "AUTO_PUSH_ELIGIBLE",
    reviewTriggers: [],
    failures: []
  });
});

test("A material decision stops for Founder review", () => {
  const manifest = passingManifest();
  manifest.founderReviewTriggers.production_deployment = true;

  assert.deepEqual(evaluateAutomaticPushEligibility(manifest), {
    status: "FOUNDER_REVIEW_REQUIRED",
    reviewTriggers: ["production_deployment"],
    failures: []
  });
});

test("A failed release gate blocks push", () => {
  const manifest = passingManifest();
  manifest.gates.security = "FAIL";

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /gates\.security must be PASS/);
});

test("A possible automatic deployment blocks push", () => {
  const manifest = passingManifest();
  manifest.externalActionAudit.deployment = true;

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /externalActionAudit\.deployment must be false/);
});

test("Rollback order must exactly reverse the outgoing range", () => {
  const manifest = passingManifest();
  const secondCommit = "e".repeat(40);
  manifest.outgoingCommits.push({
    ...manifest.outgoingCommits[0],
    sha: secondCommit,
    files: ["overwatch/governance/second.json"]
  });
  manifest.rollback.reverseCommitOrder = manifest.outgoingCommits.map(commit => commit.sha);

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /must exactly reverse outgoingCommits/);
});

test("INSUFFICIENT_EVIDENCE cannot be described as recommendation readiness", () => {
  const manifest = passingManifest();
  manifest.productReadiness.describedAsRecommendationReadiness = true;

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /must not be described as recommendation readiness/);
});

test("A Chief Architect draft alone cannot authorize a push", () => {
  const manifest = passingManifest();
  manifest.directive.founderAuthorized = false;
  manifest.directive.chiefArchitectDraftOnly = true;

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /FounderAuthorized|Chief Architect draft/);
});

test("A passing batch with no outgoing commits requires no push", () => {
  const manifest = passingManifest();
  manifest.outgoingCommits = [];
  manifest.rollback.reverseCommitOrder = [];

  assert.deepEqual(evaluateAutomaticPushEligibility(manifest), {
    status: "BATCH_PASS_NO_PUSH_REQUIRED",
    reviewTriggers: [],
    failures: []
  });
});

test("A stateful migration requires a forward-compatible rollback candidate", () => {
  const manifest = passingManifest();
  manifest.rollback.statefulMigrationPresent = true;
  manifest.rollback.nativeProviderRollbackUsed = true;

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /forwardCompatibleDeploymentCandidateVerified/);
  assert.match(result.failures.join("\n"), /nativeProviderRollbackUsed must be false/);
});

test("A verified stateful forward rollback remains auto-push eligible", () => {
  const manifest = passingManifest();
  Object.assign(manifest.rollback, {
    statefulMigrationPresent: true,
    nativeProviderRollbackUsed: false,
    forwardCompatibleDeploymentCandidateVerified: true,
    appliedMigrationHistoryPreserved: true,
    classExportsBindingsAndProtectedSecretReferencesPreserved: true,
    statefulNamespacePreserved: true,
    deletedClassMigrationAbsent: true
  });

  assert.equal(evaluateAutomaticPushEligibility(manifest).status, "AUTO_PUSH_ELIGIBLE");
});

test("Production smoke requires exact pre-navigation viewport and zero writes", () => {
  const manifest = passingManifest();
  manifest.productionSmoke = {
    required: true,
    newBrowserContext: true,
    authenticated: true,
    readOnlyGuardInstalledBeforeNavigation: true,
    viewportConfiguredBeforeNavigation: true,
    viewportConfirmedBeforeNavigation: true,
    defaultDenyWriteGuard: true,
    serviceWorkersBlocked: true,
    formSubmissionsBlocked: true,
    downloadsBlocked: true,
    popupsBlocked: true,
    dialogsBlocked: true,
    beforeAfterCountsCaptured: true,
    beforeAfterCountsMatch: false,
    expectedViewport: { width: 390, height: 844 },
    actualViewport: { width: 391, height: 844 },
    attemptedWrites: 1,
    dialogsObserved: 0,
    applicationDataChanges: 1
  };

  const result = evaluateAutomaticPushEligibility(manifest);
  assert.equal(result.status, "PUSH_BLOCKED");
  assert.match(result.failures.join("\n"), /beforeAfterCountsMatch/);
  assert.match(result.failures.join("\n"), /viewport must exactly match/);
  assert.match(result.failures.join("\n"), /attemptedWrites must be 0/);
  assert.match(result.failures.join("\n"), /applicationDataChanges must be 0/);
});

test("A read-only exact-viewport production smoke can pass", () => {
  const manifest = passingManifest();
  manifest.productionSmoke = {
    required: true,
    newBrowserContext: true,
    authenticated: true,
    readOnlyGuardInstalledBeforeNavigation: true,
    viewportConfiguredBeforeNavigation: true,
    viewportConfirmedBeforeNavigation: true,
    defaultDenyWriteGuard: true,
    serviceWorkersBlocked: true,
    formSubmissionsBlocked: true,
    downloadsBlocked: true,
    popupsBlocked: true,
    dialogsBlocked: true,
    beforeAfterCountsCaptured: true,
    beforeAfterCountsMatch: true,
    expectedViewport: { width: 390, height: 844 },
    actualViewport: { width: 390, height: 844 },
    attemptedWrites: 0,
    dialogsObserved: 0,
    applicationDataChanges: 0
  };

  assert.equal(evaluateAutomaticPushEligibility(manifest).status, "AUTO_PUSH_ELIGIBLE");
});
