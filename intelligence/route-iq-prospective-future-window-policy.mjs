import { createHash } from "node:crypto";

import historicalJulyReadinessConfig from "./config/shadow-decision-readiness-v1.json" with {
  type: "json",
};
import prospectiveFutureWindowPolicy from "./config/route-iq-prospective-future-window-policy-v1.json" with {
  type: "json",
};
import prospectiveFutureWindowContract from "./contracts/route-iq-prospective-future-window-policy-v1.json" with {
  type: "json",
};

export const routeIqProspectiveFutureWindowBatchId = "BATCH-20260814-001";
export const routeIqProspectiveFutureWindowPolicyVersion =
  "route-iq-prospective-future-window-policy-v1";
export const routeIqProspectiveFutureWindowAssignmentVersion =
  "route-iq-prospective-future-window-assignment-v1";
export const routeIqProspectiveFutureWindowContractVersion =
  "route-iq-prospective-future-window-policy-contract-v1";
export const routeIqProspectiveFutureReadinessConfigVersion =
  "route-iq-shadow-decision-readiness-config-v2";
export const routeIqProspectiveFutureWindowAuthorityPurpose =
  "route_iq_prospective_future_window_anchor";
export const routeIqProspectiveFutureWindowAuthorityAdmissionVersion =
  "route-iq-authoritative-server-evidence-admission-v1";
export const routeIqProspectiveFutureWindowAuthorityEvidenceVersion =
  "route-iq-authoritative-server-anchor-evidence-v1";
export const routeIqProspectiveFutureWindowAuthorityMaximumAgeMilliseconds =
  5 * 60 * 1000;

export const routeIqProspectiveFutureWindowPolicyPath =
  "intelligence/config/route-iq-prospective-future-window-policy-v1.json";
export const routeIqProspectiveFutureWindowContractPath =
  "intelligence/contracts/route-iq-prospective-future-window-policy-v1.json";
export const routeIqHistoricalJulyReadinessConfigPath =
  "intelligence/config/shadow-decision-readiness-v1.json";
export const routeIqHistoricalJulyReadinessConfigSha256 =
  "29287a69b4cfbbb195806e45517872a33c2cc8e5335b2f83d73c003718120204";
export const routeIqHistoricalJulyReadinessConfigByteLength = 4417;

export const routeIqProspectiveFutureWindowPolicySha256 =
  "a5e31df01e65d26cefae792a4255981e6230458a0b28a20f751d97c9f225ef78";
export const routeIqProspectiveFutureWindowPolicyByteLength = 2076;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const KEY_ID_PATTERN = /^riq_key_[a-f0-9]{64}$/;
const ACCEPTED_VERIFICATION_TYPES = Object.freeze([
  "infrastructure_keyed_attestation",
  "infrastructure_verified_producer_signature",
]);
const ACCEPTED_KEYED_ALGORITHMS = Object.freeze([
  "HMAC-SHA-256",
  "Ed25519",
]);
const ASSIGNMENT_KEYS = Object.freeze([
  "assignmentVersion",
  "assignmentId",
  "batchId",
  "policyVersion",
  "sourcePolicy",
  "policySha256",
  "sourceOnly",
  "authorityEvidence",
  "historicalReadinessConfig",
  "windowAssignment",
  "readinessConfig",
  "readinessConfigSha256",
  "activation",
  "immutable",
  "assignmentSha256",
]);
const AUTHORITY_ADMISSION_KEYS = Object.freeze([
  "admitted",
  "admissionVersion",
  "verificationType",
  "algorithm",
  "keyId",
  "admittedAt",
  "evidence",
]);
const AUTHORITY_EVIDENCE_KEYS = Object.freeze([
  "evidenceVersion",
  "purpose",
  "policyVersion",
  "issuedAt",
  "expiresAt",
  "authoritativeServerAnchor",
  "sourceRecordSha256",
  "authorityReceiptSha256",
  "evidenceSha256",
]);
const AUTHORITY_BINDING_KEYS = Object.freeze([
  "admitted",
  "admissionVersion",
  "verificationType",
  "algorithm",
  "keyId",
  "admittedAt",
  ...AUTHORITY_EVIDENCE_KEYS,
  "admissionSha256",
]);
const WINDOW_KEYS = Object.freeze(["id", "kind", "start", "endExclusive"]);
const SOURCE_POLICY_KEYS = Object.freeze(["path", "rawSha256", "byteLength"]);
const HISTORICAL_CONFIG_BINDING_KEYS = Object.freeze([
  "path",
  "configVersion",
  "rawSha256",
  "byteLength",
]);
const WINDOW_ASSIGNMENT_KEYS = Object.freeze([
  "anchorSource",
  "authoritativeServerAnchor",
  "bounds",
  "timezone",
  "templateRule",
  "trainingWindowCount",
  "evaluationWindowCount",
  "windows",
  "windowsSha256",
  "immutable",
]);
const ACTIVATION_KEYS = Object.freeze([
  "productionConsumerActivated",
  "productionDeploymentPerformed",
  "recommendationInfluence",
]);
const CALLER_ANCHOR_KEYS = Object.freeze([
  "anchor",
  "anchorAt",
  "authoritativeServerAnchor",
  "serverAnchor",
  "serverTime",
  "issuedAt",
  "now",
]);

