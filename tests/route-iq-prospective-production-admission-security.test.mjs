import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRouteIqFieldSessionArchivePackage,
  persistRouteIqFieldSessionArchive,
  projectCommittedRouteIqFieldSessionOutcomes,
  readRouteIqFieldSessionArchive,
  routeIqCanonicalDailyRepresentativeReportType
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import * as admissionRuntime from
  "../data/route-iq-field-sessions-v1/route-iq-prospective-production-retention-admission.mjs";
import {
  createRouteIqRetentionProductionLegalHoldAuthorityClaims,
  openRouteIqRetentionGovernanceLedger,
  routeIqRetentionProductionLegalHoldAuthorityVersion,
  routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
  legalHoldAuthorityClaims,
  retentionSha256
} from "./route-iq-retention-test-support.mjs";

const {
  computeRouteIqProspectiveProductionRetentionAdmissionSha256,
  createRouteIqProspectiveProductionRetentionAdmissionAdapter,
  readRouteIqProspectiveProductionRetentionAdmission,
  readRouteIqProspectiveSourceFixtureRetentionAdmission,
  routeIqProspectiveProductionRetentionAdmissionBinding,
  routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds,
  routeIqProspectiveProductionRetentionAdmissionProviderVersion,
  validateRouteIqProspectiveProductionRetentionAdmission
} = admissionRuntime;

const SESSION_ID = "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const SESSION_ROOT =
  `data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/${SESSION_ID}`;
const RAW_PATH =
  `${SESSION_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`;
const SOURCE_EVIDENCE_PATH =
  "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json";
const ARCHIVE_COMMITTED_AT = "2026-07-12T00:40:00.000Z";
const OUTCOME_TIME = "2026-07-12T00:45:00.000Z";
const ISSUED_AT = "2026-07-12T00:46:00.000Z";
const OPPORTUNITY_ID = `riq_opportunity_${retentionSha256("security-admission-opportunity")}`;
const COORDINATOR_SESSION_ID =
  `riq_session_${retentionSha256("security-admission-session")}`;
const EVALUATION_CONTEXT_SHA256 = retentionSha256("security-admission-evaluation-context");
const EVALUATED_CANDIDATE_ID =
  `riq_candidate_${retentionSha256("security-admission-candidate")}`;
const ACTION_ARTIFACT_ID = `riq_action_${retentionSha256("security-admission-action")}`;
const OUTCOME_RECEIPT_ARTIFACT_ID =
  `riq_outcome_${retentionSha256("security-admission-outcome-receipt")}`;
