import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildReadOnlyFieldSessionLearningSnapshot,
  loadCanonicalArchivedFieldSessionPackages,
  loadReadOnlyFieldSessionDataContract,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy,
  validateArchivedFieldSessionPackage,
  validateReadOnlyFieldSessionLearningContract,
  validateReadOnlyFieldSessionLearningPolicy,
  validateReadOnlyFieldSessionLearningSnapshot
} from "../intelligence/read-only-field-session-learning.mjs";
import {
  verifyCrossIndustryZipFounderAccessAdoption
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
import { verifyReadOnlyFieldSessionLearning } from "../scripts/verify-read-only-field-session-learning.mjs";

const root = new URL("../", import.meta.url);
const clone = value => JSON.parse(JSON.stringify(value));
const read = path => readFileSync(new URL(path, root));
const readJson = path => JSON.parse(read(path).toString("utf8"));
const sha256 = path => createHash("sha256").update(read(path)).digest("hex");
const rootPath = fileURLToPath(root);
const zipFounderProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json";

function fixtures() {
  const contract = loadReadOnlyFieldSessionLearningContract();
  return {
    contract,
    policy: loadReadOnlyFieldSessionLearningPolicy(),
    dataContract: loadReadOnlyFieldSessionDataContract(contract),
    archivePackages: loadCanonicalArchivedFieldSessionPackages(contract)
  };
}

function build(overrides = {}) {
  return buildReadOnlyFieldSessionLearningSnapshot({
    ...fixtures(),
    ...overrides
  });
}

test("read-only field-session learning verifier passes against canonical archived evidence", () => {
  const result = verifyReadOnlyFieldSessionLearning();

  assert.equal(result.status, "passed");
  assert.equal(result.verifiedSessionsConsumed, 1);
  assert.equal(result.representativeIntelligenceRecords, 1);
  assert.equal(result.territoryIntelligenceRecords, 1);
  assert.equal(result.categoryIntelligenceRecords, 1);
  assert.equal(result.businessIntelligenceRecords, 4);
  assert.equal(result.recommendationEligibleConclusions, 0);
  assert.equal(result.dataContractMutation, false);
  assert.equal(result.archiveMutation, false);
  assert.equal(result.historicalReplay, false);
  assert.equal(result.routeScoringWeightsChanged, false);
  assert.equal(result.recommendationBehaviorChanged, false);
  assert.equal(result.protectedBehaviorSuccessors, 4);
});

test("approved ZIP and Founder Dashboard output advances only the protected presentation baseline", () => {
  const { adoption, transitionByPath } =
    verifyCrossIndustryZipFounderAccessAdoption();

  assert.equal(adoption.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(transitionByPath.get("index.html").transitions[0].ownerSubsystem,
    "Prometheus Dashboard");
  assert.equal(transitionByPath.get("index.html").transitions[1].ownerSubsystem,
    "Prometheus Infrastructure");
  assert.equal(
    transitionByPath.get("index.html").currentSha256,
    transitionByPath.get("deploy/cloudflare-pages/index.html").currentSha256
  );
  assert.equal(adoption.intelligenceRuntimeIntegrity.runtimeFilesChangedSinceComparisonBase, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.routeOrderingChanged, false);
  assert.equal(adoption.intelligenceRuntimeIntegrity.routeScoringChanged, false);
  assert.equal(adoption.boundaries.recommendationInfluence, "OFF");
});

test("approved ZIP and Founder Dashboard adoption rejects matching arbitrary source and mirror drift", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-intelligence-adoption-"));
  try {
    execFileSync("/usr/bin/git", [
      "clone",
      "--quiet",
      "--no-hardlinks",
      rootPath,
      fixture
    ], {
      stdio: "ignore"
    });
    copyFileSync(
      join(rootPath, zipFounderProvenancePath),
      join(fixture, zipFounderProvenancePath)
    );

    const verify = [
      "import('./intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs')",
      ".then(module => module.verifyCrossIndustryZipFounderAccessAdoption())"
    ].join("");
    execFileSync(process.execPath, ["--input-type=module", "--eval", verify], {
      cwd: fixture,
      stdio: "pipe"
    });

    for (const path of ["index.html", "deploy/cloudflare-pages/index.html"]) {
      appendFileSync(join(fixture, path), "\n<!-- unapproved-dashboard-drift -->\n");
    }
    assert.throws(
      () => execFileSync(
        process.execPath,
        ["--input-type=module", "--eval", verify],
        { cwd: fixture, stdio: "pipe" }
      ),
      (error) => {
        assert.match(
          error.stderr.toString("utf8"),
          /Current Full-System Harmony protected source changed: index\.html/u
        );
        return true;
      }
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("read-only learning rejects an ungoverned protected-behavior successor", () => {
  const { contract } = fixtures();
  const changed = clone(contract);
  changed.protectedBehaviorBaselines.dashboardSourceSha256 = "0".repeat(64);
  assert.throws(
    () => verifyReadOnlyFieldSessionLearning({ contract: changed }),
    /ZIP\/Founder protected predecessor mismatch/u
  );
});

test("canonical contract and governed policy activate only read-only Intelligence consumption", () => {
  const { contract, policy, dataContract } = fixtures();

  assert.deepEqual(validateReadOnlyFieldSessionLearningPolicy(policy), []);
  assert.deepEqual(validateReadOnlyFieldSessionLearningContract(contract, dataContract), []);
  assert.equal(contract.independentAuthorization.status, "AUTHORIZED_ACTIVE");
  assert.equal(contract.independentAuthorization.accessMode, "read_only");
  assert.equal(contract.allowedOperations.read, true);
  assert.equal(contract.allowedOperations.calculate, true);
  assert.equal(contract.allowedOperations.scoreLearningConfidence, true);
  assert.equal(contract.allowedOperations.summarize, true);
  assert.equal(contract.allowedOperations.learn, true);
  for (const operation of ["modifyData", "deleteArchives", "rewriteSessions", "replaySessions", "createHistoricalEvidence", "consumeRawEvidence", "consumeStressTestObservations", "consumeAdministrativelyExcludedSessions"]) {
    assert.equal(contract.allowedOperations[operation], false, operation);
  }
  assert.equal(dataContract.intelligenceFieldSessionLearningHandoff.independentAuthorizationRequiredBeforeConsumption, true);
  assert.equal(dataContract.consumerRules.intelligence.fieldSessionLearningConsumptionAuthorized, false);
  assert.equal(policy.recommendationInfluence.activationStatus, "disabled_pending_future_handoff");
  assert.equal(contract.administrativeDispositionAdmission.disposedSessionAdmissionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.auditRecordRetentionRequired, true);
  assert.equal(contract.administrativeDispositionAdmission.automaticZeroVisitExclusionAllowed, false);
  assert.equal(contract.administrativeDispositionAdmission.unrelatedUndisposedZeroVisitSessionEligible, true);
  assert.equal(contract.administrativeDispositionAdmission.exactExcludedSessionId, "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14");
  assert.equal(contract.administrativeDispositionAdmission.exactExcludedRawSha256, "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765");
  assert.deepEqual(contract.administrativeDispositionAdmission.auditProjectionAllowedFields, ["sourceRawSha256", "dispositionRecordSha256"]);
  assert.equal(contract.administrativeDispositionAdmission.auditProjectionRawPayloadAllowed, false);
  assert.equal(contract.prospectiveRetentionAdmission.dataFoundationCommit, "a5bd1d431e778cec045d1e8412efb396674ea321");
  assert.equal(contract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit, "c73118ddb262d3010bbc94a900f8506fb2f56192");
  for (const field of ["prospectiveEvidencePromotionByArchivedLearningAllowed", "missingExpiredUnknownOrMalformedBoundaryAdmissionAllowed", "noncanonicalOriginAdmissionAllowed", "unknownOrActiveLegalHoldAdmissionAllowed", "derivedProjectionMayOutliveSource", "automaticZeroVisitExclusionAllowed", "productionActivationEligible"]) {
    assert.equal(contract.prospectiveRetentionAdmission[field], false, field);
  }
  assert.equal(dataContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.retentionPolicyProvided, true);
  assert.equal(dataContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.activationEligibleUnderRetentionPolicy, false);
  assert.equal(dataContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.productionCollectionActivated, false);
  assert.equal(dataContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.productionEvidenceRecords, 0);
  assert.deepEqual(
    contract.administrativeDispositionAdmission.requiredExcludedDomains,
    dataContract.fieldSessionAdministrativeDispositionContract.excludedDomains
  );
});

test("administratively disposed sessions fail closed before learning without a blanket zero-visit rule", () => {
  const current = fixtures();
  current.archivePackages[0].administrativeDisposition = {
    schemaVersion: "route-iq-field-session-administrative-disposition-v1",
    state: "EXCLUDED_FROM_ANALYTICS",
    reason: "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION"
  };
  current.archivePackages[0].consumptionEligibility = {
    eligible: false,
    state: "EXCLUDED_FROM_ANALYTICS"
  };

  assert.throws(
    () => build(current),
    /administratively_disposed_session_excluded|administratively_ineligible_session_excluded/
  );

  const undisposed = fixtures();
  undisposed.archivePackages[0].administrativeDisposition = null;
  undisposed.archivePackages[0].consumptionEligibility = {
    eligible: true,
    state: "NOT_ADMINISTRATIVELY_EXCLUDED"
  };
  undisposed.archivePackages[0].verifiedFieldSession.verifiedFields.completedVisits = [];
  undisposed.archivePackages[0].verifiedFieldSession.verifiedFields.totals.totalVisits = 0;
  undisposed.archivePackages[0].historyUpdates.representativeHistory.totals.totalVisits = 0;
  const failures = validateArchivedFieldSessionPackage(undisposed.archivePackages[0], {
    contract: undisposed.contract,
    policy: undisposed.policy,
    dataContract: undisposed.dataContract,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness"
  });
  assert.equal(failures.includes("administratively_disposed_session_excluded"), false);
  assert.equal(failures.includes("administratively_ineligible_session_excluded"), false);
});

test("canonical source records remain byte-identical and projection output is deeply frozen", () => {
  const { contract, archivePackages } = fixtures();
  const beforeBytes = Object.fromEntries(Object.entries(contract.canonicalSourceArtifacts).map(([name, path]) => [name, read(path).toString("utf8")]));
  const beforeObjects = clone(archivePackages);
  const snapshot = build({ archivePackages });
  const afterBytes = Object.fromEntries(Object.entries(contract.canonicalSourceArtifacts).map(([name, path]) => [name, read(path).toString("utf8")]));

  assert.deepEqual(archivePackages, beforeObjects);
  assert.deepEqual(afterBytes, beforeBytes);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.representativeIntelligence), true);
  assert.equal(Object.isFrozen(snapshot.representativeIntelligence[0].confidence), true);
  assert.throws(() => { snapshot.status = "mutated"; }, TypeError);
});

test("learning snapshot is deterministic and matches the Intelligence-owned canonical artifact", () => {
  const first = build();
  const second = build();
  const canonical = readJson("intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json");

  assert.deepEqual(second, first);
  assert.deepEqual(canonical, first);
  assert.deepEqual(validateReadOnlyFieldSessionLearningSnapshot(first), []);
  assert.equal(first.generatedAt, "2026-07-12T00:36:02.000Z");
  assert.equal(first.learningVersion.engine, "read-only-field-session-learning-v1");
});

test("verified session produces truthful representative, category, business, and unavailable territory intelligence", () => {
  const snapshot = build();
  const representative = snapshot.representativeIntelligence[0];
  const territory = snapshot.territoryIntelligence[0];
  const category = snapshot.categoryIntelligence[0];

  assert.equal(representative.representativeId, "cruz");
  assert.deepEqual(representative.categoryPerformance.Auto, { visits: 4, conversations: 4, leads: 3, units: 0, laterUnits: 0 });
  assert.equal(representative.conversationOutcomes.conversationRatePercent, 100);
  assert.equal(representative.leadQuality.leadPerVisitRatePercent, 75);
  assert.equal(representative.followUpBehavior.status, "unavailable");
  assert.equal(representative.timeOfDayEffectiveness.Midday.visits, 4);
  assert.equal(representative.visitFrequency.status, "insufficient_evidence");
  assert.equal(representative.closeBehavior.memberships, null);
  assert.equal(territory.status, "unavailable");
  assert.equal(territory.territoryId, null);
  assert.equal(territory.shoppingCenterPerformance.status, "unavailable");
  assert.equal(territory.commercialCorridorPerformance.status, "unavailable");
  assert.equal(category.category, "Auto");
  assert.equal(category.metrics.visits, 4);
  assert.equal(category.metrics.leads, 3);
  assert.equal(category.metrics.memberships, null);
  assert.equal(category.bestCategoryDeclared, false);
  assert.equal(snapshot.businessIntelligence.length, 4);
  assert.equal(snapshot.businessIntelligence.every(record => record.historicalInteractions.length === 1), true);
});

test("one verified session cannot change recommendations even when some activity thresholds are met", () => {
  const snapshot = build();

  assert.equal(snapshot.learningConfidence.every(confidence => confidence.band === "insufficient_evidence"), true);
  assert.equal(snapshot.learningConfidence.every(confidence => confidence.recommendationInfluenceEligible === false), true);
  assert.equal(snapshot.recommendationSafety.thresholdQualifiedConclusionCount, 0);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.recommendationSafety.recommendationBehaviorChanged, false);
  assert.equal(snapshot.recommendationSafety.routeScoringWeightsChanged, false);
});

test("threshold values are configuration-driven while recommendation influence remains separately disabled", () => {
  const { policy } = fixtures();
  const permissivePolicy = clone(policy);
  for (const thresholds of Object.values(permissivePolicy.evidenceThresholds)) {
    for (const key of Object.keys(thresholds)) {
      if (key.startsWith("minimum")) thresholds[key] = 0;
    }
    thresholds.requiresTerritoryIdentity = false;
  }
  const snapshot = build({ policy: permissivePolicy });

  assert.ok(snapshot.recommendationSafety.thresholdQualifiedConclusionCount > 0);
  assert.equal(snapshot.recommendationSafety.recommendationEligibleConclusionCount, 0);
  assert.equal(snapshot.recommendationSafety.recommendationBehaviorChanged, false);
});

test("every learned conclusion carries evidence, confidence, update, workspace, rep, and territory scope", () => {
  const { contract } = fixtures();
  const snapshot = build();
  const conclusions = [
    ...snapshot.representativeIntelligence,
    ...snapshot.territoryIntelligence,
    ...snapshot.categoryIntelligence,
    ...snapshot.businessIntelligence
  ];

  for (const conclusion of conclusions) {
    for (const field of contract.explainabilityRequiredFields) {
      assert.ok(Object.prototype.hasOwnProperty.call(conclusion.explainability, field), `${conclusion.intelligenceId}:${field}`);
    }
    assert.ok(conclusion.explainability.evidenceUsed.length > 0);
    assert.equal(conclusion.explainability.applicableWorkspace, "fitness_connection");
    assert.equal(conclusion.explainability.confidence.recommendationInfluenceEligible, false);
  }
});

test("failed, partial, unverified, and synthetic sessions fail closed", () => {
  const current = fixtures();
  const cases = [
    {
      label: "partial",
      mutate: ({ archivePackages }) => { archivePackages[0].manifest.status = "partial"; },
      expected: /session_not_archived/
    },
    {
      label: "failed",
      mutate: ({ archivePackages }) => { archivePackages[0].manifest.status = "failed"; },
      expected: /session_not_archived/
    },
    {
      label: "unverified",
      mutate: ({ archivePackages }) => { archivePackages[0].verifiedFieldSession.sourceProvenance.finalExportConfirmed = false; },
      expected: /final_export_not_confirmed/
    },
    {
      label: "synthetic",
      mutate: ({ archivePackages, policy }) => {
        const id = "synthetic-session-fitness-connection";
        archivePackages[0].manifest.sessionId = id;
        archivePackages[0].verifiedFieldSession.sessionId = id;
        archivePackages[0].calculatedMetrics.sessionId = id;
        archivePackages[0].calculatedMetrics.calculationProvenance.sourceSessionId = id;
        archivePackages[0].historyUpdates.sessionId = id;
        policy.admission.authorizedSessionIds = [id];
      },
      expected: /session_identifier_prohibited:synthetic/
    },
    {
      label: "test session",
      mutate: ({ archivePackages, policy }) => {
        const id = "test-session-fitness-connection";
        archivePackages[0].manifest.sessionId = id;
        archivePackages[0].verifiedFieldSession.sessionId = id;
        archivePackages[0].calculatedMetrics.sessionId = id;
        archivePackages[0].calculatedMetrics.calculationProvenance.sourceSessionId = id;
        archivePackages[0].historyUpdates.sessionId = id;
        policy.admission.authorizedSessionIds = [id];
      },
      expected: /session_identifier_prohibited:test/
    }
  ];

  for (const scenario of cases) {
    const input = clone(current);
    scenario.mutate(input);
    assert.throws(() => build(input), scenario.expected, scenario.label);
  }
});

test("duplicate session input is rejected instead of replayed", () => {
  const current = fixtures();
  current.archivePackages.push(clone(current.archivePackages[0]));

  assert.throws(() => build(current), /duplicate_session_replay_rejected/);
});

test("unknown, protected, and wrong-profile scopes fail closed", () => {
  assert.throws(() => build({ workspaceId: "unknown_workspace" }), /Unknown field-session learning workspace/);
  assert.throws(() => build({ workspaceId: "unauthorized_workspace_fixture" }), /Unknown field-session learning workspace/);
  assert.throws(() => build({ operatingProfileId: "franchise_development" }), /operating profile mismatch/);
});

test("raw evidence, notes-based claims, and Membership labels are never promoted into learned facts", () => {
  const { contract } = fixtures();
  const snapshot = build();
  const texans = snapshot.businessIntelligence.find(record => record.businessName === "Texans Auto Repair - Blackhawk");

  assert.equal(snapshot.sourceEvidence.rawEvidenceConsumed, false);
  assert.equal(snapshot.sourceEvidence.stressTestObservationsConsumed, false);
  assert.equal(contract.allowedOperations.consumeRawEvidence, false);
  assert.equal(contract.allowedOperations.consumeStressTestObservations, false);
  assert.equal(texans.membershipHistory.memberships, null);
  assert.equal(texans.membershipHistory.status, "unavailable");
  assert.equal(snapshot.representativeIntelligence[0].followUpBehavior.status, "unavailable");
});

test("protected Dashboard and Route Intelligence successors are governed while Data stays unchanged", () => {
  const { contract } = fixtures();
  const result = verifyReadOnlyFieldSessionLearning();

  assert.equal(result.protectedBehaviorSuccessors, 4);
  for (const [name, expectedHash] of Object.entries(contract.canonicalSourceSha256)) {
    assert.equal(sha256(contract.canonicalSourceArtifacts[name]), expectedHash, name);
  }
});

test("package validator reports no failures for the one authorized canonical archive", () => {
  const { contract, policy, dataContract, archivePackages } = fixtures();
  const failures = validateArchivedFieldSessionPackage(archivePackages[0], {
    contract,
    policy,
    dataContract,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness"
  });

  assert.deepEqual(failures, []);
});
