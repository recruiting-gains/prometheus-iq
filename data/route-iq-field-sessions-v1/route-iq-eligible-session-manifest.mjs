import { createHash } from "node:crypto";

export const routeIqEligibleSessionManifestVersion =
  "route-iq-eligible-session-manifest-v1";
export const routeIqEligibleSessionManifestPolicyVersion =
  "route-iq-governed-learning-admission-v1";

const SHA256 = /^[a-f0-9]{64}$/u;
const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const RECORD_ID = /^[a-z][a-z0-9_-]{2,239}$/u;
const SAFE_CLASSIFICATIONS = new Set([
  "FOUNDER_FIELD_RESEARCH",
  "SYNTHETIC_VALIDATION_FIXTURE"
]);
const RECORD_KINDS = Object.freeze([
  "verified_field_session",
  "calculated_field_session_metrics",
  "field_session_history_updates"
]);
const BLOCKED_DELETION_STATES = new Set([
  "DELETION_STARTED",
  "DELETION_IN_PROGRESS",
  "DELETION_COMPLETED"
]);
const PROHIBITED_PACKAGE_KEYS = new Set([
  "address",
  "contacts",
  "contact",
  "email",
  "phone",
  "gpsAttached",
  "latitude",
  "longitude",
  "lat",
  "lng",
  "notes",
  "raw",
  "rawReport",
  "secret",
  "secrets",
  "stressTestEvidence",
  "stressTestObservations"
]);

export class RouteIqEligibleSessionManifestError extends Error {
  constructor(code) {
    super("Route IQ eligible-session admission failed closed.");
    this.name = "RouteIqEligibleSessionManifestError";
    this.code = code;
  }
}

function fail(code) {
  throw new RouteIqEligibleSessionManifestError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(
    typeof value === "string" ? value : canonicalJson(value),
    "utf8"
  ).digest("hex");
}

function canonicalTimestamp(value, code) {
  if (typeof value !== "string"
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    fail(code);
  }
  return value;
}

function addUtcMonths(value, months) {
  const source = new Date(value);
  const target = new Date(source.getTime());
  const day = source.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  )).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  target.setUTCHours(
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  );
  return target.toISOString();
}

function workspaceAuthority(registry, workspaceId, operatingProfileId) {
  if (registry?.schemaVersion !== "route-iq-workspace-configuration-v2"
    || registry?.authority !== "prometheus_administration"
    || !Array.isArray(registry?.workspaces)) {
    fail("route_iq_learning_administration_authority_invalid");
  }
  const matches = registry.workspaces.filter(workspace => workspace?.workspaceId === workspaceId);
  if (matches.length !== 1) fail("route_iq_learning_workspace_mapping_ambiguous");
  const workspace = matches[0];
  const classification = workspace.company?.relationshipClassification;
  if (!STRICT_ID.test(workspace.companyId || "")
    || workspace.companyId === workspace.workspaceId
    || workspace.operatingProfile?.profileId !== operatingProfileId
    || !SAFE_CLASSIFICATIONS.has(classification)
    || workspace.provenance?.owner !== "prometheus_administration"
    || workspace.admission?.productionAuthorized !== false) {
    fail("route_iq_learning_workspace_mapping_invalid");
  }
  return { workspace, customerId: workspace.companyId, classification };
}

function assertCorrectionChain(chain, sourceRecordSha256) {
  if (!Array.isArray(chain)) fail("route_iq_learning_correction_chain_invalid");
  let prior = sourceRecordSha256;
  let priorAt = "";
  for (const correction of chain) {
    if (!RECORD_ID.test(correction?.correctionId || "")
      || !SHA256.test(correction?.recordSha256 || "")
      || correction?.supersedesSha256 !== prior) {
      fail("route_iq_learning_correction_chain_invalid");
    }
    const correctedAt = canonicalTimestamp(
      correction.correctedAt,
      "route_iq_learning_correction_time_invalid"
    );
    if (priorAt && correctedAt <= priorAt) fail("route_iq_learning_correction_chronology_invalid");
    prior = correction.recordSha256;
    priorAt = correctedAt;
  }
  return {
    count: chain.length,
    headSha256: prior,
    latestCorrectedAt: priorAt || null
  };
}

