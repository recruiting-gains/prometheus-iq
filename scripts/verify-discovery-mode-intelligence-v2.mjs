import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDiscoveryModeAdvisoryPlan,
  loadDiscoveryModeConfig,
  loadDiscoveryModeContract,
  loadDiscoveryModeLearningPolicy,
  loadDiscoveryModeLearningSnapshot,
  validateDiscoveryModeAdvisoryPlan,
  validateDiscoveryModeConfig,
  validateDiscoveryModeContract
} from "../intelligence/discovery-mode-intelligence-v2.mjs";
import { expandActivePool } from "./lib/route-intelligence-quality-gate.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");

export const discoveryModeVerificationPaths = {
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  governanceReport: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json",
  runtimeProjection: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  canonicalArtifact: "intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json"
};

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(repoRoot, relativePath))).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(value);
}

function projectActivePoolCandidates(activePool, representativeId) {
  const { routeRecords, skipped } = expandActivePool(activePool);
  return {
    candidates: routeRecords
      .filter(record => record.repProfileId === representativeId)
      .map(record => ({
        ...record,
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness",
        representativeId,
        sourcePool: "active",
        routeEligible: true
      })),
    skipped
  };
}

export function buildCanonicalDiscoveryModePlan() {
  const config = loadDiscoveryModeConfig();
  const contract = loadDiscoveryModeContract();
  const learningPolicy = loadDiscoveryModeLearningPolicy();
  const learningSnapshot = loadDiscoveryModeLearningSnapshot();
  const activePool = readJson(discoveryModeVerificationPaths.activePool);
  const governanceReport = readJson(discoveryModeVerificationPaths.governanceReport);
  const runtimeProjection = readJson(discoveryModeVerificationPaths.runtimeProjection);
  const representativeId = learningSnapshot.representativeIntelligence?.[0]?.representativeId;
  const projection = projectActivePoolCandidates(activePool, representativeId);
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
    learningSnapshotPath: config.evidencePolicy.authorizedSnapshotPath,
    learningSnapshotSha256: sha256(config.evidencePolicy.authorizedSnapshotPath),
    learningSnapshotGeneratedAt: learningSnapshot.generatedAt,
    learningPolicyPath: config.evidencePolicy.thresholdSource,
    learningPolicySha256: sha256(config.evidencePolicy.thresholdSource),
    projectedCandidateCount: projection.candidates.length,
    skippedRuntimeProfileCount: projection.skipped.length
  };
  return buildDiscoveryModeAdvisoryPlan({
    candidates: projection.candidates,
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

export function verifyDiscoveryModeIntelligenceV2({ writeArtifact = false } = {}) {
  const config = loadDiscoveryModeConfig();
  const contract = loadDiscoveryModeContract();
  const governanceReport = readJson(discoveryModeVerificationPaths.governanceReport);
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

  check(stableJson(first) === stableJson(second), "advisory_plan_not_deterministic");
  check(Boolean(canonical), "canonical_advisory_artifact_missing");
  if (canonical) check(stableJson(canonical) === stableJson(first), "canonical_advisory_artifact_stale");
  check(governanceReport.status === "passed" && governanceReport.promotionAllowed === true, "active_pool_governance_not_passed");
  check(first.status === "active_advisory_plan", "canonical_advisory_plan_not_full");
  check(first.queuePlan.plannedSize === 15, "canonical_advisory_queue_not_15");
  check(first.queuePlan.compositionMetrics.distinctCategoryCount >= config.queueComposition.minimumDistinctCategories, "canonical_category_coverage_below_minimum");
  check(first.queuePlan.compositionMetrics.maximumCategoryCount <= 4, "canonical_category_count_above_cap");
  check(first.queuePlan.compositionMetrics.maximumCategoryShare <= 0.27, "canonical_category_share_above_cap");
  check(automotiveCount <= 4, "automotive_category_still_dominates");
  check(first.queuePlan.relaxations.length === 0, "canonical_plan_required_constraint_relaxation");
  check(first.queuePlan.compositionMetrics.duplicateCount === 0, "canonical_plan_contains_duplicate_businesses");
  check(entries.every(entry => entry.sourcePool === "active"), "canonical_plan_bypassed_active_pool");
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
  check(Object.values(baselineResults).every(result => result.passed), "protected_behavior_baseline_changed");

  const uniqueFailures = [...new Set(failures)].sort();
  return {
    status: uniqueFailures.length ? "failed" : "passed",
    version: first.version,
    policyVersion: first.policyVersion,
    contractVersion: first.contractVersion,
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
    quality: first.queuePlan.qualityMetrics,
    candidateValidation: first.queuePlan.candidateValidation,
    safety: {
      deterministic: stableJson(first) === stableJson(second),
      duplicatePreventionPassed: first.validation.duplicatePreventionPassed,
      activePoolOnly: first.validation.activePoolOnly,
      workspaceIsolationPassed: first.validation.workspaceIsolationPassed,
      existingScoresPreserved: first.validation.existingScoresPreserved,
      recommendationInfluenceActive: first.validation.recommendationInfluenceActive,
      productionQueueConsumerActive: first.validation.productionQueueConsumerActive,
      routeScoringWeightsChanged: first.validation.routeScoringWeightsChanged,
      dashboardRuntimeChanged: first.validation.dashboardRuntimeChanged,
      dataChanged: first.validation.dataChanged
    },
    protectedBaselines: baselineResults,
    failures: uniqueFailures
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyDiscoveryModeIntelligenceV2({ writeArtifact: process.argv.includes("--write-artifact") });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") process.exitCode = 1;
}
