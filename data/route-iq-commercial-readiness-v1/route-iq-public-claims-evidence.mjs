import { createHash } from "node:crypto";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadCommercialWorkspaceRegistry
} from "./route-iq-commercial-workspace-registry.mjs";
import {
  verifyFitnessConnectionEvidencePreservation
} from "./governed-codex-evidence-bundle.mjs";

export const routeIqPublicClaimsEvidenceMatrixVersion = "route-iq-public-claims-evidence-matrix-v1";

const defaultRepoRoot = resolve(import.meta.dirname, "../..");
const defaultMatrixPath = "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json";
const EXPECTED_DISPOSITIONS = Object.freeze({
  governed_field_evidence_capture: "SUPPORTED_WITH_QUALIFICATION",
  workspace_profile_and_user_isolation: "SUPPORTED_AS_VERIFIED_ARCHITECTURE",
  configuration_driven_multi_business_product: "SUPPORTED_AS_SYNTHETIC_VALIDATION_ONLY",
  learn_representatives_territories_customer_context_and_outcomes: "CAPABILITY_ONLY_CURRENT_EVIDENCE_LIMITED",
  evidence_to_read_only_intelligence: "REQUIRES_INTELLIGENCE_OWNER_CORROBORATION",
  decision_ready_intelligence_current_state: "SUPPORTED_ONLY_AS_DEFINED_PRODUCT_SEMANTIC_REQUIRES_INTELLIGENCE_CORROBORATION",
  calibrated_probability_or_proven_prediction: "UNSUPPORTED_CURRENT_STATE",
  recommendation_superiority_causal_uplift_or_performance_improvement: "PROHIBITED_UNSUPPORTED_CLAIM",
  human_control_and_no_recommendation_influence: "SUPPORTED_CURRENT_STATE",
  fitness_connection_founder_research_classification: "SUPPORTED_WITH_RESTRICTED_DISCLOSURE",
  fitness_connection_customer_partner_pilot_sponsor_or_endorser: "PROHIBITED_RELATIONSHIP_CLAIM",
  customer_traction_or_market_validation: "UNSUPPORTED_BY_GOVERNED_DATA",
  evidence_freshness: "SUPPORTED_ONLY_WITH_EXACT_WINDOW",
  evidence_quality: "SUPPORTED_WITH_MATERIAL_LIMITATIONS",
  raw_evidence_retention: "SUPPORTED_POLICY_NOT_ACTIVE_DELETION",
  absolute_no_pii_collection: "UNSUPPORTED_ABSOLUTE_CLAIM",
  absolute_no_external_transmission: "OUTSIDE_DATA_AUTHORITY_AND_UNSUPPORTED_ABSOLUTE",
  governed_codex_evidence_delivery: "SUPPORTED_INTERNAL_CAPABILITY_ONLY",
  route_iq_sole_active_product: "OUTSIDE_DATA_AUTHORITY_REQUIRES_ROUTE_IQ_OWNER",
  product_differentiation_from_route_planner_crm_mapping_or_generic_ai: "OUTSIDE_DATA_AUTHORITY_REQUIRES_ROUTE_IQ_OWNER"
});

export class RouteIqPublicClaimsEvidenceError extends Error {
  constructor(message, code = "route_iq_public_claims_evidence_invalid", details = {}) {
    super(message);
    this.name = "RouteIqPublicClaimsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqPublicClaimsEvidenceError(message, code, details);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireExact(actual, expected, code, message) {
  if (actual !== expected) fail(code, message, { expected, actual });
}

function verifySource(repoRoot, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)
    || typeof source.sourceId !== "string" || !/^[a-z0-9_]+$/.test(source.sourceId)
    || typeof source.path !== "string" || !source.path.startsWith("data/")
    || typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) {
    fail("route_iq_public_claim_source_invalid", "A canonical public-claim source entry is invalid.");
  }
  const absolute = resolve(repoRoot, source.path);
  if (!absolute.startsWith(`${repoRoot}/`) || lstatSync(absolute).isSymbolicLink() || !statSync(absolute).isFile()) {
    fail("route_iq_public_claim_source_path_invalid", "A canonical public-claim source path is invalid.", {
      sourceId: source.sourceId
    });
  }
  const actualSha256 = sha256(readFileSync(absolute));
  requireExact(
    actualSha256,
    source.sha256,
    "route_iq_public_claim_source_hash_mismatch",
    `Canonical public-claim source drifted: ${source.sourceId}`
  );
  return Object.freeze({ sourceId: source.sourceId, path: source.path, sha256: actualSha256 });
}

