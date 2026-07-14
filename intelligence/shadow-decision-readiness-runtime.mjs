import { createHash } from "node:crypto";

import {
  computeRouteIqCandidateManifestDigests,
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqCandidateProducerEnvelopeVersion,
  routeIqCandidateSourceSchemaVersion,
  routeIqCandidateSourceVersion,
  routeIqProspectiveCoordinatorContractVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import { routeIqChronologicalEvidenceProjectionVersion } from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility,
  routeBusinessHoursEligibilityVersion,
} from "./route-business-hours-eligibility.mjs";
import {
  defaultRouteQueueTarget,
  routeQueueIdentity,
} from "./continuous-adaptive-route-replenishment.mjs";

export const shadowDecisionProspectiveRuntimeVersion =
  "route-iq-prospective-shadow-decision-runtime-v2";
export const shadowDecisionProspectiveRuleVersion =
  "route-iq-governed-score-normalization-shadow-rule-v1";
export const shadowDecisionProspectiveDispositionSchemaVersion =
  "route-iq-prospective-shadow-disposition-v2";
export const shadowDecisionProspectiveDecisionSchemaVersion =
  "route-iq-prospective-shadow-decision-record-v1";
export const shadowDecisionAcceptedSnapshotSchemaVersion =
  "route-iq-immutable-accepted-candidate-snapshot-v1";
export const shadowDecisionFounderAggregateSchemaVersion =
  "route-iq-founder-shadow-readiness-aggregate-v1";
export const shadowDecisionRankingBasisVersion =
  "route-iq-existing-recommendation-score-normalization-v1";

export const shadowDecisionRuntimeReasonCodes = Object.freeze({
  candidateSourceMissing: "candidate_source_unavailable",
  candidateSourceInvalid: "candidate_source_invalid",
  candidateSetEmpty: "candidate_set_empty_after_governed_exclusions",
  candidateSetIncomplete: "candidate_manifest_incomplete_or_tampered",
  futureEvidence: "future_or_equal_evidence_rejected",
  inputContamination: "post_decision_input_rejected",
  scopeInvalid: "canonical_scope_invalid",
  snapshotInvalid: "immutable_accepted_snapshot_invalid",
  syntheticOrHistorical: "synthetic_historical_or_nonprospective_rejected",
  territoryMissing: "territory_context_unavailable",
});

const SOURCE_PATHS = Object.freeze({
  activePool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  fullPool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  quarantinePool:
    "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours:
    "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
});

const CANONICAL_SCOPE = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
});

const TERRITORY_DEFINITIONS = Object.freeze({
  cruz: Object.freeze({ maxRadiusMiles: 15 }),
  anthony: Object.freeze({ maxRadiusMiles: 25 }),
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HASH_ID_PATTERNS = Object.freeze({
  opportunity: /^riq_opportunity_[a-f0-9]{64}$/,
  territory: /^riq_territory_[a-f0-9]{64}$/,
  candidate: /^riq_candidate_[a-f0-9]{64}$/,
  source: /^riq_source_[a-f0-9]{64}$/,
  snapshot: /^riq_snapshot_[a-f0-9]{64}$/,
  snapshotSeal: /^riq_snapshot_seal_[a-f0-9]{64}$/,
  seal: /^riq_seal_[a-f0-9]{64}$/,
  key: /^riq_key_[a-f0-9]{64}$/,
});
const SCOPE_KEYS = Object.freeze([
  "workspaceId",
  "operatingProfileId",
  "representativeId",
]);
const CANONICAL_CONTEXT_KEYS = Object.freeze([
  "territoryId",
  "canonicalSessionRecordSha256",
  "sessionEventSequence",
  "opportunityEventSequence",
  "triggerRecordSha256",
]);
const FORBIDDEN_DECISION_KEYS = Object.freeze(
  new Set([
    "action",
    "actualAction",
    "decisionSource",
    "futureEvidence",
    "outcome",
    "representativeResponse",
    "selectedCandidateId",
  ]),
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeShadowDecisionRuntimeSha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
}

function hashId(kind, value) {
  return `riq_${kind}_${computeShadowDecisionRuntimeSha256({ kind, value })}`;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, code) {
  if (!isPlainObject(value)) throw new ProspectiveIntelligenceError(code);
  const allowed = new Set(keys);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new ProspectiveIntelligenceError(code);
  }
}

function canonicalTimestamp(value, code) {
  const time = Date.parse(value);
  if (
    typeof value !== "string" ||
    !Number.isFinite(time) ||
    new Date(time).toISOString() !== value
  ) {
    throw new ProspectiveIntelligenceError(code);
  }
  return { iso: value, time };
}

function requireSha(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new ProspectiveIntelligenceError(code);
  }
  return value;
}

function requireHashId(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new ProspectiveIntelligenceError(code);
  }
  return value;
}

function requireSequence(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ProspectiveIntelligenceError(code);
  }
  return value;
}

function normalizeReason(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function assertNoForbiddenDecisionInput(value, path = "acceptedSnapshot") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_DECISION_KEYS.has(key)) {
      throw new ProspectiveIntelligenceError(
        "route_iq_shadow_decision_input_contaminated",
        [shadowDecisionRuntimeReasonCodes.inputContamination],
        { path: `${path}.${key}` },
      );
    }
    assertNoForbiddenDecisionInput(child, `${path}.${key}`);
  }
}

export class ProspectiveIntelligenceError extends Error {
  constructor(
    code,
    reasonCodes = [shadowDecisionRuntimeReasonCodes.candidateSourceInvalid],
    details = {},
  ) {
    super(code);
    this.name = "ProspectiveIntelligenceError";
    this.code = code;
    this.reasonCodes = [...new Set(reasonCodes)].sort();
    this.details = details;
  }
}