function assertRetentionDecision(decision, manifest, evaluatedAt) {
  if (!decision
    || decision.sessionId !== manifest.sessionId
    || decision.sourceRecordSha256 !== manifest.rawSha256
    || decision.policyVersion !== "route-iq-founder-retention-18-month-v1"
    || decision.authority !== "prometheus_data_authenticated_retention_admission"
    || decision.status !== "ELIGIBLE_FOR_READ_ONLY_LEARNING"
    || decision.legalHoldState !== "NONE"
    || decision.legalHoldVerification !== "AUTHENTICATED"
    || decision.deletionState !== "NONE"
    || decision.evaluatedAt !== evaluatedAt) {
    fail("route_iq_learning_retention_admission_invalid");
  }
  const createdAt = canonicalTimestamp(
    decision.createdAt,
    "route_iq_learning_retention_created_at_invalid"
  );
  const expiresAt = canonicalTimestamp(
    decision.expiresAt,
    "route_iq_learning_retention_expiry_invalid"
  );
  if (Date.parse(evaluatedAt) >= Date.parse(expiresAt)) {
    fail("route_iq_learning_evidence_expired");
  }
  if (Date.parse(expiresAt) > Date.parse(addUtcMonths(createdAt, 18))) {
    fail("route_iq_learning_retention_exceeds_founder_maximum");
  }
  return {
    policyVersion: decision.policyVersion,
    createdAt,
    expiresAt,
    evaluatedAt,
    legalHoldState: decision.legalHoldState,
    deletionState: decision.deletionState,
    decisionSha256: sha256(decision)
  };
}

function archiveHashes(archivePackage) {
  return {
    manifestSha256: sha256(archivePackage.manifest),
    verifiedFieldSessionSha256: sha256(archivePackage.verifiedFieldSession),
    calculatedMetricsSha256: sha256(archivePackage.calculatedMetrics),
    historyUpdatesSha256: sha256(archivePackage.historyUpdates)
  };
}

function assertArchivePackage(archivePackage, scope) {
  const manifest = archivePackage?.manifest;
  const verified = archivePackage?.verifiedFieldSession;
  const metrics = archivePackage?.calculatedMetrics;
  const history = archivePackage?.historyUpdates;
  const records = [manifest, verified, metrics, history];
  if (records.some(record => !record || typeof record !== "object" || Array.isArray(record))) {
    fail("route_iq_learning_archive_package_malformed");
  }
  if (!RECORD_ID.test(manifest.sessionId || "")
    || !SHA256.test(manifest.rawSha256 || "")
    || manifest.status !== "archived"
    || !["founder_designated_final", "governed_final"].includes(manifest.sourceFinality)
    || verified.sourceProvenance?.finalExportConfirmed !== true
    || verified.sourceProvenance?.rawSha256 !== manifest.rawSha256
    || metrics.calculationProvenance?.sourceRawSha256 !== manifest.rawSha256
    || metrics.calculationProvenance?.sourceSessionId !== manifest.sessionId
    || verified.recordKind !== RECORD_KINDS[0]
    || metrics.recordKind !== RECORD_KINDS[1]
    || history.recordKind !== RECORD_KINDS[2]
    || records.some(record => record.workspaceId !== scope.workspaceId)
    || records.some(record => record.operatingProfileId !== scope.operatingProfileId)
    || records.some(record => record.sessionId !== manifest.sessionId)
    || manifest.representativeId !== scope.representativeId
    || verified.verifiedFields?.representative?.id !== scope.representativeId
    || archivePackage.evidenceClassification !== scope.classification) {
    fail("route_iq_learning_archive_package_unauthorized");
  }
  if (archivePackage.administrativeDisposition !== null
    || archivePackage.consumptionEligibility?.eligible !== true
    || archivePackage.consumptionEligibility?.state !== "AVAILABLE"
    || BLOCKED_DELETION_STATES.has(archivePackage.consumptionEligibility?.deletionState)) {
    fail("route_iq_learning_archive_package_excluded");
  }
  const visits = verified.verifiedFields?.completedVisits;
  if (!Array.isArray(visits)
    || visits.length !== verified.verifiedFields?.totals?.totalVisits
    || history.representativeHistory?.totals?.totalVisits !== visits.length) {
    fail("route_iq_learning_archive_visit_count_invalid");
  }
  return { manifest, verified, metrics, history };
}

function assertNoProhibitedPackageFields(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoProhibitedPackageFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED_PACKAGE_KEYS.has(key)) fail("route_iq_learning_prohibited_evidence_projected");
    assertNoProhibitedPackageFields(child);
  }
}

