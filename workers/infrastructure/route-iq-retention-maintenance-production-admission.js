import {
  createRouteIqProspectiveAuthorityVerifier
} from "./route-iq-prospective-shadow-authority.js";
import {
  sha256Hex,
  stableJson
} from "./route-iq-prospective-shadow-contract.js";
import {
  routeIqRetentionLegalHoldLedgerBinding,
  routeIqRetentionMaintenanceAdmissionProducerBinding,
  routeIqRetentionMaintenanceStoreBinding
} from "./route-iq-retention-maintenance-runtime.js";
import {
  routeIqFieldSessionStoreBinding
} from "../../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

export const routeIqRetentionMaintenanceProductionAdmissionVersion =
  "route-iq-retention-maintenance-production-admission-v1";
export const routeIqRetentionMaintenanceProductionAdmissionPurpose =
  "route_iq_retention_maintenance_production_admission";
export const routeIqRetentionMaintenanceProductionAdmissionMaxLifetimeSeconds = 5 * 60;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40}$/u;
const WORKER_VERSION_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

const CLAIM_KEYS = Object.freeze([
  "purpose",
  "admissionVersion",
  "admissionReference",
  "issuedAt",
  "expiresAt",
  "environment",
  "release",
  "bindings",
  "legalHold",
  "protectedState",
  "runtimeBoundary",
  "artifactHashes",
  "authorization"
]);

const RELEASE_KEYS = Object.freeze([
  "commit",
  "tree",
  "privateWorker",
  "privateWorkerVersion"
]);

const BINDING_KEYS = Object.freeze([
  "ordinaryArchive",
  "maintenance",
  "legalHoldLedger",
  "admissionProducer"
]);

const STORE_BINDING_KEYS = Object.freeze([
  "name",
  "capabilityIdentitySha256",
  "storageLineageSha256",
  "deleteCapabilityExposed"
]);

const AUTHORITY_BINDING_KEYS = Object.freeze([
  "name",
  "capabilityIdentitySha256"
]);

const LEGAL_HOLD_KEYS = Object.freeze([
  "state",
  "environment",
  "verifiedAt",
  "availabilityEvidenceSha256",
  "fixtureStateAccepted"
]);

const PROTECTED_STATE_KEYS = Object.freeze([
  "collection",
  "activeCohorts",
  "recommendationInfluence",
  "providers",
  "scheduler"
]);

const RUNTIME_BOUNDARY_KEYS = Object.freeze([
  "publicRouteConfigured",
  "dashboardControlConfigured",
  "genericAdministrationControlConfigured",
  "cronConfigured",
  "alarmConfigured",
  "queueConsumerConfigured",
  "automaticDeletionConfigured"
]);

const ARTIFACT_HASH_KEYS = Object.freeze([
  "releaseArtifactSha256",
  "releaseManifestSha256",
  "releaseConfigurationSha256",
  "releaseContentSha256",
  "maintenanceRuntimeSha256",
  "retentionPolicySha256",
  "deletionRuntimeSha256",
  "forwardRollbackSha256"
]);

const AUTHORIZATION_KEYS = Object.freeze([
  "deploymentAuthorityGranted",
  "deletionAuthorityGranted",
  "dryRunAuthorityReusable"
]);

export class RouteIqRetentionMaintenanceAdmissionError extends Error {
  constructor(message, {
    code = "route_iq_retention_maintenance_admission_invalid",
    status = 403,
    details = {}
  } = {}) {
    super(message);
    this.name = "RouteIqRetentionMaintenanceAdmissionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqRetentionMaintenanceAdmissionError(message, { code, details });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, dimension) {
  if (!isPlainObject(value)) {
    fail("route_iq_retention_maintenance_admission_shape_invalid", "Production admission evidence has an invalid shape.", {
      dimension
    });
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (stableJson(actual) !== stableJson(expected)) {
    fail("route_iq_retention_maintenance_admission_shape_invalid", "Production admission evidence has unexpected or missing fields.", {
      dimension
    });
  }
}

function requireString(value, pattern, dimension) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail("route_iq_retention_maintenance_admission_identity_invalid", "Production admission identity is invalid.", {
      dimension
    });
  }
  return value;
}

function requireSha256(value, dimension) {
  return requireString(value, SHA256_PATTERN, dimension);
}

