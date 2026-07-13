import { createHash } from "node:crypto";

import {
  FieldSessionArchiveError,
  createCloudflareKvFieldSessionStore,
  fieldSessionStorageKeys,
  routeIqChronologicalEvidenceProjectionVersion,
  routeIqVisitDecisionSourceIds,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";

export const routeIqProspectiveLifecycleVersion = "route-iq-prospective-shadow-evidence-lifecycle-v1";
export const routeIqProspectiveSnapshotSchemaVersion = "route-iq-prospective-opportunity-snapshot-v1";
export const routeIqProspectiveCaptureVersion = "route-iq-next-stop-capture-v1";
export const routeIqProspectiveActionSchemaVersion = "route-iq-prospective-action-v1";
export const routeIqProspectiveOutcomeSchemaVersion = "route-iq-prospective-outcome-v1";
export const routeIqProspectiveCorrectionSchemaVersion = "route-iq-prospective-correction-v1";
export const routeIqProspectiveExclusionSchemaVersion = "route-iq-prospective-exclusion-v1";
export const routeIqProspectiveConflictSchemaVersion = "route-iq-prospective-conflict-v1";
export const routeIqProspectiveSealReceiptVersion = "route-iq-shadow-seal-receipt-v1";
export const routeIqProspectiveStorageSegment = "prospective-shadow-evidence/v1";
export const routeIqProspectiveKvAuthority = "non_authoritative_cache_only";
export const routeIqProspectiveRecordOrigins = Object.freeze([
  "prospective",
  "synthetic",
  "test",
  "demo",
  "fixture",
  "historical",
  "backfill"
]);
export const routeIqProspectiveRecordKinds = Object.freeze([
  "accepted_snapshot",
  "action",
  "outcome",
  "correction",
  "exclusion",
  "conflict"
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{1,127}$/;
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{1,95}$/;
const REASON_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const trustedServerContexts = new WeakSet();
const appendLocks = new Map();

export class RouteIqProspectiveEvidenceError extends FieldSessionArchiveError {
  constructor(message, { code = "route_iq_prospective_evidence_invalid", status = 422, details = {} } = {}) {
    super(message, { code, status, details });
    this.name = "RouteIqProspectiveEvidenceError";
  }
}

export class RouteIqProspectiveConflictError extends RouteIqProspectiveEvidenceError {
  constructor(message, details = {}) {
    super(message, {
      code: "route_iq_prospective_idempotency_conflict",
      status: 409,
      details
    });
    this.name = "RouteIqProspectiveConflictError";
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

function jsonText(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function withoutKeys(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function stableId(prefix, value) {
  return `${prefix}-${sha256(value).slice(0, 24)}`;
}

function validationError(code, message, details = {}, status = 422) {
  return new RouteIqProspectiveEvidenceError(message, { code, status, details });
}

function canonicalTimestamp(value, label) {
  if (typeof value !== "string") {
    throw validationError("route_iq_prospective_timestamp_invalid", `${label} must be a canonical UTC timestamp.`, { paths: [label] });
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw validationError("route_iq_prospective_timestamp_invalid", `${label} must be a canonical UTC timestamp.`, { paths: [label] });
  }
  return { iso: value, time };
}

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError("route_iq_prospective_object_required", `${path} must be an object.`, { paths: [path] });
  }
}

function prohibitedFieldCode(path, key) {
  const fullPath = `${path}.${key}`;
  if (path === "snapshot" && key === "decisionSource") return "route_iq_snapshot_decision_source_prohibited";
  if (/(authoritative|server|receipt|seal|hash|sha|readiness|engine|model|probability|rank|score)/i.test(key)) {
    return "route_iq_client_authority_field_prohibited";
  }
  if (/(note|comment|contact|email|phone|mobile|audio|recording|transcript|person|first.?name|last.?name|business.?name)/i.test(key)) {
    return "route_iq_privacy_field_prohibited";
  }
  if (/(latitude|longitude|coordinate|precise|geolocation|address|place.?name)/i.test(key)) {
    return "route_iq_precise_location_field_prohibited";
  }
  if (/(other.?workspace|account|tenant|other.?representative|manager|actor)/i.test(key)) {
    return "route_iq_cross_scope_field_prohibited";
  }
  return "route_iq_field_not_allowlisted";
}

function assertExactKeys(value, allowedKeys, path) {
  assertPlainObject(value, path);
  const unknown = Object.keys(value).filter(key => !allowedKeys.includes(key)).sort();
  if (unknown.length) {
    const code = prohibitedFieldCode(path, unknown[0]);
    throw validationError(code, `${path} contains fields outside the Data privacy allowlist.`, {
      paths: unknown.map(key => `${path}.${key}`)
    });
  }
}

function assertNoPiiLikeStrings(value, path = "submission") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPiiLikeStrings(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertNoPiiLikeStrings(child, `${path}.${key}`);
    return;
  }
  if (typeof value !== "string") return;
  const emailLike = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
  const phoneLike = /^\+?[\d()\s.-]{10,20}$/.test(value) && value.replace(/\D/g, "").length >= 10;
  if (emailLike || phoneLike) {
    throw validationError("route_iq_privacy_value_prohibited", `${path} contains prohibited contact data.`, { paths: [path] });
  }
}

function requirePattern(value, pattern, path, code = "route_iq_prospective_identifier_invalid") {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw validationError(code, `${path} must be a canonical opaque identifier.`, { paths: [path] });
  }
  return value;
}

function requireOpaqueId(value, path) {
  return requirePattern(value, OPAQUE_ID_PATTERN, path);
}

function requireToken(value, path) {
  return requirePattern(value, TOKEN_PATTERN, path);
}

function requireVersion(value, path) {
  return requirePattern(value, VERSION_PATTERN, path, "route_iq_prospective_version_invalid");
}

function requireReasonCode(value, path) {
  return requirePattern(value, REASON_PATTERN, path, "route_iq_prospective_reason_code_invalid");
}

function requireDate(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw validationError("route_iq_prospective_date_invalid", `${path} must be a real YYYY-MM-DD date.`, { paths: [path] });
  }
  return value;
}

function normalizeScope(value, path = "scope") {
  assertExactKeys(value, ["workspaceId", "operatingProfileId", "representativeId", "fieldSessionId"], path);
  const workspace = supportedFieldSessionWorkspaces[value.workspaceId];
  if (!workspace || value.workspaceId !== "fitness_connection") {
    throw validationError("route_iq_prospective_workspace_not_authorized", "Prospective evidence is outside the authorized workspace.", { paths: [`${path}.workspaceId`] }, 403);
  }
  if (value.operatingProfileId !== workspace.operatingProfileId) {
    throw validationError("route_iq_prospective_profile_not_authorized", "Prospective evidence has an unauthorized operating profile.", { paths: [`${path}.operatingProfileId`] }, 403);
  }
  if (!workspace.representativeIds.includes(value.representativeId)) {
    throw validationError("route_iq_prospective_representative_not_registered", "Prospective evidence has an unregistered internal representative.", { paths: [`${path}.representativeId`] }, 403);
  }
  requireToken(value.fieldSessionId, `${path}.fieldSessionId`);
  return {
    workspaceId: value.workspaceId,
    operatingProfileId: value.operatingProfileId,
    representativeId: value.representativeId,
    fieldSessionId: value.fieldSessionId
  };
}

function normalizeOrigin(value, path = "recordOrigin") {
  if (!routeIqProspectiveRecordOrigins.includes(value)) {
    throw validationError("route_iq_prospective_record_origin_invalid", `${path} is not governed.`, { paths: [path] });
  }
  return value;
}

function normalizeClientContext(value, path = "client") {
  assertExactKeys(value, ["sequence", "observedAt", "syncMode"], path);
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0) {
    throw validationError("route_iq_client_sequence_invalid", `${path}.sequence must be a non-negative safe integer.`, { paths: [`${path}.sequence`] });
  }
  canonicalTimestamp(value.observedAt, `${path}.observedAt`);
  if (!["online", "offline", "late"].includes(value.syncMode)) {
    throw validationError("route_iq_sync_mode_invalid", `${path}.syncMode is not governed.`, { paths: [`${path}.syncMode`] });
  }
  return { sequence: value.sequence, observedAt: value.observedAt, syncMode: value.syncMode };
}

function normalizeSourceManifest(value, evidenceCutoff) {
  if (!Array.isArray(value) || !value.length) {
    throw validationError("route_iq_source_manifest_incomplete", "sourceManifest must contain the complete governed source set.", { paths: ["snapshot.sourceManifest"] });
  }
  const seen = new Set();
  const cutoff = canonicalTimestamp(evidenceCutoff, "trustedServerContext.evidenceCutoff").time;
  const normalized = value.map((source, index) => {
    const path = `snapshot.sourceManifest[${index}]`;
    assertExactKeys(source, ["sourceRecordId", "availableAt"], path);
    const sourceRecordId = requireToken(source.sourceRecordId, `${path}.sourceRecordId`);
    if (seen.has(sourceRecordId)) {
      throw validationError("route_iq_source_manifest_duplicate", "sourceManifest contains a duplicate source record.", { paths: [`${path}.sourceRecordId`] });
    }
    seen.add(sourceRecordId);
    const availableAt = canonicalTimestamp(source.availableAt, `${path}.availableAt`);
    if (availableAt.time >= cutoff) {
      throw validationError("route_iq_source_not_strictly_before_cutoff", "Every candidate source must be available strictly before the evidence cutoff.", { paths: [`${path}.availableAt`] });
    }
    return { sourceRecordId, availableAt: availableAt.iso };
  });
  return normalized.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));
}

