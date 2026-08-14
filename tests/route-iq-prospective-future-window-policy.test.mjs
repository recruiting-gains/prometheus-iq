import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  computeRouteIqProspectiveFutureWindowPolicySha256,
  createRouteIqProspectiveFutureWindowAssignment,
  createRouteIqProspectiveFutureWindowPolicy,
  loadRouteIqHistoricalJulyReadinessConfig,
  loadRouteIqProspectiveFutureWindowContract,
  loadRouteIqProspectiveFutureWindowPolicy,
  routeIqHistoricalJulyReadinessConfigByteLength,
  routeIqHistoricalJulyReadinessConfigPath,
  routeIqHistoricalJulyReadinessConfigSha256,
  routeIqProspectiveFutureReadinessConfigVersion,
  routeIqProspectiveFutureWindowAssignmentVersion,
  routeIqProspectiveFutureWindowAuthorityAdmissionVersion,
  routeIqProspectiveFutureWindowAuthorityEvidenceVersion,
  routeIqProspectiveFutureWindowAuthorityPurpose,
  routeIqProspectiveFutureWindowBatchId,
  routeIqProspectiveFutureWindowPolicyByteLength,
  routeIqProspectiveFutureWindowPolicyPath,
  routeIqProspectiveFutureWindowPolicySha256,
  routeIqProspectiveFutureWindowPolicyVersion,
  serializeRouteIqProspectiveFutureWindowAssignment,
  validateRouteIqHistoricalJulyReadinessConfigBytes,
  validateRouteIqProspectiveFutureWindowAssignment,
  validateRouteIqProspectiveFutureWindowPolicy,
  validateRouteIqProspectiveFutureWindows,
} from "../intelligence/route-iq-prospective-future-window-policy.mjs";
import {
  derivedSupport,
  validateChronologicalWindows,
} from "../intelligence/shadow-decision-readiness.mjs";

const ANCHOR = "2026-08-14T17:00:00.000Z";
const ISSUED_AT = ANCHOR;
const ADMITTED_AT = "2026-08-14T17:00:00.001Z";
const SERVER_NOW = "2026-08-14T17:00:00.002Z";

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

