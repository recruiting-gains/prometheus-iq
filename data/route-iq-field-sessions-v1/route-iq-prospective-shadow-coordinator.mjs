import { createHash } from "node:crypto";

import {
  FieldSessionArchiveError,
  routeIqChronologicalEvidenceProjectionVersion,
  routeIqVisitDecisionSourceIds,
  supportedFieldSessionWorkspaces
} from "./route-iq-field-session-archive.mjs";

export const routeIqProspectiveCoordinatorSchemaVersion = "route-iq-prospective-coordinator-schema-v1";
export const routeIqProspectiveCoordinatorContractVersion = "route-iq-prospective-coordinator-contract-v1";
export const routeIqProspectiveCoordinatorProjectionVersion = "route-iq-prospective-coordinator-projection-v1";
export const routeIqCandidateProducerEnvelopeVersion = "route-iq-intelligence-candidate-envelope-v1";
export const routeIqCandidateProducerContractVersion = "route-iq-next-stop-candidate-producer-v1";
export const routeIqCandidateManifestSchemaVersion = "route-iq-next-stop-candidate-manifest-v1";
export const routeIqCandidateSourceSchemaVersion = "route-iq-candidate-source-record-v1";
export const routeIqCandidateSourceVersion = "route-iq-candidate-source-v1";
export const routeIqProspectiveKvAuthority = "non_authoritative_cache_only";
export const routeIqProspectiveCollectionDefault = "off";
export const routeIqProspectiveRecommendationInfluence = "off";