function normalizeCandidates(value, sourceManifest, evidenceCutoff) {
  if (!Array.isArray(value) || !value.length) {
    throw validationError("route_iq_candidate_set_incomplete", "candidates must contain the complete governed candidate set.", { paths: ["snapshot.candidates"] });
  }
  const sourceIds = new Set(sourceManifest.map(item => item.sourceRecordId));
  const referencedSourceIds = new Set();
  const candidateIds = new Set();
  const normalized = value.map((candidate, index) => {
    const path = `snapshot.candidates[${index}]`;
    assertExactKeys(candidate, ["candidateId", "sourceRecordIds", "eligibility"], path);
    const candidateId = requireToken(candidate.candidateId, `${path}.candidateId`);
    if (candidateIds.has(candidateId)) {
      throw validationError("route_iq_candidate_id_duplicate", "The governed candidate set contains a duplicate candidate.", { paths: [`${path}.candidateId`] });
    }
    candidateIds.add(candidateId);
    if (!Array.isArray(candidate.sourceRecordIds) || !candidate.sourceRecordIds.length) {
      throw validationError("route_iq_candidate_source_context_missing", "Every candidate must reference governed source context.", { paths: [`${path}.sourceRecordIds`] });
    }
    const candidateSources = [...new Set(candidate.sourceRecordIds.map((sourceId, sourceIndex) => {
      const normalizedId = requireToken(sourceId, `${path}.sourceRecordIds[${sourceIndex}]`);
      if (!sourceIds.has(normalizedId)) {
        throw validationError("route_iq_candidate_source_context_changed", "A candidate references source context outside the frozen manifest.", { paths: [`${path}.sourceRecordIds[${sourceIndex}]`] });
      }
      referencedSourceIds.add(normalizedId);
      return normalizedId;
    }))].sort();
    if (candidateSources.length !== candidate.sourceRecordIds.length) {
      throw validationError("route_iq_candidate_source_duplicate", "A candidate contains duplicate source references.", { paths: [`${path}.sourceRecordIds`] });
    }
    assertExactKeys(candidate.eligibility, ["status", "reasonCodes", "evaluatedAt"], `${path}.eligibility`);
    if (candidate.eligibility.status !== "eligible") {
      throw validationError("route_iq_candidate_not_governed_eligible", "The next_stop candidate set may contain only source-governed eligible candidates.", { paths: [`${path}.eligibility.status`] });
    }
    if (!Array.isArray(candidate.eligibility.reasonCodes) || !candidate.eligibility.reasonCodes.length) {
      throw validationError("route_iq_candidate_eligibility_metadata_missing", "Candidate eligibility reason codes are required.", { paths: [`${path}.eligibility.reasonCodes`] });
    }
    const reasonCodes = [...new Set(candidate.eligibility.reasonCodes.map((reason, reasonIndex) => requireReasonCode(reason, `${path}.eligibility.reasonCodes[${reasonIndex}]`)))].sort();
    if (reasonCodes.length !== candidate.eligibility.reasonCodes.length) {
      throw validationError("route_iq_candidate_eligibility_reason_duplicate", "Candidate eligibility reason codes must be unique.", { paths: [`${path}.eligibility.reasonCodes`] });
    }
    const evaluatedAt = canonicalTimestamp(candidate.eligibility.evaluatedAt, `${path}.eligibility.evaluatedAt`);
    if (evaluatedAt.time >= Date.parse(evidenceCutoff)) {
      throw validationError("route_iq_candidate_eligibility_not_strictly_before_cutoff", "Candidate eligibility must be established strictly before the evidence cutoff.", { paths: [`${path}.eligibility.evaluatedAt`] });
    }
    return {
      candidateId,
      sourceRecordIds: candidateSources,
      eligibility: { status: "eligible", reasonCodes, evaluatedAt: evaluatedAt.iso }
    };
  });
  const unreferenced = [...sourceIds].filter(sourceId => !referencedSourceIds.has(sourceId));
  if (unreferenced.length) {
    throw validationError("route_iq_source_manifest_not_candidate_complete", "The source manifest contains records outside the complete candidate set.", { paths: ["snapshot.sourceManifest"] });
  }
  return normalized.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

function normalizeOpportunityContext(value, representativeId) {
  assertExactKeys(value, ["territory", "time", "permittedRepresentative"], "snapshot.context");
  assertExactKeys(value.territory, ["territoryId"], "snapshot.context.territory");
  assertExactKeys(value.time, ["timezone", "windowId", "localDate"], "snapshot.context.time");
  assertExactKeys(value.permittedRepresentative, ["representativeId", "registryVersion"], "snapshot.context.permittedRepresentative");
  const territoryId = requireToken(value.territory.territoryId, "snapshot.context.territory.territoryId");
  if (value.time.timezone !== "America/Chicago") {
    throw validationError("route_iq_time_context_timezone_invalid", "Fitness Connection prospective time context must use America/Chicago.", { paths: ["snapshot.context.time.timezone"] });
  }
  const windowId = requireToken(value.time.windowId, "snapshot.context.time.windowId");
  const localDate = requireDate(value.time.localDate, "snapshot.context.time.localDate");
  if (value.permittedRepresentative.representativeId !== representativeId) {
    throw validationError("route_iq_permitted_representative_mismatch", "Permitted representative context must match the registered scope.", { paths: ["snapshot.context.permittedRepresentative.representativeId"] }, 403);
  }
  const registryVersion = requireVersion(value.permittedRepresentative.registryVersion, "snapshot.context.permittedRepresentative.registryVersion");
  return {
    territory: { territoryId },
    time: { timezone: value.time.timezone, windowId, localDate },
    permittedRepresentative: { representativeId, registryVersion }
  };
}

function requireTrustedServerContext(serverContext) {
  if (!serverContext || !trustedServerContexts.has(serverContext)) {
    throw validationError("route_iq_trusted_server_context_required", "An opaque trusted server context is required.", {}, 403);
  }
  return serverContext;
}

export function createRouteIqProspectiveServerContext(input = {}) {
  assertExactKeys(input, ["authoritativeTimestamp", "evidenceCutoff", "sealReceipt"], "trustedServerContext");
  const authoritativeTimestamp = canonicalTimestamp(input.authoritativeTimestamp, "trustedServerContext.authoritativeTimestamp").iso;
  const evidenceCutoff = input.evidenceCutoff === null || input.evidenceCutoff === undefined
    ? null
    : canonicalTimestamp(input.evidenceCutoff, "trustedServerContext.evidenceCutoff").iso;
  const context = deepFreeze({
    authoritativeTimestamp,
    evidenceCutoff,
    sealReceipt: input.sealReceipt == null ? null : clone(input.sealReceipt)
  });
  trustedServerContexts.add(context);
  return context;
}

export function normalizeRouteIqProspectiveOpportunitySnapshot(input = {}, serverContext) {
  const trusted = requireTrustedServerContext(serverContext);
  assertExactKeys(input, [
    "schemaVersion",
    "captureVersion",
    "sourceVersion",
    "opportunityId",
    "idempotencyKey",
    "opportunityType",
    "recordOrigin",
    "scope",
    "candidateSetComplete",
    "candidates",
    "sourceManifest",
    "context",
    "client"
  ], "snapshot");
  if (input.schemaVersion !== routeIqProspectiveSnapshotSchemaVersion) {
    throw validationError("route_iq_snapshot_schema_version_mismatch", "Snapshot schemaVersion is not supported.", { paths: ["snapshot.schemaVersion"] });
  }
  if (input.captureVersion !== routeIqProspectiveCaptureVersion) {
    throw validationError("route_iq_capture_version_mismatch", "Snapshot captureVersion is not supported.", { paths: ["snapshot.captureVersion"] });
  }
  const sourceVersion = requireVersion(input.sourceVersion, "snapshot.sourceVersion");
  const opportunityId = requireOpaqueId(input.opportunityId, "snapshot.opportunityId");
  const idempotencyKey = requireOpaqueId(input.idempotencyKey, "snapshot.idempotencyKey");
  if (input.opportunityType !== "next_stop") {
    throw validationError("route_iq_opportunity_type_not_supported", "Only the existing next_stop opportunity type is supported.", { paths: ["snapshot.opportunityType"] });
  }
  const recordOrigin = normalizeOrigin(input.recordOrigin);
  const scope = normalizeScope(input.scope);
  if (input.candidateSetComplete !== true) {
    throw validationError("route_iq_candidate_set_incomplete", "candidateSetComplete must be true.", { paths: ["snapshot.candidateSetComplete"] });
  }
  if (!trusted.evidenceCutoff || trusted.evidenceCutoff !== trusted.authoritativeTimestamp) {
    throw validationError("route_iq_evidence_cutoff_not_authoritative", "The evidence cutoff must be supplied by trusted server context and equal the accepted snapshot time.", { paths: ["trustedServerContext.evidenceCutoff"] }, 403);
  }
  const sourceManifest = normalizeSourceManifest(input.sourceManifest, trusted.evidenceCutoff);
  const candidates = normalizeCandidates(input.candidates, sourceManifest, trusted.evidenceCutoff);
  const context = normalizeOpportunityContext(input.context, scope.representativeId);
  const client = normalizeClientContext(input.client, "snapshot.client");
  const canonicalRequest = {
    schemaVersion: routeIqProspectiveSnapshotSchemaVersion,
    captureVersion: routeIqProspectiveCaptureVersion,
    sourceVersion,
    opportunityId,
    idempotencyKey,
    opportunityType: "next_stop",
    recordOrigin,
    scope,
    candidateSetComplete: true,
    candidates,
    sourceManifest,
    context,
    client
  };
  assertNoPiiLikeStrings(canonicalRequest, "snapshot");
  const candidateSetSha256 = sha256({ candidateSetComplete: true, candidates, sourceManifest });
  return deepFreeze({
    canonicalRequest,
    requestSha256: sha256(canonicalRequest),
    candidateSetSha256,
    capturedAt: trusted.authoritativeTimestamp,
    evidenceCutoff: trusted.evidenceCutoff
  });
}

function normalizeCommonRecord(input, allowedKeys, schemaVersion, path) {
  assertExactKeys(input, allowedKeys, path);
  if (input.schemaVersion !== schemaVersion) {
    throw validationError("route_iq_lifecycle_schema_version_mismatch", `${path}.schemaVersion is not supported.`, { paths: [`${path}.schemaVersion`] });
  }
  const opportunityId = requireOpaqueId(input.opportunityId, `${path}.opportunityId`);
  const idempotencyKey = requireOpaqueId(input.idempotencyKey, `${path}.idempotencyKey`);
  const scope = normalizeScope(input.scope, `${path}.scope`);
  const recordOrigin = normalizeOrigin(input.recordOrigin, `${path}.recordOrigin`);
  const client = normalizeClientContext(input.client, `${path}.client`);
  return { opportunityId, idempotencyKey, scope, recordOrigin, client };
}

function normalizeAction(input = {}, serverContext) {
  const common = normalizeCommonRecord(input, [
    "schemaVersion", "opportunityId", "idempotencyKey", "actionId", "actionType", "scope",
    "recordOrigin", "selectedCandidateId", "decisionSource", "client"
  ], routeIqProspectiveActionSchemaVersion, "action");
  const actionId = requireOpaqueId(input.actionId, "action.actionId");
  if (input.actionType !== "next_stop_selected") {
    throw validationError("route_iq_action_type_not_supported", "Only next_stop_selected actions are supported.", { paths: ["action.actionType"] });
  }
  const selectedCandidateId = requireToken(input.selectedCandidateId, "action.selectedCandidateId");
  let decisionSource = null;
  if (input.decisionSource !== null && input.decisionSource !== undefined) {
    assertExactKeys(input.decisionSource, ["sourceId"], "action.decisionSource");
    if (!routeIqVisitDecisionSourceIds.includes(input.decisionSource.sourceId)) {
      throw validationError("route_iq_action_decision_source_invalid", "Decision Source is not canonical.", { paths: ["action.decisionSource.sourceId"] });
    }
    decisionSource = { sourceId: input.decisionSource.sourceId };
  }
  const canonicalRequest = {
    schemaVersion: routeIqProspectiveActionSchemaVersion,
    ...common,
    actionId,
    actionType: "next_stop_selected",
    selectedCandidateId,
    decisionSource
  };
  assertNoPiiLikeStrings(canonicalRequest, "action");
  return deepFreeze({
    canonicalRequest,
    requestSha256: sha256({ canonicalRequest, trustedSealReceipt: serverContext?.sealReceipt ?? null })
  });
}

function normalizeObservedOutcome(value, path) {
  assertExactKeys(value, ["status", "value"], path);
  if (!['observed', 'missing'].includes(value.status)) {
    throw validationError("route_iq_observed_outcome_status_invalid", `${path}.status is not governed.`, { paths: [`${path}.status`] });
  }
  if ((value.status === "observed" && typeof value.value !== "boolean")
    || (value.status === "missing" && value.value !== null)) {
    throw validationError("route_iq_observed_outcome_value_invalid", `${path}.value does not match its status.`, { paths: [`${path}.value`] });
  }
  return { status: value.status, value: value.value };
}

function normalizeOutcome(input = {}) {
  const common = normalizeCommonRecord(input, [
    "schemaVersion", "opportunityId", "idempotencyKey", "outcomeId", "actionId", "scope",
    "recordOrigin", "evaluatedCandidateId", "observedOutcome", "client"
  ], routeIqProspectiveOutcomeSchemaVersion, "outcome");
  const outcomeId = requireOpaqueId(input.outcomeId, "outcome.outcomeId");
  const actionId = requireOpaqueId(input.actionId, "outcome.actionId");
  const evaluatedCandidateId = requireToken(input.evaluatedCandidateId, "outcome.evaluatedCandidateId");
  const observedOutcome = normalizeObservedOutcome(input.observedOutcome, "outcome.observedOutcome");
  const canonicalRequest = {
    schemaVersion: routeIqProspectiveOutcomeSchemaVersion,
    ...common,
    outcomeId,
    actionId,
    evaluatedCandidateId,
    observedOutcome
  };
  assertNoPiiLikeStrings(canonicalRequest, "outcome");
  return deepFreeze({ canonicalRequest, requestSha256: sha256(canonicalRequest) });
}

function normalizeCorrection(input = {}) {
  const common = normalizeCommonRecord(input, [
    "schemaVersion", "opportunityId", "idempotencyKey", "correctionId", "targetRecordId",
    "targetKind", "scope", "recordOrigin", "reasonCode", "replacement", "client"
  ], routeIqProspectiveCorrectionSchemaVersion, "correction");
  const correctionId = requireOpaqueId(input.correctionId, "correction.correctionId");
  const targetRecordId = requireOpaqueId(input.targetRecordId, "correction.targetRecordId");
  if (!["outcome", "correction"].includes(input.targetKind)) {
    throw validationError("route_iq_correction_target_not_supported", "v1 corrections may reference an append-only outcome or prior correction.", { paths: ["correction.targetKind"] });
  }
  const reasonCode = requireReasonCode(input.reasonCode, "correction.reasonCode");
  assertExactKeys(input.replacement, ["evaluatedCandidateId", "observedOutcome"], "correction.replacement");
  const replacement = {
    evaluatedCandidateId: requireToken(input.replacement.evaluatedCandidateId, "correction.replacement.evaluatedCandidateId"),
    observedOutcome: normalizeObservedOutcome(input.replacement.observedOutcome, "correction.replacement.observedOutcome")
  };
  const canonicalRequest = {
    schemaVersion: routeIqProspectiveCorrectionSchemaVersion,
    ...common,
    correctionId,
    targetRecordId,
    targetKind: input.targetKind,
    reasonCode,
    replacement
  };
  assertNoPiiLikeStrings(canonicalRequest, "correction");
  return deepFreeze({ canonicalRequest, requestSha256: sha256(canonicalRequest) });
}

const RECEIPT_BODY_KEYS = [
  "receiptVersion",
  "producerSubsystem",
  "opportunityId",
  "snapshotArtifactId",
  "snapshotRecordSha256",
  "candidateSetSha256",
  "evidenceCutoff",
  "projectionVersion",
  "projectionSha256",
  "sealedAt",
  "sealedShadowRecordSha256"
];

export function computeRouteIqProspectiveSealReceiptSha256(receiptBody = {}) {
  assertExactKeys(receiptBody, RECEIPT_BODY_KEYS, "sealReceiptBody");
  return sha256(receiptBody);
}

export function validateRouteIqProspectiveSealReceipt(receipt = {}, acceptedSnapshot) {
  assertExactKeys(receipt, [...RECEIPT_BODY_KEYS, "receiptSha256"], "sealReceipt");
  if (receipt.receiptVersion !== routeIqProspectiveSealReceiptVersion
    || receipt.producerSubsystem !== "Prometheus Intelligence Engine") {
    throw validationError("route_iq_seal_receipt_contract_invalid", "The Intelligence seal receipt contract is invalid.", { paths: ["sealReceipt.receiptVersion", "sealReceipt.producerSubsystem"] });
  }
  requireOpaqueId(receipt.opportunityId, "sealReceipt.opportunityId");
  requireOpaqueId(receipt.snapshotArtifactId, "sealReceipt.snapshotArtifactId");
  for (const key of ["snapshotRecordSha256", "candidateSetSha256", "projectionSha256", "sealedShadowRecordSha256", "receiptSha256"]) {
    if (!SHA256_PATTERN.test(receipt[key])) {
      throw validationError("route_iq_seal_receipt_hash_invalid", "The Intelligence seal receipt contains an invalid digest.", { paths: [`sealReceipt.${key}`] });
    }
  }
  canonicalTimestamp(receipt.evidenceCutoff, "sealReceipt.evidenceCutoff");
  canonicalTimestamp(receipt.sealedAt, "sealReceipt.sealedAt");
  if (receipt.projectionVersion !== routeIqChronologicalEvidenceProjectionVersion) {
    throw validationError("route_iq_seal_receipt_projection_invalid", "The Intelligence seal receipt references a noncanonical Data projection.", { paths: ["sealReceipt.projectionVersion"] });
  }
  const body = withoutKeys(receipt, ["receiptSha256"]);
  if (sha256(body) !== receipt.receiptSha256) {
    throw validationError("route_iq_seal_receipt_tampered", "The Intelligence seal receipt digest does not match its canonical body.", { paths: ["sealReceipt.receiptSha256"] });
  }
  if (acceptedSnapshot) {
    const mismatched = receipt.opportunityId !== acceptedSnapshot.opportunityId
      || receipt.snapshotArtifactId !== acceptedSnapshot.artifactId
      || receipt.snapshotRecordSha256 !== acceptedSnapshot.recordSha256
      || receipt.candidateSetSha256 !== acceptedSnapshot.candidateSetSha256
      || receipt.evidenceCutoff !== acceptedSnapshot.evidenceCutoff;
    if (mismatched) {
      throw validationError("route_iq_seal_receipt_snapshot_mismatch", "The Intelligence seal receipt does not match the immutable accepted snapshot.", { paths: ["sealReceipt"] });
    }
    if (Date.parse(receipt.sealedAt) < Date.parse(acceptedSnapshot.capturedAt)) {
      throw validationError("route_iq_seal_receipt_chronology_invalid", "The Intelligence seal receipt predates the accepted snapshot.", { paths: ["sealReceipt.sealedAt"] });
    }
  }
  return deepFreeze(clone(receipt));
}

export function prospectiveLifecycleStorageKeys(scopeInput, opportunityIdInput) {
  const scope = normalizeScope(scopeInput);
  const opportunityId = requireOpaqueId(opportunityIdInput, "opportunityId");
  const sessionKeys = fieldSessionStorageKeys(scope.workspaceId, scope.fieldSessionId);
  const base = `${sessionKeys.base}/${routeIqProspectiveStorageSegment}/opportunities/${opportunityId}`;
  return Object.freeze({
    base,
    recordsRoot: `${base}/records`,
    governanceRoot: `${base}/governance`,
    commitsPrefix: `${base}/`
  });
}

function resolveStore(options = {}) {
  return options.store || createCloudflareKvFieldSessionStore(options.env, options);
}

async function listKeys(store, prefix) {
  const names = [];
  let cursor;
  do {
    const result = await store.list(cursor ? { prefix, cursor } : { prefix });
    for (const key of result?.keys || []) names.push(typeof key === "string" ? key : key.name);
    cursor = result?.list_complete === false ? result.cursor : undefined;
  } while (cursor);
  return [...new Set(names)].sort();
}

function parseStoredJson(text, key) {
  if (text === null || text === undefined) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw validationError("route_iq_prospective_poison_record", "A prospective lifecycle artifact contains invalid JSON.", { paths: [key] }, 500);
  }
}

