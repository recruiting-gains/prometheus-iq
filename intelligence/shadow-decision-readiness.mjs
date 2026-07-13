import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  projectRouteIqChronologicalEvidence,
  routeIqChronologicalEvidenceProjectionVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

export const shadowDecisionReadinessVersion =
  "route-iq-shadow-decision-readiness-v1";
export const readinessStates = Object.freeze([
  "INSUFFICIENT_EVIDENCE",
  "OBSERVING",
  "ELIGIBLE_FOR_FOUNDER_REVIEW",
]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
const stableId = (prefix, value) => `${prefix}-${hash(value).slice(0, 20)}`;
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const canonicalTime = (value, code) => {
  const time = Date.parse(value);
  if (
    typeof value !== "string" ||
    !Number.isFinite(time) ||
    new Date(time).toISOString() !== value
  )
    throw new Error(code);
  return time;
};
const average = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
const nonblank = (value) =>
  typeof value === "string" && value.trim() === value && value.length > 0;
const sha256Pattern = /^[a-f0-9]{64}$/;
const trustedLedgers = new WeakSet();
const requiredScopeKeys = [
  "workspaceId",
  "operatingProfileId",
  "representativeId",
];

const withoutKeys = (value, keys) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );

function validateProjectionDigest(projection, decisionTimestamp, scope) {
  if (
    !projection ||
    projection.projectionVersion !==
      routeIqChronologicalEvidenceProjectionVersion ||
    projection.decisionTimestamp !== decisionTimestamp ||
    !sha256Pattern.test(projection.projectionSha256) ||
    requiredScopeKeys.some((key) => projection.scope?.[key] !== scope[key])
  )
    throw new Error("projection_provenance_invalid");
  const body = withoutKeys(projection, ["projectionSha256"]);
  if (hash(body) !== projection.projectionSha256)
    throw new Error("projection_digest_mismatch");
  return true;
}

function frozenCandidateSnapshot(record) {
  return {
    immutableSourceManifest: clone(record.immutableSourceManifest),
    candidates: record.rankedCandidateDecisions
      .map((candidate) => ({
        decisionId: candidate.decisionId,
        weight: candidate.weight,
        availableAt: candidate.availableAt,
        evidenceSourceIds: clone(candidate.evidenceSourceIds || []),
        evidenceSourceHashes: clone(candidate.evidenceSourceHashes || []),
        eligibilityReasons: clone(candidate.eligibilityReasons),
      }))
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId)),
  };
}

export function loadShadowDecisionConfig() {
  return json("intelligence/config/shadow-decision-readiness-v1.json");
}
export function loadShadowDecisionContract() {
  return json(
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
  );
}

export function requiredSampleSize(config) {
  const z = config.confidenceLevel === 0.95 ? 1.96 : NaN;
  const p = Number(config.conservativeProportion);
  const e = Number(config.maximumMarginOfError);
  if (![z, p, e].every(Number.isFinite) || p <= 0 || p >= 1 || e <= 0 || e >= 1)
    throw new Error("statistical_sufficiency_config_invalid");
  return Math.ceil((z ** 2 * p * (1 - p)) / e ** 2);
}

export function derivedSupport(config) {
  const sample = requiredSampleSize(config);
  const windows = Number(config.minimumEvaluationWindows);
  const bins = Number(config.calibrationBinCount);
  if (
    !Number.isInteger(windows) ||
    windows < 2 ||
    !Number.isInteger(bins) ||
    bins < 2
  )
    throw new Error("support_design_invalid");
  return {
    sample,
    perCalibrationBin: Math.ceil(sample / bins),
    perSegment: Math.ceil(sample * Number(config.materialSegmentFraction)),
    windowMinimums: Array.from(
      { length: windows },
      (_, index) =>
        Math.floor(sample / windows) + (index < sample % windows ? 1 : 0),
    ),
  };
}

export function validateChronologicalWindows(windows) {
  if (!Array.isArray(windows) || !windows.length)
    throw new Error("evaluation_windows_missing");
  const ordered = [...windows].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  for (let index = 0; index < ordered.length; index += 1) {
    const item = ordered[index];
    if (
      !item.id ||
      !["training", "evaluation"].includes(item.kind) ||
      !(
        canonicalTime(item.start, `evaluation_window_invalid:${item.id}`) <
        canonicalTime(item.endExclusive, `evaluation_window_invalid:${item.id}`)
      )
    )
      throw new Error(`evaluation_window_invalid:${item.id}`);
    if (
      index &&
      Date.parse(item.start) < Date.parse(ordered[index - 1].endExclusive)
    )
      throw new Error(
        `evaluation_window_overlap:${ordered[index - 1].id}:${item.id}`,
      );
  }
  const firstEvaluation = ordered.find((item) => item.kind === "evaluation");
  if (
    !firstEvaluation ||
    ordered.filter((item) => item.kind === "evaluation").length < 2
  )
    throw new Error("evaluation_windows_insufficient");
  if (
    ordered.some(
      (item) =>
        item.kind === "training" &&
        Date.parse(item.endExclusive) > Date.parse(firstEvaluation.start),
    )
  )
    throw new Error("training_evaluation_overlap");
  return ordered;
}

export function validateRankedCandidates(candidates) {
  if (!Array.isArray(candidates) || !candidates.length)
    throw new Error("ranked_candidates_missing");
  const ids = new Set();
  let total = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (
      typeof candidate.decisionId !== "string" ||
      !candidate.decisionId.trim() ||
      candidate.decisionId !== candidate.decisionId.trim() ||
      ids.has(candidate.decisionId)
    )
      throw new Error("candidate_decision_id_invalid");
    ids.add(candidate.decisionId);
    if (
      !Number.isFinite(candidate.probability) ||
      candidate.probability < 0 ||
      candidate.probability > 1
    )
      throw new Error("candidate_probability_invalid");
    if (
      candidate.rank !== index + 1 ||
      candidate.tieBreakRule !== "probability_desc_then_decision_id_ascending"
    )
      throw new Error("candidate_ranking_not_deterministic");
    if (
      index &&
      (candidate.probability > candidates[index - 1].probability ||
        (candidate.probability === candidates[index - 1].probability &&
          candidate.decisionId.localeCompare(candidates[index - 1].decisionId) <
            0))
    )
      throw new Error("candidate_order_invalid");
    total += candidate.probability;
  }
  if (Math.abs(total - 1) > 1e-12)
    throw new Error("candidate_probabilities_must_sum_one");
  return true;
}

