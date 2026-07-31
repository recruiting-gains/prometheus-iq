import {
  assertGovernedCandidateAdmission,
  assertGovernedRouteRuntimeScope,
  routeIqGovernedRuntimeAuthorizations
} from "./route-iq-governed-runtime-scope.mjs";
import {
  isCanonicalRouteBusinessHoursEligibility
} from "./route-business-hours-eligibility.mjs";

export const continuousAdaptiveRouteReplenishmentVersion = "continuous-adaptive-route-replenishment-v1";
export const recommendationInfluenceStateVersion = "route-iq-recommendation-influence-state-v1";
export const defaultRouteQueueTarget = 15;
export const defaultRouteReplenishmentThreshold = 5;
export const routeIqWorkspaceId = "fitness_connection";

const maxCandidateScan = 5000;
const maxOutcomeSignals = 500;
const objectionPattern = /\b(objection|price|cost|budget|not interested|timing|contract|competitor|gatekeeper|decision maker|already have|too expensive)\b/i;

function cleanText(value, maxLength = 240) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function isoTimestamp(value = Date.now()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function localDate(value = Date.now()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeIdentityText(value) {
  return cleanText(value, 500).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function routeQueueIdentity(place) {
  const googlePlaceId = cleanText(place?.googlePlaceId, 180);
  if (googlePlaceId) return `google:${googlePlaceId}`;
  const recordId = cleanText(place?.recordId, 180);
  if (recordId) return `record:${recordId}`;
  const fallback = normalizeIdentityText(`${place?.name || ""} ${place?.address || ""}`);
  return fallback ? `business:${fallback}` : "";
}

function resolveRouteWorkspace(workspaceId, operatingProfileId = "", governedRuntimeScope = null) {
  const normalized = cleanText(workspaceId, 80);
  const normalizedProfile = cleanText(operatingProfileId, 80);
  const resolvedScope = assertGovernedRouteRuntimeScope({
    workspaceId: normalized,
    operatingProfileId: normalizedProfile,
    governedRuntimeScope,
    requiredAuthorization: routeIqGovernedRuntimeAuthorizations.continuousRouteReplenishment,
    requireManifestAdmission: true
  });
  return {
    workspaceId: resolvedScope.workspaceId,
    operatingProfileId: resolvedScope.operatingProfileId
  };
}

export function assertRouteWorkspace(workspaceId, operatingProfileId = "", governedRuntimeScope = null) {
  return resolveRouteWorkspace(workspaceId, operatingProfileId, governedRuntimeScope).workspaceId;
}

function createMetricBucket() {
  return {
    visits: 0,
    conversations: 0,
    leads: 0,
    wins: 0,
    followUps: 0,
    noContacts: 0,
    objections: 0,
    evidenceScore: 0,
    lastValidatedAt: ""
  };
}

function updateMetricBucket(bucket, visit, signal) {
  bucket.visits += 1;
  bucket.conversations += finiteNumber(visit.conversations);
  bucket.leads += finiteNumber(visit.leads);
  bucket.wins += finiteNumber(visit.units) + finiteNumber(visit.laterUnits);
  bucket.followUps += signal.followUpNeeded ? 1 : 0;
  bucket.noContacts += signal.noContact ? 1 : 0;
  bucket.objections += signal.objectionObserved ? 1 : 0;
  bucket.evidenceScore = Number((bucket.evidenceScore + signal.outcomeStrength).toFixed(4));
  bucket.lastValidatedAt = signal.recordedAt;
}

function normalizedOutcomeSignal(visit, place, territoryLabel, workspaceId, representativeId) {
  const wins = finiteNumber(visit?.units) + finiteNumber(visit?.laterUnits);
  const leads = finiteNumber(visit?.leads);
  const conversations = finiteNumber(visit?.conversations);
  const note = cleanText(visit?.notes, 2000);
  const noContact = conversations === 0 && leads === 0 && wins === 0;
  const followUpNeeded = leads > wins || /\bfollow[ -]?up\b/i.test(note);
  const objectionObserved = objectionPattern.test(note);
  const outcomeStrength = clamp(
    wins * 1.35 + leads * 0.55 + conversations * 0.08 - (noContact ? 0.4 : 0) - (objectionObserved ? 0.12 : 0),
    -1,
    4
  );
  return {
    signalId: cleanText(visit?.id, 128) || `${representativeId}:${finiteNumber(visit?.createdAt, Date.now())}`,
    workspaceId,
    representativeId,
    placeId: cleanText(place?.id || visit?.placeId, 128),
    identityKey: routeQueueIdentity(place || { name: visit?.placeName }),
    category: cleanText(place?.category, 80) || "Other",
    territory: cleanText(territoryLabel, 80) || "Territory pending",
    timeWindow: cleanText(visit?.window, 40) || "Anytime",
    noContact,
    followUpNeeded,
    objectionObserved,
    closingObserved: wins > 0,
    conversations,
    leads,
    wins,
    outcomeStrength,
    recordedAt: isoTimestamp(visit?.createdAt)
  };
}

function objectFromMap(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function rankedStrengths(metrics) {
  return Object.entries(metrics)
    .filter(([, value]) => value.visits > 0)
    .map(([key, value]) => ({
      key,
      visits: value.visits,
      evidenceScore: value.evidenceScore,
      conversionRate: value.visits ? Number((value.wins / value.visits).toFixed(4)) : 0,
      contactRate: value.visits ? Number((value.conversations / value.visits).toFixed(4)) : 0
    }))
    .sort((left, right) => right.evidenceScore - left.evidenceScore || right.visits - left.visits || left.key.localeCompare(right.key));
}

export function buildAdaptiveIntelligenceSnapshot({
  workspaceId,
  operatingProfileId = "",
  governedRuntimeScope = null,
  representativeId,
  visits = [],
  places = [],
  territoryResolver,
  previousSignals = [],
  generatedAt = Date.now()
} = {}) {
  const scoped = resolveRouteWorkspace(workspaceId, operatingProfileId, governedRuntimeScope);
  const scopedWorkspaceId = scoped.workspaceId;
  const cleanRepresentativeId = cleanText(representativeId, 80);
  if (!cleanRepresentativeId) throw new Error("Route replenishment requires a representative identity.");
  const placeMap = new Map((Array.isArray(places) ? places : []).map(place => [cleanText(place?.id, 128), place]));
  const placePerformance = new Map();
  const categoryPerformance = new Map();
  const timeWindowPerformance = new Map();
  const territoryPerformance = new Map();
  const outcomeSignals = [];

  for (const visit of Array.isArray(visits) ? visits : []) {
    const visitWorkspaceId = cleanText(visit?.workspaceId, 80) || scopedWorkspaceId;
    if (visitWorkspaceId !== scopedWorkspaceId) continue;
    const place = placeMap.get(cleanText(visit?.placeId, 128)) || {
      id: cleanText(visit?.placeId, 128),
      name: cleanText(visit?.placeName, 160),
      category: "Other"
    };
    const territory = typeof territoryResolver === "function"
      ? territoryResolver(place)
      : "Territory pending";
    const signal = normalizedOutcomeSignal(visit, place, territory, scopedWorkspaceId, cleanRepresentativeId);
    outcomeSignals.push(signal);
    const dimensions = [
      [placePerformance, signal.identityKey || signal.placeId || "unknown"],
      [categoryPerformance, signal.category],
      [timeWindowPerformance, signal.timeWindow],
      [territoryPerformance, signal.territory]
    ];
    for (const [map, key] of dimensions) {
      if (!map.has(key)) map.set(key, createMetricBucket());
      updateMetricBucket(map.get(key), visit, signal);
    }
  }

  const categories = objectFromMap(categoryPerformance);
  const windows = objectFromMap(timeWindowPerformance);
  const territories = objectFromMap(territoryPerformance);
  const allSignals = [...(Array.isArray(previousSignals) ? previousSignals : []), ...outcomeSignals]
    .filter(signal => signal?.workspaceId === scopedWorkspaceId && signal?.representativeId === cleanRepresentativeId)
    .sort((left, right) => String(left.recordedAt || "").localeCompare(String(right.recordedAt || "")))
    .slice(-maxOutcomeSignals);
  const strengths = rankedStrengths(categories);
  const weaknesses = strengths.slice().sort((left, right) => left.evidenceScore - right.evidenceScore || right.visits - left.visits || left.key.localeCompare(right.key));

  return {
    version: continuousAdaptiveRouteReplenishmentVersion,
    workspaceId: scopedWorkspaceId,
    operatingProfileId: scoped.operatingProfileId,
    representativeId: cleanRepresentativeId,
    generatedAt: isoTimestamp(generatedAt),
    evidenceCount: outcomeSignals.length,
    placePerformance: objectFromMap(placePerformance),
    categoryPerformance: categories,
    timeWindowPerformance: windows,
    territoryPerformance: territories,
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    outcomeSignals: allSignals
  };
}

function performanceInfluence(metric) {
  if (!metric?.visits) return 0;
  const maturity = Math.min(1, metric.visits / 8);
  const perVisit = finiteNumber(metric.evidenceScore) / Math.max(1, metric.visits);
  return clamp(perVisit * maturity, -1.5, 2.5);
}

function influenceOff(baseScore) {
  return { score: finiteNumber(baseScore), influence: 0, signals: [] };
}

function permitsTestOnlyInfluence(state, intelligence, previousSequence) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const expectedKeys = [
    "authorizedAt", "expiresAt", "mode", "operatingProfileId", "representativeId",
    "sequence", "snapshotGeneratedAt", "state", "version", "workspaceId"
  ];
  if (Object.keys(state).sort().join("\u0000") !== expectedKeys.sort().join("\u0000")) return false;
  if (state.version !== recommendationInfluenceStateVersion
    || state.state !== "ON"
    || state.mode !== "TEST_FIXTURE_ONLY"
    || state.workspaceId !== intelligence.workspaceId
    || state.operatingProfileId !== intelligence.operatingProfileId
    || state.representativeId !== intelligence.representativeId
    || state.snapshotGeneratedAt !== intelligence.generatedAt
    || !Number.isSafeInteger(state.sequence)
    || state.sequence <= Math.max(0, Number(previousSequence) || 0)) return false;
  const snapshotAt = new Date(intelligence.generatedAt).getTime();
  const authorizedAt = new Date(state.authorizedAt).getTime();
  const expiresAt = new Date(state.expiresAt).getTime();
  return Number.isFinite(snapshotAt)
    && Number.isFinite(authorizedAt)
    && Number.isFinite(expiresAt)
    && authorizedAt <= snapshotAt
    && expiresAt > snapshotAt;
}

export function scoreAdaptiveCandidate({
  candidate,
  baseScore,
  intelligence,
  currentTimeWindow = "Anytime",
  territoryLabel = "",
  routeContextDistanceMiles = null,
  governedRuntimeScope = null,
  recommendationInfluenceState = null,
  previousInfluenceSequence = 0
} = {}) {
  if (!candidate || !intelligence) return influenceOff(baseScore);
  assertRouteWorkspace(intelligence.workspaceId, intelligence.operatingProfileId, governedRuntimeScope);
  if (!permitsTestOnlyInfluence(recommendationInfluenceState, intelligence, previousInfluenceSequence)) {
    return influenceOff(baseScore);
  }
  const identityKey = routeQueueIdentity(candidate);
  const categoryMetric = intelligence.categoryPerformance?.[cleanText(candidate.category, 80) || "Other"];
  const placeMetric = intelligence.placePerformance?.[identityKey];
  const timeMetric = intelligence.timeWindowPerformance?.[cleanText(currentTimeWindow, 40)]
    || intelligence.timeWindowPerformance?.[cleanText(candidate.window, 40)];
  const territoryMetric = intelligence.territoryPerformance?.[cleanText(territoryLabel, 80)];
  const signals = [];
  let influence = 0;

  const categoryInfluence = performanceInfluence(categoryMetric);
  if (categoryInfluence) {
    influence += categoryInfluence;
    signals.push("latest category evidence");
  }
  const customerInfluence = performanceInfluence(placeMetric);
  if (customerInfluence) {
    influence += customerInfluence * 0.55;
    signals.push("business outcome history");
  }
  const timeInfluence = performanceInfluence(timeMetric);
  if (timeInfluence) {
    influence += timeInfluence * 0.7;
    signals.push("time-of-day evidence");
  }
  const territoryInfluence = performanceInfluence(territoryMetric);
  if (territoryInfluence) {
    influence += territoryInfluence * 0.6;
    signals.push("territory evidence");
  }
  if (Number.isFinite(Number(routeContextDistanceMiles))) {
    const miles = Math.max(0, Number(routeContextDistanceMiles));
    influence += clamp((6 - miles) / 5, -0.8, 1.2);
    signals.push("current route context");
  }
  if (categoryMetric?.followUps) signals.push("follow-up pattern");
  if (categoryMetric?.objections) signals.push("objection pattern");
  if (categoryMetric?.wins) signals.push("closing pattern");

  const boundedInfluence = clamp(influence, -2.5, 4.5);
  return {
    score: Number((finiteNumber(baseScore) + boundedInfluence).toFixed(4)),
    influence: boundedInfluence,
    signals: [...new Set(signals)]
  };
}

export function createEmptyRouteQueue({
  workspaceId,
  representativeId,
  operatingProfileId = "",
  routeDate = localDate(),
  targetSize = defaultRouteQueueTarget,
  threshold = defaultRouteReplenishmentThreshold,
  governedRuntimeScope = null
} = {}) {
  const scoped = resolveRouteWorkspace(workspaceId, operatingProfileId, governedRuntimeScope);
  const scopedWorkspaceId = scoped.workspaceId;
  const cleanRepresentativeId = cleanText(representativeId, 80);
  if (!cleanRepresentativeId) throw new Error("Route queue requires a representative identity.");
  return {
    version: continuousAdaptiveRouteReplenishmentVersion,
    workspaceId: scopedWorkspaceId,
    representativeId: cleanRepresentativeId,
    operatingProfileId: scoped.operatingProfileId,
    routeDate: cleanText(routeDate, 10) || localDate(),
    targetSize: Math.max(1, Math.floor(finiteNumber(targetSize, defaultRouteQueueTarget))),
    threshold: Math.max(1, Math.floor(finiteNumber(threshold, defaultRouteReplenishmentThreshold))),
    entries: [],
    revision: 0,
    state: "initializing",
    exhausted: false,
    lastTrigger: "initialization",
    lastFailureReasons: [],
    updatedAt: ""
  };
}

function normalizeEligibilitySnapshot(raw) {
  if (!isCanonicalRouteBusinessHoursEligibility(raw)) return null;
  const provenance = raw.provenance && typeof raw.provenance === "object" ? raw.provenance : {};
  return {
    version: cleanText(raw.version, 120),
    workspaceId: cleanText(raw.workspaceId, 80),
    operatingProfileId: cleanText(raw.operatingProfileId, 80),
    googlePlaceId: cleanText(raw.googlePlaceId, 180),
    permanentOperationalStatus: cleanText(raw.permanentOperationalStatus, 40),
    status: cleanText(raw.status, 40),
    eligible: raw.eligible === true,
    coverageEligible: raw.coverageEligible === true,
    immediateRecommendationEligible: raw.immediateRecommendationEligible === true,
    coverageOnly: raw.coverageOnly === true,
    selectionTier: Math.max(0, Math.floor(finiteNumber(raw.selectionTier))),
    internalMarker: cleanText(raw.internalMarker, 80) || null,
    hoursConfidence: cleanText(raw.hoursConfidence, 20),
    hoursFreshness: cleanText(raw.hoursFreshness, 20),
    reasonCode: cleanText(raw.reasonCode, 160),
    reason: cleanText(raw.reason, 600),
    evaluatedAt: cleanText(raw.evaluatedAt, 40),
    businessLocalDate: cleanText(raw.businessLocalDate, 20) || null,
    businessLocalTime: cleanText(raw.businessLocalTime, 20) || null,
    businessTimezone: cleanText(raw.businessTimezone, 120) || null,
    effectiveInterval: clone(raw.effectiveInterval),
    nextClosing: clone(raw.nextClosing),
    nextOpening: clone(raw.nextOpening),
    verifiedAt: cleanText(raw.verifiedAt, 40) || null,
    expiresAt: cleanText(raw.expiresAt, 40) || null,
    sourceState: cleanText(raw.sourceState, 40) || null,
    sourceRetrievedAt: cleanText(raw.sourceRetrievedAt, 40) || null,
    hoursVerifiedAt: cleanText(raw.hoursVerifiedAt, 40) || null,
    sourceStatus: cleanText(raw.sourceStatus, 40) || null,
    sourceStatusEvaluatedAt: cleanText(raw.sourceStatusEvaluatedAt, 40) || null,
    provenance: {
      sourceSystem: cleanText(provenance.sourceSystem, 120) || null,
      sourceMethod: cleanText(provenance.sourceMethod, 120) || null,
      sourcePlaceId: cleanText(provenance.sourcePlaceId, 180) || null,
      retrievedAt: cleanText(provenance.retrievedAt, 40) || null,
      normalizedAt: cleanText(provenance.normalizedAt, 40) || null,
      fieldEvidenceIds: Array.isArray(provenance.fieldEvidenceIds)
        ? provenance.fieldEvidenceIds.map(value => cleanText(value, 180)).filter(Boolean).slice(0, 25)
        : []
    },
    failClosed: raw.failClosed === true,
    scoringChanged: raw.scoringChanged === true,
    displayLabel: cleanText(raw.displayLabel, 120),
    availability: clone(raw.availability),
    visitDuration: clone(raw.visitDuration),
    admission: clone(raw.admission)
  };
}

function normalizeQueueEntry(raw) {
  const placeId = cleanText(raw?.placeId, 128);
  const identityKey = cleanText(raw?.identityKey, 500);
  if (!placeId || !identityKey) return null;
  return {
    placeId,
    identityKey,
    sourcePool: raw?.sourcePool === "full" ? "full" : "active",
    scoreSnapshot: finiteNumber(raw?.scoreSnapshot),
    selectionTierSnapshot: Math.max(0, Math.floor(finiteNumber(raw?.selectionTierSnapshot))),
    eligibilitySnapshot: normalizeEligibilitySnapshot(raw?.eligibilitySnapshot),
    intelligenceSignals: Array.isArray(raw?.intelligenceSignals)
      ? raw.intelligenceSignals.map(value => cleanText(value, 120)).filter(Boolean).slice(0, 10)
      : [],
    addedAt: cleanText(raw?.addedAt, 40) || isoTimestamp(),
    trigger: cleanText(raw?.trigger, 80) || "queue-maintenance"
  };
}

export function normalizeRouteQueue(raw, context = {}) {
  const expected = createEmptyRouteQueue({
    workspaceId: context.workspaceId || raw?.workspaceId,
    representativeId: context.representativeId || raw?.representativeId,
    operatingProfileId: context.operatingProfileId || raw?.operatingProfileId,
    routeDate: context.routeDate || raw?.routeDate,
    targetSize: context.targetSize || raw?.targetSize,
    threshold: context.threshold || raw?.threshold,
    governedRuntimeScope: context.governedRuntimeScope
  });
  const sameScope = raw?.version === continuousAdaptiveRouteReplenishmentVersion
    && raw?.workspaceId === expected.workspaceId
    && raw?.representativeId === expected.representativeId
    && raw?.routeDate === expected.routeDate
    && raw?.operatingProfileId === expected.operatingProfileId;
  if (!sameScope) return expected;
  const entries = [];
  const seen = new Set();
  for (const rawEntry of Array.isArray(raw?.entries) ? raw.entries : []) {
    const entry = normalizeQueueEntry(rawEntry);
    if (!entry || seen.has(entry.identityKey) || entries.length >= expected.targetSize) continue;
    seen.add(entry.identityKey);
    entries.push(entry);
  }
  return {
    ...expected,
    entries,
    revision: Math.max(0, Math.floor(finiteNumber(raw?.revision))),
    state: ["active", "depleted", "exhausted", "initializing"].includes(raw?.state) ? raw.state : "initializing",
    exhausted: raw?.exhausted === true,
    lastTrigger: cleanText(raw?.lastTrigger, 80) || "restored",
    lastFailureReasons: Array.isArray(raw?.lastFailureReasons)
      ? raw.lastFailureReasons.map(value => cleanText(value, 160)).filter(Boolean).slice(0, 25)
      : [],
    updatedAt: cleanText(raw?.updatedAt, 40)
  };
}

function admitRouteCandidate(candidate, governedRuntimeScope) {
  return assertGovernedCandidateAdmission({
    governedRuntimeScope,
    candidate,
    workspaceId: governedRuntimeScope.workspaceId,
    operatingProfileId: governedRuntimeScope.operatingProfileId,
    territoryId: candidate?.territoryId
  });
}

function orderedCandidates(candidates, sourcePool, scoreCandidate, identityOf, failureReasons, now, governedRuntimeScope) {
  const seen = new Set();
  const ranked = [];
  const input = Array.isArray(candidates) ? candidates.slice(0, maxCandidateScan) : [];
  for (const candidate of input) {
    const identityKey = cleanText(identityOf(candidate), 500);
    if (!identityKey || seen.has(identityKey)) continue;
    seen.add(identityKey);
    try {
      admitRouteCandidate(candidate, governedRuntimeScope);
      const scoreResult = scoreCandidate(candidate, sourcePool, now);
      const normalized = typeof scoreResult === "number" ? { score: scoreResult, signals: [] } : scoreResult;
      if (!Number.isFinite(Number(normalized?.score))) {
        failureReasons.push(`invalid_score:${identityKey}`);
        continue;
      }
      const eligibility = normalizeEligibilitySnapshot(normalized.eligibility);
      if (!eligibility) {
        failureReasons.push(`eligibility_missing:${identityKey}`);
        continue;
      }
      if (eligibility && eligibility.immediateRecommendationEligible !== true) {
        failureReasons.push(`not_immediate_route_eligible:${identityKey}:${eligibility.reasonCode || "unknown"}`);
        continue;
      }
      ranked.push({
        candidate,
        identityKey,
        sourcePool,
        score: Number(normalized.score),
        selectionTier: Math.max(0, Math.floor(finiteNumber(normalized.selectionTier))),
        eligibility,
        signals: Array.isArray(normalized.signals) ? normalized.signals : []
      });
    } catch (error) {
      failureReasons.push(`score_failed:${identityKey}:${cleanText(error?.message, 80)}`);
    }
  }
  return ranked.sort((left, right) => left.selectionTier - right.selectionTier || right.score - left.score || left.identityKey.localeCompare(right.identityKey));
}

export function maintainRouteQueue({
  queue,
  workspaceId,
  representativeId,
  operatingProfileId = "",
  routeDate = localDate(),
  primaryCandidates = [],
  fallbackCandidates = [],
  completedIdentityKeys = [],
  force = false,
  trigger = "threshold",
  identityOf = routeQueueIdentity,
  isEligible = () => true,
  scoreCandidate = candidate => ({ score: finiteNumber(candidate?.score), signals: [] }),
  now = Date.now(),
  governedRuntimeScope = null
} = {}) {
  const normalized = normalizeRouteQueue(queue, {
    workspaceId,
    representativeId,
    operatingProfileId,
    routeDate,
    governedRuntimeScope
  });
  const completed = new Set((completedIdentityKeys || []).map(value => cleanText(value, 500)).filter(Boolean));
  const candidateByIdentity = new Map();
  const candidateSourceByIdentity = new Map();
  for (const candidate of primaryCandidates) {
    const identityKey = cleanText(identityOf(candidate), 500);
    if (!identityKey || candidateByIdentity.has(identityKey)) continue;
    candidateByIdentity.set(identityKey, candidate);
    candidateSourceByIdentity.set(identityKey, "active");
  }
  for (const candidate of fallbackCandidates) {
    const identityKey = cleanText(identityOf(candidate), 500);
    if (!identityKey || candidateByIdentity.has(identityKey)) continue;
    candidateByIdentity.set(identityKey, candidate);
    candidateSourceByIdentity.set(identityKey, "full");
  }
  const removed = [];
  const activeIdentities = new Set();
  const evaluationTime = isoTimestamp(now);
  normalized.entries = normalized.entries.filter(entry => {
    const candidate = candidateByIdentity.get(entry.identityKey);
    let currentScore = null;
    let currentEligibility = null;
    try {
      if (candidate) admitRouteCandidate(candidate, governedRuntimeScope);
      const result = candidate ? scoreCandidate(candidate, entry.sourcePool, now) : null;
      currentScore = typeof result === "number" ? { score: result, signals: [] } : result;
      currentEligibility = normalizeEligibilitySnapshot(currentScore?.eligibility);
    } catch {
      currentScore = null;
      currentEligibility = null;
    }
    const eligibilityCurrent = !currentEligibility?.evaluatedAt
      || new Date(currentEligibility.evaluatedAt).getTime() === new Date(evaluationTime).getTime();
    const hoursValid = currentEligibility?.immediateRecommendationEligible === true && eligibilityCurrent;
    const valid = candidate
      && !completed.has(entry.identityKey)
      && !activeIdentities.has(entry.identityKey)
      && hoursValid
      && isEligible(candidate, entry.sourcePool, now);
    if (!valid) {
      removed.push(entry);
      return false;
    }
    entry.sourcePool = candidateSourceByIdentity.get(entry.identityKey) || entry.sourcePool;
    if (Number.isFinite(Number(currentScore?.score))) entry.scoreSnapshot = Number(currentScore.score);
    if (currentEligibility) {
      entry.selectionTierSnapshot = currentEligibility.selectionTier;
      entry.eligibilitySnapshot = currentEligibility;
    }
    if (Array.isArray(currentScore?.signals)) {
      entry.intelligenceSignals = currentScore.signals.map(value => cleanText(value, 120)).filter(Boolean).slice(0, 10);
    }
    activeIdentities.add(entry.identityKey);
    return true;
  });

  const belowThreshold = normalized.entries.length < normalized.threshold;
  const shouldRun = force || belowThreshold || normalized.entries.length === 0;
  const failureReasons = [];
  const appended = [];
  let usedFallback = normalized.entries.some(entry => entry.sourcePool === "full");

  if (shouldRun && normalized.entries.length < normalized.targetSize) {
    const rankedPrimary = orderedCandidates(
      primaryCandidates,
      "active",
      scoreCandidate,
      identityOf,
      failureReasons,
      now,
      governedRuntimeScope
    );
    const rankedFallback = orderedCandidates(
      fallbackCandidates,
      "full",
      scoreCandidate,
      identityOf,
      failureReasons,
      now,
      governedRuntimeScope
    );
    const appendFrom = (ranked, selectionTier) => {
      for (const rankedCandidate of ranked) {
        if (normalized.entries.length >= normalized.targetSize) break;
        if (rankedCandidate.selectionTier !== selectionTier) continue;
        if (completed.has(rankedCandidate.identityKey) || activeIdentities.has(rankedCandidate.identityKey)) continue;
        if (!isEligible(rankedCandidate.candidate, rankedCandidate.sourcePool, now)) continue;
        const placeId = cleanText(
          rankedCandidate.candidate?.id
            || rankedCandidate.candidate?.googlePlaceId
            || rankedCandidate.candidate?.recordId,
          128
        );
        if (!placeId) continue;
        const entry = {
          placeId,
          identityKey: rankedCandidate.identityKey,
          sourcePool: rankedCandidate.sourcePool,
          scoreSnapshot: rankedCandidate.score,
          selectionTierSnapshot: rankedCandidate.selectionTier,
          eligibilitySnapshot: rankedCandidate.eligibility,
          intelligenceSignals: rankedCandidate.signals.map(value => cleanText(value, 120)).filter(Boolean).slice(0, 10),
          addedAt: isoTimestamp(now),
          trigger: cleanText(trigger, 80) || "queue-maintenance"
        };
        normalized.entries.push(entry);
        appended.push(entry);
        activeIdentities.add(entry.identityKey);
        if (entry.sourcePool === "full") usedFallback = true;
      }
    };
    const selectionTiers = [...new Set(rankedPrimary.concat(rankedFallback).map(item => item.selectionTier))].sort((left, right) => left - right);
    for (const selectionTier of selectionTiers) {
      appendFrom(rankedPrimary, selectionTier);
      if (normalized.entries.length < normalized.targetSize) appendFrom(rankedFallback, selectionTier);
      if (normalized.entries.length >= normalized.targetSize) break;
    }
  }

  const exhausted = normalized.entries.length === 0;
  const state = exhausted
    ? "exhausted"
    : normalized.entries.length < normalized.targetSize
      ? "depleted"
      : "active";
  const changed = removed.length > 0 || appended.length > 0 || normalized.state !== state || normalized.exhausted !== exhausted;
  normalized.state = state;
  normalized.exhausted = exhausted;
  normalized.lastTrigger = cleanText(trigger, 80) || "queue-maintenance";
  normalized.lastFailureReasons = failureReasons.slice(0, 25);
  normalized.updatedAt = isoTimestamp(now);
  if (changed) normalized.revision += 1;

  return {
    queue: normalized,
    triggered: shouldRun,
    belowThreshold,
    changed,
    appended,
    removed,
    usedFallback,
    exhausted,
    failureReasons,
    metrics: {
      activeCount: normalized.entries.length,
      targetSize: normalized.targetSize,
      threshold: normalized.threshold,
      completedCount: completed.size,
      primaryCandidateCount: primaryCandidates.length,
      fallbackCandidateCount: fallbackCandidates.length
    }
  };
}

export function createSingleFlightReplenisher(handler) {
  if (typeof handler !== "function") throw new Error("Single-flight replenisher requires a handler.");
  let inFlight = null;
  let started = 0;
  let coalesced = 0;
  return {
    run(input) {
      if (inFlight) {
        coalesced += 1;
        return inFlight;
      }
      started += 1;
      inFlight = Promise.resolve()
        .then(() => handler(input))
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    status() {
      return { inFlight: Boolean(inFlight), started, coalesced };
    }
  };
}

export function serializeRouteQueue(queue) {
  return clone(queue);
}