function artifactTimestamp(artifact) {
  return artifact.capturedAt || artifact.occurredAt || artifact.observedAt || artifact.correctedAt || artifact.detectedAt;
}

function sanitizeEvidencePath(path) {
  if (typeof path !== "string"
    || path.length > 180
    || !/^[A-Za-z][A-Za-z0-9_.\[\]-]*$/.test(path)
    || /@/.test(path)) return "submission.[redacted_field]";
  return path;
}

function validatePersistedArtifactContract(artifact) {
  const schemaByKind = {
    accepted_snapshot: routeIqProspectiveSnapshotSchemaVersion,
    action: routeIqProspectiveActionSchemaVersion,
    outcome: routeIqProspectiveOutcomeSchemaVersion,
    correction: routeIqProspectiveCorrectionSchemaVersion,
    exclusion: routeIqProspectiveExclusionSchemaVersion,
    conflict: routeIqProspectiveConflictSchemaVersion
  };
  if (!routeIqProspectiveRecordKinds.includes(artifact?.artifactKind)
    || artifact.lifecycleVersion !== routeIqProspectiveLifecycleVersion
    || artifact.schemaVersion !== schemaByKind[artifact.artifactKind]
    || artifact.immutable !== true
    || artifact.appendOnly !== true
    || artifact.recommendationInfluence !== "off") {
    throw validationError("route_iq_prospective_stored_contract_invalid", "A stored prospective lifecycle artifact violates the Data contract.", {}, 500);
  }
  canonicalTimestamp(artifactTimestamp(artifact), `storedArtifact.${artifact.artifactKind}.timestamp`);
}

