import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  routeIqRetentionAdministrativeDispositionTarget
} from "../route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  getCommercialWorkspace,
  loadCommercialWorkspaceRegistry,
  routeIqFounderResearchClassification
} from "./route-iq-commercial-workspace-registry.mjs";

export const routeIqGovernedCodexEvidenceBundleVersion = "route-iq-governed-codex-evidence-bundle-v1";
export const routeIqGovernedCodexEvidenceProjectionVersion = "route-iq-codex-allowlist-projection-v1";
export const routeIqGovernedCodexEvidenceRedactionStatus = "REDACTED_ALLOWLIST_ONLY";

const defaultRepoRoot = resolve(import.meta.dirname, "../..");
const preservationManifestPath = "data/route-iq-commercial-readiness-v1/fitness-connection-evidence-preservation-v1.json";
const FORBIDDEN_RECORD_FIELDS = new Set([
  "name",
  "displayName",
  "address",
  "street",
  "email",
  "phone",
  "notes",
  "contact",
  "manager",
  "gps",
  "latitude",
  "longitude",
  "placeName",
  "googlePlaceId"
]);

export class RouteIqGovernedCodexEvidenceError extends Error {
  constructor(message, code = "route_iq_governed_codex_evidence_invalid", details = {}) {
    super(message);
    this.name = "RouteIqGovernedCodexEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqGovernedCodexEvidenceError(message, code, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stablePrettyJson(value) {
  const canonical = JSON.parse(stableJson(value));
  return `${JSON.stringify(canonical, null, 2)}\n`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listFilesRecursively(root, repoRoot) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    if (entry.isSymbolicLink()) fail("route_iq_evidence_symlink_rejected", "Governed evidence cannot be read through a symbolic link.");
    if (entry.isDirectory()) files.push(...listFilesRecursively(absolute, repoRoot));
    else if (entry.isFile()) files.push(relative(repoRoot, absolute));
  }
  return files;
}

function expectedFounderEvidencePaths(repoRoot) {
  const workspaceRoot = resolve(repoRoot, "data/route-iq-field-sessions-v1/workspaces/fitness_connection");
  return [
    ...listFilesRecursively(workspaceRoot, repoRoot),
    "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json",
    "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/founder-field-evidence.json",
    "data/qualified-prospects/google-qualified-businesses-v2/commercial-center-intelligence-v1/source-evidence/founder-july-11-commercial-center-observations.json"
  ].sort();
}

export function loadFitnessConnectionEvidencePreservationManifest(repoRoot = defaultRepoRoot) {
  return readJson(resolve(repoRoot, preservationManifestPath));
}