const OUTCOME_RECEIPT_RECORD_SHA256 = retentionSha256("security-admission-outcome-record");

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function offsetIso(value, milliseconds) {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function kvBinding() {
  const data = new Map();
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, String(value));
    },
    async list({ prefix = "" } = {}) {
      return {
        keys: [...data.keys()]
          .filter(key => key.startsWith(prefix))
          .sort()
          .map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

function canonicalReport() {
  const report = json(RAW_PATH);
  report.app = "Prometheus Route IQ";
  report.reportType = routeIqCanonicalDailyRepresentativeReportType;
  report.visits = report.visits.map(visit => ({
    ...visit,
    visitDecisionSource: {
      sourceId: "unknown",
      reason: "The source-only security fixture supplies an explicit unknown source.",
      evidence: [],
      confidence: 0,
      capturedAt: visit.timestamp
    },
    recommendationDecisionContext: {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    }
  }));
  return report;
}

async function createCommittedArchiveRead() {
  const binding = kvBinding();
  const archivePackage = createRouteIqFieldSessionArchivePackage({
    rawReportText: JSON.stringify(canonicalReport(), null, 2),
    originalFileName: "prospective-production-admission-security-fixture.json",
    canonicalRawArtifactPath: "source-only/prospective-production-admission-security-fixture.json",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true,
    finalityBasis: "Source-only Security/Aegis production-admission fixture.",
    ingestedAt: "2026-07-12T00:36:02.000Z",
    runtimePools: json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"),
    activePool: json(
      "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"
    ),
    businessHours: json(
      "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
    ),
    stressTestEvidence: json(SOURCE_EVIDENCE_PATH)
  });
  await persistRouteIqFieldSessionArchive(archivePackage, {
    store: binding,
    persistedAt: ARCHIVE_COMMITTED_AT
  });
  return readRouteIqFieldSessionArchive({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    sessionId: SESSION_ID
  }, { store: binding });
}

function makeLegalHoldAuthoritySource(context, {
  sourceClassification,
  assertionCount = 1,
  observedAtOffsetMilliseconds = 0,
  transformAssertion = assertion => assertion
} = {}) {
  const environment = sourceClassification === "authoritative_production"
    ? "production"
    : "source_fixture";
  const bindingIdentitySha256 = retentionSha256(
    `${sourceClassification}:security-admission-legal-hold`
  );
  return {
    version: routeIqRetentionProductionLegalHoldAuthorityVersion,
    sourceClassification,
    environment,
    bindingIdentitySha256,
    async readAuthorityAssertions(request) {
      const observedAt = offsetIso(request.evaluatedAt, observedAtOffsetMilliseconds);
      const unsigned = transformAssertion({
        version: routeIqRetentionProductionLegalHoldAuthorityVersion,
        sourceClassification,
        environment,
        bindingIdentitySha256,
        evaluatedAt: request.evaluatedAt,
        observedAt,
        validUntil: offsetIso(
          observedAt,
          routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
        ),
        scope: request.scope,
        subjectSha256: request.subjectSha256,
        legalHoldState: request.legalHoldState,
        ledgerRecordCount: request.ledgerRecordCount,
        ledgerLastRecordSha256: request.ledgerLastRecordSha256,
        ledgerSha256: request.ledgerSha256
      });
      const { version: ignoredVersion, ...claimInput } = unsigned;
      void ignoredVersion;
      const claims = createRouteIqRetentionProductionLegalHoldAuthorityClaims(claimInput);
      const authority = context.authority.sign(claims, {
        authority: "prometheus_data_legal_hold_authority",
        seed: `security-admission:${retentionSha256(unsigned)}`
      });
      const assertion = { ...unsigned, authority };
      return {
        assertions: Array.from(
          { length: assertionCount },
          () => structuredClone(assertion)
        )
      };
    }
  };
}

function runtimeState(bindingIdentitySha256, observedAt = ISSUED_AT) {
  const body = {
    schemaVersion: "route-iq-prospective-runtime-activation-state-v1",
    source: "server_governed",
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    observedAt,
    bindingIdentitySha256
  };
  return {
    ...body,
    stateIdentitySha256:
      computeRouteIqProspectiveProductionRetentionAdmissionSha256(body)
  };
}

function outcomeAuthority(request) {
  const body = {
    schemaVersion: "route-iq-prospective-outcome-admission-authority-v1",
    authority: "prometheus_data_prospective_coordinator",
    scope: structuredClone(request.scope),
    opportunityId: request.opportunityId,
    coordinatorSessionId: request.coordinatorSessionId,
    evaluationContextSha256: request.evaluationContextSha256,
    evaluatedCandidateId: request.evaluatedCandidateId,
    actionArtifactId: request.actionArtifactId,
    outcomeReceiptArtifactId: request.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: request.outcomeReceiptRecordSha256,
    fieldSessionId: request.fieldSessionId,
    sourceArchiveSessionSha256: request.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: request.sourceArchiveRawSha256,
    sourceOutcomeEvidenceSha256: request.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: request.authoritativeOutcomeTime,
    outcomeRecordSha256: retentionSha256("security-admission-canonical-outcome")
  };
  return {
    ...body,
    authorityIdentitySha256:
      computeRouteIqProspectiveProductionRetentionAdmissionSha256(body)
  };
}

async function createContext({
  sourceClassification = "authoritative_production",
  issuedAt = ISSUED_AT,
  runtimeObservedAt = ISSUED_AT,
  legalHoldOptions = {},
  mutations = {}
} = {}) {
  const archiveRead = await createCommittedArchiveRead();
  const projection = projectCommittedRouteIqFieldSessionOutcomes({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    archiveRecord: archiveRead.record
  });
  const request = {
    scope: {
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      representativeId: "cruz"
    },
    opportunityId: OPPORTUNITY_ID,
    fieldSessionId: SESSION_ID,
    coordinatorSessionId: COORDINATOR_SESSION_ID,
    evaluationContextSha256: EVALUATION_CONTEXT_SHA256,
    evaluatedCandidateId: EVALUATED_CANDIDATE_ID,
    actionArtifactId: ACTION_ARTIFACT_ID,
    outcomeReceiptArtifactId: OUTCOME_RECEIPT_ARTIFACT_ID,
    outcomeReceiptRecordSha256: OUTCOME_RECEIPT_RECORD_SHA256,
    sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
    sourceOutcomeEvidenceSha256: projection.outcomes[0].evidenceSha256,
    authoritativeOutcomeTime: OUTCOME_TIME
  };
  const authority = createRetentionAuthority("security-admission-test-authority-key-material");
  const subject = {
    workspaceId: request.scope.workspaceId,
    operatingProfileId: request.scope.operatingProfileId,
    recordClass: "prospective_shadow_evidence",
    sourceRecordSha256: request.sourceOutcomeEvidenceSha256
  };
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store: createRetentionStore(),
    subject,
    authorityVerifier: authority.verifier
  });
  const context = { authority, ledger };
  const bindingIdentitySha256 = retentionSha256(
    `${sourceClassification}:security-admission-provider`
  );
  const claimedAdmissions = new Set();
  const claimedSources = new Set();
  const claimLog = [];
  let claimQueue = Promise.resolve();

  const provider = {
    version: routeIqProspectiveProductionRetentionAdmissionProviderVersion,
    sourceClassification,
    environment: sourceClassification === "authoritative_production"
      ? "production"
      : "source_fixture",
    bindingIdentitySha256,
    async readAuthoritativeTime() {
      return { authoritativeTime: issuedAt };
    },
    async readCommittedArchive() {
      const value = structuredClone(archiveRead);
      return mutations.archiveRead ? mutations.archiveRead(value) : value;
    },
    async readOutcomeAdmissionAuthority() {
      const value = outcomeAuthority(request);
      return mutations.outcomeAuthority ? mutations.outcomeAuthority(value) : value;
    },
    async readRetentionGovernance() {
      const value = {
        retentionGovernanceLedger: ledger,
        legalHoldAuthoritySource: makeLegalHoldAuthoritySource(context, {
          sourceClassification,
          ...legalHoldOptions
        }),
        customerAccountId: "fitness_connection",
        customerContractExpiresAt: null,
        customerOverrideAuthority: null,
        customerOverrideAuthorityVerifier: null
      };
      return mutations.retentionGovernance ? mutations.retentionGovernance(value) : value;
    },
    async readGovernedRuntimeState() {
      const value = runtimeState(bindingIdentitySha256, runtimeObservedAt);
      return mutations.runtimeState ? mutations.runtimeState(value) : value;
    },
    async claimAdmission(claim) {
      const previous = claimQueue;
      let release;
      claimQueue = new Promise(resolve => {
        release = resolve;
      });
      await previous;
      try {
        claimLog.push(structuredClone(claim));
        let state = "claimed";
        if (claimedAdmissions.has(claim.admissionKey)) state = "duplicate";
        else if (claimedSources.has(claim.replayKey)) state = "replay";
        else {
          claimedAdmissions.add(claim.admissionKey);
          claimedSources.add(claim.replayKey);
        }
        const result = {
          state,
          admissionKey: claim.admissionKey,
          replayKey: claim.replayKey,
          claimsSha256: claim.claimsSha256,
          legalHoldSnapshotIdentitySha256: claim.legalHoldSnapshotIdentitySha256,
          legalHoldLedgerSha256: claim.legalHoldLedgerSha256,
          legalHoldState: claim.requireCurrentLegalHoldState
        };
        return mutations.claimResult ? mutations.claimResult(result, claim) : result;
      } finally {
        release();
      }
    }
  };
  return { authority, ledger, request, provider, claimLog };
}