function buildArtifact(body) {
  const cacheOnlyBody = {
    ...body,
    storageAuthority: routeIqProspectiveKvAuthority,
    canonicalEvidenceEligible: false,
    readinessEvidenceEligible: false
  };
  const recordSha256 = sha256(cacheOnlyBody);
  return { ...cacheOnlyBody, recordSha256 };
}

function buildCommit(artifact, artifactKey, commitKey, committedAt) {
  const artifactText = jsonText(artifact);
  const body = {
    lifecycleVersion: routeIqProspectiveLifecycleVersion,
    status: "committed",
    artifactKind: artifact.artifactKind,
    artifactId: artifact.artifactId,
    opportunityId: artifact.opportunityId,
    scope: clone(artifact.scope),
    recordSha256: artifact.recordSha256,
    artifactSha256: sha256(artifactText),
    artifactKey,
    commitKey,
    committedAt
  };
  return { artifactText, commit: { ...body, commitSha256: sha256(body) } };
}

async function putImmutable(store, key, value, metadata) {
  const existing = await store.get(key);
  if (existing !== null && existing !== undefined) {
    if (existing !== value) {
      throw validationError("route_iq_prospective_immutable_key_collision", "An append-only prospective lifecycle key already contains different bytes.", { paths: [key] }, 500);
    }
    return false;
  }
  await store.put(key, value, { metadata: { ...metadata, appendOnly: true } });
  return true;
}