function digest(value) {
  return createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : canonical(value),
    )
    .digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isoOffset(value, milliseconds) {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function authorityAdmission({
  issuedAt = ISSUED_AT,
  expiresAt = isoOffset(issuedAt, 5 * 60 * 1000),
  anchor = ANCHOR,
  admittedAt = ADMITTED_AT,
  sourceRecordSha256 = digest("authoritative-server-source-record"),
  authorityReceiptSha256 = digest("authoritative-server-receipt"),
  evidenceOverrides = {},
  admissionOverrides = {},
} = {}) {
  const evidenceBody = {
    evidenceVersion: routeIqProspectiveFutureWindowAuthorityEvidenceVersion,
    purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
    policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
    issuedAt,
    expiresAt,
    authoritativeServerAnchor: anchor,
    sourceRecordSha256,
    authorityReceiptSha256,
    ...evidenceOverrides,
  };
  const evidence = {
    ...evidenceBody,
    evidenceSha256: digest(evidenceBody),
  };
  return {
    admitted: true,
    admissionVersion:
      routeIqProspectiveFutureWindowAuthorityAdmissionVersion,
    verificationType: "infrastructure_keyed_attestation",
    algorithm: "HMAC-SHA-256",
    keyId: `riq_key_${digest("future-window-authority-key")}`,
    admittedAt,
    evidence,
    ...admissionOverrides,
  };
}

function authorityVerifier(admission = authorityAdmission(), inspect = null) {
  return {
    async verify(envelope, context) {
      inspect?.(envelope, context);
      return clone(admission);
    },
  };
}

async function createAssignment({ admission, priorAssignment, inspect, serverNow = SERVER_NOW } = {}) {
  return createRouteIqProspectiveFutureWindowAssignment(
    {
      authorityEnvelope: {
        envelopeVersion: "opaque-server-authority-envelope-v1",
        envelopeSha256: digest("opaque-authority-envelope"),
      },
      ...(priorAssignment === undefined ? {} : { priorAssignment }),
    },
    { authorityVerifier: authorityVerifier(admission, inspect), serverNow },
  );
}

function expectCode(code) {
  return (error) => error?.code === code;
}

function withoutGeneratedFields(config) {
  const value = clone(config);
  delete value.batchId;
  delete value.configVersion;
  delete value.windows;
  return value;
}

test("the versioned source policy pins untouched July bytes and remains inactive", () => {
  const historicalBytes = readFileSync(routeIqHistoricalJulyReadinessConfigPath);
  const policyBytes = readFileSync(routeIqProspectiveFutureWindowPolicyPath);
  assert.equal(
    historicalBytes.byteLength,
    routeIqHistoricalJulyReadinessConfigByteLength,
  );
  assert.equal(digest(historicalBytes), routeIqHistoricalJulyReadinessConfigSha256);
  assert.equal(validateRouteIqHistoricalJulyReadinessConfigBytes(historicalBytes), true);
  assert.equal(policyBytes.byteLength, routeIqProspectiveFutureWindowPolicyByteLength);
  assert.equal(digest(policyBytes), routeIqProspectiveFutureWindowPolicySha256);
  assert.equal(
    computeRouteIqProspectiveFutureWindowPolicySha256(),
    routeIqProspectiveFutureWindowPolicySha256,
  );

  const policy = loadRouteIqProspectiveFutureWindowPolicy();
  assert.equal(validateRouteIqProspectiveFutureWindowPolicy(policy), true);
  assert.equal(policy.batchId, routeIqProspectiveFutureWindowBatchId);
  assert.equal(policy.policyVersion, routeIqProspectiveFutureWindowPolicyVersion);
  assert.equal(policy.activation.sourceOnly, true);
  assert.equal(policy.activation.productionConsumerActivated, false);
  assert.equal(policy.activation.productionDeploymentPerformed, false);
  assert.equal(policy.activation.recommendationInfluence, "OFF");

  const contract = loadRouteIqProspectiveFutureWindowContract();
  assert.equal(
    contract.entrypoint,
    "createRouteIqProspectiveFutureWindowAssignment",
  );
  assert.equal(contract.input.callerAnchorFieldsAllowed, false);
  assert.equal(contract.persistenceHandoff.retroactiveReassignmentAllowed, false);

  const tamperedPolicy = clone(policy);
  tamperedPolicy.windows.gapAllowed = true;
  assert.throws(
    () => validateRouteIqProspectiveFutureWindowPolicy(tamperedPolicy),
    expectCode("route_iq_future_window_source_policy_semantics_invalid"),
  );

  const moduleSource = readFileSync(
    "intelligence/route-iq-prospective-future-window-policy.mjs",
    "utf8",
  );
  assert.doesNotMatch(moduleSource, /from\s+["']node:(?:fs|path|url)["']/u);
  assert.doesNotMatch(moduleSource, /\bimport\.meta\b/u);
});

test("admitted server evidence anchors a gap-free training and future evaluation schedule", async () => {
  let observedEnvelope;
  let observedContext;
  const assignment = await createAssignment({
    inspect(envelope, context) {
      observedEnvelope = envelope;
      observedContext = context;
    },
  });
  assert.deepEqual(observedEnvelope, {
    envelopeVersion: "opaque-server-authority-envelope-v1",
    envelopeSha256: digest("opaque-authority-envelope"),
  });
  assert.deepEqual(observedContext, {
    purpose: routeIqProspectiveFutureWindowAuthorityPurpose,
    policyVersion: routeIqProspectiveFutureWindowPolicyVersion,
    admissionVersion:
      routeIqProspectiveFutureWindowAuthorityAdmissionVersion,
    evidenceVersion: routeIqProspectiveFutureWindowAuthorityEvidenceVersion,
  });
  assert.equal(
    assignment.assignmentVersion,
    routeIqProspectiveFutureWindowAssignmentVersion,
  );
  assert.equal(assignment.sourceOnly, true);
  assert.equal(assignment.windowAssignment.anchorSource, "admitted_authoritative_server_evidence");
  assert.equal(assignment.windowAssignment.authoritativeServerAnchor, ANCHOR);
  assert.equal(assignment.windowAssignment.trainingWindowCount, 1);
  assert.ok(assignment.windowAssignment.evaluationWindowCount >= 2);

  const windows = assignment.windowAssignment.windows;
  assert.equal(validateRouteIqProspectiveFutureWindows(windows), true);
  assert.deepEqual(validateChronologicalWindows(windows), windows);
  assert.equal(windows[0].kind, "training");
  assert.equal(windows[0].start, ANCHOR);
  for (let index = 1; index < windows.length; index += 1) {
    assert.equal(windows[index].start, windows[index - 1].endExclusive);
  }
  for (const window of windows.filter((item) => item.kind === "evaluation")) {
    assert.ok(Date.parse(window.start) > Date.parse(ANCHOR));
  }

  const historical = loadRouteIqHistoricalJulyReadinessConfig();
  const historicalDurations = historical.windows.map(
    (window) => Date.parse(window.endExclusive) - Date.parse(window.start),
  );
  const prospectiveDurations = windows.map(
    (window) => Date.parse(window.endExclusive) - Date.parse(window.start),
  );
  assert.deepEqual(prospectiveDurations, historicalDurations);
  assert.equal(
    assignment.readinessConfig.configVersion,
    routeIqProspectiveFutureReadinessConfigVersion,
  );
  assert.equal(
    assignment.readinessConfig.batchId,
    routeIqProspectiveFutureWindowBatchId,
  );
  assert.deepEqual(
    withoutGeneratedFields(assignment.readinessConfig),
    withoutGeneratedFields(historical),
  );
  assert.deepEqual(
    derivedSupport(assignment.readinessConfig),
    derivedSupport(historical),
  );
  assert.equal(assignment.activation.productionConsumerActivated, false);
  assert.equal(assignment.activation.productionDeploymentPerformed, false);
  assert.equal(assignment.activation.recommendationInfluence, "OFF");
  assert.equal(validateRouteIqProspectiveFutureWindowAssignment(assignment), true);
});

test("assignment replay and canonical bytes are deterministic and deeply immutable", async () => {
  const first = await createAssignment();
  const second = await createAssignment();
  assert.deepEqual(second, first);
  assert.equal(
    serializeRouteIqProspectiveFutureWindowAssignment(second),
    serializeRouteIqProspectiveFutureWindowAssignment(first),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authorityEvidence), true);
  assert.equal(Object.isFrozen(first.windowAssignment.windows), true);
  assert.equal(Object.isFrozen(first.windowAssignment.windows[0]), true);
  assert.equal(Object.isFrozen(first.readinessConfig), true);

  const persisted = JSON.parse(
    serializeRouteIqProspectiveFutureWindowAssignment(first),
  );
  const replay = await createAssignment({ priorAssignment: persisted });
  assert.deepEqual(replay, first);
  assert.equal(validateRouteIqProspectiveFutureWindowAssignment(persisted), true);

  const alias = await createRouteIqProspectiveFutureWindowPolicy(
    { authorityEnvelope: { opaque: true } },
    { authorityVerifier: authorityVerifier(), serverNow: SERVER_NOW },
  );
  assert.deepEqual(alias, first);
});

test("caller anchors, caller windows, and absent authority admission fail closed", async () => {
  await assert.rejects(
    createRouteIqProspectiveFutureWindowAssignment(
      {
        authorityEnvelope: { opaque: true },
        authoritativeServerAnchor: ANCHOR,
      },
      { authorityVerifier: authorityVerifier() },
    ),
    expectCode("route_iq_future_window_caller_anchor_prohibited"),
  );
  await assert.rejects(
    createRouteIqProspectiveFutureWindowAssignment(
      {
        authorityEnvelope: { opaque: true },
        windows: [],
      },
      { authorityVerifier: authorityVerifier() },
    ),
    expectCode("route_iq_future_window_input_invalid"),
  );
  await assert.rejects(
    createRouteIqProspectiveFutureWindowAssignment({
      authorityEnvelope: { opaque: true },
    }),
    expectCode("route_iq_future_window_authority_verifier_required"),
  );
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({
        admissionOverrides: { admitted: false },
      }),
    }),
    expectCode("route_iq_future_window_authority_not_admitted"),
  );
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({
        admissionOverrides: { algorithm: "SHA-256" },
      }),
    }),
    expectCode("route_iq_future_window_authority_not_admitted"),
  );
  await assert.rejects(
    createRouteIqProspectiveFutureWindowAssignment(
      { authorityEnvelope: { opaque: true } },
      {
        authorityVerifier: {
          async verify() {
            const error = new Error("server authority unavailable");
            error.code = "server_authority_unavailable";
            throw error;
          },
        },
        serverNow: SERVER_NOW,
      },
    ),
    expectCode("route_iq_future_window_authority_admission_failed"),
  );
});