function expectCode(code) {
  return error => error?.code === code;
}

function expectedAdmissionBinding(admission) {
  return {
    sourceClassification: admission.sourceClassification,
    providerBindingIdentitySha256: admission.providerBindingIdentitySha256,
    scope: structuredClone(admission.scope),
    opportunityId: admission.opportunityId,
    evaluationContextSha256: admission.evaluationBinding.evaluationContextSha256,
    evaluatedCandidateId: admission.evaluationBinding.evaluatedCandidateId,
    actionArtifactId: admission.evaluationBinding.actionArtifactId,
    outcomeReceiptArtifactId: admission.evaluationBinding.outcomeReceiptArtifactId,
    outcomeReceiptRecordSha256: admission.evaluationBinding.outcomeReceiptRecordSha256,
    fieldSessionId: admission.committedArchive.fieldSessionId,
    coordinatorSessionId: admission.dataAdmission.sourceSession.coordinatorSessionId,
    sourceArchiveSessionSha256: admission.committedArchive.sourceArchiveSessionSha256,
    sourceArchiveRawSha256: admission.committedArchive.rawSha256,
    sourceArchiveNormalizedSha256: admission.committedArchive.normalizedSha256,
    committedArchiveIdentitySha256: admission.committedArchive.archiveIdentitySha256,
    sourceOutcomeEvidenceSha256: admission.sourceOutcomeEvidenceSha256,
    authoritativeOutcomeTime: admission.authoritativeOutcomeTime,
    outcomeRecordSha256: admission.outcomeRecordSha256,
    policyVersion: admission.policyVersion,
    policySha256: admission.policySha256,
    retentionBoundarySha256:
      computeRouteIqProspectiveProductionRetentionAdmissionSha256(
        admission.dataAdmission.envelope.retentionBoundary
      ),
    legalHoldSnapshotIdentitySha256: admission.legalHold.snapshotIdentitySha256,
    legalHoldLedgerSha256: admission.legalHold.ledgerSha256,
    legalHoldAttestationSha256: admission.legalHold.attestationSha256,
    legalHoldObservedAt: admission.legalHold.observedAt,
    legalHoldValidUntil: admission.legalHold.validUntil,
    admissionKey: admission.admissionKey,
    replayKey: admission.replayKey
  };
}

