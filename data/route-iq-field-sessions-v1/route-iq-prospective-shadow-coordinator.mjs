import { createHash } from "node:crypto";

import {
  FieldSessionArchiveError,
  routeIqFieldSessionOutcomeProjectionVersion,
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
export const routeIqProspectiveServerAllocatorContractVersion = "route-iq-prospective-server-allocator-v1";
export const routeIqProspectiveRuntimeContextContractVersion = "route-iq-prospective-runtime-context-v1";
export const routeIqFieldSessionOutcomeProjectionContractVersion = "route-iq-field-session-outcome-projection-v1";
export const routeIqCommittedOutcomeProjectionReadContractVersion = "route-iq-committed-outcome-projection-read-v1";
export const routeIqEvaluationContextSchemaVersion = "route-iq-immutable-evaluation-context-v1";
export const routeIqIntelligenceEvaluationRecordSchemaVersion = "route-iq-admitted-shadow-evaluation-record-v1";
export const routeIqIntelligenceEvaluationContractVersion = "route-iq-admitted-shadow-evaluation-v1";
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
  field_outcome: /^riq_field_outcome_[a-f0-9]{64}$/,
  reconciliation: /^riq_reconciliation_[a-f0-9]{64}$/,
  reconciliation_conflict: /^riq_reconciliation_conflict_[a-f0-9]{64}$/,
  evaluation_context: /^riq_evaluation_context_[a-f0-9]{64}$/,
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
  UNIQUE (session_id, canonical_session_record_sha256),
  UNIQUE (coordinator_id, canonical_session_record_sha256, session_event_sequence)
);

CREATE TABLE IF NOT EXISTS canonical_session_events (
  event_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  session_id TEXT NOT NULL REFERENCES canonical_sessions(session_id),
  event_kind TEXT NOT NULL CHECK (event_kind IN ('OPENED','CLOSED')),
  request_sha256 TEXT NOT NULL,
  record_sequence INTEGER NOT NULL UNIQUE,
  authoritative_record_time TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL,
  receipt_json TEXT,
  receipt_sha256 TEXT,
  UNIQUE (session_id, event_kind),
  UNIQUE (event_kind, request_sha256)
);

CREATE TABLE IF NOT EXISTS canonical_session_contexts (
  session_id TEXT PRIMARY KEY REFERENCES canonical_sessions(session_id),
  territory_status TEXT NOT NULL CHECK (territory_status IN ('known','unknown','legacy_unavailable')),
  territory_id TEXT NOT NULL,
  territory_source_record_sha256 TEXT,
  territory_source_contract_version TEXT,
  territory_source_available_at TEXT,
  canonical_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  opportunity_id TEXT PRIMARY KEY,
  coordinator_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  canonical_session_record_sha256 TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  opportunity_type TEXT NOT NULL CHECK (opportunity_type = 'next_stop'),
  opportunity_event_sequence INTEGER NOT NULL CHECK (opportunity_event_sequence >= 0),
  trigger_record_sha256 TEXT NOT NULL,
  trigger_boundary_sha256 TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('TRIGGERED','EXCLUDED','SNAPSHOT_PENDING_SEAL','SNAPSHOT_SEALED','SHADOW_DECISION_SEALED','ACTION_LINKED','OUTCOME_LINKED','EVALUATED')),
  canonical_eligible INTEGER NOT NULL CHECK (canonical_eligible IN (0,1)),
  current_manifest_sha256 TEXT,
  last_record_sequence INTEGER NOT NULL,
  last_record_time TEXT,
  FOREIGN KEY (session_id, canonical_session_record_sha256)
    REFERENCES canonical_sessions(session_id, canonical_session_record_sha256),
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