export class RouteIqProspectiveFutureWindowPolicyError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "RouteIqProspectiveFutureWindowPolicyError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new RouteIqProspectiveFutureWindowPolicyError(code, details);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, code) {
  if (!isPlainObject(value)) fail(code);
  const expected = new Set(keys);
  if (
    Object.keys(value).some((key) => !expected.has(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    fail(code);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value))
    .digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function withoutKey(value, key) {
  return Object.fromEntries(
    Object.entries(value).filter(([candidate]) => candidate !== key),
  );
}

function canonicalTimestamp(value, code) {
  if (typeof value !== "string") fail(code);
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    fail(code);
  }
  return { iso: value, milliseconds };
}

function assertSha256(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
  return value;
}

function assertPinnedBytes(bytes, { sha, byteLength, code }) {
  const normalized = Buffer.from(bytes);
  if (normalized.byteLength !== byteLength || sha256(normalized) !== sha) {
    fail(code, {
      expectedSha256: sha,
      expectedByteLength: byteLength,
      actualSha256: sha256(normalized),
      actualByteLength: normalized.byteLength,
    });
  }
  return true;
}

export function validateRouteIqHistoricalJulyReadinessConfigBytes(bytes) {
  return assertPinnedBytes(bytes, {
    sha: routeIqHistoricalJulyReadinessConfigSha256,
    byteLength: routeIqHistoricalJulyReadinessConfigByteLength,
    code: "route_iq_future_window_historical_config_bytes_changed",
  });
}

function validateSourcePolicyBytes(bytes) {
  return assertPinnedBytes(bytes, {
    sha: routeIqProspectiveFutureWindowPolicySha256,
    byteLength: routeIqProspectiveFutureWindowPolicyByteLength,
    code: "route_iq_future_window_source_policy_bytes_changed",
  });
}

export function loadRouteIqHistoricalJulyReadinessConfig() {
  return clone(historicalJulyReadinessConfig);
}

export function loadRouteIqProspectiveFutureWindowPolicy() {
  const policy = clone(prospectiveFutureWindowPolicy);
  validateRouteIqProspectiveFutureWindowPolicy(policy);
  return policy;
}

export function loadRouteIqProspectiveFutureWindowContract() {
  const contract = clone(prospectiveFutureWindowContract);
  if (
    contract?.contractVersion !==
      routeIqProspectiveFutureWindowContractVersion ||
    contract?.batchId !== routeIqProspectiveFutureWindowBatchId ||
    contract?.entrypoint !==
      "createRouteIqProspectiveFutureWindowAssignment" ||
    contract?.status !== "source_only_not_activated" ||
    contract?.persistenceHandoff?.retroactiveReassignmentAllowed !== false ||
    contract?.activation?.productionConsumerActivated !== false ||
    contract?.activation?.productionDeploymentPerformed !== false ||
    contract?.activation?.recommendationInfluence !== "OFF"
  ) {
    fail("route_iq_future_window_contract_invalid");
  }
  return clone(contract);
}