async function verifyCommittedPair(store, commitKey, suppliedCommit = null) {
  const commitText = suppliedCommit ? jsonText(suppliedCommit) : await store.get(commitKey);
  const commit = suppliedCommit || parseStoredJson(commitText, commitKey);
  if (!commit) return null;
  const commitBody = withoutKeys(commit, ["commitSha256"]);
  if (commit.lifecycleVersion !== routeIqProspectiveLifecycleVersion
    || commit.status !== "committed"
    || commit.commitKey !== commitKey
    || sha256(commitBody) !== commit.commitSha256) {
    throw validationError("route_iq_prospective_commit_tampered", "A prospective lifecycle commit failed integrity validation.", { paths: [commitKey] }, 500);
  }
  const artifactText = await store.get(commit.artifactKey);
  if (artifactText === null || artifactText === undefined) {
    throw validationError("route_iq_prospective_committed_artifact_missing", "A committed prospective lifecycle artifact is missing.", { paths: [commit.artifactKey] }, 500);
  }
  if (sha256(artifactText) !== commit.artifactSha256) {
    throw validationError("route_iq_prospective_artifact_bytes_tampered", "Committed prospective lifecycle bytes failed hash verification.", { paths: [commit.artifactKey] }, 500);
  }
  const artifact = parseStoredJson(artifactText, commit.artifactKey);
  const artifactBody = withoutKeys(artifact, ["recordSha256"]);
  if (sha256(artifactBody) !== artifact.recordSha256
    || artifact.recordSha256 !== commit.recordSha256
    || artifact.artifactId !== commit.artifactId
    || artifact.artifactKind !== commit.artifactKind
    || artifact.opportunityId !== commit.opportunityId
    || stableJson(artifact.scope) !== stableJson(commit.scope)) {
    throw validationError("route_iq_prospective_artifact_tampered", "A prospective lifecycle artifact failed canonical integrity validation.", { paths: [commit.artifactKey] }, 500);
  }
  validatePersistedArtifactContract(artifact);
  return {
    artifact,
    commit,
    sourceArtifacts: {
      artifact: { key: commit.artifactKey, text: artifactText, sha256: sha256(artifactText), byteLength: Buffer.byteLength(artifactText) },
      commit: { key: commitKey, text: commitText, sha256: sha256(commitText), byteLength: Buffer.byteLength(commitText) }
    }
  };
}

function responseForPair(pair, { duplicate = false, recoveredPartial = false } = {}) {
  return deepFreeze({
    ok: true,
    persisted: true,
    duplicate,
    recoveredPartial,
    status: duplicate ? "already_recorded" : "recorded",
    artifact: clone(pair.artifact),
    commit: clone(pair.commit),
    keys: { artifact: pair.commit.artifactKey, commit: pair.commit.commitKey }
  });
}

function governanceArtifactKeys(keys, artifactKind, artifactId) {
  const base = `${keys.governanceRoot}/${artifactKind}/${artifactId}`;
  return { artifact: `${base}/artifact.json`, commit: `${base}/commit.json` };
}

async function persistGovernanceArtifact({ store, scope, opportunityId, artifactKind, artifactId, body, detectedAt }) {
  const keys = prospectiveLifecycleStorageKeys(scope, opportunityId);
  const paths = governanceArtifactKeys(keys, artifactKind, artifactId);
  return withAppendLock(`governance:${paths.commit}`, async () => {
    const existingCommit = await store.get(paths.commit);
    if (existingCommit !== null && existingCommit !== undefined) {
      return verifyCommittedPair(store, paths.commit);
    }
    const artifact = buildArtifact({
      lifecycleVersion: routeIqProspectiveLifecycleVersion,
      artifactKind,
      artifactId,
      opportunityId,
      scope: clone(scope),
      detectedAt,
      immutable: true,
      appendOnly: true,
      ...body
    });
    const built = buildCommit(artifact, paths.artifact, paths.commit, detectedAt);
    await putImmutable(store, paths.artifact, built.artifactText, {
      artifactKind,
      artifactId,
      opportunityId,
      workspaceId: scope.workspaceId
    });
    await putImmutable(store, paths.commit, jsonText(built.commit), {
      artifactKind,
      artifactId,
      opportunityId,
      workspaceId: scope.workspaceId,
      committedLast: true
    });
    return verifyCommittedPair(store, paths.commit);
  });
}

async function persistExclusion({ store, scope, opportunityId, detectedAt, targetKind, targetRecordId, targetIdempotencyKey, reasonCodes, offendingPaths = [], requestSha256 = null, permanent = true }) {
  const identity = {
    opportunityId,
    scope,
    targetKind,
    targetRecordId: targetRecordId || null,
    targetIdempotencyKey: targetIdempotencyKey || null,
    reasonCodes: [...reasonCodes].sort(),
    offendingPaths: [...new Set(offendingPaths.map(sanitizeEvidencePath))].sort(),
    requestSha256
  };
  const artifactId = stableId("prospective-exclusion", identity);
  return persistGovernanceArtifact({
    store,
    scope,
    opportunityId,
    artifactKind: "exclusion",
    artifactId,
    detectedAt,
    body: {
      schemaVersion: routeIqProspectiveExclusionSchemaVersion,
      ...identity,
      permanent,
      canonicalEvidenceEligible: false,
      mayBePromotedLater: false,
      recommendationInfluence: "off"
    }
  });
}

async function persistConflict({ store, scope, opportunityId, detectedAt, idempotencyKey, existingPair, incomingKind, incomingRequestSha256 }) {
  const identity = {
    opportunityId,
    scope,
    idempotencyKey,
    existingArtifactId: existingPair.artifact.artifactId,
    existingRecordSha256: existingPair.artifact.recordSha256,
    incomingKind,
    incomingRequestSha256
  };
  const artifactId = stableId("prospective-conflict", identity);
  return persistGovernanceArtifact({
    store,
    scope,
    opportunityId,
    artifactKind: "conflict",
    artifactId,
    detectedAt,
    body: {
      schemaVersion: routeIqProspectiveConflictSchemaVersion,
      ...identity,
      resolution: "original_preserved_incoming_rejected",
      overwritePerformed: false,
      canonicalEvidenceEligible: false,
      recommendationInfluence: "off"
    }
  });
}

function recordPaths(keys, kind, idempotencyKey, requestSha256, artifactId, recordSha256) {
  const base = `${keys.recordsRoot}/${kind}/${idempotencyKey}/${requestSha256}/${artifactId}/${recordSha256}`;
  return { artifact: `${base}/artifact.json`, commit: `${base}/commit.json` };
}

async function withAppendLock(key, callback) {
  const prior = appendLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const queued = prior.then(() => current);
  appendLocks.set(key, queued);
  await prior;
  try {
    return await callback();
  } finally {
    release();
    if (appendLocks.get(key) === queued) appendLocks.delete(key);
  }
}

async function lifecyclePairs(store, scope, opportunityId) {
  const keys = prospectiveLifecycleStorageKeys(scope, opportunityId);
  const commitKeys = (await listKeys(store, keys.commitsPrefix)).filter(key => key.endsWith("/commit.json"));
  const pairs = [];
  for (const commitKey of commitKeys) pairs.push(await verifyCommittedPair(store, commitKey));
  pairs.sort((a, b) => {
    const time = String(artifactTimestamp(a.artifact)).localeCompare(String(artifactTimestamp(b.artifact)));
    return time || a.artifact.artifactId.localeCompare(b.artifact.artifactId);
  });
  return pairs;
}

async function findPartialArtifact(store, keys, kind, idempotencyKey, requestSha256) {
  const prefix = `${keys.recordsRoot}/${kind}/${idempotencyKey}/${requestSha256}/`;
  const artifactKeys = (await listKeys(store, prefix)).filter(key => key.endsWith("/artifact.json"));
  for (const artifactKey of artifactKeys) {
    const text = await store.get(artifactKey);
    const artifact = parseStoredJson(text, artifactKey);
    const body = withoutKeys(artifact, ["recordSha256"]);
    if (sha256(body) !== artifact.recordSha256 || artifact.requestSha256 !== requestSha256 || artifact.artifactKind !== kind) {
      throw validationError("route_iq_prospective_poison_record", "An interrupted prospective artifact failed integrity validation.", { paths: [artifactKey] }, 500);
    }
    const commitKey = artifactKey.replace(/artifact\.json$/, "commit.json");
    if (await store.get(commitKey) === null) return { artifact, artifactKey, commitKey, artifactText: text };
  }
  return null;
}