export function generateShadowDecision({
  opportunity,
  projection,
  config = loadShadowDecisionConfig(),
}) {
  if (!opportunity || !projection)
    throw new Error("opportunity_context_incomplete");
  const cutoff = canonicalTime(
    opportunity.timestamp,
    "opportunity_timestamp_invalid",
  );
  if (
    !nonblank(opportunity.opportunityId) ||
    !Array.isArray(opportunity.candidateSnapshot) ||
    !opportunity.candidateSnapshot.length ||
    requiredScopeKeys.some((key) => !nonblank(opportunity.scope?.[key]))
  )
    throw new Error("opportunity_context_incomplete");
  if (
    !nonblank(opportunity.evidenceSchemaVersion) ||
    !nonblank(config.configVersion) ||
    !nonblank(projection.projectionVersion) ||
    projection.projectionVersion !==
      routeIqChronologicalEvidenceProjectionVersion ||
    !sha256Pattern.test(projection.projectionSha256)
  )
    throw new Error("version_or_projection_provenance_invalid");
  if (
    requiredScopeKeys.some(
      (key) =>
        opportunity.scope[key] === "unknown" ||
        (config.scope?.[key] && opportunity.scope[key] !== config.scope[key]),
    )
  )
    throw new Error("opportunity_scope_not_authorized");
  validateProjectionDigest(
    projection,
    opportunity.timestamp,
    opportunity.scope,
  );
  if (
    projection.decisionTimestamp !== opportunity.timestamp ||
    projection.evidence?.some(
      (item) =>
        canonicalTime(item.evidenceTimestamp, "evidence_timestamp_invalid") >=
        cutoff,
    )
  )
    throw new Error("temporal_leakage_detected");
  if (
    !opportunity.sourceManifest ||
    typeof opportunity.sourceManifest !== "object" ||
    Array.isArray(opportunity.sourceManifest) ||
    !Object.keys(opportunity.sourceManifest).length
  )
    throw new Error("source_manifest_missing");
  const sourceManifest = {};
  for (const [manifestKey, source] of Object.entries(
    opportunity.sourceManifest,
  ).sort(([a], [b]) => a.localeCompare(b))) {
    if (
      !nonblank(manifestKey) ||
      !nonblank(source?.sourceId) ||
      !sha256Pattern.test(source?.sha256) ||
      canonicalTime(
        source?.availableAt,
        "source_manifest_available_at_invalid",
      ) >= cutoff
    )
      throw new Error("source_manifest_entry_invalid");
    sourceManifest[manifestKey] = {
      sourceId: source.sourceId,
      sha256: source.sha256,
      availableAt: source.availableAt,
    };
  }
  const manifestSources = Object.values(sourceManifest);
  const seen = new Set();
  const prepared = opportunity.candidateSnapshot.map((candidate) => {
    if (
      typeof candidate.decisionId !== "string" ||
      !candidate.decisionId.trim() ||
      candidate.decisionId !== candidate.decisionId.trim() ||
      seen.has(candidate.decisionId)
    )
      throw new Error("candidate_decision_id_invalid");
    seen.add(candidate.decisionId);
    if (!Number.isFinite(candidate.weight) || candidate.weight < 0)
      throw new Error("candidate_weight_invalid");
    if (
      canonicalTime(candidate.availableAt, "candidate_available_at_invalid") >=
      cutoff
    )
      throw new Error("candidate_temporal_leakage_detected");
    if (
      (!Array.isArray(candidate.evidenceSourceIds) ||
        !candidate.evidenceSourceIds.length) &&
      (!Array.isArray(candidate.evidenceSourceHashes) ||
        !candidate.evidenceSourceHashes.length)
    )
      throw new Error("candidate_evidence_provenance_missing");
    if (
      (candidate.evidenceSourceIds || []).some(
        (value) =>
          !nonblank(value) ||
          !manifestSources.some((source) => source.sourceId === value),
      ) ||
      (candidate.evidenceSourceHashes || []).some(
        (value) =>
          !sha256Pattern.test(value) ||
          !manifestSources.some((source) => source.sha256 === value),
      )
    )
      throw new Error("candidate_evidence_reference_unresolved");
    if (
      !Array.isArray(candidate.eligibilityReasons) ||
      !candidate.eligibilityReasons.length ||
      candidate.eligibilityReasons.some((value) => !nonblank(value))
    )
      throw new Error("candidate_eligibility_reasons_missing");
    return {
      decisionId: candidate.decisionId,
      weight: candidate.weight,
      availableAt: candidate.availableAt,
      evidenceSourceIds: clone(candidate.evidenceSourceIds || []),
      evidenceSourceHashes: clone(candidate.evidenceSourceHashes || []),
      eligibilityReasons: clone(candidate.eligibilityReasons),
    };
  });
  const total = prepared.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) throw new Error("candidate_weight_total_invalid");
  const probabilities = prepared
    .map((item) => ({ ...item, probability: item.weight / total }))
    .sort(
      (a, b) =>
        b.probability - a.probability ||
        a.decisionId.localeCompare(b.decisionId),
    );
  const ranked = probabilities.map((item, index) => ({
    rank: index + 1,
    ...item,
    tieBreakRule: "probability_desc_then_decision_id_ascending",
  }));
  validateRankedCandidates(ranked);
  const snapshot = {
    immutableSourceManifest: sourceManifest,
    candidates: prepared
      .map((item) => clone(item))
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId)),
  };
  const body = {
    opportunityId: opportunity.opportunityId,
    timestamp: opportunity.timestamp,
    rankedCandidateDecisions: ranked,
    confidence: Math.max(...ranked.map((item) => item.probability)),
    evidenceCutoff: opportunity.timestamp,
    versions: {
      engine: shadowDecisionReadinessVersion,
      evidenceSchema: opportunity.evidenceSchemaVersion,
      projection: projection.projectionVersion,
      ruleModelConfig: config.configVersion,
    },
    eligibilityReasons: [
      "frozen_candidate_snapshot_present",
      "strictly_pre_cutoff_projection_valid",
    ],
    exclusionReasons: [],
    immutableSourceManifest: sourceManifest,
    frozenCandidateSnapshotSha256: hash(snapshot),
    scope: clone(opportunity.scope),
    projectionSha256: projection.projectionSha256,
  };
  return freeze({
    shadowDecisionId: stableId("shadow-decision", body),
    ...body,
    shadowRecordSha256: hash(body),
  });
}

export function validateShadowDecisionRecord(
  record,
  config = loadShadowDecisionConfig(),
) {
  if (
    !record ||
    !nonblank(record.opportunityId) ||
    record.evidenceCutoff !== record.timestamp ||
    !Array.isArray(record.eligibilityReasons) ||
    !record.eligibilityReasons.length ||
    record.eligibilityReasons.some((value) => !nonblank(value)) ||
    !Array.isArray(record.exclusionReasons) ||
    record.exclusionReasons.length ||
    requiredScopeKeys.some(
      (key) =>
        !nonblank(record.scope?.[key]) ||
        record.scope[key] !== config.scope?.[key],
    ) ||
    record.versions?.engine !== shadowDecisionReadinessVersion ||
    record.versions?.projection !==
      routeIqChronologicalEvidenceProjectionVersion ||
    record.versions?.ruleModelConfig !== config.configVersion ||
    !nonblank(record.versions?.evidenceSchema) ||
    !sha256Pattern.test(record.projectionSha256)
  )
    throw new Error("shadow_record_contract_invalid");
  const cutoff = canonicalTime(record.timestamp, "shadow_timestamp_invalid");
  validateRankedCandidates(record.rankedCandidateDecisions);
  const sources = Object.values(record.immutableSourceManifest || {});
  if (!sources.length) throw new Error("shadow_record_source_manifest_missing");
  for (const source of sources)
    if (
      !nonblank(source?.sourceId) ||
      !sha256Pattern.test(source?.sha256) ||
      canonicalTime(
        source?.availableAt,
        "shadow_source_available_at_invalid",
      ) >= cutoff
    )
      throw new Error("shadow_record_source_manifest_invalid");
  for (const candidate of record.rankedCandidateDecisions) {
    if (
      canonicalTime(
        candidate.availableAt,
        "shadow_candidate_available_at_invalid",
      ) >= cutoff ||
      (!candidate.evidenceSourceIds?.length &&
        !candidate.evidenceSourceHashes?.length) ||
      candidate.evidenceSourceIds?.some(
        (id) => !sources.some((source) => source.sourceId === id),
      ) ||
      candidate.evidenceSourceHashes?.some(
        (value) => !sources.some((source) => source.sha256 === value),
      ) ||
      !candidate.eligibilityReasons?.length ||
      candidate.eligibilityReasons.some((value) => !nonblank(value))
    )
      throw new Error("shadow_candidate_provenance_invalid");
  }
  if (
    hash(frozenCandidateSnapshot(record)) !==
    record.frozenCandidateSnapshotSha256
  )
    throw new Error("frozen_candidate_snapshot_digest_mismatch");
  const body = withoutKeys(record, ["shadowDecisionId", "shadowRecordSha256"]);
  if (
    hash(body) !== record.shadowRecordSha256 ||
    stableId("shadow-decision", body) !== record.shadowDecisionId
  )
    throw new Error("shadow_record_digest_mismatch");
  return true;
}