export function validateRouteIqProspectiveFutureWindowPolicy(policy) {
  const pinnedPolicy = prospectiveFutureWindowPolicy;
  if (
    canonical(policy) !== canonical(pinnedPolicy) ||
    policy?.batchId !== routeIqProspectiveFutureWindowBatchId ||
    policy?.policyVersion !== routeIqProspectiveFutureWindowPolicyVersion ||
    policy?.assignmentVersion !==
      routeIqProspectiveFutureWindowAssignmentVersion ||
    policy?.readinessConfigVersion !==
      routeIqProspectiveFutureReadinessConfigVersion ||
    policy?.status !== "source_only_not_activated" ||
    policy?.owningSubsystem !== "Prometheus Intelligence" ||
    policy?.historicalReadinessConfig?.path !==
      routeIqHistoricalJulyReadinessConfigPath ||
    policy?.historicalReadinessConfig?.configVersion !==
      "route-iq-shadow-decision-readiness-config-v1" ||
    policy?.historicalReadinessConfig?.rawSha256 !==
      routeIqHistoricalJulyReadinessConfigSha256 ||
    policy?.historicalReadinessConfig?.byteLength !==
      routeIqHistoricalJulyReadinessConfigByteLength ||
    policy?.authority?.purpose !==
      routeIqProspectiveFutureWindowAuthorityPurpose ||
    policy?.authority?.admissionVersion !==
      routeIqProspectiveFutureWindowAuthorityAdmissionVersion ||
    policy?.authority?.evidenceVersion !==
      routeIqProspectiveFutureWindowAuthorityEvidenceVersion ||
    canonical(policy?.authority?.acceptedVerificationTypes) !==
      canonical(ACCEPTED_VERIFICATION_TYPES) ||
    canonical(policy?.authority?.acceptedKeyedAlgorithms) !==
      canonical(ACCEPTED_KEYED_ALGORITHMS) ||
    policy?.authority?.callerSuppliedAnchorAllowed !== false ||
    policy?.authority?.futureIssuedAuthorityAllowed !== false ||
    policy?.authority?.maximumAdmissionAgeMilliseconds !==
      routeIqProspectiveFutureWindowAuthorityMaximumAgeMilliseconds ||
    policy?.authority?.exclusiveExpiry !== true ||
    policy?.authority?.anchorEqualsAdmissionIssuedAt !== true ||
    policy?.windows?.bounds !== "start_inclusive_end_exclusive" ||
    policy?.windows?.timezone !== "UTC" ||
    policy?.windows?.gapAllowed !== false ||
    policy?.windows?.overlapAllowed !== false ||
    policy?.windows?.trainingWindowCount !== 1 ||
    policy?.windows?.minimumEvaluationWindows < 2 ||
    policy?.windows?.reassignmentRule !== "immutable_compare_and_append" ||
    policy?.activation?.sourceOnly !== true ||
    policy?.activation?.productionConsumerActivated !== false ||
    policy?.activation?.productionDeploymentPerformed !== false ||
    policy?.activation?.recommendationInfluence !== "OFF"
  ) {
    fail("route_iq_future_window_source_policy_semantics_invalid");
  }
  return true;
}

function validateWindowList(windows) {
  if (!Array.isArray(windows) || windows.length === 0) {
    fail("route_iq_future_window_windows_missing");
  }
  const ids = new Set();
  let trainingWindowCount = 0;
  let evaluationWindowCount = 0;
  let prior = null;
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    assertExactKeys(
      window,
      WINDOW_KEYS,
      "route_iq_future_window_window_invalid",
    );
    if (
      typeof window.id !== "string" ||
      !window.id.length ||
      window.id.trim() !== window.id ||
      ids.has(window.id) ||
      !["training", "evaluation"].includes(window.kind)
    ) {
      fail("route_iq_future_window_window_invalid");
    }
    ids.add(window.id);
    const start = canonicalTimestamp(
      window.start,
      "route_iq_future_window_chronology_invalid",
    );
    const end = canonicalTimestamp(
      window.endExclusive,
      "route_iq_future_window_chronology_invalid",
    );
    if (start.milliseconds >= end.milliseconds) {
      fail("route_iq_future_window_chronology_invalid");
    }
    if (window.kind === "training") trainingWindowCount += 1;
    if (window.kind === "evaluation") evaluationWindowCount += 1;
    if (index === 0 && window.kind !== "training") {
      fail("route_iq_future_window_chronology_invalid");
    }
    if (index > 0 && window.kind !== "evaluation") {
      fail("route_iq_future_window_chronology_invalid");
    }
    if (prior) {
      if (start.milliseconds < prior.end.milliseconds) {
        fail("route_iq_future_window_overlap", {
          priorWindowId: prior.window.id,
          windowId: window.id,
        });
      }
      if (start.milliseconds > prior.end.milliseconds) {
        fail("route_iq_future_window_gap", {
          priorWindowId: prior.window.id,
          windowId: window.id,
        });
      }
    }
    prior = { window, end };
  }
  if (trainingWindowCount !== 1) {
    fail("route_iq_future_window_training_window_count_invalid");
  }
  if (evaluationWindowCount < 2) {
    fail("route_iq_future_window_evaluation_windows_insufficient");
  }
  return { trainingWindowCount, evaluationWindowCount };
}