async function persistRegularRecord({ store, scope, opportunityId, kind, artifactId, idempotencyKey, requestSha256, body, authoritativeTimestamp }) {
  const keys = prospectiveLifecycleStorageKeys(scope, opportunityId);
  let partial;
  try {
    partial = await findPartialArtifact(store, keys, kind, idempotencyKey, requestSha256);
  } catch (error) {
    if (error?.code === "route_iq_prospective_poison_record") {
      const exclusion = await persistExclusion({
        store,
        scope,
        opportunityId,
        detectedAt: authoritativeTimestamp,
        targetKind: kind,
        targetRecordId: artifactId,
        targetIdempotencyKey: idempotencyKey,
        reasonCodes: ["poison_record"],
        offendingPaths: error.details?.paths || [],
        requestSha256,
        permanent: true
      });
      error.exclusion = clone(exclusion.artifact);
    }
    throw error;
  }
  if (partial) {
    const built = buildCommit(partial.artifact, partial.artifactKey, partial.commitKey, authoritativeTimestamp);
    await putImmutable(store, partial.commitKey, jsonText(built.commit), {
      artifactKind: kind,
      artifactId,
      opportunityId,
      workspaceId: scope.workspaceId,
      committedLast: true,
      recoveredPartial: true
    });
    const pair = await verifyCommittedPair(store, partial.commitKey);
    return responseForPair(pair, { recoveredPartial: true });
  }
  const artifact = buildArtifact(body);
  const paths = recordPaths(keys, kind, idempotencyKey, requestSha256, artifactId, artifact.recordSha256);
  const built = buildCommit(artifact, paths.artifact, paths.commit, authoritativeTimestamp);
  await putImmutable(store, paths.artifact, built.artifactText, {
    artifactKind: kind,
    artifactId,
    opportunityId,
    workspaceId: scope.workspaceId
  });
  await putImmutable(store, paths.commit, jsonText(built.commit), {
    artifactKind: kind,
    artifactId,
    opportunityId,
    workspaceId: scope.workspaceId,
    committedLast: true
  });
  const pair = await verifyCommittedPair(store, paths.commit);
  return responseForPair(pair);
}

function safeIdentity(input) {
  try {
    const opportunityId = requireOpaqueId(input?.opportunityId, "opportunityId");
    const idempotencyKey = requireOpaqueId(input?.idempotencyKey, "idempotencyKey");
    const scope = normalizeScope({
      workspaceId: input?.scope?.workspaceId,
      operatingProfileId: input?.scope?.operatingProfileId,
      representativeId: input?.scope?.representativeId,
      fieldSessionId: input?.scope?.fieldSessionId
    });
    const targetRecordId = [input?.actionId, input?.outcomeId, input?.correctionId, opportunityId]
      .find(value => typeof value === "string" && OPAQUE_ID_PATTERN.test(value)) || opportunityId;
    assertNoPiiLikeStrings({ opportunityId, idempotencyKey, targetRecordId }, "safeIdentity");
    return { opportunityId, idempotencyKey, scope, targetRecordId };
  } catch {
    return null;
  }
}

function targetKindForInput(input) {
  if (Object.hasOwn(input || {}, "actionId") && Object.hasOwn(input || {}, "selectedCandidateId")) return "action";
  if (Object.hasOwn(input || {}, "outcomeId")) return "outcome";
  if (Object.hasOwn(input || {}, "correctionId")) return "correction";
  return "accepted_snapshot";
}

async function normalizeWithGovernance(input, options, normalizer) {
  try {
    return normalizer(input, requireTrustedServerContext(options.serverContext));
  } catch (error) {
    const trusted = options.serverContext && trustedServerContexts.has(options.serverContext) ? options.serverContext : null;
    const identity = safeIdentity(input);
    if (trusted && identity && error instanceof RouteIqProspectiveEvidenceError) {
      const store = resolveStore(options);
      const exclusion = await persistExclusion({
        store,
        ...identity,
        detectedAt: trusted.authoritativeTimestamp,
        targetKind: targetKindForInput(input),
        targetRecordId: identity.targetRecordId,
        targetIdempotencyKey: identity.idempotencyKey,
        reasonCodes: [error.code.replace(/^route_iq_/, "").slice(0, 79)],
        offendingPaths: error.details?.paths || [],
        permanent: true
      });
      error.exclusion = clone(exclusion.artifact);
    }
    throw error;
  }
}

async function rejectWithExclusion({ store, normalized, trusted, targetKind, targetRecordId, reasonCode, offendingPaths = [], permanent = true }) {
  const request = normalized.canonicalRequest;
  const pair = await persistExclusion({
    store,
    scope: request.scope,
    opportunityId: request.opportunityId,
    detectedAt: trusted.authoritativeTimestamp,
    targetKind,
    targetRecordId,
    targetIdempotencyKey: request.idempotencyKey,
    reasonCodes: [reasonCode],
    offendingPaths,
    requestSha256: normalized.requestSha256,
    permanent
  });
  const error = validationError(`route_iq_${reasonCode}`, `Prospective ${targetKind} evidence was governed as an exclusion.`, { exclusionId: pair.artifact.artifactId });
  error.exclusion = clone(pair.artifact);
  throw error;
}

async function checkIdempotency({ store, pairs, normalized, trusted, kind }) {
  const request = normalized.canonicalRequest;
  const excluded = pairs.find(pair => pair.artifact.artifactKind === "exclusion"
    && pair.artifact.permanent === true
    && pair.artifact.targetIdempotencyKey === request.idempotencyKey);
  if (excluded) {
    const error = validationError("route_iq_idempotency_permanently_excluded", "This idempotency key is permanently governed as excluded.", {
      exclusionId: excluded.artifact.artifactId
    }, 409);
    error.exclusion = clone(excluded.artifact);
    throw error;
  }
  const existing = pairs.find(pair => pair.artifact.idempotencyKey === request.idempotencyKey
    && !["exclusion", "conflict"].includes(pair.artifact.artifactKind));
  if (!existing) return null;
  if (existing.artifact.requestSha256 === normalized.requestSha256 && existing.artifact.artifactKind === kind) {
    return responseForPair(existing, { duplicate: true });
  }
  const conflict = await persistConflict({
    store,
    scope: request.scope,
    opportunityId: request.opportunityId,
    detectedAt: trusted.authoritativeTimestamp,
    idempotencyKey: request.idempotencyKey,
    existingPair: existing,
    incomingKind: kind,
    incomingRequestSha256: normalized.requestSha256
  });
  const error = new RouteIqProspectiveConflictError("The idempotency key already commits different canonical content.", {
    idempotencyKey: request.idempotencyKey,
    existingArtifactId: existing.artifact.artifactId,
    conflictId: conflict.artifact.artifactId
  });
  error.conflict = clone(conflict.artifact);
  throw error;
}

function hasPermanentOpportunityExclusion(pairs) {
  return pairs.some(pair => pair.artifact.artifactKind === "exclusion"
    && pair.artifact.permanent === true
    && pair.artifact.targetKind === "accepted_snapshot");
}

function acceptedSnapshotFromPairs(pairs) {
  return pairs.find(pair => pair.artifact.artifactKind === "accepted_snapshot")?.artifact || null;
}

export async function captureRouteIqProspectiveOpportunitySnapshot(input = {}, options = {}) {
  const normalized = await normalizeWithGovernance(input, options, normalizeRouteIqProspectiveOpportunitySnapshot);
  const trusted = requireTrustedServerContext(options.serverContext);
  const request = normalized.canonicalRequest;
  const store = resolveStore(options);
  const lockKey = `${request.scope.workspaceId}:${request.scope.fieldSessionId}:${request.opportunityId}`;
  return withAppendLock(lockKey, async () => {
    const pairs = await lifecyclePairs(store, request.scope, request.opportunityId);
    const replay = await checkIdempotency({ store, pairs, normalized, trusted, kind: "accepted_snapshot" });
    if (replay) return replay;
    if (request.recordOrigin !== "prospective") {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "accepted_snapshot", targetRecordId: request.opportunityId, reasonCode: "noncanonical_record_origin" });
    }
    if (request.client.syncMode !== "online") {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "accepted_snapshot", targetRecordId: request.opportunityId, reasonCode: "offline_or_late_sync_unverifiable" });
    }
    const existingSnapshot = acceptedSnapshotFromPairs(pairs);
    if (existingSnapshot || hasPermanentOpportunityExclusion(pairs)) {
      if (existingSnapshot) {
        const existingPair = pairs.find(pair => pair.artifact === existingSnapshot);
        const conflict = await persistConflict({
          store,
          scope: request.scope,
          opportunityId: request.opportunityId,
          detectedAt: trusted.authoritativeTimestamp,
          idempotencyKey: request.idempotencyKey,
          existingPair,
          incomingKind: "accepted_snapshot",
          incomingRequestSha256: normalized.requestSha256
        });
        const error = new RouteIqProspectiveConflictError("The opportunity already has an immutable accepted snapshot.", { conflictId: conflict.artifact.artifactId });
        error.conflict = clone(conflict.artifact);
        throw error;
      }
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "accepted_snapshot", targetRecordId: request.opportunityId, reasonCode: "opportunity_permanently_excluded" });
    }
    const artifactId = stableId("prospective-snapshot", { scope: request.scope, opportunityId: request.opportunityId });
    return persistRegularRecord({
      store,
      scope: request.scope,
      opportunityId: request.opportunityId,
      kind: "accepted_snapshot",
      artifactId,
      idempotencyKey: request.idempotencyKey,
      requestSha256: normalized.requestSha256,
      authoritativeTimestamp: trusted.authoritativeTimestamp,
      body: {
        lifecycleVersion: routeIqProspectiveLifecycleVersion,
        schemaVersion: routeIqProspectiveSnapshotSchemaVersion,
        artifactKind: "accepted_snapshot",
        artifactId,
        opportunityId: request.opportunityId,
        idempotencyKey: request.idempotencyKey,
        requestSha256: normalized.requestSha256,
        opportunityType: "next_stop",
        recordOrigin: "prospective",
        canonicality: "canonical_prospective",
        scope: clone(request.scope),
        capturedAt: normalized.capturedAt,
        evidenceCutoff: normalized.evidenceCutoff,
        candidateSetComplete: true,
        candidateSetSha256: normalized.candidateSetSha256,
        candidates: clone(request.candidates),
        sourceManifest: clone(request.sourceManifest),
        context: clone(request.context),
        client: clone(request.client),
        versions: {
          schema: routeIqProspectiveSnapshotSchemaVersion,
          capture: routeIqProspectiveCaptureVersion,
          source: request.sourceVersion,
          dataProjection: routeIqChronologicalEvidenceProjectionVersion
        },
        immutable: true,
        appendOnly: true,
        collectionActivation: "inactive_until_infrastructure_and_dashboard_owner_wiring",
        recommendationInfluence: "off",
        rankingCalculatedByData: false,
        readinessCalculatedByData: false
      }
    });
  });
}