function normalizeScope(scope) {
  assertExactKeys(scope, SCOPE_KEYS, "route_iq_candidate_scope_invalid");
  if (
    scope.workspaceId !== CANONICAL_SCOPE.workspaceId ||
    scope.operatingProfileId !== CANONICAL_SCOPE.operatingProfileId ||
    !Object.hasOwn(TERRITORY_DEFINITIONS, scope.representativeId)
  ) {
    throw new ProspectiveIntelligenceError(
      "route_iq_candidate_scope_invalid",
      [shadowDecisionRuntimeReasonCodes.scopeInvalid],
    );
  }
  return clone(scope);
}

function normalizeCanonicalOpportunity(value) {
  assertExactKeys(
    value,
    [
      "opportunityId",
      "opportunityType",
      "recordOrigin",
      "scope",
      "canonicalContext",
      "territorySource",
    ],
    "route_iq_canonical_opportunity_invalid",
  );
  const scope = normalizeScope(value.scope);
  if (value.opportunityType !== "next_stop" || value.recordOrigin !== "prospective") {
    throw new ProspectiveIntelligenceError(
      "route_iq_canonical_opportunity_nonprospective",
      [shadowDecisionRuntimeReasonCodes.syntheticOrHistorical],
    );
  }
  requireHashId(
    value.opportunityId,
    HASH_ID_PATTERNS.opportunity,
    "route_iq_canonical_opportunity_id_invalid",
  );
  assertExactKeys(
    value.canonicalContext,
    CANONICAL_CONTEXT_KEYS,
    "route_iq_canonical_context_invalid",
  );
  requireHashId(
    value.canonicalContext.territoryId,
    HASH_ID_PATTERNS.territory,
    "route_iq_territory_context_missing",
  );
  requireSha(
    value.canonicalContext.canonicalSessionRecordSha256,
    "route_iq_session_record_hash_invalid",
  );
  requireSequence(
    value.canonicalContext.sessionEventSequence,
    "route_iq_session_sequence_invalid",
  );
  requireSequence(
    value.canonicalContext.opportunityEventSequence,
    "route_iq_opportunity_sequence_invalid",
  );
  requireSha(
    value.canonicalContext.triggerRecordSha256,
    "route_iq_trigger_record_hash_invalid",
  );
  if (!value.territorySource) {
    throw new ProspectiveIntelligenceError(
      "route_iq_territory_source_missing",
      [shadowDecisionRuntimeReasonCodes.territoryMissing],
    );
  }
  assertExactKeys(
    value.territorySource,
    ["sourceRecordSha256", "sourceContractVersion", "availableAt"],
    "route_iq_territory_source_invalid",
  );
  requireSha(
    value.territorySource.sourceRecordSha256,
    "route_iq_territory_source_hash_invalid",
  );
  if (
    typeof value.territorySource.sourceContractVersion !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(
      value.territorySource.sourceContractVersion,
    )
  ) {
    throw new ProspectiveIntelligenceError("route_iq_territory_source_version_invalid");
  }
  canonicalTimestamp(
    value.territorySource.availableAt,
    "route_iq_territory_source_time_invalid",
  );
  return deepFreeze({
    ...clone(value),
    scope,
  });
}

function parseSourceArtifact(input, kind, cutoff) {
  if (!input) {
    throw new ProspectiveIntelligenceError(
      `route_iq_${kind}_source_missing`,
      [shadowDecisionRuntimeReasonCodes.candidateSourceMissing],
    );
  }
  assertExactKeys(input, ["path", "rawText"], `route_iq_${kind}_source_invalid`);
  if (input.path !== SOURCE_PATHS[kind] || typeof input.rawText !== "string") {
    throw new ProspectiveIntelligenceError(`route_iq_${kind}_source_invalid`);
  }
  let value;
  try {
    value = JSON.parse(input.rawText);
  } catch {
    throw new ProspectiveIntelligenceError(`route_iq_${kind}_source_json_invalid`);
  }
  const sourceRecordSha256 = computeShadowDecisionRuntimeSha256(input.rawText);
  const availableAtValue =
    kind === "fullPool"
      ? value.generated_at
      : kind === "businessHours"
        ? value.generatedAt
        : value.generatedAt;
  const availableAt = canonicalTimestamp(
    availableAtValue,
    `route_iq_${kind}_source_time_invalid`,
  );
  if (availableAt.time >= cutoff.time) {
    throw new ProspectiveIntelligenceError(
      `route_iq_${kind}_source_future`,
      [shadowDecisionRuntimeReasonCodes.futureEvidence],
    );
  }
  return {
    kind,
    path: input.path,
    value,
    availableAt: availableAt.iso,
    sourceRecordSha256,
    sourceRecordId: hashId("source", {
      path: input.path,
      sourceRecordSha256,
    }),
  };
}

function validateSourceContracts(sources, scope) {
  const active = sources.activePool.value;
  const full = sources.fullPool.value;
  const quarantine = sources.quarantinePool.value;
  const hours = sources.businessHours.value;
  if (
    active.sourceDatasetVersion !== "google-qualified-businesses-v2" ||
    active.segmentationVersion !== "runtime-pool-segmentation-v1" ||
    active.pool !== "active" ||
    active.scoringChanged !== false ||
    active.count !== active.records?.length ||
    full.dataset_version !== "google-qualified-businesses-v2" ||
    !Array.isArray(full[scope.representativeId]) ||
    quarantine.sourceDatasetVersion !== "google-qualified-businesses-v2" ||
    quarantine.segmentationVersion !== "runtime-pool-segmentation-v1" ||
    quarantine.pool !== "quarantine" ||
    quarantine.count !== quarantine.records?.length ||
    hours.schemaVersion !== "prometheus-data-business-hours-v1" ||
    hours.artifactVersion !== "business-hours-v1" ||
    hours.workspaceId !== scope.workspaceId ||
    hours.operatingProfileId !== scope.operatingProfileId ||
    hours.scoringChanged !== false ||
    hours.recordCount !== hours.records?.length
  ) {
    throw new ProspectiveIntelligenceError("route_iq_candidate_source_contract_invalid");
  }
}

