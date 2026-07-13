import { createHash } from "node:crypto";

export const routeIqFieldSessionArchiveVersion = "route-iq-field-session-archive-v1";
export const routeIqEndOfDayHandoffContractId = "route-iq-end-of-day-data-handoff-v1";
export const routeIqFieldSessionStoreBinding = "DATA_ROUTE_IQ_FIELD_SESSION_STORE";
export const routeIqFieldSessionStorageTechnology = "cloudflare_workers_kv";
export const routeIqFieldSessionStoragePrefix = "route-iq-field-sessions/v1";
export const routeIqChronologicalEvidenceProjectionVersion = "route-iq-chronological-evidence-projection-v1";
export const routeIqChronologicalEvidenceKinds = Object.freeze([
  "visit_decision_context",
  "visit_observed_outcome",
  "customer_outcome_observation",
  "stress_test_observation",
  "prospective_opportunity_snapshot",
  "prospective_opportunity_action",
  "prospective_opportunity_outcome",
  "prospective_outcome_correction"
]);
export const routeIqVisitDecisionSourceIds = Object.freeze([
  "route_iq_recommendation",
  "nearby_context",
  "representative_saved_place",
  "representative_discovery",
  "representative_follow_up",
  "existing_relationship",
  "manual_selection",
  "unknown"
]);
export const routeIqRecommendationDecisionValues = Object.freeze(["accepted", "overridden"]);

export const supportedFieldSessionWorkspaces = Object.freeze({
  fitness_connection: Object.freeze({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeIds: Object.freeze(["cruz", "anthony"]),
    protectedWorkspaceIds: Object.freeze(["smoothie_depot"])
  })
});

export class FieldSessionArchiveError extends Error {
  constructor(message, { code = "field_session_archive_error", status = 422, details = {} } = {}) {
    super(message);
    this.name = "FieldSessionArchiveError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class FieldSessionStoreBindingError extends FieldSessionArchiveError {
  constructor(bindingName, missingMethods = []) {
    super(`Data field-session store binding ${bindingName} is missing or invalid.`, {
      code: "field_session_store_binding_missing",
      status: 503,
      details: { bindingName, missingMethods: [...missingMethods] }
    });
    this.name = "FieldSessionStoreBindingError";
    this.bindingName = bindingName;
    this.missingMethods = [...missingMethods];
  }
}

export class FieldSessionConflictError extends FieldSessionArchiveError {
  constructor(sessionId, existingSha256, incomingSha256) {
    super(`Field session ${sessionId} already exists with different raw evidence.`, {
      code: "field_session_duplicate_conflict",
      status: 409,
      details: { sessionId, existingSha256, incomingSha256 }
    });
    this.name = "FieldSessionConflictError";
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireIso(value, label) {
  const date = new Date(value);
  if (typeof value !== "string" || !value || Number.isNaN(date.getTime())) {
    throw new FieldSessionArchiveError(`${label} must be a valid timestamp.`, {
      code: "field_session_timestamp_invalid",
      details: { label, value: value ?? null }
    });
  }
  return date.toISOString();
}

function requireDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FieldSessionArchiveError(`${label} must use YYYY-MM-DD.`, {
      code: "field_session_date_invalid",
      details: { label, value: value ?? null }
    });
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new FieldSessionArchiveError(`${label} is required.`, {
      code: "field_session_required_field_missing",
      details: { label }
    });
  }
  return value;
}

function requireCount(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new FieldSessionArchiveError(`${label} must be a non-negative integer.`, {
      code: "field_session_metric_invalid",
      details: { label, value: value ?? null }
    });
  }
  return value;
}

function preserveVisitDecisionSource(
  value,
  visitNumber,
  { visitTimestamp, reportGeneratedAt, recommendationDecisionContext }
) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} decision source is required.`, {
      code: "field_session_decision_context_required",
      details: { visitNumber }
    });
  }
  if (!routeIqVisitDecisionSourceIds.includes(value.sourceId)) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} decision source is not canonical.`, {
      code: "field_session_visit_decision_source_invalid",
      details: { visitNumber, sourceId: value.sourceId ?? null }
    });
  }
  const reasonValid = value.sourceId === "unknown"
    ? value.reason === null || typeof value.reason === "string"
    : typeof value.reason === "string" && value.reason.trim().length > 0;
  if (!reasonValid || !Array.isArray(value.evidence)) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} decision source evidence is malformed.`, {
      code: "field_session_visit_decision_source_invalid",
      details: { visitNumber, sourceId: value.sourceId }
    });
  }
  const evidenceValid = value.evidence.every(item => item
    && typeof item === "object"
    && !Array.isArray(item)
    && typeof item.evidenceType === "string"
    && item.evidenceType.trim().length > 0
    && typeof item.sourceRecordId === "string"
    && item.sourceRecordId.trim().length > 0);
  const knownSourceEvidenceValid = value.sourceId === "unknown" || value.evidence.length > 0;
  const confidenceValid = Number.isFinite(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && (value.sourceId !== "unknown" || value.confidence === 0);
  if (!evidenceValid || !knownSourceEvidenceValid || !confidenceValid) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} decision source evidence is malformed.`, {
      code: "field_session_visit_decision_source_invalid",
      details: { visitNumber, sourceId: value.sourceId }
    });
  }
  const capturedAt = requireIso(value.capturedAt, `Visit ${visitNumber} decision source capturedAt`);
  const capturedAtTime = Date.parse(capturedAt);
  const visitTime = Date.parse(visitTimestamp);
  const reportGeneratedTime = Date.parse(reportGeneratedAt);
  const actionTimeCapture = capturedAt === visitTimestamp;
  const lateUnknownCapture = value.sourceId === "unknown"
    && capturedAtTime > visitTime
    && capturedAtTime <= reportGeneratedTime
    && capturedAt === reportGeneratedAt
    && value.evidence.length === 0
    && value.confidence === 0
    && recommendationDecisionContext.recommendationAvailable === null
    && recommendationDecisionContext.recommendationId === null
    && recommendationDecisionContext.decision === null;
  if (!actionTimeCapture && !lateUnknownCapture) {
    throw new FieldSessionArchiveError(
      `Visit ${visitNumber} decision source timestamp is not valid for its capture mode.`,
      {
        code: "field_session_decision_context_timestamp_mismatch",
        details: { visitNumber, visitTimestamp, capturedAt, reportGeneratedAt }
      }
    );
  }
  const preserved = clone(value);
  preserved.capturedAt = capturedAt;
  preserved.temporalClassification = lateUnknownCapture
    ? "late_report_finalization_unknown"
    : "action_time_observation";
  if (preserved.sourceId === "unknown") preserved.reason = null;
  return preserved;
}

