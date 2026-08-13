import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2.mjs";

export const operatingProfileEngineVersion = "operating-profile-engine-v1";
export const operatingProfileOutcomeSemanticDispositionContract = Object.freeze({
  version: "operating-profile-outcome-semantic-disposition-v1",
  precedence: Object.freeze([
    "unclassified_review_required",
    "follow_up",
    "positive_success",
    "negative",
    "neutral_intermediate"
  ]),
  dispositions: Object.freeze({
    positiveSuccess: "positive_success",
    followUp: "follow_up",
    neutralIntermediate: "neutral_intermediate",
    negative: "negative",
    unclassifiedReviewRequired: "unclassified_review_required"
  }),
  canonicalFollowUpOutcome: "follow_up",
  negativeOutcomes: Object.freeze([
    "no_decision_maker",
    "closed_business",
    "duplicate",
    "wrong_business",
    "competitor"
  ]),
  successAuthority: "active_operating_profile.successEvents",
  failClosedUnknownOutcomes: true,
  recommendationInfluence: "OFF",
  confidencePropagation: "OFF"
});

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
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function rawOutcomeDescription(value) {
  if (typeof value !== "string" || !value.trim()) return "Unclassified field outcome";
  return value.trim().slice(0, 120);
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
  const mappedTerms = new Map();
  for (const field of contracts.requiredProfileFields) {
    if (profile[field] === undefined) failures.push(`${profile.profileId || "profile"} missing ${field}`);
  }
  for (const successEvent of profile.successEvents || []) {
    if (!registry.normalizedOutcomeVocabulary.includes(successEvent)) {
      failures.push(`${profile.profileId} has unknown success event ${successEvent}`);
    }
  }
  for (const [mappingIndex, mapping] of (profile.outcomeMappings || []).entries()) {
    if (!Array.isArray(mapping.terms) || !mapping.terms.length) {
      failures.push(`${profile.profileId} has outcome mapping without terms`);
    }
    if (!registry.normalizedOutcomeVocabulary.includes(mapping.normalizedOutcome)) {
      failures.push(`${profile.profileId} maps to unknown normalized outcome ${mapping.normalizedOutcome}`);
    }
    for (const term of mapping.terms || []) {
      const normalizedTerm = normalizeTerm(term);
      if (!normalizedTerm) {
        failures.push(`${profile.profileId} has a blank outcome mapping term`);
        continue;
      }
      const prior = mappedTerms.get(normalizedTerm);
      if (prior && prior.normalizedOutcome !== mapping.normalizedOutcome) {
        failures.push(`${profile.profileId} ambiguously maps outcome term ${normalizedTerm}`);
      } else {
        mappedTerms.set(normalizedTerm, {
          mappingIndex,
          normalizedOutcome: mapping.normalizedOutcome
        });
      }
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

  const semanticContract = operatingProfileOutcomeSemanticDispositionContract;
  if (!semanticContract.version.endsWith("-v1")) {
    failures.push("Outcome semantic disposition contract must be versioned.");
  }
  if (!registry.normalizedOutcomeVocabulary.includes(semanticContract.canonicalFollowUpOutcome)) {
    failures.push("Canonical follow-up outcome is absent from the normalized vocabulary.");
  }
  for (const outcome of semanticContract.negativeOutcomes) {
    if (!registry.normalizedOutcomeVocabulary.includes(outcome)) {
      failures.push(`Negative semantic outcome is absent from the normalized vocabulary: ${outcome}`);
    }
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
  for (const [mappingIndex, mapping] of (profile.outcomeMappings || []).entries()) {
    if ((mapping.terms || []).some(term => normalizeTerm(term) === normalizedRawOutcome)) {
      return {
        normalizedOutcome: mapping.normalizedOutcome,
        matchedTerm: normalizedRawOutcome,
        mappingSource: "operating_profile",
        mappingRule: {
          authority: "active_operating_profile.outcomeMappings",
          profileId: profile.profileId,
          mappingIndex,
          normalizedOutcome: mapping.normalizedOutcome
        }
      };
    }
  }

  const vocabularyMatch = normalizedRawOutcome
    ? registry.normalizedOutcomeVocabulary.find(value => (
        value === normalizedRawOutcome.replace(/\s+/g, "_")
      ))
    : null;
  if (vocabularyMatch) {
    return {
      normalizedOutcome: vocabularyMatch,
      matchedTerm: normalizedRawOutcome,
      mappingSource: "normalized_vocabulary",
      mappingRule: {
        authority: "operating_profile_registry.normalizedOutcomeVocabulary",
        profileId: profile.profileId,
        normalizedOutcome: vocabularyMatch
      }
    };
  }

  return {
    normalizedOutcome: null,
    matchedTerm: normalizedRawOutcome,
    mappingSource: "unclassified_review_required",
    reviewRequired: true,
    mappingRule: {
      authority: "operating_profile_outcome_semantic_disposition.failClosedUnknownOutcomes",
      profileId: profile.profileId,
      normalizedOutcome: null
    }
  };
}

function normalizedAdmission(input) {
  const source = input.governedAdmission || {};
  return {
    admitted: source.admitted === true,
    authority: source.authority || null,
    manifestId: source.manifestId || null,
    manifestSha256: source.manifestSha256 || null,
    sourceRecordSha256: source.sourceRecordSha256 || null,
    sessionId: source.sessionId || null,
    visitId: source.visitId || null
  };
}

function semanticDispositionFor({ profile, registry, mapping, reviewRequired, admission }) {
  const contract = operatingProfileOutcomeSemanticDispositionContract;
  const normalizedOutcome = mapping.normalizedOutcome;
  let disposition = contract.dispositions.neutralIntermediate;
  let relationshipType = "Visited";
  let authority = {
    source: "operating_profile_outcome_semantic_disposition.neutralIntermediate",
    profileId: profile.profileId,
    ruleValue: normalizedOutcome
  };

  if (reviewRequired || !normalizedOutcome) {
    disposition = contract.dispositions.unclassifiedReviewRequired;
    authority = {
      source: "operating_profile_outcome_semantic_disposition.failClosedUnknownOutcomes",
      profileId: profile.profileId,
      ruleValue: null
    };
  } else if (normalizedOutcome === contract.canonicalFollowUpOutcome) {
    disposition = contract.dispositions.followUp;
    relationshipType = "Follow-up";
    authority = {
      source: "operating_profile_outcome_semantic_disposition.canonicalFollowUpOutcome",
      profileId: profile.profileId,
      ruleValue: contract.canonicalFollowUpOutcome
    };
  } else if ((profile.successEvents || []).includes(normalizedOutcome)) {
    disposition = contract.dispositions.positiveSuccess;
    relationshipType = "Successful";
    authority = {
      source: "active_operating_profile.successEvents",
      profileId: profile.profileId,
      ruleValue: normalizedOutcome
    };
  } else if (contract.negativeOutcomes.includes(normalizedOutcome)) {
    disposition = contract.dispositions.negative;
    authority = {
      source: "operating_profile_outcome_semantic_disposition.negativeOutcomes",
      profileId: profile.profileId,
      ruleValue: normalizedOutcome
    };
  }

  const learningEligible = admission.admitted && !reviewRequired && Boolean(normalizedOutcome);
  return {
    contractVersion: contract.version,
    disposition,
    relationshipType,
    relationshipEligible: learningEligible,
    learningEligible,
    successEligible: learningEligible && disposition === contract.dispositions.positiveSuccess,
    followUpEligible: learningEligible && disposition === contract.dispositions.followUp,
    reviewRequired,
    authority,
    mappingRule: clone(mapping.mappingRule),
    registryVersion: registry.version
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
  const admission = normalizedAdmission(input);
  const semanticDisposition = semanticDispositionFor({
    profile,
    registry,
    mapping,
    reviewRequired,
    admission
  });
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
    normalizedOutcomeLabel: normalizedOutcome?.replace(/_/g, " ") || "unclassified",
    semanticDisposition,
    stageSequence: [...registry.normalizedOutcomeModel.sequence],
    evidence: {
      evidenceId,
      evidenceType: "field_visit_outcome",
      normalizedEvidenceType: normalizedOutcome || "unclassified",
      source: "operating_profile_engine",
      businessRef,
      repRef,
      visitOccurredAt: occurredAt,
      truthLevel: input.truthLevel || "field_reported",
      reviewState: reviewRequired
        ? "human_review_required"
        : admission.admitted
          ? "admitted_non_review_required"
          : "pending_human_review",
      admission,
      productionLearningActive: false
    },
    learningSignalSeed: {
      signalId: stableId("signal", { evidenceId, normalizedOutcome }),
      signalFamily: normalizedOutcome || "unclassified",
      allowedInfluence: "offline_architecture_only",
      semanticLearningEligible: semanticDisposition.learningEligible,
      canInfluenceProductionRecommendations: false
    },
    confidenceSeed: {
      confidenceBand: reviewRequired ? "review_required" : "unactivated",
      confidenceScore: null,
      evidenceCount: semanticDisposition.learningEligible ? 1 : 0,
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
      why: reviewRequired
        ? `${profile.label} outcome remains unclassified and requires human review.`
        : `${profile.label} outcome maps to normalized evidence "${normalizedOutcome}" under ${semanticDisposition.authority.source}.`,
      whatEvidence: [`${rawOutcomeDescription(input.rawOutcome)} reported during a field visit.`],
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
        mappingSource: normalized.mappingSource,
        semanticDisposition: normalized.semanticDisposition
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

export function resolveConfiguredIntelligenceProfile(input, options = {}) {
  const workspaceRegistry = validateRouteIqWorkspaceConfigurationRegistry(input?.workspaceRegistry);
  const workspaceId = String(input?.workspaceId || "").trim();
  const operatingProfileId = String(input?.operatingProfileId || "").trim();
  const territoryId = String(input?.territoryId || "").trim();
  const workspace = workspaceRegistry.workspaces.find(item => item.workspaceId === workspaceId);
  if (!workspace) throw new Error("Unknown governed Route IQ workspace configuration.");
  if (workspace.operatingProfile.profileId !== operatingProfileId) {
    throw new Error("Governed Route IQ operating profile does not match the workspace configuration.");
  }
  if (!workspace.territories.some(territory => territory.active && territory.territoryId === territoryId)) {
    throw new Error("Governed Route IQ territory does not match the workspace configuration.");
  }
  if (workspace.lifecycle === "founder_research" && input.allowFounderResearch !== true) {
    throw new Error("Founder-research Intelligence profile requires explicit non-production admission.");
  }
  if (workspace.lifecycle === "synthetic_validation_only" && input.allowSynthetic !== true) {
    throw new Error("Synthetic Intelligence profile is unavailable outside validation.");
  }
  if (workspace.lifecycle === "active_customer" && workspace.admission.productionAuthorized !== true) {
    throw new Error("Customer Intelligence profile is not production authorized.");
  }
  const profileRegistry = options.registry || loadOperatingProfiles();
  const profile = getOperatingProfile(operatingProfileId, profileRegistry);
  const failures = validateOperatingProfile(profile, profileRegistry, options.contracts || loadOperatingProfileContracts());
  if (failures.length) {
    throw new Error(`Governed Route IQ operating profile is invalid: ${failures.join(" | ")}`);
  }
  return Object.freeze({
    engineVersion: operatingProfileEngineVersion,
    configurationSchemaVersion: workspaceRegistry.schemaVersion,
    configurationRegistryVersion: workspaceRegistry.registryVersion,
    configurationVersion: workspace.provenance.configurationVersion,
    workspaceId,
    companyId: workspace.companyId,
    lifecycle: workspace.lifecycle,
    operatingProfileId,
    operatingProfileVersion: workspace.operatingProfile.profileVersion,
    industryId: workspace.operatingProfile.industryId,
    territoryId,
    profile: clone(profile),
    dashboard: clone(workspace.dashboard),
    availabilityPolicy: clone(workspace.availabilityPolicy),
    opportunitySources: clone(workspace.opportunitySources),
    fallbackPolicy: clone(workspace.fallbackPolicy),
    safety: Object.freeze({
      collection: workspaceRegistry.safety.collection,
      activeCohorts: workspaceRegistry.safety.activeCohorts,
      recommendationInfluence: workspaceRegistry.safety.recommendationInfluence,
      representativeFacingShadowOutput: false
    })
  });
}