export function validateRouteIqProspectiveFutureWindows(windows) {
  validateWindowList(windows);
  return true;
}

function historicalWindowTemplate(config) {
  const counts = validateWindowList(config?.windows);
  if (
    counts.trainingWindowCount !== 1 ||
    counts.evaluationWindowCount < Number(config.minimumEvaluationWindows) ||
    Number(config.minimumEvaluationWindows) < 2
  ) {
    fail("route_iq_future_window_historical_template_invalid");
  }
  return config.windows.map((window) => {
    const start = canonicalTimestamp(
      window.start,
      "route_iq_future_window_historical_template_invalid",
    );
    const end = canonicalTimestamp(
      window.endExclusive,
      "route_iq_future_window_historical_template_invalid",
    );
    return {
      kind: window.kind,
      durationMilliseconds: end.milliseconds - start.milliseconds,
    };
  });
}

function futureWindowId(kind, ordinal) {
  return `${kind === "training" ? "prospective-training" : "prospective-evaluation"}-${String(ordinal).padStart(3, "0")}`;
}

function deriveFutureWindows(authoritativeServerAnchor, historicalConfig) {
  const anchor = canonicalTimestamp(
    authoritativeServerAnchor,
    "route_iq_future_window_authority_anchor_invalid",
  );
  const template = historicalWindowTemplate(historicalConfig);
  let cursor = anchor.milliseconds;
  let trainingOrdinal = 0;
  let evaluationOrdinal = 0;
  const windows = template.map((item) => {
    const ordinal =
      item.kind === "training" ? ++trainingOrdinal : ++evaluationOrdinal;
    const end = cursor + item.durationMilliseconds;
    if (!Number.isFinite(end)) {
      fail("route_iq_future_window_chronology_invalid");
    }
    let startIso;
    let endIso;
    try {
      startIso = new Date(cursor).toISOString();
      endIso = new Date(end).toISOString();
    } catch {
      fail("route_iq_future_window_chronology_invalid");
    }
    const window = {
      id: futureWindowId(item.kind, ordinal),
      kind: item.kind,
      start: startIso,
      endExclusive: endIso,
    };
    cursor = end;
    return window;
  });
  const counts = validateWindowList(windows);
  if (
    windows[0].start !== anchor.iso ||
    windows
      .filter((window) => window.kind === "evaluation")
      .some((window) => Date.parse(window.start) <= anchor.milliseconds)
  ) {
    fail("route_iq_future_window_not_prospective");
  }
  return { windows, ...counts };
}

function createReadinessConfig(historicalConfig, windows) {
  const readinessConfig = clone(historicalConfig);
  readinessConfig.batchId = routeIqProspectiveFutureWindowBatchId;
  readinessConfig.configVersion = routeIqProspectiveFutureReadinessConfigVersion;
  readinessConfig.windows = clone(windows);
  const preservedHistorical = withoutKey(
    withoutKey(withoutKey(historicalConfig, "batchId"), "configVersion"),
    "windows",
  );
  const preservedGenerated = withoutKey(
    withoutKey(withoutKey(readinessConfig, "batchId"), "configVersion"),
    "windows",
  );
  if (canonical(preservedHistorical) !== canonical(preservedGenerated)) {
    fail("route_iq_future_window_threshold_or_semantics_changed");
  }
  if (
    readinessConfig.minimumEvaluationWindows < 2 ||
    windows.filter((window) => window.kind === "evaluation").length <
      readinessConfig.minimumEvaluationWindows
  ) {
    fail("route_iq_future_window_evaluation_windows_insufficient");
  }
  return readinessConfig;
}

