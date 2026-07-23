import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCanonicalBusinessHoursEligibilityToDiscoveryCandidates,
  buildDiscoveryModeAdvisoryPlan,
  loadDiscoveryModeConfig,
  loadDiscoveryModeContract,
  loadDiscoveryModeLearningPolicy,
  loadDiscoveryModeLearningSnapshot,
  validateDiscoveryModeAdvisoryPlan,
  validateDiscoveryModeConfig,
  validateDiscoveryModeContract
} from "../intelligence/discovery-mode-intelligence-v2.mjs";
import {
  buildRouteBusinessHoursIndex,
  routeBusinessHoursEligibilityVersion
} from "../intelligence/route-business-hours-eligibility.mjs";
import { expandActivePool } from "./lib/route-intelligence-quality-gate.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");

export const discoveryModeVerificationPaths = {
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  governanceReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json",
  runtimeProjection: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  businessHoursArtifact: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
  canonicalArtifact: "intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json"
};

const christianBrothersPlaceId = "ChIJiduac7LCQIYR-sGBtIAjKR0";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(repoRoot, relativePath))).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(value);
}

export function projectActivePoolCandidatesWithCanonicalEligibility(activePool, representativeId, businessHoursArtifact) {
  const { routeRecords, skipped } = expandActivePool(activePool);
  const businessHoursIndex = buildRouteBusinessHoursIndex(businessHoursArtifact);
  const baseCandidates = routeRecords
    .filter(record => record.repProfileId === representativeId)
    .map(record => ({
      ...record,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId,
      sourcePool: "active"
    }));
  const projection = applyCanonicalBusinessHoursEligibilityToDiscoveryCandidates({
    candidates: baseCandidates,
    businessHoursIndex,
    evaluatedAt: businessHoursArtifact.statusEvaluatedAt,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness"
  });
  return {
    ...projection,
    skipped
  };
}

export function buildCanonicalDiscoveryModeEligibilityProjection() {
  const activePool = readJson(discoveryModeVerificationPaths.activePool);
  const businessHoursArtifact = readJson(discoveryModeVerificationPaths.businessHoursArtifact);
  const learningSnapshot = loadDiscoveryModeLearningSnapshot();
  const representativeId = learningSnapshot.representativeIntelligence?.[0]?.representativeId;
  return projectActivePoolCandidatesWithCanonicalEligibility(activePool, representativeId, businessHoursArtifact);
}

