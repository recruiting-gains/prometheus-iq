import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  buildNormalizedOutcomeModel,
  buildProfileConsumerContract,
  loadOperatingProfileContracts,
  loadOperatingProfiles,
  normalizeIndustryOutcome,
  validateOperatingProfile,
  validateOperatingProfileRegistry
} from "../intelligence/operating-profile-engine.mjs";
import { buildRecommendationExplanationV1 } from "../intelligence/recommendation-explainability-engine.mjs";

const root = resolve(import.meta.dirname, "..");

test("operating profile verifier passes", () => {
  const result = spawnSync("node", ["scripts/verify-operating-profile-engine.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "passed");
  assert.equal(summary.profileCount, 8);
  assert.equal(summary.productionSafety.productionLearningActive, false);
  assert.equal(summary.productionSafety.scoringChanged, false);
});

test("registry includes required outside-sales profiles and remains architecture-only", () => {
  const registry = loadOperatingProfiles();
  const contracts = loadOperatingProfileContracts();
  const failures = validateOperatingProfileRegistry(registry, contracts);
  const profileIds = new Set(registry.profiles.map(profile => profile.profileId));

  assert.deepEqual(failures, []);
  for (const profileId of contracts.requiredProfiles) {
    assert.ok(profileIds.has(profileId), `Missing profile ${profileId}`);
  }
  assert.equal(registry.status, "architecture_only");
  assert.equal(registry.productionRecommendationChanged, false);
  assert.equal(registry.dashboardRuntimeChanged, false);
  assert.equal(registry.mobileBetaChanged, false);
});

test("future industries are addable through profile configuration", () => {
  const registry = loadOperatingProfiles();
  const syntheticProfile = {
    ...registry.profiles.find(profile => profile.profileId === "general_outside_sales"),
    profileId: "manufacturing",
    label: "Manufacturing",
    industry: "manufacturing",
    outcomeMappings: [
      { terms: ["plant tour"], normalizedOutcome: "appointment" },
      { terms: ["quote"], normalizedOutcome: "estimate" }
    ]
  };

  assert.deepEqual(validateOperatingProfile(syntheticProfile, registry), []);
});

test("industry outcomes normalize into the canonical outcome model", () => {
  const cases = [
    ["fitness", "membership", "sale"],
    ["roofing", "contract signed", "contract"],
    ["security", "site survey", "inspection"],
    ["medical", "referral", "referral"],
    ["insurance", "policy", "contract"],
    ["solar", "proposal", "estimate"],
    ["home_services", "job booked", "contract"]
  ];

  for (const [profileId, rawOutcome, expectedOutcome] of cases) {
    const normalized = normalizeIndustryOutcome({
      profileId,
      rawOutcome,
      visit: {
        businessRef: { source: "test", id: profileId },
        repRef: { source: "test", id: "rep-1" },
        occurredAt: "2026-07-02T13:00:00.000Z"
      }
    });
    const model = buildNormalizedOutcomeModel(normalized);

    assert.equal(normalized.normalizedOutcome, expectedOutcome);
    assert.deepEqual(normalized.stageSequence, ["Visit", "Outcome", "Evidence", "Learning Signal", "Confidence", "Recommendation"]);
    assert.equal(model.sequence.Recommendation.canChangeRecommendation, false);
    assert.equal(model.sequence.Confidence.productionLearningActive, false);
  }
});

test("consumer contracts exist for all requested subsystems without production authorization", () => {
  const consumers = ["Dashboard", "CRM", "Companion", "Mobile", "Website", "Research", "Sales", "SocialMedia"];
  for (const consumer of consumers) {
    const contract = buildProfileConsumerContract("roofing", consumer);
    assert.equal(contract.consumer, consumer);
    assert.equal(contract.profileId, "roofing");
    assert.equal(contract.status, "architecture_only");
    assert.notEqual(contract.runtimeConsumptionAuthorized, true);
    assert.notEqual(contract.runtimeMutationAuthorized, true);
    assert.notEqual(contract.mobileBetaChanged, true);
    assert.notEqual(contract.websiteChanged, true);
  }
});

test("profile evidence can seed explainability without exposing formulas or changing scoring", () => {
  const normalized = normalizeIndustryOutcome({
    profileId: "solar",
    rawOutcome: "site survey",
    visit: {
      businessRef: { source: "test", name: "Northline Solar Prospect" },
      repRef: { source: "test", name: "Rep One" },
      occurredAt: "2026-07-02T14:00:00.000Z"
    }
  });

  const explanation = buildRecommendationExplanationV1({
    recommendationRef: { source: "test", id: "rec-1" },
    recommendation: { name: "Northline Solar Prospect" },
    evidence: normalized.evidence,
    signals: [normalized.learningSignalSeed],
    confidence: {
      confidenceBand: "unactivated",
      confidenceScore: 0.62,
      evidenceCount: 1,
      learningTrend: "unactivated",
      lastValidationAt: normalized.evidence.visitOccurredAt,
      reviewState: "pending_human_review",
      allowedInfluence: "none",
      supportingEvidenceIds: [normalized.evidence.evidenceId]
    },
    location: { territoryQuality: true, coverageGap: true, evidenceRefs: [normalized.evidence.evidenceId] },
    business: { categoryStrength: true, opportunityLevel: "standard", evidenceRefs: [normalized.evidence.evidenceId] },
    history: { previousVisits: 0, evidenceRefs: [normalized.evidence.evidenceId] },
    route: { routeOptimized: true, travelEfficient: true, nearbyOpportunities: true, clusterQuality: true, evidenceRefs: [normalized.evidence.evidenceId] }
  });

  assert.ok(explanation.answers.why.length > 0);
  assert.ok(explanation.answers.whatEvidenceSupportsIt.includes(normalized.evidence.evidenceId));
  assert.equal(explanation.safety.scoringChanged, false);
  assert.equal(explanation.safety.productionRecommendationChanged, false);
  assert.equal(explanation.safety.formulasExposed, false);
});