export function createShadowExclusion({
  opportunityId,
  visitId = null,
  timestamp,
  reasonCodes,
  projection,
  scope,
  evidenceSchemaVersion,
  config = loadShadowDecisionConfig(),
}) {
  if (
    !nonblank(opportunityId) ||
    (visitId !== null && !nonblank(visitId)) ||
    !Array.isArray(reasonCodes) ||
    !reasonCodes.length ||
    reasonCodes.some((value) => !nonblank(value)) ||
    !nonblank(evidenceSchemaVersion) ||
    requiredScopeKeys.some(
      (key) => !nonblank(scope?.[key]) || scope[key] !== config.scope?.[key],
    )
  )
    throw new Error("shadow_exclusion_contract_invalid");
  canonicalTime(timestamp, "shadow_exclusion_timestamp_invalid");
  validateProjectionDigest(projection, timestamp, scope);
  const body = {
    opportunityId,
    visitId,
    timestamp,
    evidenceCutoff: timestamp,
    scope: clone(scope),
    reasonCodes: clone(reasonCodes),
    versions: {
      engine: shadowDecisionReadinessVersion,
      evidenceSchema: evidenceSchemaVersion,
      projection: projection.projectionVersion,
      ruleModelConfig: config.configVersion,
    },
    projectionSha256: projection.projectionSha256,
    projectionEvidenceCount: projection.evidence.length,
    equalOrFutureEvidenceExcluded: projection.exclusions.filter((item) =>
      [
        "at_decision_timestamp_without_prior_availability",
        "after_decision_timestamp",
      ].includes(item.reason),
    ).length,
  };
  return freeze({
    exclusionId: stableId("shadow-exclusion", body),
    ...body,
    exclusionRecordSha256: hash(body),
  });
}

export function validateShadowExclusion(
  exclusion,
  config = loadShadowDecisionConfig(),
) {
  if (
    !exclusion ||
    !nonblank(exclusion.opportunityId) ||
    exclusion.evidenceCutoff !== exclusion.timestamp ||
    !Array.isArray(exclusion.reasonCodes) ||
    !exclusion.reasonCodes.length ||
    exclusion.reasonCodes.some((value) => !nonblank(value)) ||
    !Number.isInteger(exclusion.projectionEvidenceCount) ||
    exclusion.projectionEvidenceCount < 0 ||
    !Number.isInteger(exclusion.equalOrFutureEvidenceExcluded) ||
    exclusion.equalOrFutureEvidenceExcluded < 0 ||
    !sha256Pattern.test(exclusion.projectionSha256) ||
    exclusion.versions?.engine !== shadowDecisionReadinessVersion ||
    exclusion.versions?.projection !==
      routeIqChronologicalEvidenceProjectionVersion ||
    exclusion.versions?.ruleModelConfig !== config.configVersion ||
    !nonblank(exclusion.versions?.evidenceSchema) ||
    requiredScopeKeys.some(
      (key) =>
        !nonblank(exclusion.scope?.[key]) ||
        exclusion.scope[key] !== config.scope?.[key],
    )
  )
    throw new Error("shadow_exclusion_contract_invalid");
  canonicalTime(exclusion.timestamp, "shadow_exclusion_timestamp_invalid");
  const body = withoutKeys(exclusion, ["exclusionId", "exclusionRecordSha256"]);
  if (
    hash(body) !== exclusion.exclusionRecordSha256 ||
    stableId("shadow-exclusion", body) !== exclusion.exclusionId
  )
    throw new Error("shadow_exclusion_digest_mismatch");
  return true;
}

function immutableShadowLedgerBody(ledger) {
  return {
    batchId: ledger.batchId,
    schemaVersion: ledger.schemaVersion,
    engineVersion: ledger.engineVersion,
    scope: clone(ledger.scope),
    opportunityManifest: clone(ledger.opportunityManifest),
    immutable: ledger.immutable,
    founderOnly: ledger.founderOnly,
    readOnly: ledger.readOnly,
    recommendationInfluence: ledger.recommendationInfluence,
    records: clone(ledger.records),
    exclusions: clone(ledger.exclusions),
  };
}

function outcomeHashState(shadowLedgerSha256, outcomeLinks) {
  const outcomeChainSha256 = hash({ shadowLedgerSha256, outcomeLinks });
  return {
    outcomeChainSha256,
    evaluationLedgerSha256: hash({
      shadowLedgerSha256,
      outcomeChainSha256,
      outcomeLinkCount: outcomeLinks.length,
    }),
  };
}

export function sealShadowLedger(ledger, config = loadShadowDecisionConfig()) {
  if (ledger.outcomeLinks?.length)
    throw new Error("seal_shadow_ledger_requires_empty_outcome_chain");
  validateProspectiveLedgerCompleteness(
    ledger.opportunityManifest,
    ledger.records,
    ledger.exclusions,
    config,
  );
  const body = immutableShadowLedgerBody(ledger);
  const shadowLedgerSha256 = hash(body);
  const outcomeLinks = clone(ledger.outcomeLinks || []);
  const outcomeState = outcomeHashState(shadowLedgerSha256, outcomeLinks);
  const sealed = freeze({
    ...body,
    outcomeLinks,
    shadowLedgerSha256,
    ledgerSha256: shadowLedgerSha256,
    ...outcomeState,
  });
  trustedLedgers.add(sealed);
  return sealed;
}

function validateLedgerDigests(ledger, config = loadShadowDecisionConfig()) {
  if (trustedLedgers.has(ledger)) return true;
  const shadowLedgerSha256 = hash(immutableShadowLedgerBody(ledger));
  if (
    ledger.shadowLedgerSha256 !== shadowLedgerSha256 ||
    ledger.ledgerSha256 !== shadowLedgerSha256
  )
    throw new Error("shadow_ledger_digest_mismatch");
  for (const link of ledger.outcomeLinks || []) {
    const body = withoutKeys(link, ["outcomeLinkSha256"]);
    if (hash(body) !== link.outcomeLinkSha256)
      throw new Error("outcome_link_digest_mismatch");
  }
  const outcomeState = outcomeHashState(
    shadowLedgerSha256,
    ledger.outcomeLinks || [],
  );
  if (
    ledger.outcomeChainSha256 !== outcomeState.outcomeChainSha256 ||
    ledger.evaluationLedgerSha256 !== outcomeState.evaluationLedgerSha256
  )
    throw new Error("outcome_chain_digest_mismatch");
  validateProspectiveLedgerCompleteness(
    ledger.opportunityManifest,
    ledger.records,
    ledger.exclusions,
    config,
  );
  trustedLedgers.add(ledger);
  return true;
}