function sourceRecord(source) {
  return {
    sourceRecordId: source.sourceRecordId,
    sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
    sourceVersion: routeIqCandidateSourceVersion,
    sourceRecordSha256: source.sourceRecordSha256,
    availableAt: source.availableAt,
  };
}

function producerCandidateDigestInput(candidates) {
  return candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    sourceRecordIds: clone(candidate.sourceRecordIds),
    eligibility: clone(candidate.eligibility),
    rankingContext: {
      producerSubsystem: candidate.rankingContext.producerSubsystem,
      ordinal: candidate.rankingContext.ordinal,
      probability: candidate.rankingContext.probability,
      basisVersion: candidate.rankingContext.basisVersion,
    },
  }));
}

function normalizeCandidateDefinition(record, profile, sourcePool) {
  const googlePlaceId = String(record.googlePlaceId || record.google_place_id || "").trim();
  const score = Number(profile?.qualityScore ?? record.qualityScore);
  const sourceOrdinal = Number(profile?.seedRouteOrder ?? record.seedRouteOrder);
  const distanceMiles = Number(
    record.estimatedDistanceMiles ?? String(record.distance || "").replace(/[^0-9.]/g, ""),
  );
  if (
    !googlePlaceId ||
    !Number.isFinite(score) ||
    score < 0 ||
    !Number.isSafeInteger(sourceOrdinal) ||
    sourceOrdinal < 1 ||
    !Number.isFinite(distanceMiles) ||
    distanceMiles < 0
  ) {
    return null;
  }
  const identityKey = routeQueueIdentity({ googlePlaceId });
  return {
    candidateId: hashId("candidate", { identityKey }),
    googlePlaceId,
    identityKey,
    recommendationScore: score,
    sourceOrdinal,
    sourcePool,
    distanceMiles,
    sourceType: record.sourceType,
    qualityClass: profile?.qualityClass ?? record.qualityClass,
    accessType: record.accessType,
  };
}

function canonicalCandidateDefinitions(sources, scope) {
  const active = sources.activePool.value.records.flatMap((record) => {
    const profile = record.runtimeProfiles?.find(
      (item) => item.repProfileId === scope.representativeId,
    );
    const definition = profile
      ? normalizeCandidateDefinition(record, profile, "active")
      : null;
    return definition ? [definition] : [];
  });
  const full = sources.fullPool.value[scope.representativeId].flatMap((record) => {
    const definition = normalizeCandidateDefinition(record, record, "full");
    return definition ? [definition] : [];
  });
  return { active, full };
}

function evaluateCandidateSet({
  definitions,
  sources,
  scope,
  completedCandidateIds,
  evaluatedAt,
}) {
  const quarantineIds = new Set(
    sources.quarantinePool.value.records
      .map((record) => record.googlePlaceId)
      .filter(Boolean),
  );
  const completed = new Set(completedCandidateIds);
  const seen = new Set();
  const radius = TERRITORY_DEFINITIONS[scope.representativeId].maxRadiusMiles;
  const hoursIndex = buildRouteBusinessHoursIndex(sources.businessHours.value, {
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
  });
  const evaluated = [];

  for (const sourcePool of ["active", "full"]) {
    for (const candidate of definitions[sourcePool]) {
      if (
        seen.has(candidate.candidateId) ||
        completed.has(candidate.candidateId) ||
        quarantineIds.has(candidate.googlePlaceId) ||
        candidate.distanceMiles > radius ||
        candidate.sourceType !== "Google Places API" ||
        candidate.qualityClass === "Never Visit" ||
        candidate.accessType === "Do not recommend"
      ) {
        continue;
      }
      seen.add(candidate.candidateId);
      const eligibility = evaluateRouteBusinessHoursEligibility({
        record: hoursIndex.recordsByPlaceId.get(candidate.googlePlaceId) || null,
        candidate: { googlePlaceId: candidate.googlePlaceId },
        evaluatedAt: new Date(evaluatedAt),
        policy: hoursIndex.freshnessPolicy,
        artifactAvailable: true,
        workspaceId: scope.workspaceId,
        operatingProfileId: scope.operatingProfileId,
      });
      if (!eligibility.eligible) continue;
      evaluated.push({
        ...candidate,
        selectionTier: eligibility.selectionTier,
        hoursStatus: eligibility.status,
        eligibilityReasonCode: normalizeReason(eligibility.reasonCode),
      });
    }
  }
  return evaluated.sort(
    (left, right) =>
      left.selectionTier - right.selectionTier ||
      (left.sourcePool === right.sourcePool
        ? 0
        : left.sourcePool === "active"
          ? -1
          : 1) ||
      right.recommendationScore - left.recommendationScore ||
      left.identityKey.localeCompare(right.identityKey),
  );
}

function buildExclusion(opportunity, reasonCodes) {
  const body = {
    schemaVersion: shadowDecisionProspectiveDispositionSchemaVersion,
    disposition: "EXCLUDED",
    opportunityId:
      typeof opportunity?.opportunityId === "string"
        ? opportunity.opportunityId
        : null,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    canonicalProductionEvidenceEligible: false,
    recommendationInfluence: "OFF",
  };
  return deepFreeze({
    ...body,
    exclusionRecordSha256: computeShadowDecisionRuntimeSha256(body),
  });
}