export function buildCanonicalDiscoveryModePlan() {
  const config = loadDiscoveryModeConfig();
  const contract = loadDiscoveryModeContract();
  const learningPolicy = loadDiscoveryModeLearningPolicy();
  const learningSnapshot = loadDiscoveryModeLearningSnapshot();
  const activePool = readJson(discoveryModeVerificationPaths.activePool);
  const governanceReport = readJson(discoveryModeVerificationPaths.governanceReport);
  const runtimeProjection = readJson(discoveryModeVerificationPaths.runtimeProjection);
  const businessHoursArtifact = readJson(discoveryModeVerificationPaths.businessHoursArtifact);
  const representativeId = learningSnapshot.representativeIntelligence?.[0]?.representativeId;
  const projection = projectActivePoolCandidatesWithCanonicalEligibility(activePool, representativeId, businessHoursArtifact);
  const christianBrothers = projection.evaluatedCandidates.find(candidate => candidate.googlePlaceId === christianBrothersPlaceId);
  const sourceProvenance = {
    activePoolPath: discoveryModeVerificationPaths.activePool,
    activePoolSha256: sha256(discoveryModeVerificationPaths.activePool),
    activePoolGeneratedAt: activePool.generatedAt,
    activePoolRecordCount: activePool.records?.length || 0,
    governanceReportPath: discoveryModeVerificationPaths.governanceReport,
    governanceReportSha256: sha256(discoveryModeVerificationPaths.governanceReport),
    governanceStatus: governanceReport.status,
    promotionAllowed: governanceReport.promotionAllowed,
    runtimeProjectionPath: discoveryModeVerificationPaths.runtimeProjection,
    runtimeProjectionSha256: sha256(discoveryModeVerificationPaths.runtimeProjection),
    runtimeProjectionDatasetVersion: runtimeProjection.dataset_version,
    businessHoursArtifactPath: discoveryModeVerificationPaths.businessHoursArtifact,
    businessHoursArtifactSha256: sha256(discoveryModeVerificationPaths.businessHoursArtifact),
    businessHoursArtifactVersion: businessHoursArtifact.artifactVersion,
    businessHoursSourceDatasetVersion: businessHoursArtifact.sourceDatasetVersion,
    businessHoursStatusEvaluatedAt: businessHoursArtifact.statusEvaluatedAt,
    canonicalEligibilityVersion: projection.version,
    eligibilitySummary: projection.summary,
    eligibilityEvaluatedCandidateCount: projection.evaluatedCandidates.length,
    eligibilityAcceptedCandidateCount: projection.eligibleCandidates.length,
    eligibilityExcludedCandidateCount: projection.excludedCandidates.length,
    christianBrothersEligibility: christianBrothers?.eligibilitySnapshot || null,
    learningSnapshotPath: config.evidencePolicy.authorizedSnapshotPath,
    learningSnapshotSha256: sha256(config.evidencePolicy.authorizedSnapshotPath),
    learningSnapshotGeneratedAt: learningSnapshot.generatedAt,
    learningPolicyPath: config.evidencePolicy.thresholdSource,
    learningPolicySha256: sha256(config.evidencePolicy.thresholdSource),
    projectedCandidateCount: projection.evaluatedCandidates.length,
    eligibleProjectedCandidateCount: projection.eligibleCandidates.length,
    skippedRuntimeProfileCount: projection.skipped.length
  };
  return buildDiscoveryModeAdvisoryPlan({
    candidates: projection.eligibleCandidates,
    config,
    contract,
    learningPolicy,
    learningSnapshot,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId,
    generatedAt: learningSnapshot.generatedAt,
    sourceProvenance
  });
}

