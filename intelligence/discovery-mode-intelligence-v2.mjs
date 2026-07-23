import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeQueueIdentity } from "./continuous-adaptive-route-replenishment.mjs";
import {
  evaluateRouteBusinessHoursEligibility,
  routeBusinessHoursEligibilityVersion,
  summarizeRouteBusinessHours
} from "./route-business-hours-eligibility.mjs";

export const discoveryModeIntelligenceVersion = "discovery-mode-intelligence-v2";
export const discoveryModePolicyVersion = "discovery-mode-intelligence-v2-policy-v1";
export const discoveryModeContractVersion = "discovery-mode-intelligence-v2-contracts-v1";
export const discoveryModeEligibilityIntegrationRepairVersion = "discovery-mode-eligibility-integration-repair-v1";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");

const defaultPaths = {
  config: "intelligence/config/discovery-mode-intelligence-v2.json",
  contract: "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  learningPolicy: "intelligence/config/read-only-field-session-learning-policy-v1.json",
  learningSnapshot: "intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function normalizedText(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentage(value) {
  return Number((finiteNumber(value) * 100).toFixed(1));
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

function countBy(values, keyOf) {
  const counts = new Map();
  for (const value of values) {
    const key = cleanText(keyOf(value), 120) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return sortedObject(counts.entries());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

function learningSnapshotRepresentativeId(snapshot) {
  const representativeIds = unique((snapshot?.representativeIntelligence || []).map(item => cleanText(item?.representativeId, 80)));
  return cleanText(snapshot?.representativeId, 80) || (representativeIds.length === 1 ? representativeIds[0] : "");
}

function resolveComposition(config, territoryId) {
  const base = config.queueComposition;
  const override = territoryId ? base.territoryOverrides?.[territoryId] : null;
  return {
    targetSize: Math.max(1, Math.floor(finiteNumber(override?.targetSize, base.targetSize))),
    targetDistinctCategories: Math.max(1, Math.floor(finiteNumber(override?.targetDistinctCategories, base.targetDistinctCategories))),
    minimumDistinctCategories: Math.max(1, Math.floor(finiteNumber(override?.minimumDistinctCategories, base.minimumDistinctCategories))),
    categoryConcentration: {
      maximumShare: finiteNumber(override?.categoryConcentration?.maximumShare, base.categoryConcentration.maximumShare),
      maximumCount: Math.max(1, Math.floor(finiteNumber(override?.categoryConcentration?.maximumCount, base.categoryConcentration.maximumCount))),
      maximumConsecutive: Math.max(1, Math.floor(finiteNumber(override?.categoryConcentration?.maximumConsecutive, base.categoryConcentration.maximumConsecutive))),
      enforcement: cleanText(override?.categoryConcentration?.enforcement || base.categoryConcentration.enforcement, 120)
    },
    territoryOverrideApplied: Boolean(override),
    territoryOverrideId: override ? territoryId : null
  };
}

function strictCategoryCap(composition) {
  const shareCap = Math.max(1, Math.floor(composition.targetSize * composition.categoryConcentration.maximumShare));
  return Math.min(composition.categoryConcentration.maximumCount, shareCap);
}

function relaxedCategoryCap(config, composition) {
  const policy = config.queueComposition.relaxationPolicy;
  const shareCap = Math.max(1, Math.floor(composition.targetSize * finiteNumber(policy.maximumRelaxedShare)));
  return Math.min(Math.max(1, Math.floor(finiteNumber(policy.maximumRelaxedCount))), shareCap);
}

export function loadDiscoveryModeConfig(path = defaultPaths.config) {
  return readJson(path);
}

export function loadDiscoveryModeContract(path = defaultPaths.contract) {
  return readJson(path);
}

export function loadDiscoveryModeLearningPolicy(path = defaultPaths.learningPolicy) {
  return readJson(path);
}

export function loadDiscoveryModeLearningSnapshot(path = defaultPaths.learningSnapshot) {
  return readJson(path);
}

export function applyCanonicalBusinessHoursEligibilityToDiscoveryCandidates({
  candidates = [],
  businessHoursIndex = null,
  evaluatedAt = businessHoursIndex?.statusEvaluatedAt,
  artifactAvailable = Boolean(businessHoursIndex),
  workspaceId = "fitness_connection",
  operatingProfileId = "fitness"
} = {}) {
  if (!evaluatedAt) throw new Error("Discovery Mode canonical business-hours evaluation time is required.");
  const recordsByPlaceId = businessHoursIndex?.recordsByPlaceId instanceof Map
    ? businessHoursIndex.recordsByPlaceId
    : new Map();
  const evaluatedCandidates = (Array.isArray(candidates) ? candidates : []).map(candidate => {
    const hoursRecord = recordsByPlaceId.get(cleanText(candidate?.googlePlaceId, 180)) || null;
    const eligibilitySnapshot = evaluateRouteBusinessHoursEligibility({
      record: hoursRecord,
      candidate,
      evaluatedAt,
      policy: businessHoursIndex?.freshnessPolicy,
      artifactAvailable,
      workspaceId,
      operatingProfileId
    });
    return {
      ...clone(candidate),
      routeEligible: eligibilitySnapshot.immediateRecommendationEligible === true,
      eligibilitySnapshot: clone(eligibilitySnapshot)
    };
  });
  const decisions = evaluatedCandidates.map(candidate => candidate.eligibilitySnapshot);
  return deepFreeze({
    version: routeBusinessHoursEligibilityVersion,
    evaluatedAt: new Date(evaluatedAt).toISOString(),
    workspaceId,
    operatingProfileId,
    evaluatedCandidates,
    eligibleCandidates: evaluatedCandidates.filter(candidate => candidate.routeEligible),
    excludedCandidates: evaluatedCandidates.filter(candidate => !candidate.routeEligible),
    summary: summarizeRouteBusinessHours(decisions)
  });
}

function taxonomyIndex(config) {
  const aliases = new Map();
  const families = new Map();
  for (const family of config.categoryTaxonomy?.families || []) {
    const categoryId = cleanText(family.categoryId, 80);
    if (!categoryId) continue;
    const normalizedFamily = {
      categoryId,
      label: cleanText(family.label, 120) || categoryId,
      sourceCategories: unique((family.sourceCategories || []).map(value => cleanText(value, 120)))
    };
    families.set(categoryId, normalizedFamily);
    for (const sourceCategory of normalizedFamily.sourceCategories) {
      aliases.set(normalizedText(sourceCategory), normalizedFamily);
    }
  }
  return { aliases, families };
}

export function normalizeDiscoveryCategory(sourceCategory, config = loadDiscoveryModeConfig()) {
  const { aliases } = taxonomyIndex(config);
  return clone(aliases.get(normalizedText(sourceCategory)) || null);
}

export function validateDiscoveryModeConfig(config) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  const composition = config?.queueComposition || {};
  const concentration = composition.categoryConcentration || {};
  const relaxation = composition.relaxationPolicy || {};
  const { aliases, families } = taxonomyIndex(config || {});
  const aliasCount = (config?.categoryTaxonomy?.families || []).reduce((sum, family) => sum + (family.sourceCategories || []).length, 0);

  fail(config?.policyVersion === discoveryModePolicyVersion, "policy_version_mismatch");
  fail(config?.status === "advisory_only", "policy_must_remain_advisory_only");
  fail(config?.workspaceId === "fitness_connection", "workspace_policy_mismatch");
  fail(config?.operatingProfileId === "fitness", "operating_profile_policy_mismatch");
  fail(config?.candidatePolicy?.requiredSourcePool === "active", "active_pool_must_remain_primary_input");
  fail(config?.candidatePolicy?.requiresExistingRouteEligibility === true, "existing_route_eligibility_must_be_required");
  fail(config?.candidatePolicy?.requiresCanonicalBusinessHoursEligibility === true, "canonical_business_hours_eligibility_must_be_required");
  fail(config?.candidatePolicy?.canonicalEligibilityVersion === routeBusinessHoursEligibilityVersion, "canonical_business_hours_eligibility_version_mismatch");
  fail(config?.candidatePolicy?.preserveEligibilitySelectionTier === true, "business_hours_selection_tier_must_be_preserved");
  fail(config?.candidatePolicy?.closedVerifiedBehavior === "exclude_never_balance", "closed_verified_exclusion_policy_missing");
  fail(config?.candidatePolicy?.uncertainHoursBehavior === "coverage_only_never_select", "uncertain_hours_selection_prohibited");
  fail(config?.candidatePolicy?.eligibilityIntegrationVersion === discoveryModeEligibilityIntegrationRepairVersion, "eligibility_integration_repair_version_mismatch");
  fail(config?.candidatePolicy?.liveGoogleCallsAllowed === false, "live_google_calls_must_remain_disabled");
  fail(Number.isFinite(Number(config?.candidatePolicy?.minimumQualityScore)), "quality_floor_missing");
  fail(Array.isArray(config?.candidatePolicy?.allowedQualityClasses) && config.candidatePolicy.allowedQualityClasses.length > 0, "quality_classes_missing");
  fail(Number.isInteger(composition.targetSize) && composition.targetSize > 0, "queue_target_invalid");
  fail(Number.isInteger(composition.targetDistinctCategories) && composition.targetDistinctCategories > 1, "target_distinct_categories_invalid");
  fail(Number.isInteger(composition.minimumDistinctCategories) && composition.minimumDistinctCategories > 1, "minimum_distinct_categories_invalid");
  fail(composition.targetDistinctCategories >= composition.minimumDistinctCategories, "target_distinct_categories_below_minimum");
  fail(composition.targetDistinctCategories <= composition.targetSize, "target_distinct_categories_exceeds_queue_target");
  fail(composition.minimumDistinctCategories <= composition.targetSize, "minimum_distinct_categories_exceeds_target");
  fail(Number(concentration.maximumShare) > 0 && Number(concentration.maximumShare) < 1, "maximum_category_share_invalid");
  fail(Number.isInteger(concentration.maximumCount) && concentration.maximumCount > 0, "maximum_category_count_invalid");
  fail(Number.isInteger(concentration.maximumConsecutive) && concentration.maximumConsecutive > 0, "maximum_consecutive_invalid");
  fail(composition.fixedCategoryRotation === false, "fixed_category_rotation_prohibited");
  fail(!Object.prototype.hasOwnProperty.call(composition, "rotationOrder"), "rotation_order_prohibited");
  fail(composition.preserveExistingScores === true, "existing_scores_must_be_preserved");
  fail(relaxation.allowQualityFloorRelaxation === false, "quality_floor_relaxation_prohibited");
  fail(relaxation.allowWorkspaceRelaxation === false, "workspace_relaxation_prohibited");
  fail(relaxation.allowDuplicateRelaxation === false, "duplicate_relaxation_prohibited");
  fail(relaxation.allowIneligibleCandidateRelaxation === false, "eligibility_relaxation_prohibited");
  fail(relaxation.allowSingleCategoryTargetFill === false, "single_category_target_fill_prohibited");
  fail(families.size >= composition.minimumDistinctCategories, "taxonomy_cannot_satisfy_minimum_distinct_categories");
  fail(aliases.size === aliasCount, "category_alias_collision_detected");
  fail(config?.evidencePolicy?.thresholdSourcePolicyVersion === "read-only-field-session-learning-policy-v1", "learning_threshold_source_mismatch");
  fail(config?.evidencePolicy?.thresholdDomain === "category", "learning_threshold_domain_mismatch");
  fail(config?.evidencePolicy?.singleSessionCategoryPreferenceAllowed === false, "single_session_category_preference_prohibited");
  fail(Array.isArray(config?.learningObjectives) && config.learningObjectives.length === 9, "learning_objectives_incomplete");
  fail(config?.activationSafety?.recommendationInfluenceActive === false, "recommendation_influence_must_remain_disabled");
  fail(config?.activationSafety?.productionQueueConsumerActive === false, "production_queue_consumer_must_remain_disabled");
  fail(config?.activationSafety?.routeScoringWeightsChanged === false, "route_scoring_weights_must_remain_unchanged");
  fail(config?.activationSafety?.dashboardRuntimeChanged === false, "dashboard_runtime_must_remain_unchanged");
  fail(config?.fieldEvidenceBasis?.learningInput === false, "founder_observation_cannot_become_learning_input");
  return unique(failures);
}

export function validateDiscoveryModeContract(contract) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  fail(contract?.contractVersion === discoveryModeContractVersion, "contract_version_mismatch");
  fail(contract?.status === "advisory_only", "contract_must_remain_advisory_only");
  fail(contract?.scopePolicy?.authorizedWorkspaceId === "fitness_connection", "contract_workspace_mismatch");
  fail(contract?.scopePolicy?.unknownWorkspaceBehavior === "fail_closed", "unknown_workspace_must_fail_closed");
  fail(contract?.scopePolicy?.crossWorkspaceLearning === false, "cross_workspace_learning_prohibited");
  fail(contract?.scopePolicy?.crossWorkspaceInfluence === false, "cross_workspace_influence_prohibited");
  fail(contract?.compositionContract?.fixedRotationAllowed === false, "fixed_rotation_must_be_prohibited");
  fail(contract?.compositionContract?.qualityFloorAuthoritative === true, "quality_floor_must_be_authoritative");
  fail(contract?.compositionContract?.deterministicOrderingRequired === true, "deterministic_ordering_required");
  fail(contract?.compositionContract?.duplicateBusinessesAllowed === false, "duplicate_businesses_prohibited");
  fail(contract?.eligibilityContract?.canonicalImplementation === "intelligence/route-business-hours-eligibility.mjs", "canonical_eligibility_implementation_mismatch");
  fail(contract?.eligibilityContract?.canonicalVersion === routeBusinessHoursEligibilityVersion, "canonical_eligibility_contract_version_mismatch");
  fail(contract?.eligibilityContract?.integrationVersion === discoveryModeEligibilityIntegrationRepairVersion, "eligibility_integration_contract_version_mismatch");
  fail(contract?.eligibilityContract?.closedVerifiedEligible === false, "closed_verified_must_be_ineligible");
  fail(contract?.eligibilityContract?.uncertainImmediateRecommendationEligible === false, "uncertain_hours_must_not_be_immediate_recommendations");
  fail(contract?.eligibilityContract?.balancingOccursAfterEligibility === true, "category_balancing_must_follow_eligibility");
  fail(contract?.outputContract?.runtimeConsumptionAuthorized === false, "runtime_consumption_must_remain_unauthorized");
  fail(contract?.outputContract?.recommendationMutationAuthorized === false, "recommendation_mutation_must_remain_unauthorized");
  fail(contract?.designEvidence?.stressTestObservationConsumedAsLearning === false, "stress_observation_learning_prohibited");
  fail(contract?.activationSafety?.recommendationInfluenceActive === false, "contract_recommendation_influence_must_remain_disabled");
  fail(contract?.activationSafety?.routeScoringWeightsChanged === false, "contract_scoring_weights_must_remain_unchanged");
  fail(contract?.activationSafety?.dashboardRuntimeChanged === false, "contract_dashboard_runtime_must_remain_unchanged");
  fail(Array.isArray(contract?.prohibitions) && contract.prohibitions.includes("no_parallel_runtime_route_queue"), "parallel_runtime_queue_prohibition_missing");
  return unique(failures);
}

export function assertDiscoveryModeScope({ workspaceId, operatingProfileId, representativeId, contract }) {
  const scopedWorkspace = cleanText(workspaceId, 80);
  const scopedProfile = cleanText(operatingProfileId, 80);
  const scopedRepresentative = cleanText(representativeId, 80);
  if (scopedWorkspace !== contract.scopePolicy.authorizedWorkspaceId) {
    throw new Error(`Discovery Mode v2 is not authorized for workspace: ${scopedWorkspace || "unknown"}`);
  }
  if (scopedProfile !== contract.scopePolicy.authorizedOperatingProfileId) {
    throw new Error(`Discovery Mode v2 operating profile mismatch: ${scopedProfile || "unknown"}`);
  }
  if (!contract.scopePolicy.authorizedRepresentativeIds.includes(scopedRepresentative)) {
    throw new Error(`Discovery Mode v2 representative is not authorized: ${scopedRepresentative || "unknown"}`);
  }
  return { workspaceId: scopedWorkspace, operatingProfileId: scopedProfile, representativeId: scopedRepresentative };
}

function thresholdChecks(metrics, confidenceScore, thresholds) {
  const fields = [
    ["verifiedSessions", "minimumVerifiedSessions"],
    ["visits", "minimumVisits"],
    ["conversations", "minimumConversations"],
    ["leads", "minimumLeads"],
    ["memberships", "minimumMemberships"]
  ];
  const checks = fields.map(([metric, threshold]) => ({
    metric,
    actual: metrics[metric],
    required: finiteNumber(thresholds[threshold]),
    met: metrics[metric] !== null && finiteNumber(metrics[metric]) >= finiteNumber(thresholds[threshold])
  }));
  checks.push({
    metric: "confidence",
    actual: confidenceScore,
    required: finiteNumber(thresholds.minimumConfidence),
    met: confidenceScore >= finiteNumber(thresholds.minimumConfidence)
  });
  return checks;
}

function evidenceModel(config, learningPolicy, learningSnapshot, context) {
  if (learningPolicy.policyVersion !== config.evidencePolicy.thresholdSourcePolicyVersion) {
    throw new Error("Discovery Mode v2 learning policy version mismatch.");
  }
  if (learningPolicy.workspaceId !== context.workspaceId || learningPolicy.operatingProfileId !== context.operatingProfileId) {
    throw new Error("Discovery Mode v2 learning policy scope mismatch.");
  }
  if (learningSnapshot.workspaceId !== context.workspaceId
    || learningSnapshot.operatingProfileId !== context.operatingProfileId
    || learningSnapshotRepresentativeId(learningSnapshot) !== context.representativeId) {
    throw new Error("Discovery Mode v2 learning snapshot scope mismatch.");
  }
  if (learningSnapshot.recommendationSafety?.recommendationInfluenceActive !== false
    || learningSnapshot.recommendationSafety?.routeScoringWeightsChanged !== false) {
    throw new Error("Discovery Mode v2 requires a non-influencing read-only learning snapshot.");
  }

  const taxonomy = taxonomyIndex(config);
  const thresholds = learningPolicy.evidenceThresholds?.[config.evidencePolicy.thresholdDomain];
  if (!thresholds) throw new Error("Discovery Mode v2 category evidence thresholds are unavailable.");
  const accumulators = new Map();
  for (const family of taxonomy.families.values()) {
    accumulators.set(family.categoryId, {
      ...family,
      sourceEvidenceCategories: [],
      evidenceUsed: new Set(),
      metrics: { verifiedSessions: 0, visits: 0, conversations: 0, leads: 0, memberships: null, units: 0, laterUnits: 0 },
      confidenceScores: [],
      lastUpdated: null
    });
  }

  for (const conclusion of learningSnapshot.categoryIntelligence || []) {
    const family = taxonomy.aliases.get(normalizedText(conclusion.category));
    if (!family) continue;
    const target = accumulators.get(family.categoryId);
    target.sourceEvidenceCategories.push(cleanText(conclusion.category, 120));
    for (const evidenceId of conclusion.explainability?.evidenceUsed || []) target.evidenceUsed.add(evidenceId);
    target.metrics.visits += finiteNumber(conclusion.metrics?.visits);
    target.metrics.conversations += finiteNumber(conclusion.metrics?.conversations);
    target.metrics.leads += finiteNumber(conclusion.metrics?.leads);
    target.metrics.units += finiteNumber(conclusion.metrics?.units);
    target.metrics.laterUnits += finiteNumber(conclusion.metrics?.laterUnits);
    if (conclusion.metrics?.memberships !== null && conclusion.metrics?.memberships !== undefined) {
      target.metrics.memberships = finiteNumber(target.metrics.memberships) + finiteNumber(conclusion.metrics.memberships);
    }
    target.confidenceScores.push(finiteNumber(conclusion.confidence?.score));
    const updated = cleanText(conclusion.explainability?.lastUpdated, 40);
    if (updated && (!target.lastUpdated || updated > target.lastUpdated)) target.lastUpdated = updated;
  }

  return new Map([...accumulators.entries()].map(([categoryId, accumulator]) => {
    accumulator.metrics.verifiedSessions = accumulator.evidenceUsed.size;
    const confidenceScore = accumulator.confidenceScores.length ? Math.max(...accumulator.confidenceScores) : 0;
    const checks = thresholdChecks(accumulator.metrics, confidenceScore, thresholds);
    const thresholdQualified = checks.every(check => check.met);
    const maturity = accumulator.metrics.visits === 0
      ? "unobserved"
      : thresholdQualified
        ? "threshold_qualified"
        : "emerging";
    const territoryMetric = context.territoryId
      ? context.territoryCategoryEvidence?.[context.territoryId]?.[categoryId] || null
      : null;
    return [categoryId, {
      categoryId,
      label: accumulator.label,
      sourceCategories: accumulator.sourceCategories,
      sourceEvidenceCategories: unique(accumulator.sourceEvidenceCategories),
      metrics: accumulator.metrics,
      confidence: {
        score: Number(confidenceScore.toFixed(4)),
        band: maturity === "unobserved" ? "unobserved" : thresholdQualified ? "threshold_qualified" : "insufficient_evidence",
        thresholdQualified,
        checks,
        limitingFactors: checks.filter(check => !check.met).map(check => `${check.metric}_below_threshold`)
      },
      maturity,
      maturityRank: maturity === "unobserved" ? 0 : maturity === "emerging" ? 1 : 2,
      evidenceUsed: [...accumulator.evidenceUsed].sort(),
      lastUpdated: accumulator.lastUpdated || learningSnapshot.generatedAt,
      territoryEvidence: territoryMetric,
      territoryVisitCount: finiteNumber(territoryMetric?.visits),
      applicableWorkspace: context.workspaceId,
      applicableRepresentative: context.representativeId,
      applicableTerritory: context.territoryId || null
    }];
  }));
}

function normalizeCandidates(candidates, config, context) {
  const taxonomy = taxonomyIndex(config);
  const allowedClasses = new Set(config.candidatePolicy.allowedQualityClasses);
  const candidateLimit = Math.max(1, Math.floor(finiteNumber(config.candidatePolicy.maximumCandidateScan, 5000)));
  const failures = [];
  const duplicates = [];
  const accepted = [];
  const seen = new Set();
  const source = (Array.isArray(candidates) ? candidates : [])
    .slice(0, candidateLimit)
    .sort((left, right) => finiteNumber(left?.eligibilitySnapshot?.selectionTier, 99) - finiteNumber(right?.eligibilitySnapshot?.selectionTier, 99)
      || finiteNumber(right?.qualityScore) - finiteNumber(left?.qualityScore)
      || finiteNumber(left?.seedRouteOrder, 999999) - finiteNumber(right?.seedRouteOrder, 999999)
      || routeQueueIdentity(left).localeCompare(routeQueueIdentity(right)));

  for (const candidate of source) {
    const candidateId = cleanText(candidate?.id, 160);
    const identityKey = cleanText(routeQueueIdentity(candidate), 600);
    const sourceCategory = cleanText(candidate?.sourceCategory || candidate?.category, 120);
    const family = taxonomy.aliases.get(normalizedText(sourceCategory));
    const eligibility = candidate?.eligibilitySnapshot;
    const reason = !candidateId
      ? "missing_candidate_id"
      : !identityKey
        ? "missing_stable_business_identity"
        : cleanText(candidate?.workspaceId, 80) !== context.workspaceId
          ? "workspace_mismatch"
          : cleanText(candidate?.operatingProfileId, 80) !== context.operatingProfileId
            ? "operating_profile_mismatch"
            : candidate?.representativeId && cleanText(candidate.representativeId, 80) !== context.representativeId
              ? "representative_mismatch"
              : candidate?.sourcePool !== config.candidatePolicy.requiredSourcePool
                ? "non_active_pool_candidate"
                : !eligibility || typeof eligibility !== "object"
                  ? "canonical_business_hours_eligibility_missing"
                  : eligibility.version !== config.candidatePolicy.canonicalEligibilityVersion
                    ? "canonical_business_hours_eligibility_version_mismatch"
                    : eligibility.workspaceId !== context.workspaceId || eligibility.operatingProfileId !== context.operatingProfileId
                      ? "canonical_business_hours_eligibility_scope_mismatch"
                      : eligibility.googlePlaceId && cleanText(eligibility.googlePlaceId, 180) !== cleanText(candidate.googlePlaceId, 180)
                        ? "canonical_business_hours_eligibility_identity_mismatch"
                        : eligibility.status === "CLOSED_VERIFIED"
                          ? "closed_verified_excluded"
                          : eligibility.immediateRecommendationEligible !== true || candidate?.routeEligible !== true
                            ? "canonical_business_hours_ineligible"
                            : eligibility.scoringChanged !== false
                              ? "canonical_business_hours_scoring_changed"
                              : !eligibility.reasonCode || !eligibility.reason || !eligibility.explanation || !eligibility.provenance
                                ? "canonical_business_hours_provenance_incomplete"
                  : !allowedClasses.has(cleanText(candidate?.qualityClass, 80))
                    ? "quality_class_not_allowed"
                    : finiteNumber(candidate?.qualityScore, -Infinity) < finiteNumber(config.candidatePolicy.minimumQualityScore)
                      ? "below_quality_floor"
                      : !family
                        ? "unknown_category"
                        : null;
    if (reason) {
      failures.push({ candidateId: candidateId || null, reason, sourceCategory: sourceCategory || null });
      continue;
    }
    if (seen.has(identityKey)) {
      duplicates.push({ candidateId, identityKey, reason: "duplicate_identity_excluded" });
      continue;
    }
    seen.add(identityKey);
    accepted.push({
      candidateId,
      identityKey,
      googlePlaceId: cleanText(candidate.googlePlaceId, 180) || null,
      businessName: cleanText(candidate.name || candidate.businessName, 180),
      sourceCategory,
      categoryId: family.categoryId,
      categoryLabel: family.label,
      qualityClass: cleanText(candidate.qualityClass, 80),
      qualityScoreSnapshot: finiteNumber(candidate.qualityScore),
      existingRouteOrder: Math.max(0, Math.floor(finiteNumber(candidate.seedRouteOrder, 999999))),
      sourcePool: candidate.sourcePool,
      territoryId: cleanText(candidate.territoryId, 120) || null,
      timeWindow: cleanText(candidate.window || candidate.timeWindow, 80) || "Anytime",
      existingQualityReason: cleanText(candidate.qualityReason, 700),
      eligibilitySnapshot: clone(eligibility),
      existingScoreChanged: false
    });
  }

  return {
    accepted,
    duplicates,
    failures,
    scannedCount: source.length,
    truncated: Array.isArray(candidates) && candidates.length > candidateLimit
  };
}

function categoryGroups(candidates, evidence) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!groups.has(candidate.categoryId)) {
      groups.set(candidate.categoryId, {
        categoryId: candidate.categoryId,
        label: candidate.categoryLabel,
        candidates: [],
        selectedCount: 0,
        evidence: evidence.get(candidate.categoryId)
      });
    }
    groups.get(candidate.categoryId).candidates.push(candidate);
  }
  for (const group of groups.values()) {
    group.candidates.sort((left, right) => finiteNumber(left.eligibilitySnapshot?.selectionTier, 99) - finiteNumber(right.eligibilitySnapshot?.selectionTier, 99)
      || right.qualityScoreSnapshot - left.qualityScoreSnapshot
      || left.existingRouteOrder - right.existingRouteOrder
      || left.identityKey.localeCompare(right.identityKey));
  }
  return groups;
}