function territorySourceRecord(opportunity, cutoff) {
  const availableAt = canonicalTimestamp(
    opportunity.territorySource.availableAt,
    "route_iq_territory_source_time_invalid",
  );
  if (availableAt.time >= cutoff.time) {
    throw new ProspectiveIntelligenceError(
      "route_iq_territory_source_future",
      [shadowDecisionRuntimeReasonCodes.futureEvidence],
    );
  }
  return {
    sourceRecordId: hashId("source", {
      territoryId: opportunity.canonicalContext.territoryId,
      sourceRecordSha256: opportunity.territorySource.sourceRecordSha256,
      sourceContractVersion: opportunity.territorySource.sourceContractVersion,
    }),
    sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
    sourceVersion: routeIqCandidateSourceVersion,
    sourceRecordSha256: opportunity.territorySource.sourceRecordSha256,
    availableAt: availableAt.iso,
  };
}

export function produceRouteIqNextStopCandidateManifest(input = {}) {
  let opportunity = input?.canonicalOpportunity || null;
  try {
    assertExactKeys(
      input,
      [
        "canonicalOpportunity",
        "sourceArtifacts",
        "completedCandidateIds",
        "eligibilityEvaluatedAt",
        "evidenceCutoff",
        "targetSize",
      ],
      "route_iq_candidate_producer_input_invalid",
    );
    opportunity = normalizeCanonicalOpportunity(input.canonicalOpportunity);
    if (input.targetSize !== defaultRouteQueueTarget) {
      throw new ProspectiveIntelligenceError("route_iq_candidate_target_size_invalid");
    }
    if (
      !Array.isArray(input.completedCandidateIds) ||
      input.completedCandidateIds.some(
        (candidateId) => !HASH_ID_PATTERNS.candidate.test(candidateId),
      ) ||
      new Set(input.completedCandidateIds).size !== input.completedCandidateIds.length
    ) {
      throw new ProspectiveIntelligenceError("route_iq_completed_candidate_set_invalid");
    }
    const cutoff = canonicalTimestamp(
      input.evidenceCutoff,
      "route_iq_candidate_evidence_cutoff_invalid",
    );
    const evaluatedAt = canonicalTimestamp(
      input.eligibilityEvaluatedAt,
      "route_iq_candidate_eligibility_time_invalid",
    );
    if (evaluatedAt.time >= cutoff.time) {
      throw new ProspectiveIntelligenceError(
        "route_iq_candidate_eligibility_future",
        [shadowDecisionRuntimeReasonCodes.futureEvidence],
      );
    }
    assertExactKeys(
      input.sourceArtifacts,
      Object.keys(SOURCE_PATHS),
      "route_iq_candidate_sources_invalid",
    );
    const sources = Object.fromEntries(
      Object.keys(SOURCE_PATHS).map((kind) => [
        kind,
        parseSourceArtifact(input.sourceArtifacts[kind], kind, cutoff),
      ]),
    );
    validateSourceContracts(sources, opportunity.scope);
    const definitions = canonicalCandidateDefinitions(sources, opportunity.scope);
    const eligible = evaluateCandidateSet({
      definitions,
      sources,
      scope: opportunity.scope,
      completedCandidateIds: input.completedCandidateIds,
      evaluatedAt: evaluatedAt.iso,
    });
    const selected = eligible.slice(0, input.targetSize);
    if (!selected.length) {
      throw new ProspectiveIntelligenceError(
        "route_iq_candidate_set_empty",
        [shadowDecisionRuntimeReasonCodes.candidateSetEmpty],
      );
    }
    const totalScore = selected.reduce(
      (sum, candidate) => sum + candidate.recommendationScore,
      0,
    );
    if (!(totalScore > 0)) {
      throw new ProspectiveIntelligenceError("route_iq_candidate_score_total_invalid");
    }
    const sourceManifest = [
      territorySourceRecord(opportunity, cutoff),
      ...Object.keys(SOURCE_PATHS).map((kind) => sourceRecord(sources[kind])),
    ].sort((left, right) => left.sourceRecordId.localeCompare(right.sourceRecordId));
    const sourceRecordIds = sourceManifest.map((source) => source.sourceRecordId);
    const candidates = selected.map((candidate, index) => ({
      candidateId: candidate.candidateId,
      sourceRecordIds,
      eligibility: {
        status: "eligible",
        reasonCodes: [
          "canonical_candidate_source_complete",
          candidate.sourcePool === "active"
            ? "governed_active_pool_member"
            : "governed_full_pool_fallback",
          candidate.eligibilityReasonCode || "business_hours_eligible",
          "territory_permitted",
        ].sort(),
        evaluatedAt: evaluatedAt.iso,
      },
      rankingContext: {
        producerSubsystem: "Prometheus Intelligence Engine",
        ordinal: index + 1,
        probability: candidate.recommendationScore / totalScore,
        basisVersion: shadowDecisionRankingBasisVersion,
      },
    }));
    const digestInput = {
      territoryId: opportunity.canonicalContext.territoryId,
      evidenceCutoff: cutoff.iso,
      envelopeVersion: routeIqCandidateProducerEnvelopeVersion,
      producerSubsystem: "Prometheus Intelligence Engine",
      producerContractVersion: routeIqCandidateProducerContractVersion,
      schemaVersion: routeIqCandidateManifestSchemaVersion,
      dataProjectionVersion: routeIqChronologicalEvidenceProjectionVersion,
      candidates,
      sourceManifest,
    };
    const digests = computeRouteIqCandidateManifestDigests(digestInput);
    const producerClaims = {
      purpose: "candidate_manifest",
      ...opportunity.scope,
      ...clone(opportunity.canonicalContext),
      ...digestInput,
      candidateCount: digests.candidateCount,
      sourceCount: digests.sourceCount,
      candidateManifestSha256: digests.candidateManifestSha256,
      sourceManifestSha256: digests.sourceManifestSha256,
      completeManifestSha256: digests.completeManifestSha256,
    };
    return deepFreeze({
      schemaVersion: shadowDecisionProspectiveDispositionSchemaVersion,
      disposition: "MANIFEST_READY",
      opportunityId: opportunity.opportunityId,
      producerClaims,
      operationExpectations: {
        expectedCandidateCount: digests.candidateCount,
        expectedSourceCount: digests.sourceCount,
        expectedCompleteManifestSha256: digests.completeManifestSha256,
      },
      governedAudit: {
        targetSize: input.targetSize,
        eligibleSourceCandidateCount: eligible.length,
        completedCandidateCount: input.completedCandidateIds.length,
        candidateDefinitions: selected.map((candidate, index) => ({
          candidateId: candidate.candidateId,
          sourcePool: candidate.sourcePool,
          sourceOrdinal: candidate.sourceOrdinal,
          recommendationScore: candidate.recommendationScore,
          manifestOrdinal: index + 1,
          hoursStatus: candidate.hoursStatus,
        })),
        scoresChanged: false,
        recommendationInfluence: "OFF",
      },
      canonicalProductionEvidenceEligible: false,
      recommendationInfluence: "OFF",
    });
  } catch (error) {
    const reasons =
      error instanceof ProspectiveIntelligenceError
        ? error.reasonCodes
        : [shadowDecisionRuntimeReasonCodes.candidateSetIncomplete];
    return buildExclusion(opportunity, reasons);
  }
}