function sanitizeVisit(visit) {
  const business = visit.governedBusinessIdentity || {};
  const report = visit.sourceReport || {};
  return {
    visitId: visit.visitId,
    exportOrder: visit.exportOrder,
    governedBusinessIdentity: {
      runtimeId: business.runtimeId,
      googlePlaceId: business.googlePlaceId,
      businessName: business.businessName,
      category: business.category,
      matchStatus: business.matchStatus
    },
    sourceReport: {
      date: report.date,
      timestamp: report.timestamp,
      placeId: report.placeId,
      placeName: report.placeName,
      timeWindow: report.timeWindow,
      outcome: report.outcome,
      conversations: report.conversations,
      leads: report.leads,
      units: report.units,
      laterUnits: report.laterUnits
    },
    visitDecisionSource: clone(visit.visitDecisionSource ?? null),
    recommendationDecisionContext: clone(visit.recommendationDecisionContext ?? null),
    recommendationEvidence: {
      availability: visit.recommendationEvidence?.availability || "unavailable_in_final_export",
      recommendationExplanation: null,
      recommendationPoolSource: null,
      recommendationScore: null
    },
    followUpRequirement: null,
    objections: null
  };
}

function sanitizedArchivePackage(archivePackage) {
  const manifest = archivePackage.manifest;
  const verified = archivePackage.verifiedFieldSession;
  const output = {
    evidenceClassification: archivePackage.evidenceClassification,
    manifest: {
      schemaVersion: manifest.schemaVersion,
      sessionId: manifest.sessionId,
      workspaceId: manifest.workspaceId,
      operatingProfileId: manifest.operatingProfileId,
      representativeId: manifest.representativeId,
      fieldSessionDate: manifest.fieldSessionDate,
      ingestedAt: manifest.ingestedAt,
      status: manifest.status,
      sourceFinality: manifest.sourceFinality,
      rawSha256: manifest.rawSha256,
      recordCounts: {
        fieldSessions: manifest.recordCounts?.fieldSessions,
        completedVisits: manifest.recordCounts?.completedVisits,
        categoryOutcomeHistoryEntries: manifest.recordCounts?.categoryOutcomeHistoryEntries,
        customerOutcomeHistoryEntries: manifest.recordCounts?.customerOutcomeHistoryEntries
      }
    },
    verifiedFieldSession: {
      schemaVersion: verified.schemaVersion,
      recordKind: verified.recordKind,
      handoffContractId: verified.handoffContractId,
      sessionId: verified.sessionId,
      workspaceId: verified.workspaceId,
      operatingProfileId: verified.operatingProfileId,
      sourceProvenance: {
        finalExportConfirmed: true,
        ingestedAt: verified.sourceProvenance.ingestedAt,
        rawSha256: verified.sourceProvenance.rawSha256,
        sourceKind: verified.sourceProvenance.sourceKind
      },
      fieldClassification: clone(verified.fieldClassification),
      unavailableFields: clone(verified.unavailableFields || []),
      verifiedFields: {
        representative: { id: verified.verifiedFields.representative.id },
        fieldSessionDate: verified.verifiedFields.fieldSessionDate,
        exportTimestamp: verified.verifiedFields.exportTimestamp,
        territoryId: verified.verifiedFields.territoryId,
        totals: clone(verified.verifiedFields.totals),
        completedVisits: verified.verifiedFields.completedVisits.map(sanitizeVisit)
      }
    },
    calculatedMetrics: clone(archivePackage.calculatedMetrics),
    historyUpdates: clone(archivePackage.historyUpdates),
    administrativeDisposition: null,
    consumptionEligibility: {
      eligible: true,
      state: "AVAILABLE",
      deletionState: "NONE"
    },
    correctionChain: clone(archivePackage.correctionChain || [])
  };
  assertNoProhibitedPackageFields(output);
  return output;
}