function normalizeAuthorityAdmission(admission, { serverNow } = {}) {
  assertExactKeys(
    admission,
    AUTHORITY_ADMISSION_KEYS,
    "route_iq_future_window_authority_admission_invalid",
  );
  assertExactKeys(
    admission.evidence,
    AUTHORITY_EVIDENCE_KEYS,
    "route_iq_future_window_authority_evidence_invalid",
  );
  const evidence = admission.evidence;
  if (
    admission.admitted !== true ||
    admission.admissionVersion !==
      routeIqProspectiveFutureWindowAuthorityAdmissionVersion ||
    !ACCEPTED_VERIFICATION_TYPES.includes(admission.verificationType) ||
    !ACCEPTED_KEYED_ALGORITHMS.includes(admission.algorithm) ||
    !KEY_ID_PATTERN.test(admission.keyId) ||
    evidence.evidenceVersion !==
      routeIqProspectiveFutureWindowAuthorityEvidenceVersion ||
    evidence.purpose !== routeIqProspectiveFutureWindowAuthorityPurpose ||
    evidence.policyVersion !== routeIqProspectiveFutureWindowPolicyVersion
  ) {
    fail("route_iq_future_window_authority_not_admitted");
  }
  const admittedAt = canonicalTimestamp(
    admission.admittedAt,
    "route_iq_future_window_authority_chronology_invalid",
  );
  const issuedAt = canonicalTimestamp(
    evidence.issuedAt,
    "route_iq_future_window_authority_chronology_invalid",
  );
  const expiresAt = canonicalTimestamp(
    evidence.expiresAt,
    "route_iq_future_window_authority_chronology_invalid",
  );
  const anchor = canonicalTimestamp(
    evidence.authoritativeServerAnchor,
    "route_iq_future_window_authority_anchor_invalid",
  );
  assertSha256(
    evidence.sourceRecordSha256,
    "route_iq_future_window_authority_evidence_invalid",
  );
  assertSha256(
    evidence.authorityReceiptSha256,
    "route_iq_future_window_authority_evidence_invalid",
  );
  assertSha256(
    evidence.evidenceSha256,
    "route_iq_future_window_authority_evidence_invalid",
  );
  if (sha256(withoutKey(evidence, "evidenceSha256")) !== evidence.evidenceSha256) {
    fail("route_iq_future_window_authority_evidence_digest_invalid");
  }
  const trustedNow = serverNow === undefined
    ? null
    : canonicalTimestamp(
        serverNow,
        "route_iq_future_window_server_time_invalid",
      );
  if (
    trustedNow &&
    (issuedAt.milliseconds > trustedNow.milliseconds ||
      admittedAt.milliseconds > trustedNow.milliseconds)
  ) {
    fail("route_iq_future_window_authority_stale_or_future");
  }
  if (
    anchor.milliseconds !== issuedAt.milliseconds ||
    issuedAt.milliseconds > admittedAt.milliseconds ||
    admittedAt.milliseconds >= expiresAt.milliseconds ||
    expiresAt.milliseconds - issuedAt.milliseconds >
      routeIqProspectiveFutureWindowAuthorityMaximumAgeMilliseconds
  ) {
    fail("route_iq_future_window_authority_chronology_invalid");
  }
  if (trustedNow) {
    if (
      trustedNow.milliseconds >= expiresAt.milliseconds ||
      trustedNow.milliseconds - issuedAt.milliseconds >
        routeIqProspectiveFutureWindowAuthorityMaximumAgeMilliseconds
    ) {
      fail("route_iq_future_window_authority_stale_or_future");
    }
  }
  const bindingBody = {
    admitted: true,
    admissionVersion: admission.admissionVersion,
    verificationType: admission.verificationType,
    algorithm: admission.algorithm,
    keyId: admission.keyId,
    admittedAt: admittedAt.iso,
    evidenceVersion: evidence.evidenceVersion,
    purpose: evidence.purpose,
    policyVersion: evidence.policyVersion,
    issuedAt: issuedAt.iso,
    expiresAt: expiresAt.iso,
    authoritativeServerAnchor: anchor.iso,
    sourceRecordSha256: evidence.sourceRecordSha256,
    authorityReceiptSha256: evidence.authorityReceiptSha256,
    evidenceSha256: evidence.evidenceSha256,
  };
  return deepFreeze({
    ...bindingBody,
    admissionSha256: sha256(bindingBody),
  });
}