export function appendOutcomeLink(ledger, link) {
  validateLedgerDigests(ledger);
  const record = ledger.records.find(
    (item) => item.shadowDecisionId === link?.shadowDecisionId,
  );
  if (!record) throw new Error("outcome_shadow_decision_missing");
  if (
    typeof link.linkId !== "string" ||
    !link.linkId.trim() ||
    ledger.outcomeLinks.some((item) => item.linkId === link.linkId)
  )
    throw new Error("outcome_link_id_invalid");
  if (
    !["original", "late", "correction", "conflict", "missing"].includes(
      link.relation,
    )
  )
    throw new Error("outcome_relation_invalid");
  const prior = ledger.outcomeLinks.find(
    (item) =>
      item.linkId === link.priorLinkId &&
      item.shadowDecisionId === link.shadowDecisionId,
  );
  if (
    ["original", "missing"].includes(link.relation)
      ? link.priorLinkId !== null
      : !prior
  )
    throw new Error("outcome_prior_link_invalid");
  const latestForShadow = ledger.outcomeLinks
    .filter((item) => item.shadowDecisionId === link.shadowDecisionId)
    .at(-1);
  if (
    !["original", "missing"].includes(link.relation) &&
    latestForShadow?.linkId !== link.priorLinkId
  )
    throw new Error("outcome_chain_fork_invalid");
  if (
    ["original", "missing"].includes(link.relation) &&
    ledger.outcomeLinks.some(
      (item) =>
        item.shadowDecisionId === link.shadowDecisionId &&
        ["original", "missing"].includes(item.relation),
    )
  )
    throw new Error("second_root_outcome_link");
  if (
    ["original", "late", "correction", "conflict"].includes(link.relation) &&
    canonicalTime(link.observedAt, "outcome_timestamp_invalid") <=
      canonicalTime(record.timestamp, "shadow_timestamp_invalid")
  )
    throw new Error("outcome_not_after_shadow_decision");
  if (link.relation === "missing" && link.observedAt !== null)
    throw new Error("missing_outcome_timestamp_must_be_null");
  if (
    prior?.observedAt &&
    link.observedAt &&
    Date.parse(link.observedAt) <= Date.parse(prior.observedAt)
  )
    throw new Error("outcome_link_not_after_prior_link");
  for (const key of ["workspaceId", "operatingProfileId", "representativeId"])
    if (link.scope?.[key] !== record.scope?.[key])
      throw new Error("outcome_scope_contaminated");
  if (
    link.actualDecisionId !== null &&
    (typeof link.actualDecisionId !== "string" || !link.actualDecisionId.trim())
  )
    throw new Error("actual_decision_id_invalid");
  const observed = link.observedOutcome;
  if (
    !observed ||
    !["observed", "missing", "unresolved_conflict"].includes(observed.status) ||
    (observed.status === "observed"
      ? typeof observed.value !== "boolean"
      : observed.value !== null)
  )
    throw new Error("observed_outcome_invalid");
  if (link.relation === "missing" && observed.status !== "missing")
    throw new Error("outcome_relation_status_inconsistent");
  if (link.relation === "conflict" && observed.status !== "unresolved_conflict")
    throw new Error("outcome_relation_status_inconsistent");
  if (
    ["original", "late", "correction"].includes(link.relation) &&
    observed.status !== "observed"
  )
    throw new Error("outcome_relation_status_inconsistent");
  if (observed.status === "observed" && !nonblank(observed.evaluatedDecisionId))
    throw new Error("evaluated_decision_id_invalid");
  if (observed.status !== "observed" && observed.evaluatedDecisionId !== null)
    throw new Error("unavailable_outcome_evaluated_decision_must_be_null");
  const suppliedLink = withoutKeys(clone(link), ["outcomeLinkSha256"]);
  const governedLinkBody = {
    ...suppliedLink,
    actionDisposition:
      link.actualDecisionId === null
        ? "unavailable"
        : record.rankedCandidateDecisions.some(
              (item) => item.decisionId === link.actualDecisionId,
            )
          ? "ranked"
          : "off_list",
    decisionAgreement:
      link.actualDecisionId === null
        ? null
        : record.rankedCandidateDecisions[0].decisionId ===
          link.actualDecisionId,
    outcomeDisposition:
      observed.status !== "observed"
        ? "unavailable"
        : record.rankedCandidateDecisions.some(
              (item) => item.decisionId === observed.evaluatedDecisionId,
            )
          ? "ranked"
          : "off_list",
  };
  const governedLink = freeze({
    ...governedLinkBody,
    outcomeLinkSha256: hash(governedLinkBody),
  });
  if (
    link.outcomeLinkSha256 &&
    link.outcomeLinkSha256 !== governedLink.outcomeLinkSha256
  )
    throw new Error("outcome_link_digest_mismatch");
  const originalHashes = ledger.records.map((item) => item.shadowRecordSha256);
  const outcomeLinks = [...ledger.outcomeLinks, governedLink];
  const outcomeState = outcomeHashState(
    ledger.shadowLedgerSha256,
    outcomeLinks,
  );
  const next = freeze({
    ...ledger,
    outcomeLinks,
    ...outcomeState,
  });
  trustedLedgers.add(next);
  if (
    canonical(originalHashes) !==
    canonical(next.records.map((item) => item.shadowRecordSha256))
  )
    throw new Error("shadow_record_rewrite_detected");
  return next;
}

export function validateOutcomeLedger(ledger) {
  validateLedgerDigests(ledger);
  let replay = sealShadowLedger({ ...ledger, outcomeLinks: [] });
  for (const link of ledger.outcomeLinks)
    replay = appendOutcomeLink(replay, link);
  if (
    canonical(replay.outcomeLinks) !== canonical(ledger.outcomeLinks) ||
    replay.outcomeChainSha256 !== ledger.outcomeChainSha256 ||
    replay.evaluationLedgerSha256 !== ledger.evaluationLedgerSha256
  )
    throw new Error("outcome_chain_canonical_mismatch");
  return true;
}

export function buildCommittedArchiveRecord(paths) {
  const texts = Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [
      name,
      readFileSync(resolve(root, path), "utf8"),
    ]),
  );
  const normalizedRecord = JSON.parse(texts.normalized);
  return {
    commit: {
      status: "committed",
      workspaceId: normalizedRecord.workspaceId,
      sessionId: normalizedRecord.sessionId,
      operatingProfileId: normalizedRecord.operatingProfileId,
      rawSha256: hash(texts.raw),
    },
    rawReportText: texts.raw,
    normalizedRecord,
    calculatedMetrics: JSON.parse(texts.calculated),
    stressTestEvidence: JSON.parse(texts.stressTestEvidence),
    historyUpdates: JSON.parse(texts.historyUpdates),
    sourceArtifacts: Object.fromEntries(
      Object.entries(texts).map(([name, text]) => [
        name,
        {
          key: paths[name],
          text,
          sha256: hash(text),
          byteLength: Buffer.byteLength(text),
        },
      ]),
    ),
  };
}

export function validateProspectiveLedgerCompleteness(
  opportunityManifest,
  records,
  exclusions,
  config = loadShadowDecisionConfig(),
) {
  if (!Array.isArray(opportunityManifest) || !opportunityManifest.length)
    throw new Error("opportunity_manifest_missing");
  const manifestIds = opportunityManifest.map((item) => item.opportunityId);
  if (
    opportunityManifest.some(
      (item) =>
        !nonblank(item?.opportunityId) ||
        !Number.isFinite(
          canonicalTime(
            item?.timestamp,
            "opportunity_manifest_timestamp_invalid",
          ),
        ),
    ) ||
    new Set(manifestIds).size !== manifestIds.length
  )
    throw new Error("opportunity_manifest_id_invalid");
  records.forEach((record) => validateShadowDecisionRecord(record, config));
  exclusions.forEach((item) => validateShadowExclusion(item, config));
  const recordIds = records.map((item) => item.opportunityId),
    exclusionIds = exclusions.map((item) => item.opportunityId);
  if (
    new Set(recordIds).size !== recordIds.length ||
    new Set(exclusionIds).size !== exclusionIds.length
  )
    throw new Error("opportunity_disposition_duplicate");
  for (const opportunityId of manifestIds) {
    const dispositions =
      recordIds.filter((id) => id === opportunityId).length +
      exclusionIds.filter((id) => id === opportunityId).length;
    if (dispositions !== 1)
      throw new Error(
        dispositions
          ? "opportunity_dual_disposition"
          : "opportunity_disposition_missing",
      );
  }
  if ([...recordIds, ...exclusionIds].some((id) => !manifestIds.includes(id)))
    throw new Error("undeclared_opportunity_disposition");
  for (const manifestItem of opportunityManifest) {
    const disposition =
      records.find(
        (item) => item.opportunityId === manifestItem.opportunityId,
      ) ||
      exclusions.find(
        (item) => item.opportunityId === manifestItem.opportunityId,
      );
    if (disposition?.timestamp !== manifestItem.timestamp)
      throw new Error("opportunity_manifest_timestamp_mismatch");
  }
  return true;
}