export function buildRouteIqEligibleSessionManifest({
  archivePackages,
  retentionDecisions,
  workspaceRegistry,
  workspaceId,
  operatingProfileId,
  representativeId,
  evaluatedAt
} = {}) {
  if (!STRICT_ID.test(workspaceId || "")
    || !STRICT_ID.test(operatingProfileId || "")
    || !STRICT_ID.test(representativeId || "")
    || !Array.isArray(archivePackages)
    || !Array.isArray(retentionDecisions)) {
    fail("route_iq_learning_manifest_input_invalid");
  }
  const evaluationTime = canonicalTimestamp(
    evaluatedAt,
    "route_iq_learning_manifest_evaluation_time_invalid"
  );
  const authority = workspaceAuthority(workspaceRegistry, workspaceId, operatingProfileId);
  const scope = {
    workspaceId,
    operatingProfileId,
    representativeId,
    classification: authority.classification
  };
  const decisionBySession = new Map();
  for (const decision of retentionDecisions) {
    if (!RECORD_ID.test(decision?.sessionId || "") || decisionBySession.has(decision.sessionId)) {
      fail("route_iq_learning_retention_decision_duplicate");
    }
    decisionBySession.set(decision.sessionId, decision);
  }
  const sessionIds = new Set();
  const sourceHashes = new Set();
  const entries = archivePackages.map(archivePackage => {
    const records = assertArchivePackage(archivePackage, scope);
    const { manifest, verified } = records;
    if (sessionIds.has(manifest.sessionId) || sourceHashes.has(manifest.rawSha256)) {
      fail("route_iq_learning_duplicate_or_replay_rejected");
    }
    sessionIds.add(manifest.sessionId);
    sourceHashes.add(manifest.rawSha256);
    const retention = assertRetentionDecision(
      decisionBySession.get(manifest.sessionId),
      manifest,
      evaluationTime
    );
    const correctionChain = assertCorrectionChain(
      archivePackage.correctionChain || [],
      manifest.rawSha256
    );
    return {
      sessionId: manifest.sessionId,
      workspaceId,
      customerId: authority.customerId,
      operatingProfileId,
      representativeId,
      evidenceClassification: authority.classification,
      fieldSessionDate: manifest.fieldSessionDate,
      ingestedAt: canonicalTimestamp(
        manifest.ingestedAt || verified.sourceProvenance.ingestedAt,
        "route_iq_learning_session_ingested_at_invalid"
      ),
      sourceFinality: manifest.sourceFinality,
      sourceRecordSha256: manifest.rawSha256,
      artifactHashes: archiveHashes(archivePackage),
      correctionChain,
      retention,
      evidenceCounts: {
        sessions: 1,
        visits: verified.verifiedFields.completedVisits.length
      }
    };
  }).sort((left, right) => (
    left.fieldSessionDate.localeCompare(right.fieldSessionDate)
      || left.ingestedAt.localeCompare(right.ingestedAt)
      || left.sessionId.localeCompare(right.sessionId)
  ));
  if (entries.length !== decisionBySession.size) {
    fail("route_iq_learning_retention_decision_scope_mismatch");
  }
  const body = {
    schemaVersion: routeIqEligibleSessionManifestVersion,
    policyVersion: routeIqEligibleSessionManifestPolicyVersion,
    authority: "Prometheus Data",
    status: entries.length ? "ELIGIBLE_SESSIONS_ADMITTED" : "NO_ELIGIBLE_EVIDENCE",
    generatedAt: evaluationTime,
    workspaceId,
    customerId: authority.customerId,
    operatingProfileId,
    representativeId,
    evidenceClassification: authority.classification,
    administrationConfigurationVersion: authority.workspace.provenance.configurationVersion,
    admittedRecordKinds: [...RECORD_KINDS],
    entries,
    totals: {
      sessions: entries.length,
      visits: entries.reduce((sum, entry) => sum + entry.evidenceCounts.visits, 0)
    },
    safety: {
      historicalArchiveMutationPerformed: false,
      duplicateOrReplayAccepted: false,
      rawReportIncluded: false,
      rawNotesIncluded: false,
      contactInformationIncluded: false,
      preciseGpsIncluded: false,
      secretsIncluded: false,
      stressTestEvidenceIncluded: false,
      recommendationInfluence: "OFF"
    }
  };
  const manifestSha256 = sha256(body);
  return Object.freeze({
    ...body,
    manifestId: `riq_eligible_sessions_${manifestSha256}`,
    manifestSha256
  });
}

export function materializeRouteIqEligibleSessionPackages(manifest, archivePackages) {
  if (manifest?.schemaVersion !== routeIqEligibleSessionManifestVersion
    || !SHA256.test(manifest?.manifestSha256 || "")
    || sha256(Object.fromEntries(
      Object.entries(manifest).filter(([key]) => !["manifestId", "manifestSha256"].includes(key))
    )) !== manifest.manifestSha256
    || manifest.manifestId !== `riq_eligible_sessions_${manifest.manifestSha256}`
    || !Array.isArray(archivePackages)) {
    fail("route_iq_learning_manifest_integrity_invalid");
  }
  const bySession = new Map();
  for (const archivePackage of archivePackages) {
    const sessionId = archivePackage?.manifest?.sessionId;
    if (!sessionId || bySession.has(sessionId)) fail("route_iq_learning_archive_replay_rejected");
    bySession.set(sessionId, archivePackage);
  }
  const packages = manifest.entries.map(entry => {
    const archivePackage = bySession.get(entry.sessionId);
    if (!archivePackage
      || canonicalJson(archiveHashes(archivePackage)) !== canonicalJson(entry.artifactHashes)
      || archivePackage.manifest.rawSha256 !== entry.sourceRecordSha256) {
      fail("route_iq_learning_archive_hash_mismatch");
    }
    return sanitizedArchivePackage(archivePackage);
  });
  if (packages.length !== bySession.size) fail("route_iq_learning_archive_scope_mismatch");
  return Object.freeze(packages);
}

export function canonicalRouteIqEligibleSessionManifestJson(manifest) {
  return canonicalJson(manifest);
}