export async function appendRouteIqProspectiveAction(input = {}, options = {}) {
  const normalized = await normalizeWithGovernance(input, options, normalizeAction);
  const trusted = requireTrustedServerContext(options.serverContext);
  const request = normalized.canonicalRequest;
  const store = resolveStore(options);
  const lockKey = `${request.scope.workspaceId}:${request.scope.fieldSessionId}:${request.opportunityId}`;
  return withAppendLock(lockKey, async () => {
    const pairs = await lifecyclePairs(store, request.scope, request.opportunityId);
    const replay = await checkIdempotency({ store, pairs, normalized, trusted, kind: "action" });
    if (replay) return replay;
    if (request.recordOrigin !== "prospective" || request.client.syncMode !== "online") {
      return rejectWithExclusion({
        store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId,
        reasonCode: request.recordOrigin !== "prospective" ? "noncanonical_record_origin" : "offline_or_late_sync_unverifiable"
      });
    }
    const existingAction = pairs.find(pair => pair.artifact.artifactKind === "action" && pair.artifact.artifactId === request.actionId);
    const excludedAction = pairs.find(pair => pair.artifact.artifactKind === "exclusion"
      && pair.artifact.permanent === true
      && pair.artifact.targetKind === "action"
      && pair.artifact.targetRecordId === request.actionId);
    if (existingAction || excludedAction) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "late_retry_identity_mismatch" });
    }
    if (pairs.some(pair => pair.artifact.artifactKind === "action")) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "second_root_action" });
    }
    const snapshot = acceptedSnapshotFromPairs(pairs);
    if (!snapshot) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "accepted_snapshot_missing" });
    }
    if (stableJson(snapshot.scope) !== stableJson(request.scope)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "cross_scope_context" });
    }
    if (!snapshot.candidates.some(candidate => candidate.candidateId === request.selectedCandidateId)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "candidate_context_missing_or_changed" });
    }
    if (!trusted.sealReceipt) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "seal_receipt_missing" });
    }
    let receipt;
    try {
      receipt = validateRouteIqProspectiveSealReceipt(trusted.sealReceipt, snapshot);
    } catch (error) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "seal_receipt_missing_or_tampered", offendingPaths: error.details?.paths || [] });
    }
    const actionTime = canonicalTimestamp(trusted.authoritativeTimestamp, "trustedServerContext.authoritativeTimestamp").time;
    if (actionTime <= Date.parse(snapshot.capturedAt)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "action_not_strictly_after_snapshot" });
    }
    if (actionTime <= Date.parse(receipt.sealedAt)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "action", targetRecordId: request.actionId, reasonCode: "action_not_strictly_after_seal" });
    }
    return persistRegularRecord({
      store,
      scope: request.scope,
      opportunityId: request.opportunityId,
      kind: "action",
      artifactId: request.actionId,
      idempotencyKey: request.idempotencyKey,
      requestSha256: normalized.requestSha256,
      authoritativeTimestamp: trusted.authoritativeTimestamp,
      body: {
        lifecycleVersion: routeIqProspectiveLifecycleVersion,
        schemaVersion: routeIqProspectiveActionSchemaVersion,
        artifactKind: "action",
        artifactId: request.actionId,
        opportunityId: request.opportunityId,
        idempotencyKey: request.idempotencyKey,
        requestSha256: normalized.requestSha256,
        actionType: request.actionType,
        scope: clone(request.scope),
        recordOrigin: "prospective",
        occurredAt: trusted.authoritativeTimestamp,
        selectedCandidateId: request.selectedCandidateId,
        snapshotArtifactId: snapshot.artifactId,
        snapshotRecordSha256: snapshot.recordSha256,
        candidateSetSha256: snapshot.candidateSetSha256,
        sealReceipt: clone(receipt),
        decisionSource: request.decisionSource ? {
          sourceId: request.decisionSource.sourceId,
          capturedAt: trusted.authoritativeTimestamp,
          temporalClassification: "post_action_observation",
          provesSealing: false,
          scoreable: false,
          sampleSupport: false
        } : null,
        client: clone(request.client),
        immutable: true,
        appendOnly: true,
        recommendationInfluence: "off"
      }
    });
  });
}

export async function appendRouteIqProspectiveOutcome(input = {}, options = {}) {
  const normalized = await normalizeWithGovernance(input, options, normalizeOutcome);
  const trusted = requireTrustedServerContext(options.serverContext);
  const request = normalized.canonicalRequest;
  const store = resolveStore(options);
  const lockKey = `${request.scope.workspaceId}:${request.scope.fieldSessionId}:${request.opportunityId}`;
  return withAppendLock(lockKey, async () => {
    const pairs = await lifecyclePairs(store, request.scope, request.opportunityId);
    const replay = await checkIdempotency({ store, pairs, normalized, trusted, kind: "outcome" });
    if (replay) return replay;
    if (request.recordOrigin !== "prospective" || request.client.syncMode !== "online") {
      return rejectWithExclusion({
        store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId,
        reasonCode: request.recordOrigin !== "prospective" ? "noncanonical_record_origin" : "offline_or_late_sync_unverifiable"
      });
    }
    if (pairs.some(pair => (pair.artifact.artifactKind === "outcome" && pair.artifact.artifactId === request.outcomeId)
      || (pair.artifact.artifactKind === "exclusion" && pair.artifact.permanent === true
        && pair.artifact.targetKind === "outcome" && pair.artifact.targetRecordId === request.outcomeId))) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId, reasonCode: "late_retry_identity_mismatch" });
    }
    if (pairs.some(pair => pair.artifact.artifactKind === "outcome" && pair.artifact.actionId === request.actionId)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId, reasonCode: "second_root_outcome" });
    }
    const snapshot = acceptedSnapshotFromPairs(pairs);
    const action = pairs.find(pair => pair.artifact.artifactKind === "action" && pair.artifact.artifactId === request.actionId)?.artifact;
    if (!snapshot || !action) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId, reasonCode: "action_or_candidate_context_missing" });
    }
    if (request.evaluatedCandidateId !== action.selectedCandidateId
      || !snapshot.candidates.some(candidate => candidate.candidateId === request.evaluatedCandidateId)
      || action.candidateSetSha256 !== snapshot.candidateSetSha256) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId, reasonCode: "candidate_context_missing_or_changed" });
    }
    if (Date.parse(trusted.authoritativeTimestamp) <= Date.parse(action.occurredAt)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "outcome", targetRecordId: request.outcomeId, reasonCode: "outcome_not_strictly_after_action" });
    }
    return persistRegularRecord({
      store,
      scope: request.scope,
      opportunityId: request.opportunityId,
      kind: "outcome",
      artifactId: request.outcomeId,
      idempotencyKey: request.idempotencyKey,
      requestSha256: normalized.requestSha256,
      authoritativeTimestamp: trusted.authoritativeTimestamp,
      body: {
        lifecycleVersion: routeIqProspectiveLifecycleVersion,
        schemaVersion: routeIqProspectiveOutcomeSchemaVersion,
        artifactKind: "outcome",
        artifactId: request.outcomeId,
        opportunityId: request.opportunityId,
        idempotencyKey: request.idempotencyKey,
        requestSha256: normalized.requestSha256,
        actionId: request.actionId,
        scope: clone(request.scope),
        recordOrigin: "prospective",
        observedAt: trusted.authoritativeTimestamp,
        evaluatedCandidateId: request.evaluatedCandidateId,
        observedOutcome: clone(request.observedOutcome),
        candidateSetSha256: snapshot.candidateSetSha256,
        client: clone(request.client),
        immutable: true,
        appendOnly: true,
        recommendationInfluence: "off"
      }
    });
  });
}