function verifyCrossOwnerSource(repoRoot, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)
    || !["Prometheus Route IQ", "Prometheus Intelligence Engine"].includes(source.ownerSubsystem)
    || typeof source.ownerCommit !== "string" || !/^[a-f0-9]{40}$/.test(source.ownerCommit)
    || typeof source.ownerTree !== "string" || !/^[a-f0-9]{40}$/.test(source.ownerTree)
    || typeof source.path !== "string"
    || typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)
    || source.corroborationResult !== "COMPATIBLE_ONLY_WITH_EXPLICIT_QUALIFICATIONS") {
    fail("route_iq_public_claim_corroboration_invalid", "A cross-owner claim corroboration entry is invalid.");
  }
  const absolute = resolve(repoRoot, source.path);
  if (!absolute.startsWith(`${repoRoot}/`) || lstatSync(absolute).isSymbolicLink() || !statSync(absolute).isFile()) {
    fail("route_iq_public_claim_corroboration_path_invalid", "A cross-owner claim corroboration path is invalid.");
  }
  requireExact(
    sha256(readFileSync(absolute)),
    source.sha256,
    "route_iq_public_claim_corroboration_hash_mismatch",
    `Cross-owner claim contract drifted: ${source.ownerSubsystem}`
  );
  return Object.freeze({ ...source });
}

export function loadRouteIqPublicClaimsEvidenceMatrix(repoRoot = defaultRepoRoot) {
  return readJson(resolve(repoRoot, defaultMatrixPath));
}

export function getRouteIqPublicClaim(claimId, options = {}) {
  const matrix = options.matrix || loadRouteIqPublicClaimsEvidenceMatrix(options.repoRoot || defaultRepoRoot);
  const claim = matrix.publicClaims?.find(entry => entry.claimId === claimId);
  if (!claim) fail("route_iq_public_claim_unknown", "Requested public claim is not governed.", { claimId });
  return Object.freeze({ ...claim });
}

