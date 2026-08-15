import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  controlledRehearsalNode24InfrastructureSuccessor,
  controlledRehearsalIntelligenceSuccessor,
  fieldSessionReportTypeContractIntelligenceSuccessor,
  fieldSessionReportTypeDriftFixtureSuccessor,
  fullSystemHarmonyIntelligenceSuccessor,
  fullSystemHarmonyShadowReadinessSuccessor,
  liveCanonicalIdentityIntelligenceSuccessor,
  validateControlledRehearsalIntelligenceSuccessor,
  validateControlledRehearsalNode24InfrastructureSuccessor,
  validateControlledRehearsalRuntimeGuardToolchainSuccessor,
  validateFieldSessionReportTypeContractIntelligenceSuccessor,
  validateFieldSessionReportTypeDriftFixtureSuccessor,
  validateFullSystemHarmonyIntelligenceSuccessor,
  validateFullSystemHarmonyShadowReadinessSuccessor,
  resolveGovernedLearningOwnerSuccessor,
  resolveGymPreviewRouteQualityOwnerSuccessor,
  resolveProspectiveCalibrationOwnerSuccessor,
  validateLiveCanonicalIdentityIntelligenceSuccessor,
  validateControlledRehearsalGovernance,
  validateControlledRehearsalReport,
  verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1
} from "../scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  hasGovernedLearningPayloadInfrastructureSuccessor,
  hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor,
  hasRetentionDeletionPayloadInfrastructureSuccessor,
  hasRetentionDeletionPayloadQualificationInfrastructureSuccessor,
  hasRetentionMaintenancePayloadInfrastructureSuccessor
} from "../scripts/verify-overwatch-github-actions-private-worker-deployment.mjs";
import {
  hasGithubActionsNode24InfrastructureSuccessor
} from "../scripts/verify-overwatch-github-actions-node24-pin-successor.mjs";
import {
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyGovernedMultiSessionLearningAdvisorySuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const root = new URL("../", import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const governance = readJson(
  "overwatch/governance/controlled-paid-customer-onboarding-rehearsal-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260730-002-controlled-paid-customer-onboarding-rehearsal-v1.json"
);
const privateWorkflowGovernance = readJson(
  "overwatch/governance/github-actions-private-worker-deployment-v2.json"
);
const fieldSessionReportTypeGovernance = readJson(
  "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json"
);
const liveCanonicalIdentityGovernance = readJson(
  "overwatch/governance/live-canonical-identity-migration-v1.json"
);
const currentReadinessSuccessors = readJson(
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json"
);
const toolchainGovernance = readJson(
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json"
);
const node24ActionPinGovernance = readJson(
  "overwatch/governance/github-actions-official-node24-pin-successor-v1.json"
);
const node24ActionPinInfrastructure = readJson(
  "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json"
);
const clone = value => structuredClone(value);

test("Overwatch composes the exact governed-learning owner successors", () => {
  const successor = verifyGovernedMultiSessionLearningAdvisorySuccessor();
  assert.deepEqual(resolveGovernedLearningOwnerSuccessor({
    successor,
    path: "workers/prometheus-iq-worker.js",
    previousSha256:
      "95eeefa91c1d27f9a3dca1e60c377f8f860d0eb1125d6d915279f82187095051"
  }), {
    commit: "267225d51e32acc6f50ce932a945e2749783734e",
    sha256: "b5a5d26229d6d0808bb41a08fd2b252021df1d5cdfa9e44cda539819fc728b9a"
  });
  assert.deepEqual(resolveGovernedLearningOwnerSuccessor({
    successor,
    path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    previousSha256:
      "ce1ab3876750043b251cb6029d0c0709159a8ff9c58c4266411883e6f9542e2c"
  }), {
    commit: "f1b889bb45e357a757656d992e91d95580cc8880",
    sha256: "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0"
  });
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => { value.transitionsByPath.delete("workers/prometheus-iq-worker.js"); },
    value => {
      value.transitionsByPath.get("workers/prometheus-iq-worker.js")[0]
        .previousSha256 = "0".repeat(64);
    }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() => resolveGovernedLearningOwnerSuccessor({
      successor: candidate,
      path: "workers/prometheus-iq-worker.js",
      previousSha256:
        "95eeefa91c1d27f9a3dca1e60c377f8f860d0eb1125d6d915279f82187095051"
    }));
  }
});