function requireCanonicalTimestamp(value, dimension) {
  if (typeof value !== "string" || value.length > 32) {
    fail("route_iq_retention_maintenance_admission_time_invalid", "Production admission time is invalid.", {
      dimension
    });
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail("route_iq_retention_maintenance_admission_time_invalid", "Production admission time is invalid.", {
      dimension
    });
  }
  return milliseconds;
}

function nowMilliseconds(now) {
  const value = now === undefined ? new Date() : now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value.getTime())) {
    fail("route_iq_retention_maintenance_admission_time_invalid", "Production admission verification time is invalid.");
  }
  return value.getTime();
}

function validateRelease(release) {
  exactKeys(release, RELEASE_KEYS, "release");
  requireString(release.commit, GIT_OBJECT_PATTERN, "release.commit");
  requireString(release.tree, GIT_OBJECT_PATTERN, "release.tree");
  if (release.privateWorker !== "prometheus-iq") {
    fail("route_iq_retention_maintenance_admission_target_invalid", "Production admission targets an unauthorized Worker.");
  }
  requireString(release.privateWorkerVersion, WORKER_VERSION_PATTERN, "release.privateWorkerVersion");
}

function validateStoreBinding(binding, {
  expectedName,
  deleteCapabilityExposed,
  dimension
}) {
  exactKeys(binding, STORE_BINDING_KEYS, dimension);
  if (binding.name !== expectedName || binding.deleteCapabilityExposed !== deleteCapabilityExposed) {
    fail("route_iq_retention_maintenance_admission_binding_invalid", "Production admission binding capability is invalid.", {
      dimension
    });
  }
  requireSha256(binding.capabilityIdentitySha256, `${dimension}.capabilityIdentitySha256`);
  requireSha256(binding.storageLineageSha256, `${dimension}.storageLineageSha256`);
}

function validateAuthorityBinding(binding, expectedName, dimension) {
  exactKeys(binding, AUTHORITY_BINDING_KEYS, dimension);
  if (binding.name !== expectedName) {
    fail("route_iq_retention_maintenance_admission_binding_invalid", "Production admission authority binding is invalid.", {
      dimension
    });
  }
  requireSha256(binding.capabilityIdentitySha256, `${dimension}.capabilityIdentitySha256`);
}

function validateBindings(bindings) {
  exactKeys(bindings, BINDING_KEYS, "bindings");
  validateStoreBinding(bindings.ordinaryArchive, {
    expectedName: routeIqFieldSessionStoreBinding,
    deleteCapabilityExposed: false,
    dimension: "bindings.ordinaryArchive"
  });
  validateStoreBinding(bindings.maintenance, {
    expectedName: routeIqRetentionMaintenanceStoreBinding,
    deleteCapabilityExposed: true,
    dimension: "bindings.maintenance"
  });
  validateAuthorityBinding(
    bindings.legalHoldLedger,
    routeIqRetentionLegalHoldLedgerBinding,
    "bindings.legalHoldLedger"
  );
  validateAuthorityBinding(
    bindings.admissionProducer,
    routeIqRetentionMaintenanceAdmissionProducerBinding,
    "bindings.admissionProducer"
  );

  const capabilityIdentities = [
    bindings.ordinaryArchive.capabilityIdentitySha256,
    bindings.maintenance.capabilityIdentitySha256,
    bindings.legalHoldLedger.capabilityIdentitySha256,
    bindings.admissionProducer.capabilityIdentitySha256
  ];
  if (new Set(capabilityIdentities).size !== capabilityIdentities.length
    || bindings.ordinaryArchive.storageLineageSha256 !== bindings.maintenance.storageLineageSha256) {
    fail(
      "route_iq_retention_maintenance_admission_binding_not_isolated",
      "Production admission bindings are not isolated over the exact governed storage lineage."
    );
  }
}

function validateLegalHold(legalHold, environment, issuedAtMilliseconds) {
  exactKeys(legalHold, LEGAL_HOLD_KEYS, "legalHold");
  const verifiedAtMilliseconds = requireCanonicalTimestamp(legalHold.verifiedAt, "legalHold.verifiedAt");
  requireSha256(legalHold.availabilityEvidenceSha256, "legalHold.availabilityEvidenceSha256");
  if (legalHold.state !== "AUTHORITATIVE_PRODUCTION_AVAILABLE"
    || legalHold.environment !== environment
    || environment !== "production_private"
    || legalHold.fixtureStateAccepted !== false
    || verifiedAtMilliseconds > issuedAtMilliseconds
    || issuedAtMilliseconds - verifiedAtMilliseconds > routeIqRetentionMaintenanceProductionAdmissionMaxLifetimeSeconds * 1000) {
    fail(
      "route_iq_retention_maintenance_admission_legal_hold_unavailable",
      "Authoritative production legal-hold evidence is unavailable, stale, or invalid."
    );
  }
}