export const routeIqProspectiveCoordinatorStates = Object.freeze([
  "TRIGGERED",
  "EXCLUDED",
  "SNAPSHOT_PENDING_SEAL",
  "SNAPSHOT_SEALED",
  "SHADOW_DECISION_SEALED",
  "ACTION_LINKED",
  "OUTCOME_LINKED",
  "EVALUATED"
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HASH_ID_PATTERNS = Object.freeze({
  coordinator: /^riq_coord_[a-f0-9]{64}$/,
  session: /^riq_session_[a-f0-9]{64}$/,
  opportunity: /^riq_opportunity_[a-f0-9]{64}$/,
  idempotency: /^riq_idempotency_[a-f0-9]{64}$/,
  territory: /^riq_territory_[a-f0-9]{64}$/,
  candidate: /^riq_candidate_[a-f0-9]{64}$/,
  source: /^riq_source_[a-f0-9]{64}$/,
  trigger: /^riq_trigger_[a-f0-9]{64}$/,
  snapshot: /^riq_snapshot_[a-f0-9]{64}$/,
  snapshot_seal: /^riq_snapshot_seal_[a-f0-9]{64}$/,
  shadow_decision: /^riq_shadow_decision_[a-f0-9]{64}$/,
  action: /^riq_action_[a-f0-9]{64}$/,
  outcome: /^riq_outcome_[a-f0-9]{64}$/,
  evaluation: /^riq_evaluation_[a-f0-9]{64}$/,
  correction: /^riq_correction_[a-f0-9]{64}$/,
  exclusion: /^riq_exclusion_[a-f0-9]{64}$/,
  conflict: /^riq_conflict_[a-f0-9]{64}$/,
  outbox: /^riq_outbox_[a-f0-9]{64}$/,
  projection: /^riq_projection_[a-f0-9]{64}$/,
  projection_commit: /^riq_projection_commit_[a-f0-9]{64}$/,
  seal: /^riq_seal_[a-f0-9]{64}$/,
  key: /^riq_key_[a-f0-9]{64}$/
});
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{1,95}$/;
const REASON_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const KEYED_ALGORITHMS = Object.freeze(["HMAC-SHA-256", "Ed25519"]);
const RECORD_ORIGINS = Object.freeze(["prospective", "synthetic", "test", "demo", "fixture", "historical", "backfill", "replay"]);
const STATE_RANK = Object.freeze({
  TRIGGERED: 0,
  SNAPSHOT_PENDING_SEAL: 1,
  SNAPSHOT_SEALED: 2,
  SHADOW_DECISION_SEALED: 3,
  ACTION_LINKED: 4,
  OUTCOME_LINKED: 5,
  EVALUATED: 6,
  EXCLUDED: -1
});

export const routeIqProspectiveCoordinatorSchemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS coordinator_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL,
  coordinator_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  operating_profile_id TEXT NOT NULL,
  representative_id TEXT NOT NULL,
  registry_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  next_record_sequence INTEGER NOT NULL CHECK (next_record_sequence >= 1)
);

CREATE TABLE IF NOT EXISTS artifact_registry (
  artifact_id TEXT PRIMARY KEY,
  artifact_kind TEXT NOT NULL,
  opportunity_id TEXT,
  registered_sequence INTEGER,
  registered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS canonical_sessions (
  session_id TEXT PRIMARY KEY,
  coordinator_id TEXT NOT NULL,
  canonical_session_record_sha256 TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  session_event_sequence INTEGER NOT NULL CHECK (session_event_sequence >= 0),
  created_sequence INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (coordinator_id, canonical_session_record_sha256, session_event_sequence)
);

CREATE TABLE IF NOT EXISTS opportunities (
  opportunity_id TEXT PRIMARY KEY,
  coordinator_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES canonical_sessions(session_id),
  territory_id TEXT NOT NULL,
  opportunity_type TEXT NOT NULL CHECK (opportunity_type = 'next_stop'),
  opportunity_event_sequence INTEGER NOT NULL CHECK (opportunity_event_sequence >= 0),
  trigger_record_sha256 TEXT NOT NULL,
  trigger_boundary_sha256 TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('TRIGGERED','EXCLUDED','SNAPSHOT_PENDING_SEAL','SNAPSHOT_SEALED','SHADOW_DECISION_SEALED','ACTION_LINKED','OUTCOME_LINKED','EVALUATED')),
  canonical_eligible INTEGER NOT NULL CHECK (canonical_eligible IN (0,1)),
  current_manifest_sha256 TEXT,
  last_record_sequence INTEGER NOT NULL,
  last_record_time TEXT NOT NULL,
  UNIQUE (session_id, opportunity_type, opportunity_event_sequence),
  UNIQUE (coordinator_id, trigger_boundary_sha256)
);

CREATE TABLE IF NOT EXISTS operation_attempts (
  attempt_id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
  operation_kind TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  canonical_request_json TEXT,
  privacy_redacted INTEGER NOT NULL CHECK (privacy_redacted IN (0,1)),
  authoritative_record_time TEXT NOT NULL,
  client_event_sequence INTEGER NOT NULL CHECK (client_event_sequence >= 0),
  client_content_sha256 TEXT NOT NULL,
  UNIQUE (operation_key, request_sha256)
);

CREATE TABLE IF NOT EXISTS operation_receipts (
  operation_key TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
  operation_kind TEXT NOT NULL,
  accepted_request_sha256 TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  receipt_sha256 TEXT NOT NULL,
  created_sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lifecycle_events (
  artifact_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  artifact_kind TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  coordinator_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES canonical_sessions(session_id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
  operation_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  logical_boundary_sha256 TEXT NOT NULL,
  record_sequence INTEGER NOT NULL UNIQUE,
  authoritative_record_time TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  canonical_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL,
  canonical_evidence_eligible INTEGER NOT NULL CHECK (canonical_evidence_eligible IN (0,1)),
  recommendation_influence TEXT NOT NULL CHECK (recommendation_influence = 'off'),
  UNIQUE (opportunity_id, event_kind, logical_boundary_sha256, request_sha256)
);

CREATE TABLE IF NOT EXISTS candidate_manifests (
  snapshot_artifact_id TEXT PRIMARY KEY REFERENCES lifecycle_events(artifact_id),
  opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(opportunity_id),
  producer_envelope_version TEXT NOT NULL,
  producer_contract_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  data_projection_version TEXT NOT NULL,
  evidence_cutoff TEXT NOT NULL,
  candidate_count INTEGER NOT NULL CHECK (candidate_count > 0),
  source_count INTEGER NOT NULL CHECK (source_count > 0),
  candidate_manifest_sha256 TEXT NOT NULL,
  source_manifest_sha256 TEXT NOT NULL,
  complete_manifest_sha256 TEXT NOT NULL UNIQUE,
  manifest_json TEXT NOT NULL,
  manifest_record_sha256 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projection_outbox (
  outbox_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
  source_artifact_id TEXT NOT NULL UNIQUE REFERENCES lifecycle_events(artifact_id),
  source_record_sequence INTEGER NOT NULL UNIQUE,
  authoritative_record_time TEXT NOT NULL,
  instruction_json TEXT NOT NULL,
  instruction_sha256 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projection_artifacts (
  projection_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  outbox_id TEXT NOT NULL UNIQUE REFERENCES projection_outbox(outbox_id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),
  as_of_record_sequence INTEGER NOT NULL,
  as_of_record_time TEXT NOT NULL,
  projection_json TEXT NOT NULL,
  projection_sha256 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projection_commits (
  commit_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  projection_id TEXT NOT NULL UNIQUE REFERENCES projection_artifacts(projection_id),
  outbox_id TEXT NOT NULL UNIQUE REFERENCES projection_outbox(outbox_id),
  status TEXT NOT NULL CHECK (status = 'committed'),
  projection_sha256 TEXT NOT NULL,
  committed_sequence INTEGER NOT NULL,
  committed_at TEXT NOT NULL,
  commit_sha256 TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lifecycle_events_opportunity_sequence_idx
  ON lifecycle_events(opportunity_id, record_sequence);
CREATE INDEX IF NOT EXISTS projection_commits_sequence_idx
  ON projection_commits(committed_sequence);

CREATE TRIGGER IF NOT EXISTS coordinator_meta_guard_update
BEFORE UPDATE ON coordinator_meta
WHEN NEW.singleton IS NOT OLD.singleton
  OR NEW.schema_version IS NOT OLD.schema_version
  OR NEW.coordinator_id IS NOT OLD.coordinator_id
  OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.operating_profile_id IS NOT OLD.operating_profile_id
  OR NEW.representative_id IS NOT OLD.representative_id
  OR NEW.registry_version IS NOT OLD.registry_version
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.next_record_sequence != OLD.next_record_sequence + 1
BEGIN SELECT RAISE(ABORT, 'coordinator_meta_scope_immutable'); END;
CREATE TRIGGER IF NOT EXISTS coordinator_meta_no_delete
BEFORE DELETE ON coordinator_meta BEGIN SELECT RAISE(ABORT, 'coordinator_meta_immutable'); END;
CREATE TRIGGER IF NOT EXISTS opportunities_guard_update
BEFORE UPDATE ON opportunities
WHEN NEW.opportunity_id IS NOT OLD.opportunity_id
  OR NEW.coordinator_id IS NOT OLD.coordinator_id
  OR NEW.session_id IS NOT OLD.session_id
  OR NEW.territory_id IS NOT OLD.territory_id
  OR NEW.opportunity_type IS NOT OLD.opportunity_type
  OR NEW.opportunity_event_sequence IS NOT OLD.opportunity_event_sequence
  OR NEW.trigger_record_sha256 IS NOT OLD.trigger_record_sha256
  OR NEW.trigger_boundary_sha256 IS NOT OLD.trigger_boundary_sha256
  OR (OLD.current_manifest_sha256 IS NOT NULL AND NEW.current_manifest_sha256 IS NOT OLD.current_manifest_sha256)
  OR NEW.last_record_sequence <= OLD.last_record_sequence
  OR NEW.canonical_eligible > OLD.canonical_eligible
  OR (NEW.state = 'EXCLUDED' AND NEW.canonical_eligible != 0)
  OR (NEW.state != 'EXCLUDED' AND NEW.canonical_eligible != 1)
  OR NOT (
    (OLD.state = 'TRIGGERED' AND NEW.state IN ('TRIGGERED','SNAPSHOT_PENDING_SEAL','EXCLUDED'))
    OR (OLD.state = 'SNAPSHOT_PENDING_SEAL' AND NEW.state IN ('SNAPSHOT_SEALED','EXCLUDED'))
    OR (OLD.state = 'SNAPSHOT_SEALED' AND NEW.state IN ('SHADOW_DECISION_SEALED','EXCLUDED'))
    OR (OLD.state = 'SHADOW_DECISION_SEALED' AND NEW.state IN ('ACTION_LINKED','EXCLUDED'))
    OR (OLD.state = 'ACTION_LINKED' AND NEW.state IN ('OUTCOME_LINKED','EXCLUDED'))
    OR (OLD.state = 'OUTCOME_LINKED' AND NEW.state IN ('OUTCOME_LINKED','EVALUATED','EXCLUDED'))
    OR (OLD.state = 'EVALUATED' AND NEW.state IN ('EVALUATED','EXCLUDED'))
    OR (OLD.state = 'EXCLUDED' AND NEW.state = 'EXCLUDED')
  )
BEGIN SELECT RAISE(ABORT, 'opportunity_state_transition_invalid'); END;
CREATE TRIGGER IF NOT EXISTS opportunities_no_delete
BEFORE DELETE ON opportunities BEGIN SELECT RAISE(ABORT, 'opportunities_canonical_state_immutable'); END;
CREATE TRIGGER IF NOT EXISTS canonical_sessions_no_update
BEFORE UPDATE ON canonical_sessions BEGIN SELECT RAISE(ABORT, 'canonical_sessions_append_only'); END;
CREATE TRIGGER IF NOT EXISTS canonical_sessions_no_delete
BEFORE DELETE ON canonical_sessions BEGIN SELECT RAISE(ABORT, 'canonical_sessions_append_only'); END;
CREATE TRIGGER IF NOT EXISTS artifact_registry_no_update
BEFORE UPDATE ON artifact_registry BEGIN SELECT RAISE(ABORT, 'artifact_registry_append_only'); END;
CREATE TRIGGER IF NOT EXISTS artifact_registry_no_delete
BEFORE DELETE ON artifact_registry BEGIN SELECT RAISE(ABORT, 'artifact_registry_append_only'); END;
CREATE TRIGGER IF NOT EXISTS operation_attempts_no_update
BEFORE UPDATE ON operation_attempts BEGIN SELECT RAISE(ABORT, 'operation_attempts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS operation_attempts_no_delete
BEFORE DELETE ON operation_attempts BEGIN SELECT RAISE(ABORT, 'operation_attempts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS operation_receipts_no_update
BEFORE UPDATE ON operation_receipts BEGIN SELECT RAISE(ABORT, 'operation_receipts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS operation_receipts_no_delete
BEFORE DELETE ON operation_receipts BEGIN SELECT RAISE(ABORT, 'operation_receipts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS lifecycle_events_no_update
BEFORE UPDATE ON lifecycle_events BEGIN SELECT RAISE(ABORT, 'lifecycle_events_append_only'); END;
CREATE TRIGGER IF NOT EXISTS lifecycle_events_no_delete
BEFORE DELETE ON lifecycle_events BEGIN SELECT RAISE(ABORT, 'lifecycle_events_append_only'); END;
CREATE TRIGGER IF NOT EXISTS candidate_manifests_no_update
BEFORE UPDATE ON candidate_manifests BEGIN SELECT RAISE(ABORT, 'candidate_manifests_append_only'); END;
CREATE TRIGGER IF NOT EXISTS candidate_manifests_no_delete
BEFORE DELETE ON candidate_manifests BEGIN SELECT RAISE(ABORT, 'candidate_manifests_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_outbox_no_update
BEFORE UPDATE ON projection_outbox BEGIN SELECT RAISE(ABORT, 'projection_outbox_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_outbox_no_delete
BEFORE DELETE ON projection_outbox BEGIN SELECT RAISE(ABORT, 'projection_outbox_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_artifacts_no_update
BEFORE UPDATE ON projection_artifacts BEGIN SELECT RAISE(ABORT, 'projection_artifacts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_artifacts_no_delete
BEFORE DELETE ON projection_artifacts BEGIN SELECT RAISE(ABORT, 'projection_artifacts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_commits_no_update
BEFORE UPDATE ON projection_commits BEGIN SELECT RAISE(ABORT, 'projection_commits_append_only'); END;
CREATE TRIGGER IF NOT EXISTS projection_commits_no_delete
BEFORE DELETE ON projection_commits BEGIN SELECT RAISE(ABORT, 'projection_commits_append_only'); END;
`;

export class RouteIqProspectiveCoordinatorError extends FieldSessionArchiveError {
  constructor(message, { code = "route_iq_coordinator_invalid", status = 422, details = {} } = {}) {
    super(message, { code, status, details });
    this.name = "RouteIqProspectiveCoordinatorError";
  }
}

export class RouteIqProspectiveCoordinatorConflictError extends RouteIqProspectiveCoordinatorError {
  constructor(message, details = {}) {
    super(message, { code: "route_iq_coordinator_conflict", status: 409, details });
    this.name = "RouteIqProspectiveCoordinatorConflictError";
  }
}

function fail(code, message, details = {}, status = 422) {
  throw new RouteIqProspectiveCoordinatorError(message, { code, status, details });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const canonical = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(canonical === undefined ? "undefined" : canonical).digest("hex");
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

function assertObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_coordinator_object_required", `${path} must be an object.`, { paths: [path] });
  }
}

function assertExactKeys(value, allowed, path) {
  assertObject(value, path);
  const extra = Object.keys(value).filter(key => !allowed.includes(key)).sort();
  if (extra.length) {
    fail("route_iq_coordinator_field_not_allowlisted", `${path} contains fields outside the Data allowlist.`, {
      paths: extra.map(key => `${path}.${key}`)
    });
  }
}

function canonicalTimestamp(value, path) {
  if (typeof value !== "string") fail("route_iq_coordinator_timestamp_invalid", `${path} must be canonical UTC.`, { paths: [path] });
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    fail("route_iq_coordinator_timestamp_invalid", `${path} must be canonical UTC.`, { paths: [path] });
  }
  return { iso: value, time };
}

function requireSha(value, path) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("route_iq_coordinator_sha256_invalid", `${path} must be a lowercase SHA-256 digest.`, { paths: [path] });
  }
  return value;
}

function requireHashId(value, kind, path) {
  if (typeof value !== "string" || !HASH_ID_PATTERNS[kind]?.test(value)) {
    fail("route_iq_coordinator_identifier_invalid", `${path} must be a canonical nonsemantic ${kind} hash identifier.`, { paths: [path] });
  }
  return value;
}

function requireVersion(value, path) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    fail("route_iq_coordinator_version_invalid", `${path} must be a canonical version.`, { paths: [path] });
  }
  return value;
}

function requireReason(value, path) {
  if (typeof value !== "string" || !REASON_PATTERN.test(value)) {
    fail("route_iq_coordinator_reason_invalid", `${path} must be a canonical reason code.`, { paths: [path] });
  }
  return value;
}

function requireSequence(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail("route_iq_coordinator_sequence_invalid", `${path} must be a non-negative safe integer.`, { paths: [path] });
  }
  return value;
}

function assertNoPiiLikeStrings(value, path = "claims") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoPiiLikeStrings(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/(name|address|email|phone|contact|note|audio|transcript|latitude|longitude|coordinate)/i.test(key)) {
        fail("route_iq_coordinator_privacy_field_prohibited", `${path}.${key} is prohibited.`, { paths: [`${path}.${key}`] });
      }
      assertNoPiiLikeStrings(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value !== "string") return;
  const emailLike = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
  const phoneLike = /^\+?[\d()\s.-]{10,20}$/.test(value) && value.replace(/\D/g, "").length >= 10;
  const addressLike = /\b\d{1,6}\s+[A-Za-z][A-Za-z\s]{1,40}\s(?:st|street|rd|road|ave|avenue|blvd|drive|dr|lane|ln)\b/i.test(value);
  if (emailLike || phoneLike || addressLike) {
    fail("route_iq_coordinator_privacy_value_prohibited", `${path} contains prohibited identifying data.`, { paths: [path] });
  }
}

function hashId(kind, identity) {
  const prefix = {
    coordinator: "riq_coord",
    session: "riq_session",
    opportunity: "riq_opportunity",
    idempotency: "riq_idempotency",
    trigger: "riq_trigger",
    snapshot: "riq_snapshot",
    snapshot_seal: "riq_snapshot_seal",
    shadow_decision: "riq_shadow_decision",
    action: "riq_action",
    outcome: "riq_outcome",
    evaluation: "riq_evaluation",
    correction: "riq_correction",
    exclusion: "riq_exclusion",
    conflict: "riq_conflict",
    outbox: "riq_outbox",
    projection: "riq_projection",
    projection_commit: "riq_projection_commit"
  }[kind];
  if (!prefix) fail("route_iq_coordinator_identifier_kind_invalid", "Identifier kind is not governed.", { kind }, 500);
  return `${prefix}_${sha256({ kind, identity })}`;
}

function repositoryRows(repository, sql, bindings = []) {
  const result = repository.execute(sql, bindings);
  if (!Array.isArray(result)) {
    fail("route_iq_coordinator_repository_result_invalid", "The SQLite repository must return an array of row objects.", {}, 500);
  }
  return result;
}

function repositoryOne(repository, sql, bindings = []) {
  return repositoryRows(repository, sql, bindings)[0] || null;
}

function validateRepository(repository) {
  const missing = ["executeSchema", "execute", "transactionSync"].filter(method => typeof repository?.[method] !== "function");
  if (missing.length) {
    fail("route_iq_coordinator_repository_invalid", "A SQLite transaction-shaped repository is required.", { missingMethods: missing }, 500);
  }
  return repository;
}

export function initializeRouteIqProspectiveCoordinatorSchema(repositoryInput) {
  const repository = validateRepository(repositoryInput);
  repository.executeSchema(routeIqProspectiveCoordinatorSchemaSql);
  return Object.freeze({
    ok: true,
    schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
    storage: "sqlite_backed_durable_object",
    transactionShape: "synchronous_serializable"
  });
}

function normalizeScopeClaims(claims) {
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId", "registryVersion", "issuedAt"
  ], "verifiedScopeClaims");
  if (claims.purpose !== "coordinator_scope") {
    fail("route_iq_coordinator_scope_purpose_invalid", "Scope attestation purpose is invalid.", {}, 403);
  }
  const workspace = supportedFieldSessionWorkspaces[claims.workspaceId];
  if (!workspace || claims.workspaceId !== "fitness_connection"
    || claims.operatingProfileId !== workspace.operatingProfileId
    || !workspace.representativeIds.includes(claims.representativeId)) {
    fail("route_iq_coordinator_scope_unauthorized", "Coordinator scope is not registered.", {}, 403);
  }
  const registryVersion = requireVersion(claims.registryVersion, "verifiedScopeClaims.registryVersion");
  const issuedAt = canonicalTimestamp(claims.issuedAt, "verifiedScopeClaims.issuedAt").iso;
  return {
    workspaceId: claims.workspaceId,
    operatingProfileId: claims.operatingProfileId,
    representativeId: claims.representativeId,
    registryVersion,
    issuedAt
  };
}

async function verifyEnvelope(authorityVerifier, envelope, { purpose, coordinatorId = null, producer = false } = {}) {
  if (!authorityVerifier || typeof authorityVerifier.verify !== "function") {
    fail("route_iq_coordinator_authority_verifier_required", "Infrastructure must supply a cryptographic authority verifier.", {}, 500);
  }
  const result = await authorityVerifier.verify(envelope, { purpose, coordinatorId });
  assertExactKeys(result, ["authenticated", "verificationType", "keyId", "algorithm", "claims"], "authorityVerification");
  const expectedType = producer ? "infrastructure_verified_producer_signature" : "infrastructure_keyed_attestation";
  if (result.authenticated !== true || result.verificationType !== expectedType) {
    fail("route_iq_coordinator_keyed_authentication_required", "An unkeyed or unauthenticated envelope cannot cross the Data authority boundary.", { purpose }, 403);
  }
  requireHashId(result.keyId, "key", "authorityVerification.keyId");
  if (!KEYED_ALGORITHMS.includes(result.algorithm)) {
    fail("route_iq_coordinator_keyed_algorithm_required", "The authority verifier must attest a keyed algorithm.", { purpose }, 403);
  }
  assertObject(result.claims, "authorityVerification.claims");
  return deepFreeze({
    keyId: result.keyId,
    algorithm: result.algorithm,
    verificationType: result.verificationType,
    claims: clone(result.claims)
  });
}

function sameScope(left, right) {
  return left.workspaceId === right.workspaceId
    && left.operatingProfileId === right.operatingProfileId
    && left.representativeId === right.representativeId;
}

const OPERATION_BASE_KEYS = [
  "purpose",
  "workspaceId",
  "operatingProfileId",
  "representativeId",
  "territoryId",
  "canonicalSessionRecordSha256",
  "sessionEventSequence",
  "opportunityEventSequence",
  "triggerRecordSha256",
  "canonicalEventBoundarySha256",
  "clientEventSequence",
  "clientContentSha256",
  "authoritativeRecordTime",
  "recordOrigin",
  "uncertainChronology"
];

function normalizeOperationClaims(claims, scope, purpose, extraKeys = []) {
  assertExactKeys(claims, [...OPERATION_BASE_KEYS, ...extraKeys], `verifiedClaims.${purpose}`);
  if (claims.purpose !== purpose) {
    fail("route_iq_coordinator_operation_purpose_invalid", `Expected ${purpose} authority claims.`, {}, 403);
  }
  if (!sameScope(claims, scope)) {
    fail("route_iq_coordinator_cross_scope", "Verified operation scope does not match the coordinator.", {}, 403);
  }
  requireSha(claims.canonicalSessionRecordSha256, `verifiedClaims.${purpose}.canonicalSessionRecordSha256`);
  requireSha(claims.triggerRecordSha256, `verifiedClaims.${purpose}.triggerRecordSha256`);
  requireSha(claims.canonicalEventBoundarySha256, `verifiedClaims.${purpose}.canonicalEventBoundarySha256`);
  requireSha(claims.clientContentSha256, `verifiedClaims.${purpose}.clientContentSha256`);
  requireHashId(claims.territoryId, "territory", `verifiedClaims.${purpose}.territoryId`);
  requireSequence(claims.sessionEventSequence, `verifiedClaims.${purpose}.sessionEventSequence`);
  requireSequence(claims.opportunityEventSequence, `verifiedClaims.${purpose}.opportunityEventSequence`);
  requireSequence(claims.clientEventSequence, `verifiedClaims.${purpose}.clientEventSequence`);
  canonicalTimestamp(claims.authoritativeRecordTime, `verifiedClaims.${purpose}.authoritativeRecordTime`);
  if (!RECORD_ORIGINS.includes(claims.recordOrigin)) {
    fail("route_iq_coordinator_origin_invalid", "Record origin is not governed.", {}, 403);
  }
  if (typeof claims.uncertainChronology !== "boolean") {
    fail("route_iq_coordinator_chronology_certainty_invalid", "Chronology certainty must be server attested.", {}, 403);
  }
  assertNoPiiLikeStrings(claims, `verifiedClaims.${purpose}`);
  return deepFreeze(clone(claims));
}

function coordinatorIdentity(scope) {
  return hashId("coordinator", {
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId
  });
}

function identitiesForClaims(coordinatorId, claims) {
  const sessionId = hashId("session", {
    coordinatorId,
    sessionEventSequence: claims.sessionEventSequence
  });
  const opportunityId = hashId("opportunity", {
    coordinatorId,
    sessionId,
    opportunityType: "next_stop",
    opportunityEventSequence: claims.opportunityEventSequence
  });
  const operationKey = hashId("idempotency", {
    coordinatorId,
    opportunityId,
    purpose: claims.purpose,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256
  });
  return { sessionId, opportunityId, operationKey };
}

function parseCanonicalJson(text, expectedSha, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("route_iq_coordinator_poison_record", `${label} contains invalid JSON.`, {}, 500);
  }
  if (stableJson(parsed) !== text || sha256(text) !== expectedSha) {
    fail("route_iq_coordinator_poison_record", `${label} failed canonical hash verification.`, {}, 500);
  }
  return parsed;
}

function canonicalText(value) {
  return stableJson(value);
}

function readCoordinatorMeta(repository) {
  return repositoryOne(repository, "SELECT * FROM coordinator_meta WHERE singleton = 1");
}

function allocateSequence(repository) {
  const row = readCoordinatorMeta(repository);
  if (!row) fail("route_iq_coordinator_not_initialized", "Coordinator metadata is missing.", {}, 500);
  const sequence = Number(row.next_record_sequence);
  repositoryRows(repository, "UPDATE coordinator_meta SET next_record_sequence = ? WHERE singleton = 1", [sequence + 1]);
  return sequence;
}

function registerArtifact(repository, { artifactId, artifactKind, opportunityId = null, recordSequence = null, registeredAt }) {
  repositoryRows(repository, `
    INSERT INTO artifact_registry (artifact_id, artifact_kind, opportunity_id, registered_sequence, registered_at)
    VALUES (?, ?, ?, ?, ?)
  `, [artifactId, artifactKind, opportunityId, recordSequence, registeredAt]);
}

function getOpportunity(repository, opportunityId) {
  return repositoryOne(repository, "SELECT * FROM opportunities WHERE opportunity_id = ?", [opportunityId]);
}

function assertOpportunityIdentity(row, identities, claims) {
  if (!row
    || row.session_id !== identities.sessionId
    || row.territory_id !== claims.territoryId
    || Number(row.opportunity_event_sequence) !== claims.opportunityEventSequence) {
    fail("route_iq_coordinator_opportunity_identity_mismatch", "Verified claims do not resolve to the canonical opportunity.", {}, 409);
  }
}

function receiptFromRow(row) {
  if (!row) return null;
  const receipt = parseCanonicalJson(row.receipt_json, row.receipt_sha256, "operation receipt");
  return deepFreeze(receipt);
}

function eventPrefix(eventKind) {
  return {
    TRIGGERED: "trigger",
    SNAPSHOT_PENDING_SEAL: "snapshot",
    SNAPSHOT_SEALED: "snapshot_seal",
    SHADOW_DECISION_SEALED: "shadow_decision",
    ACTION_LINKED: "action",
    OUTCOME_LINKED: "outcome",
    EVALUATED: "evaluation",
    CORRECTION_APPENDED: "correction",
    EXCLUSION_RECORDED: "exclusion",
    CONFLICT_RECORDED: "conflict"
  }[eventKind];
}

function appendLifecycleEvent(repository, {
  coordinatorId,
  sessionId,
  opportunityId,
  operationKey,
  requestSha256,
  logicalBoundarySha256,
  authoritativeRecordTime,
  eventKind,
  artifactKind,
  fromState,
  toState,
  payload,
  canonicalEvidenceEligible
}) {
  const recordSequence = allocateSequence(repository);
  const prefix = eventPrefix(eventKind);
  const artifactId = hashId(prefix, {
    coordinatorId,
    opportunityId,
    operationKey,
    requestSha256,
    eventKind,
    logicalBoundarySha256
  });
  const canonical = {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    artifactId,
    artifactKind,
    eventKind,
    coordinatorId,
    sessionId,
    opportunityId,
    operationKey,
    requestSha256,
    logicalBoundarySha256,
    recordSequence,
    authoritativeRecordTime,
    fromState,
    toState,
    payload,
    immutable: true,
    appendOnly: true,
    canonicalEvidenceEligible,
    recommendationInfluence: "off",
    collectionDefault: "off"
  };
  const canonicalJson = canonicalText(canonical);
  const recordSha256 = sha256(canonicalJson);
  registerArtifact(repository, {
    artifactId,
    artifactKind,
    opportunityId,
    recordSequence,
    registeredAt: authoritativeRecordTime
  });
  repositoryRows(repository, `
    INSERT INTO lifecycle_events (
      artifact_id, artifact_kind, event_kind, coordinator_id, session_id, opportunity_id,
      operation_key, request_sha256, logical_boundary_sha256, record_sequence,
      authoritative_record_time, from_state, to_state, canonical_json, record_sha256,
      canonical_evidence_eligible, recommendation_influence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'off')
  `, [
    artifactId, artifactKind, eventKind, coordinatorId, sessionId, opportunityId,
    operationKey, requestSha256, logicalBoundarySha256, recordSequence,
    authoritativeRecordTime, fromState, toState, canonicalJson, recordSha256,
    canonicalEvidenceEligible ? 1 : 0
  ]);
  const outboxId = hashId("outbox", { artifactId, recordSha256 });
  const instruction = {
    projectionVersion: routeIqProspectiveCoordinatorProjectionVersion,
    outboxId,
    coordinatorId,
    opportunityId,
    sourceArtifactId: artifactId,
    sourceRecordSha256: recordSha256,
    sourceRecordSequence: recordSequence,
    authoritativeRecordTime,
    instruction: "rebuild_committed_as_of_projection",
    recommendationInfluence: "off"
  };
  const instructionJson = canonicalText(instruction);
  registerArtifact(repository, {
    artifactId: outboxId,
    artifactKind: "projection_outbox_instruction",
    opportunityId,
    recordSequence,
    registeredAt: authoritativeRecordTime
  });
  repositoryRows(repository, `
    INSERT INTO projection_outbox (
      outbox_id, opportunity_id, source_artifact_id, source_record_sequence,
      authoritative_record_time, instruction_json, instruction_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [outboxId, opportunityId, artifactId, recordSequence, authoritativeRecordTime, instructionJson, sha256(instructionJson)]);
  return { artifactId, artifactKind, eventKind, recordSequence, authoritativeRecordTime, recordSha256, canonical };
}

function insertAttempt(repository, { identities, claims, operationKind, requestSha256, canonicalRequest = null, privacyRedacted = false }) {
  const attemptId = `riq_attempt_${sha256({ operationKey: identities.operationKey, requestSha256 })}`;
  repositoryRows(repository, `
    INSERT OR IGNORE INTO operation_attempts (
      attempt_id, operation_key, opportunity_id, operation_kind, request_sha256,
      canonical_request_json, privacy_redacted, authoritative_record_time,
      client_event_sequence, client_content_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    attemptId,
    identities.operationKey,
    identities.opportunityId,
    operationKind,
    requestSha256,
    canonicalRequest ? canonicalText(canonicalRequest) : null,
    privacyRedacted ? 1 : 0,
    claims.authoritativeRecordTime,
    claims.clientEventSequence,
    claims.clientContentSha256
  ]);
  return attemptId;
}

function insertReceipt(repository, { identities, operationKind, requestSha256, event, state, status = "recorded", details = {} }) {
  const receipt = {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    status,
    coordinatorId: event.canonical.coordinatorId,
    sessionId: identities.sessionId,
    opportunityId: identities.opportunityId,
    operationKey: identities.operationKey,
    operationKind,
    requestSha256,
    artifactId: event.artifactId,
    recordSha256: event.recordSha256,
    recordSequence: event.recordSequence,
    authoritativeRecordTime: event.authoritativeRecordTime,
    state,
    recoveryOutboxPersisted: true,
    recommendationInfluence: "off",
    collectionDefault: "off",
    ...details
  };
  const receiptJson = canonicalText(receipt);
  repositoryRows(repository, `
    INSERT INTO operation_receipts (
      operation_key, opportunity_id, operation_kind, accepted_request_sha256,
      receipt_json, receipt_sha256, created_sequence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    identities.operationKey,
    identities.opportunityId,
    operationKind,
    requestSha256,
    receiptJson,
    sha256(receiptJson),
    event.recordSequence,
    event.authoritativeRecordTime
  ]);
  return deepFreeze(receipt);
}

function eventFromRow(row) {
  if (!row) return null;
  const canonical = parseCanonicalJson(row.canonical_json, row.record_sha256, "lifecycle event");
  if (canonical.artifactId !== row.artifact_id
    || canonical.eventKind !== row.event_kind
    || canonical.recordSequence !== Number(row.record_sequence)
    || canonical.authoritativeRecordTime !== row.authoritative_record_time) {
    fail("route_iq_coordinator_poison_record", "Lifecycle event columns do not match canonical bytes.", {}, 500);
  }
  return {
    artifactId: row.artifact_id,
    artifactKind: row.artifact_kind,
    eventKind: row.event_kind,
    recordSequence: Number(row.record_sequence),
    authoritativeRecordTime: row.authoritative_record_time,
    recordSha256: row.record_sha256,
    canonical
  };
}

function existingReceiptDecision(repository, { identities, operationKind, requestSha256, claims, canonicalRequest = null }) {
  const row = repositoryOne(repository, "SELECT * FROM operation_receipts WHERE operation_key = ?", [identities.operationKey]);
  if (!row) return null;
  if (row.operation_kind !== operationKind || row.opportunity_id !== identities.opportunityId) {
    fail("route_iq_coordinator_operation_key_collision", "Operation key resolved across canonical boundaries.", {}, 500);
  }
  if (row.accepted_request_sha256 === requestSha256) {
    return { type: "retry", receipt: receiptFromRow(row) };
  }
  return recordConflictAgainstReceipt(repository, {
    identities,
    operationKind,
    requestSha256,
    claims,
    canonicalRequest,
    originalReceiptRow: row
  });
}

function recordConflictAgainstReceipt(repository, {
  identities,
  operationKind,
  requestSha256,
  claims,
  canonicalRequest = null,
  originalReceiptRow
}) {
  insertAttempt(repository, {
    identities,
    claims,
    operationKind,
    requestSha256,
    canonicalRequest,
    privacyRedacted: canonicalRequest === null
  });
  const existingConflict = repositoryOne(repository, `
    SELECT * FROM lifecycle_events
    WHERE opportunity_id = ? AND operation_key = ? AND event_kind = 'CONFLICT_RECORDED' AND request_sha256 = ?
  `, [identities.opportunityId, identities.operationKey, requestSha256]);
  if (existingConflict) {
    return {
      type: "conflict",
      event: eventFromRow(existingConflict),
      originalReceipt: receiptFromRow(originalReceiptRow)
    };
  }
  const opportunity = getOpportunity(repository, identities.opportunityId);
  assertOpportunityIdentity(opportunity, identities, claims);
  const event = appendLifecycleEvent(repository, {
    coordinatorId: opportunity.coordinator_id,
    sessionId: opportunity.session_id,
    opportunityId: opportunity.opportunity_id,
    operationKey: identities.operationKey,
    requestSha256,
    logicalBoundarySha256: claims.canonicalEventBoundarySha256,
    authoritativeRecordTime: claims.authoritativeRecordTime,
    eventKind: "CONFLICT_RECORDED",
    artifactKind: "conflict",
    fromState: opportunity.state,
    toState: "EXCLUDED",
    payload: {
      operationKind,
      originalRequestSha256: originalReceiptRow.accepted_request_sha256,
      competingRequestSha256: requestSha256,
      originalReceiptSha256: originalReceiptRow.receipt_sha256,
      clientEventSequence: claims.clientEventSequence,
      clientContentSha256: claims.clientContentSha256,
      permanent: true,
      overwritePerformed: false,
      priorHistoryPreserved: true
    },
    canonicalEvidenceEligible: false
  });
  repositoryRows(repository, `
    UPDATE opportunities
    SET state = 'EXCLUDED', canonical_eligible = 0, last_record_sequence = ?, last_record_time = ?
    WHERE opportunity_id = ?
  `, [event.recordSequence, event.authoritativeRecordTime, opportunity.opportunity_id]);
  return { type: "conflict", event, originalReceipt: receiptFromRow(originalReceiptRow) };
}

function throwConflict(decision) {
  throw new RouteIqProspectiveCoordinatorConflictError("A changed retry was durably preserved as a conflict.", {
    conflictArtifactId: decision.event.artifactId,
    conflictRecordSha256: decision.event.recordSha256,
    originalReceipt: decision.originalReceipt,
    overwritePerformed: false
  });
}

function exclusionRequestSha(reasonCodes, claims, incomingDigest = null) {
  return sha256({
    purpose: claims.purpose,
    canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256,
    clientEventSequence: claims.clientEventSequence,
    clientContentSha256: claims.clientContentSha256,
    reasonCodes: [...reasonCodes].sort(),
    incomingDigest
  });
}

function persistExclusion(repository, {
  coordinatorId,
  identities,
  claims,
  operationKind,
  reasonCodes,
  incomingDigest = null,
  offendingPaths = [],
  requestSha256Override = null,
  canonicalRequest = null
}) {
  const normalizedReasons = [...new Set(reasonCodes.map((reason, index) => requireReason(reason, `reasonCodes[${index}]`)))].sort();
  const requestSha256 = requestSha256Override || exclusionRequestSha(normalizedReasons, claims, incomingDigest);
  const decision = existingReceiptDecision(repository, {
    identities,
    operationKind,
    requestSha256,
    claims,
    canonicalRequest
  });
  if (decision?.type === "retry") return decision.receipt;
  if (decision?.type === "conflict") return { conflictDecision: decision };
  const opportunity = getOpportunity(repository, identities.opportunityId);
  assertOpportunityIdentity(opportunity, identities, claims);
  insertAttempt(repository, {
    identities,
    claims,
    operationKind,
    requestSha256,
    canonicalRequest,
    privacyRedacted: canonicalRequest === null
  });
  const event = appendLifecycleEvent(repository, {
    coordinatorId,
    sessionId: identities.sessionId,
    opportunityId: identities.opportunityId,
    operationKey: identities.operationKey,
    requestSha256,
    logicalBoundarySha256: claims.canonicalEventBoundarySha256,
    authoritativeRecordTime: claims.authoritativeRecordTime,
    eventKind: "EXCLUSION_RECORDED",
    artifactKind: "exclusion",
    fromState: opportunity.state,
    toState: "EXCLUDED",
    payload: {
      operationKind,
      reasonCodes: normalizedReasons,
      offendingPaths: [...new Set(offendingPaths.map(path => typeof path === "string" && /^[A-Za-z][A-Za-z0-9_.\[\]-]{0,179}$/.test(path)
        ? path
        : "submission.[redacted_field]"))].sort(),
      requestContentPersisted: false,
      incomingDigest,
      clientEventSequence: claims.clientEventSequence,
      clientContentSha256: claims.clientContentSha256,
      permanent: true,
      mayBePromotedLater: false
    },
    canonicalEvidenceEligible: false
  });
  repositoryRows(repository, `
    UPDATE opportunities
    SET state = 'EXCLUDED', canonical_eligible = 0, last_record_sequence = ?, last_record_time = ?
    WHERE opportunity_id = ?
  `, [event.recordSequence, event.authoritativeRecordTime, identities.opportunityId]);
  return insertReceipt(repository, {
    identities,
    operationKind,
    requestSha256,
    event,
    state: "EXCLUDED",
    status: "excluded",
    details: { reasonCodes: normalizedReasons, canonicalEvidenceEligible: false }
  });
}

function normalizeRankingContext(value, path) {
  assertExactKeys(value, ["producerSubsystem", "ordinal", "probability", "basisVersion"], path);
  if (value.producerSubsystem !== "Prometheus Intelligence Engine") {
    fail("route_iq_candidate_ranking_producer_invalid", "Ranking context must come from the canonical Intelligence producer.", { paths: [`${path}.producerSubsystem`] });
  }
  if (!Number.isSafeInteger(value.ordinal) || value.ordinal < 1) {
    fail("route_iq_candidate_rank_invalid", "Ranking ordinal must be a positive integer.", { paths: [`${path}.ordinal`] });
  }
  if (value.probability !== null
    && (typeof value.probability !== "number" || !Number.isFinite(value.probability) || value.probability < 0 || value.probability > 1)) {
    fail("route_iq_candidate_probability_invalid", "Producer probability must be null or between zero and one.", { paths: [`${path}.probability`] });
  }
  return {
    producerSubsystem: value.producerSubsystem,
    ordinal: value.ordinal,
    probability: value.probability,
    basisVersion: requireVersion(value.basisVersion, `${path}.basisVersion`),
    calculatedByData: false,
    readinessInfluence: false
  };
}

function normalizeSourceManifest(sourceManifest, evidenceCutoff) {
  if (!Array.isArray(sourceManifest) || sourceManifest.length === 0) {
    fail("route_iq_candidate_source_manifest_missing", "A non-empty canonical source manifest is required.", { paths: ["producerClaims.sourceManifest"] });
  }
  const cutoff = canonicalTimestamp(evidenceCutoff, "producerClaims.evidenceCutoff").time;
  const ids = new Set();
  return sourceManifest.map((source, index) => {
    const path = `producerClaims.sourceManifest[${index}]`;
    assertExactKeys(source, [
      "sourceRecordId", "sourceSchemaVersion", "sourceVersion", "sourceRecordSha256", "availableAt"
    ], path);
    const sourceRecordId = requireHashId(source.sourceRecordId, "source", `${path}.sourceRecordId`);
    if (ids.has(sourceRecordId)) fail("route_iq_candidate_source_duplicate", "Source IDs must be unique.", { paths: [`${path}.sourceRecordId`] });
    ids.add(sourceRecordId);
    if (source.sourceSchemaVersion !== routeIqCandidateSourceSchemaVersion
      || source.sourceVersion !== routeIqCandidateSourceVersion) {
      fail("route_iq_candidate_source_contract_invalid", "Source schema/version is not canonical.", { paths: [`${path}.sourceSchemaVersion`, `${path}.sourceVersion`] });
    }
    requireSha(source.sourceRecordSha256, `${path}.sourceRecordSha256`);
    const available = canonicalTimestamp(source.availableAt, `${path}.availableAt`);
    if (available.time >= cutoff) {
      fail("route_iq_candidate_source_not_strictly_before_cutoff", "Candidate sources must be available strictly before cutoff.", { paths: [`${path}.availableAt`] });
    }
    return {
      sourceRecordId,
      sourceSchemaVersion: source.sourceSchemaVersion,
      sourceVersion: source.sourceVersion,
      sourceRecordSha256: source.sourceRecordSha256,
      availableAt: available.iso
    };
  }).sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));
}

function normalizeCandidates(candidates, sources, evidenceCutoff) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    fail("route_iq_candidate_manifest_missing", "A non-empty canonical candidate manifest is required.", { paths: ["producerClaims.candidates"] });
  }
  const cutoff = canonicalTimestamp(evidenceCutoff, "producerClaims.evidenceCutoff").time;
  const sourceIds = new Set(sources.map(source => source.sourceRecordId));
  const referencedSources = new Set();
  const candidateIds = new Set();
  const ordinals = new Set();
  const normalized = candidates.map((candidate, index) => {
    const path = `producerClaims.candidates[${index}]`;
    assertExactKeys(candidate, ["candidateId", "sourceRecordIds", "eligibility", "rankingContext"], path);
    const candidateId = requireHashId(candidate.candidateId, "candidate", `${path}.candidateId`);
    if (candidateIds.has(candidateId)) fail("route_iq_candidate_duplicate", "Candidate IDs must be unique.", { paths: [`${path}.candidateId`] });
    candidateIds.add(candidateId);
    if (!Array.isArray(candidate.sourceRecordIds) || candidate.sourceRecordIds.length === 0) {
      fail("route_iq_candidate_source_context_missing", "Each candidate must bind source provenance.", { paths: [`${path}.sourceRecordIds`] });
    }
    const refs = candidate.sourceRecordIds.map((sourceId, sourceIndex) => {
      const id = requireHashId(sourceId, "source", `${path}.sourceRecordIds[${sourceIndex}]`);
      if (!sourceIds.has(id)) {
        fail("route_iq_candidate_source_subset_or_changed", "Candidate source context is outside the complete manifest.", { paths: [`${path}.sourceRecordIds[${sourceIndex}]`] });
      }
      referencedSources.add(id);
      return id;
    });
    if (new Set(refs).size !== refs.length) fail("route_iq_candidate_source_duplicate", "Candidate source references must be unique.", { paths: [`${path}.sourceRecordIds`] });
    assertExactKeys(candidate.eligibility, ["status", "reasonCodes", "evaluatedAt"], `${path}.eligibility`);
    if (candidate.eligibility.status !== "eligible") {
      fail("route_iq_candidate_not_eligible", "The governed active queue may contain only eligible candidates.", { paths: [`${path}.eligibility.status`] });
    }
    if (!Array.isArray(candidate.eligibility.reasonCodes) || candidate.eligibility.reasonCodes.length === 0) {
      fail("route_iq_candidate_eligibility_missing", "Eligibility reasons are required.", { paths: [`${path}.eligibility.reasonCodes`] });
    }
    const reasonCodes = candidate.eligibility.reasonCodes.map((reason, reasonIndex) => requireReason(reason, `${path}.eligibility.reasonCodes[${reasonIndex}]`));
    if (new Set(reasonCodes).size !== reasonCodes.length) fail("route_iq_candidate_eligibility_duplicate", "Eligibility reasons must be unique.", { paths: [`${path}.eligibility.reasonCodes`] });
    const evaluatedAt = canonicalTimestamp(candidate.eligibility.evaluatedAt, `${path}.eligibility.evaluatedAt`);
    if (evaluatedAt.time >= cutoff) {
      fail("route_iq_candidate_eligibility_not_strictly_before_cutoff", "Eligibility must be established strictly before cutoff.", { paths: [`${path}.eligibility.evaluatedAt`] });
    }
    const rankingContext = normalizeRankingContext(candidate.rankingContext, `${path}.rankingContext`);
    if (ordinals.has(rankingContext.ordinal)) fail("route_iq_candidate_rank_duplicate", "Ranking ordinals must be unique.", { paths: [`${path}.rankingContext.ordinal`] });
    ordinals.add(rankingContext.ordinal);
    return {
      candidateId,
      sourceRecordIds: [...refs].sort(),
      eligibility: { status: "eligible", reasonCodes: [...reasonCodes].sort(), evaluatedAt: evaluatedAt.iso },
      rankingContext
    };
  }).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const expectedOrdinals = Array.from({ length: normalized.length }, (_, index) => index + 1);
  if (expectedOrdinals.some(ordinal => !ordinals.has(ordinal))) {
    fail("route_iq_candidate_rank_incomplete", "Ranking ordinals must cover the complete active queue.", { paths: ["producerClaims.candidates"] });
  }
  const unreferenced = [...sourceIds].filter(id => !referencedSources.has(id));
  if (unreferenced.length) {
    fail("route_iq_candidate_source_manifest_not_complete", "Every canonical source must be bound to the complete candidate set.", { paths: ["producerClaims.sourceManifest"] });
  }
  return normalized;
}

function manifestDigestBody({ territoryId, evidenceCutoff, envelopeVersion, producerSubsystem, producerContractVersion, schemaVersion, dataProjectionVersion, candidates, sourceManifest }) {
  return {
    territoryId,
    evidenceCutoff,
    envelopeVersion,
    producerSubsystem,
    producerContractVersion,
    schemaVersion,
    dataProjectionVersion,
    candidateCount: candidates.length,
    sourceCount: sourceManifest.length,
    candidates,
    sourceManifest
  };
}

export function computeRouteIqCandidateManifestDigests(input = {}) {
  assertExactKeys(input, [
    "territoryId", "evidenceCutoff", "envelopeVersion", "producerSubsystem", "producerContractVersion",
    "schemaVersion", "dataProjectionVersion", "candidates", "sourceManifest"
  ], "candidateManifestDigestInput");
  const territoryId = requireHashId(input.territoryId, "territory", "candidateManifestDigestInput.territoryId");
  const evidenceCutoff = canonicalTimestamp(input.evidenceCutoff, "candidateManifestDigestInput.evidenceCutoff").iso;
  if (input.envelopeVersion !== routeIqCandidateProducerEnvelopeVersion
    || input.producerSubsystem !== "Prometheus Intelligence Engine"
    || input.producerContractVersion !== routeIqCandidateProducerContractVersion
    || input.schemaVersion !== routeIqCandidateManifestSchemaVersion
    || input.dataProjectionVersion !== routeIqChronologicalEvidenceProjectionVersion) {
    fail("route_iq_candidate_producer_contract_invalid", "Candidate producer versions are not canonical.");
  }
  const sourceManifest = normalizeSourceManifest(input.sourceManifest, evidenceCutoff);
  const candidates = normalizeCandidates(input.candidates, sourceManifest, evidenceCutoff);
  const body = manifestDigestBody({ ...input, territoryId, evidenceCutoff, candidates, sourceManifest });
  const candidateManifestSha256 = sha256(candidates);
  const sourceManifestSha256 = sha256(sourceManifest);
  const completeManifestSha256 = sha256({
    ...body,
    candidateManifestSha256,
    sourceManifestSha256
  });
  return deepFreeze({
    candidates,
    sourceManifest,
    candidateCount: candidates.length,
    sourceCount: sourceManifest.length,
    candidateManifestSha256,
    sourceManifestSha256,
    completeManifestSha256
  });
}

function normalizeProducerManifestClaims(claims, scope, operationClaims) {
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId",
    "territoryId",
    "canonicalSessionRecordSha256", "sessionEventSequence", "opportunityEventSequence",
    "triggerRecordSha256", "evidenceCutoff", "envelopeVersion", "producerSubsystem",
    "producerContractVersion", "schemaVersion", "dataProjectionVersion", "candidateCount",
    "sourceCount", "candidateManifestSha256", "sourceManifestSha256", "completeManifestSha256",
    "candidates", "sourceManifest"
  ], "verifiedProducerClaims");
  if (claims.purpose !== "candidate_manifest" || !sameScope(claims, scope)) {
    fail("route_iq_candidate_producer_scope_invalid", "Candidate producer claims do not match the coordinator.", {}, 403);
  }
  for (const key of ["canonicalSessionRecordSha256", "triggerRecordSha256"]) requireSha(claims[key], `verifiedProducerClaims.${key}`);
  requireHashId(claims.territoryId, "territory", "verifiedProducerClaims.territoryId");
  requireSequence(claims.sessionEventSequence, "verifiedProducerClaims.sessionEventSequence");
  requireSequence(claims.opportunityEventSequence, "verifiedProducerClaims.opportunityEventSequence");
  if (claims.territoryId !== operationClaims.territoryId
    || claims.canonicalSessionRecordSha256 !== operationClaims.canonicalSessionRecordSha256
    || claims.sessionEventSequence !== operationClaims.sessionEventSequence
    || claims.opportunityEventSequence !== operationClaims.opportunityEventSequence
    || claims.triggerRecordSha256 !== operationClaims.triggerRecordSha256) {
    fail("route_iq_candidate_producer_boundary_mismatch", "Candidate producer claims do not bind the canonical opportunity.", {}, 409);
  }
  const digests = computeRouteIqCandidateManifestDigests({
    territoryId: claims.territoryId,
    evidenceCutoff: claims.evidenceCutoff,
    envelopeVersion: claims.envelopeVersion,
    producerSubsystem: claims.producerSubsystem,
    producerContractVersion: claims.producerContractVersion,
    schemaVersion: claims.schemaVersion,
    dataProjectionVersion: claims.dataProjectionVersion,
    candidates: claims.candidates,
    sourceManifest: claims.sourceManifest
  });
  if (claims.candidateCount !== digests.candidateCount
    || claims.sourceCount !== digests.sourceCount
    || claims.candidateManifestSha256 !== digests.candidateManifestSha256
    || claims.sourceManifestSha256 !== digests.sourceManifestSha256
    || claims.completeManifestSha256 !== digests.completeManifestSha256) {
    fail("route_iq_candidate_manifest_incomplete_or_tampered", "Candidate counts or provenance digests do not match the complete canonical manifest.", {
      paths: [
        "verifiedProducerClaims.candidateCount",
        "verifiedProducerClaims.sourceCount",
        "verifiedProducerClaims.candidateManifestSha256",
        "verifiedProducerClaims.sourceManifestSha256",
        "verifiedProducerClaims.completeManifestSha256"
      ]
    });
  }
  if (operationClaims.expectedCandidateCount !== digests.candidateCount
    || operationClaims.expectedSourceCount !== digests.sourceCount
    || operationClaims.expectedCompleteManifestSha256 !== digests.completeManifestSha256) {
    fail("route_iq_candidate_active_queue_subset", "Producer manifest does not match the Infrastructure-attested complete active queue.", {
      paths: [
        "verifiedClaims.candidate_manifest.expectedCandidateCount",
        "verifiedClaims.candidate_manifest.expectedSourceCount",
        "verifiedClaims.candidate_manifest.expectedCompleteManifestSha256"
      ]
    });
  }
  if (Date.parse(claims.evidenceCutoff) > Date.parse(operationClaims.authoritativeRecordTime)) {
    fail("route_iq_candidate_cutoff_after_record_time", "Evidence cutoff cannot follow authoritative snapshot record time.", { paths: ["verifiedProducerClaims.evidenceCutoff"] });
  }
  const canonical = {
    territoryId: claims.territoryId,
    envelopeVersion: claims.envelopeVersion,
    producerSubsystem: claims.producerSubsystem,
    producerContractVersion: claims.producerContractVersion,
    schemaVersion: claims.schemaVersion,
    dataProjectionVersion: claims.dataProjectionVersion,
    evidenceCutoff: claims.evidenceCutoff,
    candidateCount: digests.candidateCount,
    sourceCount: digests.sourceCount,
    candidateManifestSha256: digests.candidateManifestSha256,
    sourceManifestSha256: digests.sourceManifestSha256,
    completeManifestSha256: digests.completeManifestSha256,
    candidates: clone(digests.candidates),
    sourceManifest: clone(digests.sourceManifest),
    rankingCalculatedByData: false,
    probabilityCalculatedByData: false,
    recommendationInfluence: "off"
  };
  assertNoPiiLikeStrings(canonical, "candidateManifest");
  return deepFreeze(canonical);
}

function originOrChronologyReason(opportunity, claims) {
  if (opportunity.trigger_record_sha256 !== claims.triggerRecordSha256) return "trigger_context_changed";
  if (claims.recordOrigin !== "prospective") return "noncanonical_record_origin";
  if (claims.uncertainChronology) return "uncertain_chronology";
  if (Date.parse(claims.authoritativeRecordTime) <= Date.parse(opportunity.last_record_time)) {
    return "not_strictly_after_prior_record";
  }
  return null;
}

function stateReason(opportunity, expectedState) {
  if (opportunity.canonical_eligible !== 1 || opportunity.state === "EXCLUDED") return "opportunity_permanently_excluded";
  if (opportunity.state !== expectedState) return "invalid_state_transition";
  return null;
}

function updateOpportunityState(repository, opportunityId, event, state, manifestSha256 = undefined) {
  if (manifestSha256 === undefined) {
    repositoryRows(repository, `
      UPDATE opportunities
      SET state = ?, last_record_sequence = ?, last_record_time = ?
      WHERE opportunity_id = ?
    `, [state, event.recordSequence, event.authoritativeRecordTime, opportunityId]);
  } else {
    repositoryRows(repository, `
      UPDATE opportunities
      SET state = ?, current_manifest_sha256 = ?, last_record_sequence = ?, last_record_time = ?
      WHERE opportunity_id = ?
    `, [state, manifestSha256, event.recordSequence, event.authoritativeRecordTime, opportunityId]);
  }
}

function transitionResult(result) {
  if (result?.conflictDecision) throwConflict(result.conflictDecision);
  return deepFreeze(result);
}

function latestEvent(repository, opportunityId, eventKind) {
  return eventFromRow(repositoryOne(repository, `
    SELECT * FROM lifecycle_events
    WHERE opportunity_id = ? AND event_kind = ?
    ORDER BY record_sequence DESC LIMIT 1
  `, [opportunityId, eventKind]));
}

function canonicalRequestForClaims(claims, authority, extra = {}) {
  return {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    verifiedClaims: clone(claims),
    authority: {
      verificationType: authority.verificationType,
      keyId: authority.keyId,
      algorithm: authority.algorithm
    },
    ...extra
  };
}

function validateSealClaims(claims, scope, purpose, expected) {
  const extra = purpose === "shadow_decision_seal" ? ["shadowDecisionRecordSha256"] : [];
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId", "sealId",
    "canonicalEventBoundarySha256", "sealedArtifactId", "sealedRecordSha256",
    "candidateManifestSha256", "sealedAt", ...extra
  ], `verifiedSealClaims.${purpose}`);
  if (claims.purpose !== purpose || !sameScope(claims, scope)) {
    fail("route_iq_coordinator_seal_scope_invalid", "Keyed seal claims do not match coordinator scope.", {}, 403);
  }
  requireHashId(claims.sealId, "seal", `verifiedSealClaims.${purpose}.sealId`);
  requireSha(claims.canonicalEventBoundarySha256, `verifiedSealClaims.${purpose}.canonicalEventBoundarySha256`);
  requireSha(claims.sealedRecordSha256, `verifiedSealClaims.${purpose}.sealedRecordSha256`);
  requireSha(claims.candidateManifestSha256, `verifiedSealClaims.${purpose}.candidateManifestSha256`);
  canonicalTimestamp(claims.sealedAt, `verifiedSealClaims.${purpose}.sealedAt`);
  if (purpose === "snapshot_seal") requireHashId(claims.sealedArtifactId, "snapshot", `verifiedSealClaims.${purpose}.sealedArtifactId`);
  else {
    requireHashId(claims.sealedArtifactId, "snapshot_seal", `verifiedSealClaims.${purpose}.sealedArtifactId`);
    requireSha(claims.shadowDecisionRecordSha256, `verifiedSealClaims.${purpose}.shadowDecisionRecordSha256`);
  }
  const mismatch = claims.canonicalEventBoundarySha256 !== expected.canonicalEventBoundarySha256
    || claims.sealedArtifactId !== expected.sealedArtifactId
    || claims.sealedRecordSha256 !== expected.sealedRecordSha256
    || claims.candidateManifestSha256 !== expected.candidateManifestSha256;
  if (mismatch) fail("route_iq_coordinator_seal_binding_mismatch", "Keyed seal does not bind the canonical prior artifact.", {}, 409);
  return deepFreeze(clone(claims));
}

class RouteIqProspectiveCoordinatorCore {
  constructor({ repository, authorityVerifier, scope, coordinatorId }) {
    this.repository = repository;
    this.authorityVerifier = authorityVerifier;
    this.scope = deepFreeze(clone(scope));
    this.coordinatorId = coordinatorId;
  }

  async verifyOperation(authorityEnvelope, purpose, extraKeys = []) {
    const authority = await verifyEnvelope(this.authorityVerifier, authorityEnvelope, {
      purpose,
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeOperationClaims(authority.claims, this.scope, purpose, extraKeys);
    return { authority, claims, identities: identitiesForClaims(this.coordinatorId, claims) };
  }

  assertInput(input, allowed, path) {
    assertExactKeys(input, allowed, path);
    for (const prohibited of ["workspaceId", "operatingProfileId", "representativeId", "sessionId", "opportunityId", "idempotencyKey", "authoritativeTimestamp", "serverTimestamp", "receiptSha256"]) {
      if (Object.hasOwn(input, prohibited)) {
        fail("route_iq_coordinator_caller_authority_prohibited", `${path}.${prohibited} must not be caller supplied.`, { paths: [`${path}.${prohibited}`] }, 403);
      }
    }
  }

  async trigger(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "triggerRequest");
    const { authority, claims, identities } = await this.verifyOperation(input.authorityEnvelope, "trigger");
    const canonicalRequest = canonicalRequestForClaims(claims, authority);
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      let session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [identities.sessionId]);
      if (!session) {
        const sessionSequence = allocateSequence(this.repository);
        repositoryRows(this.repository, `
          INSERT INTO canonical_sessions (
            session_id, coordinator_id, canonical_session_record_sha256, territory_id,
            session_event_sequence, created_sequence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          identities.sessionId,
          this.coordinatorId,
          claims.canonicalSessionRecordSha256,
          claims.territoryId,
          claims.sessionEventSequence,
          sessionSequence,
          claims.authoritativeRecordTime
        ]);
        session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [identities.sessionId]);
      } else if (session.coordinator_id !== this.coordinatorId
        || session.canonical_session_record_sha256 !== claims.canonicalSessionRecordSha256
        || session.territory_id !== claims.territoryId
        || Number(session.session_event_sequence) !== claims.sessionEventSequence) {
        fail("route_iq_coordinator_session_identity_conflict", "Canonical session sequence resolved to changed server evidence.", {}, 409);
      }

      let opportunity = getOpportunity(this.repository, identities.opportunityId);
      if (!opportunity) {
        repositoryRows(this.repository, `
          INSERT INTO opportunities (
            opportunity_id, coordinator_id, session_id, territory_id, opportunity_type,
            opportunity_event_sequence, trigger_record_sha256, trigger_boundary_sha256,
            state, canonical_eligible, current_manifest_sha256, last_record_sequence, last_record_time
          ) VALUES (?, ?, ?, ?, 'next_stop', ?, ?, ?, 'TRIGGERED', 1, NULL, 0, ?)
        `, [
          identities.opportunityId,
          this.coordinatorId,
          identities.sessionId,
          claims.territoryId,
          claims.opportunityEventSequence,
          claims.triggerRecordSha256,
          claims.canonicalEventBoundarySha256,
          claims.authoritativeRecordTime
        ]);
        opportunity = getOpportunity(this.repository, identities.opportunityId);
      } else {
        assertOpportunityIdentity(opportunity, identities, claims);
      }

      const existing = existingReceiptDecision(this.repository, {
        identities,
        operationKind: "trigger",
        requestSha256,
        claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };

      const originalTriggerReceipt = repositoryOne(this.repository, `
        SELECT * FROM operation_receipts
        WHERE opportunity_id = ? AND operation_kind = 'trigger'
        ORDER BY created_sequence ASC
        LIMIT 1
      `, [identities.opportunityId]);
      if (originalTriggerReceipt) {
        return {
          conflictDecision: recordConflictAgainstReceipt(this.repository, {
            identities,
            operationKind: "trigger",
            requestSha256,
            claims,
            canonicalRequest,
            originalReceiptRow: originalTriggerReceipt
          })
        };
      }

      insertAttempt(this.repository, {
        identities,
        claims,
        operationKind: "trigger",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: identities.sessionId,
        opportunityId: identities.opportunityId,
        operationKey: identities.operationKey,
        requestSha256,
        logicalBoundarySha256: claims.canonicalEventBoundarySha256,
        authoritativeRecordTime: claims.authoritativeRecordTime,
        eventKind: "TRIGGERED",
        artifactKind: "opportunity_trigger",
        fromState: null,
        toState: "TRIGGERED",
        payload: {
          opportunityType: "next_stop",
          territoryId: claims.territoryId,
          canonicalSessionRecordSha256: claims.canonicalSessionRecordSha256,
          sessionEventSequence: claims.sessionEventSequence,
          opportunityEventSequence: claims.opportunityEventSequence,
          triggerRecordSha256: claims.triggerRecordSha256,
          clientEventSequence: claims.clientEventSequence,
          clientContentSha256: claims.clientContentSha256,
          recordOrigin: claims.recordOrigin
        },
        canonicalEvidenceEligible: false
      });
      updateOpportunityState(this.repository, identities.opportunityId, event, "TRIGGERED");
      if (claims.recordOrigin !== "prospective" || claims.uncertainChronology) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims,
          operationKind: "trigger",
          reasonCodes: [claims.recordOrigin !== "prospective" ? "noncanonical_record_origin" : "uncertain_chronology"],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      return insertReceipt(this.repository, {
        identities,
        operationKind: "trigger",
        requestSha256,
        event,
        state: "TRIGGERED"
      });
    });
    return transitionResult(result);
  }

  async acceptCandidateManifest(input = {}) {
    this.assertInput(input, ["authorityEnvelope", "producerEnvelope"], "candidateManifestRequest");
    const verified = await this.verifyOperation(input.authorityEnvelope, "candidate_manifest", [
      "expectedCandidateCount", "expectedSourceCount", "expectedCompleteManifestSha256"
    ]);
    requireSequence(verified.claims.expectedCandidateCount, "verifiedClaims.candidate_manifest.expectedCandidateCount");
    requireSequence(verified.claims.expectedSourceCount, "verifiedClaims.candidate_manifest.expectedSourceCount");
    if (verified.claims.expectedCandidateCount < 1 || verified.claims.expectedSourceCount < 1) {
      fail("route_iq_candidate_active_queue_count_invalid", "Expected active queue counts must be positive.");
    }
    requireSha(verified.claims.expectedCompleteManifestSha256, "verifiedClaims.candidate_manifest.expectedCompleteManifestSha256");
    let producerAuthority;
    let manifest;
    let validationFailure = null;
    const incomingDigest = sha256(stableJson(input.producerEnvelope));
    try {
      producerAuthority = await verifyEnvelope(this.authorityVerifier, input.producerEnvelope, {
        purpose: "candidate_manifest",
        coordinatorId: this.coordinatorId,
        producer: true
      });
      manifest = normalizeProducerManifestClaims(producerAuthority.claims, this.scope, verified.claims);
    } catch (error) {
      validationFailure = error;
    }
    if (validationFailure) {
      const result = this.repository.transactionSync(() => persistExclusion(this.repository, {
        coordinatorId: this.coordinatorId,
        identities: verified.identities,
        claims: verified.claims,
        operationKind: "candidate_manifest",
        reasonCodes: [validationFailure.code === "route_iq_coordinator_keyed_authentication_required"
          ? "producer_envelope_authentication_failed"
          : "candidate_manifest_incomplete_or_tampered"],
        incomingDigest,
        offendingPaths: validationFailure.details?.paths || []
      }));
      return transitionResult(result);
    }
    const canonicalRequest = canonicalRequestForClaims(verified.claims, verified.authority, {
      producerAuthority: {
        verificationType: producerAuthority.verificationType,
        keyId: producerAuthority.keyId,
        algorithm: producerAuthority.algorithm
      },
      manifest
    });
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: "candidate_manifest",
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      const exclusionReason = stateReason(opportunity, "TRIGGERED") || originOrChronologyReason(opportunity, verified.claims);
      if (exclusionReason) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: "candidate_manifest",
          reasonCodes: [exclusionReason],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      insertAttempt(this.repository, {
        identities: verified.identities,
        claims: verified.claims,
        operationKind: "candidate_manifest",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: verified.identities.sessionId,
        opportunityId: verified.identities.opportunityId,
        operationKey: verified.identities.operationKey,
        requestSha256,
        logicalBoundarySha256: verified.claims.canonicalEventBoundarySha256,
        authoritativeRecordTime: verified.claims.authoritativeRecordTime,
        eventKind: "SNAPSHOT_PENDING_SEAL",
        artifactKind: "accepted_snapshot_pending_seal",
        fromState: "TRIGGERED",
        toState: "SNAPSHOT_PENDING_SEAL",
        payload: {
          completeManifestSha256: manifest.completeManifestSha256,
          candidateManifestSha256: manifest.candidateManifestSha256,
          sourceManifestSha256: manifest.sourceManifestSha256,
          candidateCount: manifest.candidateCount,
          sourceCount: manifest.sourceCount,
          evidenceCutoff: manifest.evidenceCutoff,
          producerContractVersion: manifest.producerContractVersion,
          schemaVersion: manifest.schemaVersion,
          dataProjectionVersion: manifest.dataProjectionVersion,
          sealed: false,
          readinessEvidenceEligible: false
        },
        canonicalEvidenceEligible: false
      });
      const manifestJson = canonicalText(manifest);
      repositoryRows(this.repository, `
        INSERT INTO candidate_manifests (
          snapshot_artifact_id, opportunity_id, producer_envelope_version,
          producer_contract_version, schema_version, data_projection_version,
          evidence_cutoff, candidate_count, source_count, candidate_manifest_sha256,
          source_manifest_sha256, complete_manifest_sha256, manifest_json, manifest_record_sha256
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        event.artifactId,
        verified.identities.opportunityId,
        manifest.envelopeVersion,
        manifest.producerContractVersion,
        manifest.schemaVersion,
        manifest.dataProjectionVersion,
        manifest.evidenceCutoff,
        manifest.candidateCount,
        manifest.sourceCount,
        manifest.candidateManifestSha256,
        manifest.sourceManifestSha256,
        manifest.completeManifestSha256,
        manifestJson,
        sha256(manifestJson)
      ]);
      updateOpportunityState(this.repository, verified.identities.opportunityId, event, "SNAPSHOT_PENDING_SEAL", manifest.completeManifestSha256);
      return insertReceipt(this.repository, {
        identities: verified.identities,
        operationKind: "candidate_manifest",
        requestSha256,
        event,
        state: "SNAPSHOT_PENDING_SEAL",
        details: {
          candidateManifestSha256: manifest.candidateManifestSha256,
          sourceManifestSha256: manifest.sourceManifestSha256,
          completeManifestSha256: manifest.completeManifestSha256,
          sealed: false,
          canonicalEvidenceEligible: false
        }
      });
    });
    return transitionResult(result);
  }

  async sealSnapshot(input = {}) {
    return this.sealTransition(input, {
      requestPath: "snapshotSealRequest",
      operationPurpose: "snapshot_seal_record",
      sealPurpose: "snapshot_seal",
      operationKind: "snapshot_seal",
      expectedState: "SNAPSHOT_PENDING_SEAL",
      eventKind: "SNAPSHOT_SEALED",
      artifactKind: "snapshot_seal",
      nextState: "SNAPSHOT_SEALED"
    });
  }

  async sealShadowDecision(input = {}) {
    return this.sealTransition(input, {
      requestPath: "shadowDecisionSealRequest",
      operationPurpose: "shadow_decision_seal_record",
      operationExtraKeys: ["shadowDecisionRecordSha256"],
      sealPurpose: "shadow_decision_seal",
      operationKind: "shadow_decision_seal",
      expectedState: "SNAPSHOT_SEALED",
      eventKind: "SHADOW_DECISION_SEALED",
      artifactKind: "shadow_decision_seal",
      nextState: "SHADOW_DECISION_SEALED"
    });
  }

  async sealTransition(input, config) {
    this.assertInput(input, ["authorityEnvelope", "sealEnvelope"], config.requestPath);
    const verified = await this.verifyOperation(input.authorityEnvelope, config.operationPurpose, config.operationExtraKeys || []);
    let sealAuthority;
    let sealClaims;
    let sealFailure = null;
    const incomingDigest = sha256(stableJson(input.sealEnvelope));
    const opportunitySnapshot = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      const manifestRow = repositoryOne(this.repository, "SELECT * FROM candidate_manifests WHERE opportunity_id = ?", [verified.identities.opportunityId]);
      const priorKind = config.expectedState === "SNAPSHOT_PENDING_SEAL" ? "SNAPSHOT_PENDING_SEAL" : "SNAPSHOT_SEALED";
      const priorEvent = latestEvent(this.repository, verified.identities.opportunityId, priorKind);
      if (!manifestRow || !priorEvent) fail("route_iq_coordinator_seal_prerequisite_missing", "Seal prerequisite is missing.", {}, 409);
      parseCanonicalJson(manifestRow.manifest_json, manifestRow.manifest_record_sha256, "candidate manifest");
      return {
        opportunity,
        priorEvent,
        manifestRow,
        expected: {
          canonicalEventBoundarySha256: verified.claims.canonicalEventBoundarySha256,
          sealedArtifactId: priorEvent.artifactId,
          sealedRecordSha256: priorEvent.recordSha256,
          candidateManifestSha256: manifestRow.candidate_manifest_sha256
        }
      };
    });
    try {
      sealAuthority = await verifyEnvelope(this.authorityVerifier, input.sealEnvelope, {
        purpose: config.sealPurpose,
        coordinatorId: this.coordinatorId
      });
      sealClaims = validateSealClaims(sealAuthority.claims, this.scope, config.sealPurpose, opportunitySnapshot.expected);
      if (config.sealPurpose === "shadow_decision_seal"
        && sealClaims.shadowDecisionRecordSha256 !== verified.claims.shadowDecisionRecordSha256) {
        fail("route_iq_coordinator_shadow_decision_seal_mismatch", "Shadow decision seal does not bind the verified decision record.", {}, 409);
      }
      if (sealClaims.sealedAt !== verified.claims.authoritativeRecordTime) {
        fail("route_iq_coordinator_seal_time_mismatch", "Keyed seal time must equal the authoritative transition time.", {}, 409);
      }
    } catch (error) {
      sealFailure = error;
    }
    if (sealFailure) {
      const result = this.repository.transactionSync(() => persistExclusion(this.repository, {
        coordinatorId: this.coordinatorId,
        identities: verified.identities,
        claims: verified.claims,
        operationKind: config.operationKind,
        reasonCodes: ["keyed_seal_missing_or_tampered"],
        incomingDigest,
        offendingPaths: sealFailure.details?.paths || []
      }));
      return transitionResult(result);
    }
    const canonicalRequest = canonicalRequestForClaims(verified.claims, verified.authority, {
      sealAuthority: {
        verificationType: sealAuthority.verificationType,
        keyId: sealAuthority.keyId,
        algorithm: sealAuthority.algorithm
      },
      sealClaims
    });
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      const exclusionReason = stateReason(opportunity, config.expectedState) || originOrChronologyReason(opportunity, verified.claims);
      if (exclusionReason) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: config.operationKind,
          reasonCodes: [exclusionReason],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      insertAttempt(this.repository, {
        identities: verified.identities,
        claims: verified.claims,
        operationKind: config.operationKind,
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: verified.identities.sessionId,
        opportunityId: verified.identities.opportunityId,
        operationKey: verified.identities.operationKey,
        requestSha256,
        logicalBoundarySha256: verified.claims.canonicalEventBoundarySha256,
        authoritativeRecordTime: verified.claims.authoritativeRecordTime,
        eventKind: config.eventKind,
        artifactKind: config.artifactKind,
        fromState: config.expectedState,
        toState: config.nextState,
        payload: {
          sealId: sealClaims.sealId,
          keyedAlgorithm: sealAuthority.algorithm,
          keyId: sealAuthority.keyId,
          sealedArtifactId: sealClaims.sealedArtifactId,
          sealedRecordSha256: sealClaims.sealedRecordSha256,
          candidateManifestSha256: sealClaims.candidateManifestSha256,
          shadowDecisionRecordSha256: sealClaims.shadowDecisionRecordSha256 || null,
          sealedAt: sealClaims.sealedAt,
          readinessEvidenceEligible: config.nextState === "SHADOW_DECISION_SEALED"
        },
        canonicalEvidenceEligible: config.nextState === "SHADOW_DECISION_SEALED"
      });
      updateOpportunityState(this.repository, verified.identities.opportunityId, event, config.nextState);
      return insertReceipt(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        event,
        state: config.nextState,
        details: {
          keyedSealVerified: true,
          sealId: sealClaims.sealId,
          canonicalEvidenceEligible: config.nextState === "SHADOW_DECISION_SEALED"
        }
      });
    });
    return transitionResult(result);
  }

  async linkAction(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "actionLinkRequest");
    const verified = await this.verifyOperation(input.authorityEnvelope, "action", ["selectedCandidateId", "decisionSource"]);
    requireHashId(verified.claims.selectedCandidateId, "candidate", "verifiedClaims.action.selectedCandidateId");
    let decisionSource = null;
    if (verified.claims.decisionSource !== null) {
      assertExactKeys(verified.claims.decisionSource, ["sourceId"], "verifiedClaims.action.decisionSource");
      if (!routeIqVisitDecisionSourceIds.includes(verified.claims.decisionSource.sourceId)) {
        fail("route_iq_coordinator_decision_source_invalid", "Decision Source is not canonical.", { paths: ["verifiedClaims.action.decisionSource.sourceId"] });
      }
      decisionSource = { sourceId: verified.claims.decisionSource.sourceId };
    }
    return this.simpleTransition(verified, {
      operationKind: "action",
      expectedState: "SHADOW_DECISION_SEALED",
      eventKind: "ACTION_LINKED",
      artifactKind: "action",
      nextState: "ACTION_LINKED",
      validate: repository => {
        const manifestRow = repositoryOne(repository, "SELECT * FROM candidate_manifests WHERE opportunity_id = ?", [verified.identities.opportunityId]);
        if (!manifestRow) return "candidate_manifest_missing";
        const manifest = parseCanonicalJson(manifestRow.manifest_json, manifestRow.manifest_record_sha256, "candidate manifest");
        if (!manifest.candidates.some(candidate => candidate.candidateId === verified.claims.selectedCandidateId)) {
          return "candidate_context_missing_or_changed";
        }
        return null;
      },
      payload: {
        selectedCandidateId: verified.claims.selectedCandidateId,
        clientEventSequence: verified.claims.clientEventSequence,
        clientContentSha256: verified.claims.clientContentSha256,
        decisionSource: decisionSource ? {
          ...decisionSource,
          capturedAt: verified.claims.authoritativeRecordTime,
          temporalClassification: "post_action_observation",
          provesSealing: false,
          scoreable: false,
          sampleSupport: false
        } : null
      }
    });
  }

  async linkOutcome(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "outcomeLinkRequest");
    const verified = await this.verifyOperation(input.authorityEnvelope, "outcome", ["evaluatedCandidateId", "observedOutcome"]);
    requireHashId(verified.claims.evaluatedCandidateId, "candidate", "verifiedClaims.outcome.evaluatedCandidateId");
    assertExactKeys(verified.claims.observedOutcome, ["status", "value"], "verifiedClaims.outcome.observedOutcome");
    if (!["observed", "missing"].includes(verified.claims.observedOutcome.status)
      || (verified.claims.observedOutcome.status === "observed" && typeof verified.claims.observedOutcome.value !== "boolean")
      || (verified.claims.observedOutcome.status === "missing" && verified.claims.observedOutcome.value !== null)) {
      fail("route_iq_coordinator_outcome_invalid", "Observed outcome does not match its governed status.", { paths: ["verifiedClaims.outcome.observedOutcome"] });
    }
    return this.simpleTransition(verified, {
      operationKind: "outcome",
      expectedState: "ACTION_LINKED",
      eventKind: "OUTCOME_LINKED",
      artifactKind: "outcome",
      nextState: "OUTCOME_LINKED",
      validate: repository => {
        const action = latestEvent(repository, verified.identities.opportunityId, "ACTION_LINKED");
        if (!action) return "action_missing";
        if (action.canonical.payload.selectedCandidateId !== verified.claims.evaluatedCandidateId) {
          return "candidate_context_missing_or_changed";
        }
        return null;
      },
      payload: {
        evaluatedCandidateId: verified.claims.evaluatedCandidateId,
        observedOutcome: clone(verified.claims.observedOutcome),
        clientEventSequence: verified.claims.clientEventSequence,
        clientContentSha256: verified.claims.clientContentSha256
      }
    });
  }

  async evaluate(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "evaluationRequest");
    const verified = await this.verifyOperation(input.authorityEnvelope, "evaluation", ["evaluationRecordSha256"]);
    requireSha(verified.claims.evaluationRecordSha256, "verifiedClaims.evaluation.evaluationRecordSha256");
    return this.simpleTransition(verified, {
      operationKind: "evaluation",
      expectedState: "OUTCOME_LINKED",
      eventKind: "EVALUATED",
      artifactKind: "evaluation",
      nextState: "EVALUATED",
      payload: {
        evaluationRecordSha256: verified.claims.evaluationRecordSha256,
        calculatedByData: false,
        recommendationInfluence: "off"
      }
    });
  }

  async appendCorrection(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "correctionRequest");
    const verified = await this.verifyOperation(input.authorityEnvelope, "correction", [
      "targetKind", "targetClientEventSequence", "replacement", "reasonCode"
    ]);
    if (!["outcome", "correction"].includes(verified.claims.targetKind)) {
      fail("route_iq_coordinator_correction_target_invalid", "Correction target kind is not governed.", { paths: ["verifiedClaims.correction.targetKind"] });
    }
    requireSequence(verified.claims.targetClientEventSequence, "verifiedClaims.correction.targetClientEventSequence");
    requireReason(verified.claims.reasonCode, "verifiedClaims.correction.reasonCode");
    assertExactKeys(verified.claims.replacement, ["evaluatedCandidateId", "observedOutcome"], "verifiedClaims.correction.replacement");
    requireHashId(verified.claims.replacement.evaluatedCandidateId, "candidate", "verifiedClaims.correction.replacement.evaluatedCandidateId");
    assertExactKeys(verified.claims.replacement.observedOutcome, ["status", "value"], "verifiedClaims.correction.replacement.observedOutcome");
    const observed = verified.claims.replacement.observedOutcome;
    if (!["observed", "missing"].includes(observed.status)
      || (observed.status === "observed" && typeof observed.value !== "boolean")
      || (observed.status === "missing" && observed.value !== null)) {
      fail("route_iq_coordinator_correction_outcome_invalid", "Correction outcome is invalid.", { paths: ["verifiedClaims.correction.replacement.observedOutcome"] });
    }
    const canonicalRequest = canonicalRequestForClaims(verified.claims, verified.authority);
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: "correction",
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      let exclusionReason = opportunity.canonical_eligible !== 1 || opportunity.state === "EXCLUDED"
        ? "opportunity_permanently_excluded"
        : null;
      if (!exclusionReason && !["OUTCOME_LINKED", "EVALUATED"].includes(opportunity.state)) exclusionReason = "invalid_state_transition";
      if (!exclusionReason) exclusionReason = originOrChronologyReason(opportunity, verified.claims);
      const targetEventKind = verified.claims.targetKind === "outcome" ? "OUTCOME_LINKED" : "CORRECTION_APPENDED";
      const targetRows = repositoryRows(this.repository, `
        SELECT * FROM lifecycle_events WHERE opportunity_id = ? AND event_kind = ? ORDER BY record_sequence
      `, [verified.identities.opportunityId, targetEventKind]);
      const target = targetRows.map(eventFromRow).find(event => event.canonical.payload.clientEventSequence === verified.claims.targetClientEventSequence);
      if (!exclusionReason && !target) exclusionReason = "correction_target_missing_or_excluded";
      if (!exclusionReason && Date.parse(verified.claims.authoritativeRecordTime) <= Date.parse(target.authoritativeRecordTime)) {
        exclusionReason = "correction_not_strictly_after_target";
      }
      if (!exclusionReason && target.canonical.payload.evaluatedCandidateId !== verified.claims.replacement.evaluatedCandidateId) {
        exclusionReason = "candidate_context_missing_or_changed";
      }
      if (exclusionReason) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: "correction",
          reasonCodes: [exclusionReason],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      insertAttempt(this.repository, {
        identities: verified.identities,
        claims: verified.claims,
        operationKind: "correction",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: verified.identities.sessionId,
        opportunityId: verified.identities.opportunityId,
        operationKey: verified.identities.operationKey,
        requestSha256,
        logicalBoundarySha256: verified.claims.canonicalEventBoundarySha256,
        authoritativeRecordTime: verified.claims.authoritativeRecordTime,
        eventKind: "CORRECTION_APPENDED",
        artifactKind: "correction",
        fromState: opportunity.state,
        toState: opportunity.state,
        payload: {
          targetKind: verified.claims.targetKind,
          targetArtifactId: target.artifactId,
          targetClientEventSequence: verified.claims.targetClientEventSequence,
          evaluatedCandidateId: verified.claims.replacement.evaluatedCandidateId,
          observedOutcome: clone(verified.claims.replacement.observedOutcome),
          reasonCode: verified.claims.reasonCode,
          clientEventSequence: verified.claims.clientEventSequence,
          clientContentSha256: verified.claims.clientContentSha256,
          priorHistoryPreserved: true
        },
        canonicalEvidenceEligible: opportunity.state === "EVALUATED"
      });
      updateOpportunityState(this.repository, verified.identities.opportunityId, event, opportunity.state);
      return insertReceipt(this.repository, {
        identities: verified.identities,
        operationKind: "correction",
        requestSha256,
        event,
        state: opportunity.state,
        details: { targetArtifactId: target.artifactId, priorHistoryPreserved: true }
      });
    });
    return transitionResult(result);
  }

  async simpleTransition(verified, config) {
    const canonicalRequest = canonicalRequestForClaims(verified.claims, verified.authority, { payload: config.payload });
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      const customReason = config.validate ? config.validate(this.repository) : null;
      const exclusionReason = stateReason(opportunity, config.expectedState)
        || originOrChronologyReason(opportunity, verified.claims)
        || customReason;
      if (exclusionReason) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: config.operationKind,
          reasonCodes: [exclusionReason],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      insertAttempt(this.repository, {
        identities: verified.identities,
        claims: verified.claims,
        operationKind: config.operationKind,
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: verified.identities.sessionId,
        opportunityId: verified.identities.opportunityId,
        operationKey: verified.identities.operationKey,
        requestSha256,
        logicalBoundarySha256: verified.claims.canonicalEventBoundarySha256,
        authoritativeRecordTime: verified.claims.authoritativeRecordTime,
        eventKind: config.eventKind,
        artifactKind: config.artifactKind,
        fromState: config.expectedState,
        toState: config.nextState,
        payload: clone(config.payload),
        canonicalEvidenceEligible: true
      });
      updateOpportunityState(this.repository, verified.identities.opportunityId, event, config.nextState);
      return insertReceipt(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        event,
        state: config.nextState,
        details: { canonicalEvidenceEligible: true }
      });
    });
    return transitionResult(result);
  }

  recoverNextProjection() {
    return this.repository.transactionSync(() => recoverNextProjection(this.repository, this.scope, this.coordinatorId));
  }

  async readCommittedProjectionAsOf(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "projectionReadRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "projection_read",
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeProjectionReadClaims(authority.claims, this.scope);
    return this.repository.transactionSync(() => readCommittedProjection(this.repository, this.scope, this.coordinatorId, claims));
  }
}