test("future-issued, future-admitted, malformed, and tampered authority evidence is rejected", async () => {
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({
        issuedAt: isoOffset(ANCHOR, 3),
        anchor: isoOffset(ANCHOR, 3),
        expiresAt: isoOffset(ANCHOR, (5 * 60 * 1000) + 3),
      }),
    }),
    expectCode("route_iq_future_window_authority_stale_or_future"),
  );
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({
        admittedAt: isoOffset(ANCHOR, -1),
      }),
    }),
    expectCode("route_iq_future_window_authority_chronology_invalid"),
  );
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({ anchor: "not-a-timestamp" }),
    }),
    expectCode("route_iq_future_window_authority_anchor_invalid"),
  );
  const digestTampered = authorityAdmission();
  digestTampered.evidence.authorityReceiptSha256 = digest("changed-receipt");
  await assert.rejects(
    createAssignment({ admission: digestTampered }),
    expectCode("route_iq_future_window_authority_evidence_digest_invalid"),
  );
  const unknownField = authorityAdmission();
  unknownField.evidence.callerAnchor = ANCHOR;
  await assert.rejects(
    createAssignment({ admission: unknownField }),
    expectCode("route_iq_future_window_authority_evidence_invalid"),
  );

  await assert.rejects(
    createAssignment({
      admission: authorityAdmission(),
      serverNow: isoOffset(ISSUED_AT, 5 * 60 * 1000),
    }),
    expectCode("route_iq_future_window_authority_stale_or_future"),
  );
  await assert.rejects(
    createAssignment({
      admission: authorityAdmission({
        expiresAt: isoOffset(ISSUED_AT, (5 * 60 * 1000) + 1),
      }),
    }),
    expectCode("route_iq_future_window_authority_chronology_invalid"),
  );
});