export function buildProspectiveShadowLedger({
  opportunities,
  batchId = "BATCH-20260713-001",
  config = loadShadowDecisionConfig(),
}) {
  const manifest = opportunities.map((item) => ({
    opportunityId: item.opportunity.opportunityId,
    timestamp: item.opportunity.timestamp,
  }));
  const records = [],
    exclusions = [];
  for (const item of opportunities) {
    if (item.exclusionReason)
      exclusions.push(
        createShadowExclusion({
          opportunityId: item.opportunity.opportunityId,
          timestamp: item.opportunity.timestamp,
          reasonCodes: [item.exclusionReason],
          projection: item.projection,
          scope: item.opportunity.scope,
          evidenceSchemaVersion: item.opportunity.evidenceSchemaVersion,
          config,
        }),
      );
    else
      records.push(
        generateShadowDecision({
          opportunity: item.opportunity,
          projection: item.projection,
          config,
        }),
      );
  }
  validateProspectiveLedgerCompleteness(manifest, records, exclusions);
  return sealShadowLedger(
    {
      batchId,
      schemaVersion: "route-iq-shadow-ledger-v1",
      engineVersion: shadowDecisionReadinessVersion,
      scope: clone(config.scope),
      opportunityManifest: manifest,
      immutable: true,
      records,
      exclusions,
      outcomeLinks: [],
      recommendationInfluence: "OFF",
      founderOnly: true,
      readOnly: true,
    },
    config,
  );
}

export function buildShadowLedger({
  archiveRecord,
  contract = loadShadowDecisionContract(),
  config = loadShadowDecisionConfig(),
}) {
  validateChronologicalWindows(config.windows);
  const records = [],
    exclusions = [],
    scope = contract.scope;
  for (const visit of archiveRecord.normalizedRecord.verifiedFields
    .completedVisits) {
    const timestamp = visit.sourceReport?.timestamp;
    const projection = projectRouteIqChronologicalEvidence({
      archiveRecord,
      decisionTimestamp: timestamp,
      ...scope,
    });
    const opportunityId = stableId("decision-opportunity", [
      archiveRecord.normalizedRecord.sessionId,
      visit.visitId,
      timestamp,
    ]);
    // Historical Data records deliberately are not reinterpreted as frozen prospective candidate snapshots.
    exclusions.push(
      createShadowExclusion({
        opportunityId,
        visitId: visit.visitId,
        timestamp,
        reasonCodes: [
          "historically_frozen_prospective_candidate_context_missing",
          "historically_frozen_recommendation_context_missing",
        ],
        projection,
        scope,
        evidenceSchemaVersion: "route-iq-field-session-archive-v1",
        config,
      }),
    );
  }
  if (
    records.length + exclusions.length !==
    archiveRecord.normalizedRecord.verifiedFields.completedVisits.length
  )
    throw new Error("opportunity_completeness_failed");
  const opportunityManifest = exclusions.map((item) => ({
    opportunityId: item.opportunityId,
    timestamp: item.timestamp,
  }));
  validateProspectiveLedgerCompleteness(
    opportunityManifest,
    records,
    exclusions,
  );
  return sealShadowLedger(
    {
      batchId: contract.batchId,
      schemaVersion: "route-iq-shadow-ledger-v1",
      engineVersion: shadowDecisionReadinessVersion,
      scope,
      opportunityManifest,
      immutable: true,
      founderOnly: true,
      readOnly: true,
      recommendationInfluence: "OFF",
      records,
      exclusions,
      outcomeLinks: [],
    },
    config,
  );
}

function effectiveOutcomes(ledger) {
  return ledger.records
    .map((record) => {
      const links = ledger.outcomeLinks.filter(
        (link) => link.shadowDecisionId === record.shadowDecisionId,
      );
      const latest = links.at(-1);
      if (
        !latest ||
        latest.observedOutcome?.status !== "observed" ||
        typeof latest.observedOutcome.value !== "boolean" ||
        latest.observedOutcome.evaluatedDecisionId !==
          record.rankedCandidateDecisions[0].decisionId
      )
        return null;
      return { record, link: latest };
    })
    .filter(Boolean);
}

function latestOutcomeLink(ledger, record) {
  return ledger.outcomeLinks
    .filter((item) => item.shadowDecisionId === record.shadowDecisionId)
    .at(-1);
}

function effectiveActions(ledger) {
  return ledger.records
    .map((record) => {
      const link = latestOutcomeLink(ledger, record);
      return link?.actualDecisionId ? { record, link } : null;
    })
    .filter(Boolean);
}

function eligibleInventory(ledger, windows) {
  return ledger.records
    .map((record) => ({
      record,
      link: latestOutcomeLink(ledger, record) || null,
      window: windowFor(record.timestamp, windows),
    }))
    .filter((item) => item.window);
}

function isScoreableSelectedCandidateOutcome(item) {
  return Boolean(
    item.link?.observedOutcome?.status === "observed" &&
    typeof item.link.observedOutcome.value === "boolean" &&
    item.link.observedOutcome.evaluatedDecisionId ===
      item.record.rankedCandidateDecisions[0].decisionId,
  );
}