function normalizeProjectionReadClaims(claims, scope) {
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId",
    "territoryId",
    "canonicalSessionRecordSha256", "sessionEventSequence", "opportunityEventSequence",
    "triggerRecordSha256", "asOfRecordSequence", "asOfRecordTime"
  ], "verifiedProjectionReadClaims");
  if (claims.purpose !== "projection_read" || !sameScope(claims, scope)) {
    fail("route_iq_coordinator_projection_scope_invalid", "Projection read scope is not authorized for this coordinator.", {}, 403);
  }
  requireSequence(claims.asOfRecordSequence, "verifiedProjectionReadClaims.asOfRecordSequence");
  requireHashId(claims.territoryId, "territory", "verifiedProjectionReadClaims.territoryId");
  requireSha(claims.canonicalSessionRecordSha256, "verifiedProjectionReadClaims.canonicalSessionRecordSha256");
  requireSequence(claims.sessionEventSequence, "verifiedProjectionReadClaims.sessionEventSequence");
  requireSequence(claims.opportunityEventSequence, "verifiedProjectionReadClaims.opportunityEventSequence");
  requireSha(claims.triggerRecordSha256, "verifiedProjectionReadClaims.triggerRecordSha256");
  canonicalTimestamp(claims.asOfRecordTime, "verifiedProjectionReadClaims.asOfRecordTime");
  return deepFreeze(clone(claims));
}