function operationClaims({ opportunity, purpose, authoritativeRecordTime, priorArtifact }) {
  const recordTime = canonicalTimestamp(
    authoritativeRecordTime,
    `route_iq_${purpose}_record_time_invalid`,
  ).iso;
  const canonicalEventBoundarySha256 = computeShadowDecisionRuntimeSha256({
    runtimeVersion: shadowDecisionProspectiveRuntimeVersion,
    purpose,
    opportunityId: opportunity.opportunityId,
    canonicalContext: opportunity.canonicalContext,
    priorArtifact,
  });
  return {
    purpose,
    ...opportunity.scope,
    ...clone(opportunity.canonicalContext),
    canonicalEventBoundarySha256,
    clientEventSequence: opportunity.canonicalContext.opportunityEventSequence,
    clientContentSha256: computeShadowDecisionRuntimeSha256({
      purpose,
      opportunityId: opportunity.opportunityId,
      priorArtifact,
    }),
    authoritativeRecordTime: recordTime,
    recordOrigin: "prospective",
    uncertainChronology: false,
  };
}

export function buildCandidateManifestCoordinatorClaims({
  canonicalOpportunity,
  manifestResult,
  authoritativeRecordTime,
} = {}) {
  const opportunity = normalizeCanonicalOpportunity(canonicalOpportunity);
  if (
    manifestResult?.disposition !== "MANIFEST_READY" ||
    manifestResult.opportunityId !== opportunity.opportunityId
  ) {
    throw new ProspectiveIntelligenceError("route_iq_candidate_manifest_result_invalid");
  }
  return deepFreeze({
    operationClaims: {
      ...operationClaims({
        opportunity,
        purpose: "candidate_manifest",
        authoritativeRecordTime,
        priorArtifact: {
          triggerRecordSha256: opportunity.canonicalContext.triggerRecordSha256,
        },
      }),
      ...clone(manifestResult.operationExpectations),
    },
    producerClaims: clone(manifestResult.producerClaims),
  });
}

function requireReceipt(receipt, operationKind, state, opportunityId) {
  if (
    !isPlainObject(receipt) ||
    receipt.coordinatorContractVersion !== routeIqProspectiveCoordinatorContractVersion ||
    receipt.operationKind !== operationKind ||
    receipt.state !== state ||
    receipt.opportunityId !== opportunityId ||
    receipt.recommendationInfluence !== "off" ||
    receipt.collectionDefault !== "off"
  ) {
    throw new ProspectiveIntelligenceError("route_iq_coordinator_receipt_invalid");
  }
  requireSha(receipt.recordSha256, "route_iq_coordinator_receipt_hash_invalid");
  canonicalTimestamp(
    receipt.authoritativeRecordTime,
    "route_iq_coordinator_receipt_time_invalid",
  );
  return receipt;
}

export function buildSnapshotSealCoordinatorClaims({
  canonicalOpportunity,
  manifestResult,
  candidateManifestReceipt,
  sealedAt,
} = {}) {
  const opportunity = normalizeCanonicalOpportunity(canonicalOpportunity);
  if (
    manifestResult?.disposition !== "MANIFEST_READY" ||
    manifestResult.opportunityId !== opportunity.opportunityId
  ) {
    throw new ProspectiveIntelligenceError("route_iq_candidate_manifest_result_invalid");
  }
  const receipt = requireReceipt(
    candidateManifestReceipt,
    "candidate_manifest",
    "SNAPSHOT_PENDING_SEAL",
    opportunity.opportunityId,
  );
  requireHashId(receipt.artifactId, HASH_ID_PATTERNS.snapshot, "route_iq_snapshot_id_invalid");
  if (
    receipt.candidateManifestSha256 !==
      manifestResult.producerClaims.candidateManifestSha256 ||
    receipt.completeManifestSha256 !==
      manifestResult.producerClaims.completeManifestSha256
  ) {
    throw new ProspectiveIntelligenceError("route_iq_candidate_receipt_binding_invalid");
  }
  const claims = operationClaims({
    opportunity,
    purpose: "snapshot_seal_record",
    authoritativeRecordTime: sealedAt,
    priorArtifact: {
      artifactId: receipt.artifactId,
      recordSha256: receipt.recordSha256,
    },
  });
  return deepFreeze({
    operationClaims: claims,
    sealClaims: {
      purpose: "snapshot_seal",
      ...opportunity.scope,
      sealId: hashId("seal", {
        purpose: "snapshot_seal",
        opportunityId: opportunity.opportunityId,
        sealedArtifactId: receipt.artifactId,
        sealedRecordSha256: receipt.recordSha256,
      }),
      canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
      sealedArtifactId: receipt.artifactId,
      sealedRecordSha256: receipt.recordSha256,
      candidateManifestSha256:
        manifestResult.producerClaims.candidateManifestSha256,
      sealedAt: claims.authoritativeRecordTime,
    },
  });
}