function selectGroup(groups, entries, composition, countCap, ignoreConsecutive = false) {
  const lastEntry = entries.at(-1);
  let consecutive = 0;
  for (let index = entries.length - 1; index >= 0 && entries[index].categoryId === lastEntry?.categoryId; index -= 1) consecutive += 1;
  const allRemaining = [...groups.values()].filter(group => group.candidates.length > 0);
  const minimumEligibilityTier = Math.min(...allRemaining.map(group => finiteNumber(group.candidates[0]?.eligibilitySnapshot?.selectionTier, 99)));
  let options = allRemaining.filter(group => group.selectedCount < countCap
    && finiteNumber(group.candidates[0]?.eligibilitySnapshot?.selectionTier, 99) === minimumEligibilityTier);
  if (!ignoreConsecutive && consecutive >= composition.categoryConcentration.maximumConsecutive) {
    options = options.filter(group => group.categoryId !== lastEntry?.categoryId);
  }
  if (!options.length) return null;

  const distinct = new Set(entries.map(entry => entry.categoryId));
  if (distinct.size < composition.targetDistinctCategories) {
    const unrepresented = options.filter(group => !distinct.has(group.categoryId));
    if (unrepresented.length) options = unrepresented;
  }

  options.sort((left, right) => left.selectedCount - right.selectedCount
    || finiteNumber(left.evidence?.maturityRank, 0) - finiteNumber(right.evidence?.maturityRank, 0)
    || finiteNumber(left.evidence?.territoryVisitCount, 0) - finiteNumber(right.evidence?.territoryVisitCount, 0)
    || finiteNumber(right.candidates[0]?.qualityScoreSnapshot) - finiteNumber(left.candidates[0]?.qualityScoreSnapshot)
    || left.categoryId.localeCompare(right.categoryId));
  return options[0];
}