function projectionEvidenceKind(eventKind) {
  return {
    SNAPSHOT_PENDING_SEAL: "prospective_opportunity_snapshot",
    ACTION_LINKED: "prospective_opportunity_action",
    OUTCOME_LINKED: "prospective_opportunity_outcome",
    CORRECTION_APPENDED: "prospective_outcome_correction"
  }[eventKind] || null;
}

function buildAsOfProjection(repository, scope, coordinatorId, opportunityId, asOfRecordSequence, asOfRecordTime) {
  const opportunity = getOpportunity(repository, opportunityId);
  if (!opportunity || opportunity.coordinator_id !== coordinatorId) {
    fail("route_iq_coordinator_projection_opportunity_mismatch", "Projection source opportunity is outside the coordinator.", {}, 500);
  }
  const rows = repositoryRows(repository, `
    SELECT e.*, r.artifact_kind AS registry_artifact_kind
    FROM lifecycle_events e
    JOIN artifact_registry r ON r.artifact_id = e.artifact_id
    WHERE e.opportunity_id = ?
      AND e.record_sequence <= ?
      AND e.authoritative_record_time <= ?
    ORDER BY e.record_sequence, e.artifact_id
  `, [opportunityId, asOfRecordSequence, asOfRecordTime]);
  if (rows.length === 0) fail("route_iq_coordinator_projection_source_missing", "Projection source history is missing.", {}, 500);
  const artifactIds = new Set();
  const events = rows.map(row => {
    if (row.registry_artifact_kind !== row.artifact_kind || artifactIds.has(row.artifact_id)) {
      fail("route_iq_coordinator_cross_kind_artifact_collision", "Artifact identity is duplicated or collapses across kinds.", {}, 500);
    }
    artifactIds.add(row.artifact_id);
    return eventFromRow(row);
  });
  const last = events.at(-1);
  let state = last.canonical.toState || last.canonical.fromState;
  const governanceEvents = events.filter(event => ["EXCLUSION_RECORDED", "CONFLICT_RECORDED"].includes(event.eventKind));
  if (governanceEvents.length) state = "EXCLUDED";
  const readinessEvidenceEligible = governanceEvents.length === 0 && STATE_RANK[state] >= STATE_RANK.SHADOW_DECISION_SEALED;
  const snapshotEvent = events.find(event => event.eventKind === "SNAPSHOT_PENDING_SEAL") || null;
  let manifest = null;
  if (snapshotEvent) {
    const manifestRow = repositoryOne(repository, "SELECT * FROM candidate_manifests WHERE snapshot_artifact_id = ?", [snapshotEvent.artifactId]);
    if (!manifestRow) fail("route_iq_coordinator_projection_manifest_missing", "Committed snapshot manifest is missing.", {}, 500);
    manifest = parseCanonicalJson(manifestRow.manifest_json, manifestRow.manifest_record_sha256, "candidate manifest");
    if (manifest.completeManifestSha256 !== manifestRow.complete_manifest_sha256) {
      fail("route_iq_coordinator_poison_record", "Candidate manifest digest columns are inconsistent.", {}, 500);
    }
  }
  const evidence = readinessEvidenceEligible
    ? events.flatMap(event => {
      const evidenceKind = projectionEvidenceKind(event.eventKind);
      if (!evidenceKind) return [];
      const payload = event.eventKind === "SNAPSHOT_PENDING_SEAL"
        ? { ...clone(event.canonical.payload), manifest: clone(manifest) }
        : clone(event.canonical.payload);
      return [{
        sourceRecordId: event.artifactId,
        evidenceKind,
        evidenceTimestamp: event.authoritativeRecordTime,
        recordSequence: event.recordSequence,
        recordSha256: event.recordSha256,
        payload,
        canonicalEvidenceEligible: true,
        recommendationInfluence: "off"
      }];
    })
    : [];
  const exclusions = governanceEvents.map(event => ({
    sourceRecordId: event.artifactId,
    evidenceTimestamp: event.authoritativeRecordTime,
    recordSequence: event.recordSequence,
    reason: event.eventKind === "CONFLICT_RECORDED" ? "governed_prospective_conflict" : "governed_prospective_exclusion",
    recordSha256: event.recordSha256
  }));
  if (!readinessEvidenceEligible && exclusions.length === 0) {
    exclusions.push({
      sourceRecordId: last.artifactId,
      evidenceTimestamp: last.authoritativeRecordTime,
      recordSequence: last.recordSequence,
      reason: "unsealed_or_incomplete_at_cutoff",
      recordSha256: last.recordSha256
    });
  }
  return {
    schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
    projectionVersion: routeIqProspectiveCoordinatorProjectionVersion,
    authority: "sqlite_durable_object_coordinator",
    coordinatorId,
    scope: clone(scope),
    territoryId: opportunity.territory_id,
    opportunityId,
    opportunityType: "next_stop",
    asOfRecordSequence,
    asOfRecordTime,
    state,
    readinessEvidenceEligible,
    evidence,
    exclusions,
    sourceArtifacts: events.map(event => ({
      artifactId: event.artifactId,
      artifactKind: event.artifactKind,
      eventKind: event.eventKind,
      recordSequence: event.recordSequence,
      authoritativeRecordTime: event.authoritativeRecordTime,
      recordSha256: event.recordSha256
    })),
    recommendationInfluence: "off",
    collectionDefault: "off",
    kvAuthority: "non_authoritative_cache_only"
  };
}