function validateAuthorityBinding(binding) {
  assertExactKeys(
    binding,
    AUTHORITY_BINDING_KEYS,
    "route_iq_future_window_authority_binding_invalid",
  );
  const admission = {
    admitted: binding.admitted,
    admissionVersion: binding.admissionVersion,
    verificationType: binding.verificationType,
    algorithm: binding.algorithm,
    keyId: binding.keyId,
    admittedAt: binding.admittedAt,
    evidence: Object.fromEntries(
      AUTHORITY_EVIDENCE_KEYS.map((key) => [key, binding[key]]),
    ),
  };
  const normalized = normalizeAuthorityAdmission(admission);
  if (
    binding.admissionSha256 !== normalized.admissionSha256 ||
    canonical(binding) !== canonical(normalized)
  ) {
    fail("route_iq_future_window_authority_binding_invalid");
  }
  return normalized;
}

async function admitAuthoritativeServerEvidence(authorityEnvelope, options) {
  if (!options?.authorityVerifier || typeof options.authorityVerifier.verify !== "function") {
    fail("route_iq_future_window_authority_verifier_required");
  }
  if (options.serverNow === undefined) {
    fail("route_iq_future_window_server_time_required");
  }
  let admission;
  try {
    admission = await options.authorityVerifier.verify(authorityEnvelope, {
      purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
      policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
      admissionVersion:
        routeIqProspectiveFutureWindowAuthorityAdmissionVersion,
      evidenceVersion: routeIqProspectiveFutureWindowAuthorityEvidenceVersion,
    });
  } catch (error) {
    fail("route_iq_future_window_authority_admission_failed", {
      causeCode: error?.code || null,
    });
  }
  return normalizeAuthorityAdmission(admission, { serverNow: options.serverNow });
}

function assignmentIdFor(authorityEvidence) {
  return `riq_future_window_assignment_${sha256({
    purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
    sourceRecordSha256: authorityEvidence.sourceRecordSha256,
  })}`;
}

function composeAssignment(authorityEvidence) {
  const sourcePolicy = loadRouteIqProspectiveFutureWindowPolicy();
  validateRouteIqProspectiveFutureWindowPolicy(sourcePolicy);
  const historicalConfig = loadRouteIqHistoricalJulyReadinessConfig();
  const derived = deriveFutureWindows(
    authorityEvidence.authoritativeServerAnchor,
    historicalConfig,
  );
  const readinessConfig = createReadinessConfig(
    historicalConfig,
    derived.windows,
  );
  const windowsSha256 = sha256(derived.windows);
  const readinessConfigSha256 = sha256(readinessConfig);
  const sourcePolicyBinding = {
    path: routeIqProspectiveFutureWindowPolicyPath,
    rawSha256: routeIqProspectiveFutureWindowPolicySha256,
    byteLength: routeIqProspectiveFutureWindowPolicyByteLength,
  };
  const historicalBinding = {
    path: routeIqHistoricalJulyReadinessConfigPath,
    configVersion: historicalConfig.configVersion,
    rawSha256: routeIqHistoricalJulyReadinessConfigSha256,
    byteLength: routeIqHistoricalJulyReadinessConfigByteLength,
  };
  const windowAssignment = {
    anchorSource: "admitted_authoritative_server_evidence",
    authoritativeServerAnchor:
      authorityEvidence.authoritativeServerAnchor,
    bounds: "start_inclusive_end_exclusive",
    timezone: "UTC",
    templateRule: "preserve_historical_window_kind_order_and_exact_durations",
    trainingWindowCount: derived.trainingWindowCount,
    evaluationWindowCount: derived.evaluationWindowCount,
    windows: clone(derived.windows),
    windowsSha256,
    immutable: true,
  };
  const policySha256 = sha256({
    policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
    sourcePolicyRawSha256: routeIqProspectiveFutureWindowPolicySha256,
    historicalConfigRawSha256: routeIqHistoricalJulyReadinessConfigSha256,
    readinessConfigSha256,
    windowsSha256,
  });
  const assignmentBody = {
    assignmentVersion: routeIqProspectiveFutureWindowAssignmentVersion,
    assignmentId: assignmentIdFor(authorityEvidence),
    batchId: routeIqProspectiveFutureWindowBatchId,
    policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
    sourcePolicy: sourcePolicyBinding,
    policySha256,
    sourceOnly: true,
    authorityEvidence: clone(authorityEvidence),
    historicalReadinessConfig: historicalBinding,
    windowAssignment,
    readinessConfig,
    readinessConfigSha256,
    activation: {
      productionConsumerActivated: false,
      productionDeploymentPerformed: false,
      recommendationInfluence: "OFF",
    },
    immutable: true,
  };
  return deepFreeze({
    ...assignmentBody,
    assignmentSha256: sha256(assignmentBody),
  });
}