function explanationFor(entry, evidence, categoryCount, strictCap, context) {
  const evidenceText = evidence.metrics.visits > 0
    ? `${evidence.metrics.visits} authorized verified ${evidence.label} visits, ${evidence.metrics.conversations} conversations, and ${evidence.metrics.leads} leads are available across ${evidence.metrics.verifiedSessions} session${evidence.metrics.verifiedSessions === 1 ? "" : "s"}.`
    : `No authorized verified ${evidence.label} visit evidence is available yet.`;
  const changed = evidence.metrics.visits > 0
    ? `The latest authorized snapshot added ${evidence.metrics.visits} ${evidence.label} visits, but the category remains ${evidence.maturity.replaceAll("_", " ")}.`
    : `${evidence.label} remains unobserved in the authorized learning snapshot, so no performance conclusion has been declared.`;
  const territoryText = context.territoryId
    ? `The plan is scoped to verified territory ${context.territoryId}.`
    : "Territory variation is unavailable because no verified territory identity is present; no territory was inferred.";
  const hours = entry.eligibilitySnapshot;
  const hoursText = `${hours.displayLabel}. ${hours.reason} Hours confidence is ${hours.hoursConfidence}; freshness is ${hours.hoursFreshness}; status was evaluated for ${hours.businessTimezone || "the governed business timezone"}.`;
  return {
    why: `${entry.businessName} remains above the governed quality floor and adds ${evidence.label} coverage while that category occupies ${categoryCount} of the configured ${strictCap}-stop concentration limit.`,
    evidence: `${evidenceText} ${territoryText} Business-hours eligibility: ${hoursText}`,
    confidence: `Category evidence is ${evidence.confidence.band.replaceAll("_", " ")} with confidence ${percentage(evidence.confidence.score)}%. This is an exploration-confidence statement, not a production score change.`,
    whatChanged: changed,
    nextAction: "Visit only if the existing route eligibility still holds, then record decision-maker access, conversation quality, lead quality, membership outcome, follow-up need, and objections.",
    internalFormulaExposed: false,
    proprietaryWeightsExposed: false
  };
}