function verifyProjectionRow(row) {
  const projection = parseCanonicalJson(row.projection_json, row.projection_sha256, "coordinator projection");
  if (projection.projectionVersion !== routeIqProspectiveCoordinatorProjectionVersion
    || projection.authority !== "sqlite_durable_object_coordinator"
    || typeof projection.territoryId !== "string"
    || !HASH_ID_PATTERNS.territory.test(projection.territoryId)
    || projection.opportunityId !== row.opportunity_id
    || projection.asOfRecordSequence !== Number(row.as_of_record_sequence)
    || projection.asOfRecordTime !== row.as_of_record_time) {
    fail("route_iq_coordinator_projection_poisoned", "Coordinator projection columns do not match canonical bytes.", {}, 500);
  }
  if (!Array.isArray(projection.sourceArtifacts)) {
    fail("route_iq_coordinator_projection_poisoned", "Coordinator projection source artifacts are not canonical.", {}, 500);
  }
  const sourceIds = projection.sourceArtifacts.map(source => source.artifactId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    fail("route_iq_coordinator_cross_kind_artifact_collision", "Projection source artifacts collapse duplicate IDs.", {}, 500);
  }
  return projection;
}

function commitBodyFromRow(row) {
  return {
    commitId: row.commit_id,
    projectionId: row.commit_projection_id,
    outboxId: row.commit_outbox_id,
    status: row.status,
    projectionSha256: row.commit_projection_sha256,
    committedSequence: Number(row.committed_sequence),
    committedAt: row.committed_at,
    projectionCommitMarkerWrittenLast: true
  };
}