CREATE TABLE IF NOT EXISTS field_session_outcome_links (
  link_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(opportunity_id),
  action_artifact_id TEXT NOT NULL UNIQUE REFERENCES lifecycle_events(artifact_id),
  candidate_id TEXT NOT NULL,
  source_projection_sha256 TEXT NOT NULL,
  source_archive_raw_sha256 TEXT NOT NULL,
  source_archive_session_sha256 TEXT NOT NULL,
  source_visit_record_sha256 TEXT NOT NULL UNIQUE,
  visit_event_time TEXT NOT NULL,
  archive_committed_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL UNIQUE,
  linked_sequence INTEGER NOT NULL UNIQUE,
  linked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_session_evaluation_contexts (
  context_id TEXT PRIMARY KEY REFERENCES artifact_registry(artifact_id),
  link_id TEXT NOT NULL UNIQUE REFERENCES field_session_outcome_links(link_id),
  opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(opportunity_id),
  source_outcome_evidence_sha256 TEXT NOT NULL UNIQUE,
  context_json TEXT NOT NULL,
  context_sha256 TEXT NOT NULL UNIQUE,
  created_sequence INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_session_reconciliation_receipts (
  reconciliation_id TEXT PRIMARY KEY,
  source_projection_sha256 TEXT NOT NULL UNIQUE,
  source_archive_raw_sha256 TEXT NOT NULL UNIQUE,
  source_archive_session_sha256 TEXT NOT NULL UNIQUE,
  receipt_json TEXT NOT NULL,
  receipt_sha256 TEXT NOT NULL,
  created_sequence INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_session_reconciliation_conflicts (
  conflict_id TEXT PRIMARY KEY,
  source_archive_raw_sha256 TEXT NOT NULL,
  original_projection_sha256 TEXT NOT NULL,
  competing_projection_sha256 TEXT NOT NULL,
  offending_digest TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL,
  created_sequence INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (source_archive_raw_sha256, competing_projection_sha256)
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
  OR NEW.canonical_session_record_sha256 IS NOT OLD.canonical_session_record_sha256
  OR NEW.territory_id IS NOT OLD.territory_id
  OR NEW.opportunity_type IS NOT OLD.opportunity_type
  OR NEW.opportunity_event_sequence IS NOT OLD.opportunity_event_sequence
  OR NEW.trigger_record_sha256 IS NOT OLD.trigger_record_sha256
  OR NEW.trigger_boundary_sha256 IS NOT OLD.trigger_boundary_sha256
  OR (OLD.current_manifest_sha256 IS NOT NULL AND NEW.current_manifest_sha256 IS NOT OLD.current_manifest_sha256)
  OR NEW.last_record_sequence <= OLD.last_record_sequence
  OR (NEW.last_record_sequence > 0 AND NEW.last_record_time IS NULL)
  OR (OLD.last_record_sequence > 0 AND NEW.last_record_time <= OLD.last_record_time)
  OR NEW.canonical_eligible > OLD.canonical_eligible
  OR (NEW.state = 'EXCLUDED' AND NEW.canonical_eligible != 0)
  OR (NEW.state != 'EXCLUDED' AND NEW.canonical_eligible != 1)
  OR NOT (
    (OLD.state = 'TRIGGERED' AND NEW.state IN ('TRIGGERED','SNAPSHOT_PENDING_SEAL','EXCLUDED'))
    OR (OLD.state = 'SNAPSHOT_PENDING_SEAL' AND NEW.state IN ('SNAPSHOT_SEALED','EXCLUDED'))
    OR (OLD.state = 'SNAPSHOT_SEALED' AND NEW.state IN ('SHADOW_DECISION_SEALED','EXCLUDED'))
    OR (OLD.state = 'SHADOW_DECISION_SEALED' AND NEW.state IN ('ACTION_LINKED','EXCLUDED'))
    OR (OLD.state = 'ACTION_LINKED' AND NEW.state IN ('ACTION_LINKED','OUTCOME_LINKED','EXCLUDED'))
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
CREATE TRIGGER IF NOT EXISTS canonical_session_events_no_update
BEFORE UPDATE ON canonical_session_events BEGIN SELECT RAISE(ABORT, 'canonical_session_events_append_only'); END;
CREATE TRIGGER IF NOT EXISTS canonical_session_events_no_delete
BEFORE DELETE ON canonical_session_events BEGIN SELECT RAISE(ABORT, 'canonical_session_events_append_only'); END;
CREATE TRIGGER IF NOT EXISTS canonical_session_contexts_no_update
BEFORE UPDATE ON canonical_session_contexts BEGIN SELECT RAISE(ABORT, 'canonical_session_contexts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS canonical_session_contexts_no_delete
BEFORE DELETE ON canonical_session_contexts BEGIN SELECT RAISE(ABORT, 'canonical_session_contexts_append_only'); END;
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
CREATE TRIGGER IF NOT EXISTS field_session_outcome_links_no_update
BEFORE UPDATE ON field_session_outcome_links BEGIN SELECT RAISE(ABORT, 'field_session_outcome_links_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_outcome_links_no_delete
BEFORE DELETE ON field_session_outcome_links BEGIN SELECT RAISE(ABORT, 'field_session_outcome_links_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_evaluation_contexts_no_update
BEFORE UPDATE ON field_session_evaluation_contexts BEGIN SELECT RAISE(ABORT, 'field_session_evaluation_contexts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_evaluation_contexts_no_delete
BEFORE DELETE ON field_session_evaluation_contexts BEGIN SELECT RAISE(ABORT, 'field_session_evaluation_contexts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_reconciliation_receipts_no_update
BEFORE UPDATE ON field_session_reconciliation_receipts BEGIN SELECT RAISE(ABORT, 'field_session_reconciliation_receipts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_reconciliation_receipts_no_delete
BEFORE DELETE ON field_session_reconciliation_receipts BEGIN SELECT RAISE(ABORT, 'field_session_reconciliation_receipts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_reconciliation_conflicts_no_update
BEFORE UPDATE ON field_session_reconciliation_conflicts BEGIN SELECT RAISE(ABORT, 'field_session_reconciliation_conflicts_append_only'); END;
CREATE TRIGGER IF NOT EXISTS field_session_reconciliation_conflicts_no_delete
BEFORE DELETE ON field_session_reconciliation_conflicts BEGIN SELECT RAISE(ABORT, 'field_session_reconciliation_conflicts_append_only'); END;
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
    territory: "riq_territory",
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
    projection_commit: "riq_projection_commit",
    field_outcome: "riq_field_outcome",
    reconciliation: "riq_reconciliation",
    reconciliation_conflict: "riq_reconciliation_conflict",
    evaluation_context: "riq_evaluation_context"
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
    "purpose", "workspaceId", "operatingProfileId", "representativeId", "registryVersion", "issuedAt",
    "territoryContext"
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
  let territoryContext;
  if (claims.territoryContext === undefined || claims.territoryContext === null) {
    territoryContext = {
      status: "unknown",
      territoryId: null,
      sourceRecordSha256: null,
      sourceContractVersion: null,
      availableAt: null
    };
  } else {
    assertExactKeys(claims.territoryContext, [
      "status", "territoryId", "sourceRecordSha256", "sourceContractVersion", "availableAt"
    ], "verifiedScopeClaims.territoryContext");
    if (claims.territoryContext.status !== "known") {
      fail("route_iq_coordinator_territory_context_invalid", "A supplied territory context must be canonically known.", {
        paths: ["verifiedScopeClaims.territoryContext.status"]
      }, 403);
    }
    territoryContext = {
      status: "known",
      territoryId: requireHashId(claims.territoryContext.territoryId, "territory", "verifiedScopeClaims.territoryContext.territoryId"),
      sourceRecordSha256: requireSha(claims.territoryContext.sourceRecordSha256, "verifiedScopeClaims.territoryContext.sourceRecordSha256"),
      sourceContractVersion: requireVersion(claims.territoryContext.sourceContractVersion, "verifiedScopeClaims.territoryContext.sourceContractVersion"),
      availableAt: canonicalTimestamp(claims.territoryContext.availableAt, "verifiedScopeClaims.territoryContext.availableAt").iso
    };
    if (Date.parse(territoryContext.availableAt) >= Date.parse(issuedAt)) {
      fail("route_iq_coordinator_territory_context_future", "Territory context must be available before the authenticated coordinator scope is issued.", {
        paths: ["verifiedScopeClaims.territoryContext.availableAt"]
      }, 403);
    }
  }
  assertNoPiiLikeStrings(territoryContext, "verifiedScopeClaims.territoryContext");
  return {
    workspaceId: claims.workspaceId,
    operatingProfileId: claims.operatingProfileId,
    representativeId: claims.representativeId,
    registryVersion,
    issuedAt,
    territoryContext
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

function canonicalEvaluationScope(scope) {
  return {
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId
  };
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
    || row.canonical_session_record_sha256 !== claims.canonicalSessionRecordSha256
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
    FIELD_SESSION_OUTCOME_EVIDENCE_LINKED: "field_outcome",
    FIELD_SESSION_OUTCOME_CORRECTION_LINKED: "correction",
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
  if (!opportunity
    || opportunity.opportunity_id !== originalReceiptRow.opportunity_id
    || opportunity.session_id !== identities.sessionId) {
    fail("route_iq_coordinator_operation_key_collision", "Conflict boundary does not resolve to the original canonical opportunity.", {}, 500);
  }
  const conflictRecordTime = deriveConflictRecordTime(opportunity, claims.authoritativeRecordTime);
  const event = appendLifecycleEvent(repository, {
    coordinatorId: opportunity.coordinator_id,
    sessionId: opportunity.session_id,
    opportunityId: opportunity.opportunity_id,
    operationKey: identities.operationKey,
    requestSha256,
    logicalBoundarySha256: claims.canonicalEventBoundarySha256,
    authoritativeRecordTime: conflictRecordTime.authoritativeRecordTime,
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
      incomingAuthoritativeRecordTime: claims.authoritativeRecordTime,
      governanceRecordTimeDerivation: conflictRecordTime.derivation,
      governanceRecordTimeOffsetMilliseconds: conflictRecordTime.offsetMilliseconds,
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
  assertMonotonicRecordTime(opportunity, claims);
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

function originReason(opportunity, claims) {
  if (opportunity.trigger_record_sha256 !== claims.triggerRecordSha256) return "trigger_context_changed";
  if (claims.recordOrigin !== "prospective") return "noncanonical_record_origin";
  if (claims.uncertainChronology) return "uncertain_chronology";
  return null;
}

function assertMonotonicRecordTime(opportunity, claims) {
  if (!opportunity) {
    fail("route_iq_coordinator_opportunity_identity_mismatch", "Verified claims do not resolve to the canonical opportunity.", {}, 409);
  }
  if (Number(opportunity.last_record_sequence) === 0) return;
  if (typeof opportunity.last_record_time !== "string"
    || Date.parse(claims.authoritativeRecordTime) <= Date.parse(opportunity.last_record_time)) {
    fail("route_iq_coordinator_chronology_not_monotonic", "A new canonical record must be strictly later than the opportunity's prior authoritative record time.", {
      priorRecordSequence: Number(opportunity.last_record_sequence),
      priorRecordTime: opportunity.last_record_time
    }, 409);
  }
}

function deriveConflictRecordTime(opportunity, incomingAuthoritativeRecordTime) {
  if (!opportunity || Number(opportunity.last_record_sequence) === 0) {
    fail("route_iq_coordinator_conflict_boundary_invalid", "A conflict requires an existing canonical operation boundary.", {}, 500);
  }
  const prior = canonicalTimestamp(opportunity.last_record_time, "opportunity.lastRecordTime");
  const incoming = canonicalTimestamp(incomingAuthoritativeRecordTime, "verifiedClaims.conflict.incomingAuthoritativeRecordTime");
  if (incoming.time > prior.time) {
    return {
      authoritativeRecordTime: incoming.iso,
      derivation: "infrastructure_attested_later_time",
      offsetMilliseconds: incoming.time - prior.time
    };
  }
  const nextTime = prior.time + 1;
  let nextIso;
  try {
    nextIso = new Date(nextTime).toISOString();
  } catch {
    fail("route_iq_coordinator_conflict_time_exhausted", "The coordinator cannot derive a bounded monotonic conflict record time.", {
      priorRecordTime: prior.iso
    }, 500);
  }
  if (!Number.isSafeInteger(nextTime) || Date.parse(nextIso) !== nextTime || nextTime - prior.time !== 1) {
    fail("route_iq_coordinator_conflict_time_exhausted", "The coordinator cannot derive a bounded monotonic conflict record time.", {
      priorRecordTime: prior.iso
    }, 500);
  }
  return {
    authoritativeRecordTime: nextIso,
    derivation: "coordinator_prior_plus_one_millisecond",
    offsetMilliseconds: 1
  };
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
  const logicalClaims = clone(claims);
  delete logicalClaims.authoritativeRecordTime;
  const logicalExtra = clone(extra);
  if (logicalExtra.sealClaims) delete logicalExtra.sealClaims.sealedAt;
  return {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    verifiedClaims: logicalClaims,
    authority: {
      verificationType: authority.verificationType,
      keyId: authority.keyId,
      algorithm: authority.algorithm
    },
    authoritativeRecordTimeExcludedFromLogicalDigest: true,
    ...logicalExtra
  };
}

function normalizeInformationalBrowserEvent(event) {
  assertExactKeys(event, ["eventKind", "informationalSequence", "informationalObservedAt"], "informationalBrowserEvent");
  if (event.eventKind !== "next_stop_requested") {
    fail("route_iq_server_allocator_event_not_supported", "Only the existing next_stop request seam may allocate an opportunity.", {
      paths: ["informationalBrowserEvent.eventKind"]
    }, 409);
  }
  const informationalSequence = event.informationalSequence === undefined
    ? null
    : requireSequence(event.informationalSequence, "informationalBrowserEvent.informationalSequence");
  const informationalObservedAt = event.informationalObservedAt === undefined
    ? null
    : canonicalTimestamp(event.informationalObservedAt, "informationalBrowserEvent.informationalObservedAt").iso;
  assertNoPiiLikeStrings({ eventKind: event.eventKind, informationalSequence, informationalObservedAt }, "informationalBrowserEvent");
  return deepFreeze({
    eventKind: "next_stop_requested",
    informationalSequence,
    informationalObservedAt
  });
}

function normalizeSessionCloseClaims(claims, scope) {
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId",
    "closeReason", "handoffContractVersion", "endOfDayHandoffSha256", "authoritativeRecordTime"
  ], "verifiedSessionCloseClaims");
  if (claims.purpose !== "close_session" || !sameScope(claims, scope)) {
    fail("route_iq_server_allocator_close_scope_invalid", "Session close claims do not match the coordinator.", {}, 403);
  }
  if (!["end_route", "end_day"].includes(claims.closeReason)) {
    fail("route_iq_server_allocator_close_reason_invalid", "Session close reason is not governed.", {
      paths: ["verifiedSessionCloseClaims.closeReason"]
    });
  }
  if (claims.handoffContractVersion !== "route-iq-end-of-day-data-handoff-v1") {
    fail("route_iq_server_allocator_handoff_contract_invalid", "Session close must bind the canonical End Route/End Day handoff contract.", {
      paths: ["verifiedSessionCloseClaims.handoffContractVersion"]
    }, 403);
  }
  requireSha(claims.endOfDayHandoffSha256, "verifiedSessionCloseClaims.endOfDayHandoffSha256");
  canonicalTimestamp(claims.authoritativeRecordTime, "verifiedSessionCloseClaims.authoritativeRecordTime");
  assertNoPiiLikeStrings(claims, "verifiedSessionCloseClaims");
  return deepFreeze(clone(claims));
}

function normalizeScopeOnlyRuntimeClaims(claims, scope, purpose, extraKeys = []) {
  assertExactKeys(claims, [
    "purpose", "workspaceId", "operatingProfileId", "representativeId",
    "authoritativeRecordTime", ...extraKeys
  ], `verifiedRuntimeClaims.${purpose}`);
  if (claims.purpose !== purpose || !sameScope(claims, scope)) {
    fail("route_iq_runtime_scope_invalid", "Runtime claims do not match the authenticated coordinator scope.", {}, 403);
  }
  canonicalTimestamp(claims.authoritativeRecordTime, `verifiedRuntimeClaims.${purpose}.authoritativeRecordTime`);
  assertNoPiiLikeStrings(claims, `verifiedRuntimeClaims.${purpose}`);
  return deepFreeze(clone(claims));
}

function canonicalRuntimeContext(repository, scope, coordinatorId) {
  const session = activeCanonicalSession(repository);
  if (!session) {
    fail("route_iq_runtime_active_session_missing", "No active canonical field session is available.", {}, 409);
  }
  const opportunity = currentAllocatedOpportunity(repository, session.session_id);
  if (!opportunity) {
    fail("route_iq_runtime_active_opportunity_missing", "No canonical next-stop opportunity is available.", {}, 409);
  }
  const sessionContext = readCanonicalSessionContext(repository, session.session_id);
  if (!sessionContext) {
    fail("route_iq_runtime_session_context_missing", "Canonical session context is unavailable.", {}, 409);
  }
  const actionRows = repositoryRows(repository, `
    SELECT canonical_json, record_sha256
    FROM lifecycle_events
    WHERE session_id = ? AND event_kind = 'ACTION_LINKED'
    ORDER BY record_sequence, artifact_id
  `, [session.session_id]);
  const completedCandidateIds = [];
  const completed = new Set();
  for (const row of actionRows) {
    const action = parseCanonicalJson(row.canonical_json, row.record_sha256, "canonical action history");
    const candidateId = requireHashId(action.payload?.selectedCandidateId, "candidate", "canonicalAction.selectedCandidateId");
    if (!completed.has(candidateId)) {
      completed.add(candidateId);
      completedCandidateIds.push(candidateId);
    }
  }
  const body = {
    runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
    authority: "sqlite_durable_object_coordinator",
    coordinatorId,
    scope: {
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      representativeId: scope.representativeId
    },
    opportunityId: opportunity.opportunity_id,
    opportunityType: "next_stop",
    state: opportunity.state,
    canonicalContext: {
      territoryId: opportunity.territory_id,
      canonicalSessionRecordSha256: opportunity.canonical_session_record_sha256,
      sessionEventSequence: Number(session.session_event_sequence),
      opportunityEventSequence: Number(opportunity.opportunity_event_sequence),
      triggerRecordSha256: opportunity.trigger_record_sha256,
      canonicalEventBoundarySha256: opportunity.trigger_boundary_sha256
    },
    completedCandidateIds,
    territorySource: {
      status: sessionContext.territoryStatus,
      sourceRecordSha256: sessionContext.territorySourceRecordSha256,
      sourceContractVersion: sessionContext.territorySourceContractVersion,
      availableAt: sessionContext.territorySourceAvailableAt
    },
    candidateCompletenessStatus: opportunity.current_manifest_sha256
      ? "authenticated_intelligence_manifest_present"
      : "pending_authenticated_intelligence_manifest",
    recommendationInfluence: "off",
    collectionDefault: "off"
  };
  return deepFreeze({
    ...body,
    runtimeContextReceiptSha256: sha256(body)
  });
}

function internalOperationClaims({ scope, session, opportunity, purpose, authoritativeRecordTime, boundary, content }) {
  return {
    purpose,
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    territoryId: opportunity.territory_id,
    canonicalSessionRecordSha256: opportunity.canonical_session_record_sha256,
    sessionEventSequence: Number(session.session_event_sequence),
    opportunityEventSequence: Number(opportunity.opportunity_event_sequence),
    triggerRecordSha256: opportunity.trigger_record_sha256,
    canonicalEventBoundarySha256: sha256(boundary),
    clientEventSequence: 0,
    clientContentSha256: sha256(content),
    authoritativeRecordTime,
    recordOrigin: "prospective",
    uncertainChronology: false
  };
}

function normalizeFieldSessionOutcomeProjection(value, scope) {
  assertExactKeys(value, [
    "schemaVersion", "authority", "recordOrigin", "scope", "sourceArchive", "outcomes",
    "privacy", "recommendationInfluence", "scoreableOutcomeDerivedByData", "projectionSha256"
  ], "fieldSessionOutcomeProjection");
  if (value.schemaVersion !== routeIqFieldSessionOutcomeProjectionVersion
    || value.authority !== "prometheus_data_committed_field_session"
    || value.recordOrigin !== "prospective"
    || value.recommendationInfluence !== "off"
    || value.scoreableOutcomeDerivedByData !== false) {
    fail("route_iq_field_outcome_projection_not_canonical", "Field-session outcome projection is not canonical.", {}, 409);
  }
  assertExactKeys(value.scope, ["workspaceId", "operatingProfileId", "representativeId"], "fieldSessionOutcomeProjection.scope");
  if (!sameScope(value.scope, scope)) fail("route_iq_field_outcome_projection_cross_scope", "Field-session projection crosses coordinator scope.", {}, 403);
  assertExactKeys(value.sourceArchive, [
    "handoffContractId", "sourceArchiveSessionSha256", "rawSha256", "normalizedSha256", "archiveCommittedAt"
  ], "fieldSessionOutcomeProjection.sourceArchive");
  if (value.sourceArchive.handoffContractId !== "route-iq-end-of-day-data-handoff-v1") {
    fail("route_iq_field_outcome_projection_handoff_invalid", "Field-session projection does not bind the canonical handoff.");
  }
  for (const field of ["sourceArchiveSessionSha256", "rawSha256", "normalizedSha256"]) {
    requireSha(value.sourceArchive[field], `fieldSessionOutcomeProjection.sourceArchive.${field}`);
  }
  canonicalTimestamp(value.sourceArchive.archiveCommittedAt, "fieldSessionOutcomeProjection.sourceArchive.archiveCommittedAt");
  assertExactKeys(value.privacy, ["namesIncluded", "addressesIncluded", "contactsIncluded", "notesIncluded", "preciseLocationIncluded"], "fieldSessionOutcomeProjection.privacy");
  if (Object.values(value.privacy).some(flag => flag !== false)) {
    fail("route_iq_field_outcome_projection_privacy_invalid", "Field-session projection may not contain PII or precise location.");
  }
  if (!Array.isArray(value.outcomes)) fail("route_iq_field_outcome_projection_records_invalid", "Field-session outcomes must be an array.");
  const sourceVisitIds = new Set();
  const normalizedOutcomes = value.outcomes.map((outcome, index) => {
    const path = `fieldSessionOutcomeProjection.outcomes[${index}]`;
    assertExactKeys(outcome, [
      "sourceVisitRecordSha256", "candidateId", "candidateIdentityStatus", "actionEventTime",
      "eventTimeAuthority", "authoritativeRecordTime", "outcomeEvidence", "decisionSource",
      "recommendationDecisionContext", "evidenceSha256"
    ], path);
    requireSha(outcome.sourceVisitRecordSha256, `${path}.sourceVisitRecordSha256`);
    requireSha(outcome.evidenceSha256, `${path}.evidenceSha256`);
    if (sourceVisitIds.has(outcome.sourceVisitRecordSha256)) fail("route_iq_field_outcome_projection_duplicate_visit", "Field-session projection contains a duplicate visit.");
    sourceVisitIds.add(outcome.sourceVisitRecordSha256);
    if (outcome.candidateId !== null) requireHashId(outcome.candidateId, "candidate", `${path}.candidateId`);
    if (!["derived_from_exact_governed_google_place_identity", "unavailable"].includes(outcome.candidateIdentityStatus)
      || (outcome.candidateId === null) !== (outcome.candidateIdentityStatus === "unavailable")) {
      fail("route_iq_field_outcome_projection_candidate_invalid", "Field-session candidate identity status is inconsistent.");
    }
    const actionTime = canonicalTimestamp(outcome.actionEventTime, `${path}.actionEventTime`);
    const recordTime = canonicalTimestamp(outcome.authoritativeRecordTime, `${path}.authoritativeRecordTime`);
    if (outcome.eventTimeAuthority !== "dashboard_recorded_visit_time_in_committed_handoff"
      || recordTime.time !== Date.parse(value.sourceArchive.archiveCommittedAt)
      || actionTime.time >= recordTime.time) {
      fail("route_iq_field_outcome_projection_chronology_invalid", "Field-session action and archive times are invalid.");
    }
    assertExactKeys(outcome.outcomeEvidence, [
      "status", "originalOutcomeSignal", "finalOutcomeSignal", "corrections", "correctionState",
      "conflictState", "scoreableOutcome", "scoreableOutcomeDerivedByData"
    ], `${path}.outcomeEvidence`);
    if (outcome.outcomeEvidence.status !== "verified_unscored_signals"
      || outcome.outcomeEvidence.scoreableOutcome !== null
      || outcome.outcomeEvidence.scoreableOutcomeDerivedByData !== false
      || outcome.outcomeEvidence.conflictState !== "none"
      || !["corrected", "uncorrected"].includes(outcome.outcomeEvidence.correctionState)
      || !Array.isArray(outcome.outcomeEvidence.corrections)) {
      fail("route_iq_field_outcome_projection_evidence_invalid", "Field-session outcome signals are not governed.");
    }
    let priorCorrectionTime = actionTime.time;
    outcome.outcomeEvidence.corrections.forEach((correction, correctionIndex) => {
      assertExactKeys(correction, [
        "sourceCorrectionRecordSha256", "sequence", "correctedAt", "previousOutcomeSignal",
        "finalOutcomeSignal", "changedSignalFields", "appendOnly"
      ], `${path}.outcomeEvidence.corrections[${correctionIndex}]`);
      requireSha(correction.sourceCorrectionRecordSha256, `${path}.outcomeEvidence.corrections[${correctionIndex}].sourceCorrectionRecordSha256`);
      const correctedAt = canonicalTimestamp(correction.correctedAt, `${path}.outcomeEvidence.corrections[${correctionIndex}].correctedAt`);
      if (correction.sequence !== correctionIndex + 1 || correctedAt.time <= priorCorrectionTime || correctedAt.time >= recordTime.time || correction.appendOnly !== true) {
        fail("route_iq_field_outcome_projection_correction_invalid", "Field-session correction chronology or sequence is invalid.");
      }
      priorCorrectionTime = correctedAt.time;
    });
    const evidenceBody = Object.fromEntries(Object.entries(outcome).filter(([key]) => key !== "evidenceSha256"));
    if (sha256(evidenceBody) !== outcome.evidenceSha256) {
      fail("route_iq_field_outcome_projection_evidence_hash_invalid", "Field-session outcome evidence hash is invalid.");
    }
    return clone(outcome);
  });
  const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "projectionSha256"));
  requireSha(value.projectionSha256, "fieldSessionOutcomeProjection.projectionSha256");
  if (sha256(body) !== value.projectionSha256) {
    fail("route_iq_field_outcome_projection_hash_invalid", "Field-session outcome projection hash is invalid.");
  }
  return deepFreeze({ ...clone(value), outcomes: normalizedOutcomes });
}

function parseReconciliationReceipt(row) {
  if (!row) return null;
  return deepFreeze(parseCanonicalJson(row.receipt_json, row.receipt_sha256, "field-session reconciliation receipt"));
}

function deriveImmutableEvaluationContext(repository, { opportunity, manifestRow, action, outcome }) {
  if (!manifestRow) {
    fail("route_iq_evaluation_context_manifest_missing", "Evaluation context requires the accepted canonical candidate manifest.", {}, 409);
  }
  const snapshot = eventFromRow(repositoryOne(repository, `
    SELECT * FROM lifecycle_events
    WHERE artifact_id = ? AND opportunity_id = ? AND event_kind = 'SNAPSHOT_PENDING_SEAL'
  `, [manifestRow.snapshot_artifact_id, opportunity.opportunity_id]));
  const snapshotSeal = latestEvent(repository, opportunity.opportunity_id, "SNAPSHOT_SEALED");
  const shadowSeal = latestEvent(repository, opportunity.opportunity_id, "SHADOW_DECISION_SEALED");
  if (!snapshot || !snapshotSeal || !shadowSeal || !action) {
    fail("route_iq_evaluation_context_lifecycle_incomplete", "Evaluation context requires the complete sealed pre-action lifecycle.", {}, 409);
  }
  const manifest = parseCanonicalJson(manifestRow.manifest_json, manifestRow.manifest_record_sha256, "candidate manifest");
  const accepted = manifest.candidates.filter(candidate => candidate.candidateId === outcome.candidateId);
  if (accepted.length !== 1) {
    fail("route_iq_evaluation_context_candidate_ambiguous", "Outcome candidate must bind exactly one accepted manifest candidate.", {}, 409);
  }
  const candidate = accepted[0];
  if (candidate.rankingContext?.ordinal !== 1
    || action.canonical.payload?.selectedCandidateId !== candidate.candidateId
    || action.canonical.payload?.selectionAuthority !== "accepted_manifest_unique_ordinal_1"
    || snapshotSeal.canonical.payload?.sealedArtifactId !== snapshot.artifactId
    || snapshotSeal.canonical.payload?.sealedRecordSha256 !== snapshot.recordSha256
    || shadowSeal.canonical.payload?.sealedArtifactId !== snapshotSeal.artifactId
    || shadowSeal.canonical.payload?.sealedRecordSha256 !== snapshotSeal.recordSha256
    || snapshotSeal.canonical.payload?.candidateManifestSha256 !== manifest.candidateManifestSha256
    || shadowSeal.canonical.payload?.candidateManifestSha256 !== manifest.candidateManifestSha256) {
    fail("route_iq_evaluation_context_binding_invalid", "Evaluation context lifecycle bindings are inconsistent.", {}, 409);
  }
  requireSha(shadowSeal.canonical.payload?.shadowDecisionRecordSha256, "evaluationContext.shadowDecision.shadowDecisionRecordSha256");
  const correctionRecordSha256s = outcome.outcomeEvidence.corrections.map(correction => correction.sourceCorrectionRecordSha256);
  const context = {
    schemaVersion: routeIqEvaluationContextSchemaVersion,
    opportunityId: opportunity.opportunity_id,
    acceptedSnapshotManifest: {
      artifactId: snapshot.artifactId,
      recordSha256: snapshot.recordSha256,
      manifestRecordSha256: manifestRow.manifest_record_sha256,
      acceptedAt: snapshot.authoritativeRecordTime
    },
    snapshotSeal: {
      artifactId: snapshotSeal.artifactId,
      recordSha256: snapshotSeal.recordSha256,
      sealedAt: snapshotSeal.authoritativeRecordTime
    },
    manifest: {
      candidateManifestSha256: manifest.candidateManifestSha256,
      completeManifestSha256: manifest.completeManifestSha256,
      producerContractVersion: manifest.producerContractVersion,
      candidateSchemaVersion: manifest.schemaVersion,
      dataProjectionVersion: manifest.dataProjectionVersion
    },
    candidate: {
      candidateId: candidate.candidateId,
      acceptedRank: candidate.rankingContext.ordinal,
      probability: candidate.rankingContext.probability,
      rankingBasisVersion: candidate.rankingContext.basisVersion
    },
    shadowDecision: {
      shadowDecisionRecordSha256: shadowSeal.canonical.payload.shadowDecisionRecordSha256,
      sealArtifactId: shadowSeal.artifactId,
      sealRecordSha256: shadowSeal.recordSha256,
      sealedAt: shadowSeal.authoritativeRecordTime
    },
    action: {
      artifactId: action.artifactId,
      recordSha256: action.recordSha256,
      selectedCandidateId: action.canonical.payload.selectedCandidateId,
      linkedAt: action.authoritativeRecordTime
    },
    sourceOutcome: {
      evidenceSha256: outcome.evidenceSha256,
      correctionState: outcome.outcomeEvidence.correctionState,
      correctionCount: correctionRecordSha256s.length,
      correctionRecordSha256s
    },
    recommendationInfluence: "off",
    immutable: true
  };
  assertNoPiiLikeStrings(context, "evaluationContext");
  return deepFreeze({
    context,
    evaluationContextSha256: sha256(context)
  });
}

function persistEvaluationContext(repository, { opportunity, linkId, outcome, derived, createdAt }) {
  const contextId = hashId("evaluation_context", {
    opportunityId: opportunity.opportunity_id,
    sourceOutcomeEvidenceSha256: outcome.evidenceSha256,
    evaluationContextSha256: derived.evaluationContextSha256
  });
  const sequence = allocateSequence(repository);
  const contextJson = canonicalText(derived.context);
  registerArtifact(repository, {
    artifactId: contextId,
    artifactKind: "field_session_evaluation_context",
    opportunityId: opportunity.opportunity_id,
    recordSequence: sequence,
    registeredAt: createdAt
  });
  repositoryRows(repository, `
    INSERT INTO field_session_evaluation_contexts (
      context_id, link_id, opportunity_id, source_outcome_evidence_sha256,
      context_json, context_sha256, created_sequence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    contextId,
    linkId,
    opportunity.opportunity_id,
    outcome.evidenceSha256,
    contextJson,
    derived.evaluationContextSha256,
    sequence,
    createdAt
  ]);
  return deepFreeze({
    evaluationContextArtifactId: contextId,
    evaluationContextSha256: derived.evaluationContextSha256,
    evaluationContext: clone(derived.context)
  });
}

function readEvaluationContext(repository, sourceOutcomeEvidenceSha256) {
  const row = repositoryOne(repository, `
    SELECT * FROM field_session_evaluation_contexts
    WHERE source_outcome_evidence_sha256 = ?
  `, [sourceOutcomeEvidenceSha256]);
  if (!row) {
    fail("route_iq_evaluation_context_missing", "Immutable evaluation context is unavailable for the admitted outcome evidence.", {}, 409);
  }
  const context = parseCanonicalJson(row.context_json, row.context_sha256, "field-session evaluation context");
  if (context.schemaVersion !== routeIqEvaluationContextSchemaVersion
    || context.opportunityId !== row.opportunity_id
    || context.sourceOutcome?.evidenceSha256 !== row.source_outcome_evidence_sha256) {
    fail("route_iq_evaluation_context_poisoned", "Evaluation context columns do not match immutable context bytes.", {}, 500);
  }
  return { row, context };
}

function evaluationRecordBody(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== "evaluationRecordSha256"));
}

function validateFullIntelligenceEvaluationRecord(record, expected) {
  assertExactKeys(record, [
    "schemaVersion", "evaluationContractVersion", "authority", "recordOrigin", "scope",
    "opportunityId", "evaluationContextSha256", "sourceProjection", "shadowContext",
    "acceptedCandidate", "action", "scoreableOutcome", "chronology", "readinessObservation",
    "boundaries", "canonicalProductionEvidenceEligible", "recommendationInfluence", "immutable",
    "evaluationRecordSha256"
  ], "evaluationRecord");
  assertExactKeys(record.scope, ["workspaceId", "operatingProfileId", "representativeId"], "evaluationRecord.scope");
  if (record.schemaVersion !== routeIqIntelligenceEvaluationRecordSchemaVersion
    || record.evaluationContractVersion !== routeIqIntelligenceEvaluationContractVersion
    || record.authority !== "prometheus_intelligence_pure_evaluation"
    || record.recordOrigin !== "prospective"
    || !sameScope(record.scope, expected.scope)
    || record.opportunityId !== expected.context.opportunityId
    || record.evaluationContextSha256 !== expected.contextSha256
    || record.canonicalProductionEvidenceEligible !== true
    || record.recommendationInfluence !== "OFF"
    || record.immutable !== true) {
    fail("route_iq_evaluation_record_boundary_invalid", "Evaluation record violates the canonical Data admission boundary.", {}, 409);
  }
  assertExactKeys(record.sourceProjection, [
    "projectionId", "projectionCommitId", "projectionSha256", "asOfRecordSequence", "asOfRecordTime"
  ], "evaluationRecord.sourceProjection");
  assertExactKeys(record.shadowContext, ["sealArtifactId", "sealEventRecordSha256", "sealedAt"], "evaluationRecord.shadowContext");
  assertExactKeys(record.acceptedCandidate, [
    "candidateId", "rank", "probability", "rankingBasisVersion", "candidateManifestSha256", "completeManifestSha256"
  ], "evaluationRecord.acceptedCandidate");
  assertExactKeys(record.action, [
    "candidateId", "actionArtifactId", "actionRecordSha256", "linkedAt", "selectionAuthority"
  ], "evaluationRecord.action");
  assertExactKeys(record.scoreableOutcome, [
    "outcomeArtifactId", "outcomeRecordSha256", "sourceOutcomeEvidenceSha256",
    "scoreableOutcomeRecordSha256", "outcomeDerivationContractVersion", "observedOutcome", "admittedAt"
  ], "evaluationRecord.scoreableOutcome");
  assertExactKeys(record.scoreableOutcome.observedOutcome, ["status", "value"], "evaluationRecord.scoreableOutcome.observedOutcome");
  assertExactKeys(record.chronology, [
    "snapshotAcceptedAt", "shadowSealedAt", "actionLinkedAt", "visitActionEventTime",
    "archiveCommittedAt", "fieldEvidenceLinkedAt", "reconciledAt", "outcomeAdmittedAt"
  ], "evaluationRecord.chronology");
  assertExactKeys(record.readinessObservation, [
    "actualDecisionId", "evaluatedDecisionId", "selectedCandidateProbability", "selectedCandidateRank",
    "observedOutcome", "scoreableSelectedCandidateOutcome", "readinessCountEligible"
  ], "evaluationRecord.readinessObservation");
  assertExactKeys(record.readinessObservation.observedOutcome, [
    "status", "value", "evaluatedDecisionId"
  ], "evaluationRecord.readinessObservation.observedOutcome");
  assertExactKeys(record.boundaries, [
    "decisionSourceUsed", "futureEvidenceUsed", "observationalOnly", "causalClaimAllowed",
    "upliftClaimAllowed", "recommendationInfluenceAllowed"
  ], "evaluationRecord.boundaries");
  requireSha(record.evaluationRecordSha256, "evaluationRecord.evaluationRecordSha256");
  requireSha(record.scoreableOutcome.scoreableOutcomeRecordSha256, "evaluationRecord.scoreableOutcome.scoreableOutcomeRecordSha256");
  if (sha256(evaluationRecordBody(record)) !== record.evaluationRecordSha256) {
    fail("route_iq_evaluation_record_hash_invalid", "Evaluation record hash does not match its canonical bytes.", {}, 409);
  }
  const c = expected.context;
  const exactBindings = [
    [record.sourceProjection, expected.sourceProjection],
    [record.shadowContext, {
      sealArtifactId: c.shadowDecision.sealArtifactId,
      sealEventRecordSha256: c.shadowDecision.sealRecordSha256,
      sealedAt: c.shadowDecision.sealedAt
    }],
    [record.acceptedCandidate, {
      candidateId: c.candidate.candidateId,
      rank: c.candidate.acceptedRank,
      probability: c.candidate.probability,
      rankingBasisVersion: c.candidate.rankingBasisVersion,
      candidateManifestSha256: c.manifest.candidateManifestSha256,
      completeManifestSha256: c.manifest.completeManifestSha256
    }],
    [record.action, {
      candidateId: c.action.selectedCandidateId,
      actionArtifactId: c.action.artifactId,
      actionRecordSha256: c.action.recordSha256,
      linkedAt: c.action.linkedAt,
      selectionAuthority: "accepted_manifest_unique_ordinal_1"
    }],
    [record.scoreableOutcome.outcomeArtifactId, expected.outcomeEvent.artifactId],
    [record.scoreableOutcome.outcomeRecordSha256, expected.outcomeEvent.recordSha256],
    [record.scoreableOutcome.sourceOutcomeEvidenceSha256, c.sourceOutcome.evidenceSha256],
    [record.scoreableOutcome.outcomeDerivationContractVersion, expected.outcomeEvent.canonical.payload.outcomeDerivationContractVersion],
    [record.scoreableOutcome.observedOutcome, expected.outcomeEvent.canonical.payload.observedOutcome],
    [record.scoreableOutcome.admittedAt, expected.outcomeEvent.authoritativeRecordTime],
    [record.chronology, expected.chronology],
    [record.readinessObservation, {
      actualDecisionId: c.action.selectedCandidateId,
      evaluatedDecisionId: c.candidate.candidateId,
      selectedCandidateProbability: c.candidate.probability,
      selectedCandidateRank: c.candidate.acceptedRank,
      observedOutcome: {
        ...clone(expected.outcomeEvent.canonical.payload.observedOutcome),
        evaluatedDecisionId: c.candidate.candidateId
      },
      scoreableSelectedCandidateOutcome: true,
      readinessCountEligible: true
    }],
    [record.boundaries, {
      decisionSourceUsed: false,
      futureEvidenceUsed: false,
      observationalOnly: true,
      causalClaimAllowed: false,
      upliftClaimAllowed: false,
      recommendationInfluenceAllowed: false
    }]
  ];
  if (exactBindings.some(([actual, wanted]) => stableJson(actual) !== stableJson(wanted))) {
    fail("route_iq_evaluation_record_binding_invalid", "Evaluation record does not exactly bind the canonical context and admitted outcome.", {}, 409);
  }
  if (record.acceptedCandidate.rank !== 1
    || typeof record.acceptedCandidate.probability !== "number"
    || !Number.isFinite(record.acceptedCandidate.probability)
    || record.acceptedCandidate.probability < 0
    || record.acceptedCandidate.probability > 1
    || record.scoreableOutcome.observedOutcome.status !== "observed"
    || typeof record.scoreableOutcome.observedOutcome.value !== "boolean") {
    fail("route_iq_evaluation_record_not_scoreable", "Evaluation record is not a selected-candidate observed outcome.", {}, 409);
  }
  assertNoPiiLikeStrings(record, "evaluationRecord");
  return deepFreeze(clone(record));
}

function canonicalSessionForCommittedHandoff(repository, projection) {
  const matching = [];
  for (const row of repositoryRows(repository, `
    SELECT e.*, s.*
    FROM canonical_session_events e
    JOIN canonical_sessions s ON s.session_id = e.session_id
    WHERE e.event_kind = 'CLOSED'
    ORDER BY e.record_sequence, e.event_id
  `)) {
    const event = parseCanonicalJson(row.canonical_json, row.record_sha256, "canonical session close");
    if (event.payload?.handoffContractVersion === projection.sourceArchive.handoffContractId
      && event.payload?.endOfDayHandoffSha256 === projection.sourceArchive.rawSha256) {
      matching.push(row);
    }
  }
  if (matching.length !== 1) {
    fail(
      matching.length
        ? "route_iq_field_outcome_session_handoff_ambiguous"
        : "route_iq_field_outcome_session_handoff_unbound",
      "Field-session outcome projection must bind exactly one authenticated canonical session close.",
      { matchingSessionCount: matching.length },
      409
    );
  }
  return matching[0];
}

function unknownAllocatorTerritoryId() {
  return hashId("territory", {
    status: "unknown",
    meaning: "canonical_territory_context_unavailable",
    version: routeIqProspectiveServerAllocatorContractVersion
  });
}

function allocatorTerritoryContext(scope) {
  if (scope.territoryContext.status === "known") return scope.territoryContext;
  return {
    status: "unknown",
    territoryId: unknownAllocatorTerritoryId(),
    sourceRecordSha256: null,
    sourceContractVersion: null,
    availableAt: null
  };
}

function persistCanonicalSessionContext(repository, { sessionId, territoryContext }) {
  const canonical = {
    runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
    sessionId,
    territoryStatus: territoryContext.status,
    territoryId: territoryContext.territoryId,
    territorySourceRecordSha256: territoryContext.sourceRecordSha256,
    territorySourceContractVersion: territoryContext.sourceContractVersion,
    territorySourceAvailableAt: territoryContext.availableAt,
    immutable: true,
    appendOnly: true
  };
  const canonicalJson = canonicalText(canonical);
  repositoryRows(repository, `
    INSERT INTO canonical_session_contexts (
      session_id, territory_status, territory_id, territory_source_record_sha256,
      territory_source_contract_version, territory_source_available_at,
      canonical_json, record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sessionId,
    territoryContext.status,
    territoryContext.territoryId,
    territoryContext.sourceRecordSha256,
    territoryContext.sourceContractVersion,
    territoryContext.availableAt,
    canonicalJson,
    sha256(canonicalJson)
  ]);
  return deepFreeze(canonical);
}

function readCanonicalSessionContext(repository, sessionId) {
  const row = repositoryOne(repository, "SELECT * FROM canonical_session_contexts WHERE session_id = ?", [sessionId]);
  if (!row) return null;
  const canonical = parseCanonicalJson(row.canonical_json, row.record_sha256, "canonical session context");
  if (canonical.sessionId !== sessionId
    || canonical.territoryId !== row.territory_id
    || canonical.territoryStatus !== row.territory_status
    || canonical.territorySourceRecordSha256 !== row.territory_source_record_sha256
    || canonical.territorySourceContractVersion !== row.territory_source_contract_version
    || canonical.territorySourceAvailableAt !== row.territory_source_available_at) {
    fail("route_iq_coordinator_session_context_poisoned", "Canonical session context columns do not match immutable bytes.", {}, 500);
  }
  return canonical;
}

function nextMonotonicCoordinatorTime(repository, requestedTime) {
  const requested = canonicalTimestamp(requestedTime, "serverAllocator.authoritativeRecordTime");
  const canonicalTimeQueries = [
    ["coordinator_meta", "SELECT MAX(created_at) AS maximum_record_time FROM coordinator_meta"],
    ["canonical_sessions", "SELECT MAX(created_at) AS maximum_record_time FROM canonical_sessions"],
    ["canonical_session_events", "SELECT MAX(authoritative_record_time) AS maximum_record_time FROM canonical_session_events"],
    ["artifact_registry", "SELECT MAX(registered_at) AS maximum_record_time FROM artifact_registry"],
    ["operation_attempts", "SELECT MAX(authoritative_record_time) AS maximum_record_time FROM operation_attempts"],
    ["operation_receipts", "SELECT MAX(created_at) AS maximum_record_time FROM operation_receipts"],
    ["lifecycle_events", "SELECT MAX(authoritative_record_time) AS maximum_record_time FROM lifecycle_events"],
    ["projection_outbox", "SELECT MAX(authoritative_record_time) AS maximum_record_time FROM projection_outbox"],
    ["projection_artifacts", "SELECT MAX(as_of_record_time) AS maximum_record_time FROM projection_artifacts"],
    ["projection_commits", "SELECT MAX(committed_at) AS maximum_record_time FROM projection_commits"]
  ];
  let prior = null;
  for (const [source, query] of canonicalTimeQueries) {
    const value = repositoryOne(repository, query)?.maximum_record_time;
    if (!value) continue;
    const candidate = canonicalTimestamp(value, `coordinator.maximumAuthoritativeRecordTime.${source}`);
    if (!prior || candidate.time > prior.time) prior = candidate;
  }
  if (!prior) return requested.iso;
  if (requested.time > prior.time) return requested.iso;
  return new Date(prior.time + 1).toISOString();
}

function activeCanonicalSession(repository) {
  const sessions = repositoryRows(repository, `
    SELECT s.*
    FROM canonical_sessions s
    WHERE NOT EXISTS (
      SELECT 1 FROM canonical_session_events closed
      WHERE closed.session_id = s.session_id AND closed.event_kind = 'CLOSED'
    )
      AND (
        EXISTS (
          SELECT 1 FROM canonical_session_events opened
          WHERE opened.session_id = s.session_id AND opened.event_kind = 'OPENED'
        )
        OR EXISTS (
          SELECT 1 FROM opportunities opportunity
          WHERE opportunity.session_id = s.session_id
        )
      )
    ORDER BY s.session_event_sequence DESC, s.created_sequence DESC
    LIMIT 2
  `);
  if (sessions.length > 1) {
    fail("route_iq_server_allocator_multiple_open_sessions", "Multiple unclosed canonical field sessions cannot be adopted safely.", {
      sessionIds: sessions.map(session => session.session_id)
    }, 409);
  }
  return sessions[0] || null;
}

function currentAllocatedOpportunity(repository, sessionId) {
  return repositoryOne(repository, `
    SELECT o.*
    FROM opportunities o
    WHERE o.session_id = ?
    ORDER BY o.opportunity_event_sequence DESC
    LIMIT 1
  `, [sessionId]);
}

function allocationReceiptForOpportunity(repository, opportunityId, adoption = null) {
  const row = repositoryOne(repository, `
    SELECT * FROM operation_receipts
    WHERE opportunity_id = ? AND operation_kind = 'server_allocate_next_stop'
    ORDER BY created_sequence ASC
    LIMIT 1
  `, [opportunityId]);
  if (row) return receiptFromRow(row);
  if (!adoption) fail("route_iq_server_allocator_receipt_missing", "Canonical allocation receipt is missing.", {}, 500);

  const opportunity = getOpportunity(repository, opportunityId);
  const session = opportunity
    ? repositoryOne(repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [opportunity.session_id])
    : null;
  const triggerRow = repositoryOne(repository, `
    SELECT * FROM operation_receipts
    WHERE opportunity_id = ? AND operation_kind = 'trigger'
    ORDER BY created_sequence ASC
    LIMIT 1
  `, [opportunityId]);
  if (!opportunity || !session || !triggerRow) {
    fail("route_iq_server_allocator_legacy_adoption_invalid", "A retained trigger opportunity cannot be adopted without its canonical session and trigger receipt.", {}, 500);
  }
  const triggerReceipt = receiptFromRow(triggerRow);
  const adoptedAt = nextMonotonicCoordinatorTime(repository, adoption.requestedTime);
  const operationKey = hashId("idempotency", {
    coordinatorId: opportunity.coordinator_id,
    opportunityId,
    purpose: "server_allocate_next_stop_legacy_adoption",
    triggerReceiptSha256: triggerRow.receipt_sha256
  });
  const canonicalRequest = {
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    operation: "adopt_retained_trigger_opportunity",
    coordinatorId: opportunity.coordinator_id,
    sessionId: opportunity.session_id,
    opportunityId,
    triggerReceiptSha256: triggerRow.receipt_sha256,
    informationalBrowserFieldsExcludedFromIdentity: true
  };
  const requestSha256 = sha256(canonicalRequest);
  const clientContentSha256 = sha256({
    eventKind: adoption.event.eventKind,
    informationalSequence: adoption.event.informationalSequence,
    informationalObservedAt: adoption.event.informationalObservedAt
  });
  const attemptId = `riq_attempt_${sha256({ operationKey, requestSha256 })}`;
  repositoryRows(repository, `
    INSERT INTO operation_attempts (
      attempt_id, operation_key, opportunity_id, operation_kind, request_sha256,
      canonical_request_json, privacy_redacted, authoritative_record_time,
      client_event_sequence, client_content_sha256
    ) VALUES (?, ?, ?, 'server_allocate_next_stop', ?, ?, 0, ?, ?, ?)
  `, [
    attemptId,
    operationKey,
    opportunityId,
    requestSha256,
    canonicalText(canonicalRequest),
    adoptedAt,
    adoption.event.informationalSequence ?? 0,
    clientContentSha256
  ]);
  const adoptionRecordSequence = allocateSequence(repository);
  const receipt = {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    status: "adopted",
    coordinatorId: opportunity.coordinator_id,
    sessionId: opportunity.session_id,
    opportunityId,
    operationKey,
    operationKind: "server_allocate_next_stop",
    requestSha256,
    artifactId: triggerReceipt.artifactId,
    recordSha256: triggerReceipt.recordSha256,
    recordSequence: triggerReceipt.recordSequence,
    authoritativeRecordTime: triggerReceipt.authoritativeRecordTime,
    adoptionRecordSequence,
    adoptionAuthoritativeRecordTime: adoptedAt,
    state: opportunity.state,
    recoveryOutboxPersisted: true,
    recommendationInfluence: "off",
    collectionDefault: "off",
    serverDerivedCanonicalIdentity: true,
    identityAuthority: "retained_authenticated_trigger",
    legacyTriggerAdoptedWithoutRewrite: true,
    informationalBrowserFieldsControlIdentity: false,
    candidateCompletenessStatus: opportunity.current_manifest_sha256
      ? "authenticated_intelligence_manifest_present"
      : "pending_authenticated_intelligence_manifest",
    snapshotAccepted: opportunity.current_manifest_sha256 !== null,
    canonicalContext: {
      territoryId: opportunity.territory_id,
      canonicalSessionRecordSha256: opportunity.canonical_session_record_sha256,
      sessionEventSequence: Number(session.session_event_sequence),
      opportunityEventSequence: Number(opportunity.opportunity_event_sequence),
      triggerRecordSha256: opportunity.trigger_record_sha256,
      canonicalEventBoundarySha256: opportunity.trigger_boundary_sha256
    }
  };
  const receiptJson = canonicalText(receipt);
  repositoryRows(repository, `
    INSERT INTO operation_receipts (
      operation_key, opportunity_id, operation_kind, accepted_request_sha256,
      receipt_json, receipt_sha256, created_sequence, created_at
    ) VALUES (?, ?, 'server_allocate_next_stop', ?, ?, ?, ?, ?)
  `, [
    operationKey,
    opportunityId,
    requestSha256,
    receiptJson,
    sha256(receiptJson),
    adoptionRecordSequence,
    adoptedAt
  ]);
  return deepFreeze(receipt);
}

function authenticatedMaterialManifestRotationAllowed(repository, opportunityId) {
  const exclusion = latestEvent(repository, opportunityId, "EXCLUSION_RECORDED");
  const reasons = exclusion?.canonical?.payload?.reasonCodes;
  if (!Array.isArray(reasons)
    || reasons.length !== 1
    || reasons[0] !== "candidate_manifest_materially_changed") return false;
  const manifest = repositoryOne(repository, `
    SELECT * FROM candidate_manifests WHERE opportunity_id = ?
  `, [opportunityId]);
  if (!manifest) return false;
  const canonical = parseCanonicalJson(manifest.manifest_json, manifest.manifest_record_sha256, "preserved candidate manifest");
  return canonical.completeManifestSha256 === manifest.complete_manifest_sha256
    && exclusion.canonical.payload.requestContentPersisted === false
    && exclusion.canonical.payload.permanent === true
    && exclusion.canonical.payload.mayBePromotedLater === false;
}

function isAllocationOpenState(state) {
  return ["TRIGGERED", "SNAPSHOT_PENDING_SEAL", "SNAPSHOT_SEALED", "SHADOW_DECISION_SEALED"].includes(state);
}

function appendCanonicalSessionEvent(repository, {
  coordinatorId,
  sessionId,
  eventKind,
  requestSha256,
  authoritativeRecordTime,
  payload,
  receipt = null
}) {
  const recordSequence = allocateSequence(repository);
  const eventId = `riq_session_event_${sha256({ coordinatorId, sessionId, eventKind, requestSha256 })}`;
  const canonical = {
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    eventId,
    eventKind,
    coordinatorId,
    sessionId,
    requestSha256,
    recordSequence,
    authoritativeRecordTime,
    payload: clone(payload),
    immutable: true,
    appendOnly: true,
    recommendationInfluence: "off"
  };
  const canonicalJson = canonicalText(canonical);
  const recordSha256 = sha256(canonicalJson);
  const receiptJson = receipt ? canonicalText(receipt) : null;
  registerArtifact(repository, {
    artifactId: eventId,
    artifactKind: `canonical_session_${eventKind.toLowerCase()}`,
    recordSequence,
    registeredAt: authoritativeRecordTime
  });
  repositoryRows(repository, `
    INSERT INTO canonical_session_events (
      event_id, session_id, event_kind, request_sha256, record_sequence,
      authoritative_record_time, canonical_json, record_sha256, receipt_json, receipt_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    eventId,
    sessionId,
    eventKind,
    requestSha256,
    recordSequence,
    authoritativeRecordTime,
    canonicalJson,
    recordSha256,
    receiptJson,
    receiptJson ? sha256(receiptJson) : null
  ]);
  return { eventId, recordSequence, authoritativeRecordTime, recordSha256, canonical };
}

function parseSessionEventReceipt(row) {
  if (!row?.receipt_json || !row.receipt_sha256) return null;
  return deepFreeze(parseCanonicalJson(row.receipt_json, row.receipt_sha256, "canonical session receipt"));
}

function createCanonicalSession(repository, { coordinatorId, scope, authoritativeRecordTime }) {
  const sessionEventSequence = Number(repositoryOne(repository, `
    SELECT COALESCE(MAX(session_event_sequence), -1) + 1 AS next_sequence
    FROM canonical_sessions WHERE coordinator_id = ?
  `, [coordinatorId])?.next_sequence ?? 0);
  requireSequence(sessionEventSequence, "serverAllocator.sessionEventSequence");
  const sessionId = hashId("session", { coordinatorId, sessionEventSequence });
  const territoryContext = allocatorTerritoryContext(scope);
  const territoryId = territoryContext.territoryId;
  const canonicalSessionRecordSha256 = sha256({
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    coordinatorId,
    sessionId,
    sessionEventSequence,
    territoryId,
    openedAt: authoritativeRecordTime,
    identityAuthority: "authenticated_server_scope_and_sqlite_state",
    territoryContextStatus: territoryContext.status,
    territorySourceRecordSha256: territoryContext.sourceRecordSha256,
    territorySourceContractVersion: territoryContext.sourceContractVersion,
    territorySourceAvailableAt: territoryContext.availableAt
  });
  const createdSequence = allocateSequence(repository);
  repositoryRows(repository, `
    INSERT INTO canonical_sessions (
      session_id, coordinator_id, canonical_session_record_sha256, territory_id,
      session_event_sequence, created_sequence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    sessionId,
    coordinatorId,
    canonicalSessionRecordSha256,
    territoryId,
    sessionEventSequence,
    createdSequence,
    authoritativeRecordTime
  ]);
  persistCanonicalSessionContext(repository, { sessionId, territoryContext });
  const openRequestSha256 = sha256({
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    coordinatorId,
    sessionId,
    canonicalSessionRecordSha256,
    eventKind: "OPENED"
  });
  appendCanonicalSessionEvent(repository, {
    coordinatorId,
    sessionId,
    eventKind: "OPENED",
    requestSha256: openRequestSha256,
    authoritativeRecordTime,
    payload: {
      canonicalSessionRecordSha256,
      territoryId,
      territoryContextStatus: territoryContext.status,
      territorySourceRecordSha256: territoryContext.sourceRecordSha256,
      territorySourceContractVersion: territoryContext.sourceContractVersion,
      territorySourceAvailableAt: territoryContext.availableAt,
      sessionEventSequence,
      identityAuthority: "authenticated_server_scope_and_sqlite_state"
    }
  });
  return repositoryOne(repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [sessionId]);
}

function serverDerivedTriggerClaims({ coordinatorId, scope, session, opportunityEventSequence, authoritativeRecordTime, event }) {
  const triggerRecordSha256 = sha256({
    allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
    coordinatorId,
    sessionId: session.session_id,
    opportunityEventSequence,
    opportunityType: "next_stop",
    captureSource: "dashboard_next_stop_requested"
  });
  return {
    purpose: "trigger",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    territoryId: session.territory_id,
    canonicalSessionRecordSha256: session.canonical_session_record_sha256,
    sessionEventSequence: Number(session.session_event_sequence),
    opportunityEventSequence,
    triggerRecordSha256,
    canonicalEventBoundarySha256: sha256({
      allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
      sessionId: session.session_id,
      opportunityEventSequence,
      triggerRecordSha256
    }),
    clientEventSequence: event.informationalSequence ?? 0,
    clientContentSha256: sha256({
      eventKind: event.eventKind,
      informationalSequence: event.informationalSequence,
      informationalObservedAt: event.informationalObservedAt
    }),
    authoritativeRecordTime,
    recordOrigin: "prospective",
    uncertainChronology: false
  };
}

function createServerAllocatedOpportunity(repository, {
  coordinatorId,
  scope,
  scopeAuthority,
  session,
  authoritativeRecordTime,
  event
}) {
  const opportunityEventSequence = Number(repositoryOne(repository, `
    SELECT COALESCE(MAX(opportunity_event_sequence), -1) + 1 AS next_sequence
    FROM opportunities WHERE session_id = ?
  `, [session.session_id])?.next_sequence ?? 0);
  requireSequence(opportunityEventSequence, "serverAllocator.opportunityEventSequence");
  const claims = serverDerivedTriggerClaims({
    coordinatorId,
    scope,
    session,
    opportunityEventSequence,
    authoritativeRecordTime,
    event
  });
  const identities = identitiesForClaims(coordinatorId, claims);
  repositoryRows(repository, `
    INSERT INTO opportunities (
      opportunity_id, coordinator_id, session_id, canonical_session_record_sha256,
      territory_id, opportunity_type, opportunity_event_sequence, trigger_record_sha256,
      trigger_boundary_sha256, state, canonical_eligible, current_manifest_sha256,
      last_record_sequence, last_record_time
    ) VALUES (?, ?, ?, ?, ?, 'next_stop', ?, ?, ?, 'TRIGGERED', 1, NULL, 0, NULL)
  `, [
    identities.opportunityId,
    coordinatorId,
    session.session_id,
    session.canonical_session_record_sha256,
    session.territory_id,
    opportunityEventSequence,
    claims.triggerRecordSha256,
    claims.canonicalEventBoundarySha256
  ]);
  const canonicalRequest = canonicalRequestForClaims(claims, scopeAuthority, {
    identityAuthority: "authenticated_server_scope_and_sqlite_state",
    informationalBrowserFieldsExcludedFromIdentity: true
  });
  const requestSha256 = sha256(canonicalRequest);
  insertAttempt(repository, {
    identities,
    claims,
    operationKind: "server_allocate_next_stop",
    requestSha256,
    canonicalRequest
  });
  const lifecycle = appendLifecycleEvent(repository, {
    coordinatorId,
    sessionId: session.session_id,
    opportunityId: identities.opportunityId,
    operationKey: identities.operationKey,
    requestSha256,
    logicalBoundarySha256: claims.canonicalEventBoundarySha256,
    authoritativeRecordTime,
    eventKind: "TRIGGERED",
    artifactKind: "opportunity_trigger",
    fromState: null,
    toState: "TRIGGERED",
    payload: {
      opportunityType: "next_stop",
      territoryId: session.territory_id,
      canonicalSessionRecordSha256: session.canonical_session_record_sha256,
      sessionEventSequence: Number(session.session_event_sequence),
      opportunityEventSequence,
      triggerRecordSha256: claims.triggerRecordSha256,
      captureSource: "dashboard_next_stop_requested",
      informationalClientEvent: clone(event),
      informationalFieldsControlIdentity: false,
      candidateCompletenessStatus: "pending_authenticated_intelligence_manifest",
      snapshotAccepted: false,
      recordOrigin: "prospective"
    },
    canonicalEvidenceEligible: false
  });
  updateOpportunityState(repository, identities.opportunityId, lifecycle, "TRIGGERED");
  return insertReceipt(repository, {
    identities,
    operationKind: "server_allocate_next_stop",
    requestSha256,
    event: lifecycle,
    state: "TRIGGERED",
    details: {
      allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
      serverDerivedCanonicalIdentity: true,
      informationalBrowserFieldsControlIdentity: false,
      candidateCompletenessStatus: "pending_authenticated_intelligence_manifest",
      snapshotAccepted: false,
      canonicalContext: {
        territoryId: session.territory_id,
        canonicalSessionRecordSha256: session.canonical_session_record_sha256,
        sessionEventSequence: Number(session.session_event_sequence),
        opportunityEventSequence,
        triggerRecordSha256: claims.triggerRecordSha256,
        canonicalEventBoundarySha256: claims.canonicalEventBoundarySha256
      }
    }
  });
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
  constructor({ repository, authorityVerifier, scopeAuthority, scope, coordinatorId }) {
    this.repository = repository;
    this.authorityVerifier = authorityVerifier;
    this.scopeAuthority = scopeAuthority;
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

  async readCanonicalRuntimeContext(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "runtimeContextReadRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "runtime_context_read",
      coordinatorId: this.coordinatorId
    });
    normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "runtime_context_read");
    return this.repository.transactionSync(() => canonicalRuntimeContext(
      this.repository,
      this.scope,
      this.coordinatorId
    ));
  }

  async recordRuntimeStageExclusion(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "runtimeStageExclusionRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "runtime_stage_exclusion",
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "runtime_stage_exclusion", [
      "runtimeContextReceiptSha256", "stage", "reasonCodes", "offendingDigest"
    ]);
    requireSha(claims.runtimeContextReceiptSha256, "verifiedRuntimeClaims.runtime_stage_exclusion.runtimeContextReceiptSha256");
    requireSha(claims.offendingDigest, "verifiedRuntimeClaims.runtime_stage_exclusion.offendingDigest");
    if (![
      "candidate_manifest", "snapshot_seal", "shadow_decision", "action",
      "outcome_reconciliation", "evaluation", "runtime_orchestration"
    ].includes(claims.stage)) {
      fail("route_iq_runtime_exclusion_stage_invalid", "Runtime exclusion stage is not governed.", { paths: ["verifiedRuntimeClaims.runtime_stage_exclusion.stage"] });
    }
    if (!Array.isArray(claims.reasonCodes) || claims.reasonCodes.length < 1 || claims.reasonCodes.length > 8) {
      fail("route_iq_runtime_exclusion_reasons_invalid", "Runtime exclusion requires one to eight governed reason codes.");
    }
    const reasonCodes = claims.reasonCodes.map((reason, index) => requireReason(reason, `verifiedRuntimeClaims.runtime_stage_exclusion.reasonCodes[${index}]`));
    const result = this.repository.transactionSync(() => {
      const context = canonicalRuntimeContext(this.repository, this.scope, this.coordinatorId);
      const session = activeCanonicalSession(this.repository);
      const opportunity = getOpportunity(this.repository, context.opportunityId);
      const operationClaims = internalOperationClaims({
        scope: this.scope,
        session,
        opportunity,
        purpose: "runtime_stage_exclusion",
        authoritativeRecordTime: claims.authoritativeRecordTime,
        boundary: {
          runtimeContextReceiptSha256: claims.runtimeContextReceiptSha256,
          stage: claims.stage
        },
        content: { reasonCodes: [...new Set(reasonCodes)].sort(), offendingDigest: claims.offendingDigest }
      });
      const identities = identitiesForClaims(this.coordinatorId, operationClaims);
      const canonicalRequest = {
        runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
        runtimeContextReceiptSha256: claims.runtimeContextReceiptSha256,
        stage: claims.stage,
        reasonCodes: [...new Set(reasonCodes)].sort(),
        offendingDigest: claims.offendingDigest
      };
      const requestSha256 = exclusionRequestSha(reasonCodes, operationClaims, claims.offendingDigest);
      const existing = existingReceiptDecision(this.repository, {
        identities,
        operationKind: "runtime_stage_exclusion",
        requestSha256,
        claims: operationClaims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      if (context.runtimeContextReceiptSha256 !== claims.runtimeContextReceiptSha256) {
        fail("route_iq_runtime_context_receipt_stale", "Runtime exclusion does not bind the current canonical context.", {}, 409);
      }
      return persistExclusion(this.repository, {
        coordinatorId: this.coordinatorId,
        identities,
        claims: operationClaims,
        operationKind: "runtime_stage_exclusion",
        reasonCodes,
        incomingDigest: claims.offendingDigest,
        requestSha256Override: requestSha256,
        canonicalRequest
      });
    });
    return transitionResult(result);
  }

  async linkServerDerivedNextStopAction(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "serverDerivedActionRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "server_action_signal",
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "server_action_signal", [
      "runtimeContextReceiptSha256", "eventKind"
    ]);
    requireSha(claims.runtimeContextReceiptSha256, "verifiedRuntimeClaims.server_action_signal.runtimeContextReceiptSha256");
    if (claims.eventKind !== "representative_action_observed") {
      fail("route_iq_runtime_action_signal_invalid", "Only the governed representative action event may link a next-stop action.");
    }
    const result = this.repository.transactionSync(() => {
      const context = canonicalRuntimeContext(this.repository, this.scope, this.coordinatorId);
      const opportunity = getOpportunity(this.repository, context.opportunityId);
      const existingActionReceipt = repositoryOne(this.repository, `
        SELECT * FROM operation_receipts
        WHERE opportunity_id = ? AND operation_kind = 'server_derived_action'
        ORDER BY created_sequence LIMIT 1
      `, [opportunity.opportunity_id]);
      if (existingActionReceipt) return receiptFromRow(existingActionReceipt);
      if (context.runtimeContextReceiptSha256 !== claims.runtimeContextReceiptSha256) {
        fail("route_iq_runtime_context_receipt_stale", "Action signal does not bind the current canonical context.", {}, 409);
      }
      const session = activeCanonicalSession(this.repository);
      const actionTime = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
      const operationClaims = internalOperationClaims({
        scope: this.scope,
        session,
        opportunity,
        purpose: "server_action_signal",
        authoritativeRecordTime: actionTime,
        boundary: {
          runtimeContextReceiptSha256: claims.runtimeContextReceiptSha256,
          eventKind: claims.eventKind
        },
        content: { eventKind: claims.eventKind }
      });
      const identities = identitiesForClaims(this.coordinatorId, operationClaims);
      if (opportunity.state !== "SHADOW_DECISION_SEALED" || opportunity.canonical_eligible !== 1) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: operationClaims,
          operationKind: "server_derived_action",
          reasonCodes: [opportunity.state === "EXCLUDED"
            ? "opportunity_permanently_excluded"
            : "shadow_not_sealed_before_action"],
          incomingDigest: operationClaims.clientContentSha256
        });
      }
      const manifestRow = repositoryOne(this.repository, "SELECT * FROM candidate_manifests WHERE opportunity_id = ?", [opportunity.opportunity_id]);
      const manifest = manifestRow
        ? parseCanonicalJson(manifestRow.manifest_json, manifestRow.manifest_record_sha256, "candidate manifest")
        : null;
      const rankOne = manifest?.candidates?.filter(candidate => candidate.rankingContext?.ordinal === 1) || [];
      if (rankOne.length !== 1) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: operationClaims,
          operationKind: "server_derived_action",
          reasonCodes: [rankOne.length ? "rank_one_candidate_ambiguous" : "rank_one_candidate_missing"],
          incomingDigest: manifestRow?.complete_manifest_sha256 || operationClaims.clientContentSha256
        });
      }
      const selectedCandidateId = requireHashId(rankOne[0].candidateId, "candidate", "canonicalManifest.rankOne.candidateId");
      const canonicalRequest = {
        runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
        eventKind: claims.eventKind,
        runtimeContextReceiptSha256: claims.runtimeContextReceiptSha256,
        selectedCandidateDerivedFrom: "accepted_manifest_unique_ordinal_1",
        selectedCandidateId
      };
      const requestSha256 = sha256(canonicalRequest);
      const existing = existingReceiptDecision(this.repository, {
        identities,
        operationKind: "server_derived_action",
        requestSha256,
        claims: operationClaims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      insertAttempt(this.repository, {
        identities,
        claims: operationClaims,
        operationKind: "server_derived_action",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        opportunityId: opportunity.opportunity_id,
        operationKey: identities.operationKey,
        requestSha256,
        logicalBoundarySha256: operationClaims.canonicalEventBoundarySha256,
        authoritativeRecordTime: operationClaims.authoritativeRecordTime,
        eventKind: "ACTION_LINKED",
        artifactKind: "action",
        fromState: "SHADOW_DECISION_SEALED",
        toState: "ACTION_LINKED",
        payload: {
          selectedCandidateId,
          selectionAuthority: "accepted_manifest_unique_ordinal_1",
          browserCandidateIdentityAccepted: false,
          eventKind: claims.eventKind,
          decisionSource: null
        },
        canonicalEvidenceEligible: true
      });
      updateOpportunityState(this.repository, opportunity.opportunity_id, event, "ACTION_LINKED");
      return insertReceipt(this.repository, {
        identities,
        operationKind: "server_derived_action",
        requestSha256,
        event,
        state: "ACTION_LINKED",
        details: {
          selectedCandidateId,
          selectedCandidateDerivedFrom: "accepted_manifest_unique_ordinal_1",
          browserCandidateIdentityAccepted: false
        }
      });
    });
    return transitionResult(result);
  }

  async reconcileCommittedFieldSessionOutcomes(input = {}) {
    this.assertInput(input, ["authorityEnvelope", "projection"], "fieldSessionOutcomeReconciliationRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "field_session_reconciliation",
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "field_session_reconciliation", [
      "projectionSha256", "sourceArchiveRawSha256", "sourceArchiveSessionSha256"
    ]);
    requireSha(claims.projectionSha256, "verifiedRuntimeClaims.field_session_reconciliation.projectionSha256");
    requireSha(claims.sourceArchiveRawSha256, "verifiedRuntimeClaims.field_session_reconciliation.sourceArchiveRawSha256");
    requireSha(claims.sourceArchiveSessionSha256, "verifiedRuntimeClaims.field_session_reconciliation.sourceArchiveSessionSha256");
    const projection = normalizeFieldSessionOutcomeProjection(input.projection, this.scope);
    if (claims.projectionSha256 !== projection.projectionSha256
      || claims.sourceArchiveRawSha256 !== projection.sourceArchive.rawSha256
      || claims.sourceArchiveSessionSha256 !== projection.sourceArchive.sourceArchiveSessionSha256) {
      fail("route_iq_field_outcome_reconciliation_binding_invalid", "Reconciliation authority does not bind the exact Data projection.", {}, 409);
    }
    const result = this.repository.transactionSync(() => {
      const existing = repositoryOne(this.repository, `
        SELECT * FROM field_session_reconciliation_receipts WHERE source_projection_sha256 = ?
      `, [projection.projectionSha256]);
      if (existing) return { receipt: parseReconciliationReceipt(existing) };
      const prior = repositoryOne(this.repository, `
        SELECT * FROM field_session_reconciliation_receipts
        WHERE source_archive_raw_sha256 = ? OR source_archive_session_sha256 = ?
        ORDER BY created_sequence LIMIT 1
      `, [projection.sourceArchive.rawSha256, projection.sourceArchive.sourceArchiveSessionSha256]);
      if (prior) {
        const conflictAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
        const conflictId = hashId("reconciliation_conflict", {
          sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
          originalProjectionSha256: prior.source_projection_sha256,
          competingProjectionSha256: projection.projectionSha256
        });
        const canonical = {
          contractVersion: routeIqFieldSessionOutcomeProjectionContractVersion,
          conflictId,
          sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256,
          originalProjectionSha256: prior.source_projection_sha256,
          competingProjectionSha256: projection.projectionSha256,
          offendingDigest: projection.projectionSha256,
          createdAt: conflictAt,
          overwritePerformed: false,
          priorEvidencePreserved: true,
          recommendationInfluence: "off"
        };
        const sequence = allocateSequence(this.repository);
        const canonicalJson = canonicalText(canonical);
        registerArtifact(this.repository, {
          artifactId: conflictId,
          artifactKind: "field_session_reconciliation_conflict",
          recordSequence: sequence,
          registeredAt: conflictAt
        });
        repositoryRows(this.repository, `
          INSERT INTO field_session_reconciliation_conflicts (
            conflict_id, source_archive_raw_sha256, original_projection_sha256,
            competing_projection_sha256, offending_digest, canonical_json,
            record_sha256, created_sequence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          conflictId,
          projection.sourceArchive.rawSha256,
          prior.source_projection_sha256,
          projection.projectionSha256,
          projection.projectionSha256,
          canonicalJson,
          sha256(canonicalJson),
          sequence,
          conflictAt
        ]);
        return { conflict: canonical };
      }

      const session = canonicalSessionForCommittedHandoff(this.repository, projection);
      const actionRows = repositoryRows(this.repository, `
        SELECT e.*
        FROM lifecycle_events e
        LEFT JOIN field_session_outcome_links linked ON linked.action_artifact_id = e.artifact_id
        WHERE e.session_id = ? AND e.event_kind = 'ACTION_LINKED' AND linked.link_id IS NULL
        ORDER BY e.record_sequence, e.artifact_id
      `, [session.session_id]);
      const availableActions = actionRows.map(eventFromRow);
      const linked = [];
      const excluded = [];

      for (const outcome of projection.outcomes) {
        if (outcome.candidateId === null) {
          excluded.push({ sourceVisitRecordSha256: outcome.sourceVisitRecordSha256, reasonCode: "candidate_identity_unavailable" });
          continue;
        }
        const matches = availableActions.filter(action => action.canonical.payload.selectedCandidateId === outcome.candidateId);
        if (matches.length !== 1) {
          excluded.push({
            sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
            reasonCode: matches.length ? "candidate_action_binding_ambiguous" : "candidate_action_binding_missing"
          });
          continue;
        }
        const action = matches[0];
        const opportunity = getOpportunity(this.repository, action.canonical.opportunityId);
        const shadowSeal = latestEvent(this.repository, opportunity.opportunity_id, "SHADOW_DECISION_SEALED");
        if (!shadowSeal
          || Date.parse(shadowSeal.authoritativeRecordTime) >= Date.parse(action.authoritativeRecordTime)
          || Date.parse(action.authoritativeRecordTime) >= Date.parse(outcome.actionEventTime)
          || Date.parse(outcome.actionEventTime) >= Date.parse(projection.sourceArchive.archiveCommittedAt)
          || opportunity.state !== "ACTION_LINKED"
          || opportunity.canonical_eligible !== 1) {
          excluded.push({ sourceVisitRecordSha256: outcome.sourceVisitRecordSha256, reasonCode: "action_outcome_chronology_invalid" });
          continue;
        }
        const linkAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
        const operationClaims = internalOperationClaims({
          scope: this.scope,
          session,
          opportunity,
          purpose: "field_session_outcome_evidence",
          authoritativeRecordTime: linkAt,
          boundary: {
            sourceProjectionSha256: projection.projectionSha256,
            sourceVisitRecordSha256: outcome.sourceVisitRecordSha256
          },
          content: { evidenceSha256: outcome.evidenceSha256, candidateId: outcome.candidateId }
        });
        const identities = identitiesForClaims(this.coordinatorId, operationClaims);
        const canonicalRequest = {
          contractVersion: routeIqFieldSessionOutcomeProjectionContractVersion,
          projectionSha256: projection.projectionSha256,
          sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
          evidenceSha256: outcome.evidenceSha256,
          candidateId: outcome.candidateId,
          actionArtifactId: action.artifactId
        };
        const requestSha256 = sha256(canonicalRequest);
        insertAttempt(this.repository, {
          identities,
          claims: operationClaims,
          operationKind: "field_session_outcome_evidence",
          requestSha256,
          canonicalRequest
        });
        const event = appendLifecycleEvent(this.repository, {
          coordinatorId: this.coordinatorId,
          sessionId: session.session_id,
          opportunityId: opportunity.opportunity_id,
          operationKey: identities.operationKey,
          requestSha256,
          logicalBoundarySha256: operationClaims.canonicalEventBoundarySha256,
          authoritativeRecordTime: linkAt,
          eventKind: "FIELD_SESSION_OUTCOME_EVIDENCE_LINKED",
          artifactKind: "field_session_outcome_evidence",
          fromState: "ACTION_LINKED",
          toState: "ACTION_LINKED",
          payload: {
            candidateId: outcome.candidateId,
            actionArtifactId: action.artifactId,
            sourceProjectionSha256: projection.projectionSha256,
            sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
            evidenceSha256: outcome.evidenceSha256,
            actionEventTime: outcome.actionEventTime,
            archiveCommittedAt: projection.sourceArchive.archiveCommittedAt,
            outcomeEvidence: clone(outcome.outcomeEvidence),
            decisionSource: clone(outcome.decisionSource),
            scoreableOutcome: null,
            scoreableOutcomeDerivedByData: false
          },
          canonicalEvidenceEligible: false
        });
        updateOpportunityState(this.repository, opportunity.opportunity_id, event, "ACTION_LINKED");
        const evidenceJson = canonicalText(outcome);
        repositoryRows(this.repository, `
          INSERT INTO field_session_outcome_links (
            link_id, opportunity_id, action_artifact_id, candidate_id,
            source_projection_sha256, source_archive_raw_sha256,
            source_archive_session_sha256, source_visit_record_sha256,
            visit_event_time, archive_committed_at, evidence_json, evidence_sha256,
            linked_sequence, linked_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          event.artifactId,
          opportunity.opportunity_id,
          action.artifactId,
          outcome.candidateId,
          projection.projectionSha256,
          projection.sourceArchive.rawSha256,
          projection.sourceArchive.sourceArchiveSessionSha256,
          outcome.sourceVisitRecordSha256,
          outcome.actionEventTime,
          projection.sourceArchive.archiveCommittedAt,
          evidenceJson,
          outcome.evidenceSha256,
          event.recordSequence,
          event.authoritativeRecordTime
        ]);
        let priorEvent = event;
        for (const correction of outcome.outcomeEvidence.corrections) {
          const correctionAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
          const correctionOperationKey = hashId("idempotency", {
            coordinatorId: this.coordinatorId,
            opportunityId: opportunity.opportunity_id,
            purpose: "field_session_outcome_correction",
            sourceCorrectionRecordSha256: correction.sourceCorrectionRecordSha256
          });
          const correctionRequestSha256 = sha256({
            sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
            sourceCorrectionRecordSha256: correction.sourceCorrectionRecordSha256,
            evidenceSha256: outcome.evidenceSha256
          });
          const correctionEvent = appendLifecycleEvent(this.repository, {
            coordinatorId: this.coordinatorId,
            sessionId: session.session_id,
            opportunityId: opportunity.opportunity_id,
            operationKey: correctionOperationKey,
            requestSha256: correctionRequestSha256,
            logicalBoundarySha256: sha256({
              sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
              sourceCorrectionRecordSha256: correction.sourceCorrectionRecordSha256
            }),
            authoritativeRecordTime: correctionAt,
            eventKind: "FIELD_SESSION_OUTCOME_CORRECTION_LINKED",
            artifactKind: "field_session_outcome_correction",
            fromState: "ACTION_LINKED",
            toState: "ACTION_LINKED",
            payload: {
              targetArtifactId: priorEvent.artifactId,
              candidateId: outcome.candidateId,
              sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
              sourceCorrectionRecordSha256: correction.sourceCorrectionRecordSha256,
              sequence: correction.sequence,
              correctedAt: correction.correctedAt,
              previousOutcomeSignal: clone(correction.previousOutcomeSignal),
              finalOutcomeSignal: clone(correction.finalOutcomeSignal),
              changedSignalFields: clone(correction.changedSignalFields),
              priorHistoryPreserved: true
            },
            canonicalEvidenceEligible: false
          });
          updateOpportunityState(this.repository, opportunity.opportunity_id, correctionEvent, "ACTION_LINKED");
          priorEvent = correctionEvent;
        }
        const derivedEvaluationContext = deriveImmutableEvaluationContext(this.repository, {
          opportunity,
          manifestRow: repositoryOne(this.repository, "SELECT * FROM candidate_manifests WHERE opportunity_id = ?", [opportunity.opportunity_id]),
          action,
          outcome
        });
        const persistedEvaluationContext = persistEvaluationContext(this.repository, {
          opportunity,
          linkId: event.artifactId,
          outcome,
          derived: derivedEvaluationContext,
          createdAt: nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime)
        });
        linked.push({
          sourceVisitRecordSha256: outcome.sourceVisitRecordSha256,
          opportunityId: opportunity.opportunity_id,
          candidateId: outcome.candidateId,
          evidenceSha256: outcome.evidenceSha256,
          actionArtifactId: action.artifactId,
          outcomeEvidenceArtifactId: event.artifactId,
          ...persistedEvaluationContext
        });
        availableActions.splice(availableActions.indexOf(action), 1);
      }

      const createdAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
      const reconciliationId = hashId("reconciliation", { projectionSha256: projection.projectionSha256 });
      const receipt = {
        contractVersion: routeIqFieldSessionOutcomeProjectionContractVersion,
        reconciliationId,
        status: "reconciled",
        coordinatorId: this.coordinatorId,
        sourceProjectionSha256: projection.projectionSha256,
        sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
        sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256,
        linked,
        exclusions: excluded,
        outcomeValuesInferredByData: false,
        recommendationInfluence: "off",
        createdAt
      };
      const sequence = allocateSequence(this.repository);
      const receiptJson = canonicalText(receipt);
      registerArtifact(this.repository, {
        artifactId: reconciliationId,
        artifactKind: "field_session_reconciliation_receipt",
        recordSequence: sequence,
        registeredAt: createdAt
      });
      repositoryRows(this.repository, `
        INSERT INTO field_session_reconciliation_receipts (
          reconciliation_id, source_projection_sha256, source_archive_raw_sha256,
          source_archive_session_sha256, receipt_json, receipt_sha256,
          created_sequence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reconciliationId,
        projection.projectionSha256,
        projection.sourceArchive.rawSha256,
        projection.sourceArchive.sourceArchiveSessionSha256,
        receiptJson,
        sha256(receiptJson),
        sequence,
        createdAt
      ]);
      return { receipt: deepFreeze(receipt) };
    });
    if (result.conflict) {
      throw new RouteIqProspectiveCoordinatorConflictError("A changed field-session outcome projection was durably rejected.", {
        conflictId: result.conflict.conflictId,
        overwritePerformed: false,
        priorEvidencePreserved: true
      });
    }
    return result.receipt;
  }

  async admitIntelligenceScoreableOutcome(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "scoreableOutcomeAdmissionRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "scoreable_outcome_admission",
      coordinatorId: this.coordinatorId,
      producer: true
    });
    const claims = normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "scoreable_outcome_admission", [
      "sourceOutcomeEvidenceSha256", "evaluationContextSha256", "outcomeDerivationContractVersion", "observedOutcome"
    ]);
    requireSha(claims.sourceOutcomeEvidenceSha256, "verifiedRuntimeClaims.scoreable_outcome_admission.sourceOutcomeEvidenceSha256");
    requireSha(claims.evaluationContextSha256, "verifiedRuntimeClaims.scoreable_outcome_admission.evaluationContextSha256");
    requireVersion(claims.outcomeDerivationContractVersion, "verifiedRuntimeClaims.scoreable_outcome_admission.outcomeDerivationContractVersion");
    assertExactKeys(claims.observedOutcome, ["status", "value"], "verifiedRuntimeClaims.scoreable_outcome_admission.observedOutcome");
    if (!["observed", "missing"].includes(claims.observedOutcome.status)
      || (claims.observedOutcome.status === "observed" && typeof claims.observedOutcome.value !== "boolean")
      || (claims.observedOutcome.status === "missing" && claims.observedOutcome.value !== null)) {
      fail("route_iq_scoreable_outcome_invalid", "Intelligence scoreable outcome is invalid.");
    }
    const result = this.repository.transactionSync(() => {
      const link = repositoryOne(this.repository, "SELECT * FROM field_session_outcome_links WHERE evidence_sha256 = ?", [claims.sourceOutcomeEvidenceSha256]);
      if (!link) fail("route_iq_scoreable_outcome_source_missing", "Scoreable outcome does not bind admitted field-session evidence.", {}, 409);
      const evaluationContext = readEvaluationContext(this.repository, claims.sourceOutcomeEvidenceSha256);
      if (evaluationContext.row.context_sha256 !== claims.evaluationContextSha256) {
        fail("route_iq_scoreable_outcome_context_mismatch", "Scoreable outcome does not bind the immutable Data evaluation context.", {}, 409);
      }
      const opportunity = getOpportunity(this.repository, link.opportunity_id);
      const session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [opportunity.session_id]);
      const recordTime = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
      const operationClaims = internalOperationClaims({
        scope: this.scope,
        session,
        opportunity,
        purpose: "scoreable_outcome_admission",
        authoritativeRecordTime: recordTime,
        boundary: {
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          outcomeDerivationContractVersion: claims.outcomeDerivationContractVersion
        },
        content: { observedOutcome: claims.observedOutcome }
      });
      const identities = identitiesForClaims(this.coordinatorId, operationClaims);
      const canonicalRequest = {
        sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
        evaluationContextSha256: claims.evaluationContextSha256,
        outcomeDerivationContractVersion: claims.outcomeDerivationContractVersion,
        observedOutcome: clone(claims.observedOutcome),
        candidateId: link.candidate_id,
        actionArtifactId: link.action_artifact_id
      };
      const requestSha256 = sha256(canonicalRequest);
      const existing = existingReceiptDecision(this.repository, {
        identities,
        operationKind: "scoreable_outcome_admission",
        requestSha256,
        claims: operationClaims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      if (opportunity.state !== "ACTION_LINKED" || opportunity.canonical_eligible !== 1) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: operationClaims,
          operationKind: "scoreable_outcome_admission",
          reasonCodes: ["scoreable_outcome_action_binding_invalid"],
          incomingDigest: claims.sourceOutcomeEvidenceSha256,
          canonicalRequest
        });
      }
      const action = latestEvent(this.repository, opportunity.opportunity_id, "ACTION_LINKED");
      if (!action || action.artifactId !== link.action_artifact_id || action.canonical.payload.selectedCandidateId !== link.candidate_id) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: operationClaims,
          operationKind: "scoreable_outcome_admission",
          reasonCodes: ["scoreable_outcome_candidate_binding_invalid"],
          incomingDigest: claims.sourceOutcomeEvidenceSha256,
          canonicalRequest
        });
      }
      insertAttempt(this.repository, {
        identities,
        claims: operationClaims,
        operationKind: "scoreable_outcome_admission",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        opportunityId: opportunity.opportunity_id,
        operationKey: identities.operationKey,
        requestSha256,
        logicalBoundarySha256: operationClaims.canonicalEventBoundarySha256,
        authoritativeRecordTime: recordTime,
        eventKind: "OUTCOME_LINKED",
        artifactKind: "outcome",
        fromState: "ACTION_LINKED",
        toState: "OUTCOME_LINKED",
        payload: {
          evaluatedCandidateId: link.candidate_id,
          actionArtifactId: link.action_artifact_id,
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          outcomeDerivationContractVersion: claims.outcomeDerivationContractVersion,
          observedOutcome: clone(claims.observedOutcome),
          calculatedByData: false,
          unchosenCandidateOutcomeAssignmentAllowed: false
        },
        canonicalEvidenceEligible: true
      });
      updateOpportunityState(this.repository, opportunity.opportunity_id, event, "OUTCOME_LINKED");
      return insertReceipt(this.repository, {
        identities,
        operationKind: "scoreable_outcome_admission",
        requestSha256,
        event,
        state: "OUTCOME_LINKED",
        details: {
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          evaluatedCandidateId: link.candidate_id,
          calculatedByData: false
        }
      });
    });
    return transitionResult(result);
  }

  async admitIntelligenceEvaluation(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "evaluationAdmissionRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "evaluation_admission",
      coordinatorId: this.coordinatorId,
      producer: true
    });
    const claims = normalizeScopeOnlyRuntimeClaims(authority.claims, this.scope, "evaluation_admission", [
      "sourceOutcomeEvidenceSha256", "evaluationContextSha256", "evaluationRecordSha256",
      "evaluationContractVersion", "evaluationRecord"
    ]);
    requireSha(claims.sourceOutcomeEvidenceSha256, "verifiedRuntimeClaims.evaluation_admission.sourceOutcomeEvidenceSha256");
    requireSha(claims.evaluationContextSha256, "verifiedRuntimeClaims.evaluation_admission.evaluationContextSha256");
    requireSha(claims.evaluationRecordSha256, "verifiedRuntimeClaims.evaluation_admission.evaluationRecordSha256");
    if (claims.evaluationContractVersion !== routeIqIntelligenceEvaluationContractVersion) {
      fail("route_iq_evaluation_contract_invalid", "Evaluation contract version is not the admitted Intelligence contract.", {}, 409);
    }
    assertObject(claims.evaluationRecord, "verifiedRuntimeClaims.evaluation_admission.evaluationRecord");
    const result = this.repository.transactionSync(() => {
      const link = repositoryOne(this.repository, "SELECT * FROM field_session_outcome_links WHERE evidence_sha256 = ?", [claims.sourceOutcomeEvidenceSha256]);
      if (!link) fail("route_iq_evaluation_source_missing", "Evaluation does not bind admitted field-session evidence.", {}, 409);
      const evaluationContext = readEvaluationContext(this.repository, claims.sourceOutcomeEvidenceSha256);
      const opportunity = getOpportunity(this.repository, link.opportunity_id);
      const session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [opportunity.session_id]);
      const outcomeEvent = latestEvent(this.repository, opportunity.opportunity_id, "OUTCOME_LINKED");
      if (!outcomeEvent || Date.parse(claims.authoritativeRecordTime) <= Date.parse(outcomeEvent.authoritativeRecordTime)) {
        fail("route_iq_evaluation_chronology_invalid", "Evaluation admission must be strictly later than the admitted outcome.", {}, 409);
      }
      const recordTime = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
      const operationClaims = internalOperationClaims({
        scope: this.scope,
        session,
        opportunity,
        purpose: "evaluation_admission",
        authoritativeRecordTime: recordTime,
        boundary: {
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          evaluationContractVersion: claims.evaluationContractVersion
        },
        content: {
          evaluationRecordSha256: claims.evaluationRecordSha256,
          evaluationRecord: claims.evaluationRecord
        }
      });
      const identities = identitiesForClaims(this.coordinatorId, operationClaims);
      const canonicalRequest = {
        sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
        evaluationContextSha256: claims.evaluationContextSha256,
        evaluationRecordSha256: claims.evaluationRecordSha256,
        evaluationContractVersion: claims.evaluationContractVersion,
        evaluationRecord: clone(claims.evaluationRecord)
      };
      const requestSha256 = sha256(canonicalRequest);
      const existing = existingReceiptDecision(this.repository, {
        identities,
        operationKind: "evaluation_admission",
        requestSha256,
        claims: operationClaims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      if (evaluationContext.row.context_sha256 !== claims.evaluationContextSha256
        || claims.evaluationRecordSha256 !== claims.evaluationRecord.evaluationRecordSha256) {
        fail("route_iq_evaluation_context_mismatch", "Evaluation does not bind the immutable Data evaluation context and record hash.", {}, 409);
      }
      if (opportunity.state !== "OUTCOME_LINKED" || opportunity.canonical_eligible !== 1) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: operationClaims,
          operationKind: "evaluation_admission",
          reasonCodes: ["evaluation_outcome_binding_invalid"],
          incomingDigest: claims.evaluationRecordSha256,
          canonicalRequest
        });
      }
      if (outcomeEvent.canonical.payload?.sourceOutcomeEvidenceSha256 !== claims.sourceOutcomeEvidenceSha256
        || outcomeEvent.canonical.payload?.evaluationContextSha256 !== claims.evaluationContextSha256
        || outcomeEvent.canonical.payload?.evaluatedCandidateId !== link.candidate_id
        || outcomeEvent.canonical.payload?.actionArtifactId !== link.action_artifact_id) {
        fail("route_iq_evaluation_outcome_binding_invalid", "Evaluation does not bind the canonical admitted outcome.", {}, 409);
      }
      const committedProjection = repositoryOne(this.repository, `
        SELECT p.projection_id, p.projection_sha256, p.as_of_record_sequence, p.as_of_record_time,
               c.commit_id
        FROM projection_outbox o
        JOIN projection_artifacts p ON p.outbox_id = o.outbox_id
        JOIN projection_commits c ON c.outbox_id = o.outbox_id AND c.projection_id = p.projection_id
        WHERE o.source_artifact_id = ?
      `, [outcomeEvent.artifactId]);
      if (!committedProjection) {
        fail("route_iq_evaluation_projection_commit_missing", "The admitted outcome projection must be committed before evaluation.", {}, 409);
      }
      const reconciliation = repositoryOne(this.repository, `
        SELECT created_at FROM field_session_reconciliation_receipts
        WHERE source_projection_sha256 = ?
      `, [link.source_projection_sha256]);
      if (!reconciliation) {
        fail("route_iq_evaluation_reconciliation_missing", "The source reconciliation receipt is unavailable.", {}, 500);
      }
      const context = evaluationContext.context;
      const expected = {
        scope: this.scope,
        context,
        contextSha256: evaluationContext.row.context_sha256,
        outcomeEvent,
        sourceProjection: {
          projectionId: committedProjection.projection_id,
          projectionCommitId: committedProjection.commit_id,
          projectionSha256: committedProjection.projection_sha256,
          asOfRecordSequence: Number(committedProjection.as_of_record_sequence),
          asOfRecordTime: committedProjection.as_of_record_time
        },
        chronology: {
          snapshotAcceptedAt: context.acceptedSnapshotManifest.acceptedAt,
          shadowSealedAt: context.shadowDecision.sealedAt,
          actionLinkedAt: context.action.linkedAt,
          visitActionEventTime: link.visit_event_time,
          archiveCommittedAt: link.archive_committed_at,
          fieldEvidenceLinkedAt: link.linked_at,
          reconciledAt: reconciliation.created_at,
          outcomeAdmittedAt: outcomeEvent.authoritativeRecordTime
        }
      };
      const evaluationRecord = validateFullIntelligenceEvaluationRecord(claims.evaluationRecord, expected);
      insertAttempt(this.repository, {
        identities,
        claims: operationClaims,
        operationKind: "evaluation_admission",
        requestSha256,
        canonicalRequest
      });
      const event = appendLifecycleEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        opportunityId: opportunity.opportunity_id,
        operationKey: identities.operationKey,
        requestSha256,
        logicalBoundarySha256: operationClaims.canonicalEventBoundarySha256,
        authoritativeRecordTime: recordTime,
        eventKind: "EVALUATED",
        artifactKind: "evaluation",
        fromState: "OUTCOME_LINKED",
        toState: "EVALUATED",
        payload: {
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          evaluationRecordSha256: claims.evaluationRecordSha256,
          evaluationContractVersion: claims.evaluationContractVersion,
          evaluationRecord: clone(evaluationRecord),
          fullEvaluationPersisted: true,
          calculatedByData: false,
          recommendationInfluence: "off"
        },
        canonicalEvidenceEligible: true
      });
      updateOpportunityState(this.repository, opportunity.opportunity_id, event, "EVALUATED");
      return insertReceipt(this.repository, {
        identities,
        operationKind: "evaluation_admission",
        requestSha256,
        event,
        state: "EVALUATED",
        details: {
          sourceOutcomeEvidenceSha256: claims.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: claims.evaluationContextSha256,
          evaluationRecordSha256: claims.evaluationRecordSha256,
          fullEvaluationPersisted: true,
          calculatedByData: false
        }
      });
    });
    return transitionResult(result);
  }

  async allocateNextStopOpportunity(input = {}) {
    this.assertInput(input, ["event"], "serverAllocatorRequest");
    const event = normalizeInformationalBrowserEvent(input.event);
    const result = this.repository.transactionSync(() => {
      let session = activeCanonicalSession(this.repository);
      if (!session) {
        const openedAt = nextMonotonicCoordinatorTime(this.repository, this.scope.issuedAt);
        session = createCanonicalSession(this.repository, {
          coordinatorId: this.coordinatorId,
          scope: this.scope,
          authoritativeRecordTime: openedAt
        });
      }

      const current = currentAllocatedOpportunity(this.repository, session.session_id);
      if (current) {
        if (isAllocationOpenState(current.state)) {
          return allocationReceiptForOpportunity(this.repository, current.opportunity_id, {
            requestedTime: this.scope.issuedAt,
            event
          });
        }
        if (current.state === "EXCLUDED") {
          if (!authenticatedMaterialManifestRotationAllowed(this.repository, current.opportunity_id)) {
            return allocationReceiptForOpportunity(this.repository, current.opportunity_id, {
              requestedTime: this.scope.issuedAt,
              event
            });
          }
        } else if (!["ACTION_LINKED", "OUTCOME_LINKED", "EVALUATED"].includes(current.state)) {
          fail("route_iq_server_allocator_prior_lifecycle_incomplete", "A new next_stop opportunity requires a trusted linked action or later lifecycle state.", {
            priorState: current.state
          }, 409);
        }
      }

      const allocatedAt = nextMonotonicCoordinatorTime(this.repository, this.scope.issuedAt);
      return createServerAllocatedOpportunity(this.repository, {
        coordinatorId: this.coordinatorId,
        scope: this.scope,
        scopeAuthority: this.scopeAuthority,
        session,
        authoritativeRecordTime: allocatedAt,
        event
      });
    });
    return transitionResult(result);
  }

  async closeCanonicalSession(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "serverSessionCloseRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "close_session",
      coordinatorId: this.coordinatorId
    });
    const claims = normalizeSessionCloseClaims(authority.claims, this.scope);
    const logicalClaims = clone(claims);
    delete logicalClaims.authoritativeRecordTime;
    const requestSha256 = sha256({
      allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
      logicalClaims,
      authority: {
        verificationType: authority.verificationType,
        keyId: authority.keyId,
        algorithm: authority.algorithm
      }
    });
    const result = this.repository.transactionSync(() => {
      const existing = repositoryOne(this.repository, `
        SELECT * FROM canonical_session_events
        WHERE event_kind = 'CLOSED' AND request_sha256 = ?
      `, [requestSha256]);
      if (existing) return parseSessionEventReceipt(existing);

      const session = activeCanonicalSession(this.repository);
      if (!session) {
        fail("route_iq_server_allocator_active_session_missing", "No active canonical field session is available to close.", {}, 409);
      }
      const current = currentAllocatedOpportunity(this.repository, session.session_id);
      if (current && isAllocationOpenState(current.state)) {
        const exclusionAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
        const exclusionClaims = {
          purpose: "allocator_session_close",
          workspaceId: this.scope.workspaceId,
          operatingProfileId: this.scope.operatingProfileId,
          representativeId: this.scope.representativeId,
          territoryId: current.territory_id,
          canonicalSessionRecordSha256: current.canonical_session_record_sha256,
          sessionEventSequence: Number(session.session_event_sequence),
          opportunityEventSequence: Number(current.opportunity_event_sequence),
          triggerRecordSha256: current.trigger_record_sha256,
          canonicalEventBoundarySha256: sha256({
            endOfDayHandoffSha256: claims.endOfDayHandoffSha256,
            opportunityId: current.opportunity_id
          }),
          clientEventSequence: 0,
          clientContentSha256: sha256({ closeReason: claims.closeReason }),
          authoritativeRecordTime: exclusionAt,
          recordOrigin: "prospective",
          uncertainChronology: false
        };
        const identities = identitiesForClaims(this.coordinatorId, exclusionClaims);
        const exclusion = persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities,
          claims: exclusionClaims,
          operationKind: "allocator_session_close",
          reasonCodes: ["session_closed_before_lifecycle_complete"],
          incomingDigest: requestSha256,
          canonicalRequest: {
            allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
            closeRequestSha256: requestSha256
          }
        });
        if (exclusion?.conflictDecision) return { conflictDecision: exclusion.conflictDecision };
      }

      const closedAt = nextMonotonicCoordinatorTime(this.repository, claims.authoritativeRecordTime);
      const eventId = `riq_session_event_${sha256({
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        eventKind: "CLOSED",
        requestSha256
      })}`;
      const receipt = {
        allocatorContractVersion: routeIqProspectiveServerAllocatorContractVersion,
        status: "closed",
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        closeEventId: eventId,
        closeReason: claims.closeReason,
        requestSha256,
        authoritativeRecordTime: closedAt,
        priorEvidencePreserved: true,
        recommendationInfluence: "off",
        collectionDefault: "off"
      };
      appendCanonicalSessionEvent(this.repository, {
        coordinatorId: this.coordinatorId,
        sessionId: session.session_id,
        eventKind: "CLOSED",
        requestSha256,
        authoritativeRecordTime: closedAt,
        payload: {
          closeReason: claims.closeReason,
          handoffContractVersion: claims.handoffContractVersion,
          endOfDayHandoffSha256: claims.endOfDayHandoffSha256,
          priorEvidencePreserved: true
        },
        receipt
      });
      return deepFreeze(receipt);
    });
    return transitionResult(result);
  }

  async trigger(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "triggerRequest");
    const { authority, claims, identities } = await this.verifyOperation(input.authorityEnvelope, "trigger");
    const canonicalRequest = canonicalRequestForClaims(claims, authority);
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      let opportunity = getOpportunity(this.repository, identities.opportunityId);
      if (opportunity) {
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
      }

      let session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [identities.sessionId]);
      if (!session) {
        const activeSession = activeCanonicalSession(this.repository);
        if (activeSession && activeSession.session_id !== identities.sessionId) {
          fail("route_iq_coordinator_second_open_session_prohibited", "The retained trigger path cannot create a second open canonical field session.", {
            activeSessionId: activeSession.session_id,
            requestedSessionId: identities.sessionId
          }, 409);
        }
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
        const scopeTerritory = allocatorTerritoryContext(this.scope);
        persistCanonicalSessionContext(this.repository, {
          sessionId: identities.sessionId,
          territoryContext: scopeTerritory.status === "known" && scopeTerritory.territoryId === claims.territoryId
            ? scopeTerritory
            : {
                status: "legacy_unavailable",
                territoryId: claims.territoryId,
                sourceRecordSha256: null,
                sourceContractVersion: null,
                availableAt: null
              }
        });
        session = repositoryOne(this.repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [identities.sessionId]);
      } else if (session.coordinator_id !== this.coordinatorId
        || session.canonical_session_record_sha256 !== claims.canonicalSessionRecordSha256
        || session.territory_id !== claims.territoryId
        || Number(session.session_event_sequence) !== claims.sessionEventSequence) {
        fail("route_iq_coordinator_session_identity_conflict", "Canonical session sequence resolved to changed server evidence.", {}, 409);
      }

      if (!opportunity) {
        repositoryRows(this.repository, `
          INSERT INTO opportunities (
            opportunity_id, coordinator_id, session_id, canonical_session_record_sha256,
            territory_id, opportunity_type,
            opportunity_event_sequence, trigger_record_sha256, trigger_boundary_sha256,
            state, canonical_eligible, current_manifest_sha256, last_record_sequence, last_record_time
          ) VALUES (?, ?, ?, ?, ?, 'next_stop', ?, ?, ?, 'TRIGGERED', 1, NULL, 0, NULL)
        `, [
          identities.opportunityId,
          this.coordinatorId,
          identities.sessionId,
          claims.canonicalSessionRecordSha256,
          claims.territoryId,
          claims.opportunityEventSequence,
          claims.triggerRecordSha256,
          claims.canonicalEventBoundarySha256
        ]);
        opportunity = getOpportunity(this.repository, identities.opportunityId);
      } else {
        assertOpportunityIdentity(opportunity, identities, claims);
      }
      assertMonotonicRecordTime(opportunity, claims);

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
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: "candidate_manifest",
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      assertMonotonicRecordTime(opportunity, verified.claims);
      if (opportunity.territory_id === unknownAllocatorTerritoryId()) {
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: "candidate_manifest",
          reasonCodes: ["territory_context_unavailable"],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      const priorManifest = repositoryOne(this.repository, `
        SELECT * FROM candidate_manifests WHERE opportunity_id = ?
      `, [verified.identities.opportunityId]);
      if (priorManifest) {
        if (priorManifest.complete_manifest_sha256 === manifest.completeManifestSha256) {
          const priorReceipt = repositoryOne(this.repository, `
            SELECT * FROM operation_receipts
            WHERE opportunity_id = ? AND operation_kind = 'candidate_manifest'
            ORDER BY created_sequence ASC
            LIMIT 1
          `, [verified.identities.opportunityId]);
          if (!priorReceipt) fail("route_iq_candidate_manifest_receipt_missing", "Canonical candidate-manifest receipt is missing.", {}, 500);
          return receiptFromRow(priorReceipt);
        }
        return persistExclusion(this.repository, {
          coordinatorId: this.coordinatorId,
          identities: verified.identities,
          claims: verified.claims,
          operationKind: "candidate_manifest",
          reasonCodes: ["candidate_manifest_materially_changed"],
          incomingDigest: requestSha256,
          requestSha256Override: requestSha256,
          canonicalRequest
        });
      }
      const exclusionReason = stateReason(opportunity, "TRIGGERED") || originReason(opportunity, verified.claims);
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
      if (!opportunity || opportunity.session_id !== verified.identities.sessionId) {
        fail("route_iq_coordinator_opportunity_identity_mismatch", "Verified claims do not resolve to the canonical opportunity.", {}, 409);
      }
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
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      assertMonotonicRecordTime(opportunity, verified.claims);
      const exclusionReason = stateReason(opportunity, config.expectedState) || originReason(opportunity, verified.claims);
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
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: "correction",
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      assertMonotonicRecordTime(opportunity, verified.claims);
      let exclusionReason = opportunity.canonical_eligible !== 1 || opportunity.state === "EXCLUDED"
        ? "opportunity_permanently_excluded"
        : null;
      if (!exclusionReason && !["OUTCOME_LINKED", "EVALUATED"].includes(opportunity.state)) exclusionReason = "invalid_state_transition";
      if (!exclusionReason) exclusionReason = originReason(opportunity, verified.claims);
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
    const canonicalRequest = canonicalRequestForClaims(verified.claims, verified.authority);
    const requestSha256 = sha256(canonicalRequest);
    const result = this.repository.transactionSync(() => {
      const opportunity = getOpportunity(this.repository, verified.identities.opportunityId);
      const existing = existingReceiptDecision(this.repository, {
        identities: verified.identities,
        operationKind: config.operationKind,
        requestSha256,
        claims: verified.claims,
        canonicalRequest
      });
      if (existing?.type === "retry") return existing.receipt;
      if (existing?.type === "conflict") return { conflictDecision: existing };
      assertOpportunityIdentity(opportunity, verified.identities, verified.claims);
      assertMonotonicRecordTime(opportunity, verified.claims);
      const customReason = config.validate ? config.validate(this.repository) : null;
      const exclusionReason = stateReason(opportunity, config.expectedState)
        || originReason(opportunity, verified.claims)
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

  async readCommittedProjectionForOutcomeArtifact(input = {}) {
    this.assertInput(input, ["authorityEnvelope"], "outcomeProjectionReadRequest");
    const authority = await verifyEnvelope(this.authorityVerifier, input.authorityEnvelope, {
      purpose: "committed_outcome_projection_read",
      coordinatorId: this.coordinatorId,
      producer: true
    });
    const claims = normalizeOutcomeProjectionReadClaims(authority.claims, this.scope);
    return this.repository.transactionSync(() => readCommittedProjectionForOutcomeArtifact(
      this.repository,
      this.scope,
      this.coordinatorId,
      claims
    ));
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

function normalizeOutcomeProjectionReadClaims(claims, scope) {
  const normalized = normalizeScopeOnlyRuntimeClaims(
    claims,
    scope,
    "committed_outcome_projection_read",
    ["sourceOutcomeEvidenceSha256", "outcomeReceipt"]
  );
  requireSha(
    normalized.sourceOutcomeEvidenceSha256,
    "verifiedRuntimeClaims.committed_outcome_projection_read.sourceOutcomeEvidenceSha256"
  );
  assertObject(
    normalized.outcomeReceipt,
    "verifiedRuntimeClaims.committed_outcome_projection_read.outcomeReceipt"
  );
  return normalized;
}

function projectionEvidenceKind(eventKind) {
  return {
    SNAPSHOT_PENDING_SEAL: "prospective_opportunity_snapshot",
    ACTION_LINKED: "prospective_opportunity_action",
    OUTCOME_LINKED: "prospective_opportunity_outcome",
    EVALUATED: "prospective_opportunity_evaluation",
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
    scope: canonicalEvaluationScope(scope),
    canonicalSessionRecordSha256: opportunity.canonical_session_record_sha256,
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
  assertExactKeys(
    projection.scope,
    ["workspaceId", "operatingProfileId", "representativeId"],
    "coordinatorProjection.scope"
  );
  if (projection.projectionVersion !== routeIqProspectiveCoordinatorProjectionVersion
    || projection.authority !== "sqlite_durable_object_coordinator"
    || typeof projection.canonicalSessionRecordSha256 !== "string"
    || !SHA256_PATTERN.test(projection.canonicalSessionRecordSha256)
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

function verifiedCommittedProjectionRecord(row, scope, coordinatorId) {
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
    projection: clone(projection),
    commit: { ...commitBody, commitSha256: row.commit_sha256 }
  });
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
    || opportunity.canonical_session_record_sha256 !== claims.canonicalSessionRecordSha256
    || opportunity.trigger_record_sha256 !== claims.triggerRecordSha256
    || opportunity.territory_id !== claims.territoryId) {
    fail("route_iq_coordinator_projection_opportunity_mismatch", "Projection read attestation does not resolve to the canonical opportunity.", {}, 403);
  }
  const inconsistentBoundary = repositoryOne(repository, `
    SELECT artifact_id, record_sequence, authoritative_record_time
    FROM lifecycle_events
    WHERE opportunity_id = ?
      AND (
        (record_sequence <= ? AND authoritative_record_time > ?)
        OR (record_sequence > ? AND authoritative_record_time <= ?)
      )
    ORDER BY record_sequence ASC
    LIMIT 1
  `, [
    identities.opportunityId,
    claims.asOfRecordSequence,
    claims.asOfRecordTime,
    claims.asOfRecordSequence,
    claims.asOfRecordTime
  ]);
  if (inconsistentBoundary) {
    fail("route_iq_coordinator_projection_as_of_mismatch", "As-of record sequence and authoritative time must identify the same canonical history prefix.", {
      conflictingArtifactId: inconsistentBoundary.artifact_id,
      conflictingRecordSequence: Number(inconsistentBoundary.record_sequence),
      conflictingRecordTime: inconsistentBoundary.authoritative_record_time
    }, 409);
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
  const committed = verifiedCommittedProjectionRecord(row, scope, coordinatorId);
  return deepFreeze({
    ok: true,
    found: true,
    record: {
      schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
      authority: "sqlite_durable_object_coordinator",
      ...committed
    }
  });
}

function readCommittedProjectionForOutcomeArtifact(repository, scope, coordinatorId, claims) {
  const suppliedReceipt = claims.outcomeReceipt;
  requireHashId(
    suppliedReceipt.artifactId,
    "outcome",
    "verifiedRuntimeClaims.committed_outcome_projection_read.outcomeReceipt.artifactId"
  );
  const eventRow = repositoryOne(repository, `
    SELECT e.*, r.artifact_kind AS registry_artifact_kind
    FROM lifecycle_events e
    JOIN artifact_registry r ON r.artifact_id = e.artifact_id
    WHERE e.artifact_id = ?
  `, [suppliedReceipt.artifactId]);
  if (!eventRow) {
    fail("route_iq_exact_outcome_projection_source_missing", "The admitted outcome artifact is unavailable in this coordinator.", {}, 409);
  }
  const event = eventFromRow(eventRow);
  if (eventRow.registry_artifact_kind !== "outcome"
    || event.artifactKind !== "outcome"
    || event.eventKind !== "OUTCOME_LINKED"
    || event.canonical.canonicalEvidenceEligible !== true
    || event.canonical.recommendationInfluence !== "off") {
    fail("route_iq_exact_outcome_projection_source_invalid", "The source artifact is not an admitted canonical outcome.", {}, 409);
  }
  const opportunity = getOpportunity(repository, event.canonical.opportunityId);
  const session = opportunity
    ? repositoryOne(repository, "SELECT * FROM canonical_sessions WHERE session_id = ?", [opportunity.session_id])
    : null;
  if (!opportunity
    || !session
    || opportunity.coordinator_id !== coordinatorId
    || event.canonical.coordinatorId !== coordinatorId
    || event.canonical.sessionId !== session.session_id
    || opportunity.canonical_session_record_sha256 !== session.canonical_session_record_sha256
    || opportunity.canonical_eligible !== 1
    || !["OUTCOME_LINKED", "EVALUATED"].includes(opportunity.state)) {
    fail("route_iq_exact_outcome_projection_scope_invalid", "The admitted outcome does not resolve to an eligible canonical coordinator state.", {}, 409);
  }
  const receiptRow = repositoryOne(repository, `
    SELECT * FROM operation_receipts
    WHERE operation_key = ? AND opportunity_id = ? AND operation_kind = 'scoreable_outcome_admission'
  `, [event.canonical.operationKey, opportunity.opportunity_id]);
  if (!receiptRow) {
    fail("route_iq_exact_outcome_projection_receipt_missing", "The admitted outcome receipt is unavailable.", {}, 409);
  }
  const storedReceipt = receiptFromRow(receiptRow);
  const suppliedReceiptJson = canonicalText(suppliedReceipt);
  if (sha256(suppliedReceiptJson) !== receiptRow.receipt_sha256
    || stableJson(storedReceipt) !== suppliedReceiptJson
    || storedReceipt.artifactId !== event.artifactId
    || storedReceipt.recordSha256 !== event.recordSha256
    || storedReceipt.recordSequence !== event.recordSequence
    || storedReceipt.authoritativeRecordTime !== event.authoritativeRecordTime
    || storedReceipt.coordinatorId !== coordinatorId
    || storedReceipt.sessionId !== session.session_id
    || storedReceipt.opportunityId !== opportunity.opportunity_id
    || storedReceipt.state !== "OUTCOME_LINKED"
    || storedReceipt.recommendationInfluence !== "off"
    || storedReceipt.collectionDefault !== "off"
    || storedReceipt.sourceOutcomeEvidenceSha256 !== claims.sourceOutcomeEvidenceSha256
    || event.canonical.payload?.sourceOutcomeEvidenceSha256 !== claims.sourceOutcomeEvidenceSha256) {
    fail("route_iq_exact_outcome_projection_receipt_binding_invalid", "The producer authority does not bind the exact admitted outcome receipt.", {}, 409);
  }
  const sourceLink = repositoryOne(repository, `
    SELECT * FROM field_session_outcome_links
    WHERE evidence_sha256 = ? AND opportunity_id = ?
  `, [claims.sourceOutcomeEvidenceSha256, opportunity.opportunity_id]);
  if (!sourceLink
    || sourceLink.action_artifact_id !== event.canonical.payload?.actionArtifactId
    || sourceLink.candidate_id !== event.canonical.payload?.evaluatedCandidateId) {
    fail("route_iq_exact_outcome_projection_evidence_binding_invalid", "The admitted outcome does not bind exact canonical field-session evidence.", {}, 409);
  }
  const evaluationContext = readEvaluationContext(repository, claims.sourceOutcomeEvidenceSha256);
  if (evaluationContext.row.opportunity_id !== opportunity.opportunity_id
    || evaluationContext.row.context_sha256 !== event.canonical.payload?.evaluationContextSha256
    || evaluationContext.context.recommendationInfluence !== "off") {
    fail("route_iq_exact_outcome_projection_context_binding_invalid", "The admitted outcome does not bind its immutable evaluation context.", {}, 409);
  }
  const outbox = repositoryOne(repository, `
    SELECT o.*, c.commit_id
    FROM projection_outbox o
    LEFT JOIN projection_commits c ON c.outbox_id = o.outbox_id
    WHERE o.source_artifact_id = ? AND o.opportunity_id = ?
  `, [event.artifactId, opportunity.opportunity_id]);
  if (!outbox) {
    fail("route_iq_exact_outcome_projection_outbox_missing", "The admitted outcome recovery instruction is unavailable.", {}, 409);
  }
  if (!outbox.commit_id) {
    fail("route_iq_coordinator_projection_recovery_pending", "The exact admitted outcome projection is not committed yet.", {
      outboxId: outbox.outbox_id,
      sourceRecordSequence: Number(outbox.source_record_sequence)
    }, 409);
  }
  const row = repositoryOne(repository, `
    SELECT p.*, c.commit_id, c.projection_id AS commit_projection_id,
      c.outbox_id AS commit_outbox_id, c.status,
      c.projection_sha256 AS commit_projection_sha256,
      c.committed_sequence, c.committed_at, c.commit_sha256,
      projection_registry.artifact_kind AS projection_registry_kind,
      commit_registry.artifact_kind AS commit_registry_kind
    FROM projection_outbox o
    JOIN projection_artifacts p ON p.outbox_id = o.outbox_id
    JOIN projection_commits c ON c.outbox_id = o.outbox_id AND c.projection_id = p.projection_id
    JOIN artifact_registry projection_registry ON projection_registry.artifact_id = p.projection_id
    JOIN artifact_registry commit_registry ON commit_registry.artifact_id = c.commit_id
    WHERE o.source_artifact_id = ? AND o.opportunity_id = ?
  `, [event.artifactId, opportunity.opportunity_id]);
  if (!row) {
    fail("route_iq_exact_outcome_projection_commit_missing", "The exact admitted outcome projection commit is unavailable.", {}, 409);
  }
  const committed = verifiedCommittedProjectionRecord(row, scope, coordinatorId);
  const exactSource = committed.projection.sourceArtifacts.filter(source => source.artifactId === event.artifactId);
  const exactEvidence = committed.projection.evidence.filter(evidence => evidence.sourceRecordId === event.artifactId);
  if (committed.projection.opportunityId !== opportunity.opportunity_id
    || committed.projection.canonicalSessionRecordSha256 !== session.canonical_session_record_sha256
    || committed.projection.asOfRecordSequence !== event.recordSequence
    || committed.projection.asOfRecordTime !== event.authoritativeRecordTime
    || committed.projection.state !== "OUTCOME_LINKED"
    || committed.projection.readinessEvidenceEligible !== true
    || committed.projection.exclusions.length !== 0
    || committed.projection.recommendationInfluence !== "off"
    || committed.projection.collectionDefault !== "off"
    || exactSource.length !== 1
    || exactSource[0].artifactKind !== "outcome"
    || exactSource[0].eventKind !== "OUTCOME_LINKED"
    || exactSource[0].recordSequence !== event.recordSequence
    || exactSource[0].authoritativeRecordTime !== event.authoritativeRecordTime
    || exactSource[0].recordSha256 !== event.recordSha256
    || exactEvidence.length !== 1
    || exactEvidence[0].evidenceKind !== "prospective_opportunity_outcome"
    || exactEvidence[0].recordSha256 !== event.recordSha256) {
    fail("route_iq_exact_outcome_projection_binding_invalid", "The committed projection does not contain the exact admitted outcome artifact.", {}, 500);
  }
  return deepFreeze({
    ok: true,
    found: true,
    contractVersion: routeIqCommittedOutcomeProjectionReadContractVersion,
    producerOnly: true,
    record: committed
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
    scopeAuthority,
    scope,
    coordinatorId
  });
}