function rehashAdmission(admission) {
  admission.claimsSha256 = computeRouteIqProspectiveProductionRetentionAdmissionSha256(
    Object.fromEntries(Object.entries(admission).filter(([key]) => key !== "claimsSha256"))
  );
  return admission;
}

function collectKeys(value, result = []) {
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    result.push(key);
    collectKeys(child, result);
  }
  return result;
}

async function produceProductionAdmission(context) {
  return readRouteIqProspectiveProductionRetentionAdmission(context.request, {
    env: {
      [routeIqProspectiveProductionRetentionAdmissionBinding]: context.provider
    }
  });
}

test("production admission provider is unavailable by default and is never inferred", async () => {
  const adapter = createRouteIqProspectiveProductionRetentionAdmissionAdapter({});
  assert.equal(adapter.available, false);
  assert.equal(adapter.bindingName, routeIqProspectiveProductionRetentionAdmissionBinding);
  await assert.rejects(
    adapter.read({}),
    expectCode("route_iq_prospective_retention_admission_provider_unavailable")
  );
  await assert.rejects(
    readRouteIqProspectiveProductionRetentionAdmission({}),
    expectCode("route_iq_prospective_retention_admission_provider_unavailable")
  );
});

test("source-only fixture authority cannot satisfy the production admission boundary", async () => {
  const fixture = await createContext({ sourceClassification: "source_only_fixture" });
  await assert.rejects(
    readRouteIqProspectiveProductionRetentionAdmission(fixture.request, {
      env: {
        [routeIqProspectiveProductionRetentionAdmissionBinding]: fixture.provider
      }
    }),
    expectCode("route_iq_prospective_retention_admission_provider_invalid")
  );

  const fixtureAdmission = await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    fixture.request,
    { provider: fixture.provider }
  );
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(
      fixtureAdmission,
      expectedAdmissionBinding(fixtureAdmission),
      { serverNow: ISSUED_AT, requireAuthoritativeProduction: true }
    ),
    expectCode("route_iq_prospective_retention_admission_classification_invalid")
  );
});