export function validateRouteIqPublicClaimsEvidenceMatrix(matrix, options = {}) {
  const repoRoot = resolve(options.repoRoot || defaultRepoRoot);
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) {
    fail("route_iq_public_claims_matrix_invalid", "Public-claims evidence matrix must be an object.");
  }
  requireExact(matrix.matrixVersion, routeIqPublicClaimsEvidenceMatrixVersion, "route_iq_public_claims_matrix_version_invalid", "Public-claims matrix version is invalid.");
  requireExact(matrix.batchId, "BATCH-20260719-002", "route_iq_public_claims_batch_invalid", "Public-claims batch is invalid.");
  requireExact(matrix.ownerSubsystem, "Prometheus Data", "route_iq_public_claims_owner_invalid", "Public-claims owner is invalid.");
  requireExact(matrix.status, "canonical_data_claim_boundaries_verified_cross_owner_corroborated", "route_iq_public_claims_status_invalid", "Public-claims status is invalid.");
  requireExact(matrix.auditedSourceRevision?.commit, "cb413fdf3a9676c238c02532261ffcf3a24f2b21", "route_iq_public_claims_revision_invalid", "Audited source commit changed.");
  requireExact(matrix.auditedSourceRevision?.tree, "ccd8356a5f820df14c574ff2be5196459422acbe", "route_iq_public_claims_revision_invalid", "Audited source tree changed.");
  requireExact(matrix.authorityBoundary?.publicationApprovalGranted, false, "route_iq_public_claims_authority_invalid", "Data must not grant publication approval.");

  if (!Array.isArray(matrix.canonicalDataSources) || matrix.canonicalDataSources.length !== 7) {
    fail("route_iq_public_claim_sources_invalid", "Public-claims matrix must bind exactly seven canonical Data sources.");
  }
  const sourceIds = matrix.canonicalDataSources.map(source => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) fail("route_iq_public_claim_source_duplicate", "Canonical source IDs must be unique.");
  const verifiedSources = matrix.canonicalDataSources.map(source => verifySource(repoRoot, source));
  if (!Array.isArray(matrix.crossOwnerCorroborationSources)
    || matrix.crossOwnerCorroborationSources.length !== 2
    || new Set(matrix.crossOwnerCorroborationSources.map(source => source.ownerSubsystem)).size !== 2) {
    fail("route_iq_public_claim_corroboration_invalid", "Both Route IQ and Intelligence owner corroboration are required.");
  }
  const verifiedCorroborationSources = matrix.crossOwnerCorroborationSources.map(source => verifyCrossOwnerSource(repoRoot, source));

  const positioning = readJson(resolve(repoRoot, "docs/route-iq-public-positioning-claims-contract-v1.json"));
  const intelligenceClaims = readJson(resolve(repoRoot, "intelligence/contracts/route-iq-public-intelligence-claims-v1.json"));
  requireExact(positioning.safetyState?.recommendationReadiness, "INSUFFICIENT_EVIDENCE", "route_iq_public_claim_positioning_invalid", "Route IQ positioning readiness changed.");
  requireExact(positioning.safetyState?.recommendationInfluence, "OFF", "route_iq_public_claim_positioning_invalid", "Route IQ positioning influence changed.");
  requireExact(positioning.fitnessConnectionBoundary?.publicMentionPolicy, "omit_by_default", "route_iq_public_claim_positioning_invalid", "Fitness Connection public mention policy changed.");
  requireExact(positioning.fitnessConnectionBoundary?.customerClaimAllowed, false, "route_iq_public_claim_positioning_invalid", "Fitness Connection customer claims became allowed.");
  requireExact(positioning.decisionSupportLifecycle?.probabilityBoundary?.causalInterpretationAllowed, false, "route_iq_public_claim_positioning_invalid", "Causal interpretation became allowed.");
  requireExact(positioning.decisionSupportLifecycle?.probabilityBoundary?.recommendationSuperiorityClaimAllowed, false, "route_iq_public_claim_positioning_invalid", "Recommendation superiority claims became allowed.");
  requireExact(intelligenceClaims.currentGovernedState?.shadowReadiness, "INSUFFICIENT_EVIDENCE", "route_iq_public_claim_intelligence_invalid", "Intelligence readiness changed.");
  requireExact(intelligenceClaims.currentGovernedState?.prospectiveCollection, "OFF", "route_iq_public_claim_intelligence_invalid", "Intelligence collection changed.");
  requireExact(intelligenceClaims.currentGovernedState?.activeCohorts, 0, "route_iq_public_claim_intelligence_invalid", "Intelligence cohorts changed.");
  requireExact(intelligenceClaims.currentGovernedState?.recommendationInfluence, "OFF", "route_iq_public_claim_intelligence_invalid", "Intelligence influence changed.");
  requireExact(intelligenceClaims.approvedPublicSemantics?.decisionReady, "Decision-ready means evidence is organized for a human decision with provenance, confidence, and limitations; it does not mean ELIGIBLE_FOR_FOUNDER_REVIEW or authorization to activate recommendations.", "route_iq_public_claim_intelligence_invalid", "Decision-ready semantics changed.");
  if (!intelligenceClaims.prohibitedPublicClaims?.includes("recommendation_readiness")
    || !intelligenceClaims.prohibitedPublicClaims?.includes("causal_uplift")
    || !intelligenceClaims.prohibitedPublicClaims?.includes("proven_recommendation_superiority")) {
    fail("route_iq_public_claim_intelligence_invalid", "Intelligence public-claim prohibitions are incomplete.");
  }

  const registry = loadCommercialWorkspaceRegistry(resolve(repoRoot, "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json"));
  const workspace = registry.workspaces.find(entry => entry.workspaceId === "fitness_connection");
  requireExact(registry.product, "route_iq", "route_iq_public_claim_registry_invalid", "Commercial registry product changed.");
  requireExact(registry.activeProduct, true, "route_iq_public_claim_registry_invalid", "Route IQ is not active in the Data registry.");
  requireExact(registry.prospectiveCollection, "OFF", "route_iq_public_claim_activation_invalid", "Prospective collection changed.");
  requireExact(registry.recommendationInfluence, "OFF", "route_iq_public_claim_activation_invalid", "Recommendation influence changed.");
  requireExact(workspace?.business?.relationshipClassification, "FOUNDER_FIELD_RESEARCH", "route_iq_public_claim_relationship_invalid", "Fitness Connection classification changed.");
  requireExact(workspace?.business?.publicRelationshipClaimsAllowed, false, "route_iq_public_claim_relationship_invalid", "Fitness Connection public relationship claims became allowed.");
  requireExact(workspace?.productionActivationAuthorized, false, "route_iq_public_claim_activation_invalid", "Fitness Connection production activation changed.");

  const preservation = verifyFitnessConnectionEvidencePreservation({ repoRoot });
  requireExact(preservation.status, "PRESERVED_BYTE_IDENTICAL", "route_iq_public_claim_preservation_invalid", "Founder research evidence is not byte-identical.");
  requireExact(preservation.fileCount, 9, "route_iq_public_claim_preservation_invalid", "Founder research evidence scope changed.");
  requireExact(preservation.aggregateSha256, matrix.governedState?.preservation?.aggregateSha256, "route_iq_public_claim_preservation_invalid", "Founder research preservation aggregate changed.");

  const sessionManifest = readJson(resolve(repoRoot, matrix.canonicalDataSources.find(source => source.sourceId === "founder_research_session_manifest").path));
  const normalized = readJson(resolve(repoRoot, matrix.canonicalDataSources.find(source => source.sourceId === "founder_research_normalized_session").path));
  const metrics = readJson(resolve(repoRoot, matrix.canonicalDataSources.find(source => source.sourceId === "founder_research_calculated_metrics").path));
  const history = readJson(resolve(repoRoot, matrix.canonicalDataSources.find(source => source.sourceId === "founder_research_history_updates").path));
  const retention = readJson(resolve(repoRoot, matrix.canonicalDataSources.find(source => source.sourceId === "prospective_retention_policy").path));
  const state = matrix.governedState;

  requireExact(sessionManifest.recordCounts?.fieldSessions, state.repositoryEvidence?.canonicalFieldSessions, "route_iq_public_claim_evidence_count_invalid", "Field-session count changed.");
  requireExact(sessionManifest.recordCounts?.completedVisits, state.repositoryEvidence?.completedVisits, "route_iq_public_claim_evidence_count_invalid", "Visit count changed.");
  requireExact(normalized.verifiedFields?.completedVisits?.length, state.repositoryEvidence?.completedVisits, "route_iq_public_claim_evidence_count_invalid", "Normalized visit count changed.");
  requireExact(history.representativeHistory?.representativeId, sessionManifest.representativeId, "route_iq_public_claim_representative_invalid", "Representative history scope changed.");
  requireExact(history.territoryHistory?.status, state.repositoryEvidence?.territoryHistoryStatus, "route_iq_public_claim_territory_invalid", "Territory evidence status changed.");
  requireExact(history.customerOutcomeHistory?.length, state.repositoryEvidence?.customerOutcomeHistoryEntries, "route_iq_public_claim_evidence_count_invalid", "Business outcome-history count changed.");
  requireExact(history.categoryOutcomeHistory?.length, state.repositoryEvidence?.categoryOutcomeHistoryEntries, "route_iq_public_claim_evidence_count_invalid", "Category history count changed.");
  requireExact(metrics.calculations?.firstLoggedVisitAt, state.repositoryEvidence?.evidenceWindow?.from, "route_iq_public_claim_evidence_window_invalid", "Evidence window start changed.");
  requireExact(metrics.calculations?.lastLoggedVisitAt, state.repositoryEvidence?.evidenceWindow?.to, "route_iq_public_claim_evidence_window_invalid", "Evidence window end changed.");
  requireExact(state.repositoryEvidence?.wallClockFreshnessClaimAllowed, false, "route_iq_public_claim_freshness_invalid", "Wall-clock freshness claim became allowed.");

  requireExact(retention.retentionDecision?.maximumCalendarMonths, state.retention?.rawEvidenceMaximumCalendarMonths, "route_iq_public_claim_retention_invalid", "Retention maximum changed.");
  requireExact(retention.retentionDecision?.customerContractMayShorten, true, "route_iq_public_claim_retention_invalid", "Customer shortening boundary changed.");
  requireExact(retention.retentionDecision?.customerContractMayExpand, false, "route_iq_public_claim_retention_invalid", "Customer expansion boundary changed.");
  requireExact(retention.expiryAndDeletion?.physicalDeletionActivated, false, "route_iq_public_claim_retention_invalid", "Physical deletion activation changed.");
  requireExact(retention.scope?.collectionActivated, false, "route_iq_public_claim_activation_invalid", "Retention policy collection state changed.");
  requireExact(retention.scope?.activeCohorts, 0, "route_iq_public_claim_activation_invalid", "Active cohort count changed.");
  requireExact(retention.scope?.recommendationInfluence, "off", "route_iq_public_claim_activation_invalid", "Retention policy influence state changed.");

  requireExact(state.activation?.prospectiveCollection, "OFF", "route_iq_public_claim_activation_invalid", "Matrix collection state changed.");
  requireExact(state.activation?.activeCohorts, 0, "route_iq_public_claim_activation_invalid", "Matrix cohort count changed.");
  requireExact(state.activation?.recommendationInfluence, "OFF", "route_iq_public_claim_activation_invalid", "Matrix influence state changed.");
  requireExact(state.privacyAndTransmission?.newPiiCategoryIntroducedByThisMatrix, false, "route_iq_public_claim_privacy_invalid", "Matrix introduced a PII category.");
  requireExact(state.privacyAndTransmission?.newExternalTransmissionIntroducedByThisMatrix, false, "route_iq_public_claim_transmission_invalid", "Matrix introduced an external transmission.");
  requireExact(state.privacyAndTransmission?.absoluteNoPiiProductClaimSupported, false, "route_iq_public_claim_privacy_invalid", "Absolute no-PII claim became supported.");
  requireExact(state.privacyAndTransmission?.absoluteNoExternalTransmissionProductClaimSupported, false, "route_iq_public_claim_transmission_invalid", "Absolute no-transmission claim became supported.");

  if (!Array.isArray(matrix.publicClaims) || matrix.publicClaims.length !== Object.keys(EXPECTED_DISPOSITIONS).length) {
    fail("route_iq_public_claim_catalog_invalid", "Public-claim catalog is incomplete.");
  }
  const claimIds = matrix.publicClaims.map(claim => claim.claimId);
  if (new Set(claimIds).size !== claimIds.length) fail("route_iq_public_claim_duplicate", "Public claim IDs must be unique.");
  for (const [claimId, expectedDisposition] of Object.entries(EXPECTED_DISPOSITIONS)) {
    const claim = matrix.publicClaims.find(entry => entry.claimId === claimId);
    if (!claim || typeof claim.safeBoundary !== "string" || !claim.safeBoundary
      || typeof claim.blockedExtension !== "string" || !claim.blockedExtension
      || !Array.isArray(claim.evidenceSourceIds)
      || claim.evidenceSourceIds.some(sourceId => !sourceIds.includes(sourceId))) {
      fail("route_iq_public_claim_entry_invalid", `Public claim entry is invalid: ${claimId}`);
    }
    requireExact(claim.dataEvidenceDisposition, expectedDisposition, "route_iq_public_claim_disposition_invalid", `Public claim disposition changed: ${claimId}`);
  }
  requireExact(matrix.consumerRules?.dataEvidenceDispositionNeverEqualsPublicationApproval, true, "route_iq_public_claim_consumer_rule_invalid", "Data disposition became publication approval.");
  requireExact(matrix.consumerRules?.founderResearchMustNotBePresentedAsCustomerEvidence, true, "route_iq_public_claim_consumer_rule_invalid", "Founder research customer boundary changed.");

  const dispositionCounts = matrix.publicClaims.reduce((counts, claim) => {
    counts[claim.dataEvidenceDisposition] = (counts[claim.dataEvidenceDisposition] || 0) + 1;
    return counts;
  }, {});
  return Object.freeze({
    status: "PASS",
    matrixVersion: matrix.matrixVersion,
    sourceRevision: Object.freeze({ ...matrix.auditedSourceRevision }),
    verifiedSources: Object.freeze(verifiedSources),
    verifiedCorroborationSources: Object.freeze(verifiedCorroborationSources),
    claimCount: matrix.publicClaims.length,
    dispositionCounts: Object.freeze(dispositionCounts),
    evidencePreservationAggregateSha256: preservation.aggregateSha256,
    collection: state.activation.prospectiveCollection,
    activeCohorts: state.activation.activeCohorts,
    recommendationInfluence: state.activation.recommendationInfluence
  });
}

export function verifyRouteIqPublicClaimsEvidence(options = {}) {
  const repoRoot = resolve(options.repoRoot || defaultRepoRoot);
  const matrix = options.matrix || loadRouteIqPublicClaimsEvidenceMatrix(repoRoot);
  return validateRouteIqPublicClaimsEvidenceMatrix(matrix, { repoRoot });
}