export function createImmutableAcceptedCandidateSnapshot({
  canonicalOpportunity,
  manifestResult,
  candidateManifestReceipt,
  snapshotSealReceipt,
} = {}) {
  const opportunity = normalizeCanonicalOpportunity(canonicalOpportunity);
  if (
    manifestResult?.disposition !== "MANIFEST_READY" ||
    manifestResult.opportunityId !== opportunity.opportunityId
  ) {
    throw new ProspectiveIntelligenceError("route_iq_candidate_manifest_result_invalid");
  }
  const manifestReceipt = requireReceipt(
    candidateManifestReceipt,
    "candidate_manifest",
    "SNAPSHOT_PENDING_SEAL",
    opportunity.opportunityId,
  );
  const sealReceipt = requireReceipt(
    snapshotSealReceipt,
    "snapshot_seal",
    "SNAPSHOT_SEALED",
    opportunity.opportunityId,
  );
  requireHashId(
    manifestReceipt.artifactId,
    HASH_ID_PATTERNS.snapshot,
    "route_iq_snapshot_id_invalid",
  );
  requireHashId(
    sealReceipt.artifactId,
    HASH_ID_PATTERNS.snapshotSeal,
    "route_iq_snapshot_seal_id_invalid",
  );
  if (
    sealReceipt.keyedSealVerified !== true ||
    Date.parse(sealReceipt.authoritativeRecordTime) <=
      Date.parse(manifestReceipt.authoritativeRecordTime)
  ) {
    throw new ProspectiveIntelligenceError("route_iq_snapshot_seal_receipt_invalid");
  }
  const claims = manifestResult.producerClaims;
  const digests = computeRouteIqCandidateManifestDigests({
    territoryId: claims.territoryId,
    evidenceCutoff: claims.evidenceCutoff,
    envelopeVersion: claims.envelopeVersion,
    producerSubsystem: claims.producerSubsystem,
    producerContractVersion: claims.producerContractVersion,
    schemaVersion: claims.schemaVersion,
    dataProjectionVersion: claims.dataProjectionVersion,
    candidates: claims.candidates,
    sourceManifest: claims.sourceManifest,
  });
  if (
    claims.candidateCount !== digests.candidateCount ||
    claims.sourceCount !== digests.sourceCount ||
    claims.candidateManifestSha256 !== digests.candidateManifestSha256 ||
    claims.sourceManifestSha256 !== digests.sourceManifestSha256 ||
    claims.completeManifestSha256 !== digests.completeManifestSha256 ||
    manifestReceipt.candidateManifestSha256 !== digests.candidateManifestSha256 ||
    manifestReceipt.completeManifestSha256 !== digests.completeManifestSha256
  ) {
    throw new ProspectiveIntelligenceError(
      "route_iq_accepted_snapshot_manifest_invalid",
      [shadowDecisionRuntimeReasonCodes.snapshotInvalid],
    );
  }
  return deepFreeze({
    schemaVersion: shadowDecisionAcceptedSnapshotSchemaVersion,
    authority: "sqlite_durable_object_coordinator",
    state: "SNAPSHOT_SEALED",
    opportunityId: opportunity.opportunityId,
    scope: clone(opportunity.scope),
    territoryId: claims.territoryId,
    evidenceCutoff: claims.evidenceCutoff,
    candidateCount: digests.candidateCount,
    sourceCount: digests.sourceCount,
    candidates: clone(digests.candidates),
    sourceManifest: clone(digests.sourceManifest),
    candidateManifestSha256: digests.candidateManifestSha256,
    sourceManifestSha256: digests.sourceManifestSha256,
    completeManifestSha256: digests.completeManifestSha256,
    snapshotArtifactId: manifestReceipt.artifactId,
    snapshotRecordSha256: manifestReceipt.recordSha256,
    snapshotSealArtifactId: sealReceipt.artifactId,
    snapshotSealRecordSha256: sealReceipt.recordSha256,
    snapshotSealedAt: sealReceipt.authoritativeRecordTime,
    producerContractVersion: claims.producerContractVersion,
    candidateSchemaVersion: claims.schemaVersion,
    dataProjectionVersion: claims.dataProjectionVersion,
    recommendationInfluence: "OFF",
  });
}

