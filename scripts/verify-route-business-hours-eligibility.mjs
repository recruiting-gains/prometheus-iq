import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  maintainRouteQueue,
  routeQueueIdentity
} from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  applyHoursEligibilityToScore,
  buildRouteBusinessHoursIndex,
  evaluateRouteBusinessHoursEligibility,
  routeBusinessHoursEligibilityVersion
} from "../intelligence/route-business-hours-eligibility.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const sourceIndex = read("index.html");
const deployIndex = read("deploy/cloudflare-pages/index.html");
const sourceEligibilityModule = read("intelligence/route-business-hours-eligibility.mjs");
const deployEligibilityModule = read("deploy/cloudflare-pages/intelligence/route-business-hours-eligibility.mjs");
const sourceGovernanceModule = read("scripts/lib/business-hours-governance.mjs");
const deployGovernanceModule = read("deploy/cloudflare-pages/scripts/lib/business-hours-governance.mjs");
const sourceArtifact = read("data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json");
const deployArtifact = read("deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json");
const sourceContract = read("intelligence/contracts/route-business-hours-eligibility-contracts.json");
const deployContract = read("deploy/cloudflare-pages/intelligence/contracts/route-business-hours-eligibility-contracts.json");
const contract = JSON.parse(sourceContract);
const dataContract = readJson("overwatch/artifact-contracts/data/fitness-connection-business-hours-data-contract-v1.json");
const artifact = JSON.parse(sourceArtifact);
const activePool = readJson("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json");

assert.equal(routeBusinessHoursEligibilityVersion, "route-iq-closed-now-eligibility-v1");
assert.equal(contract.version, "route-iq-closed-now-eligibility-contracts-v1");
assert.equal(contract.workspaceId, "fitness_connection");
assert.equal(contract.operatingProfileId, "fitness");
assert.equal(contract.dataContract.contractId, "fitness-connection-business-hours-data-contract-v1");
assert.equal(contract.eligibilityPolicy.CLOSED_VERIFIED.eligible, false);
assert.equal(contract.eligibilityPolicy.OPEN_VERIFIED.eligible, true);
assert.equal(contract.eligibilityPolicy.HOURS_UNKNOWN.internalMarker, "HOURS_NOT_VERIFIED");
assert.equal(contract.eligibilityPolicy.HOURS_STALE.internalMarker, "HOURS_NOT_VERIFIED");
assert.equal(contract.eligibilityPolicy.SPECIAL_HOURS_UNVERIFIED.internalMarker, "HOURS_NOT_VERIFIED");
assert.equal(contract.safety.scoringWeightsChanged, false);
assert.equal(contract.safety.liveGoogleCalls, false);
assert.equal(contract.safety.inventionGovernanceClassification, "operational_improvement");
assert.equal(dataContract.contractId, contract.dataContract.contractId);
assert.equal(dataContract.sourceContract.identityJoinField, "googlePlaceId");
assert.equal(dataContract.enrichmentPolicy.liveGoogleCallsAllowedInRepresentativeRuntime, false);

