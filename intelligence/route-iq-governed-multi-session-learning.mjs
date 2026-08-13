import { createHash } from "node:crypto";

import {
  materializeRouteIqEligibleSessionPackages,
  routeIqEligibleSessionManifestVersion
} from "../data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs";
import {
  buildCustomerGraphConsumerContract,
  buildCustomerGraphNode,
  buildCustomerGraphQueryContract,
  buildCustomerGraphRelationship,
  buildCustomerGraphSnapshot,
  queryCustomerGraphSnapshot,
  validateCustomerGraphSnapshot
} from "./customer-intelligence-graph.mjs";
import {
  buildOffRouteLearningSnapshot,
  loadOffRouteLearningContract,
  loadOffRouteLearningPolicy,
  projectCanonicalArchivedVisitEvidence
} from "./off-route-learning-intelligence.mjs";
import {
  getOperatingProfile,
  loadOperatingProfiles,
  normalizeIndustryOutcome,
  operatingProfileOutcomeSemanticDispositionContract,
  validateOperatingProfile
} from "./operating-profile-engine.mjs";
import {
  buildReadOnlyFieldSessionLearningSnapshot,
  loadReadOnlyFieldSessionDataContract,
  loadReadOnlyFieldSessionLearningContract,
  loadReadOnlyFieldSessionLearningPolicy
} from "./read-only-field-session-learning.mjs";

export const routeIqGovernedMultiSessionLearningVersion =
  "route-iq-governed-multi-session-learning-v1";
export const routeIqGovernedLearningAdvisoryContractVersion =
  "route-iq-governed-learning-dashboard-advisory-v1";

const TRUTH_STATES = Object.freeze({
  verified: "Verified",
  observed: "Observed",
  reviewRequired: "Review Required",
  insufficient: "Insufficient Evidence",
  unknown: "Unknown"
});
const SHA256 = /^[a-f0-9]{64}$/u;

export class RouteIqGovernedMultiSessionLearningError extends Error {
  constructor(code) {
    super("Route IQ governed multi-session learning is unavailable.");
    this.name = "RouteIqGovernedMultiSessionLearningError";
    this.code = code;
  }
}

