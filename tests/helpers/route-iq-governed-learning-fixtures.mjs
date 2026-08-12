import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function loadGovernedLearningWorkspaceRegistry() {
  return readJson(
    "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json"
  );
}

export function loadFitnessGovernedLearningFixture() {
  const source = readJson(
    "data/route-iq-field-sessions-v1/route-iq-governed-learning-source-v1.json"
  );
  const archivePackages = source.sourceSessions.map(session => ({
    evidenceClassification: source.evidenceClassification,
    manifest: readJson(session.manifest),
    verifiedFieldSession: readJson(session.verifiedFieldSession),
    calculatedMetrics: readJson(session.calculatedMetrics),
    historyUpdates: readJson(session.historyUpdates),
    administrativeDisposition: session.administrativeDisposition,
    consumptionEligibility: session.consumptionEligibility,
    correctionChain: session.correctionChain
  }));
  return {
    ...source,
    workspaceRegistry: loadGovernedLearningWorkspaceRegistry(),
    archivePackages
  };
}

function syntheticSession(index) {
  const day = String(index + 1).padStart(2, "0");
  const sessionId = `route-iq-field-session-northstar-general-outside-sales-${day}`;
  const timestamp = `2026-08-${day}T15:00:00.000Z`;
  const ingestedAt = `2026-08-${day}T18:00:00.000Z`;
  const rawSha256 = sha256({ sessionId, kind: "synthetic_nonproduction_fixture" });
  const representativeId = "northstar_synthetic_rep_01";
  const businessId = `northstar_synthetic_business_${day}`;
  const businessName = `Synthetic Industrial Supply ${index + 1}`;
  const visitId = `synthetic_visit_${day}`;
  const totals = {
    totalVisits: 1,
    totalStops: 1,
    totalConversations: 1,
    totalLeads: index === 0 ? 0 : 1,
    totalUnits: 0,
    totalLaterUnits: 0,
    totalMemberships: null
  };
  const outcome = index === 0 ? "Decision maker reached" : "Qualified opportunity";
  const category = "Commercial distribution";
  const customerOutcome = {
    visitId,
    googlePlaceId: businessId,
    businessName,
    category,
    timestamp,
    loggedOutcome: outcome,
    conversations: 1,
    leads: totals.totalLeads,
    units: 0,
    laterUnits: 0,
    memberships: null
  };
  const packageValue = {
    evidenceClassification: "SYNTHETIC_VALIDATION_FIXTURE",
    manifest: {
      schemaVersion: "route-iq-field-session-archive-v1",
      sessionId,
      workspaceId: "northstar_outside_sales_synthetic",
      operatingProfileId: "general_outside_sales",
      representativeId,
      fieldSessionDate: `2026-08-${day}`,
      ingestedAt,
      status: "archived",
      sourceFinality: "governed_final",
      rawSha256,
      recordCounts: {
        fieldSessions: 1,
        completedVisits: 1,
        categoryOutcomeHistoryEntries: 1,
        customerOutcomeHistoryEntries: 1,
        stressTestObservations: 0
      }
    },
    verifiedFieldSession: {
      schemaVersion: "route-iq-field-session-archive-v1",
      recordKind: "verified_field_session",
      handoffContractId: "route-iq-end-of-day-data-handoff-v1",
      sessionId,
      workspaceId: "northstar_outside_sales_synthetic",
      operatingProfileId: "general_outside_sales",
      sourceProvenance: {
        finalExportConfirmed: true,
        ingestedAt,
        rawSha256,
        sourceKind: "synthetic_validation_fixture"
      },
      fieldClassification: {
        calculatedFieldsStoredSeparately: true,
        unavailableValuesRemainNull: true,
        notesAreNotParsedIntoFollowUpOrObjectionClaims: true
      },
      unavailableFields: [],
      verifiedFields: {
        representative: { id: representativeId },
        fieldSessionDate: `2026-08-${day}`,
        exportTimestamp: ingestedAt,
        territoryId: "synthetic_north_territory",
        totals,
        completedVisits: [{
          visitId,
          exportOrder: 1,
          governedBusinessIdentity: {
            runtimeId: businessId,
            googlePlaceId: businessId,
            businessName,
            category,
            matchStatus: "exact_runtime_id"
          },
          sourceReport: {
            date: `2026-08-${day}`,
            timestamp,
            placeId: businessId,
            placeName: businessName,
            timeWindow: index === 0 ? "Morning" : "Afternoon",
            outcome,
            conversations: 1,
            leads: totals.totalLeads,
            units: 0,
            laterUnits: 0
          },
          visitDecisionSource: {
            sourceId: "representative_discovery",
            sourceLabel: "Representative Discovery",
            capturedAt: timestamp
          },
          recommendationDecisionContext: null,
          recommendationEvidence: {
            availability: "unavailable_in_final_export",
            recommendationExplanation: null,
            recommendationPoolSource: null,
            recommendationScore: null
          },
          followUpRequirement: null,
          objections: null
        }]
      }
    },
    calculatedMetrics: {
      schemaVersion: "route-iq-field-session-archive-v1",
      recordKind: "calculated_field_session_metrics",
      sessionId,
      workspaceId: "northstar_outside_sales_synthetic",
      operatingProfileId: "general_outside_sales",
      calculationProvenance: {
        formulasVersion: "route-iq-field-session-metrics-v1",
        sourceRawSha256: rawSha256,
        sourceSessionId: sessionId,
        membershipCountInferredFromOutcomeLabel: false,
        sessionStartOrEndInferred: false
      },
      calculations: {
        firstLoggedVisitAt: timestamp,
        lastLoggedVisitAt: timestamp,
        loggedVisitWindowMinutes: 0,
        conversationPerVisitRatePercent: 100,
        leadPerVisitRatePercent: totals.totalLeads * 100,
        unitPerLeadRatePercent: 0,
        categoryOutcomes: [{
          category,
          visits: 1,
          conversations: 1,
          leads: totals.totalLeads,
          units: 0,
          laterUnits: 0
        }]
      }
    },
    historyUpdates: {
      schemaVersion: "route-iq-field-session-archive-v1",
      recordKind: "field_session_history_updates",
      sessionId,
      workspaceId: "northstar_outside_sales_synthetic",
      operatingProfileId: "general_outside_sales",
      representativeHistory: {
        representativeId,
        fieldSessionDate: `2026-08-${day}`,
        totals
      },
      territoryHistory: {
        status: "available",
        territoryId: "synthetic_north_territory"
      },
      categoryOutcomeHistory: [{
        category,
        visits: 1,
        conversations: 1,
        leads: totals.totalLeads,
        units: 0,
        laterUnits: 0,
        memberships: null
      }],
      customerOutcomeHistory: [customerOutcome],
      intelligenceLearningHandoff: {
        status: "authorized_by_governed_manifest",
        readOnly: true,
        scoringMutationAllowed: false
      }
    },
    administrativeDisposition: null,
    consumptionEligibility: {
      eligible: true,
      state: "AVAILABLE",
      deletionState: "NONE"
    },
    correctionChain: []
  };
  const retentionDecision = {
    sessionId,
    sourceRecordSha256: rawSha256,
    policyVersion: "route-iq-founder-retention-18-month-v1",
    authority: "prometheus_data_authenticated_retention_admission",
    status: "ELIGIBLE_FOR_READ_ONLY_LEARNING",
    createdAt: ingestedAt,
    expiresAt: `2028-02-${day}T18:00:00.000Z`,
    evaluatedAt: "2026-08-12T00:00:00.000Z",
    legalHoldState: "NONE",
    legalHoldVerification: "AUTHENTICATED",
    deletionState: "NONE"
  };
  return { packageValue, retentionDecision };
}

export function createSyntheticGovernedLearningFixture(sessionCount = 2) {
  const sessions = Array.from({ length: sessionCount }, (_, index) => syntheticSession(index));
  return {
    workspaceId: "northstar_outside_sales_synthetic",
    operatingProfileId: "general_outside_sales",
    representativeId: "northstar_synthetic_rep_01",
    evidenceClassification: "SYNTHETIC_VALIDATION_FIXTURE",
    evaluatedAt: "2026-08-12T00:00:00.000Z",
    workspaceRegistry: loadGovernedLearningWorkspaceRegistry(),
    archivePackages: sessions.map(session => session.packageValue),
    retentionDecisions: sessions.map(session => session.retentionDecision)
  };
}
