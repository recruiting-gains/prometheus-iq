import {
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV
} from "./route-iq-prospective-shadow-contract.js";
import { getRouteIqProspectiveActivation } from "./route-iq-prospective-shadow-access.js";

export const routeIqProspectiveActivationReadinessVersion =
  "route-iq-prospective-activation-readiness-v1";

const SNAPSHOT_KEYS = Object.freeze([
  "fixtureKind",
  "productionAccessUsed",
  "endpointState",
  "endpointHttpStatus",
  "attemptedApplicationWrites",
  "activeCohortCount",
  "durableObjectInstanceCount",
  "kvWriteCount",
  "prospectiveRecordCount",
  "conflictCount",
  "exclusionCount",
  "evaluationCount",
  "archiveDispositionConsumerExclusionVerified",
  "recommendationInfluence",
  "usage"
]);

const USAGE_BUDGET_KEYS = Object.freeze([
  "browserBodyBytes",
  "candidateCount",
  "domainCommandBytes",
  "eventsPerDay",
  "opportunitiesPerSession",
  "pendingOutbox",
  "principals",
  "rowsReadPerRpc",
  "rowsWrittenPerRpc",
  "sourceArtifactBytes",
  "sourceArtifactTotalBytes",
  "sourceCount",
  "sqlStatementsPerRpc",
  "storageBytesPerCoordinator"
]);

const ZERO_WHILE_OFF_KEYS = Object.freeze([
  "attemptedApplicationWrites",
  "activeCohortCount",
  "durableObjectInstanceCount",
  "kvWriteCount",
  "prospectiveRecordCount",
  "conflictCount",
  "exclusionCount",
  "evaluationCount"
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isNonnegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function freezeAudit(report) {
  return Object.freeze({
    ...report,
    counters: Object.freeze({ ...report.counters }),
    usage: Object.freeze({ ...report.usage }),
    blockers: Object.freeze([...report.blockers])
  });
}

export function auditRouteIqProspectiveActivationReadiness({
  env,
  observation,
  now
} = {}) {
  const blockers = new Set();
  const candidate = isPlainObject(observation) ? observation : {};
  if (!hasExactKeys(candidate, SNAPSHOT_KEYS)) blockers.add("audit_observation_shape_invalid");
  if (!hasExactKeys(candidate.usage, USAGE_BUDGET_KEYS)) blockers.add("audit_usage_shape_invalid");

  const activation = getRouteIqProspectiveActivation(env, { now });
  const requestedCollectionOn = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection] === "ON";
  const expectedFixtureKind = activation.active ? "hypothetical_on" : "collection_off";
  const expectedEndpointState = activation.active ? "enabled" : "disabled";
  const expectedEndpointStatus = activation.active ? 200 : 202;

  if (candidate.fixtureKind !== expectedFixtureKind) blockers.add("fixture_collection_state_mismatch");
  if (candidate.productionAccessUsed !== false) blockers.add("production_access_prohibited");
  if (candidate.endpointState !== expectedEndpointState
    || candidate.endpointHttpStatus !== expectedEndpointStatus) {
    blockers.add("endpoint_state_mismatch");
  }
  if (candidate.recommendationInfluence !== "OFF") blockers.add("recommendation_influence_not_off");
  if (candidate.archiveDispositionConsumerExclusionVerified !== true) {
    blockers.add("archive_disposition_consumer_exclusion_unverified");
  }

  for (const key of ZERO_WHILE_OFF_KEYS) {
    if (!isNonnegativeSafeInteger(candidate[key])) blockers.add(`${key}_invalid`);
  }
  if (!activation.active) {
    for (const key of ZERO_WHILE_OFF_KEYS) {
      if (candidate[key] !== 0) blockers.add(`${key}_nonzero_while_off`);
    }
  } else {
    if (candidate.attemptedApplicationWrites !== 0) {
      blockers.add("preactivation_write_attempt_detected");
    }
    if (candidate.activeCohortCount !== activation.activeCohortCount) {
      blockers.add("active_cohort_count_mismatch");
    }
    for (const key of [
      "durableObjectInstanceCount",
      "kvWriteCount",
      "prospectiveRecordCount",
      "conflictCount",
      "exclusionCount",
      "evaluationCount"
    ]) {
      if (candidate[key] !== 0) blockers.add(`${key}_nonzero_before_activation`);
    }
  }
  if (requestedCollectionOn && !activation.active) {
    blockers.add(`activation_${activation.reason}`);
  }

  const usage = isPlainObject(candidate.usage) ? candidate.usage : {};
  for (const key of USAGE_BUDGET_KEYS) {
    if (!isNonnegativeSafeInteger(usage[key])) {
      blockers.add(`${key}_usage_invalid`);
      continue;
    }
    if (usage[key] > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS[key]) {
      blockers.add(`${key}_budget_exceeded`);
    }
    if (!activation.active && usage[key] !== 0) blockers.add(`${key}_nonzero_while_off`);
  }
  if (activation.active && usage.principals !== activation.activeCohortCount) {
    blockers.add("principal_usage_cohort_mismatch");
  }

  const orderedBlockers = [...blockers].sort();
  return freezeAudit({
    auditVersion: routeIqProspectiveActivationReadinessVersion,
    status: orderedBlockers.length === 0 ? "PASS" : "BLOCKED",
    mode: activation.active ? "HYPOTHETICAL_ON" : "COLLECTION_OFF",
    collection: activation.active ? "ON" : "OFF",
    activationReason: activation.reason,
    activationAuthorized: false,
    productionVerified: false,
    verificationScope: "LOCAL_SOURCE_ONLY",
    deployedEnvironmentStatus: "UNVERIFIED",
    deployedCountsStatus: "UNVERIFIED",
    recommendationInfluence: "OFF",
    activeCohortCount: activation.activeCohortCount,
    deployedActiveCohortCount: null,
    endpointState: expectedEndpointState,
    counters: {
      attemptedApplicationWrites: candidate.attemptedApplicationWrites ?? null,
      durableObjectInstanceCount: candidate.durableObjectInstanceCount ?? null,
      kvWriteCount: candidate.kvWriteCount ?? null,
      prospectiveRecordCount: candidate.prospectiveRecordCount ?? null,
      conflictCount: candidate.conflictCount ?? null,
      exclusionCount: candidate.exclusionCount ?? null,
      evaluationCount: candidate.evaluationCount ?? null
    },
    usage,
    blockers: orderedBlockers
  });
}