test("workspace, profile, representative, evaluation, and source hashes are exact bindings", async () => {
  const context = await createContext();
  const admission = await produceProductionAdmission(context);
  const expected = expectedAdmissionBinding(admission);
  const options = { serverNow: ISSUED_AT, requireAuthoritativeProduction: true };

  for (const changed of [
    { ...expected, scope: { ...expected.scope, workspaceId: "unknown_workspace" } },
    { ...expected, scope: { ...expected.scope, operatingProfileId: "outside_sales" } }
  ]) {
    assert.throws(
      () => validateRouteIqProspectiveProductionRetentionAdmission(admission, changed, options),
      expectCode("route_iq_prospective_retention_admission_scope_unauthorized")
    );
  }
  for (const changed of [
    { ...expected, scope: { ...expected.scope, representativeId: "anthony" } },
    { ...expected, evaluationContextSha256: retentionSha256("changed-evaluation-context") },
    { ...expected, sourceOutcomeEvidenceSha256: retentionSha256("changed-source-evidence") }
  ]) {
    assert.throws(
      () => validateRouteIqProspectiveProductionRetentionAdmission(admission, changed, options),
      expectCode("route_iq_prospective_retention_admission_expected_binding_mismatch")
    );
  }

  const changedEvaluationRequest = {
    ...context.request,
    evaluationContextSha256: retentionSha256("request-substituted-evaluation-context")
  };
  const freshContext = await createContext();
  await assert.rejects(
    readRouteIqProspectiveProductionRetentionAdmission(changedEvaluationRequest, {
      env: {
        [routeIqProspectiveProductionRetentionAdmissionBinding]: freshContext.provider
      }
    }),
    expectCode("route_iq_prospective_retention_admission_outcome_authority_mismatch")
  );

  const changedSourceContext = await createContext();
  await assert.rejects(
    readRouteIqProspectiveProductionRetentionAdmission({
      ...changedSourceContext.request,
      sourceOutcomeEvidenceSha256: retentionSha256("request-substituted-source-evidence")
    }, {
      env: {
        [routeIqProspectiveProductionRetentionAdmissionBinding]: changedSourceContext.provider
      }
    }),
    expectCode("route_iq_prospective_retention_admission_archive_binding_mismatch")
  );
});