export async function appendRouteIqProspectiveCorrection(input = {}, options = {}) {
  const normalized = await normalizeWithGovernance(input, options, normalizeCorrection);
  const trusted = requireTrustedServerContext(options.serverContext);
  const request = normalized.canonicalRequest;
  const store = resolveStore(options);
  const lockKey = `${request.scope.workspaceId}:${request.scope.fieldSessionId}:${request.opportunityId}`;
  return withAppendLock(lockKey, async () => {
    const pairs = await lifecyclePairs(store, request.scope, request.opportunityId);
    const replay = await checkIdempotency({ store, pairs, normalized, trusted, kind: "correction" });
    if (replay) return replay;
    if (request.recordOrigin !== "prospective" || request.client.syncMode !== "online") {
      return rejectWithExclusion({
        store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId,
        reasonCode: request.recordOrigin !== "prospective" ? "noncanonical_record_origin" : "offline_or_late_sync_unverifiable"
      });
    }
    if (pairs.some(pair => pair.artifact.artifactKind === "exclusion" && pair.artifact.permanent === true
      && pair.artifact.targetKind === "correction" && pair.artifact.targetRecordId === request.correctionId)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId, reasonCode: "late_retry_identity_mismatch" });
    }
    const target = pairs.find(pair => pair.artifact.artifactKind === request.targetKind && pair.artifact.artifactId === request.targetRecordId)?.artifact;
    if (!target) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId, reasonCode: "correction_target_missing_or_excluded" });
    }
    if (pairs.some(pair => pair.artifact.artifactKind === "correction" && pair.artifact.targetRecordId === request.targetRecordId)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId, reasonCode: "correction_chain_fork" });
    }
    const targetTimestamp = target.artifactKind === "outcome" ? target.observedAt : target.correctedAt;
    const targetCandidateId = target.artifactKind === "outcome" ? target.evaluatedCandidateId : target.replacement.evaluatedCandidateId;
    if (Date.parse(trusted.authoritativeTimestamp) <= Date.parse(targetTimestamp)) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId, reasonCode: "correction_not_strictly_after_target" });
    }
    if (request.replacement.evaluatedCandidateId !== targetCandidateId) {
      return rejectWithExclusion({ store, normalized, trusted, targetKind: "correction", targetRecordId: request.correctionId, reasonCode: "candidate_context_missing_or_changed" });
    }
    return persistRegularRecord({
      store,
      scope: request.scope,
      opportunityId: request.opportunityId,
      kind: "correction",
      artifactId: request.correctionId,
      idempotencyKey: request.idempotencyKey,
      requestSha256: normalized.requestSha256,
      authoritativeTimestamp: trusted.authoritativeTimestamp,
      body: {
        lifecycleVersion: routeIqProspectiveLifecycleVersion,
        schemaVersion: routeIqProspectiveCorrectionSchemaVersion,
        artifactKind: "correction",
        artifactId: request.correctionId,
        opportunityId: request.opportunityId,
        idempotencyKey: request.idempotencyKey,
        requestSha256: normalized.requestSha256,
        targetKind: request.targetKind,
        targetRecordId: request.targetRecordId,
        scope: clone(request.scope),
        recordOrigin: "prospective",
        correctedAt: trusted.authoritativeTimestamp,
        reasonCode: request.reasonCode,
        replacement: clone(request.replacement),
        priorRecordPreserved: true,
        client: clone(request.client),
        immutable: true,
        appendOnly: true,
        recommendationInfluence: "off"
      }
    });
  });
}

export async function appendRouteIqProspectiveGovernedExclusion(input = {}, options = {}) {
  const trusted = requireTrustedServerContext(options.serverContext);
  assertExactKeys(input, ["opportunityId", "idempotencyKey", "scope", "targetKind", "targetRecordId", "reasonCodes"], "exclusion");
  const opportunityId = requireOpaqueId(input.opportunityId, "exclusion.opportunityId");
  const idempotencyKey = requireOpaqueId(input.idempotencyKey, "exclusion.idempotencyKey");
  const scope = normalizeScope(input.scope, "exclusion.scope");
  if (!["accepted_snapshot", "action", "outcome", "correction"].includes(input.targetKind)) {
    throw validationError("route_iq_exclusion_target_kind_invalid", "The exclusion target kind is not governed.", { paths: ["exclusion.targetKind"] });
  }
  const targetRecordId = requireOpaqueId(input.targetRecordId, "exclusion.targetRecordId");
  if (!Array.isArray(input.reasonCodes) || !input.reasonCodes.length) {
    throw validationError("route_iq_exclusion_reason_missing", "At least one governed exclusion reason is required.", { paths: ["exclusion.reasonCodes"] });
  }
  const reasonCodes = [...new Set(input.reasonCodes.map((reason, index) => requireReasonCode(reason, `exclusion.reasonCodes[${index}]`)))].sort();
  assertNoPiiLikeStrings({ opportunityId, idempotencyKey, scope, targetRecordId, reasonCodes }, "exclusion");
  const store = resolveStore(options);
  const pair = await persistExclusion({
    store,
    scope,
    opportunityId,
    detectedAt: trusted.authoritativeTimestamp,
    targetKind: input.targetKind,
    targetRecordId,
    targetIdempotencyKey: idempotencyKey,
    reasonCodes,
    permanent: true
  });
  return responseForPair(pair);
}

export async function readRouteIqProspectiveLifecycle(input = {}, options = {}) {
  assertExactKeys(input, ["workspaceId", "operatingProfileId", "representativeId", "fieldSessionId", "opportunityId"], "readRequest");
  const scope = normalizeScope({
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    representativeId: input.representativeId,
    fieldSessionId: input.fieldSessionId
  }, "readRequest.scope");
  const opportunityId = requireOpaqueId(input.opportunityId, "readRequest.opportunityId");
  const store = resolveStore(options);
  const pairs = await lifecyclePairs(store, scope, opportunityId);
  if (!pairs.length) return deepFreeze({ ok: true, found: false, record: null });
  for (const pair of pairs) {
    if (stableJson(pair.artifact.scope) !== stableJson(scope) || pair.artifact.opportunityId !== opportunityId) {
      throw validationError("route_iq_prospective_stored_scope_mismatch", "Stored prospective lifecycle evidence has cross-scope contamination.", { paths: [pair.commit.artifactKey] }, 500);
    }
  }
  const records = pairs.filter(pair => !["exclusion", "conflict"].includes(pair.artifact.artifactKind));
  const exclusions = pairs.filter(pair => pair.artifact.artifactKind === "exclusion");
  const conflicts = pairs.filter(pair => pair.artifact.artifactKind === "conflict");
  const acceptedSnapshot = records.find(pair => pair.artifact.artifactKind === "accepted_snapshot")?.artifact || null;
  const body = {
    lifecycleVersion: routeIqProspectiveLifecycleVersion,
    scope,
    opportunityId,
    acceptedSnapshot: acceptedSnapshot ? clone(acceptedSnapshot) : null,
    records: records.map(pair => clone(pair.artifact)),
    exclusions: exclusions.map(pair => clone(pair.artifact)),
    conflicts: conflicts.map(pair => clone(pair.artifact)),
    sourceArtifacts: Object.fromEntries(pairs.map(pair => [pair.artifact.artifactId, clone(pair.sourceArtifacts)])),
    authority: routeIqProspectiveKvAuthority,
    canonicalEvidenceEligible: false,
    readinessEvidenceEligible: false,
    recommendationInfluence: "off",
    collectionActivation: "inactive_until_infrastructure_and_dashboard_owner_wiring"
  };
  return deepFreeze({ ok: true, found: true, record: { ...body, lifecycleReadSha256: sha256(body) } });
}