function recoverNextProjection(repository, scope, coordinatorId) {
  const outbox = repositoryOne(repository, `
    SELECT o.*
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE c.outbox_id IS NULL
    ORDER BY o.source_record_sequence, o.outbox_id
    LIMIT 1
  `);
  if (!outbox) return deepFreeze({ ok: true, status: "idle", recovered: false });
  const instruction = parseCanonicalJson(outbox.instruction_json, outbox.instruction_sha256, "projection outbox instruction");
  if (instruction.outboxId !== outbox.outbox_id
    || instruction.sourceRecordSequence !== Number(outbox.source_record_sequence)
    || instruction.authoritativeRecordTime !== outbox.authoritative_record_time) {
    fail("route_iq_coordinator_outbox_poisoned", "Projection outbox instruction is inconsistent.", {}, 500);
  }
  const projection = buildAsOfProjection(
    repository,
    scope,
    coordinatorId,
    outbox.opportunity_id,
    Number(outbox.source_record_sequence),
    outbox.authoritative_record_time
  );
  const projectionJson = canonicalText(projection);
  const projectionSha256 = sha256(projectionJson);
  const projectionId = hashId("projection", { outboxId: outbox.outbox_id, projectionSha256 });
  const existingProjection = repositoryOne(repository, "SELECT * FROM projection_artifacts WHERE outbox_id = ?", [outbox.outbox_id]);
  let recoveredPartial = false;
  if (existingProjection) {
    recoveredPartial = true;
    const parsed = verifyProjectionRow(existingProjection);
    if (existingProjection.projection_id !== projectionId || stableJson(parsed) !== projectionJson) {
      fail("route_iq_coordinator_projection_conflict", "Partial projection does not match deterministic recovery bytes.", {}, 500);
    }
  } else {
    registerArtifact(repository, {
      artifactId: projectionId,
      artifactKind: "coordinator_projection",
      opportunityId: outbox.opportunity_id,
      recordSequence: Number(outbox.source_record_sequence),
      registeredAt: outbox.authoritative_record_time
    });
    repositoryRows(repository, `
      INSERT INTO projection_artifacts (
        projection_id, outbox_id, opportunity_id, as_of_record_sequence,
        as_of_record_time, projection_json, projection_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      projectionId,
      outbox.outbox_id,
      outbox.opportunity_id,
      Number(outbox.source_record_sequence),
      outbox.authoritative_record_time,
      projectionJson,
      projectionSha256
    ]);
  }
  const commitId = hashId("projection_commit", { projectionId, outboxId: outbox.outbox_id, projectionSha256 });
  const commitBody = {
    commitId,
    projectionId,
    outboxId: outbox.outbox_id,
    status: "committed",
    projectionSha256,
    committedSequence: Number(outbox.source_record_sequence),
    committedAt: outbox.authoritative_record_time,
    projectionCommitMarkerWrittenLast: true
  };
  const registeredCommit = repositoryOne(repository, "SELECT * FROM artifact_registry WHERE artifact_id = ?", [commitId]);
  if (!registeredCommit) {
    registerArtifact(repository, {
      artifactId: commitId,
      artifactKind: "projection_commit_marker",
      opportunityId: outbox.opportunity_id,
      recordSequence: Number(outbox.source_record_sequence),
      registeredAt: outbox.authoritative_record_time
    });
  } else if (registeredCommit.artifact_kind !== "projection_commit_marker") {
    fail("route_iq_coordinator_cross_kind_artifact_collision", "Projection commit ID is already registered to another kind.", {}, 500);
  }
  repositoryRows(repository, `
    INSERT INTO projection_commits (
      commit_id, projection_id, outbox_id, status, projection_sha256,
      committed_sequence, committed_at, commit_sha256
    ) VALUES (?, ?, ?, 'committed', ?, ?, ?, ?)
  `, [
    commitId,
    projectionId,
    outbox.outbox_id,
    projectionSha256,
    Number(outbox.source_record_sequence),
    outbox.authoritative_record_time,
    sha256(commitBody)
  ]);
  return deepFreeze({
    ok: true,
    status: "committed",
    recovered: true,
    recoveredPartial,
    record: { projection: clone(projection), commit: { ...commitBody, commitSha256: sha256(commitBody) } }
  });
}

function readCommittedProjection(repository, scope, coordinatorId, claims) {
  const identities = identitiesForClaims(coordinatorId, {
    ...claims,
    purpose: "projection_read",
    canonicalEventBoundarySha256: claims.triggerRecordSha256
  });
  const opportunity = getOpportunity(repository, identities.opportunityId);
  if (!opportunity
    || opportunity.trigger_record_sha256 !== claims.triggerRecordSha256
    || opportunity.territory_id !== claims.territoryId) {
    fail("route_iq_coordinator_projection_opportunity_mismatch", "Projection read attestation does not resolve to the canonical opportunity.", {}, 403);
  }
  const pendingOutbox = repositoryOne(repository, `
    SELECT o.outbox_id, o.source_record_sequence, o.authoritative_record_time
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE o.opportunity_id = ?
      AND c.outbox_id IS NULL
      AND o.source_record_sequence <= ?
      AND o.authoritative_record_time <= ?
    ORDER BY o.source_record_sequence ASC, o.outbox_id ASC
    LIMIT 1
  `, [identities.opportunityId, claims.asOfRecordSequence, claims.asOfRecordTime]);
  if (pendingOutbox) {
    fail("route_iq_coordinator_projection_recovery_pending", "Projection recovery must commit all in-scope canonical history before readback.", {
      outboxId: pendingOutbox.outbox_id,
      sourceRecordSequence: Number(pendingOutbox.source_record_sequence)
    }, 409);
  }
  const row = repositoryOne(repository, `
    SELECT p.*, c.commit_id, c.projection_id AS commit_projection_id,
      c.outbox_id AS commit_outbox_id, c.status,
      c.projection_sha256 AS commit_projection_sha256,
      c.committed_sequence, c.committed_at, c.commit_sha256,
      projection_registry.artifact_kind AS projection_registry_kind,
      commit_registry.artifact_kind AS commit_registry_kind
    FROM projection_artifacts p
    JOIN projection_commits c ON c.projection_id = p.projection_id
    JOIN artifact_registry projection_registry ON projection_registry.artifact_id = p.projection_id
    JOIN artifact_registry commit_registry ON commit_registry.artifact_id = c.commit_id
    WHERE p.opportunity_id = ? AND p.as_of_record_sequence <= ? AND p.as_of_record_time <= ?
    ORDER BY p.as_of_record_sequence DESC, p.projection_id DESC
    LIMIT 1
  `, [identities.opportunityId, claims.asOfRecordSequence, claims.asOfRecordTime]);
  if (!row) return deepFreeze({ ok: true, found: false, record: null });
  const projection = verifyProjectionRow(row);
  if (projection.coordinatorId !== coordinatorId || !sameScope(projection.scope, scope)) {
    fail("route_iq_coordinator_projection_scope_mismatch", "Committed projection has cross-coordinator contamination.", {}, 500);
  }
  const commitBody = commitBodyFromRow(row);
  if (row.status !== "committed"
    || row.commit_projection_id !== row.projection_id
    || row.commit_outbox_id !== row.outbox_id
    || row.commit_projection_sha256 !== row.projection_sha256
    || row.projection_registry_kind !== "coordinator_projection"
    || row.commit_registry_kind !== "projection_commit_marker"
    || sha256(commitBody) !== row.commit_sha256) {
    fail("route_iq_coordinator_projection_commit_invalid", "Projection commit marker failed canonical verification.", {}, 500);
  }
  return deepFreeze({
    ok: true,
    found: true,
    record: {
      schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
      authority: "sqlite_durable_object_coordinator",
      projection: clone(projection),
      commit: { ...commitBody, commitSha256: row.commit_sha256 }
    }
  });
}

export async function openRouteIqProspectiveCoordinator(input = {}) {
  assertExactKeys(input, ["repository", "authorityVerifier", "scopeEnvelope"], "openCoordinatorRequest");
  const repository = validateRepository(input.repository);
  const scopeAuthority = await verifyEnvelope(input.authorityVerifier, input.scopeEnvelope, { purpose: "coordinator_scope" });
  const scope = normalizeScopeClaims(scopeAuthority.claims);
  const coordinatorId = coordinatorIdentity(scope);
  repository.transactionSync(() => {
    const existing = readCoordinatorMeta(repository);
    if (!existing) {
      repositoryRows(repository, `
        INSERT INTO coordinator_meta (
          singleton, schema_version, coordinator_id, workspace_id, operating_profile_id,
          representative_id, registry_version, created_at, next_record_sequence
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        routeIqProspectiveCoordinatorSchemaVersion,
        coordinatorId,
        scope.workspaceId,
        scope.operatingProfileId,
        scope.representativeId,
        scope.registryVersion,
        scope.issuedAt
      ]);
      return;
    }
    if (existing.schema_version !== routeIqProspectiveCoordinatorSchemaVersion
      || existing.coordinator_id !== coordinatorId
      || existing.workspace_id !== scope.workspaceId
      || existing.operating_profile_id !== scope.operatingProfileId
      || existing.representative_id !== scope.representativeId) {
      fail("route_iq_coordinator_route_scope_mismatch", "Authenticated scope does not own this coordinator database.", {}, 403);
    }
  });
  return new RouteIqProspectiveCoordinatorCore({
    repository,
    authorityVerifier: input.authorityVerifier,
    scope,
    coordinatorId
  });
}