export function verifyDiscoveryModeIntelligenceV2({
  writeArtifact = false,
  checkProtectedBaselines = true
} = {}) {
  const config = loadDiscoveryModeConfig();
  const contract = loadDiscoveryModeContract();
  const governanceReport = readJson(discoveryModeVerificationPaths.governanceReport);
  const eligibilityProjection = buildCanonicalDiscoveryModeEligibilityProjection();
  const first = buildCanonicalDiscoveryModePlan();
  const second = buildCanonicalDiscoveryModePlan();
  const failures = [
    ...validateDiscoveryModeConfig(config),
    ...validateDiscoveryModeContract(contract),
    ...validateDiscoveryModeAdvisoryPlan(first, config)
  ];
  const check = (condition, reason) => { if (!condition) failures.push(reason); };
  const canonicalPath = resolve(repoRoot, discoveryModeVerificationPaths.canonicalArtifact);

  if (writeArtifact) {
    mkdirSync(dirname(canonicalPath), { recursive: true });
    writeFileSync(canonicalPath, `${JSON.stringify(first, null, 2)}\n`);
  }

  const canonical = existsSync(canonicalPath) ? readJson(discoveryModeVerificationPaths.canonicalArtifact) : null;
  const baselineResults = Object.fromEntries(Object.entries(contract.protectedBehaviorBaselines).map(([name, baseline]) => {
    const actualSha256 = sha256(baseline.path);
    return [name, {
      path: baseline.path,
      expectedSha256: baseline.sha256,
      actualSha256,
      passed: actualSha256 === baseline.sha256
    }];
  }));
  const entries = first.queuePlan.entries;
  const categoryEvidence = new Map(first.evidenceThresholds.categoryEvidence.map(item => [item.categoryId, item]));
  const automotiveCount = first.queuePlan.categoryDistribution.automotive || 0;
  const christianBrothers = eligibilityProjection.evaluatedCandidates.find(candidate => candidate.googlePlaceId === christianBrothersPlaceId);

  check(stableJson(first) === stableJson(second), "advisory_plan_not_deterministic");
  check(Boolean(canonical), "canonical_advisory_artifact_missing");
  if (canonical) check(stableJson(canonical) === stableJson(first), "canonical_advisory_artifact_stale");
  check(governanceReport.status === "passed" && governanceReport.promotionAllowed === true, "active_pool_governance_not_passed");
  check(first.status === "exhausted_advisory_plan", "pending_roster_did_not_fail_closed");
  check(first.queuePlan.plannedSize === 0, "pending_roster_created_discovery_entries");
  check(first.queuePlan.compositionMetrics.distinctCategoryCount === 0, "pending_roster_created_category_coverage");
  check(first.queuePlan.compositionMetrics.maximumCategoryCount === 0, "pending_roster_created_category_count");
  check(first.queuePlan.compositionMetrics.maximumCategoryShare === 0, "pending_roster_created_category_share");
  check(automotiveCount === 0, "pending_roster_created_automotive_entry");
  check(first.queuePlan.relaxations.length === 0, "canonical_plan_required_constraint_relaxation");
  check(first.queuePlan.compositionMetrics.duplicateCount === 0, "canonical_plan_contains_duplicate_businesses");
  check(entries.every(entry => entry.sourcePool === "active"), "canonical_plan_bypassed_active_pool");
  check(eligibilityProjection.version === routeBusinessHoursEligibilityVersion, "canonical_business_hours_eligibility_version_not_used");
  check(eligibilityProjection.evaluatedCandidates.length === 0, "unapproved_candidate_entered_discovery_projection");
  check(eligibilityProjection.eligibleCandidates.length === 0, "unapproved_candidate_became_discovery_eligible");
  check(eligibilityProjection.summary.immediateRecommendationEligible === 0, "pending_roster_created_immediate_recommendation");
  check(eligibilityProjection.excludedCandidates.every(candidate => candidate.eligibilitySnapshot.eligible === false), "ineligible_candidate_entered_eligible_projection");
  check(christianBrothers === undefined, "unapproved_historical_candidate_entered_discovery_projection");
  check(!entries.some(entry => entry.googlePlaceId === christianBrothersPlaceId), "christian_brothers_entered_discovery_plan");
  check(entries.every(entry => entry.eligibilitySnapshot?.version === routeBusinessHoursEligibilityVersion
    && entry.eligibilitySnapshot?.status !== "CLOSED_VERIFIED"
    && entry.eligibilitySnapshot?.immediateRecommendationEligible === true
    && entry.eligibilitySnapshot?.scoringChanged === false), "category_balancing_bypassed_canonical_eligibility");
  check(entries.every(entry => entry.eligibilitySnapshot?.reasonCode
    && entry.eligibilitySnapshot?.reason
    && entry.eligibilitySnapshot?.explanation
    && entry.eligibilitySnapshot?.provenance
    && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "hoursConfidence")
    && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "hoursFreshness")
    && Object.prototype.hasOwnProperty.call(entry.eligibilitySnapshot, "businessTimezone")), "discovery_hours_provenance_missing");
  check(entries.every(entry => entry.existingScoreChanged === false), "canonical_plan_changed_existing_scores");
  check(entries.every(entry => entry.qualityScoreSnapshot >= config.candidatePolicy.minimumQualityScore), "canonical_plan_lowered_quality_floor");
  check(categoryEvidence.get("automotive")?.maturity === "emerging", "july_11_automotive_evidence_not_emerging");
  check(categoryEvidence.get("automotive")?.metrics?.visits === 4, "july_11_automotive_visit_count_mismatch");
  check(first.evidenceThresholds.categoryEvidence.filter(item => item.categoryId !== "automotive").every(item => item.metrics.visits === 0), "unsupported_category_evidence_inferred");
  check(first.evidenceThresholds.territoryStatus === "unavailable_no_verified_identity", "missing_territory_not_reported");
  check(first.learningImpact.recommendationInfluenceActive === false, "learning_impact_activated_recommendations");
  check(first.validation.recommendationInfluenceActive === false, "recommendation_influence_activated");
  check(first.validation.productionQueueConsumerActive === false, "production_queue_consumer_activated");
  check(first.validation.routeScoringWeightsChanged === false, "route_scoring_weights_changed");
  check(first.validation.dashboardRuntimeChanged === false, "dashboard_runtime_changed");
  check(first.validation.dataChanged === false, "data_behavior_changed");
  check(first.fieldEvidenceBasis.learningInput === false, "founder_design_finding_promoted_to_learning");
  if (checkProtectedBaselines) {
    check(Object.values(baselineResults).every(result => result.passed), "protected_behavior_baseline_changed");
  }

  const uniqueFailures = [...new Set(failures)].sort();
  return {
    status: uniqueFailures.length ? "failed" : "passed",
    version: first.version,
    policyVersion: first.policyVersion,
    contractVersion: first.contractVersion,
    eligibilityIntegrationVersion: first.eligibilityIntegrationVersion,
    artifactPath: discoveryModeVerificationPaths.canonicalArtifact,
    architecture: {
      advisoryOnly: true,
      runtimeQueueCreated: false,
      existingContinuousQueueReusedAsFutureTarget: true,
      fixedRotation: false,
      configurationDriven: true
    },
    categoryBalancing: {
      targetSize: first.queuePlan.targetSize,
      plannedSize: first.queuePlan.plannedSize,
      distinctCategoryCount: first.queuePlan.compositionMetrics.distinctCategoryCount,
      categoryDistribution: first.queuePlan.categoryDistribution,
      maximumCategoryCount: first.queuePlan.compositionMetrics.maximumCategoryCount,
      maximumCategoryShare: first.queuePlan.compositionMetrics.maximumCategoryShare,
      automotiveCount,
      relaxations: first.queuePlan.relaxations
    },
    evidence: {
      automotiveMaturity: categoryEvidence.get("automotive")?.maturity,
      automotiveVisits: categoryEvidence.get("automotive")?.metrics?.visits,
      observedEvidenceCategoryCount: first.learningImpact.observedEvidenceCategoryCount,
      prospectiveCategoryCoverageDelta: first.learningImpact.prospectiveCategoryCoverageDelta,
      territoryStatus: first.evidenceThresholds.territoryStatus,
      thresholdSource: first.evidenceThresholds.sourcePolicy
    },
    eligibility: {
      version: eligibilityProjection.version,
      evaluatedAt: eligibilityProjection.evaluatedAt,
      evaluatedCandidates: eligibilityProjection.evaluatedCandidates.length,
      eligibleCandidates: eligibilityProjection.eligibleCandidates.length,
      excludedCandidates: eligibilityProjection.excludedCandidates.length,
      summary: eligibilityProjection.summary,
      selectedStatusDistribution: first.queuePlan.eligibilityMetrics.selectedStatusDistribution,
      selectedTierDistribution: first.queuePlan.eligibilityMetrics.selectedTierDistribution,
      selectedCoverageOnlyCount: first.queuePlan.eligibilityMetrics.selectedCoverageOnlyCount,
      selectedClosedVerifiedCount: first.queuePlan.eligibilityMetrics.selectedClosedVerifiedCount,
      christianBrothers: christianBrothers?.eligibilitySnapshot || null
    },
    quality: first.queuePlan.qualityMetrics,
    candidateValidation: first.queuePlan.candidateValidation,
    safety: {
      deterministic: stableJson(first) === stableJson(second),
      duplicatePreventionPassed: first.validation.duplicatePreventionPassed,
      activePoolOnly: first.validation.activePoolOnly,
      canonicalBusinessHoursEligibilityPreserved: first.validation.canonicalBusinessHoursEligibilityPreserved,
      closedVerifiedExcluded: first.validation.closedVerifiedExcluded,
      conservativeCoverageTierPreserved: first.validation.conservativeCoverageTierPreserved,
      eligibilityProvenancePreserved: first.validation.eligibilityProvenancePreserved,
      workspaceIsolationPassed: first.validation.workspaceIsolationPassed,
      existingScoresPreserved: first.validation.existingScoresPreserved,
      recommendationInfluenceActive: first.validation.recommendationInfluenceActive,
      productionQueueConsumerActive: first.validation.productionQueueConsumerActive,
      routeScoringWeightsChanged: first.validation.routeScoringWeightsChanged,
      dashboardRuntimeChanged: first.validation.dashboardRuntimeChanged,
      dataChanged: first.validation.dataChanged
    },
    protectedBaselines: baselineResults,
    protectedBaselinesChecked: checkProtectedBaselines,
    failures: uniqueFailures
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyDiscoveryModeIntelligenceV2({ writeArtifact: process.argv.includes("--write-artifact") });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") process.exitCode = 1;
}