function windowFor(timestamp, windows) {
  return (
    windows.find(
      (window) =>
        Date.parse(timestamp) >= Date.parse(window.start) &&
        Date.parse(timestamp) < Date.parse(window.endExclusive),
    ) || null
  );
}
function decisionDistribution(items) {
  const counts = {};
  for (const item of items) {
    const key = item.record.rankedCandidateDecisions[0].decisionId;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}
function decisionAgreement(items) {
  const available = items.filter((item) => item.link.actualDecisionId !== null);
  return average(
    available.map((item) => (item.link.decisionAgreement ? 1 : 0)),
  );
}
function outcomeAccuracy(items) {
  return average(
    items.map((item) =>
      item.record.rankedCandidateDecisions[0].probability >= 0.5 ===
      item.link.observedOutcome.value
        ? 1
        : 0,
    ),
  );
}
function brier(items) {
  return average(
    items.map(
      (item) =>
        (item.record.rankedCandidateDecisions[0].probability -
          (item.link.observedOutcome.value ? 1 : 0)) **
        2,
    ),
  );
}
function calibration(items, binCount, perBinSupport) {
  const bins = Array.from({ length: binCount }, (_, index) => ({
    bin: index,
    lowerInclusive: index / binCount,
    upperInclusive: (index + 1) / binCount,
    items: [],
  }));
  for (const item of items)
    bins[
      Math.min(
        binCount - 1,
        Math.floor(
          item.record.rankedCandidateDecisions[0].probability * binCount,
        ),
      )
    ].items.push(item);
  const detail = bins.map((bin) => ({
    bin: bin.bin,
    lowerInclusive: bin.lowerInclusive,
    upperInclusive: bin.upperInclusive,
    support: bin.items.length,
    predictedMean: average(
      bin.items.map(
        (item) => item.record.rankedCandidateDecisions[0].probability,
      ),
    ),
    observedRate: average(
      bin.items.map((item) => (item.link.observedOutcome.value ? 1 : 0)),
    ),
    supported: bin.items.length >= perBinSupport,
  }));
  const supported = detail.filter((bin) => bin.supported);
  const populatedUnsupported = detail.some(
    (bin) => bin.support > 0 && !bin.supported,
  );
  const supportedTotal = supported.reduce((sum, bin) => sum + bin.support, 0);
  const calibrationSupport =
    !populatedUnsupported && supportedTotal === items.length && items.length > 0
      ? "SUPPORTED"
      : "NOT_MET";
  return {
    bins: detail,
    ece:
      calibrationSupport === "SUPPORTED"
        ? supported.reduce(
            (sum, bin) =>
              sum +
              (bin.support / supportedTotal) *
                Math.abs(bin.predictedMean - bin.observedRate),
            0,
          )
        : null,
    supportedBinCount: supported.length,
    calibrationSupport,
  };
}

function inventoryMetrics(items, config, requiredSupport) {
  const actions = items.filter(
    (item) =>
      item.link?.actualDecisionId !== null &&
      item.link?.actualDecisionId !== undefined,
  );
  const linked = items.filter((item) => item.link !== null);
  const scoreable = items.filter(isScoreableSelectedCandidateOutcome);
  const reliability = calibration(
    scoreable,
    config.calibrationBinCount,
    Math.max(1, Math.ceil(requiredSupport / config.calibrationBinCount)),
  );
  const eligibleDecisionCount = items.length;
  const materiallySupported = eligibleDecisionCount >= requiredSupport;
  const scoreableSupportMet = scoreable.length >= requiredSupport;
  const accuracy = outcomeAccuracy(scoreable);
  const brierScore = brier(scoreable);
  return {
    eligibleDecisionCount,
    actualActionLinkCount: actions.length,
    anyOutcomeLinkCount: linked.length,
    scoreableSelectedCandidateOutcomeCount: scoreable.length,
    offListActionCount: actions.filter(
      (item) => item.link.actionDisposition === "off_list",
    ).length,
    actualActionLinkRate: eligibleDecisionCount
      ? actions.length / eligibleDecisionCount
      : null,
    anyOutcomeLinkRate: eligibleDecisionCount
      ? linked.length / eligibleDecisionCount
      : null,
    scoreableSelectedCandidateOutcomeRate: eligibleDecisionCount
      ? scoreable.length / eligibleDecisionCount
      : null,
    decisionAgreement: decisionAgreement(actions),
    outcomeAccuracy: accuracy,
    brierScore,
    ece: reliability.ece,
    calibrationSupport: reliability.calibrationSupport,
    calibrationBins: reliability.bins,
    requiredSupport,
    materiallySupported,
    scoreableSupportMet,
    passes:
      !materiallySupported ||
      (scoreableSupportMet &&
        accuracy >= config.segmentMinimumAccuracy &&
        brierScore <= config.calibrationMaximumBrierScore &&
        reliability.calibrationSupport === "SUPPORTED" &&
        reliability.ece <= config.calibrationMaximumEce),
  };
}
function totalVariation(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const lt = Object.values(left).reduce((a, b) => a + b, 0),
    rt = Object.values(right).reduce((a, b) => a + b, 0);
  if (!lt || !rt) return null;
  return (
    0.5 *
    [...keys].reduce(
      (sum, key) =>
        sum + Math.abs((left[key] || 0) / lt - (right[key] || 0) / rt),
      0,
    )
  );
}

export function evaluateShadowDecisions(
  ledger,
  config = loadShadowDecisionConfig(),
) {
  validateProspectiveLedgerCompleteness(
    ledger.opportunityManifest,
    ledger.records,
    ledger.exclusions,
  );
  validateOutcomeLedger(ledger);
  const windows = validateChronologicalWindows(config.windows),
    support = derivedSupport(config),
    outcomes = effectiveOutcomes(ledger);
  const actions = effectiveActions(ledger);
  const inventory = eligibleInventory(ledger, windows);
  const assigned = outcomes
    .map((item) => ({
      ...item,
      window: windowFor(item.record.timestamp, windows),
    }))
    .filter((item) => item.window);
  const assignedActions = actions
    .map((item) => ({
      ...item,
      window: windowFor(item.record.timestamp, windows),
    }))
    .filter((item) => item.window);
  const training = assigned.filter((item) => item.window.kind === "training"),
    evaluationWindows = windows.filter((item) => item.kind === "evaluation");
  const firstEvaluationStart = evaluationWindows[0].start;
  const trainingInventory = inventory.filter(
    (item) => item.window.kind === "training",
  );
  for (const item of trainingInventory) {
    if (
      Date.parse(item.record.timestamp) >= Date.parse(firstEvaluationStart) ||
      Object.values(item.record.immutableSourceManifest || {}).some(
        (source) =>
          Date.parse(source.availableAt) >= Date.parse(firstEvaluationStart),
      )
    )
      throw new Error("training_evidence_after_evaluation_start");
    const outcomeLinks = ledger.outcomeLinks.filter(
      (link) => link.shadowDecisionId === item.record.shadowDecisionId,
    );
    if (
      outcomeLinks.some(
        (link) =>
          link.observedOutcome?.status === "observed" &&
          Date.parse(link.observedAt) >= Date.parse(firstEvaluationStart),
      )
    )
      throw new Error("training_outcome_after_evaluation_start");
  }
  if (
    training.some((item) =>
      evaluationWindows.some((window) => item.record.timestamp >= window.start),
    )
  )
    throw new Error("evaluation_evidence_entered_training");
  const evalGroups = evaluationWindows.map((window) =>
    assigned.filter((item) => item.window.id === window.id),
  );
  const evaluationInventoryGroups = evaluationWindows.map((window) =>
    inventory.filter((item) => item.window.id === window.id),
  );
  const manifestTokens = (item) =>
    Object.values(item.record.immutableSourceManifest || {}).flatMap(
      (source) => [source.sourceId, source.sha256],
    );
  const trainingTokens = new Set(training.flatMap(manifestTokens)),
    evaluationTokens = new Set(evalGroups.flat().flatMap(manifestTokens));
  if ([...trainingTokens].some((token) => evaluationTokens.has(token)))
    throw new Error("training_evaluation_source_overlap");
  const baselineProbability =
    training.length >= support.sample
      ? average(
          training.map((item) => (item.link.observedOutcome.value ? 1 : 0)),
        )
      : null;
  const allEval = evalGroups.flat(),
    aggregateAccuracy = outcomeAccuracy(allEval),
    aggregateCalibration = calibration(
      allEval,
      config.calibrationBinCount,
      support.perCalibrationBin,
    );
  const baselineAccuracy =
    baselineProbability === null
      ? null
      : average(
          allEval.map((item) =>
            baselineProbability >= 0.5 === item.link.observedOutcome.value
              ? 1
              : 0,
          ),
        );
  const baselineBrier =
    baselineProbability === null
      ? null
      : average(
          allEval.map(
            (item) =>
              (baselineProbability -
                (item.link.observedOutcome.value ? 1 : 0)) **
              2,
          ),
        );
  const windowMetrics = evaluationInventoryGroups.map((items, index) => {
    const requiredSupport =
      support.windowMinimums[index] ?? support.windowMinimums.at(-1);
    const metrics = inventoryMetrics(items, config, requiredSupport);
    return {
      windowId: evaluationWindows[index].id,
      ...metrics,
      linkedOutcomes: metrics.scoreableSelectedCandidateOutcomeCount,
      distribution: decisionDistribution(items),
    };
  });
  for (let index = 1; index < windowMetrics.length; index += 1) {
    const current = windowMetrics[index],
      prior = windowMetrics[index - 1];
    current.distributionTotalVariation = totalVariation(
      prior.distribution,
      current.distribution,
    );
    current.performanceStability = {
      accuracyDelta:
        current.outcomeAccuracy === null || prior.outcomeAccuracy === null
          ? null
          : Math.abs(current.outcomeAccuracy - prior.outcomeAccuracy),
      brierDelta:
        current.brierScore === null || prior.brierScore === null
          ? null
          : Math.abs(current.brierScore - prior.brierScore),
      eceDelta:
        current.ece === null || prior.ece === null
          ? null
          : Math.abs(current.ece - prior.ece),
    };
  }
  if (windowMetrics.length) {
    windowMetrics[0].distributionTotalVariation = null;
    windowMetrics[0].performanceStability = {
      accuracyDelta: null,
      brierDelta: null,
      eceDelta: null,
    };
  }
  const segmentDimensions = [
    "representativeId",
    "territoryId",
    "customerContext",
    "decisionType",
  ];
  const segments = {};
  for (const dimension of segmentDimensions) {
    const groups = new Map();
    for (const item of evaluationInventoryGroups.flat()) {
      const key = item.record.scope[dimension] ?? "unknown";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    segments[dimension] = groups.size
      ? Object.fromEntries(
          [...groups.entries()].sort().map(([key, items]) => {
            return [key, inventoryMetrics(items, config, support.perSegment)];
          }),
        )
      : {
          unknown: {
            eligibleDecisionCount: 0,
            actualActionLinkCount: 0,
            anyOutcomeLinkCount: 0,
            scoreableSelectedCandidateOutcomeCount: 0,
            offListActionCount: 0,
            actualActionLinkRate: null,
            anyOutcomeLinkRate: null,
            scoreableSelectedCandidateOutcomeRate: null,
            outcomeAccuracy: null,
            decisionAgreement: null,
            brierScore: null,
            ece: null,
            calibrationSupport: "NOT_MET",
            calibrationBins: calibration(
              [],
              config.calibrationBinCount,
              Math.ceil(support.perSegment / config.calibrationBinCount),
            ).bins,
            requiredSupport: support.perSegment,
            materiallySupported: false,
            scoreableSupportMet: false,
            passes: false,
          },
        };
  }
  segments.timeWindow = Object.fromEntries(
    windowMetrics.map((item) => [item.windowId, clone(item)]),
  );
  const consecutivePass =
    windowMetrics.length >= config.minimumConsecutivePassingWindows &&
    windowMetrics
      .slice(-config.minimumConsecutivePassingWindows)
      .every(
        (item, index) =>
          item.linkedOutcomes >= item.requiredSupport &&
          item.brierScore <= config.calibrationMaximumBrierScore &&
          item.calibrationSupport === "SUPPORTED" &&
          item.ece <= config.calibrationMaximumEce &&
          item.outcomeAccuracy >= config.minimumAccuracy &&
          (index === 0 ||
            (item.performanceStability.accuracyDelta <=
              config.stabilityMaximumAccuracyDelta &&
              item.performanceStability.brierDelta <=
                config.stabilityMaximumBrierDelta &&
              item.performanceStability.eceDelta <=
                config.stabilityMaximumEceDelta)),
      );
  const segmentPass = Object.values(segments).every((groups) => {
    const material = Object.values(groups).filter(
      (item) => item.materiallySupported,
    );
    return material.length > 0 && material.every((item) => item.passes);
  });
  const evaluationActions = assignedActions.filter(
    (item) => item.window.kind === "evaluation",
  );
  const allLatest = ledger.records.map((record) => ({
    record,
    link: latestOutcomeLink(ledger, record) || null,
  }));
  const actualActionLinks = allLatest.filter(
    (item) =>
      item.link?.actualDecisionId !== null &&
      item.link?.actualDecisionId !== undefined,
  );
  const anyOutcomeLinks = allLatest.filter((item) => item.link !== null);
  const scoreableOutcomes = allLatest.filter(
    isScoreableSelectedCandidateOutcome,
  );
  return freeze({
    support,
    assignedOutcomeCount: assigned.length,
    trainingOutcomeCount: training.length,
    evaluationOutcomeCount: allEval.length,
    eligibleCoverage:
      ledger.records.length + ledger.exclusions.length
        ? ledger.records.length /
          (ledger.records.length + ledger.exclusions.length)
        : null,
    actualActionLinkCount: actualActionLinks.length,
    anyOutcomeLinkCount: anyOutcomeLinks.length,
    scoreableSelectedCandidateOutcomeCount: scoreableOutcomes.length,
    actualActionLinkRate: ledger.records.length
      ? actualActionLinks.length / ledger.records.length
      : null,
    anyOutcomeLinkRate: ledger.records.length
      ? anyOutcomeLinks.length / ledger.records.length
      : null,
    scoreableSelectedCandidateOutcomeRate: ledger.records.length
      ? scoreableOutcomes.length / ledger.records.length
      : null,
    offListActionCount: evaluationActions.length
      ? evaluationActions.filter(
          (item) => item.link.actionDisposition === "off_list",
        ).length
      : null,
    decisionAgreement: decisionAgreement(evaluationActions),
    outcomeAccuracy: aggregateAccuracy,
    brierScore: brier(allEval),
    calibration: aggregateCalibration,
    baseline: {
      id: config.observationalBaseline.id,
      trainingWindowOnly: true,
      requiredSupport: support.sample,
      actualSupport: training.length,
      observedOutcomeRate: baselineProbability,
      outcomeAccuracy: baselineAccuracy,
      brierScore: baselineBrier,
    },
    performanceDeltaFromBaseline:
      aggregateAccuracy === null || baselineAccuracy === null
        ? null
        : aggregateAccuracy - baselineAccuracy,
    brierImprovementFromBaseline:
      baselineBrier === null || brier(allEval) === null
        ? null
        : baselineBrier - brier(allEval),
    windowMetrics,
    segments,
    consecutiveCalibrationStabilityPass: consecutivePass,
    segmentSafetyPass: segmentPass,
  });
}

export function buildFounderReadinessReport(
  ledger,
  config = loadShadowDecisionConfig(),
) {
  const evaluation = evaluateShadowDecisions(ledger, config),
    minimum = evaluation.support.sample,
    eligible = ledger.records.length;
  const outcomeIntegrity = ledger.outcomeLinks.every((link) => {
    const record = ledger.records.find(
      (item) => item.shadowDecisionId === link.shadowDecisionId,
    );
    if (
      !record ||
      !["original", "late", "correction", "conflict", "missing"].includes(
        link.relation,
      )
    )
      return false;
    if (link.relation === "missing") return link.observedAt === null;
    return (
      Number.isFinite(Date.parse(link.observedAt)) &&
      Date.parse(link.observedAt) > Date.parse(record.timestamp) &&
      ["workspaceId", "operatingProfileId", "representativeId"].every(
        (key) => link.scope?.[key] === record.scope?.[key],
      )
    );
  });
  const gates = {
    zero_influence: ledger.recommendationInfluence === "OFF" ? "PASS" : "FAIL",
    temporal_integrity: ledger.records.every(
      (record) => record.evidenceCutoff === record.timestamp,
    )
      ? "PASS"
      : "FAIL",
    deterministic_replay: ledger.records.every(
      (record) => record.shadowRecordSha256,
    )
      ? "PASS"
      : eligible
        ? "FAIL"
        : "PASS",
    completeness: (() => {
      try {
        return validateProspectiveLedgerCompleteness(
          ledger.opportunityManifest,
          ledger.records,
          ledger.exclusions,
        )
          ? "PASS"
          : "FAIL";
      } catch {
        return "FAIL";
      }
    })(),
    outcome_integrity: outcomeIntegrity ? "PASS" : "FAIL",
    evaluation_validity:
      evaluation.baseline.trainingWindowOnly &&
      evaluation.baseline.observedOutcomeRate !== null
        ? "PASS"
        : "NOT_MET",
    statistical_sufficiency:
      evaluation.trainingOutcomeCount >= minimum &&
      evaluation.evaluationOutcomeCount >= minimum &&
      evaluation.windowMetrics.every(
        (item) => item.linkedOutcomes >= item.requiredSupport,
      )
        ? "PASS"
        : "NOT_MET",
    segment_safety:
      evaluation.segmentSafetyPass &&
      evaluation.evaluationOutcomeCount >= minimum
        ? "PASS"
        : "NOT_MET",
    calibration_stability: evaluation.consecutiveCalibrationStabilityPass
      ? "PASS"
      : "NOT_MET",
    isolation_compatibility:
      ledger.founderOnly === true && ledger.readOnly === true ? "PASS" : "FAIL",
  };
  const reasons = [];
  if (!eligible)
    reasons.push(
      "no_eligible_shadow_decisions_with_historically_frozen_prospective_context",
    );
  if (evaluation.evaluationOutcomeCount < minimum)
    reasons.push(`evaluation_sample_below_required_${minimum}`);
  if (evaluation.trainingOutcomeCount < minimum)
    reasons.push(`baseline_training_sample_below_required_${minimum}`);
  if (
    evaluation.actualActionLinkRate === null ||
    evaluation.actualActionLinkRate < config.minimumActualActionLinkRate
  )
    reasons.push("actual_action_link_coverage_incomplete");
  if (
    evaluation.anyOutcomeLinkRate === null ||
    evaluation.anyOutcomeLinkRate < config.minimumAnyOutcomeLinkRate
  )
    reasons.push("outcome_link_coverage_incomplete");
  if (
    evaluation.scoreableSelectedCandidateOutcomeRate === null ||
    evaluation.scoreableSelectedCandidateOutcomeRate <
      config.minimumScoreableSelectedCandidateOutcomeRate
  )
    reasons.push("selected_candidate_outcome_coverage_incomplete");
  if (evaluation.baseline.observedOutcomeRate === null)
    reasons.push("chronologically_prior_observational_baseline_unavailable");
  if (!evaluation.consecutiveCalibrationStabilityPass)
    reasons.push("consecutive_calibration_stability_windows_not_passing");
  if (
    !evaluation.segmentSafetyPass ||
    evaluation.evaluationOutcomeCount < minimum
  )
    reasons.push("segment_safety_not_demonstrated");
  if (
    evaluation.performanceDeltaFromBaseline === null ||
    evaluation.performanceDeltaFromBaseline <
      config.accuracyMinimumDeltaFromObservationalBaseline
  )
    reasons.push("observational_baseline_performance_not_met");
  const hardFailure = Object.values(gates).includes("FAIL"),
    sufficient = gates.statistical_sufficiency === "PASS";
  const allPass =
    Object.values(gates).every((value) => value === "PASS") &&
    reasons.length === 0 &&
    evaluation.performanceDeltaFromBaseline >=
      config.accuracyMinimumDeltaFromObservationalBaseline;
  const state =
    !eligible || !sufficient
      ? "INSUFFICIENT_EVIDENCE"
      : allPass && !hardFailure
        ? "ELIGIBLE_FOR_FOUNDER_REVIEW"
        : "OBSERVING";
  const lastStability = evaluation.windowMetrics.at(-1)
    ?.performanceStability ?? {
    accuracyDelta: null,
    brierDelta: null,
    eceDelta: null,
  };
  return freeze({
    batchId: ledger.batchId,
    schemaVersion: "route-iq-founder-readiness-report-v1",
    state,
    reasonCodes: state === "ELIGIBLE_FOR_FOUNDER_REVIEW" ? [] : reasons,
    recommendationInfluence: "OFF",
    eligibilityDoesNotAuthorizeActivation: true,
    metrics: {
      eligibleCoverage: evaluation.eligibleCoverage,
      actualActionLinkCount: evaluation.actualActionLinkCount,
      anyOutcomeLinkCount: evaluation.anyOutcomeLinkCount,
      scoreableSelectedCandidateOutcomeCount:
        evaluation.scoreableSelectedCandidateOutcomeCount,
      actualActionLinkRate: evaluation.actualActionLinkRate,
      anyOutcomeLinkRate: evaluation.anyOutcomeLinkRate,
      scoreableSelectedCandidateOutcomeRate:
        evaluation.scoreableSelectedCandidateOutcomeRate,
      offListActionCount: evaluation.offListActionCount,
      decisionAgreement: evaluation.decisionAgreement,
      outcomeAccuracy: evaluation.outcomeAccuracy,
      calibrationBrierScore: evaluation.brierScore,
      calibrationEce: evaluation.calibration.ece,
      calibrationSupport: evaluation.calibration.calibrationSupport,
      calibrationBins: evaluation.calibration.bins,
      performanceStability: lastStability,
      distributionTotalVariation:
        evaluation.windowMetrics.at(-1)?.distributionTotalVariation ?? null,
      performanceAgainstObservationalBaseline:
        evaluation.performanceDeltaFromBaseline,
      brierImprovementFromObservationalBaseline:
        evaluation.brierImprovementFromBaseline,
    },
    observationalBaseline: evaluation.baseline,
    methodology: {
      baseline: config.observationalBaseline,
      equations: {
        sampleSize: "ceil(z^2*p*(1-p)/margin^2)",
        binaryBrier:
          "mean((selected_candidate_probability-observed_binary_outcome)^2)",
        ece: "sum(supported_bin_share*abs(predicted_mean-observed_rate))",
        outcomeAccuracy:
          "thresholded_selected_candidate_predictions/candidates_with_explicit_binary_outcomes",
        decisionAgreement:
          "top_decision_equals_actual_action/known_actual_actions",
        actualActionLinkRate: "known_actual_actions/eligible_shadow_decisions",
        anyOutcomeLinkRate:
          "shadow_decisions_with_any_append_only_outcome_link/eligible_shadow_decisions",
        scoreableSelectedCandidateOutcomeRate:
          "explicit_binary_outcomes_for_selected_candidate/eligible_shadow_decisions",
        performanceStability:
          "absolute consecutive-window accuracy/Brier/ECE deltas",
        distributionDrift:
          "0.5*sum(abs(window_distribution_t-window_distribution_t-1))",
        baselineDelta:
          "shadow_outcome_accuracy-prior_training_outcome_rate_baseline_accuracy",
      },
      support: evaluation.support,
      windows: config.windows,
      interpretation:
        "Observational evaluation only; no counterfactual, causal, or uplift claim.",
    },
    sampleLimitations: {
      canonicalVisits: eligible + ledger.exclusions.length,
      eligibleShadowDecisions: eligible,
      excludedOpportunities: ledger.exclusions.length,
      actualActionLinks: evaluation.actualActionLinkCount,
      anyOutcomeLinks: evaluation.anyOutcomeLinkCount,
      scoreableSelectedCandidateOutcomes:
        evaluation.scoreableSelectedCandidateOutcomeCount,
    },
    segments: evaluation.segments,
    segmentRisks:
      state === "ELIGIBLE_FOR_FOUNDER_REVIEW"
        ? []
        : [
            "unknown_segments_explicit",
            "material_segment_failure_blocks_eligibility",
            "canonical_prospective_context_absent",
          ],
    unresolvedRisks: reasons,
    implementationAcceptanceGates: {
      prospectiveGenerator: "VERIFIED_BY_SUBSYSTEM_TEST",
      strictTemporalCutoff: "VERIFIED_BY_SUBSYSTEM_TEST",
      deterministicReplay: "VERIFIED_BY_SUBSYSTEM_TEST",
      appendOnlyOutcomeChain: "VERIFIED_BY_SUBSYSTEM_TEST",
      protectedZeroInfluenceHashes: "VERIFIED_BY_VERIFIER",
    },
    evidenceReadinessGates: gates,
    gates,
    evaluationWindows: evaluation.windowMetrics,
    shadowLedgerSha256: ledger.shadowLedgerSha256,
    outcomeChainSha256: ledger.outcomeChainSha256,
    evaluatedLedgerSha256: ledger.evaluationLedgerSha256,
    ledgerSha256: ledger.shadowLedgerSha256,
  });
}

export function renderFounderReadinessMarkdown(report) {
  return `# Route IQ Shadow Decision Readiness\n\nBatch: ${report.batchId}\n\nState: ${report.state}\n\nRecommendation influence: OFF. ELIGIBLE_FOR_FOUNDER_REVIEW does not authorize activation.\n\nExact reasons: ${report.reasonCodes.length ? report.reasonCodes.join(", ") : "none"}.\n\nCanonical sample: ${report.sampleLimitations.canonicalVisits} opportunities; ${report.sampleLimitations.eligibleShadowDecisions} eligible shadow decisions; ${report.sampleLimitations.excludedOpportunities} explicit exclusions. Action links: ${report.sampleLimitations.actualActionLinks}; outcome links: ${report.sampleLimitations.anyOutcomeLinks}; scoreable selected-candidate outcomes: ${report.sampleLimitations.scoreableSelectedCandidateOutcomes}. Unavailable metrics remain null.\n\nEvaluated ledger: ${report.evaluatedLedgerSha256}. Outcome chain: ${report.outcomeChainSha256}.\n\nBaseline: ${report.methodology.baseline.description} Evaluation is observational only, with no causal or uplift claim.\n\nEquations: ${Object.values(report.methodology.equations).join("; ")}.\n\nSegment risks: ${report.segmentRisks.length ? report.segmentRisks.join(", ") : "none currently detected"}.\n\nUnresolved risks: ${report.unresolvedRisks.length ? report.unresolvedRisks.join(", ") : "none within this validation gate"}.\n\nRollback: remove or disable only this Intelligence consumer and its artifacts; no production rollback is required because influence is OFF.\n`;
}
