import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const operatingProfileEngineVersion = "operating-profile-engine-v1";

const repoRoot = resolve(import.meta.dirname, "..");
const profilePath = "intelligence/profiles/operating-profiles.json";
const contractPath = "intelligence/contracts/operating-profile-contracts.json";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function stableId(prefix, value) {
  const digest = createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${digest}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTerm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function loadOperatingProfiles() {
  return readJson(profilePath);
}

export function loadOperatingProfileContracts() {
  return readJson(contractPath);
}

export function listOperatingProfiles(registry = loadOperatingProfiles()) {
  return registry.profiles.map(profile => ({
    profileId: profile.profileId,
    label: profile.label,
    industry: profile.industry
  }));
}

export function getOperatingProfile(profileId, registry = loadOperatingProfiles()) {
  const profile = registry.profiles.find(item => item.profileId === profileId);
  if (!profile) {
    throw new Error(`Unknown operating profile: ${profileId}`);
  }
  return clone(profile);
}

export function validateOperatingProfile(profile, registry = loadOperatingProfiles(), contracts = loadOperatingProfileContracts()) {
  const failures = [];
  for (const field of contracts.requiredProfileFields) {
    if (profile[field] === undefined) failures.push(`${profile.profileId || "profile"} missing ${field}`);
  }
  for (const mapping of profile.outcomeMappings || []) {
    if (!Array.isArray(mapping.terms) || !mapping.terms.length) {
      failures.push(`${profile.profileId} has outcome mapping without terms`);
    }
    if (!registry.normalizedOutcomeVocabulary.includes(mapping.normalizedOutcome)) {
      failures.push(`${profile.profileId} maps to unknown normalized outcome ${mapping.normalizedOutcome}`);
    }
  }
  return failures;
}

export function validateOperatingProfileRegistry(registry = loadOperatingProfiles(), contracts = loadOperatingProfileContracts()) {
  const failures = [];
  const profileIds = new Set((registry.profiles || []).map(profile => profile.profileId));

  if (registry.status !== "architecture_only") failures.push("Operating Profile registry must remain architecture_only.");
  for (const flag of [
    "productionLearningActive",
    "productionRecommendationChanged",
    "dashboardRuntimeChanged",
    "mobileBetaChanged",
    "scoringChanged",
    "activePoolChanged",
    "crmRuntimeChanged",
    "websiteChanged",
    "companionRuntimeChanged",
    "infrastructureChanged"
  ]) {
    if (registry[flag] !== false) failures.push(`Operating Profile registry must keep ${flag}=false.`);
    if (contracts[flag] !== false) failures.push(`Operating Profile contracts must keep ${flag}=false.`);
  }

  for (const profileId of contracts.requiredProfiles) {
    if (!profileIds.has(profileId)) failures.push(`Missing required operating profile ${profileId}`);
  }

  if (JSON.stringify(registry.normalizedOutcomeModel?.sequence) !== JSON.stringify(contracts.normalizedOutcomeModel)) {
    failures.push("Normalized outcome model sequence does not match the contract registry.");
  }

  for (const profile of registry.profiles || []) {
    failures.push(...validateOperatingProfile(profile, registry, contracts));
  }

  for (const contractName of contracts.requiredConsumerContracts) {
    if (!contracts.contracts?.[contractName]) failures.push(`Missing consumer contract ${contractName}`);
  }

  return failures;
}

function findOutcomeMapping(profile, rawOutcome, registry) {
  const normalizedRawOutcome = normalizeTerm(rawOutcome);
  const vocabularyMatch = registry.normalizedOutcomeVocabulary.find(value => value === normalizedRawOutcome.replace(/\s+/g, "_"));
  if (vocabularyMatch) {
    return {
      normalizedOutcome: vocabularyMatch,
      matchedTerm: normalizedRawOutcome,
      mappingSource: "normalized_vocabulary"
    };
  }

  for (const mapping of profile.outcomeMappings || []) {
    if ((mapping.terms || []).some(term => normalizeTerm(term) === normalizedRawOutcome)) {
      return {
        normalizedOutcome: mapping.normalizedOutcome,
        matchedTerm: normalizedRawOutcome,
        mappingSource: "operating_profile"
      };
    }
  }

  return {
    normalizedOutcome: "lead",
    matchedTerm: normalizedRawOutcome,
    mappingSource: "default_review_required",
    reviewRequired: true
  };
}

export function normalizeIndustryOutcome(input, options = {}) {
  const registry = options.registry || loadOperatingProfiles();
  const profile = options.profile || getOperatingProfile(input.profileId, registry);
  const mapping = findOutcomeMapping(profile, input.rawOutcome, registry);
  const occurredAt = input.visit?.occurredAt || input.occurredAt || new Date(0).toISOString();
  const businessRef = input.visit?.businessRef || input.businessRef || { source: "unknown" };
  const repRef = input.visit?.repRef || input.repRef || { source: "unknown" };
  const reviewRequired = mapping.reviewRequired || input.reviewRequired || input.humanOverride?.reviewRequired || false;
  const normalizedOutcome = mapping.normalizedOutcome;
  const evidenceId = stableId("evidence", {
    profileId: profile.profileId,
    rawOutcome: input.rawOutcome,
    businessRef,
    occurredAt
  });

  return {
    normalizedOutcomeId: stableId("normalized_outcome", {
      profileId: profile.profileId,
      rawOutcome: input.rawOutcome,
      businessRef,
      occurredAt
    }),
    contractVersion: registry.version,
    profileId: profile.profileId,
    profileLabel: profile.label,
    rawOutcome: input.rawOutcome,
    matchedTerm: mapping.matchedTerm,
    mappingSource: mapping.mappingSource,
    normalizedOutcome,
    normalizedOutcomeLabel: normalizedOutcome.replace(/_/g, " "),
    stageSequence: [...registry.normalizedOutcomeModel.sequence],
    evidence: {
      evidenceId,
      evidenceType: "field_visit_outcome",
      normalizedEvidenceType: normalizedOutcome,
      source: "operating_profile_engine",
      businessRef,
      repRef,
      visitOccurredAt: occurredAt,
      truthLevel: input.truthLevel || "field_reported",
      reviewState: reviewRequired ? "human_review_required" : "pending_human_review",
      productionLearningActive: false
    },
    learningSignalSeed: {
      signalId: stableId("signal", { evidenceId, normalizedOutcome }),
      signalFamily: normalizedOutcome,
      allowedInfluence: "offline_architecture_only",
      canInfluenceProductionRecommendations: false
    },
    confidenceSeed: {
      confidenceBand: reviewRequired ? "review_required" : "unactivated",
      confidenceScore: null,
      evidenceCount: 1,
      lastValidationAt: occurredAt,
      learningTrend: "unactivated",
      allowedInfluence: "none",
      productionLearningActive: false
    },
    recommendationEligibility: {
      canChangeRecommendation: false,
      reason: "architecture_only_no_production_learning"
    },
    explanationSeed: {
      why: `${profile.label} outcome "${input.rawOutcome}" maps to normalized evidence "${normalizedOutcome}".`,
      whatEvidence: [`${input.rawOutcome} reported during a field visit.`],
      howConfident: "Confidence is not production-active yet.",
      whatChanged: "No production recommendation changed.",
      nextAction: reviewRequired
        ? "Human review is required before this evidence can be promoted."
        : "Preserve the evidence for future human-reviewed learning activation."
    },
    safety: {
      productionLearningActive: false,
      productionRecommendationChanged: false,
      dashboardRuntimeChanged: false,
      mobileBetaChanged: false,
      scoringChanged: false,
      activePoolChanged: false
    }
  };
}

export function buildNormalizedOutcomeModel(input, options = {}) {
  const normalized = input.normalizedOutcomeId ? input : normalizeIndustryOutcome(input, options);
  return {
    modelVersion: operatingProfileEngineVersion,
    profileId: normalized.profileId,
    sequence: {
      Visit: {
        businessRef: normalized.evidence.businessRef,
        repRef: normalized.evidence.repRef,
        occurredAt: normalized.evidence.visitOccurredAt
      },
      Outcome: {
        rawOutcome: normalized.rawOutcome,
        normalizedOutcome: normalized.normalizedOutcome,
        mappingSource: normalized.mappingSource
      },
      Evidence: normalized.evidence,
      "Learning Signal": normalized.learningSignalSeed,
      Confidence: normalized.confidenceSeed,
      Recommendation: normalized.recommendationEligibility
    },
    explanationSeed: normalized.explanationSeed,
    safety: normalized.safety
  };
}

export function buildProfileConsumerContract(profileId, consumer, options = {}) {
  const contracts = options.contracts || loadOperatingProfileContracts();
  const profile = options.profile || getOperatingProfile(profileId, options.registry || loadOperatingProfiles());
  const contractVersion = contracts.version;
  const base = {
    contractVersion,
    consumer,
    profileId: profile.profileId,
    label: profile.label,
    status: "architecture_only"
  };

  if (consumer === "Dashboard") {
    return { ...base, dashboardLabels: clone(profile.dashboardLabels), terminology: clone(profile.terminology), outcomeVocabulary: clone(profile.outcomeVocabulary), runtimeConsumptionAuthorized: false };
  }
  if (consumer === "CRM") {
    return { ...base, crmStages: clone(profile.crmStages), outcomeVocabulary: clone(profile.outcomeVocabulary), runtimeMutationAuthorized: false };
  }
  if (consumer === "Companion") {
    return { ...base, companionWording: clone(profile.companionWording), runtimeConsumptionAuthorized: false };
  }
  if (consumer === "Mobile") {
    return { ...base, terminology: clone(profile.terminology), dashboardLabels: clone(profile.dashboardLabels), mobileBetaChanged: false };
  }
  if (consumer === "Website") {
    return { ...base, reportingLanguage: clone(profile.reportingLanguage), websiteChanged: false };
  }
  if (consumer === "Research") {
    return { ...base, industry: profile.industry, terminology: clone(profile.terminology), outcomeVocabulary: clone(profile.outcomeVocabulary), runtimeConsumptionAuthorized: false };
  }
  if (consumer === "Sales") {
    return { ...base, terminology: clone(profile.terminology), kpis: clone(profile.kpis), successEvents: clone(profile.successEvents), runtimeConsumptionAuthorized: false };
  }
  if (consumer === "SocialMedia") {
    return { ...base, terminology: clone(profile.terminology), reportingLanguage: clone(profile.reportingLanguage), runtimeConsumptionAuthorized: false };
  }

  throw new Error(`Unsupported operating profile consumer: ${consumer}`);
}