test("admission freshness is capped at five minutes with an exclusive expiry boundary", async () => {
  const context = await createContext();
  const admission = await produceProductionAdmission(context);
  const expected = expectedAdmissionBinding(admission);
  assert.equal(
    Date.parse(admission.expiresAt) - Date.parse(admission.issuedAt),
    routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds
  );
  const lastJointlyValidMillisecond = Math.min(
    Date.parse(admission.expiresAt),
    Date.parse(admission.legalHold.validUntil)
  ) - 1;
  assert.doesNotThrow(() => validateRouteIqProspectiveProductionRetentionAdmission(
    admission,
    expected,
    {
      serverNow: new Date(lastJointlyValidMillisecond).toISOString(),
      requireAuthoritativeProduction: true
    }
  ));
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, {
      serverNow: admission.expiresAt,
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );

  const overlong = structuredClone(admission);
  overlong.expiresAt = offsetIso(
    overlong.issuedAt,
    routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds + 1
  );
  rehashAdmission(overlong);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(overlong, expected, {
      serverNow: overlong.issuedAt,
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );
});

test("missing, stale, unknown, active, and scope-mismatched legal hold state fail closed", async () => {
  const active = await createContext();
  const activeRecordedAt = offsetIso(ISSUED_AT, -1000);
  await active.ledger.appendLegalHold({
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: activeRecordedAt,
    authority: active.authority.sign(legalHoldAuthorityClaims({
      eventType: "LEGAL_HOLD_APPLIED",
      recordedAt: activeRecordedAt,
      subject: {
        workspaceId: active.request.scope.workspaceId,
        operatingProfileId: active.request.scope.operatingProfileId,
        recordClass: "prospective_shadow_evidence",
        sourceRecordSha256: active.request.sourceOutcomeEvidenceSha256
      }
    }), { seed: "security-admission-active-hold" })
  });
  await assert.rejects(
    produceProductionAdmission(active),
    expectCode("route_iq_prospective_retention_admission_legal_hold_blocked")
  );

  const cases = [
    [
      "missing",
      await createContext({ legalHoldOptions: { assertionCount: 0 } }),
      "route_iq_retention_production_legal_hold_missing"
    ],
    [
      "stale",
      await createContext({
        legalHoldOptions: {
          observedAtOffsetMilliseconds:
            -routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds - 1
        }
      }),
      "route_iq_retention_production_legal_hold_stale"
    ],
    [
      "unknown",
      await createContext({
        mutations: {
          retentionGovernance(value) {
            return { ...value, legalHoldAuthoritySource: null };
          }
        }
      }),
      "route_iq_retention_production_legal_hold_unavailable"
    ],
    [
      "scope mismatch",
      await createContext({
        legalHoldOptions: {
          transformAssertion(assertion) {
            return {
              ...assertion,
              scope: { ...assertion.scope, representativeId: "anthony" }
            };
          }
        }
      }),
      "route_iq_retention_production_legal_hold_scope_mismatch"
    ]
  ];
  for (const [name, context, code] of cases) {
    await assert.rejects(produceProductionAdmission(context), error => {
      assert.equal(error?.code, code, name);
      return true;
    });
  }
});

test("duplicate, replay, and concurrent claims admit at most one exact source", async () => {
  const duplicate = await createContext();
  await produceProductionAdmission(duplicate);
  await assert.rejects(
    produceProductionAdmission(duplicate),
    expectCode("route_iq_prospective_retention_admission_duplicate")
  );

  const replay = await createContext();
  await produceProductionAdmission(replay);
  const originalIssuedAt = replay.provider.readAuthoritativeTime;
  replay.provider.readAuthoritativeTime = async () => ({
    authoritativeTime: offsetIso((await originalIssuedAt()).authoritativeTime, 1)
  });
  await assert.rejects(
    produceProductionAdmission(replay),
    expectCode("route_iq_prospective_retention_admission_replay")
  );

  const concurrent = await createContext();
  const results = await Promise.allSettled([
    produceProductionAdmission(concurrent),
    produceProductionAdmission(concurrent),
    produceProductionAdmission(concurrent)
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 2);
  assert.deepEqual(
    results.filter(result => result.status === "rejected").map(result => result.reason.code),
    [
      "route_iq_prospective_retention_admission_duplicate",
      "route_iq_prospective_retention_admission_duplicate"
    ]
  );
});

test("retention admission exposes no browser, public-route, alarm, or scheduler handler", () => {
  const adapter = createRouteIqProspectiveProductionRetentionAdmissionAdapter({});
  assert.deepEqual(Object.keys(adapter).sort(), ["available", "bindingName", "read"]);
  assert.equal(Object.hasOwn(admissionRuntime, "default"), false);
  for (const handlerName of [
    "fetch",
    "scheduled",
    "alarm",
    "onRequest",
    "handleRequest",
    "router",
    "routes"
  ]) {
    assert.equal(Object.hasOwn(admissionRuntime, handlerName), false, handlerName);
    assert.equal(Object.hasOwn(adapter, handlerName), false, handlerName);
  }
});

test("claims and fail-closed provider errors disclose no raw evidence or secret material", async () => {
  const context = await createContext();
  const admission = await produceProductionAdmission(context);
  assert.equal(context.claimLog.length, 1);
  const serialized = JSON.stringify({ admission, claim: context.claimLog[0] });
  for (const rawMarker of [
    "Galachy Tire Shop",
    "Comeback today at 6pm",
    "prometheus-iq-cruz-daily-report-2026-07-11.json"
  ]) {
    assert.equal(serialized.includes(rawMarker), false, rawMarker);
  }
  const prohibitedKeys = new Set([
    "rawReportText",
    "normalizedRecord",
    "completedVisits",
    "notes",
    "businessName",
    "placeName",
    "address",
    "coordinates",
    "secret",
    "authorization"
  ]);
  assert.deepEqual(
    collectKeys({ admission, claim: context.claimLog[0] })
      .filter(key => prohibitedKeys.has(key)),
    []
  );

  const secretMarker = "DO_NOT_DISCLOSE_SECURITY_PROVIDER_SECRET";
  const failing = await createContext();
  failing.provider.readCommittedArchive = async () => {
    throw new Error(secretMarker);
  };
  const capturedConsole = [];
  const originalConsole = {
    error: console.error,
    log: console.log,
    warn: console.warn
  };
  console.error = (...values) => capturedConsole.push(values);
  console.log = (...values) => capturedConsole.push(values);
  console.warn = (...values) => capturedConsole.push(values);
  let caught;
  try {
    await produceProductionAdmission(failing);
  } catch (error) {
    caught = error;
  } finally {
    console.error = originalConsole.error;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
  }
  assert.equal(caught?.code, "route_iq_prospective_retention_admission_provider_unavailable");
  assert.equal(`${caught}`.includes(secretMarker), false);
  assert.equal(JSON.stringify(caught?.details).includes(secretMarker), false);
  assert.equal(JSON.stringify(capturedConsole).includes(secretMarker), false);
  assert.equal(capturedConsole.length, 0);
});