test("Overwatch composes only the exact prospective-calibration owner successors", () => {
  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .prospectiveCalibrationProductionAdmissionSuccessor;
  assert.deepEqual(resolveProspectiveCalibrationOwnerSuccessor({
    successor,
    path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    previousSha256:
      "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0"
  }), {
    commit: "a32d404005d2f469512048e94dde929b2c33dff9",
    sha256: "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2"
  });
  assert.deepEqual(resolveProspectiveCalibrationOwnerSuccessor({
    successor,
    path: "scripts/verify-shadow-decision-readiness.mjs",
    previousSha256:
      "bda4488c6015751fe24ddd36dd5dec38a8106a0a2a061a56e3232785b325c911"
  }), {
    commit: "7df9e1732d1e5fb910d418a10c99ab2f9a8c3bbe",
    sha256: "f34aeb1606159be45dc97c55da021b3a549eccf2df21d95ccd3b689b00141bb6"
  });
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => {
      value.transitionsByPath.delete(
        "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
      );
    },
    value => {
      value.transitionsByPath.get(
        "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
      )[0].previousSha256 = "0".repeat(64);
    }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() => resolveProspectiveCalibrationOwnerSuccessor({
      successor: candidate,
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      previousSha256:
        "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0"
    }));
  }
});

test("Overwatch composes only the exact gym-preview route-quality successor", () => {
  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .gymPreviewRouteQualityRuntimeSurfaceSuccessor;
  assert.deepEqual(resolveGymPreviewRouteQualityOwnerSuccessor({
    successor,
    path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    previousSha256:
      "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2"
  }), {
    commit: "d322a443f12db73171ebffd76a87ae96e46f37ec",
    sha256: "15ae949ef9d136ca7f4b3444a9f2f5db0241cfa4092d811e891564dc4afb2e16"
  });
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => {
      value.transitionsByPath.delete(
        "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
      );
    },
    value => {
      value.transitionsByPath.get(
        "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
      )[0].previousSha256 = "0".repeat(64);
    }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() => resolveGymPreviewRouteQualityOwnerSuccessor({
      successor: candidate,
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      previousSha256:
        "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2"
    }));
  }
});