function preserveRecommendationDecisionContext(value, visitNumber) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} recommendation decision context is required.`, {
      code: "field_session_decision_context_required",
      details: { visitNumber }
    });
  }
  const recommendationAvailableValid = [true, false, null].includes(value.recommendationAvailable);
  const canonicalRecommendationId = typeof value.recommendationId === "string"
    ? value.recommendationId.trim() || null
    : null;
  const recommendationIdValid = value.recommendationId === null
    || (typeof value.recommendationId === "string" && canonicalRecommendationId !== null);
  const decisionValid = value.decision === null || routeIqRecommendationDecisionValues.includes(value.decision);
  const availableRecommendationIdValid = value.recommendationAvailable !== true || canonicalRecommendationId !== null;
  const unavailableRecommendationIdValid = value.recommendationAvailable === true || canonicalRecommendationId === null;
  const decidedRecommendationValid = value.decision === null
    || (value.recommendationAvailable === true && canonicalRecommendationId !== null);
  if (!recommendationAvailableValid || !recommendationIdValid || !decisionValid
    || !availableRecommendationIdValid || !unavailableRecommendationIdValid || !decidedRecommendationValid) {
    throw new FieldSessionArchiveError(`Visit ${visitNumber} recommendation decision context is malformed.`, {
      code: "field_session_recommendation_decision_context_invalid",
      details: { visitNumber, decision: value.decision ?? null }
    });
  }
  const preserved = clone(value);
  preserved.recommendationId = canonicalRecommendationId;
  return preserved;
}

function percentage(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function assertWorkspace(workspaceId, operatingProfileId, representativeId = "") {
  const workspace = supportedFieldSessionWorkspaces[workspaceId];
  if (!workspace) {
    throw new FieldSessionArchiveError(`Unknown field-session workspace: ${workspaceId || "missing"}.`, {
      code: "field_session_workspace_unknown",
      status: 400,
      details: { workspaceId: workspaceId || null }
    });
  }
  if (operatingProfileId !== workspace.operatingProfileId) {
    throw new FieldSessionArchiveError(
      `Operating profile ${operatingProfileId || "missing"} is not valid for ${workspaceId}.`,
      {
        code: "field_session_operating_profile_mismatch",
        status: 400,
        details: { workspaceId, operatingProfileId: operatingProfileId || null }
      }
    );
  }
  if (representativeId && !workspace.representativeIds.includes(representativeId)) {
    throw new FieldSessionArchiveError(`Representative ${representativeId} is not registered for ${workspaceId}.`, {
      code: "field_session_representative_unknown",
      status: 400,
      details: { workspaceId, representativeId }
    });
  }
  return workspace;
}

function sessionSlugPart(value) {
  return String(value).trim().toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function deterministicFieldSessionId({ workspaceId, operatingProfileId, representativeId, date }) {
  assertWorkspace(workspaceId, operatingProfileId, representativeId);
  requireDate(date, "Field-session date");
  return [
    "route-iq-field-session",
    sessionSlugPart(workspaceId),
    sessionSlugPart(operatingProfileId),
    sessionSlugPart(representativeId),
    date
  ].join("-");
}

export function validateFinalRouteIqReport(rawReportText, context = {}) {
  if (typeof rawReportText !== "string" || !rawReportText.trim()) {
    throw new FieldSessionArchiveError("Raw Route IQ report bytes are required.", {
      code: "field_session_raw_report_missing"
    });
  }
  if (context.finalExportConfirmed !== true) {
    throw new FieldSessionArchiveError("Founder confirmation of the final export is required.", {
      code: "field_session_final_export_unconfirmed",
      status: 409
    });
  }

  let report;
  try {
    report = JSON.parse(rawReportText);
  } catch (error) {
    throw new FieldSessionArchiveError("Raw Route IQ report is not valid JSON.", {
      code: "field_session_raw_report_invalid_json",
      details: { message: error.message }
    });
  }

  if (report.app !== "Prometheus IQ" || report.reportType !== "beta-daily-rep-report") {
    throw new FieldSessionArchiveError("Source is not a supported Prometheus IQ Today report.", {
      code: "field_session_report_contract_mismatch",
      details: { app: report.app ?? null, reportType: report.reportType ?? null }
    });
  }

  const date = requireDate(report.date, "Report date");
  const generatedAt = requireIso(report.generatedAt, "Report generatedAt");
  const representativeId = requireNonEmptyString(report.rep?.id, "Report representative id");
  const representativeName = requireNonEmptyString(report.rep?.name, "Report representative name");
  assertWorkspace(context.workspaceId, context.operatingProfileId, representativeId);

  const totals = {
    visits: requireCount(report.totals?.visits, "Report total visits"),
    conversations: requireCount(report.totals?.conversations, "Report total conversations"),
    leads: requireCount(report.totals?.leads, "Report total leads"),
    units: requireCount(report.totals?.units, "Report total units"),
    laterUnits: requireCount(report.totals?.laterUnits, "Report total later units")
  };
  if (!Array.isArray(report.visits) || report.visits.length !== totals.visits) {
    throw new FieldSessionArchiveError("Report visit records do not match total visits.", {
      code: "field_session_visit_count_mismatch",
      details: { reported: totals.visits, records: Array.isArray(report.visits) ? report.visits.length : null }
    });
  }

  const visits = report.visits.map((visit, index) => {
    const timestamp = requireIso(visit?.timestamp, `Visit ${index + 1} timestamp`);
    if (requireDate(visit?.date, `Visit ${index + 1} date`) !== date) {
      throw new FieldSessionArchiveError(`Visit ${index + 1} is outside the report date.`, {
        code: "field_session_visit_date_mismatch",
        details: { reportDate: date, visitDate: visit?.date ?? null }
      });
    }
    if (!Object.hasOwn(visit, "visitDecisionSource") || !Object.hasOwn(visit, "recommendationDecisionContext")) {
      throw new FieldSessionArchiveError(`Visit ${index + 1} is missing canonical decision context.`, {
        code: "field_session_decision_context_required",
        details: { visitNumber: index + 1 }
      });
    }
    const recommendationDecisionContext = preserveRecommendationDecisionContext(
      visit.recommendationDecisionContext,
      index + 1
    );
    const visitDecisionSource = preserveVisitDecisionSource(visit.visitDecisionSource, index + 1, {
      visitTimestamp: timestamp,
      reportGeneratedAt: generatedAt,
      recommendationDecisionContext
    });
    return {
      placeName: requireNonEmptyString(visit?.placeName, `Visit ${index + 1} placeName`),
      placeId: requireNonEmptyString(visit?.placeId, `Visit ${index + 1} placeId`),
      timestamp,
      date: visit.date,
      timeWindow: typeof visit.timeWindow === "string" ? visit.timeWindow : "",
      outcome: typeof visit.outcome === "string" ? visit.outcome : "",
      conversations: requireCount(visit.conversations, `Visit ${index + 1} conversations`),
      leads: requireCount(visit.leads, `Visit ${index + 1} leads`),
      units: requireCount(visit.units, `Visit ${index + 1} units`),
      laterUnits: requireCount(visit.laterUnits, `Visit ${index + 1} later units`),
      notes: typeof visit.notes === "string" ? visit.notes : "",
      visitDecisionSource,
      recommendationDecisionContext,
      gpsAttached: typeof visit.gpsAttached === "boolean" ? visit.gpsAttached : null
    };
  });

  const recomputed = visits.reduce((sum, visit) => {
    sum.conversations += visit.conversations;
    sum.leads += visit.leads;
    sum.units += visit.units;
    sum.laterUnits += visit.laterUnits;
    return sum;
  }, { conversations: 0, leads: 0, units: 0, laterUnits: 0 });
  for (const key of Object.keys(recomputed)) {
    if (recomputed[key] !== totals[key]) {
      throw new FieldSessionArchiveError(`Report ${key} total does not match its visit records.`, {
        code: "field_session_metric_total_mismatch",
        details: { metric: key, reported: totals[key], recomputed: recomputed[key] }
      });
    }
  }
  if (visits.some(visit => new Date(visit.timestamp).getTime() > new Date(generatedAt).getTime())) {
    throw new FieldSessionArchiveError("Report export timestamp precedes a logged visit.", {
      code: "field_session_export_precedes_visit"
    });
  }

  return {
    report: clone(report),
    normalizedReport: {
      app: report.app,
      reportType: report.reportType,
      generatedAt,
      date,
      representative: { id: representativeId, name: representativeName },
      totals,
      visits
    },
    rawSha256: sha256(rawReportText),
    rawByteLength: Buffer.byteLength(rawReportText, "utf8")
  };
}

function runtimeIndexes(runtimePools, activePool, businessHours) {
  const runtimeRecords = [
    ...(Array.isArray(runtimePools?.cruz) ? runtimePools.cruz : []),
    ...(Array.isArray(runtimePools?.anthony) ? runtimePools.anthony : [])
  ];
  return {
    runtimeById: new Map(runtimeRecords.map(record => [record.id, record])),
    activeByPlaceId: new Map((activePool?.records || []).map(record => [record.googlePlaceId, record])),
    hoursByPlaceId: new Map((businessHours?.records || []).map(record => [record.googlePlaceId, record]))
  };
}

function enrichVisit(visit, index, representativeId, indexes, sourceDatasetVersion) {
  const runtime = indexes.runtimeById.get(visit.placeId) || null;
  if (runtime && runtime.repProfileId !== representativeId) {
    throw new FieldSessionArchiveError(`Visit ${index + 1} resolves to a different representative.`, {
      code: "field_session_cross_representative_contamination",
      details: { visitPlaceId: visit.placeId, expected: representativeId, actual: runtime.repProfileId }
    });
  }
  if (runtime && runtime.name !== visit.placeName) {
    throw new FieldSessionArchiveError(`Visit ${index + 1} business identity does not match governed runtime data.`, {
      code: "field_session_business_identity_mismatch",
      details: { visitPlaceId: visit.placeId, reportName: visit.placeName, runtimeName: runtime.name }
    });
  }

  const active = runtime?.googlePlaceId ? indexes.activeByPlaceId.get(runtime.googlePlaceId) || null : null;
  const hours = runtime?.googlePlaceId ? indexes.hoursByPlaceId.get(runtime.googlePlaceId) || null : null;
  const { visitDecisionSource, recommendationDecisionContext, ...sourceReport } = visit;
  return {
    exportOrder: index + 1,
    visitId: `visit-${String(index + 1).padStart(2, "0")}-${sha256(`${visit.placeId}|${visit.timestamp}`).slice(0, 12)}`,
    sourceReport: clone(sourceReport),
    visitDecisionSource: clone(visitDecisionSource),
    recommendationDecisionContext: clone(recommendationDecisionContext),
    governedBusinessIdentity: runtime ? {
      matchStatus: "exact_runtime_id",
      runtimeId: runtime.id,
      googlePlaceId: runtime.googlePlaceId,
      businessName: runtime.name,
      address: runtime.address,
      category: runtime.category,
      sourceDatasetVersion,
      currentPoolAtArchive: active ? "active" : "not_active",
      dataQualityScore: Number.isFinite(runtime.qualityScore) ? runtime.qualityScore : null,
      dataQualityReason: runtime.qualityReason || null,
      provenance: {
        runtimePoolsPath: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
        activePoolPath: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"
      }
    } : null,
    governedHoursSnapshot: hours ? {
      status: hours.currentOpenClosedEligibilityStatus,
      reasonCode: hours.currentStatusReasonCode,
      reason: hours.currentStatusReason,
      evaluatedAt: hours.currentStatusEvaluatedAt,
      businessTimezone: hours.businessTimezone,
      freshnessStatus: hours.hoursFreshnessStatus,
      confidence: hours.hoursConfidence,
      statusAppliesAtVisitTimestamp: false,
      provenance: {
        artifactPath: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
        googlePlaceId: hours.googlePlaceId,
        sourceRetrievedAt: hours.sourceRetrievedAt,
        hoursVerifiedAt: hours.hoursVerifiedAt
      }
    } : null,
    recommendationEvidence: {
      recommendationScore: null,
      recommendationExplanation: null,
      recommendationPoolSource: null,
      availability: "unavailable_in_final_export"
    },
    followUpRequirement: null,
    objections: null
  };
}

function validateStressTestEvidence(evidence, workspaceId, operatingProfileId, sessionId) {
  if (!evidence) {
    return {
      evidenceVersion: "route-iq-field-session-observations-v1",
      workspaceId,
      operatingProfileId,
      sessionId,
      source: null,
      observations: [],
      subsequentRemediation: null,
      availability: "no_stress_test_evidence_submitted"
    };
  }
  if (evidence.workspaceId !== workspaceId || evidence.operatingProfileId !== operatingProfileId || !Array.isArray(evidence.observations)) {
    throw new FieldSessionArchiveError("Structured Founder stress-test evidence is missing or cross-workspace.", {
      code: "field_session_stress_test_evidence_invalid"
    });
  }
  const observations = evidence.observations.map(observation => {
    requireNonEmptyString(observation.observationId, "Stress-test observation id");
    requireNonEmptyString(observation.title, "Stress-test observation title");
    requireNonEmptyString(observation.finding, "Stress-test observation finding");
    return {
      ...clone(observation),
      observedAt: observation.observedAt || null,
      screenshots: Array.isArray(observation.screenshots) ? observation.screenshots : []
    };
  });
  return {
    ...clone(evidence),
    sessionId,
    observations
  };
}

export function createRouteIqFieldSessionArchivePackage(input = {}) {
  const validated = validateFinalRouteIqReport(input.rawReportText, input);
  const report = validated.normalizedReport;
  const sessionId = deterministicFieldSessionId({
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    representativeId: report.representative.id,
    date: report.date
  });
  const ingestedAt = requireIso(input.ingestedAt || new Date().toISOString(), "Archive ingestedAt");
  const indexes = runtimeIndexes(input.runtimePools, input.activePool, input.businessHours);
  const sourceDatasetVersion = input.runtimePools?.dataset_version || null;
  const completedVisits = report.visits.map((visit, index) => {
    return enrichVisit(visit, index, report.representative.id, indexes, sourceDatasetVersion);
  });
  const stressTestEvidence = validateStressTestEvidence(
    input.stressTestEvidence,
    input.workspaceId,
    input.operatingProfileId,
    sessionId
  );
  const territoryId = input.territoryId ? requireNonEmptyString(input.territoryId, "Territory id") : null;

  const unavailableFields = [
    "sessionStartTime",
    "sessionEndTime",
    "initialRoute",
    "completeRecommendationHistory",
    "recommendationScores",
    "recommendationExplanations",
    "routeReplenishmentEvents",
    "replacementRecommendations",
    "completedStopExclusionEvents",
    "duplicatePreventionEvents",
    "recommendationPoolSource",
    "structuredObjections",
    "structuredFollowUpRequirements",
    "territoryId",
    "distanceAndTravelMetrics",
    "observationTimestamps",
    "screenshots"
  ];

  const normalizedRecord = {
    schemaVersion: routeIqFieldSessionArchiveVersion,
    handoffContractId: routeIqEndOfDayHandoffContractId,
    sessionId,
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    recordKind: "verified_field_session",
    verifiedFields: {
      representative: report.representative,
      fieldSessionDate: report.date,
      territoryId,
      sourceReportType: report.reportType,
      exportTimestamp: report.generatedAt,
      totals: {
        totalStops: null,
        totalVisits: report.totals.visits,
        totalConversations: report.totals.conversations,
        totalLeads: report.totals.leads,
        totalUnits: report.totals.units,
        totalLaterUnits: report.totals.laterUnits,
        totalMemberships: null
      },
      completedVisits
    },
    unavailableFields,
    sourceProvenance: {
      sourceKind: "founder_exported_final_today_report",
      originalFileName: input.originalFileName,
      canonicalRawArtifactPath: input.canonicalRawArtifactPath,
      rawSha256: validated.rawSha256,
      rawByteLength: validated.rawByteLength,
      finalExportConfirmed: true,
      finalityBasis: input.finalityBasis,
      sourceGeneratedAt: report.generatedAt,
      ingestedAt
    },
    fieldClassification: {
      verifiedFieldContainer: "verifiedFields",
      calculatedFieldsStoredSeparately: true,
      unavailableValuesRemainNull: true,
      notesAreNotParsedIntoFollowUpOrObjectionClaims: true
    }
  };

  const timestamps = report.visits.map(visit => new Date(visit.timestamp).getTime()).sort((a, b) => a - b);
  const totalUnits = report.totals.units + report.totals.laterUnits;
  const categoryMap = new Map();
  for (const visit of completedVisits) {
    const category = visit.governedBusinessIdentity?.category;
    if (!category) continue;
    const current = categoryMap.get(category) || { category, visits: 0, conversations: 0, leads: 0, units: 0, laterUnits: 0 };
    current.visits += 1;
    current.conversations += visit.sourceReport.conversations;
    current.leads += visit.sourceReport.leads;
    current.units += visit.sourceReport.units;
    current.laterUnits += visit.sourceReport.laterUnits;
    categoryMap.set(category, current);
  }

  const calculatedMetrics = {
    schemaVersion: routeIqFieldSessionArchiveVersion,
    sessionId,
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    recordKind: "calculated_field_session_metrics",
    calculations: {
      firstLoggedVisitAt: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
      lastLoggedVisitAt: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
      loggedVisitWindowMinutes: timestamps.length > 1 ? Number(((timestamps[timestamps.length - 1] - timestamps[0]) / 60_000).toFixed(2)) : null,
      conversationPerVisitRatePercent: percentage(report.totals.conversations, report.totals.visits),
      leadPerVisitRatePercent: percentage(report.totals.leads, report.totals.visits),
      unitPerLeadRatePercent: percentage(totalUnits, report.totals.leads),
      categoryOutcomes: [...categoryMap.values()].sort((left, right) => left.category.localeCompare(right.category))
    },
    calculationProvenance: {
      sourceSessionId: sessionId,
      sourceRawSha256: validated.rawSha256,
      formulasVersion: "route-iq-field-session-metrics-v1",
      sessionStartOrEndInferred: false,
      membershipCountInferredFromOutcomeLabel: false
    }
  };

  const customerOutcomes = completedVisits.flatMap(visit => {
    const identity = visit.governedBusinessIdentity;
    if (!identity?.googlePlaceId) return [];
    return [{
      googlePlaceId: identity.googlePlaceId,
      businessName: identity.businessName,
      category: identity.category,
      visitId: visit.visitId,
      timestamp: visit.sourceReport.timestamp,
      loggedOutcome: visit.sourceReport.outcome,
      conversations: visit.sourceReport.conversations,
      leads: visit.sourceReport.leads,
      units: visit.sourceReport.units,
      laterUnits: visit.sourceReport.laterUnits
    }];
  });
  const historyUpdates = {
    schemaVersion: routeIqFieldSessionArchiveVersion,
    sessionId,
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    recordKind: "field_session_history_updates",
    representativeHistory: {
      representativeId: report.representative.id,
      fieldSessionDate: report.date,
      totals: clone(normalizedRecord.verifiedFields.totals)
    },
    territoryHistory: {
      status: territoryId ? "available" : "unavailable",
      territoryId,
      reason: territoryId ? null : "The final export does not contain a territory identifier."
    },
    customerOutcomeHistory: customerOutcomes,
    categoryOutcomeHistory: clone(calculatedMetrics.calculations.categoryOutcomes),
    intelligenceLearningHandoff: {
      status: "not_authorized",
      readOnly: true,
      scoringMutationAllowed: false,
      reason: "A separate verified Intelligence consumer authorization is required."
    }
  };

  return {
    sessionId,
    rawReportText: input.rawReportText,
    rawSha256: validated.rawSha256,
    rawByteLength: validated.rawByteLength,
    normalizedRecord,
    calculatedMetrics,
    stressTestEvidence,
    historyUpdates
  };
}

export function fieldSessionStorageKeys(workspaceId, sessionId) {
  assertWorkspace(workspaceId, supportedFieldSessionWorkspaces[workspaceId]?.operatingProfileId || "");
  const base = `${routeIqFieldSessionStoragePrefix}/workspaces/${workspaceId}/sessions/${sessionId}`;
  return Object.freeze({
    base,
    raw: `${base}/raw-report.json`,
    normalized: `${base}/normalized-field-session.json`,
    calculated: `${base}/calculated-metrics.json`,
    stressTestEvidence: `${base}/stress-test-evidence.json`,
    historyUpdates: `${base}/history-updates.json`,
    historyRoot: `${routeIqFieldSessionStoragePrefix}/workspaces/${workspaceId}/histories`,
    commit: `${base}/commit.json`
  });
}

function historyStorageEntries(archivePackage, keys) {
  const record = archivePackage.normalizedRecord;
  const history = archivePackage.historyUpdates;
  const common = {
    schemaVersion: routeIqFieldSessionArchiveVersion,
    workspaceId: record.workspaceId,
    operatingProfileId: record.operatingProfileId,
    sessionId: record.sessionId
  };
  const entries = [{
    key: `${keys.historyRoot}/representatives/${sessionSlugPart(history.representativeHistory.representativeId)}/sessions/${record.sessionId}.json`,
    value: {
      ...common,
      recordKind: "representative_field_session_history_entry",
      history: history.representativeHistory
    }
  }];
  if (history.territoryHistory.status === "available" && history.territoryHistory.territoryId) {
    entries.push({
      key: `${keys.historyRoot}/territories/${sessionSlugPart(history.territoryHistory.territoryId)}/sessions/${record.sessionId}.json`,
      value: {
        ...common,
        recordKind: "territory_field_session_history_entry",
        history: history.territoryHistory
      }
    });
  }
  for (const customer of history.customerOutcomeHistory) {
    entries.push({
      key: `${keys.historyRoot}/customers/${encodeURIComponent(customer.googlePlaceId)}/sessions/${record.sessionId}/${customer.visitId}.json`,
      value: {
        ...common,
        recordKind: "customer_field_session_history_entry",
        history: customer
      }
    });
  }
  for (const category of history.categoryOutcomeHistory) {
    entries.push({
      key: `${keys.historyRoot}/categories/${sessionSlugPart(category.category)}/sessions/${record.sessionId}.json`,
      value: {
        ...common,
        recordKind: "category_field_session_history_entry",
        history: category
      }
    });
  }
  return entries;
}

export function validateFieldSessionStoreBinding(env = {}, options = {}) {
  const bindingName = options.bindingName || routeIqFieldSessionStoreBinding;
  const binding = env?.[bindingName];
  const missingMethods = ["get", "put", "list"].filter(method => typeof binding?.[method] !== "function");
  return {
    ok: missingMethods.length === 0,
    bindingName,
    storageTechnology: routeIqFieldSessionStorageTechnology,
    missingMethods
  };
}

export function createCloudflareKvFieldSessionStore(env = {}, options = {}) {
  const validation = validateFieldSessionStoreBinding(env, options);
  if (!validation.ok) throw new FieldSessionStoreBindingError(validation.bindingName, validation.missingMethods);
  const binding = env[validation.bindingName];
  return Object.freeze({
    bindingName: validation.bindingName,
    storageTechnology: validation.storageTechnology,
    get(key) {
      return binding.get(key);
    },
    put(key, value, putOptions) {
      return binding.put(key, value, putOptions);
    },
    list(options) {
      return binding.list(options);
    }
  });
}

function parseStoredJson(value, key) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new FieldSessionArchiveError(`Stored field-session artifact ${key} is corrupt.`, {
      code: "field_session_stored_artifact_corrupt",
      status: 500,
      details: { key, message: error.message }
    });
  }
}

function assertSameSessionArtifact(artifact, workspaceId, sessionId, label) {
  if (artifact?.workspaceId !== workspaceId || artifact?.sessionId !== sessionId) {
    throw new FieldSessionArchiveError(`${label} has cross-workspace or cross-session contamination.`, {
      code: "field_session_stored_artifact_scope_mismatch",
      status: 500,
      details: { label, workspaceId, sessionId }
    });
  }
}

export async function persistRouteIqFieldSessionArchive(archivePackage, options = {}) {
  const normalized = archivePackage?.normalizedRecord;
  if (!normalized) {
    throw new FieldSessionArchiveError("A normalized field-session archive package is required.", {
      code: "field_session_archive_package_missing"
    });
  }
  assertWorkspace(normalized.workspaceId, normalized.operatingProfileId, normalized.verifiedFields?.representative?.id);
  if (normalized.sessionId !== archivePackage.sessionId) {
    throw new FieldSessionArchiveError("Archive package session identities do not match.", {
      code: "field_session_archive_identity_mismatch"
    });
  }
  if (typeof archivePackage.rawReportText !== "string" || sha256(archivePackage.rawReportText) !== archivePackage.rawSha256) {
    throw new FieldSessionArchiveError("Archive package raw evidence does not match its SHA-256.", {
      code: "field_session_archive_package_raw_hash_mismatch"
    });
  }
  for (const [label, artifact] of [
    ["Calculated metrics", archivePackage.calculatedMetrics],
    ["Stress-test evidence", archivePackage.stressTestEvidence],
    ["History updates", archivePackage.historyUpdates]
  ]) {
    assertSameSessionArtifact(artifact, normalized.workspaceId, archivePackage.sessionId, label);
  }

  const store = options.store || createCloudflareKvFieldSessionStore(options.env, options);
  const keys = fieldSessionStorageKeys(normalized.workspaceId, archivePackage.sessionId);
  const existingCommit = parseStoredJson(await store.get(keys.commit), keys.commit);
  if (existingCommit) {
    assertSameSessionArtifact(existingCommit, normalized.workspaceId, archivePackage.sessionId, "Commit marker");
    if (existingCommit.rawSha256 !== archivePackage.rawSha256) {
      throw new FieldSessionConflictError(archivePackage.sessionId, existingCommit.rawSha256, archivePackage.rawSha256);
    }
    await readRouteIqFieldSessionArchive({
      workspaceId: normalized.workspaceId,
      operatingProfileId: normalized.operatingProfileId,
      sessionId: archivePackage.sessionId
    }, { store });
    return {
      ok: true,
      persisted: true,
      duplicate: true,
      status: "already_archived",
      sessionId: archivePackage.sessionId,
      workspaceId: normalized.workspaceId,
      rawSha256: archivePackage.rawSha256,
      keys: existingCommit.keys || keys,
      bindingName: store.bindingName || null,
      storageTechnology: store.storageTechnology || "custom_store"
    };
  }

  const existingRaw = await store.get(keys.raw);
  if (existingRaw !== null && sha256(existingRaw) !== archivePackage.rawSha256) {
    throw new FieldSessionConflictError(archivePackage.sessionId, sha256(existingRaw), archivePackage.rawSha256);
  }

  const persistedAt = requireIso(options.persistedAt || new Date().toISOString(), "Field-session persistedAt");
  const json = value => JSON.stringify(value, null, 2) + "\n";
  const historyEntries = historyStorageEntries(archivePackage, keys);
  if (existingRaw === null) {
    await store.put(keys.raw, archivePackage.rawReportText, {
      metadata: {
        workspaceId: normalized.workspaceId,
        sessionId: archivePackage.sessionId,
        rawSha256: archivePackage.rawSha256,
        appendOnly: true
      }
    });
  }
  await store.put(keys.normalized, json(archivePackage.normalizedRecord));
  await store.put(keys.calculated, json(archivePackage.calculatedMetrics));
  await store.put(keys.stressTestEvidence, json(archivePackage.stressTestEvidence));
  await store.put(keys.historyUpdates, json(archivePackage.historyUpdates));
  for (const entry of historyEntries) {
    await store.put(entry.key, json(entry.value));
  }

  const commit = {
    schemaVersion: routeIqFieldSessionArchiveVersion,
    sessionId: archivePackage.sessionId,
    workspaceId: normalized.workspaceId,
    operatingProfileId: normalized.operatingProfileId,
    rawSha256: archivePackage.rawSha256,
    rawByteLength: archivePackage.rawByteLength,
    persistedAt,
    status: "committed",
    appendOnlyRawEvidence: true,
    keys: {
      ...keys,
      historyEntries: historyEntries.map(entry => entry.key)
    }
  };
  await store.put(keys.commit, json(commit));

  return {
    ok: true,
    persisted: true,
    duplicate: false,
    status: "archived",
    sessionId: archivePackage.sessionId,
    workspaceId: normalized.workspaceId,
    rawSha256: archivePackage.rawSha256,
    keys: commit.keys,
    bindingName: store.bindingName || null,
    storageTechnology: store.storageTechnology || "custom_store"
  };
}

export async function consumeRouteIqEndOfDayHandoff(input = {}, options = {}) {
  if (input.handoffContractId !== routeIqEndOfDayHandoffContractId) {
    throw new FieldSessionArchiveError("End-of-day handoff contract identifier is missing or invalid.", {
      code: "field_session_handoff_contract_mismatch",
      status: 400
    });
  }
  if (input.producerSubsystem !== "Prometheus Dashboard") {
    throw new FieldSessionArchiveError("Only Prometheus Dashboard may produce the automatic end-of-day handoff.", {
      code: "field_session_handoff_producer_unauthorized",
      status: 403
    });
  }
  const sourceFinalizedAt = requireIso(input.sourceFinalizedAt, "Handoff sourceFinalizedAt");
  const validated = validateFinalRouteIqReport(input.rawReportText, input);
  if (new Date(sourceFinalizedAt).getTime() < new Date(validated.normalizedReport.generatedAt).getTime()) {
    throw new FieldSessionArchiveError("Dashboard finalization predates the source report export.", {
      code: "field_session_handoff_finalization_invalid",
      status: 409
    });
  }
  const sessionId = deterministicFieldSessionId({
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId,
    representativeId: validated.normalizedReport.representative.id,
    date: validated.normalizedReport.date
  });
  const rawStorageKey = fieldSessionStorageKeys(input.workspaceId, sessionId).raw;
  const archivePackage = createRouteIqFieldSessionArchivePackage({
    ...input,
    originalFileName: input.originalFileName || `prometheus-iq-${validated.normalizedReport.representative.id}-daily-report-${validated.normalizedReport.date}.json`,
    canonicalRawArtifactPath: rawStorageKey,
    finalityBasis: "Dashboard finalized the session through route-iq-end-of-day-data-handoff-v1.",
    ingestedAt: options.ingestedAt || sourceFinalizedAt,
    runtimePools: options.runtimePools,
    activePool: options.activePool,
    businessHours: options.businessHours,
    stressTestEvidence: input.stressTestEvidence || null
  });
  const persistence = await persistRouteIqFieldSessionArchive(archivePackage, options);
  return {
    ...persistence,
    handoffContractId: routeIqEndOfDayHandoffContractId,
    sourceFinalizedAt,
    normalizedRecord: archivePackage.normalizedRecord,
    calculatedMetrics: archivePackage.calculatedMetrics,
    historyUpdates: archivePackage.historyUpdates
  };
}

export async function readRouteIqFieldSessionArchive(input = {}, options = {}) {
  const workspace = supportedFieldSessionWorkspaces[input.workspaceId];
  if (!workspace) assertWorkspace(input.workspaceId, "");
  assertWorkspace(input.workspaceId, input.operatingProfileId || workspace.operatingProfileId);
  requireNonEmptyString(input.sessionId, "Field-session id");
  const store = options.store || createCloudflareKvFieldSessionStore(options.env, options);
  const keys = fieldSessionStorageKeys(input.workspaceId, input.sessionId);
  const commit = parseStoredJson(await store.get(keys.commit), keys.commit);
  if (!commit) return { ok: true, found: false, record: null };
  assertSameSessionArtifact(commit, input.workspaceId, input.sessionId, "Commit marker");

  const [rawReportText, normalizedText, calculatedText, stressText, historyText] = await Promise.all([
    store.get(keys.raw),
    store.get(keys.normalized),
    store.get(keys.calculated),
    store.get(keys.stressTestEvidence),
    store.get(keys.historyUpdates)
  ]);
  if ([rawReportText, normalizedText, calculatedText, stressText, historyText].some(value => value === null)) {
    throw new FieldSessionArchiveError(`Committed field session ${input.sessionId} is incomplete.`, {
      code: "field_session_committed_record_incomplete",
      status: 500
    });
  }
  const historyEntryKeys = Array.isArray(commit.keys?.historyEntries) ? commit.keys.historyEntries : [];
  const historyEntryValues = await Promise.all(historyEntryKeys.map(key => store.get(key)));
  if (historyEntryValues.some(value => value === null)) {
    throw new FieldSessionArchiveError(`Committed field session ${input.sessionId} has incomplete history indexes.`, {
      code: "field_session_history_index_incomplete",
      status: 500
    });
  }
  if (sha256(rawReportText) !== commit.rawSha256) {
    throw new FieldSessionArchiveError(`Raw evidence hash mismatch for ${input.sessionId}.`, {
      code: "field_session_raw_hash_mismatch",
      status: 500
    });
  }

  const normalizedRecord = parseStoredJson(normalizedText, keys.normalized);
  const calculatedMetrics = parseStoredJson(calculatedText, keys.calculated);
  const stressTestEvidence = parseStoredJson(stressText, keys.stressTestEvidence);
  const historyUpdates = parseStoredJson(historyText, keys.historyUpdates);
  for (const [label, artifact] of [
    ["Normalized record", normalizedRecord],
    ["Calculated metrics", calculatedMetrics],
    ["Stress-test evidence", stressTestEvidence],
    ["History updates", historyUpdates]
  ]) {
    assertSameSessionArtifact(artifact, input.workspaceId, input.sessionId, label);
  }

  return {
    ok: true,
    found: true,
    record: {
      commit,
      rawReportText,
      normalizedRecord,
      calculatedMetrics,
      stressTestEvidence,
      historyUpdates,
      historyIndexEntries: historyEntryValues.map((value, index) => parseStoredJson(value, historyEntryKeys[index])),
      sourceArtifacts: deepFreeze({
        raw: { key: keys.raw, sha256: sha256(rawReportText), byteLength: Buffer.byteLength(rawReportText), text: rawReportText },
        normalized: { key: keys.normalized, sha256: sha256(normalizedText), byteLength: Buffer.byteLength(normalizedText), text: normalizedText },
        calculated: { key: keys.calculated, sha256: sha256(calculatedText), byteLength: Buffer.byteLength(calculatedText), text: calculatedText },
        stressTestEvidence: { key: keys.stressTestEvidence, sha256: sha256(stressText), byteLength: Buffer.byteLength(stressText), text: stressText },
        historyUpdates: { key: keys.historyUpdates, sha256: sha256(historyText), byteLength: Buffer.byteLength(historyText), text: historyText }
      })
    }
  };
}

function projectionTimestamp(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new FieldSessionArchiveError(`${label} must be a canonical UTC timestamp.`, {
      code: "field_session_evidence_timestamp_invalid",
      details: { label, value: value ?? null }
    });
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new FieldSessionArchiveError(`${label} must be a canonical UTC timestamp.`, {
      code: "field_session_evidence_timestamp_invalid",
      details: { label, value }
    });
  }
  return { iso: new Date(time).toISOString(), time };
}

function evidenceContext(record, visit = null, customer = null) {
  return {
    workspaceId: record.workspaceId,
    operatingProfileId: record.operatingProfileId,
    representativeId: record.verifiedFields?.representative?.id ?? null,
    territoryId: record.verifiedFields?.territoryId ?? null,
    customerId: customer?.googlePlaceId ?? visit?.governedBusinessIdentity?.googlePlaceId ?? null,
    customerName: customer?.businessName ?? visit?.governedBusinessIdentity?.businessName ?? visit?.sourceReport?.placeName ?? null
  };
}

function verifyProspectiveLifecycleForProjection(lifecycle, expectedScope) {
  throw new FieldSessionArchiveError("Workers KV prospective lifecycle records are non-authoritative cache artifacts and cannot supply readiness evidence.", {
    code: "field_session_prospective_kv_authority_superseded",
    status: 409,
    details: {
      authority: lifecycle?.authority ?? "legacy_workers_kv",
      requiredAuthority: "sqlite_durable_object_coordinator"
    }
  });
  /* c8 ignore start -- retained only for byte-compatible legacy cache readback. */
  if (!lifecycle || lifecycle.lifecycleVersion !== "route-iq-prospective-shadow-evidence-lifecycle-v1") {
    throw new FieldSessionArchiveError("A canonical prospective lifecycle read record is required.", {
      code: "field_session_prospective_lifecycle_invalid"
    });
  }
  const scope = lifecycle.scope || {};
  if (scope.workspaceId !== expectedScope.workspaceId
    || scope.operatingProfileId !== expectedScope.operatingProfileId
    || scope.representativeId !== expectedScope.representativeId) {
    throw new FieldSessionArchiveError("Prospective lifecycle scope does not match the chronological projection.", {
      code: "field_session_evidence_scope_mismatch",
      details: { source: "prospective_lifecycle" }
    });
  }
  if (lifecycle.recommendationInfluence !== "off"
    || lifecycle.collectionActivation !== "inactive_until_infrastructure_and_dashboard_owner_wiring") {
    throw new FieldSessionArchiveError("Prospective lifecycle activation boundaries are invalid.", {
      code: "field_session_prospective_lifecycle_activation_invalid"
    });
  }
  const readBody = Object.fromEntries(Object.entries(lifecycle).filter(([key]) => key !== "lifecycleReadSha256"));
  if (typeof lifecycle.lifecycleReadSha256 !== "string"
    || sha256(stableJson(readBody)) !== lifecycle.lifecycleReadSha256) {
    throw new FieldSessionArchiveError("Prospective lifecycle read digest is invalid.", {
      code: "field_session_prospective_lifecycle_digest_mismatch",
      status: 500
    });
  }

  const artifacts = [
    ...(lifecycle.records || []),
    ...(lifecycle.exclusions || []),
    ...(lifecycle.conflicts || [])
  ];
  const artifactIds = new Set();
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.artifactId !== "string" || !artifact.artifactId || artifactIds.has(artifact.artifactId)) {
      throw new FieldSessionArchiveError("Prospective lifecycle artifact IDs must be present and unique.", {
        code: "field_session_prospective_lifecycle_artifact_id_invalid"
      });
    }
    artifactIds.add(artifact.artifactId);
    if (artifact.opportunityId !== lifecycle.opportunityId
      || artifact.scope?.workspaceId !== scope.workspaceId
      || artifact.scope?.operatingProfileId !== scope.operatingProfileId
      || artifact.scope?.representativeId !== scope.representativeId
      || artifact.scope?.fieldSessionId !== scope.fieldSessionId) {
      throw new FieldSessionArchiveError("Prospective lifecycle artifact scope is contaminated.", {
        code: "field_session_evidence_scope_mismatch",
        details: { sourceRecordId: artifact.artifactId }
      });
    }
    const source = lifecycle.sourceArtifacts?.[artifact.artifactId];
    if (!source?.artifact || !source?.commit) {
      throw new FieldSessionArchiveError("Prospective lifecycle source artifacts are incomplete.", {
        code: "field_session_evidence_source_artifacts_missing",
        status: 500,
        details: { sourceRecordId: artifact.artifactId }
      });
    }
    for (const [kind, sourceArtifact] of Object.entries(source)) {
      if (typeof sourceArtifact.text !== "string" || sha256(sourceArtifact.text) !== sourceArtifact.sha256) {
        throw new FieldSessionArchiveError("Prospective lifecycle source bytes failed hash verification.", {
          code: "field_session_evidence_source_hash_mismatch",
          status: 500,
          details: { sourceRecordId: artifact.artifactId, artifact: kind }
        });
      }
    }
    let parsedArtifact;
    let parsedCommit;
    try {
      parsedArtifact = JSON.parse(source.artifact.text);
      parsedCommit = JSON.parse(source.commit.text);
    } catch {
      throw new FieldSessionArchiveError("Prospective lifecycle source bytes are not canonical JSON.", {
        code: "field_session_evidence_source_hash_mismatch",
        status: 500,
        details: { sourceRecordId: artifact.artifactId }
      });
    }
    if (stableJson(parsedArtifact) !== stableJson(artifact)
      || sha256(stableJson(Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== "recordSha256")))) !== artifact.recordSha256) {
      throw new FieldSessionArchiveError("Prospective lifecycle parsed evidence differs from immutable bytes.", {
        code: "field_session_evidence_source_hash_mismatch",
        status: 500,
        details: { sourceRecordId: artifact.artifactId, artifact: "artifact" }
      });
    }
    const commitBody = Object.fromEntries(Object.entries(parsedCommit).filter(([key]) => key !== "commitSha256"));
    if (parsedCommit.status !== "committed"
      || sha256(stableJson(commitBody)) !== parsedCommit.commitSha256
      || parsedCommit.recordSha256 !== artifact.recordSha256
      || parsedCommit.artifactSha256 !== source.artifact.sha256
      || parsedCommit.artifactId !== artifact.artifactId) {
      throw new FieldSessionArchiveError("Prospective lifecycle commit is invalid.", {
        code: "field_session_evidence_commit_mismatch",
        status: 500,
        details: { sourceRecordId: artifact.artifactId }
      });
    }
  }
  if (lifecycle.acceptedSnapshot !== null) {
    const matchingSnapshot = (lifecycle.records || []).find(item => item.artifactKind === "accepted_snapshot");
    if (!matchingSnapshot || stableJson(matchingSnapshot) !== stableJson(lifecycle.acceptedSnapshot)) {
      throw new FieldSessionArchiveError("Prospective lifecycle accepted snapshot does not match its immutable record.", {
        code: "field_session_prospective_lifecycle_snapshot_mismatch",
        status: 500
      });
    }
  }

  const snapshot = lifecycle.acceptedSnapshot;
  const context = {
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    territoryId: snapshot?.context?.territory?.territoryId ?? null,
    customerId: null,
    customerName: null
  };
  const candidates = [];
  const exclusions = [];
  for (const artifact of lifecycle.records || []) {
    const source = lifecycle.sourceArtifacts[artifact.artifactId];
    const provenance = {
      sessionId: scope.fieldSessionId,
      sourceRawSha256: null,
      sourceArtifactHashes: {
        artifact: source.artifact.sha256,
        commit: source.commit.sha256
      },
      prospectiveLifecycleVersion: lifecycle.lifecycleVersion,
      opportunityId: lifecycle.opportunityId,
      recordSha256: artifact.recordSha256
    };
    if (artifact.recordOrigin !== "prospective" || artifact.immutable !== true || artifact.appendOnly !== true) {
      exclusions.push({
        sourceRecordId: artifact.artifactId,
        evidenceKind: null,
        reason: "noncanonical_prospective_lifecycle_record"
      });
      continue;
    }
    if (artifact.artifactKind === "accepted_snapshot") {
      candidates.push({
        evidenceKind: "prospective_opportunity_snapshot",
        sourceRecordId: artifact.artifactId,
        evidenceTimestamp: artifact.capturedAt,
        context,
        payload: clone(artifact),
        relation: { type: "original", priorSourceRecordId: null },
        provenance
      });
    } else if (artifact.artifactKind === "action") {
      candidates.push({
        evidenceKind: "prospective_opportunity_action",
        sourceRecordId: artifact.artifactId,
        evidenceTimestamp: artifact.occurredAt,
        context: { ...context, customerId: artifact.selectedCandidateId ?? null },
        payload: clone(artifact),
        relation: { type: "original", priorSourceRecordId: null },
        provenance
      });
    } else if (artifact.artifactKind === "outcome") {
      candidates.push({
        evidenceKind: "prospective_opportunity_outcome",
        sourceRecordId: artifact.artifactId,
        evidenceTimestamp: artifact.observedAt,
        context: { ...context, customerId: artifact.evaluatedCandidateId ?? null },
        payload: clone(artifact),
        relation: { type: "original", priorSourceRecordId: null },
        provenance
      });
    } else if (artifact.artifactKind === "correction") {
      candidates.push({
        evidenceKind: "prospective_outcome_correction",
        sourceRecordId: artifact.artifactId,
        evidenceTimestamp: artifact.correctedAt,
        context: { ...context, customerId: artifact.replacement?.evaluatedCandidateId ?? null },
        payload: clone(artifact),
        relation: { type: "correction", priorSourceRecordId: artifact.targetRecordId },
        provenance
      });
    } else {
      exclusions.push({ sourceRecordId: artifact.artifactId, evidenceKind: null, reason: "unsupported_prospective_lifecycle_kind" });
    }
  }
  for (const artifact of lifecycle.exclusions || []) {
    exclusions.push({
      sourceRecordId: artifact.artifactId,
      evidenceKind: null,
      evidenceTimestamp: artifact.detectedAt,
      reason: "governed_prospective_exclusion",
      reasonCodes: clone(artifact.reasonCodes || [])
    });
  }
  for (const artifact of lifecycle.conflicts || []) {
    exclusions.push({
      sourceRecordId: artifact.artifactId,
      evidenceKind: null,
      evidenceTimestamp: artifact.detectedAt,
      reason: "governed_prospective_conflict"
    });
  }
  return { candidates, exclusions };
  /* c8 ignore stop */
}

function verifyProspectiveCoordinatorProjectionForChronology(record, expectedScope) {
  if (!record
    || record.schemaVersion !== "route-iq-prospective-coordinator-schema-v1"
    || record.authority !== "sqlite_durable_object_coordinator"
    || !record.projection
    || !record.commit) {
    throw new FieldSessionArchiveError("A committed SQLite coordinator projection is required.", {
      code: "field_session_prospective_coordinator_projection_invalid"
    });
  }
  const { projection, commit } = record;
  if (projection.projectionVersion !== "route-iq-prospective-coordinator-projection-v1"
    || projection.authority !== "sqlite_durable_object_coordinator"
    || typeof projection.territoryId !== "string"
    || !/^riq_territory_[a-f0-9]{64}$/.test(projection.territoryId)
    || projection.recommendationInfluence !== "off"
    || projection.collectionDefault !== "off"
    || projection.kvAuthority !== "non_authoritative_cache_only") {
    throw new FieldSessionArchiveError("Prospective coordinator projection authority boundaries are invalid.", {
      code: "field_session_prospective_coordinator_authority_invalid"
    });
  }
  if (projection.scope?.workspaceId !== expectedScope.workspaceId
    || projection.scope?.operatingProfileId !== expectedScope.operatingProfileId
    || projection.scope?.representativeId !== expectedScope.representativeId) {
    throw new FieldSessionArchiveError("Prospective coordinator scope does not match the chronological projection.", {
      code: "field_session_evidence_scope_mismatch",
      details: { source: "prospective_sqlite_coordinator" }
    });
  }
  const projectionSha256 = sha256(stableJson(projection));
  const commitBody = Object.fromEntries(Object.entries(commit).filter(([key]) => key !== "commitSha256"));
  if (commit.status !== "committed"
    || commit.projectionCommitMarkerWrittenLast !== true
    || commit.projectionSha256 !== projectionSha256
    || typeof commit.commitSha256 !== "string"
    || sha256(stableJson(commitBody)) !== commit.commitSha256) {
    throw new FieldSessionArchiveError("Prospective coordinator projection commit marker is invalid.", {
      code: "field_session_prospective_coordinator_commit_invalid",
      status: 500
    });
  }
  const sources = projection.sourceArtifacts || [];
  if (!Array.isArray(sources)) {
    throw new FieldSessionArchiveError("Prospective coordinator source artifacts must be an array.", {
      code: "field_session_evidence_source_artifacts_missing",
      status: 500
    });
  }
  const sourceById = new Map();
  for (const source of sources) {
    if (!source?.artifactId || sourceById.has(source.artifactId)
      || typeof source.recordSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.recordSha256)) {
      throw new FieldSessionArchiveError("Prospective coordinator artifact IDs must be globally unique.", {
        code: "field_session_prospective_lifecycle_artifact_id_invalid",
        status: 500
      });
    }
    sourceById.set(source.artifactId, source);
  }
  if (projection.readinessEvidenceEligible !== true && (projection.evidence || []).length) {
    throw new FieldSessionArchiveError("Unsealed or excluded coordinator state cannot carry readiness evidence.", {
      code: "field_session_prospective_coordinator_unsealed_evidence",
      status: 500
    });
  }
  const context = {
    workspaceId: projection.scope.workspaceId,
    operatingProfileId: projection.scope.operatingProfileId,
    representativeId: projection.scope.representativeId,
    territoryId: projection.territoryId,
    customerId: null,
    customerName: null
  };
  const candidates = (projection.evidence || []).map(item => {
    const source = sourceById.get(item.sourceRecordId);
    if (!source || source.recordSha256 !== item.recordSha256
      || item.canonicalEvidenceEligible !== true
      || item.recommendationInfluence !== "off") {
      throw new FieldSessionArchiveError("Coordinator evidence does not match its immutable source registry.", {
        code: "field_session_evidence_source_hash_mismatch",
        status: 500,
        details: { sourceRecordId: item.sourceRecordId }
      });
    }
    return {
      evidenceKind: item.evidenceKind,
      sourceRecordId: item.sourceRecordId,
      evidenceTimestamp: item.evidenceTimestamp,
      context: {
        ...context,
        customerId: item.payload?.selectedCandidateId ?? item.payload?.evaluatedCandidateId ?? null
      },
      payload: clone(item.payload),
      relation: item.evidenceKind === "prospective_outcome_correction"
        ? { type: "correction", priorSourceRecordId: item.payload?.targetArtifactId ?? null }
        : { type: "original", priorSourceRecordId: null },
      provenance: {
        coordinatorId: projection.coordinatorId,
        opportunityId: projection.opportunityId,
        projectionId: commit.projectionId,
        projectionSha256,
        recordSha256: item.recordSha256,
        recordSequence: item.recordSequence,
        storageAuthority: "sqlite_durable_object_coordinator"
      }
    };
  });
  const exclusions = (projection.exclusions || []).map(item => ({
    sourceRecordId: item.sourceRecordId,
    evidenceKind: null,
    evidenceTimestamp: item.evidenceTimestamp,
    reason: item.reason,
    recordSequence: item.recordSequence
  }));
  return { candidates, exclusions };
}

export function projectRouteIqChronologicalEvidence(input = {}) {
  const archive = input.archiveRecord;
  if (!archive?.normalizedRecord || !archive?.historyUpdates || !archive?.stressTestEvidence) {
    throw new FieldSessionArchiveError("A complete committed field-session read record is required.", {
      code: "field_session_evidence_archive_incomplete"
    });
  }
  const record = archive.normalizedRecord;
  const representativeId = record.verifiedFields?.representative?.id;
  assertWorkspace(input.workspaceId, input.operatingProfileId, input.representativeId);
  if (record.workspaceId !== input.workspaceId || record.operatingProfileId !== input.operatingProfileId
    || representativeId !== input.representativeId) {
    throw new FieldSessionArchiveError("Chronological evidence scope does not match the committed field session.", {
      code: "field_session_evidence_scope_mismatch",
      details: { requested: { workspaceId: input.workspaceId, operatingProfileId: input.operatingProfileId, representativeId: input.representativeId } }
    });
  }
  const commit = archive.commit;
  const normalizedRawSha256 = record.sourceProvenance?.rawSha256;
  const commitScopeMismatch = !commit
    || commit.status !== "committed"
    || (commit.workspaceId !== undefined && commit.workspaceId !== record.workspaceId)
    || (commit.sessionId !== undefined && commit.sessionId !== record.sessionId)
    || (commit.operatingProfileId !== undefined && commit.operatingProfileId !== record.operatingProfileId);
  if (commitScopeMismatch || typeof commit.rawSha256 !== "string" || !commit.rawSha256
    || commit.rawSha256 !== normalizedRawSha256) {
    throw new FieldSessionArchiveError("Chronological evidence requires a matching committed archive record.", {
      code: "field_session_evidence_commit_mismatch",
      status: 500,
      details: { sessionId: record.sessionId }
    });
  }
  const cutoff = projectionTimestamp(input.decisionTimestamp, "Decision timestamp");
  const sourceArtifacts = archive.sourceArtifacts || {};
  const requiredArtifacts = ["raw", "normalized", "calculated", "stressTestEvidence", "historyUpdates"];
  if (requiredArtifacts.some(name => !sourceArtifacts[name])) {
    throw new FieldSessionArchiveError("Exact committed source artifacts are required for chronological evidence projection.", {
      code: "field_session_evidence_source_artifacts_missing",
      status: 500
    });
  }
  const parsedArtifacts = { normalized: archive.normalizedRecord, calculated: archive.calculatedMetrics, stressTestEvidence: archive.stressTestEvidence, historyUpdates: archive.historyUpdates };
  for (const [name, artifact] of Object.entries(sourceArtifacts)) {
    if (typeof artifact?.text !== "string" || sha256(artifact.text) !== artifact.sha256) {
      throw new FieldSessionArchiveError(`Committed source artifact ${name} failed immutability verification.`, {
        code: "field_session_evidence_source_hash_mismatch",
        status: 500,
        details: { artifact: name }
      });
    }
    if (parsedArtifacts[name] && stableJson(JSON.parse(artifact.text)) !== stableJson(parsedArtifacts[name])) {
      throw new FieldSessionArchiveError(`Parsed source artifact ${name} differs from its immutable bytes.`, {
        code: "field_session_evidence_source_hash_mismatch",
        status: 500,
        details: { artifact: name }
      });
    }
  }
  if (sourceArtifacts.raw.sha256 !== commit.rawSha256) {
    throw new FieldSessionArchiveError("Raw source artifact differs from the commit marker.", {
      code: "field_session_evidence_source_hash_mismatch",
      status: 500,
      details: { artifact: "raw" }
    });
  }

  const candidates = [];
  const lifecycleExclusions = [];
  for (const visit of record.verifiedFields?.completedVisits || []) {
    candidates.push({
      evidenceKind: "visit_decision_context",
      sourceRecordId: `${record.sessionId}:${visit.visitId}:decision-context`,
      evidenceTimestamp: visit.visitDecisionSource?.capturedAt,
      context: evidenceContext(record, visit),
      payload: { visitId: visit.visitId, visitDecisionSource: visit.visitDecisionSource ?? null, recommendationDecisionContext: visit.recommendationDecisionContext ?? null },
      relation: { type: "original", priorSourceRecordId: null }
    }, {
      evidenceKind: "visit_observed_outcome",
      sourceRecordId: `${record.sessionId}:${visit.visitId}:observed-outcome`,
      evidenceTimestamp: visit.sourceReport?.timestamp,
      context: evidenceContext(record, visit),
      payload: { visitId: visit.visitId, outcome: visit.sourceReport?.outcome ?? null, conversations: visit.sourceReport?.conversations ?? null, leads: visit.sourceReport?.leads ?? null, units: visit.sourceReport?.units ?? null, laterUnits: visit.sourceReport?.laterUnits ?? null },
      relation: { type: "original", priorSourceRecordId: null }
    });
  }
  for (const outcome of archive.historyUpdates.customerOutcomeHistory || []) {
    candidates.push({
      evidenceKind: "customer_outcome_observation",
      sourceRecordId: outcome.sourceRecordId || `${record.sessionId}:${outcome.visitId}:customer-outcome`,
      evidenceTimestamp: outcome.evidenceTimestamp || outcome.timestamp,
      context: evidenceContext(record, null, outcome),
      payload: clone(outcome),
      relation: clone(outcome.relation || { type: "original", priorSourceRecordId: null })
    });
  }
  for (const observation of archive.stressTestEvidence.observations || []) {
    candidates.push({
      evidenceKind: "stress_test_observation",
      sourceRecordId: observation.observationId,
      evidenceTimestamp: observation.observedAt,
      context: evidenceContext(record),
      payload: clone(observation),
      relation: { type: "original", priorSourceRecordId: null }
    });
  }
  for (const appended of archive.historyUpdates.chronologicalEvidence || []) candidates.push(clone(appended));
  if (input.prospectiveLifecycleRecord) {
    const prospective = verifyProspectiveLifecycleForProjection(input.prospectiveLifecycleRecord, {
      workspaceId: input.workspaceId,
      operatingProfileId: input.operatingProfileId,
      representativeId: input.representativeId
    });
    candidates.push(...prospective.candidates);
    lifecycleExclusions.push(...prospective.exclusions);
  }
  if (input.prospectiveCoordinatorProjectionRecord) {
    const prospective = verifyProspectiveCoordinatorProjectionForChronology(input.prospectiveCoordinatorProjectionRecord, {
      workspaceId: input.workspaceId,
      operatingProfileId: input.operatingProfileId,
      representativeId: input.representativeId
    });
    candidates.push(...prospective.candidates.filter(candidate => {
      const timestamp = projectionTimestamp(candidate.evidenceTimestamp, "Prospective coordinator evidence timestamp");
      return timestamp.time < cutoff.time;
    }));
    lifecycleExclusions.push(...prospective.exclusions.filter(exclusion => {
      const timestamp = projectionTimestamp(exclusion.evidenceTimestamp, "Prospective coordinator governance timestamp");
      return timestamp.time < cutoff.time;
    }));
  }

  const included = [];
  const exclusions = [...lifecycleExclusions];
  const candidateIds = new Set();
  const preparedCandidates = [];
  for (const candidate of candidates) {
    const id = typeof candidate.sourceRecordId === "string" && candidate.sourceRecordId.trim() ? candidate.sourceRecordId : null;
    if (!id || candidateIds.has(id)) {
      throw new FieldSessionArchiveError("Evidence source record IDs must be present and unique.", { code: "field_session_evidence_source_id_invalid", details: { sourceRecordId: id } });
    }
    candidateIds.add(id);
    const context = candidate.context || {};
    if (context.workspaceId !== record.workspaceId || context.operatingProfileId !== record.operatingProfileId
      || context.representativeId !== representativeId) {
      throw new FieldSessionArchiveError(`Evidence ${id} has cross-scope contamination.`, { code: "field_session_evidence_scope_mismatch", details: { sourceRecordId: id } });
    }
    preparedCandidates.push({ candidate, context, id });
  }

  for (const { candidate, context, id } of preparedCandidates) {
    const evidenceKindSupported = routeIqChronologicalEvidenceKinds.includes(candidate.evidenceKind);
    const governedNonOriginalRelation = ["correction", "conflict", "late"].includes(candidate.relation?.type);
    if (!evidenceKindSupported && !governedNonOriginalRelation) {
      exclusions.push({ sourceRecordId: id, evidenceKind: candidate.evidenceKind ?? null, reason: "unsupported_evidence_kind" });
      continue;
    }
    const relation = candidate.relation;
    const relationTypes = ["original", "correction", "conflict", "late"];
    const priorId = typeof relation?.priorSourceRecordId === "string"
      && relation.priorSourceRecordId === relation.priorSourceRecordId.trim()
      && relation.priorSourceRecordId
      ? relation.priorSourceRecordId
      : null;
    const relationValid = relation && typeof relation === "object" && !Array.isArray(relation)
      && relationTypes.includes(relation.type)
      && (relation.type === "original" ? relation.priorSourceRecordId === null : priorId !== null)
      && priorId !== id;
    if (!relationValid) {
      throw new FieldSessionArchiveError(`Evidence ${id} has an invalid append-only relation.`, {
        code: "field_session_evidence_relation_invalid",
        details: { sourceRecordId: id, relationType: relation?.type ?? null }
      });
    }
    if (relation.type !== "original" && !candidateIds.has(priorId)) {
      throw new FieldSessionArchiveError(`Evidence ${id} references a source record that does not exist.`, {
        code: "field_session_evidence_relation_source_missing",
        details: { sourceRecordId: id, priorSourceRecordId: priorId }
      });
    }
    if (!evidenceKindSupported) {
      exclusions.push({ sourceRecordId: id, evidenceKind: candidate.evidenceKind ?? null, reason: "unsupported_evidence_kind" });
      continue;
    }
    if (candidate.evidenceTimestamp === null || candidate.evidenceTimestamp === undefined) {
      exclusions.push({ sourceRecordId: id, evidenceKind: candidate.evidenceKind, reason: "missing_evidence_timestamp" });
      continue;
    }
    const timestamp = projectionTimestamp(candidate.evidenceTimestamp, `Evidence ${id} timestamp`);
    if (timestamp.time === cutoff.time) {
      exclusions.push({ sourceRecordId: id, evidenceKind: candidate.evidenceKind, evidenceTimestamp: timestamp.iso, reason: "at_decision_timestamp_without_prior_availability" });
      continue;
    }
    if (timestamp.time > cutoff.time) {
      exclusions.push({ sourceRecordId: id, evidenceKind: candidate.evidenceKind, evidenceTimestamp: timestamp.iso, reason: "after_decision_timestamp" });
      continue;
    }
    included.push({
      schemaVersion: routeIqFieldSessionArchiveVersion,
      projectionVersion: routeIqChronologicalEvidenceProjectionVersion,
      evidenceKind: candidate.evidenceKind,
      sourceRecordId: id,
      evidenceTimestamp: timestamp.iso,
      context: { workspaceId: context.workspaceId, operatingProfileId: context.operatingProfileId, representativeId: context.representativeId, territoryId: context.territoryId ?? null, customerId: context.customerId ?? null, customerName: context.customerName ?? null },
      payload: clone(candidate.payload ?? null),
      relation: { type: relation.type, priorSourceRecordId: priorId },
      provenance: candidate.provenance || { sessionId: record.sessionId, sourceRawSha256: commit.rawSha256, sourceArtifactHashes: Object.fromEntries(Object.entries(sourceArtifacts).map(([name, artifact]) => [name, artifact.sha256])) }
    });
  }
  included.sort((a, b) => a.evidenceTimestamp.localeCompare(b.evidenceTimestamp) || a.sourceRecordId.localeCompare(b.sourceRecordId));
  exclusions.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));
  const body = { projectionVersion: routeIqChronologicalEvidenceProjectionVersion, decisionTimestamp: cutoff.iso, scope: { workspaceId: input.workspaceId, operatingProfileId: input.operatingProfileId, representativeId: input.representativeId }, evidence: included, exclusions };
  return deepFreeze({ ...body, projectionSha256: sha256(stableJson(body)) });
}