test("window validation rejects gaps, overlap, invalid order, chronology, and insufficient evaluation", async () => {
  const assignment = await createAssignment();
  const windows = clone(assignment.windowAssignment.windows);

  const gap = clone(windows);
  gap[1].start = isoOffset(gap[1].start, 1);
  assert.throws(
    () => validateRouteIqProspectiveFutureWindows(gap),
    expectCode("route_iq_future_window_gap"),
  );

  const overlap = clone(windows);
  overlap[1].start = isoOffset(overlap[1].start, -1);
  assert.throws(
    () => validateRouteIqProspectiveFutureWindows(overlap),
    expectCode("route_iq_future_window_overlap"),
  );

  const reversed = [windows[1], windows[0], windows[2]];
  assert.throws(
    () => validateRouteIqProspectiveFutureWindows(reversed),
    expectCode("route_iq_future_window_chronology_invalid"),
  );

  const invalidChronology = clone(windows);
  invalidChronology[0].endExclusive = invalidChronology[0].start;
  assert.throws(
    () => validateRouteIqProspectiveFutureWindows(invalidChronology),
    expectCode("route_iq_future_window_chronology_invalid"),
  );

  assert.throws(
    () => validateRouteIqProspectiveFutureWindows(windows.slice(0, 2)),
    expectCode("route_iq_future_window_evaluation_windows_insufficient"),
  );
});

test("exact evidence, policy, config, and windows remain assignment-hash bound", async () => {
  const assignment = await createAssignment();
  assert.match(assignment.policySha256, /^[a-f0-9]{64}$/);
  assert.match(assignment.readinessConfigSha256, /^[a-f0-9]{64}$/);
  assert.match(assignment.windowAssignment.windowsSha256, /^[a-f0-9]{64}$/);
  assert.match(assignment.authorityEvidence.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.match(assignment.authorityEvidence.admissionSha256, /^[a-f0-9]{64}$/);
  assert.match(assignment.assignmentSha256, /^[a-f0-9]{64}$/);

  const cases = [
    (value) => {
      value.windowAssignment.windows[1].endExclusive = isoOffset(
        value.windowAssignment.windows[1].endExclusive,
        1,
      );
    },
    (value) => {
      value.readinessConfig.minimumAccuracy = 0.74;
    },
    (value) => {
      value.authorityEvidence.authorityReceiptSha256 = digest("other-receipt");
    },
    (value) => {
      value.sourcePolicy.rawSha256 = digest("other-policy");
    },
  ];
  for (const mutate of cases) {
    const changed = clone(assignment);
    mutate(changed);
    assert.throws(
      () => validateRouteIqProspectiveFutureWindowAssignment(changed),
      expectCode("route_iq_future_window_assignment_digest_invalid"),
    );
  }
});

test("a prior immutable assignment cannot be shifted or rebound retroactively", async () => {
  const prior = await createAssignment();
  const shifted = authorityAdmission({
    issuedAt: isoOffset(ISSUED_AT, 86_400_000),
    expiresAt: isoOffset(ISSUED_AT, 86_400_000 + (5 * 60 * 1000)),
    anchor: isoOffset(ANCHOR, 86_400_000),
    admittedAt: isoOffset(ADMITTED_AT, 86_400_000),
    authorityReceiptSha256: digest("shifted-authority-receipt"),
  });
  await assert.rejects(
    createAssignment({
      admission: shifted,
      priorAssignment: prior,
      serverNow: isoOffset(SERVER_NOW, 86_400_000),
    }),
    expectCode("route_iq_future_window_retroactive_reassignment"),
  );

  const rebound = authorityAdmission({
    sourceRecordSha256: digest("different-authoritative-source-record"),
    authorityReceiptSha256: digest("different-authority-receipt"),
  });
  await assert.rejects(
    createAssignment({ admission: rebound, priorAssignment: prior }),
    expectCode("route_iq_future_window_retroactive_reassignment"),
  );
});