test("Overwatch accepts only the exact Intelligence revenue-readiness successor", () => {
  assert.equal(
    validateControlledRehearsalIntelligenceSuccessor(
      controlledRehearsalIntelligenceSuccessor
    ).commit,
    "c025fd95a8f5141dc4c32af3ca83292711fb1df7"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(controlledRehearsalIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact Full-System Harmony Intelligence successor", () => {
  assert.equal(
    validateFullSystemHarmonyIntelligenceSuccessor(
      fullSystemHarmonyIntelligenceSuccessor
    ).commit,
    "2f8992476ca37276b0ee388fe2e33a2158f9d906"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute harmony successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(fullSystemHarmonyIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() => validateFullSystemHarmonyIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact live canonical identity Intelligence successor", () => {
  assert.equal(
    validateLiveCanonicalIdentityIntelligenceSuccessor(
      liveCanonicalIdentityIntelligenceSuccessor
    ).commit,
    "56f67124c1beba2f9289538d65e782cd808eacb2"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute canonical successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(liveCanonicalIdentityIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() =>
      validateLiveCanonicalIdentityIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact harmony shadow-readiness successor", () => {
  assert.equal(
    validateFullSystemHarmonyShadowReadinessSuccessor(
      fullSystemHarmonyShadowReadinessSuccessor
    ).commit,
    "029ef1254aa41b6ba129424e9b3deaf3afe6a2f8"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute shadow successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(fullSystemHarmonyShadowReadinessSuccessor);
    mutate(candidate);
    assert.throws(() =>
      validateFullSystemHarmonyShadowReadinessSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact field-session report-type successors", () => {
  assert.equal(
    validateFieldSessionReportTypeContractIntelligenceSuccessor(
      fieldSessionReportTypeContractIntelligenceSuccessor
    ).commit,
    "d9aae1a1da5779f3a59bc5e955a851fef4f5fe18"
  );
  assert.equal(
    validateFieldSessionReportTypeDriftFixtureSuccessor(
      fieldSessionReportTypeDriftFixtureSuccessor
    ).commit,
    "655224332c65ec28d5c45b1accd2eae3d12555c2"
  );
  for (const [source, validate] of [
    [fieldSessionReportTypeContractIntelligenceSuccessor,
      validateFieldSessionReportTypeContractIntelligenceSuccessor],
    [fieldSessionReportTypeDriftFixtureSuccessor,
      validateFieldSessionReportTypeDriftFixtureSuccessor]
  ]) {
    for (const mutate of [
      value => { value.commit = "0".repeat(40); },
      value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
      value => { value.evidence[0].path = "package.json"; },
      value => { value.evidence[0].sha256 = "0".repeat(64); },
      value => { value.evidence.pop(); }
    ]) {
      const candidate = clone(source);
      mutate(candidate);
      assert.throws(() => validate(candidate));
    }
  }
});

test("Overwatch composes the exact retention deletion and maintenance payload successors", () => {
  for (const [path, previousSha256] of Object.entries({
    "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
      "30810573fc0926c03a6bbc5337db4ce7030c419a4b08c64b219db7c3abeb371b"
  })) {
    const historicalSuccessorSha256 = privateWorkflowGovernance
      .retentionDeletionPayloadSuccessor.evidence
      .find(item => item.path === path).successorSha256;
    assert.equal(hasRetentionDeletionPayloadInfrastructureSuccessor({
      governance: privateWorkflowGovernance,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: historicalSuccessorSha256
    }), true);
    const qualificationSuccessorSha256 = privateWorkflowGovernance
      .retentionMaintenancePayloadSuccessor.evidence
      .find(item => item.path === path).previousSha256;
    assert.equal(hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
      governance: privateWorkflowGovernance,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: qualificationSuccessorSha256
    }), true);
    assert.equal(hasRetentionMaintenancePayloadInfrastructureSuccessor({
      governance: privateWorkflowGovernance,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: privateWorkflowGovernance.governedLearningPayloadSuccessor
        .evidence.find(item => item.path === path).previousSha256
    }), true);
    assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
      governance: privateWorkflowGovernance,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: privateWorkflowGovernance.outcomeSemanticIntegrityPayloadSuccessor
        .evidence.find(item => item.path === path).previousSha256
    }), true);
    assert.equal(hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
      governance: privateWorkflowGovernance,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: createHash("sha256")
        .update(readFileSync(new URL(path, root))).digest("hex")
    }), true);
  }
  const changed = clone(privateWorkflowGovernance);
  changed.retentionDeletionPayloadQualificationSuccessor.evidence[0].successorSha256 =
    "0".repeat(64);
  assert.equal(hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
    governance: changed,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: createHash("sha256").update(readFileSync(new URL(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs", root
    ))).digest("hex")
  }), false);
  assert.equal(hasRetentionMaintenancePayloadInfrastructureSuccessor({
    governance: changed,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: privateWorkflowGovernance.governedLearningPayloadSuccessor
      .evidence[0].previousSha256
  }), false);
  assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
    governance: changed,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: createHash("sha256").update(readFileSync(new URL(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs", root
    ))).digest("hex")
  }), false);
  assert.equal(hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
    governance: changed,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: createHash("sha256").update(readFileSync(new URL(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs", root
    ))).digest("hex")
  }), false);
});

test("Overwatch composes only the exact Infrastructure runtime-guard toolchain successor", () => {
  const input = {
    governance: toolchainGovernance,
    path: "scripts/verify-cloudflare-unattended-runtime-guard.mjs",
    previousSha256:
      "40abe1f2947706ad510a7468018b950fd32ee874a9bad58a3acc8bd70543ddc7",
    currentSha256:
      "1125d91b4a624ece8e594ecf4e8d2d0bb8a7aa8765a22b8b2806e05cbcafcf49"
  };
  assert.equal(
    validateControlledRehearsalRuntimeGuardToolchainSuccessor(input).commit,
    "d55a983134be40bf10777df293ca593e7583f138"
  );
  for (const mutate of [
    value => { value.governance.activeDeploymentPolicySuccessor.infrastructureCommit = "0".repeat(40); },
    value => { value.governance.activeDeploymentPolicySuccessor.infrastructureTree = "0".repeat(40); },
    value => { value.governance.activeDeploymentPolicySuccessor.parent = "0".repeat(40); },
    value => { value.governance.activeDeploymentPolicySuccessor.currentEvidence[value.path] = "0".repeat(64); },
    value => { delete value.governance.activeDeploymentPolicySuccessor.currentEvidence[
      "docs/cloudflare-unattended-deployment-access-v1.md"
    ]; },
    value => { value.path = "scripts/verify-cloudflare-unattended-access-architecture.mjs"; },
    value => { value.previousSha256 = "0".repeat(64); },
    value => { value.currentSha256 = "0".repeat(64); }
  ]) {
    const candidate = clone(input);
    mutate(candidate);
    assert.throws(() =>
      validateControlledRehearsalRuntimeGuardToolchainSuccessor(candidate));
  }
});