function validateAcceptedSnapshot(snapshot) {
  assertNoForbiddenDecisionInput(snapshot);
  assertExactKeys(
    snapshot,
    [
      "schemaVersion",
      "authority",
      "state",
      "opportunityId",
      "scope",
      "territoryId",
      "evidenceCutoff",
      "candidateCount",
      "sourceCount",
      "candidates",
      "sourceManifest",
      "candidateManifestSha256",
      "sourceManifestSha256",
      "completeManifestSha256",
      "snapshotArtifactId",
      "snapshotRecordSha256",
      "snapshotSealArtifactId",
      "snapshotSealRecordSha256",
      "snapshotSealedAt",
      "producerContractVersion",
      "candidateSchemaVersion",
      "dataProjectionVersion",
      "recommendationInfluence",
    ],
    "route_iq_accepted_snapshot_shape_invalid",
  );
  if (
    snapshot.schemaVersion !== shadowDecisionAcceptedSnapshotSchemaVersion ||
    snapshot.authority !== "sqlite_durable_object_coordinator" ||
    snapshot.state !== "SNAPSHOT_SEALED" ||
    snapshot.recommendationInfluence !== "OFF" ||
    snapshot.producerContractVersion !== routeIqCandidateProducerContractVersion ||
    snapshot.candidateSchemaVersion !== routeIqCandidateManifestSchemaVersion ||
    snapshot.dataProjectionVersion !== routeIqChronologicalEvidenceProjectionVersion
  ) {
    throw new ProspectiveIntelligenceError(
      "route_iq_accepted_snapshot_not_canonical",
      [shadowDecisionRuntimeReasonCodes.snapshotInvalid],
    );
  }
  normalizeScope(snapshot.scope);
  requireHashId(snapshot.opportunityId, HASH_ID_PATTERNS.opportunity, "route_iq_snapshot_opportunity_id_invalid");
  requireHashId(snapshot.territoryId, HASH_ID_PATTERNS.territory, "route_iq_snapshot_territory_id_invalid");
  requireHashId(snapshot.snapshotArtifactId, HASH_ID_PATTERNS.snapshot, "route_iq_snapshot_id_invalid");
  requireHashId(snapshot.snapshotSealArtifactId, HASH_ID_PATTERNS.snapshotSeal, "route_iq_snapshot_seal_id_invalid");
  requireSha(snapshot.snapshotRecordSha256, "route_iq_snapshot_record_hash_invalid");
  requireSha(snapshot.snapshotSealRecordSha256, "route_iq_snapshot_seal_hash_invalid");
  const cutoff = canonicalTimestamp(snapshot.evidenceCutoff, "route_iq_snapshot_cutoff_invalid");
  const sealedAt = canonicalTimestamp(snapshot.snapshotSealedAt, "route_iq_snapshot_sealed_time_invalid");
  if (sealedAt.time <= cutoff.time) {
    throw new ProspectiveIntelligenceError("route_iq_snapshot_chronology_invalid");
  }
  const digests = computeRouteIqCandidateManifestDigests({
    territoryId: snapshot.territoryId,
    evidenceCutoff: snapshot.evidenceCutoff,
    envelopeVersion: routeIqCandidateProducerEnvelopeVersion,
    producerSubsystem: "Prometheus Intelligence Engine",
    producerContractVersion: snapshot.producerContractVersion,
    schemaVersion: snapshot.candidateSchemaVersion,
    dataProjectionVersion: snapshot.dataProjectionVersion,
    candidates: producerCandidateDigestInput(snapshot.candidates),
    sourceManifest: snapshot.sourceManifest,
  });
  if (
    snapshot.candidateCount !== digests.candidateCount ||
    snapshot.sourceCount !== digests.sourceCount ||
    snapshot.candidateManifestSha256 !== digests.candidateManifestSha256 ||
    snapshot.sourceManifestSha256 !== digests.sourceManifestSha256 ||
    snapshot.completeManifestSha256 !== digests.completeManifestSha256
  ) {
    throw new ProspectiveIntelligenceError(
      "route_iq_accepted_snapshot_digest_invalid",
      [shadowDecisionRuntimeReasonCodes.snapshotInvalid],
    );
  }
  return digests;
}

export function produceShadowDecisionFromAcceptedSnapshot(acceptedSnapshot) {
  const digests = validateAcceptedSnapshot(acceptedSnapshot);
  const rankedCandidates = digests.candidates
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      rank: candidate.rankingContext.ordinal,
      probability: candidate.rankingContext.probability,
      sourceRecordIds: clone(candidate.sourceRecordIds),
      eligibilityReasonCodes: clone(candidate.eligibility.reasonCodes),
      rankingBasisVersion: candidate.rankingContext.basisVersion,
    }))
    .sort(
      (left, right) =>
        left.rank - right.rank || left.candidateId.localeCompare(right.candidateId),
    );
  const rankSet = new Set(rankedCandidates.map((candidate) => candidate.rank));
  const probabilityTotal = rankedCandidates.reduce(
    (sum, candidate) => sum + candidate.probability,
    0,
  );
  if (
    rankedCandidates.some(
      (candidate, index) =>
        candidate.rank !== index + 1 ||
        !Number.isFinite(candidate.probability) ||
        candidate.probability < 0,
    ) ||
    rankSet.size !== rankedCandidates.length ||
    Math.abs(probabilityTotal - 1) > 1e-12
  ) {
    throw new ProspectiveIntelligenceError("route_iq_shadow_ranking_invalid");
  }
  const body = {
    schemaVersion: shadowDecisionProspectiveDecisionSchemaVersion,
    runtimeVersion: shadowDecisionProspectiveRuntimeVersion,
    ruleVersion: shadowDecisionProspectiveRuleVersion,
    opportunityId: acceptedSnapshot.opportunityId,
    scope: clone(acceptedSnapshot.scope),
    territoryId: acceptedSnapshot.territoryId,
    evidenceCutoff: acceptedSnapshot.evidenceCutoff,
    generatedAt: acceptedSnapshot.snapshotSealedAt,
    rankedCandidates,
    confidence: rankedCandidates[0].probability,
    acceptedSnapshot: {
      schemaVersion: acceptedSnapshot.schemaVersion,
      snapshotArtifactId: acceptedSnapshot.snapshotArtifactId,
      snapshotRecordSha256: acceptedSnapshot.snapshotRecordSha256,
      snapshotSealArtifactId: acceptedSnapshot.snapshotSealArtifactId,
      snapshotSealRecordSha256: acceptedSnapshot.snapshotSealRecordSha256,
      candidateManifestSha256: acceptedSnapshot.candidateManifestSha256,
      sourceManifestSha256: acceptedSnapshot.sourceManifestSha256,
      completeManifestSha256: acceptedSnapshot.completeManifestSha256,
    },
    inputPolicy: {
      soleInput: "immutable_accepted_snapshot",
      actionOutcomeFutureOrDecisionSourceAllowed: false,
    },
    canonicalProductionEvidenceEligible: false,
    recommendationInfluence: "OFF",
    immutable: true,
  };
  return deepFreeze({
    ...body,
    shadowDecisionRecordSha256: computeShadowDecisionRuntimeSha256(body),
  });
}