function fail(code) {
  throw new RouteIqGovernedMultiSessionLearningError(code);
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
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function scopedGovernance(manifest) {
  const readOnlyContract = clone(loadReadOnlyFieldSessionLearningContract());
  const readOnlyPolicy = clone(loadReadOnlyFieldSessionLearningPolicy());
  const offRouteContract = clone(loadOffRouteLearningContract());
  const offRoutePolicy = clone(loadOffRouteLearningPolicy());
  for (const value of [readOnlyContract, readOnlyPolicy, offRouteContract, offRoutePolicy]) {
    value.workspaceId = manifest.workspaceId;
    value.operatingProfileId = manifest.operatingProfileId;
  }
  readOnlyContract.workspaceIsolation.requiredWorkspaceId = manifest.workspaceId;
  readOnlyContract.workspaceIsolation.requiredOperatingProfileId = manifest.operatingProfileId;
  readOnlyPolicy.admission.authorizedSessionIds = manifest.entries.map(entry => entry.sessionId);
  if (manifest.evidenceClassification === "SYNTHETIC_VALIDATION_FIXTURE") {
    readOnlyPolicy.admission.requiredSourceFinality = [
      ...new Set([
        ...(readOnlyPolicy.admission.requiredSourceFinality || []),
        "governed_final"
      ])
    ];
  }
  return { readOnlyContract, readOnlyPolicy, offRouteContract, offRoutePolicy };
}

function workspaceMapping(manifest, workspaceRegistry) {
  if (workspaceRegistry?.authority !== "prometheus_administration"
    || !Array.isArray(workspaceRegistry?.workspaces)) {
    fail("route_iq_learning_administration_mapping_invalid");
  }
  const matches = workspaceRegistry.workspaces.filter(workspace => (
    workspace?.workspaceId === manifest.workspaceId
      && workspace?.companyId === manifest.customerId
      && workspace?.operatingProfile?.profileId === manifest.operatingProfileId
  ));
  if (matches.length !== 1
    || manifest.workspaceId === manifest.customerId
    || matches[0].provenance?.owner !== "prometheus_administration") {
    fail("route_iq_learning_customer_mapping_rejected");
  }
  return matches[0];
}

function sourceReference(manifest, id) {
  return [{ source: manifest.manifestId, id }];
}

function graphFromLearning({ manifest, learning, normalizedOutcomes, generatedAt }) {
  const customerId = manifest.customerId;
  const nodes = [];
  const relationships = [];
  const customer = buildCustomerGraphNode({
    customerId,
    nodeType: "Customer",
    sourceRefs: sourceReference(manifest, customerId),
    learnedAt: generatedAt,
    reviewState: "human_review_preserved",
    attributes: {
      workspaceId: manifest.workspaceId,
      evidenceClassification: manifest.evidenceClassification,
      evidenceStatus: TRUTH_STATES.verified
    }
  });
  const profile = buildCustomerGraphNode({
    customerId,
    nodeType: "Operating Profile",
    sourceRefs: sourceReference(manifest, manifest.operatingProfileId),
    learnedAt: generatedAt,
    reviewState: "human_review_preserved",
    attributes: {
      operatingProfileId: manifest.operatingProfileId,
      workspaceId: manifest.workspaceId,
      evidenceStatus: TRUTH_STATES.verified
    }
  });
  const representative = buildCustomerGraphNode({
    customerId,
    nodeType: "Rep",
    sourceRefs: sourceReference(manifest, manifest.representativeId),
    learnedAt: generatedAt,
    reviewState: "human_review_preserved",
    attributes: {
      representativeId: manifest.representativeId,
      workspaceId: manifest.workspaceId,
      evidenceStatus: TRUTH_STATES.observed
    }
  });
  nodes.push(customer, profile, representative);

  const territoryNodes = new Map();
  for (const territory of learning.territoryIntelligence) {
    if (!territory.territoryId) continue;
    const node = buildCustomerGraphNode({
      customerId,
      nodeType: "Territory",
      sourceRefs: sourceReference(manifest, territory.intelligenceId),
      learnedAt: territory.explainability.lastUpdated,
      reviewState: "human_review_preserved",
      attributes: {
        territoryId: territory.territoryId,
        workspaceId: manifest.workspaceId,
        evidenceStatus: territory.confidence.thresholdQualified
          ? TRUTH_STATES.observed
          : TRUTH_STATES.insufficient,
        confidenceBand: territory.confidence.band,
        limitingFactors: [...territory.confidence.limitingFactors]
      }
    });
    territoryNodes.set(territory.territoryId, node);
    nodes.push(node);
  }

  const businessLearning = new Map(learning.businessIntelligence.map(item => [
    item.googlePlaceId,
    item
  ]));
  const businessNodes = new Map();
  for (const normalized of normalizedOutcomes) {
    let businessNode = businessNodes.get(normalized.businessId);
    if (!businessNode) {
      const learnedBusiness = businessLearning.get(normalized.businessId);
      businessNode = buildCustomerGraphNode({
        customerId,
        nodeType: "Business",
        sourceRefs: sourceReference(
          manifest,
          learnedBusiness?.intelligenceId || normalized.evidence.evidenceId
        ),
        learnedAt: learnedBusiness?.explainability.lastUpdated
          || normalized.evidence.visitOccurredAt,
        reviewState: "human_review_preserved",
        confidence: learnedBusiness
          ? {
              confidenceBand: learnedBusiness.confidence.band,
              confidenceScore: learnedBusiness.confidence.score
            }
          : undefined,
        evidenceCount: learnedBusiness?.confidence.evidenceCount.visits || 0,
        attributes: {
          businessId: normalized.businessId,
          businessName: normalized.businessName,
          category: normalized.category,
          workspaceId: manifest.workspaceId,
          evidenceStatus: learnedBusiness
            ? learnedBusiness.confidence.thresholdQualified
              ? TRUTH_STATES.observed
              : TRUTH_STATES.insufficient
            : TRUTH_STATES.reviewRequired,
          limitingFactors: learnedBusiness
            ? [...learnedBusiness.confidence.limitingFactors]
            : ["outcome_semantics_require_human_review"]
        }
      });
      businessNodes.set(normalized.businessId, businessNode);
      nodes.push(businessNode);
    }

    const visitNode = buildCustomerGraphNode({
      customerId,
      nodeType: "Visit",
      sourceRefs: sourceReference(manifest, normalized.sessionId),
      learnedAt: normalized.evidence.visitOccurredAt,
      reviewState: "human_review_preserved",
      attributes: {
        visitId: normalized.visitId,
        sessionId: normalized.sessionId,
        workspaceId: manifest.workspaceId,
        representativeId: manifest.representativeId,
        evidenceStatus: TRUTH_STATES.verified
      }
    });
    const outcomeNode = buildCustomerGraphNode({
      customerId,
      nodeType: "Outcome",
      sourceRefs: sourceReference(manifest, normalized.normalizedOutcomeId),
      learnedAt: normalized.evidence.visitOccurredAt,
      reviewState: normalized.evidence.reviewState,
      attributes: {
        visitId: normalized.visitId,
        rawOutcome: normalized.rawOutcome,
        normalizedOutcome: normalized.normalizedOutcome,
        mappingSource: normalized.mappingSource,
        semanticDisposition: clone(normalized.semanticDisposition),
        admittedEvidence: clone(normalized.evidence.admission),
        workspaceId: manifest.workspaceId,
        evidenceStatus: normalized.evidence.reviewState === "human_review_required"
          ? TRUTH_STATES.reviewRequired
          : TRUTH_STATES.observed
      }
    });
    nodes.push(visitNode, outcomeNode);
    const evidenceIds = [normalized.evidence.evidenceId];
    const semantic = normalized.semanticDisposition;
    const semanticRelationshipType = semantic.relationshipEligible
      ? semantic.relationshipType
      : "Visited";
    if (semanticRelationshipType === "Successful"
      && (!semantic.successEligible
        || semantic.authority.source !== "active_operating_profile.successEvents")) {
      fail("route_iq_learning_success_semantic_authority_rejected");
    }
    if (semanticRelationshipType === "Follow-up"
      && (!semantic.followUpEligible
        || semantic.authority.source
          !== "operating_profile_outcome_semantic_disposition.canonicalFollowUpOutcome")) {
      fail("route_iq_learning_follow_up_semantic_authority_rejected");
    }
    const outcomeRelationship = {
      ...buildCustomerGraphRelationship({
        customerId,
        relationshipType: semanticRelationshipType,
        fromNodeId: visitNode.nodeId,
        toNodeId: outcomeNode.nodeId,
        sourceEvidenceIds: evidenceIds,
        observedAt: normalized.evidence.visitOccurredAt,
        reviewState: normalized.evidence.reviewState
      }),
      semanticDisposition: clone(semantic),
      admittedEvidence: clone(normalized.evidence.admission)
    };
    relationships.push(
      buildCustomerGraphRelationship({
        customerId,
        relationshipType: "Visited",
        fromNodeId: representative.nodeId,
        toNodeId: visitNode.nodeId,
        sourceEvidenceIds: evidenceIds,
        observedAt: normalized.evidence.visitOccurredAt,
        reviewState: "human_review_preserved"
      }),
      buildCustomerGraphRelationship({
        customerId,
        relationshipType: "Visited",
        fromNodeId: visitNode.nodeId,
        toNodeId: businessNode.nodeId,
        sourceEvidenceIds: evidenceIds,
        observedAt: normalized.evidence.visitOccurredAt,
        reviewState: "human_review_preserved"
      }),
      outcomeRelationship
    );
  }

  const snapshot = buildCustomerGraphSnapshot({
    customerId,
    operatingProfileId: manifest.operatingProfileId,
    generatedAt,
    generatedBy: "prometheus_intelligence_engine_governed_multi_session_bridge",
    nodes,
    relationships,
    confidence: {
      confidenceBand: learning.learningConfidence[0]?.band || "insufficient_evidence",
      confidenceScore: learning.learningConfidence[0]?.score ?? null,
      evidenceCount: learning.sourceEvidence.semanticLearningEligibleVisitCount,
      allowedInfluence: "explanation_only",
      propagationActive: false,
      lastValidationAt: generatedAt
    },
    explainability: {
      why: "This Founder-only graph connects admitted field sessions to observed businesses, visits, and outcomes.",
      whatEvidence: `${manifest.totals.sessions} admitted session(s), ${manifest.totals.visits} verified visit(s), and ${learning.sourceEvidence.semanticLearningEligibleVisitCount} semantically eligible visit(s).`,
      howConfident: "Confidence is explanatory only and cannot change routing or recommendations.",
      whatChanged: "No route order, score, pool, replenishment, or recommendation output changed.",
      whatShouldHappenNext: "Collect additional governed sessions until the existing evidence thresholds are met."
    }
  });
  const failures = validateCustomerGraphSnapshot(snapshot);
  if (failures.length) fail("route_iq_learning_customer_graph_invalid");
  return snapshot;
}

function normalizedOutcomesFromPackages(manifest, archivePackages, profiles) {
  const profile = getOperatingProfile(manifest.operatingProfileId, profiles);
  if (validateOperatingProfile(profile, profiles).length) {
    fail("route_iq_learning_operating_profile_invalid");
  }
  const output = [];
  const manifestEntries = new Map(manifest.entries.map(entry => [entry.sessionId, entry]));
  for (const archivePackage of archivePackages) {
    const sessionId = archivePackage.manifest.sessionId;
    const manifestEntry = manifestEntries.get(sessionId);
    if (!manifestEntry
      || manifestEntry.sourceRecordSha256 !== archivePackage.manifest.rawSha256) {
      fail("route_iq_learning_outcome_admission_scope_rejected");
    }
    for (const visit of archivePackage.verifiedFieldSession.verifiedFields.completedVisits) {
      const business = visit.governedBusinessIdentity;
      const report = visit.sourceReport;
      const normalized = normalizeIndustryOutcome({
        profileId: manifest.operatingProfileId,
        rawOutcome: report.outcome,
        truthLevel: "governed_field_session",
        visit: {
          occurredAt: report.timestamp,
          businessRef: { source: "governed_business", id: business.googlePlaceId },
          repRef: { source: "governed_representative", id: manifest.representativeId }
        },
        governedAdmission: {
          admitted: true,
          authority: manifest.authority,
          manifestId: manifest.manifestId,
          manifestSha256: manifest.manifestSha256,
          sourceRecordSha256: manifestEntry.sourceRecordSha256,
          sessionId,
          visitId: visit.visitId
        }
      }, { profile, registry: profiles });
      output.push({
        ...normalized,
        sessionId,
        visitId: visit.visitId,
        businessId: business.googlePlaceId,
        businessName: business.businessName,
        category: business.category || "Unknown",
        timeWindow: report.timeWindow || "Unknown",
        reportedMetrics: {
          conversations: Number(report.conversations || 0),
          leads: Number(report.leads || 0),
          units: Number(report.units || 0),
          laterUnits: Number(report.laterUnits || 0)
        }
      });
    }
  }
  return output.sort((left, right) => (
    left.evidence.visitOccurredAt.localeCompare(right.evidence.visitOccurredAt)
      || left.visitId.localeCompare(right.visitId)
  ));
}

function outcomeSemanticAdmissions(normalizedOutcomes) {
  return normalizedOutcomes.map(outcome => ({
    semanticContractVersion: outcome.semanticDisposition.contractVersion,
    sessionId: outcome.sessionId,
    visitId: outcome.visitId,
    sourceRecordSha256: outcome.evidence.admission.sourceRecordSha256,
    admitted: outcome.evidence.admission.admitted,
    reviewRequired: outcome.semanticDisposition.reviewRequired,
    learningEligible: outcome.semanticDisposition.learningEligible,
    disposition: outcome.semanticDisposition.disposition,
    normalizedOutcome: outcome.normalizedOutcome
  }));
}

function categoryTimePatterns(normalizedOutcomes, learning) {
  const grouped = new Map();
  for (const outcome of normalizedOutcomes) {
    const category = outcome.category;
    const timeWindow = outcome.timeWindow;
    const key = `${category}\u0000${timeWindow}`;
    const current = grouped.get(key) || {
      category,
      timeWindow,
      visits: 0,
      conversations: 0,
      outcomes: new Map(),
      reviewRequiredExclusions: 0
    };
    if (outcome.semanticDisposition.learningEligible) {
      current.visits += 1;
      current.conversations += outcome.reportedMetrics.conversations;
      const rawOutcome = typeof outcome.rawOutcome === "string" && outcome.rawOutcome.trim()
        ? outcome.rawOutcome
        : "Unclassified";
      current.outcomes.set(rawOutcome, (current.outcomes.get(rawOutcome) || 0) + 1);
    } else {
      current.reviewRequiredExclusions += 1;
    }
    grouped.set(key, current);
  }
  const categoryConfidence = new Map(learning.categoryIntelligence.map(item => [
    item.category,
    item.confidence
  ]));
  return [...grouped.values()].sort((left, right) => (
    left.category.localeCompare(right.category) || left.timeWindow.localeCompare(right.timeWindow)
  )).map(item => ({
    category: item.category,
    timeWindow: item.timeWindow,
    visits: item.visits,
    conversations: item.conversations,
    outcomes: Object.fromEntries([...item.outcomes.entries()].sort(([left], [right]) => left.localeCompare(right))),
    reviewRequiredExclusions: item.reviewRequiredExclusions,
    truthState: categoryConfidence.get(item.category)?.thresholdQualified
      ? TRUTH_STATES.observed
      : TRUTH_STATES.insufficient
  }));
}

function additionalEvidenceNeeded(learning) {
  const confidence = learning.learningConfidence.find(item => item.domain === "representative");
  return (confidence?.thresholdChecks || []).filter(check => !check.met).map(check => ({
    metric: check.metric,
    current: check.actual,
    required: check.required,
    remaining: check.actual === null ? check.required : Math.max(0, check.required - check.actual)
  }));
}

function dashboardAdvisory({ manifest, normalizedOutcomes, learning, offRoute, graph, queryResult }) {
  const confidence = learning.learningConfidence.find(item => item.domain === "representative")
    || learning.learningConfidence[0];
  const categoryCandidates = learning.categoryIntelligence
    .filter(item => item.confidence.thresholdQualified)
    .sort((left, right) => right.confidence.score - left.confidence.score
      || left.category.localeCompare(right.category));
  const lastEvidenceAt = [...manifest.entries]
    .sort((left, right) => right.ingestedAt.localeCompare(left.ingestedAt))[0]?.ingestedAt || null;
  const unavailable = learning.territoryIntelligence
    .filter(item => item.status === "unavailable")
    .map(item => item.unavailableReason);
  const weakPatterns = learning.categoryIntelligence
    .filter(item => !item.confidence.thresholdQualified)
    .map(item => ({
      category: item.category,
      truthState: TRUTH_STATES.insufficient,
      limitingFactors: [...item.confidence.limitingFactors]
    }));
  const conflictingPatterns = learning.businessIntelligence.filter(item => (
    new Set(item.priorOutcomes).size > 1
  )).map(item => ({
    businessId: item.googlePlaceId,
    truthState: TRUTH_STATES.reviewRequired,
    observedOutcomeCount: new Set(item.priorOutcomes).size
  }));
  const reviewRequiredOutcomeCount = normalizedOutcomes.filter(outcome => (
    outcome.semanticDisposition.reviewRequired
  )).length;
  const semanticOutcomeRelationships = graph.relationships.filter(relationship => (
    Boolean(relationship.semanticDisposition)
  ));
  return {
    contractVersion: routeIqGovernedLearningAdvisoryContractVersion,
    truthVocabulary: Object.values(TRUTH_STATES),
    evidenceMaturity: {
      truthState: confidence?.thresholdQualified
        ? TRUTH_STATES.observed
        : TRUTH_STATES.insufficient,
      sessionsAdmitted: manifest.totals.sessions,
      visitsAdmitted: manifest.totals.visits,
      visitsEligibleForSemanticLearning:
        learning.sourceEvidence.semanticLearningEligibleVisitCount,
      reviewRequiredOutcomeCount,
      successfulRelationshipCount: semanticOutcomeRelationships.filter(relationship => (
        relationship.relationshipType === "Successful"
      )).length,
      followUpRelationshipCount: semanticOutcomeRelationships.filter(relationship => (
        relationship.relationshipType === "Follow-up"
      )).length,
      status: confidence?.thresholdQualified ? "THRESHOLD_SUPPORTED" : "INSUFFICIENT_EVIDENCE"
    },
    categoryTimeWindowPatterns: categoryTimePatterns(normalizedOutcomes, learning),
    businessVisitOutcomeRelationships: graph.relationships.filter(relationship => (
      ["Visited", "Successful", "Follow-up"].includes(relationship.relationshipType)
    )).map(relationship => ({
      relationshipId: relationship.relationshipId,
      relationshipType: relationship.relationshipType,
      fromNodeId: relationship.fromNodeId,
      toNodeId: relationship.toNodeId,
      truthState: relationship.reviewState === "human_review_required"
        ? TRUTH_STATES.reviewRequired
        : TRUTH_STATES.observed,
      reviewState: relationship.reviewState,
      semanticDisposition: relationship.semanticDisposition
        ? clone(relationship.semanticDisposition)
        : null,
      admittedEvidence: relationship.admittedEvidence
        ? clone(relationship.admittedEvidence)
        : null
    })),
    outcomeObservations: graph.nodes.filter(node => node.nodeType === "Outcome").map(node => ({
      outcomeNodeId: node.nodeId,
      rawOutcome: node.attributes.rawOutcome,
      normalizedOutcome: node.attributes.normalizedOutcome,
      truthState: node.attributes.evidenceStatus,
      mappingSource: node.attributes.mappingSource,
      semanticDisposition: clone(node.attributes.semanticDisposition),
      admittedEvidence: clone(node.attributes.admittedEvidence)
    })),
    strongestThresholdSupportedPattern: categoryCandidates[0]
      ? {
          category: categoryCandidates[0].category,
          truthState: TRUTH_STATES.observed,
          confidenceBand: categoryCandidates[0].confidence.band,
          evidenceCount: clone(categoryCandidates[0].confidence.evidenceCount)
        }
      : {
          category: null,
          truthState: TRUTH_STATES.insufficient,
          confidenceBand: confidence?.band || "insufficient_evidence",
          evidenceCount: clone(confidence?.evidenceCount || {})
        },
    weakPatterns,
    conflictingPatterns,
    stalePatterns: [],
    unavailableEvidence: unavailable.length ? unavailable : [],
    unknownEvidence: offRoute.sourceEvidence.unknownSourceVisits > 0
      ? [`${offRoute.sourceEvidence.unknownSourceVisits} visit decision source(s) are unknown.`]
      : [],
    confidence: {
      truthState: confidence?.thresholdQualified
        ? TRUTH_STATES.observed
        : TRUTH_STATES.insufficient,
      band: confidence?.band || "insufficient_evidence",
      score: confidence?.score ?? null,
      limitingFactors: [...(confidence?.limitingFactors || [])],
      influence: "EXPLANATION_ONLY",
      propagation: "OFF"
    },
    browserLocalEstimateBoundary: {
      truthState: TRUTH_STATES.unknown,
      governedConfidenceBlendedWithBrowserEstimate: false,
      browserEstimateConfidence: null,
      message: "Browser-local estimates are separate and are not governed cross-session intelligence."
    },
    dataQualityWarnings: [
      ...(manifest.totals.sessions < 3 ? ["Additional governed sessions are required."] : []),
      ...(offRoute.sourceEvidence.unknownSourceVisits > 0 ? ["Some visit decision sources are unknown."] : []),
      ...(unavailable.length ? ["Some evidence dimensions are unavailable."] : []),
      ...(reviewRequiredOutcomeCount
        ? [`${reviewRequiredOutcomeCount} outcome(s) require human review and are excluded from semantic learning.`]
        : [])
    ],
    lastGovernedEvidenceAt: lastEvidenceAt,
    additionalEvidenceNeeded: additionalEvidenceNeeded(learning),
    versions: {
      bridge: routeIqGovernedMultiSessionLearningVersion,
      eligibleSessionManifest: manifest.schemaVersion,
      readOnlyLearning: learning.learningVersion.engine,
      offRouteLearning: offRoute.learningVersion.engine,
      customerGraph: graph.contractVersion,
      operatingProfile: manifest.operatingProfileId,
      outcomeSemanticDisposition:
        operatingProfileOutcomeSemanticDispositionContract.version
    },
    provenance: {
      manifestId: manifest.manifestId,
      manifestSha256: manifest.manifestSha256,
      graphId: graph.graphId,
      graphQueryId: queryResult.queryId,
      workspaceId: manifest.workspaceId,
      customerId: manifest.customerId,
      operatingProfileId: manifest.operatingProfileId,
      representativeId: manifest.representativeId,
      evidenceClassification: manifest.evidenceClassification,
      humanOverrideState: "preserved",
      outcomeSemanticAuthority:
        operatingProfileOutcomeSemanticDispositionContract.version,
      freshnessState: "CURRENT_WITHIN_RETENTION_BOUNDARY"
    },
    safety: {
      founderOnly: true,
      representativeReadable: false,
      readOnly: true,
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF",
      routeOrderingChanged: false,
      routeScoringChanged: false,
      activePoolChanged: false,
      adaptiveReplenishmentChanged: false,
      businessHoursEligibilityChanged: false,
      shadowDecisionReadinessExposed: false
    }
  };
}

export function createRouteIqGovernedLearningUnavailableAdvisory(reason = "Governed evidence is unavailable.") {
  return deepFreeze({
    contractVersion: routeIqGovernedLearningAdvisoryContractVersion,
    status: "UNAVAILABLE",
    truthState: TRUTH_STATES.unknown,
    message: String(reason).slice(0, 240),
    confidence: {
      truthState: TRUTH_STATES.unknown,
      band: "unknown",
      score: null,
      limitingFactors: ["governed_evidence_unavailable"],
      influence: "EXPLANATION_ONLY",
      propagation: "OFF"
    },
    safety: {
      founderOnly: true,
      representativeReadable: false,
      readOnly: true,
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF"
    }
  });
}

export function buildRouteIqGovernedMultiSessionLearning({
  eligibleSessionManifest,
  archivePackages,
  workspaceRegistry,
  operatingProfiles = loadOperatingProfiles()
} = {}) {
  const manifest = eligibleSessionManifest;
  if (manifest?.schemaVersion !== routeIqEligibleSessionManifestVersion
    || !SHA256.test(manifest?.manifestSha256 || "")) {
    fail("route_iq_learning_eligible_manifest_invalid");
  }
  const workspace = workspaceMapping(manifest, workspaceRegistry);
  if (workspace.companyId !== manifest.customerId
    || workspace.operatingProfile.profileId !== manifest.operatingProfileId
    || manifest.entries.some(entry => (
      entry.workspaceId !== manifest.workspaceId
        || entry.customerId !== manifest.customerId
        || entry.operatingProfileId !== manifest.operatingProfileId
        || entry.representativeId !== manifest.representativeId
    ))) {
    fail("route_iq_learning_scope_isolation_rejected");
  }
  if (manifest.entries.length === 0) {
    return deepFreeze({
      schemaVersion: routeIqGovernedMultiSessionLearningVersion,
      status: "UNAVAILABLE",
      manifest,
      readOnlyLearningSnapshot: null,
      offRouteLearningSnapshot: null,
      customerGraphSnapshot: null,
      dashboardAdvisory: createRouteIqGovernedLearningUnavailableAdvisory(),
      safety: { recommendationInfluence: "OFF", confidencePropagation: "OFF" }
    });
  }
  const packages = materializeRouteIqEligibleSessionPackages(manifest, archivePackages);
  const governance = scopedGovernance(manifest);
  const sourceMode = manifest.evidenceClassification === "SYNTHETIC_VALIDATION_FIXTURE"
    ? "validation_fixture"
    : "canonical_verified_archive";
  const scopeAuthorization = {
    authority: manifest.authority,
    policyVersion: manifest.policyVersion,
    manifestId: manifest.manifestId,
    manifestSha256: manifest.manifestSha256,
    workspaceId: manifest.workspaceId,
    operatingProfileId: manifest.operatingProfileId,
    evidenceClassification: manifest.evidenceClassification
  };
  const normalizedOutcomes = normalizedOutcomesFromPackages(
    manifest,
    packages,
    operatingProfiles
  );
  const dataContract = loadReadOnlyFieldSessionDataContract(governance.readOnlyContract);
  const learning = buildReadOnlyFieldSessionLearningSnapshot({
    archivePackages: packages,
    contract: governance.readOnlyContract,
    policy: governance.readOnlyPolicy,
    dataContract,
    workspaceId: manifest.workspaceId,
    operatingProfileId: manifest.operatingProfileId,
    sourceMode,
    evidenceClassification: manifest.evidenceClassification,
    scopeAuthorization,
    outcomeSemanticAdmissions: outcomeSemanticAdmissions(normalizedOutcomes)
  });
  const offRoute = buildOffRouteLearningSnapshot({
    records: projectCanonicalArchivedVisitEvidence(packages, {
      workspaceId: manifest.workspaceId,
      operatingProfileId: manifest.operatingProfileId
    }),
    contract: governance.offRouteContract,
    policy: governance.offRoutePolicy,
    workspaceId: manifest.workspaceId,
    operatingProfileId: manifest.operatingProfileId,
    generatedAt: learning.generatedAt,
    sourceMode,
    scopeAuthorization
  });
  const graph = graphFromLearning({
    manifest,
    learning,
    normalizedOutcomes,
    generatedAt: learning.generatedAt
  });
  const consumerContract = buildCustomerGraphConsumerContract(manifest.customerId, "Dashboard");
  const queryContract = buildCustomerGraphQueryContract(manifest.customerId, "Dashboard", {
    queryType: "snapshot_summary",
    maxResults: 500
  });
  const queryResult = queryCustomerGraphSnapshot(graph, queryContract);
  if (queryResult.failureReasons.length) fail("route_iq_learning_customer_graph_query_rejected");
  const advisory = dashboardAdvisory({
    manifest,
    normalizedOutcomes,
    learning,
    offRoute,
    graph,
    queryResult
  });
  const body = {
    schemaVersion: routeIqGovernedMultiSessionLearningVersion,
    status: "SOURCE_COMPLETE_UNDEPLOYED",
    generatedAt: learning.generatedAt,
    workspaceId: manifest.workspaceId,
    customerId: manifest.customerId,
    operatingProfileId: manifest.operatingProfileId,
    representativeId: manifest.representativeId,
    evidenceClassification: manifest.evidenceClassification,
    eligibleSessionManifest: manifest,
    readOnlyLearningSnapshot: learning,
    offRouteLearningSnapshot: offRoute,
    normalizedOutcomes,
    customerGraphSnapshot: graph,
    dashboardConsumerContract: consumerContract,
    dashboardQueryContract: queryContract,
    dashboardQueryResult: queryResult,
    dashboardAdvisory: advisory,
    safety: {
      recommendationInfluence: "OFF",
      confidencePropagation: "OFF",
      routeOrderingChanged: false,
      routeScoringChanged: false,
      activePoolChanged: false,
      adaptiveReplenishmentChanged: false,
      businessHoursEligibilityChanged: false,
      sourceArchiveMutationPerformed: false,
      productionRuntimeActivated: false
    }
  };
  const artifactSha256 = sha256(body);
  return deepFreeze({
    ...body,
    artifactId: `riq_governed_learning_${artifactSha256}`,
    artifactSha256
  });
}

export function canonicalRouteIqGovernedLearningJson(value) {
  return canonicalJson(value);
}