function assertCreateInput(input) {
  if (!isPlainObject(input)) {
    fail("route_iq_future_window_input_invalid");
  }
  const callerAnchor = CALLER_ANCHOR_KEYS.find((key) => Object.hasOwn(input, key));
  if (callerAnchor) {
    fail("route_iq_future_window_caller_anchor_prohibited", {
      field: callerAnchor,
    });
  }
  const allowed = new Set(["authorityEnvelope", "priorAssignment"]);
  if (
    !Object.hasOwn(input, "authorityEnvelope") ||
    input.authorityEnvelope === null ||
    input.authorityEnvelope === undefined ||
    Object.keys(input).some((key) => !allowed.has(key))
  ) {
    fail("route_iq_future_window_input_invalid");
  }
}

export async function createRouteIqProspectiveFutureWindowAssignment(
  input = {},
  options = {},
) {
  assertCreateInput(input);
  if (
    !isPlainObject(options) ||
    Object.keys(options).some(
      (key) => !["authorityVerifier", "serverNow"].includes(key),
    )
  ) {
    fail("route_iq_future_window_options_invalid");
  }
  const authorityEvidence = await admitAuthoritativeServerEvidence(
    input.authorityEnvelope,
    options,
  );
  const assignment = composeAssignment(authorityEvidence);
  if (input.priorAssignment !== undefined && input.priorAssignment !== null) {
    validateRouteIqProspectiveFutureWindowAssignment(input.priorAssignment);
    if (
      input.priorAssignment.assignmentId !== assignment.assignmentId ||
      input.priorAssignment.assignmentSha256 !== assignment.assignmentSha256 ||
      canonical(input.priorAssignment) !== canonical(assignment)
    ) {
      fail("route_iq_future_window_retroactive_reassignment", {
        assignmentId: assignment.assignmentId,
        priorAssignmentSha256: input.priorAssignment.assignmentSha256,
        candidateAssignmentSha256: assignment.assignmentSha256,
      });
    }
  }
  return assignment;
}

export async function createRouteIqProspectiveFutureWindowPolicy(
  input = {},
  options = {},
) {
  return createRouteIqProspectiveFutureWindowAssignment(input, options);
}

export function validateRouteIqProspectiveFutureWindowAssignment(assignment) {
  assertExactKeys(
    assignment,
    ASSIGNMENT_KEYS,
    "route_iq_future_window_assignment_invalid",
  );
  assertExactKeys(
    assignment.sourcePolicy,
    SOURCE_POLICY_KEYS,
    "route_iq_future_window_assignment_invalid",
  );
  assertExactKeys(
    assignment.historicalReadinessConfig,
    HISTORICAL_CONFIG_BINDING_KEYS,
    "route_iq_future_window_assignment_invalid",
  );
  assertExactKeys(
    assignment.windowAssignment,
    WINDOW_ASSIGNMENT_KEYS,
    "route_iq_future_window_assignment_invalid",
  );
  assertExactKeys(
    assignment.activation,
    ACTIVATION_KEYS,
    "route_iq_future_window_assignment_invalid",
  );
  assertSha256(
    assignment.assignmentSha256,
    "route_iq_future_window_assignment_digest_invalid",
  );
  if (
    sha256(withoutKey(assignment, "assignmentSha256")) !==
    assignment.assignmentSha256
  ) {
    fail("route_iq_future_window_assignment_digest_invalid");
  }
  const authorityEvidence = validateAuthorityBinding(
    assignment.authorityEvidence,
  );
  validateWindowList(assignment.windowAssignment.windows);
  const expected = composeAssignment(authorityEvidence);
  if (canonical(expected) !== canonical(assignment)) {
    fail("route_iq_future_window_assignment_semantics_invalid");
  }
  return true;
}

export function serializeRouteIqProspectiveFutureWindowAssignment(assignment) {
  validateRouteIqProspectiveFutureWindowAssignment(assignment);
  return `${canonical(assignment)}\n`;
}

export function computeRouteIqProspectiveFutureWindowPolicySha256() {
  validateRouteIqProspectiveFutureWindowPolicy(
    loadRouteIqProspectiveFutureWindowPolicy(),
  );
  return routeIqProspectiveFutureWindowPolicySha256;
}