export function buildShadowDecisionSealCoordinatorClaims({
  canonicalOpportunity,
  acceptedSnapshot,
  shadowDecision,
  snapshotSealReceipt,
  sealedAt,
} = {}) {
  const opportunity = normalizeCanonicalOpportunity(canonicalOpportunity);
  validateAcceptedSnapshot(acceptedSnapshot);
  const expectedDecision = produceShadowDecisionFromAcceptedSnapshot(acceptedSnapshot);
  if (
    canonical(shadowDecision) !== canonical(expectedDecision) ||
    shadowDecision.opportunityId !== opportunity.opportunityId
  ) {
    throw new ProspectiveIntelligenceError("route_iq_shadow_decision_replay_mismatch");
  }
  const receipt = requireReceipt(
    snapshotSealReceipt,
    "snapshot_seal",
    "SNAPSHOT_SEALED",
    opportunity.opportunityId,
  );
  requireHashId(receipt.artifactId, HASH_ID_PATTERNS.snapshotSeal, "route_iq_snapshot_seal_id_invalid");
  if (
    receipt.artifactId !== acceptedSnapshot.snapshotSealArtifactId ||
    receipt.recordSha256 !== acceptedSnapshot.snapshotSealRecordSha256
  ) {
    throw new ProspectiveIntelligenceError("route_iq_shadow_snapshot_binding_invalid");
  }
  const claims = operationClaims({
    opportunity,
    purpose: "shadow_decision_seal_record",
    authoritativeRecordTime: sealedAt,
    priorArtifact: {
      artifactId: receipt.artifactId,
      recordSha256: receipt.recordSha256,
      shadowDecisionRecordSha256: shadowDecision.shadowDecisionRecordSha256,
    },
  });
  claims.shadowDecisionRecordSha256 =
    shadowDecision.shadowDecisionRecordSha256;
  return deepFreeze({
    operationClaims: claims,
    sealClaims: {
      purpose: "shadow_decision_seal",
      ...opportunity.scope,
      sealId: hashId("seal", {
        purpose: "shadow_decision_seal",
        opportunityId: opportunity.opportunityId,
        shadowDecisionRecordSha256: shadowDecision.shadowDecisionRecordSha256,
      }),
      canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
      sealedArtifactId: receipt.artifactId,
      sealedRecordSha256: receipt.recordSha256,
      candidateManifestSha256: acceptedSnapshot.candidateManifestSha256,
      shadowDecisionRecordSha256: shadowDecision.shadowDecisionRecordSha256,
      sealedAt: claims.authoritativeRecordTime,
    },
  });
}

function requireFounderAuthority(authority) {
  assertExactKeys(
    authority,
    ["verificationType", "algorithm", "keyId", "claims"],
    "route_iq_founder_authority_invalid",
  );
  assertExactKeys(
    authority.claims,
    ["purpose", "principalType", "workspaceId", "operatingProfileId"],
    "route_iq_founder_authority_claims_invalid",
  );
  if (
    ![
      "infrastructure_keyed_attestation",
      "infrastructure_verified_producer_signature",
    ].includes(authority.verificationType) ||
    !["HMAC-SHA-256", "Ed25519"].includes(authority.algorithm) ||
    !HASH_ID_PATTERNS.key.test(authority.keyId) ||
    authority.claims.purpose !== "founder_shadow_read" ||
    authority.claims.principalType !== "founder" ||
    authority.claims.workspaceId !== CANONICAL_SCOPE.workspaceId ||
    authority.claims.operatingProfileId !== CANONICAL_SCOPE.operatingProfileId
  ) {
    throw new ProspectiveIntelligenceError("route_iq_founder_read_forbidden");
  }
}

export function buildFounderShadowReadinessAggregate({
  verifiedAuthority,
  canonicalProductionProjections = [],
} = {}) {
  requireFounderAuthority(verifiedAuthority);
  if (!Array.isArray(canonicalProductionProjections)) {
    throw new ProspectiveIntelligenceError("route_iq_founder_projection_set_invalid");
  }
  const admitted = canonicalProductionProjections.filter(
    (projection) =>
      projection?.recordOrigin === "prospective" &&
      projection?.opportunityType === "next_stop" &&
      projection?.state === "SHADOW_DECISION_SEALED" &&
      projection?.readinessEvidenceEligible === true &&
      projection?.recommendationInfluence === "off",
  );
  const body = {
    schemaVersion: shadowDecisionFounderAggregateSchemaVersion,
    state: "INSUFFICIENT_EVIDENCE",
    counts: {
      canonicalProductionProspectiveRecords: admitted.length,
      linkedScoreableOutcomesAfterExclusions: 0,
    },
    methodology: {
      requiredLinkedScoreableOutcomesAfterExclusions: 97,
      calibrationBinCount: 5,
      minimumSupportedObservationsPerBin: 20,
      minimumObservationsToSupportAllBins: 100,
      interpretation:
        "observational_only_no_counterfactual_causal_or_uplift_claim",
    },
    readModel: "founder_only_keyed_aggregate",
    candidateRecordsExposed: false,
    representativeRecordsExposed: false,
    recommendationInfluence: "OFF",
  };
  return deepFreeze({
    ...body,
    aggregateSha256: computeShadowDecisionRuntimeSha256(body),
  });
}