export function verifyFitnessConnectionEvidencePreservation(options = {}) {
  const repoRoot = resolve(options.repoRoot || defaultRepoRoot);
  const manifest = options.manifest || loadFitnessConnectionEvidencePreservationManifest(repoRoot);
  if (manifest.manifestVersion !== "fitness-connection-evidence-preservation-v1"
    || manifest.workspaceId !== "fitness_connection"
    || manifest.operatingProfileId !== "fitness"
    || manifest.classification !== routeIqFounderResearchClassification
    || manifest.relationshipRepresentation?.customer !== false
    || manifest.relationshipRepresentation?.partner !== false
    || manifest.relationshipRepresentation?.sponsor !== false
    || manifest.relationshipRepresentation?.committedPilot !== false
    || manifest.relationshipRepresentation?.publicEndorsementClaimAllowed !== false
    || !Array.isArray(manifest.files)) {
    fail("route_iq_evidence_preservation_manifest_invalid", "Fitness Connection preservation manifest is invalid.");
  }
  const expectedPaths = expectedFounderEvidencePaths(repoRoot);
  const declaredPaths = manifest.files.map(file => file.path).sort();
  if (stableJson(expectedPaths) !== stableJson(declaredPaths)) {
    fail("route_iq_evidence_preservation_scope_drift", "Founder field evidence path scope changed.", {
      expectedFileCount: expectedPaths.length,
      declaredFileCount: declaredPaths.length
    });
  }
  const verifiedFiles = manifest.files.map(file => {
    if (!file || typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isInteger(file.byteLength) || file.byteLength < 1) {
      fail("route_iq_evidence_preservation_entry_invalid", "Evidence preservation entry is invalid.");
    }
    const absolute = resolve(repoRoot, file.path);
    if (!absolute.startsWith(`${repoRoot}/`) || lstatSync(absolute).isSymbolicLink() || !statSync(absolute).isFile()) {
      fail("route_iq_evidence_preservation_path_invalid", "Evidence preservation path is invalid.");
    }
    const bytes = readFileSync(absolute);
    const actual = { byteLength: bytes.byteLength, sha256: sha256(bytes) };
    if (actual.byteLength !== file.byteLength || actual.sha256 !== file.sha256) {
      fail("route_iq_evidence_preservation_hash_mismatch", "Founder field evidence bytes changed.", {
        path: file.path,
        expectedByteLength: file.byteLength,
        actualByteLength: actual.byteLength,
        expectedSha256: file.sha256,
        actualSha256: actual.sha256
      });
    }
    return { path: file.path, ...actual };
  });
  const boundary = manifest.accidentalArchiveBoundary;
  if (boundary.sessionId !== routeIqRetentionAdministrativeDispositionTarget.sessionId
    || boundary.rawSha256 !== routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256
    || boundary.protectedArtifactCount !== routeIqRetentionAdministrativeDispositionTarget.protectedArtifactCount
    || boundary.reason !== routeIqRetentionAdministrativeDispositionTarget.reason
    || boundary.state !== routeIqRetentionAdministrativeDispositionTarget.state
    || boundary.rawByteLength !== 560
    || boundary.repositoryRawRecordPresence !== "NOT_STORED_IN_REPOSITORY"
    || boundary.productionDispositionVerification !== "NOT_READ_IN_THIS_BATCH") {
    fail("route_iq_accidental_archive_boundary_drift", "Accidental archive preservation boundary changed.");
  }
  if (manifest.invariants?.sourceFilesMayBeRewritten !== false
    || manifest.invariants?.historicalReplayAuthorized !== false
    || manifest.invariants?.productionMutationAuthorized !== false
    || manifest.invariants?.recommendationInfluence !== "OFF"
    || manifest.invariants?.prospectiveCollection !== "OFF"
    || manifest.invariants?.crossWorkspaceUseAllowed !== false) {
    fail("route_iq_evidence_preservation_invariant_invalid", "Evidence preservation invariants changed.");
  }
  return Object.freeze({
    status: "PRESERVED_BYTE_IDENTICAL",
    workspaceId: manifest.workspaceId,
    operatingProfileId: manifest.operatingProfileId,
    classification: manifest.classification,
    fileCount: verifiedFiles.length,
    files: Object.freeze(verifiedFiles.map(Object.freeze)),
    aggregateSha256: sha256(stableJson(verifiedFiles)),
    accidentalArchiveBoundary: Object.freeze({ ...boundary })
  });
}

function canonicalTimestamp(value, scope) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || new Date(value).toISOString() !== value) {
    fail("route_iq_codex_evidence_time_invalid", `${scope} must be a canonical UTC timestamp.`);
  }
  return value;
}

function findPreservedPath(preservation, suffix) {
  const match = preservation.files.find(file => file.path.endsWith(suffix));
  if (!match) fail("route_iq_codex_evidence_source_missing", `Required governed source is missing: ${suffix}`);
  return match.path;
}