function validateProtectedState(protectedState) {
  exactKeys(protectedState, PROTECTED_STATE_KEYS, "protectedState");
  if (protectedState.collection !== "OFF"
    || protectedState.activeCohorts !== 0
    || protectedState.recommendationInfluence !== "OFF"
    || protectedState.providers !== "OFF"
    || protectedState.scheduler !== "OFF") {
    fail("route_iq_retention_maintenance_admission_protected_state_invalid", "Protected production state is not fail-closed.");
  }
}

function validateRuntimeBoundary(runtimeBoundary) {
  exactKeys(runtimeBoundary, RUNTIME_BOUNDARY_KEYS, "runtimeBoundary");
  if (Object.values(runtimeBoundary).some(value => value !== false)) {
    fail("route_iq_retention_maintenance_admission_surface_invalid", "Dormant maintenance runtime exposure is prohibited.");
  }
}

function validateArtifactHashes(artifactHashes) {
  exactKeys(artifactHashes, ARTIFACT_HASH_KEYS, "artifactHashes");
  for (const key of ARTIFACT_HASH_KEYS) requireSha256(artifactHashes[key], `artifactHashes.${key}`);
}

function validateAuthorization(authorization) {
  exactKeys(authorization, AUTHORIZATION_KEYS, "authorization");
  if (authorization.deploymentAuthorityGranted !== false
    || authorization.deletionAuthorityGranted !== false
    || authorization.dryRunAuthorityReusable !== false) {
    fail("route_iq_retention_maintenance_admission_authority_invalid", "Production admission cannot grant deployment or deletion authority.");
  }
}

function validateExpected(expected) {
  exactKeys(expected, [
    "environment",
    "release",
    "bindings",
    "legalHold",
    "protectedState",
    "runtimeBoundary",
    "artifactHashes",
    "authorization"
  ], "expected");
  if (expected.environment !== "production_private") {
    fail("route_iq_retention_maintenance_admission_environment_invalid", "Production admission environment is invalid.");
  }
  validateRelease(expected.release);
  validateBindings(expected.bindings);
  validateProtectedState(expected.protectedState);
  validateRuntimeBoundary(expected.runtimeBoundary);
  validateArtifactHashes(expected.artifactHashes);
  validateAuthorization(expected.authorization);
}

function exactExpectedClaims(claims, expected) {
  for (const key of [
    "environment",
    "release",
    "bindings",
    "legalHold",
    "protectedState",
    "runtimeBoundary",
    "artifactHashes",
    "authorization"
  ]) {
    if (stableJson(claims[key]) !== stableJson(expected[key])) {
      fail("route_iq_retention_maintenance_admission_evidence_mismatch", "Production admission evidence does not match the expected immutable release.", {
        dimension: key
      });
    }
  }
}

async function consumeReplayGuard(replayGuard, input) {
  if (!replayGuard || typeof replayGuard.consume !== "function") {
    fail("route_iq_retention_maintenance_admission_replay_guard_unavailable", "An atomic production admission replay guard is required.");
  }
  let consumed;
  try {
    consumed = await replayGuard.consume(input);
  } catch {
    fail("route_iq_retention_maintenance_admission_replay_guard_unavailable", "Production admission replay state could not be verified.");
  }
  if (consumed !== true) {
    fail("route_iq_retention_maintenance_admission_replayed", "Production admission evidence has already been consumed.");
  }
}