function learningObjectiveStatus(objective, learningSnapshot, context) {
  const territoryAvailable = Boolean(context.territoryId);
  const membershipsAvailable = (learningSnapshot.categoryIntelligence || []).some(item => item.metrics?.memberships !== null && item.metrics?.memberships !== undefined);
  if (objective === "territory_performance" && !territoryAvailable) return "blocked_until_verified_territory_identity";
  if (objective === "membership_conversion" && !membershipsAvailable) return "blocked_until_canonical_membership_evidence";
  return "future_measurement_coverage_enabled";
}

export function buildDiscoveryModeAdvisoryPlan({
  candidates = [],
  config = loadDiscoveryModeConfig(),
  contract = loadDiscoveryModeContract(),
  learningPolicy = loadDiscoveryModeLearningPolicy(),
  learningSnapshot = loadDiscoveryModeLearningSnapshot(),
  workspaceId = config.workspaceId,
  operatingProfileId = config.operatingProfileId,
  representativeId = learningSnapshotRepresentativeId(learningSnapshot),
  territoryId = null,
  territoryCategoryEvidence = {},
  generatedAt = learningSnapshot.generatedAt,
  sourceProvenance = {}
} = {}) {
  const configFailures = validateDiscoveryModeConfig(config);
  const contractFailures = validateDiscoveryModeContract(contract);
  if (configFailures.length || contractFailures.length) {
    throw new Error(`Discovery Mode v2 policy invalid: ${configFailures.concat(contractFailures).join(",")}`);
  }
  const scope = assertDiscoveryModeScope({ workspaceId, operatingProfileId, representativeId, contract });
  const context = { ...scope, territoryId: cleanText(territoryId, 120) || null, territoryCategoryEvidence };
  const composition = resolveComposition(config, context.territoryId);
  if (composition.minimumDistinctCategories > composition.targetSize) throw new Error("Discovery Mode v2 effective composition is invalid.");
  const evidence = evidenceModel(config, learningPolicy, learningSnapshot, context);
  const normalized = normalizeCandidates(candidates, config, context);
  const groups = categoryGroups(normalized.accepted, evidence);
  const strictCap = strictCategoryCap(composition);
  const relaxedCap = relaxedCategoryCap(config, composition);
  const entries = [];
  const relaxations = [];
  const relaxationPolicy = config.queueComposition.relaxationPolicy;

  while (entries.length < composition.targetSize) {
    let group = selectGroup(groups, entries, composition, strictCap, false);
    if (!group && relaxationPolicy.allowConsecutiveLimitRelaxation) {
      group = selectGroup(groups, entries, composition, strictCap, true);
      if (group && !relaxations.some(item => item.code === "maximum_consecutive_relaxed")) {
        relaxations.push({ code: "maximum_consecutive_relaxed", reason: "No qualified category could satisfy the consecutive-category limit." });
      }
    }
    if (!group && relaxationPolicy.allowConcentrationRelaxation) {
      group = selectGroup(groups, entries, composition, relaxedCap, true);
      if (group && !relaxations.some(item => item.code === "category_concentration_relaxed")) {
        relaxations.push({
          code: "category_concentration_relaxed",
          reason: "Qualified category supply could not fill the target within the strict concentration cap.",
          strictCap,
          relaxedCap
        });
      }
    }
    if (!group) break;
    const candidate = group.candidates.shift();
    group.selectedCount += 1;
    entries.push({ ...candidate, position: entries.length + 1 });
  }

  const categoryCounts = countBy(entries, entry => entry.categoryId);
  const sourceCategoryCounts = countBy(entries, entry => entry.sourceCategory);
  const availableCategoryIds = [...groups.keys()].sort();
  const distinctCategoryCount = Object.keys(categoryCounts).length;
  const maximumCategoryCount = Math.max(0, ...Object.values(categoryCounts));
  const maximumCategoryShare = entries.length ? maximumCategoryCount / entries.length : 0;
  const selectedQualityScores = entries.map(entry => entry.qualityScoreSnapshot);
  const acceptedQualityScores = normalized.accepted.map(entry => entry.qualityScoreSnapshot);
  const selectedEligibilityStatuses = countBy(entries, entry => entry.eligibilitySnapshot.status);
  const selectedEligibilityTiers = countBy(entries, entry => String(entry.eligibilitySnapshot.selectionTier));
  const queueWithExplanations = entries.map(entry => ({
    ...entry,
    evidenceMaturity: evidence.get(entry.categoryId).maturity,
    explanation: explanationFor(entry, evidence.get(entry.categoryId), categoryCounts[entry.categoryId], strictCap, context)
  }));
  const unavailableCategories = [...taxonomyIndex(config).families.values()]
    .filter(family => !availableCategoryIds.includes(family.categoryId))
    .map(family => ({ categoryId: family.categoryId, label: family.label, reason: "no_qualified_active_pool_supply" }));
  const failureReasons = [];
  if (!entries.length) failureReasons.push("no_qualified_discovery_candidates");
  if (entries.length < composition.targetSize) failureReasons.push("queue_target_not_met_within_governed_constraints");
  if (distinctCategoryCount < composition.minimumDistinctCategories) failureReasons.push("minimum_distinct_categories_unavailable");
  if (distinctCategoryCount < composition.targetDistinctCategories) failureReasons.push("target_distinct_categories_unavailable");
  if (!context.territoryId) failureReasons.push("territory_variation_unavailable_no_verified_identity");
  if (unavailableCategories.length) failureReasons.push("configured_categories_without_active_pool_supply");

  const evidenceSummary = [...evidence.values()].map(item => ({
    categoryId: item.categoryId,
    label: item.label,
    maturity: item.maturity,
    metrics: item.metrics,
    confidence: item.confidence,
    evidenceUsed: item.evidenceUsed,
    lastUpdated: item.lastUpdated,
    applicableWorkspace: item.applicableWorkspace,
    applicableRepresentative: item.applicableRepresentative,
    applicableTerritory: item.applicableTerritory
  }));
  const status = entries.length === composition.targetSize
    ? "active_advisory_plan"
    : entries.length
      ? "depleted_advisory_plan"
      : "exhausted_advisory_plan";

  const plan = {
    artifactType: "discovery_mode_advisory_queue_plan",
    version: discoveryModeIntelligenceVersion,
    policyVersion: config.policyVersion,
    contractVersion: contract.contractVersion,
    eligibilityIntegrationVersion: discoveryModeEligibilityIntegrationRepairVersion,
    status,
    generatedAt: cleanText(generatedAt, 40),
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    territoryId: context.territoryId,
    sourceProvenance: clone(sourceProvenance),
    fieldEvidenceBasis: clone(config.fieldEvidenceBasis),
    discoveryQueueArchitecture: {
      inputBoundary: "post_governance_canonical_business_hours_eligible_candidates",
      candidateSource: config.candidatePolicy.requiredSourcePool,
      eligibilityImplementation: contract.eligibilityContract.canonicalImplementation,
      eligibilityVersion: routeBusinessHoursEligibilityVersion,
      balancingOccursAfterEligibility: true,
      existingScores: "immutable_input_snapshots",
      learningSource: config.evidencePolicy.authorizedSnapshotPath,
      composition: "deterministic_bounded_constraints",
      runtimeQueueCreated: false,
      futureIntegrationTarget: contract.existingSystemReuse.continuousRouteQueue
    },
    categoryBalancingStrategy: {
      fixedRotation: false,
      targetSize: composition.targetSize,
      targetDistinctCategories: composition.targetDistinctCategories,
      minimumDistinctCategories: composition.minimumDistinctCategories,
      strictCategoryCap: strictCap,
      strictMaximumShare: composition.categoryConcentration.maximumShare,
      maximumConsecutive: composition.categoryConcentration.maximumConsecutive,
      selectionPrecedence: clone(config.queueComposition.selectionPrecedence),
      territoryOverrideApplied: composition.territoryOverrideApplied,
      territoryOverrideId: composition.territoryOverrideId,
      relaxationPolicy: clone(config.queueComposition.relaxationPolicy)
    },
    evidenceThresholds: {
      sourcePolicy: learningPolicy.policyVersion,
      domain: config.evidencePolicy.thresholdDomain,
      thresholds: clone(learningPolicy.evidenceThresholds[config.evidencePolicy.thresholdDomain]),
      categoryEvidence: evidenceSummary,
      singleSessionCategoryPreferenceAllowed: false,
      territoryStatus: context.territoryId ? "verified_identity_supplied" : "unavailable_no_verified_identity"
    },
    learningImpact: {
      observedEvidenceCategoryCount: evidenceSummary.filter(item => item.metrics.visits > 0).length,
      plannedCategoryCount: distinctCategoryCount,
      prospectiveCategoryCoverageDelta: Math.max(0, distinctCategoryCount - evidenceSummary.filter(item => item.metrics.visits > 0).length),
      objectives: config.learningObjectives.map(objective => ({
        objective,
        status: learningObjectiveStatus(objective, learningSnapshot, context)
      })),
      productionLearningActivated: false,
      recommendationInfluenceActive: false
    },
    explainabilityModel: {
      requiredQuestions: clone(config.explainability.requiredQuestions),
      naturalLanguageRequired: true,
      internalFormulaExposureAllowed: false,
      proprietaryWeightExposureAllowed: false,
      constraintRelaxationsDisclosed: true
    },
    configurationModel: {
      configurationDriven: true,
      policyPath: defaultPaths.config,
      categoryFamilyCount: config.categoryTaxonomy.families.length,
      territoryOverridesConfigured: Object.keys(config.queueComposition.territoryOverrides || {}).length,
      unknownCategoryBehavior: config.candidatePolicy.unknownCategoryBehavior,
      qualityFloorRelaxationAllowed: false
    },
    queuePlan: {
      status,
      targetSize: composition.targetSize,
      plannedSize: queueWithExplanations.length,
      entries: queueWithExplanations,
      categoryDistribution: categoryCounts,
      sourceCategoryDistribution: sourceCategoryCounts,
      availableCategoryIds,
      unavailableCategories,
      relaxations,
      failureReasons: unique(failureReasons),
      candidateValidation: {
        scannedCount: normalized.scannedCount,
        acceptedCount: normalized.accepted.length,
        rejectedCount: normalized.failures.length,
        duplicateCount: normalized.duplicates.length,
        inputTruncated: normalized.truncated,
        rejectionReasons: countBy(normalized.failures, item => item.reason)
      },
      eligibilityMetrics: {
        canonicalVersion: routeBusinessHoursEligibilityVersion,
        selectedStatusDistribution: selectedEligibilityStatuses,
        selectedTierDistribution: selectedEligibilityTiers,
        selectedCoverageOnlyCount: entries.filter(entry => entry.eligibilitySnapshot.coverageOnly).length,
        selectedClosedVerifiedCount: entries.filter(entry => entry.eligibilitySnapshot.status === "CLOSED_VERIFIED").length,
        scoringChanged: entries.some(entry => entry.eligibilitySnapshot.scoringChanged !== false)
      },
      compositionMetrics: {
        distinctCategoryCount,
        targetDistinctCategoriesSatisfied: distinctCategoryCount >= composition.targetDistinctCategories,
        maximumCategoryCount,
        maximumCategoryShare: Number(maximumCategoryShare.toFixed(4)),
        strictConcentrationSatisfied: maximumCategoryCount <= strictCap,
        minimumDistinctCategoriesSatisfied: distinctCategoryCount >= composition.minimumDistinctCategories,
        duplicateCount: queueWithExplanations.length - new Set(queueWithExplanations.map(entry => entry.identityKey)).size
      },
      qualityMetrics: {
        configuredMinimumQualityScore: config.candidatePolicy.minimumQualityScore,
        minimumSelectedQualityScore: selectedQualityScores.length ? Math.min(...selectedQualityScores) : null,
        averageSelectedQualityScore: selectedQualityScores.length
          ? Number((selectedQualityScores.reduce((sum, value) => sum + value, 0) / selectedQualityScores.length).toFixed(2))
          : null,
        averageAcceptedQualityScore: acceptedQualityScores.length
          ? Number((acceptedQualityScores.reduce((sum, value) => sum + value, 0) / acceptedQualityScores.length).toFixed(2))
          : null,
        existingScoresChanged: false,
        qualityFloorRelaxed: false
      }
    },
    validation: {
      deterministicOrderingRequired: true,
      activePoolOnly: queueWithExplanations.every(entry => entry.sourcePool === "active"),
      existingRouteEligibilityRequired: true,
      immediateRecommendationEligibilityRequired: true,
      canonicalBusinessHoursEligibilityRequired: true,
      canonicalBusinessHoursEligibilityPreserved: queueWithExplanations.every(entry => entry.eligibilitySnapshot?.version === routeBusinessHoursEligibilityVersion),
      closedVerifiedExcluded: queueWithExplanations.every(entry => entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"),
      conservativeCoverageTierPreserved: queueWithExplanations.every(entry => Number.isInteger(entry.eligibilitySnapshot?.selectionTier)),
      eligibilityProvenancePreserved: queueWithExplanations.every(entry => entry.eligibilitySnapshot?.reasonCode
        && entry.eligibilitySnapshot?.reason
        && entry.eligibilitySnapshot?.explanation
        && entry.eligibilitySnapshot?.provenance
        && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "hoursConfidence")
        && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "hoursFreshness")
        && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "businessTimezone")),
      duplicatePreventionPassed: queueWithExplanations.length === new Set(queueWithExplanations.map(entry => entry.identityKey)).size,
      workspaceIsolationPassed: true,
      operatingProfileIsolationPassed: true,
      qualityFloorPassed: selectedQualityScores.every(score => score >= config.candidatePolicy.minimumQualityScore),
      existingScoresPreserved: queueWithExplanations.every(entry => entry.existingScoreChanged === false),
      explanationsComplete: queueWithExplanations.every(entry => config.explainability.requiredQuestions.every(field => Boolean(entry.explanation[field]))),
      territoryInferencePerformed: false,
      recommendationInfluenceActive: false,
      productionQueueConsumerActive: false,
      routeScoringWeightsChanged: false,
      dashboardRuntimeChanged: false,
      dataChanged: false,
      crmChanged: false,
      companionChanged: false,
      websiteChanged: false
    }
  };
  return deepFreeze(plan);
}