function findForbiddenRecordField(value, path = "authorizedRecords") {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenRecordField(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RECORD_FIELDS.has(key)) return `${path}.${key}`;
    const found = findForbiddenRecordField(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function visitProjection(visit, context) {
  const source = visit?.sourceReport || {};
  const identity = visit?.governedBusinessIdentity || {};
  const hours = visit?.governedHoursSnapshot || {};
  const occurredAt = canonicalTimestamp(source.timestamp, "Visit timestamp");
  const businessIdentity = identity.googlePlaceId || identity.runtimeId;
  if (typeof businessIdentity !== "string" || !businessIdentity) {
    fail("route_iq_codex_evidence_business_identity_missing", "Governed visit identity is missing.");
  }
  return {
    recordId: visit.visitId,
    recordType: "governed_field_visit_projection",
    workspaceId: context.workspace.workspaceId,
    operatingProfileId: context.workspace.operatingProfileId,
    sessionId: context.session.sessionId,
    representativeRef: context.representative.analysisPseudonym,
    occurredAt,
    timeWindow: source.timeWindow || null,
    businessRef: `riq_business_${sha256(`${context.workspace.workspaceId}:${businessIdentity}`)}`,
    businessCategory: identity.category || "unknown",
    outcome: source.outcome || "unknown",
    counts: {
      conversations: Number.isInteger(source.conversations) && source.conversations >= 0 ? source.conversations : null,
      leads: Number.isInteger(source.leads) && source.leads >= 0 ? source.leads : null,
      units: Number.isInteger(source.units) && source.units >= 0 ? source.units : null,
      laterUnits: Number.isInteger(source.laterUnits) && source.laterUnits >= 0 ? source.laterUnits : null
    },
    businessHours: {
      status: hours.status || "UNKNOWN",
      confidence: hours.confidence || "UNKNOWN",
      freshnessStatus: hours.freshnessStatus || "UNKNOWN"
    },
    sourceEvidence: {
      archiveRawSha256: context.session.rawSha256,
      sourceFinality: context.session.sourceFinality
    }
  };
}

function dataQuality(records) {
  const missingTimestampCount = records.filter(record => !record.occurredAt).length;
  const unknownOutcomeCount = records.filter(record => record.outcome === "unknown").length;
  const unknownBusinessCategoryCount = records.filter(record => record.businessCategory === "unknown").length;
  const nullCountFieldCount = records.reduce((count, record) => (
    count + Object.values(record.counts).filter(value => value === null).length
  ), 0);
  return {
    status: missingTimestampCount || unknownOutcomeCount
      ? "REVIEW_REQUIRED"
      : "GOVERNED_RESEARCH_EVIDENCE_AVAILABLE",
    missingTimestampCount,
    unknownOutcomeCount,
    unknownBusinessCategoryCount,
    nullCountFieldCount,
    recommendationReadinessClaimed: false,
    causalUpliftClaimed: false
  };
}

export function buildGovernedCodexEvidenceBundle(options = {}) {
  const repoRoot = resolve(options.repoRoot || defaultRepoRoot);
  const registry = options.registry || loadCommercialWorkspaceRegistry();
  const workspaceId = options.workspaceId || "fitness_connection";
  const workspace = getCommercialWorkspace(workspaceId, { registry });
  const operatingProfileId = options.operatingProfileId || workspace.operatingProfileId;
  if (workspace.operatingProfileId !== operatingProfileId
    || workspace.codexEvidence.bundleAuthorized !== true
    || workspace.codexEvidence.canonicalDatabase !== false
    || workspace.codexEvidence.allowlistProjectionOnly !== true) {
    fail("route_iq_codex_evidence_scope_unauthorized", "Workspace is not authorized for governed Codex evidence delivery.");
  }
  const preservation = options.preservationManifest || loadFitnessConnectionEvidencePreservationManifest(repoRoot);
  const preservationCheck = verifyFitnessConnectionEvidencePreservation({ repoRoot, manifest: preservation });
  if (preservationCheck.workspaceId !== workspace.workspaceId
    || preservationCheck.operatingProfileId !== workspace.operatingProfileId) {
    fail("route_iq_codex_evidence_workspace_mismatch", "Preserved evidence does not match the requested workspace.");
  }
  const sessionManifestPath = findPreservedPath(preservation, "/manifest.json");
  const fieldSessionPath = findPreservedPath(preservation, "/normalized/field-session.json");
  const calculatedMetricsPath = findPreservedPath(preservation, "/normalized/calculated-metrics.json");
  const session = readJson(resolve(repoRoot, sessionManifestPath));
  const fieldSession = readJson(resolve(repoRoot, fieldSessionPath));
  const calculatedMetrics = readJson(resolve(repoRoot, calculatedMetricsPath));
  if (!workspace.codexEvidence.sourceSessionIds.includes(session.sessionId)
    || session.workspaceId !== workspace.workspaceId
    || session.operatingProfileId !== workspace.operatingProfileId
    || fieldSession.workspaceId !== workspace.workspaceId
    || fieldSession.operatingProfileId !== workspace.operatingProfileId
    || calculatedMetrics.sessionId !== session.sessionId) {
    fail("route_iq_codex_evidence_source_scope_invalid", "Governed source session scope is invalid.");
  }
  const representativeId = session.representativeId;
  const representative = workspace.users.find(user => user.representativeId === representativeId);
  if (!representative || !representative.active) {
    fail("route_iq_codex_evidence_representative_unauthorized", "Source representative is not authorized in the workspace.");
  }
  const firstEvidenceAt = calculatedMetrics.calculations?.firstLoggedVisitAt;
  const lastEvidenceAt = calculatedMetrics.calculations?.lastLoggedVisitAt;
  const from = canonicalTimestamp(options.from || firstEvidenceAt, "Evidence window start");
  const to = canonicalTimestamp(options.to || lastEvidenceAt, "Evidence window end");
  if (Date.parse(from) > Date.parse(to)) {
    fail("route_iq_codex_evidence_window_invalid", "Evidence window start cannot follow its end.");
  }
  const allVisits = fieldSession.verifiedFields?.completedVisits;
  if (!Array.isArray(allVisits)) fail("route_iq_codex_evidence_visits_invalid", "Governed completed visits are missing.");
  const context = { workspace, representative, session };
  const projected = allVisits.map(visit => visitProjection(visit, context));
  const authorizedRecords = projected
    .filter(record => Date.parse(record.occurredAt) >= Date.parse(from) && Date.parse(record.occurredAt) <= Date.parse(to))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.recordId.localeCompare(right.recordId));
  const forbiddenField = findForbiddenRecordField(authorizedRecords);
  if (forbiddenField) {
    fail("route_iq_codex_evidence_redaction_failed", "Authorized record projection contains a forbidden field.", {
      forbiddenField
    });
  }

  const sourceHashes = preservation.files
    .map(file => ({
      sourceArtifactId: `riq_source_${sha256(file.path)}`,
      sha256: file.sha256,
      byteLength: file.byteLength
    }))
    .sort((left, right) => left.sourceArtifactId.localeCompare(right.sourceArtifactId));
  const exclusions = [
    {
      exclusionCode: "RAW_UNREDACTED_EVIDENCE_NOT_EXPORTED",
      reason: "Raw reports may contain notes, names, addresses, GPS state, or other non-allowlisted fields."
    },
    {
      exclusionCode: "STRESS_TEST_FREE_TEXT_NOT_EXPORTED",
      reason: "Free-text field observations remain governed source evidence and are not included in the Codex bundle."
    },
    {
      exclusionCode: "ACCIDENTAL_ARCHIVE_EXCLUDED_FROM_ANALYTICS",
      reason: preservation.accidentalArchiveBoundary.reason,
      sourceRecordSha256: preservation.accidentalArchiveBoundary.rawSha256
    }
  ];
  if (authorizedRecords.length !== projected.length) {
    exclusions.push({
      exclusionCode: "OUTSIDE_REQUESTED_EVIDENCE_WINDOW",
      reason: "Governed records outside the requested time window were not exported.",
      recordCount: projected.length - authorizedRecords.length
    });
  }
  const manifest = {
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    workspaceRegistryVersion: registry.registryVersion,
    relationshipClassification: workspace.business.relationshipClassification,
    evidenceClassification: workspace.evidenceGovernance.classification,
    evidenceTimeWindow: { from, to },
    projectionVersion: routeIqGovernedCodexEvidenceProjectionVersion,
    redactionStatus: routeIqGovernedCodexEvidenceRedactionStatus,
    authorizedRecordCount: authorizedRecords.length,
    sourceArtifactCount: sourceHashes.length,
    sourceHashes,
    exclusions,
    dataQualitySummary: dataQuality(authorizedRecords),
    preservationAggregateSha256: preservationCheck.aggregateSha256
  };
  const core = {
    bundleVersion: routeIqGovernedCodexEvidenceBundleVersion,
    consumer: "codex_analysis",
    canonicalProductionDatabase: false,
    manifest,
    authorizedRecords
  };
  const payloadSha256 = sha256(stableJson(core));
  const bundle = {
    ...core,
    bundleId: `riq_codex_bundle_${payloadSha256}`,
    integrity: {
      algorithm: "SHA-256",
      payloadSha256,
      sourceBytesVerifiedBeforeProjection: true
    }
  };
  validateGovernedCodexEvidenceBundle(bundle);
  return Object.freeze(bundle);
}

export function validateGovernedCodexEvidenceBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)
    || bundle.bundleVersion !== routeIqGovernedCodexEvidenceBundleVersion
    || bundle.consumer !== "codex_analysis"
    || bundle.canonicalProductionDatabase !== false
    || !Array.isArray(bundle.authorizedRecords)
    || bundle.manifest?.redactionStatus !== routeIqGovernedCodexEvidenceRedactionStatus
    || bundle.manifest?.relationshipClassification !== routeIqFounderResearchClassification
    || bundle.manifest?.dataQualitySummary?.recommendationReadinessClaimed !== false
    || bundle.manifest?.dataQualitySummary?.causalUpliftClaimed !== false
    || bundle.integrity?.algorithm !== "SHA-256"
    || bundle.integrity?.sourceBytesVerifiedBeforeProjection !== true) {
    fail("route_iq_codex_evidence_bundle_invalid", "Governed Codex evidence bundle is invalid.");
  }
  const forbiddenField = findForbiddenRecordField(bundle.authorizedRecords);
  if (forbiddenField) fail("route_iq_codex_evidence_redaction_failed", "Bundle contains a forbidden field.");
  const { bundleId, integrity, ...core } = bundle;
  const payloadSha256 = sha256(stableJson(core));
  if (integrity.payloadSha256 !== payloadSha256 || bundleId !== `riq_codex_bundle_${payloadSha256}`) {
    fail("route_iq_codex_evidence_integrity_invalid", "Governed Codex evidence bundle integrity is invalid.");
  }
  return true;
}