export async function verifyRouteIqRetentionMaintenanceProductionAdmission(envelope, {
  env,
  expected,
  now,
  replayGuard
} = {}) {
  validateExpected(expected);
  let verified;
  try {
    verified = await createRouteIqProspectiveAuthorityVerifier(env).verify(envelope, {
      purpose: routeIqRetentionMaintenanceProductionAdmissionPurpose,
      channel: "producer"
    });
  } catch {
    fail("route_iq_retention_maintenance_admission_signature_invalid", "Production admission signature verification failed.");
  }

  const claims = verified.claims;
  exactKeys(claims, CLAIM_KEYS, "claims");
  requireSha256(claims.admissionReference, "claims.admissionReference");
  const issuedAtMilliseconds = requireCanonicalTimestamp(claims.issuedAt, "claims.issuedAt");
  const expiresAtMilliseconds = requireCanonicalTimestamp(claims.expiresAt, "claims.expiresAt");
  const verifiedAtMilliseconds = nowMilliseconds(now);
  if (claims.purpose !== routeIqRetentionMaintenanceProductionAdmissionPurpose
    || claims.admissionVersion !== routeIqRetentionMaintenanceProductionAdmissionVersion
    || issuedAtMilliseconds > verifiedAtMilliseconds
    || expiresAtMilliseconds <= verifiedAtMilliseconds
    || expiresAtMilliseconds <= issuedAtMilliseconds
    || expiresAtMilliseconds - issuedAtMilliseconds > routeIqRetentionMaintenanceProductionAdmissionMaxLifetimeSeconds * 1000) {
    fail("route_iq_retention_maintenance_admission_stale", "Production admission evidence is stale, premature, expired, or outside its maximum lifetime.");
  }

  validateRelease(claims.release);
  validateBindings(claims.bindings);
  validateLegalHold(claims.legalHold, claims.environment, issuedAtMilliseconds);
  validateProtectedState(claims.protectedState);
  validateRuntimeBoundary(claims.runtimeBoundary);
  validateArtifactHashes(claims.artifactHashes);
  validateAuthorization(claims.authorization);
  exactExpectedClaims(claims, expected);

  const evidenceSha256 = await sha256Hex({
    admissionVersion: claims.admissionVersion,
    admissionReference: claims.admissionReference,
    environment: claims.environment,
    release: claims.release,
    bindings: claims.bindings,
    legalHold: claims.legalHold,
    protectedState: claims.protectedState,
    runtimeBoundary: claims.runtimeBoundary,
    artifactHashes: claims.artifactHashes,
    authorization: claims.authorization,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt
  });
  await consumeReplayGuard(replayGuard, {
    admissionReference: claims.admissionReference,
    evidenceSha256,
    expiresAt: claims.expiresAt
  });

  return Object.freeze({
    admitted: true,
    admissionVersion: claims.admissionVersion,
    evidenceSha256,
    environment: claims.environment,
    release: Object.freeze({ ...claims.release }),
    artifactHashes: Object.freeze({ ...claims.artifactHashes }),
    deploymentAuthorityGranted: false,
    deletionAuthorityGranted: false,
    keyId: verified.keyId,
    verificationType: verified.verificationType
  });
}

export async function requestRouteIqRetentionMaintenanceProductionAdmission({
  env,
  expected,
  now,
  replayGuard
} = {}) {
  validateExpected(expected);
  const producer = env?.[routeIqRetentionMaintenanceAdmissionProducerBinding];
  const ordinary = env?.[routeIqFieldSessionStoreBinding];
  const maintenance = env?.[routeIqRetentionMaintenanceStoreBinding];
  const legalHoldLedger = env?.[routeIqRetentionLegalHoldLedgerBinding];
  if (!producer || typeof producer.produceRetentionMaintenanceAdmission !== "function") {
    fail("route_iq_retention_maintenance_admission_producer_unavailable", "The production admission producer binding is unavailable.");
  }
  if (producer === ordinary || producer === maintenance || producer === legalHoldLedger) {
    fail("route_iq_retention_maintenance_admission_binding_not_isolated", "The production admission producer binding is not isolated.");
  }
  const requestedAt = new Date(nowMilliseconds(now)).toISOString();
  let envelope;
  try {
    envelope = await producer.produceRetentionMaintenanceAdmission(Object.freeze({
      requestVersion: routeIqRetentionMaintenanceProductionAdmissionVersion,
      requestedAt,
      expected: structuredClone(expected),
      deploymentAuthorityRequested: false,
      deletionAuthorityRequested: false
    }));
  } catch {
    fail("route_iq_retention_maintenance_admission_producer_unavailable", "The production admission producer did not return verifiable evidence.");
  }
  return verifyRouteIqRetentionMaintenanceProductionAdmission(envelope, {
    env,
    expected,
    now,
    replayGuard
  });
}