export function validateDiscoveryModeAdvisoryPlan(plan, config = loadDiscoveryModeConfig()) {
  const failures = [];
  const fail = (condition, reason) => { if (!condition) failures.push(reason); };
  const entries = plan?.queuePlan?.entries || [];
  const metrics = plan?.queuePlan?.compositionMetrics || {};
  const eligibility = plan?.queuePlan?.eligibilityMetrics || {};
  const quality = plan?.queuePlan?.qualityMetrics || {};
  const validation = plan?.validation || {};
  const requiredSections = [
    "discoveryQueueArchitecture",
    "categoryBalancingStrategy",
    "evidenceThresholds",
    "learningImpact",
    "explainabilityModel",
    "configurationModel",
    "queuePlan",
    "validation"
  ];
  fail(plan?.artifactType === "discovery_mode_advisory_queue_plan", "artifact_type_mismatch");
  fail(plan?.version === discoveryModeIntelligenceVersion, "plan_version_mismatch");
  fail(plan?.eligibilityIntegrationVersion === discoveryModeEligibilityIntegrationRepairVersion, "plan_eligibility_integration_version_mismatch");
  fail(plan?.workspaceId === config.workspaceId, "plan_workspace_mismatch");
  fail(plan?.operatingProfileId === config.operatingProfileId, "plan_operating_profile_mismatch");
  for (const section of requiredSections) fail(Boolean(plan?.[section]), `missing_section:${section}`);
  fail(plan?.categoryBalancingStrategy?.fixedRotation === false, "plan_fixed_rotation_prohibited");
  fail(entries.length <= config.queueComposition.targetSize, "plan_exceeds_target_size");
  fail(entries.length === new Set(entries.map(entry => entry.identityKey)).size, "plan_contains_duplicate_businesses");
  fail(entries.every(entry => entry.sourcePool === "active"), "plan_contains_non_active_candidate");
  fail(entries.every(entry => entry.eligibilitySnapshot?.version === routeBusinessHoursEligibilityVersion), "plan_contains_noncanonical_eligibility");
  fail(entries.every(entry => entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"), "plan_contains_closed_verified_candidate");
  fail(entries.every(entry => entry.eligibilitySnapshot?.scoringChanged === false), "plan_eligibility_changed_score");
  fail(entries.every(entry => entry.qualityScoreSnapshot >= config.candidatePolicy.minimumQualityScore), "plan_below_quality_floor");
  fail(entries.every(entry => entry.existingScoreChanged === false), "plan_changed_existing_score");
  fail(entries.every(entry => config.explainability.requiredQuestions.every(field => Boolean(entry.explanation?.[field]))), "plan_explanation_incomplete");
  fail(metrics.duplicateCount === 0, "plan_duplicate_metric_failed");
  fail(eligibility.canonicalVersion === routeBusinessHoursEligibilityVersion, "plan_eligibility_metric_version_mismatch");
  fail(eligibility.selectedClosedVerifiedCount === 0, "plan_closed_verified_metric_failed");
  fail(eligibility.scoringChanged === false, "plan_eligibility_scoring_metric_failed");
  fail(quality.existingScoresChanged === false, "quality_score_preservation_failed");
  fail(quality.qualityFloorRelaxed === false, "quality_floor_relaxed");
  for (const field of [
    "activePoolOnly",
    "existingRouteEligibilityRequired",
    "immediateRecommendationEligibilityRequired",
    "canonicalBusinessHoursEligibilityRequired",
    "canonicalBusinessHoursEligibilityPreserved",
    "closedVerifiedExcluded",
    "conservativeCoverageTierPreserved",
    "eligibilityProvenancePreserved",
    "duplicatePreventionPassed",
    "workspaceIsolationPassed",
    "operatingProfileIsolationPassed",
    "qualityFloorPassed",
    "existingScoresPreserved",
    "explanationsComplete"
  ]) fail(validation[field] === true, `validation_failed:${field}`);
  for (const field of [
    "territoryInferencePerformed",
    "recommendationInfluenceActive",
    "productionQueueConsumerActive",
    "routeScoringWeightsChanged",
    "dashboardRuntimeChanged",
    "dataChanged",
    "crmChanged",
    "companionChanged",
    "websiteChanged"
  ]) fail(validation[field] === false, `protected_behavior_changed:${field}`);
  return unique(failures);
}