test("Overwatch composes only the exact controlled-rehearsal Node 24 workflow successor", () => {
  const path = ".github/workflows/controlled-paid-customer-onboarding-rehearsal-v1.yml";
  const evidence = node24ActionPinInfrastructure.workflows.find(item => item.path === path);
  const input = {
    governance: node24ActionPinGovernance,
    infrastructure: node24ActionPinInfrastructure,
    path,
    previousSha256: evidence.predecessorSha256,
    currentSha256: evidence.successorSha256
  };
  assert.equal(hasGithubActionsNode24InfrastructureSuccessor(input), true);
  for (const mutate of [
    value => { value.governance.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.governance.ownerChain.infrastructure.commit = "0".repeat(40); },
    value => { value.infrastructure.owner = "Prometheus Overwatch"; },
    value => { value.path = ".github/workflows/early-github-handoff-v1.yml"; },
    value => { value.previousSha256 = "0".repeat(64); },
    value => { value.currentSha256 = "0".repeat(64); }
  ]) {
    const candidate = clone(input);
    mutate(candidate);
    assert.equal(hasGithubActionsNode24InfrastructureSuccessor(candidate), false);
  }
});

test("Overwatch accepts only the exact controlled-rehearsal Node 24 Infrastructure successor", () => {
  assert.equal(validateControlledRehearsalNode24InfrastructureSuccessor(
    controlledRehearsalNode24InfrastructureSuccessor
  ).commit, "b4bfaf8af58c4d914393954358296b13d83940e5");
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "infrastructure: substitute rehearsal successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].previousSha256 = "0".repeat(64); },
    value => { value.evidence[1].currentSha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(controlledRehearsalNode24InfrastructureSuccessor);
    mutate(candidate);
    assert.throws(() =>
      validateControlledRehearsalNode24InfrastructureSuccessor(candidate));
  }
});

test("Overwatch independently accepts the controlled rehearsal owner chain", async () => {
  const result = await verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1();
  assert.equal(result.status,
    "CONTROLLED_PAID_CUSTOMER_ONBOARDING_REHEARSAL_OVERWATCH_PASS");
  assert.equal(result.ownerCommitCount, 7);
  assert.equal(result.fictionalCompanyCount, 1);
  assert.equal(result.locationCount, 2);
  assert.equal(result.representativeCount, 2);
  assert.equal(result.privateWorkerBaseline, "5a636567-4268-4179-8015-12a12557d286");
  assert.equal(result.publicWorkerBaseline, "6a8713c0-0712-4cda-8a13-daa893ca45f2");
});