assert.equal(sourceIndex, deployIndex, "Dashboard source and deployment mirror differ.");
assert.equal(sourceEligibilityModule, deployEligibilityModule, "Hours eligibility source and deployment module differ.");
assert.equal(sourceGovernanceModule, deployGovernanceModule, "Business-hours governance source and deployment module differ.");
assert.equal(sourceArtifact, deployArtifact, "Business-hours source and deployment artifact differ.");
assert.equal(sourceContract, deployContract, "Hours eligibility source and deployment contract differ.");
assert.match(sourceIndex, /loadRouteBusinessHoursEligibility/);
assert.match(sourceIndex, /businessHoursDecisionForPlace/);
assert.match(sourceIndex, /HOURS_NOT_VERIFIED/);
assert.match(sourceIndex, /Business-hours eligibility/);
assert.match(sourceIndex, /function isRouteEligible\([\s\S]*?businessHoursDecisionForPlace\(place\)\.eligible/);
assert.match(sourceIndex, /function buildRouteList\([\s\S]*?hoursEligibility\.selectionTier/);
assert.match(sourceIndex, /primaryVerifiedOpen < routeTargetSize/);
assert.match(sourceIndex, /prepareRouteQueueForVerifiedOpenPreference/);
assert.doesNotMatch(sourceIndex, /(?:places|maps)\.googleapis\.com/i);
assert.doesNotMatch(sourceEligibilityModule, /\bfetch\s*\(/);

const scoreExpression = sourceIndex.match(/const total = Math\.round\(([^;]+)\);/)?.[1] || "";
assert.ok(scoreExpression.length > 50, "Route score expression could not be located.");
assert.doesNotMatch(scoreExpression, /hours/i, "Business hours must not change Route IQ score weights.");

const hoursIndex = buildRouteBusinessHoursIndex(artifact);
assert.equal(hoursIndex.recordCount, artifact.recordCount);
assert.equal(hoursIndex.recordCount, 398);
const activeIds = new Set(activePool.records.map(record => record.googlePlaceId));
const matchedActiveIds = [...activeIds].filter(placeId => hoursIndex.recordsByPlaceId.has(placeId));
assert.equal(matchedActiveIds.length, activePool.count);

const evaluatedAt = artifact.statusEvaluatedAt;
const decisionFor = record => evaluateRouteBusinessHoursEligibility({
  record,
  evaluatedAt,
  policy: hoursIndex.freshnessPolicy
});
const christian = hoursIndex.recordsByPlaceId.get("ChIJiduac7LCQIYR-sGBtIAjKR0");
const christianDecision = decisionFor(christian);
assert.equal(christian.permanentOperationalStatus, "OPERATIONAL");
assert.equal(christianDecision.status, "CLOSED_VERIFIED");
assert.equal(christianDecision.eligible, false);
assert.equal(christianDecision.reasonCode, "VERIFIED_CURRENT_WINDOW_CLOSED");
assert.ok(christianDecision.provenance.fieldEvidenceIds.includes("fitness-2026-07-11-christian-brothers-closed-observation"));

const openRecords = artifact.records.filter(record => record.activePoolMember && decisionFor(record).status === "OPEN_VERIFIED").slice(0, 16);
assert.equal(openRecords.length, 16);
const candidates = [christian, ...openRecords].map((record, index) => ({
  id: `verification-${record.googlePlaceId}`,
  googlePlaceId: record.googlePlaceId,
  name: record.businessName,
  address: record.address,
  score: 1000 - index,
  record
}));
const initial = maintainRouteQueue({
  workspaceId: "fitness_connection",
  representativeId: "cruz",
  operatingProfileId: "fitness",
  routeDate: "2026-07-11",
  primaryCandidates: candidates,
  force: true,
  isEligible: candidate => decisionFor(candidate.record).eligible,
  scoreCandidate: candidate => applyHoursEligibilityToScore(candidate.score, decisionFor(candidate.record)),
  now: evaluatedAt
});
assert.equal(initial.queue.entries.length, 15);
assert.equal(initial.queue.entries.some(entry => entry.identityKey === routeQueueIdentity(candidates[0])), false);
assert.equal(initial.queue.entries.every(entry => entry.eligibilitySnapshot?.status === "OPEN_VERIFIED"), true);
assert.equal(initial.queue.entries[0].scoreSnapshot, candidates[1].score);

const completedIdentity = initial.queue.entries[0].identityKey;
const replenished = maintainRouteQueue({
  queue: initial.queue,
  workspaceId: "fitness_connection",
  representativeId: "cruz",
  operatingProfileId: "fitness",
  routeDate: "2026-07-11",
  primaryCandidates: candidates,
  completedIdentityKeys: [completedIdentity],
  force: true,
  trigger: "visit-outcome",
  isEligible: candidate => decisionFor(candidate.record).eligible,
  scoreCandidate: candidate => applyHoursEligibilityToScore(candidate.score, decisionFor(candidate.record)),
  now: evaluatedAt
});
assert.equal(replenished.queue.entries.length, 15);
assert.equal(replenished.queue.entries.some(entry => entry.identityKey === completedIdentity), false);
assert.equal(replenished.queue.entries.some(entry => entry.identityKey === routeQueueIdentity(candidates[0])), false);
assert.equal(new Set(replenished.queue.entries.map(entry => entry.identityKey)).size, 15);

console.log("Route IQ Closed-Now Eligibility and Explainability v1 verification passed.");