test("governance rejects owner, commit, tree, hash, and path substitution", () => {
  for (const mutate of [
    value => { value.ownership.implementationOwners[0] = "Prometheus Overwatch"; },
    value => { value.ownership.overwatchModifiedSubsystemImplementation = true; },
    value => { value.ownership.ownerCommits[0].commit = "0".repeat(40); },
    value => { value.ownership.ownerCommits[1].parent = "0".repeat(40); },
    value => { value.ownership.ownerCommits[2].tree = "0".repeat(40); },
    value => { value.ownership.ownerCommits[3].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[2].evidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.ownerCommits[3].evidence[0].path = "package.json"; },
    value => { value.ownership.ownerCommits[4].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[4].evidence[0].sha256 =
      "0".repeat(64); },
    value => { value.ownership.ownerCommits[5].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[5].evidence[0].sha256 =
      "0".repeat(64); }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects real-data and fictional-identity drift", () => {
  for (const mutate of [
    value => { value.fictionalScope.classification = "REAL_CUSTOMER"; },
    value => { value.fictionalScope.companyId = "fitness_connection"; },
    value => { value.fictionalScope.locationIds.pop(); },
    value => { value.fictionalScope.representativePrincipalIds.pop(); },
    value => { value.fictionalScope.realCustomerDataAllowed = true; },
    value => { value.fictionalScope.existingCrmDataAllowed = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects lifecycle, authorization, hours, and cleanup weakening", () => {
  for (const mutate of [
    value => { value.requiredEvidence.draftCreated = false; },
    value => { value.requiredEvidence.controlledValidationFailurePreserved = false; },
    value => { value.requiredEvidence.finalLifecycleState = "ACTIVE"; },
    value => { value.requiredEvidence.activationImpliedByValidation = true; },
    value => {
      value.requiredEvidence.representativeFounderBillingGovernanceAccessAllowed = true;
    },
    value => { value.requiredEvidence.operatingHoursFailClosedRequired = false; },
    value => { value.requiredEvidence.cleanupStatus = "PRESERVED"; },
    value => { value.requiredEvidence.remainingRehearsalRecords = 1; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects billing, activation, invitation, provider, and intelligence activation", () => {
  for (const mutate of [
    value => { value.requiredEvidence.billingMode = "LIVE"; },
    value => { value.requiredEvidence.billingActivation = "ACTIVE"; },
    value => { value.requiredEvidence.customerActivation = "ON"; },
    value => { value.requiredEvidence.invitationDelivery = "ON"; },
    value => { value.requiredEvidence.providerRefresh = "ON"; },
    value => { value.requiredEvidence.scheduler = "ON"; },
    value => { value.requiredEvidence.collection = "ON"; },
    value => { value.requiredEvidence.activeCohorts = 1; },
    value => { value.requiredEvidence.recommendationInfluence = "ON"; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects deployment, rebuild, public mutation, and rollback acceptance", () => {
  for (const mutate of [
    value => { value.releaseBoundary.workflowTrigger = "push"; },
    value => { value.releaseBoundary.workflowDispatched = true; },
    value => { value.releaseBoundary.deploymentPerformed = true; },
    value => { value.releaseBoundary.cloudflareContacted = true; },
    value => { value.releaseBoundary.secretValuesAccessed = true; },
    value => { value.releaseBoundary.sourceBuildCount = 2; },
    value => { value.releaseBoundary.deploymentRebuildAllowed = true; },
    value => { value.releaseBoundary.publicWorkerMutationAllowed = true; },
    value => { value.releaseBoundary.pairedForwardRollbackRequired = false; },
    value => { value.releaseBoundary.rollbackMayCountAsAcceptance = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects every protected-state mutation", () => {
  for (const mutate of [
    value => { value.protectedState.collection = "ON"; },
    value => { value.protectedState.activeCohorts = 1; },
    value => { value.protectedState.recommendationInfluence = "ON"; },
    value => { value.protectedState.providerRefresh = "ON"; },
    value => { value.protectedState.scheduler = "ON"; },
    value => { value.protectedState.customerActivation = "ON"; },
    value => { value.protectedState.anthonyMapped = true; },
    value => { value.protectedState.activeBusinesses = 1; },
    value => { value.protectedState.reserveBusinesses = 1; },
    value => { value.protectedState.quarantinedBusinesses = 397; },
    value => { value.protectedState.crmReceipt = "changed"; },
    value => { value.protectedState.crmMutationAllowed = true; },
    value => { value.protectedState.publicWorkerMutationAllowed = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("report cannot overstate external action or source acceptance", () => {
  for (const mutate of [
    value => { value.status = "DEPLOYED"; },
    value => { value.sourceDetermination.draftToValidated = "FAIL"; },
    value => { value.sourceDetermination.tenantIsolation = "FAIL"; },
    value => { value.sourceDetermination.cleanupRemoval = "FAIL"; },
    value => { value.externalAction.workflowDispatched = true; },
    value => { value.externalAction.workerDeployed = true; },
    value => { value.externalAction.productionMutation = true; },
    value => { value.externalAction.crmReadOrWrite = true; },
    value => { value.externalAction.secretValueAccess = true; },
    value => { value.externalAction.cloudflareContact = true; }
  ]) {
    const candidate = clone(report);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalReport(candidate));
  }
});
