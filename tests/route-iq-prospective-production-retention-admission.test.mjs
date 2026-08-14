import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRouteIqFieldSessionArchivePackage,
  persistRouteIqFieldSessionArchive,
  projectCommittedRouteIqFieldSessionOutcomes,
  readRouteIqFieldSessionArchive,
  routeIqCanonicalDailyRepresentativeReportType
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  computeRouteIqProspectiveProductionRetentionAdmissionSha256,
  readRouteIqProspectiveProductionRetentionAdmission,
  readRouteIqProspectiveSourceFixtureRetentionAdmission,
  routeIqProspectiveProductionRetentionAdmissionBinding,
  routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds,
  routeIqProspectiveProductionRetentionAdmissionProviderVersion,
  routeIqProspectiveProductionRetentionAdmissionVersion,
  routeIqProspectiveProductionRetentionPolicySha256,
  validateRouteIqProspectiveProductionRetentionAdmission
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-production-retention-admission.mjs";
import {
  createRouteIqRetentionProductionLegalHoldAuthorityClaims,
  openRouteIqRetentionGovernanceLedger,
  routeIqRetentionMaximumCalendarMonths,
  routeIqRetentionProductionLegalHoldAuthorityVersion,
  routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  routeIqProspectiveRetentionPolicyVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
  customerOverrideAuthorityClaims,
  legalHoldAuthorityClaims,
  retentionSha256
} from "./route-iq-retention-test-support.mjs";

const SESSION_ID = "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const SESSION_ROOT = `data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/${SESSION_ID}`;
const RAW_PATH = `${SESSION_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`;
const SOURCE_EVIDENCE_PATH =
  "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json";
const ARCHIVE_COMMITTED_AT = "2026-07-12T00:40:00.000Z";
const OUTCOME_TIME = "2026-07-12T00:45:00.000Z";
const ISSUED_AT = "2026-07-12T00:46:00.000Z";
const OPPORTUNITY_ID = `riq_opportunity_${retentionSha256("production-retention-opportunity")}`;
const COORDINATOR_SESSION_ID = `riq_session_${retentionSha256("production-retention-session")}`;
const EVALUATION_CONTEXT_SHA256 = retentionSha256("production-retention-evaluation-context");
const EVALUATED_CANDIDATE_ID = `riq_candidate_${retentionSha256("production-retention-candidate")}`;
const ACTION_ARTIFACT_ID = `riq_action_${retentionSha256("production-retention-action")}`;
const OUTCOME_RECEIPT_ARTIFACT_ID = `riq_outcome_${retentionSha256("production-retention-outcome-receipt")}`;
const OUTCOME_RECEIPT_RECORD_SHA256 = retentionSha256("production-retention-outcome-record");

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
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
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
      reason: "The source-only fixture supplies an explicit unknown source.",
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
  const rawReportText = JSON.stringify(canonicalReport(), null, 2);
  const archivePackage = createRouteIqFieldSessionArchivePackage({
    rawReportText,
    originalFileName: "prospective-retention-admission-source-fixture.json",
    canonicalRawArtifactPath: "source-only/prospective-retention-admission-fixture.json",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    finalExportConfirmed: true,
    finalityBasis: "Source-only Data retention-admission fixture.",
    ingestedAt: "2026-07-12T00:36:02.000Z",
    runtimePools: json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"),
    activePool: json("data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"),
    businessHours: json("data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"),
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
  sourceClassification = "source_only_fixture",
  assertionCount = 1,
  observedAtOffsetMilliseconds = 0,
  resultOverride = null,
  transformAssertion = assertion => assertion
} = {}) {
  const environment = sourceClassification === "authoritative_production"
    ? "production"
    : "source_fixture";
  const bindingIdentitySha256 = retentionSha256(`${sourceClassification}:retention-admission-legal-hold`);
  return {
    version: routeIqRetentionProductionLegalHoldAuthorityVersion,
    sourceClassification,
    environment,
    bindingIdentitySha256,
    async readAuthorityAssertions(request) {
      if (resultOverride) return resultOverride(request);
      const observedAt = offsetIso(request.evaluatedAt, observedAtOffsetMilliseconds);
      const unsigned = transformAssertion({
        version: routeIqRetentionProductionLegalHoldAuthorityVersion,
        sourceClassification,
        environment,
        bindingIdentitySha256,
        evaluatedAt: request.evaluatedAt,
        observedAt,
        validUntil: offsetIso(observedAt, routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds),
        scope: request.scope,
        subjectSha256: request.subjectSha256,
        legalHoldState: request.legalHoldState,
        ledgerRecordCount: request.ledgerRecordCount,
        ledgerLastRecordSha256: request.ledgerLastRecordSha256,
        ledgerSha256: request.ledgerSha256
      });
      const { version: ignoredVersion, ...claimInput } = unsigned;
      const claims = createRouteIqRetentionProductionLegalHoldAuthorityClaims(claimInput);
      const authority = context.authority.sign(claims, {
        authority: "prometheus_data_legal_hold_authority",
        seed: `prospective-retention-admission:${retentionSha256(unsigned)}`
      });
      const assertion = { ...unsigned, authority };
      return { assertions: Array.from({ length: assertionCount }, () => structuredClone(assertion)) };
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
    stateIdentitySha256: computeRouteIqProspectiveProductionRetentionAdmissionSha256(body)
  };
}

function outcomeAuthority(request, outcomeRecordSha256 = retentionSha256("outcome-record")) {
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
    outcomeRecordSha256
  };
  return {
    ...body,
    authorityIdentitySha256: computeRouteIqProspectiveProductionRetentionAdmissionSha256(body)
  };
}

async function createContext({
  sourceClassification = "source_only_fixture",
  issuedAt = ISSUED_AT,
  runtimeObservedAt = ISSUED_AT,
  legalHoldOptions = {},
  customerContractExpiresAt = null,
  customerOverride = null,
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
  const authority = createRetentionAuthority("prospective-production-retention-admission-test-key");
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
  const bindingIdentitySha256 = retentionSha256(`${sourceClassification}:retention-admission-provider`);
  const claimedAdmissions = new Set();
  const claimedSources = new Set();
  const provider = {
    version: routeIqProspectiveProductionRetentionAdmissionProviderVersion,
    sourceClassification,
    environment: sourceClassification === "authoritative_production" ? "production" : "source_fixture",
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
        customerContractExpiresAt,
        customerOverrideAuthority: customerOverride,
        customerOverrideAuthorityVerifier: customerOverride ? authority.verifier : null
      };
      return mutations.retentionGovernance ? mutations.retentionGovernance(value) : value;
    },
    async readGovernedRuntimeState() {
      const value = runtimeState(bindingIdentitySha256, runtimeObservedAt);
      return mutations.runtimeState ? mutations.runtimeState(value) : value;
    },
    async claimAdmission(claim) {
      if (claimedAdmissions.has(claim.admissionKey)) {
        return {
          state: "duplicate",
          admissionKey: claim.admissionKey,
          replayKey: claim.replayKey,
          claimsSha256: claim.claimsSha256,
          legalHoldSnapshotIdentitySha256: claim.legalHoldSnapshotIdentitySha256,
          legalHoldLedgerSha256: claim.legalHoldLedgerSha256,
          legalHoldState: claim.requireCurrentLegalHoldState
        };
      }
      if (claimedSources.has(claim.replayKey)) {
        return {
          state: "replay",
          admissionKey: claim.admissionKey,
          replayKey: claim.replayKey,
          claimsSha256: claim.claimsSha256,
          legalHoldSnapshotIdentitySha256: claim.legalHoldSnapshotIdentitySha256,
          legalHoldLedgerSha256: claim.legalHoldLedgerSha256,
          legalHoldState: claim.requireCurrentLegalHoldState
        };
      }
      claimedAdmissions.add(claim.admissionKey);
      claimedSources.add(claim.replayKey);
      return {
        state: "claimed",
        admissionKey: claim.admissionKey,
        replayKey: claim.replayKey,
        claimsSha256: claim.claimsSha256,
        legalHoldSnapshotIdentitySha256: claim.legalHoldSnapshotIdentitySha256,
        legalHoldLedgerSha256: claim.legalHoldLedgerSha256,
        legalHoldState: claim.requireCurrentLegalHoldState
      };
    }
  };
  return { ...context, request, provider, archiveRead, projection };
}

function expectCode(code) {
  return error => error?.code === code;
}

function allKeys(value, result = []) {
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    result.push(key);
    allKeys(child, result);
  }
  return result;
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
    retentionBoundarySha256: computeRouteIqProspectiveProductionRetentionAdmissionSha256(
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
  const body = Object.fromEntries(
    Object.entries(admission).filter(([key]) => key !== "claimsSha256")
  );
  admission.claimsSha256 = computeRouteIqProspectiveProductionRetentionAdmissionSha256(body);
  return admission;
}

test("production retention admission is unavailable by default and no provider is inferred", async () => {
  await assert.rejects(
    readRouteIqProspectiveProductionRetentionAdmission({}),
    expectCode("route_iq_prospective_retention_admission_provider_unavailable")
  );
  assert.equal(routeIqProspectiveProductionRetentionAdmissionBinding,
    "DATA_ROUTE_IQ_PROSPECTIVE_RETENTION_ADMISSION_PROVIDER");
});

test("source fixture produces deterministic byte-stable claims bound to archive, outcome, policy, and legal hold", async () => {
  const first = await createContext();
  const second = await createContext();
  const admitted = await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    first.request,
    { provider: first.provider }
  );
  const independentlyProduced = await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    second.request,
    { provider: second.provider }
  );

  assert.deepEqual(admitted, independentlyProduced);
  assert.equal(admitted.admissionVersion, routeIqProspectiveProductionRetentionAdmissionVersion);
  assert.equal(admitted.admissionState, "RETENTION_ADMITTED");
  assert.equal(admitted.policyVersion, routeIqProspectiveRetentionPolicyVersion);
  assert.equal(admitted.policySha256, routeIqProspectiveProductionRetentionPolicySha256);
  assert.equal(admitted.committedArchive.fieldSessionId, SESSION_ID);
  assert.equal(admitted.committedArchive.rawSha256, first.request.sourceArchiveRawSha256);
  assert.equal(admitted.sourceOutcomeEvidenceSha256, first.request.sourceOutcomeEvidenceSha256);
  assert.equal(admitted.authoritativeOutcomeTime, OUTCOME_TIME);
  assert.equal(admitted.legalHold.state, "none");
  assert.equal(admitted.dataAdmission.envelope.retentionBoundary.maximumCalendarMonths,
    routeIqRetentionMaximumCalendarMonths);
  assert.equal(admitted.dataAdmission.envelope.retentionBoundary.expiresAt,
    "2028-01-12T00:40:00.000Z");
  assert.equal(admitted.expiresAt,
    offsetIso(ISSUED_AT, routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds));
  assert.equal(
    admitted.claimsSha256,
    computeRouteIqProspectiveProductionRetentionAdmissionSha256(
      Object.fromEntries(Object.entries(admitted).filter(([key]) => key !== "claimsSha256"))
    )
  );
  assert.equal(admitted.productionMutationAuthorized, false);
  assert.equal(admitted.recommendationInfluenceAllowed, false);
  assert.equal(admitted.representativeOutputAllowed, false);
  for (const prohibitedKey of [
    "rawReportText",
    "normalizedRecord",
    "completedVisits",
    "notes",
    "businessName",
    "address",
    "coordinates"
  ]) {
    assert.equal(allKeys(admitted).includes(prohibitedKey), false, prohibitedKey);
  }
});

test("authenticated customer retention may shorten but cannot expand the 18-month maximum", async () => {
  const base = await createContext();
  const shorterAt = "2026-12-01T00:40:00.000Z";
  const claims = customerOverrideAuthorityClaims({
    subject: {
      workspaceId: base.request.scope.workspaceId,
      operatingProfileId: base.request.scope.operatingProfileId,
      recordClass: "prospective_shadow_evidence",
      sourceRecordSha256: base.request.sourceOutcomeEvidenceSha256
    },
    customerAccountId: "fitness_connection",
    createdAt: ARCHIVE_COMMITTED_AT,
    customerContractExpiresAt: shorterAt
  });
  const customerOverride = base.authority.sign(claims, {
    authority: "prometheus_data_customer_contract_authority",
    seed: "prospective-retention-shortening"
  });
  const shortened = await createContext({
    customerContractExpiresAt: shorterAt,
    customerOverride
  });
  const admitted = await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    shortened.request,
    { provider: shortened.provider }
  );
  assert.equal(admitted.dataAdmission.envelope.retentionBoundary.customerOverrideState,
    "authenticated_shortening");
  assert.equal(admitted.dataAdmission.envelope.retentionBoundary.expiresAt, shorterAt);

  const expansion = await createContext({
    customerContractExpiresAt: "2028-02-01T00:40:00.000Z",
    customerOverride
  });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(
      expansion.request,
      { provider: expansion.provider }
    ),
    expectCode("route_iq_retention_customer_override_not_shorter")
  );
});

test("active, missing, stale, unknown, and scope-mismatched legal-hold authority fail closed", async () => {
  const active = await createContext();
  await active.ledger.appendLegalHold({
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: offsetIso(ISSUED_AT, -1000),
    authority: active.authority.sign(legalHoldAuthorityClaims({
      eventType: "LEGAL_HOLD_APPLIED",
      recordedAt: offsetIso(ISSUED_AT, -1000),
      subject: {
        workspaceId: active.request.scope.workspaceId,
        operatingProfileId: active.request.scope.operatingProfileId,
        recordClass: "prospective_shadow_evidence",
        sourceRecordSha256: active.request.sourceOutcomeEvidenceSha256
      }
    }), { seed: "prospective-retention-active-hold" })
  });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(active.request, { provider: active.provider }),
    expectCode("route_iq_prospective_retention_admission_legal_hold_blocked")
  );

  for (const [name, context, expectedCode] of [
    ["missing", await createContext({ legalHoldOptions: { assertionCount: 0 } }),
      "route_iq_retention_production_legal_hold_missing"],
    ["stale", await createContext({
      legalHoldOptions: {
        observedAtOffsetMilliseconds: -routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds - 1
      }
    }), "route_iq_retention_production_legal_hold_stale"],
    ["unknown", await createContext({
      mutations: {
        retentionGovernance(value) {
          return { ...value, legalHoldAuthoritySource: null };
        }
      }
    }), "route_iq_retention_production_legal_hold_unavailable"],
    ["mismatch", await createContext({
      legalHoldOptions: {
        transformAssertion(assertion) {
          return {
            ...assertion,
            scope: { ...assertion.scope, representativeId: "anthony" }
          };
        }
      }
    }), "route_iq_retention_production_legal_hold_scope_mismatch"]
  ]) {
    await assert.rejects(
      readRouteIqProspectiveSourceFixtureRetentionAdmission(context.request, { provider: context.provider }),
      error => {
        assert.equal(error?.code, expectedCode, name);
        return true;
      }
    );
  }
});

test("cross-scope, caller-selected time, archive mutation, and coordinator substitution are rejected", async () => {
  const context = await createContext();
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission({
      ...context.request,
      scope: { ...context.request.scope, workspaceId: "other_workspace" }
    }, { provider: context.provider }),
    expectCode("route_iq_prospective_retention_admission_scope_unauthorized")
  );
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission({
      ...context.request,
      requestedAt: ISSUED_AT
    }, { provider: context.provider }),
    expectCode("route_iq_prospective_retention_admission_fields_invalid")
  );
  const future = await createContext({ issuedAt: offsetIso(OUTCOME_TIME, -1) });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(future.request, { provider: future.provider }),
    expectCode("route_iq_prospective_retention_admission_caller_time_rejected")
  );
  const changedArchive = await createContext({
    mutations: {
      archiveRead(value) {
        value.record.commit.rawSha256 = retentionSha256("changed-archive");
        return value;
      }
    }
  });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(
      changedArchive.request,
      { provider: changedArchive.provider }
    ),
    expectCode("route_iq_prospective_retention_admission_archive_invalid")
  );
  const changedCoordinator = await createContext({
    mutations: {
      outcomeAuthority(value) {
        value.opportunityId = `riq_opportunity_${retentionSha256("other-opportunity")}`;
        return value;
      }
    }
  });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(
      changedCoordinator.request,
      { provider: changedCoordinator.provider }
    ),
    expectCode("route_iq_prospective_retention_admission_outcome_authority_mismatch")
  );
});

test("atomic admission claims reject exact duplicates and source-evidence replay", async () => {
  const duplicate = await createContext();
  await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    duplicate.request,
    { provider: duplicate.provider }
  );
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(
      duplicate.request,
      { provider: duplicate.provider }
    ),
    expectCode("route_iq_prospective_retention_admission_duplicate")
  );

  const replay = await createContext();
  const originalClaim = replay.provider.claimAdmission;
  let firstClaim = null;
  replay.provider.claimAdmission = async claim => {
    if (!firstClaim) {
      firstClaim = structuredClone(claim);
      return originalClaim(claim);
    }
    return {
      state: "replay",
      admissionKey: claim.admissionKey,
      replayKey: claim.replayKey,
      claimsSha256: claim.claimsSha256,
      legalHoldSnapshotIdentitySha256: claim.legalHoldSnapshotIdentitySha256,
      legalHoldLedgerSha256: claim.legalHoldLedgerSha256,
      legalHoldState: claim.requireCurrentLegalHoldState
    };
  };
  await readRouteIqProspectiveSourceFixtureRetentionAdmission(replay.request, { provider: replay.provider });
  const shiftedProvider = {
    ...replay.provider,
    async readAuthoritativeTime() {
      return { authoritativeTime: offsetIso(ISSUED_AT, 1) };
    }
  };
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(
      replay.request,
      { provider: shiftedProvider }
    ),
    expectCode("route_iq_prospective_retention_admission_replay")
  );
  assert.equal(firstClaim.replayKey.startsWith("riq_retention_source_"), true);
});

test("concurrent claims admit exactly one source and atomically bind the current legal-hold head", async () => {
  const context = await createContext();
  const results = await Promise.allSettled([
    readRouteIqProspectiveSourceFixtureRetentionAdmission(context.request, { provider: context.provider }),
    readRouteIqProspectiveSourceFixtureRetentionAdmission(context.request, { provider: context.provider })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected");
  assert.equal(rejected.reason.code, "route_iq_prospective_retention_admission_duplicate");

  const mismatch = await createContext();
  const originalClaim = mismatch.provider.claimAdmission;
  mismatch.provider.claimAdmission = async claim => ({
    ...(await originalClaim(claim)),
    legalHoldLedgerSha256: retentionSha256("changed-legal-hold-head")
  });
  await assert.rejects(
    readRouteIqProspectiveSourceFixtureRetentionAdmission(mismatch.request, { provider: mismatch.provider }),
    expectCode("route_iq_prospective_retention_admission_claim_invalid")
  );
});

test("the production adapter accepts only the explicit server binding and preserves the same claims contract", async () => {
  const production = await createContext({ sourceClassification: "authoritative_production" });
  const admission = await readRouteIqProspectiveProductionRetentionAdmission(
    production.request,
    {
      env: {
        [routeIqProspectiveProductionRetentionAdmissionBinding]: production.provider
      }
    }
  );
  assert.equal(admission.sourceClassification, "authoritative_production");
  assert.equal(admission.environment, "production");
  assert.equal(admission.legalHold.authoritative, true);
  assert.equal(admission.productionMutationAuthorized, false);
});

test("pure admission validation binds exact production claims and consumes no replay state", async () => {
  const production = await createContext({ sourceClassification: "authoritative_production" });
  const admission = await readRouteIqProspectiveProductionRetentionAdmission(
    production.request,
    { env: { [routeIqProspectiveProductionRetentionAdmissionBinding]: production.provider } }
  );
  const expected = expectedAdmissionBinding(admission);
  const options = { serverNow: ISSUED_AT, requireAuthoritativeProduction: true };
  const first = validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, options);
  const second = validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, options);

  assert.deepEqual(first, admission);
  assert.deepEqual(second, admission);
  assert.notEqual(first, admission);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.dataAdmission.envelope), true);
});

test("pure validation rejects changed hashes, nested shape, legal-hold state, and mutation boundaries", async () => {
  const production = await createContext({ sourceClassification: "authoritative_production" });
  const admission = await readRouteIqProspectiveProductionRetentionAdmission(
    production.request,
    { env: { [routeIqProspectiveProductionRetentionAdmissionBinding]: production.provider } }
  );
  const expected = expectedAdmissionBinding(admission);
  const options = { serverNow: ISSUED_AT, requireAuthoritativeProduction: true };

  const badClaimsHash = structuredClone(admission);
  badClaimsHash.claimsSha256 = "0".repeat(64);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(badClaimsHash, expected, options),
    expectCode("route_iq_prospective_retention_admission_claims_hash_mismatch")
  );

  const extraNestedField = structuredClone(admission);
  extraNestedField.legalHold.unexpected = true;
  rehashAdmission(extraNestedField);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(extraNestedField, expected, options),
    expectCode("route_iq_prospective_retention_admission_fields_invalid")
  );

  const changedArchive = structuredClone(admission);
  changedArchive.committedArchive.rawSha256 = retentionSha256("tampered-archive");
  rehashAdmission(changedArchive);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(changedArchive, expected, options),
    expectCode("route_iq_prospective_retention_admission_archive_identity_mismatch")
  );

  for (const mutate of [
    value => { value.legalHold.state = "active"; },
    value => { value.representativeOutputAllowed = true; },
    value => { value.recommendationInfluenceAllowed = true; },
    value => { value.productionMutationAuthorized = true; }
  ]) {
    const changedBoundary = structuredClone(admission);
    mutate(changedBoundary);
    rehashAdmission(changedBoundary);
    assert.throws(
      () => validateRouteIqProspectiveProductionRetentionAdmission(changedBoundary, expected, options),
      expectCode("route_iq_prospective_retention_admission_semantics_invalid")
    );
  }
});

test("pure validation rejects stale, future, and overlong authority without consulting replay state", async () => {
  const production = await createContext({ sourceClassification: "authoritative_production" });
  const admission = await readRouteIqProspectiveProductionRetentionAdmission(
    production.request,
    { env: { [routeIqProspectiveProductionRetentionAdmissionBinding]: production.provider } }
  );
  const expected = expectedAdmissionBinding(admission);

  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, {
      serverNow: admission.expiresAt,
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );

  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, {
      serverNow: offsetIso(admission.expiresAt, 1),
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, {
      serverNow: offsetIso(admission.issuedAt, -1),
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, expected, {
      serverNow: offsetIso(admission.legalHold.validUntil, 1),
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_legal_hold_stale_or_future")
  );

  const overlong = structuredClone(admission);
  overlong.expiresAt = offsetIso(
    overlong.issuedAt,
    routeIqProspectiveProductionRetentionAdmissionMaximumAgeMilliseconds + 1
  );
  rehashAdmission(overlong);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(overlong, expected, {
      serverNow: ISSUED_AT,
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_stale_or_future")
  );
});

test("pure validation rejects wrong scope, policy, legal-hold binding, and production classification", async () => {
  const production = await createContext({ sourceClassification: "authoritative_production" });
  const admission = await readRouteIqProspectiveProductionRetentionAdmission(
    production.request,
    { env: { [routeIqProspectiveProductionRetentionAdmissionBinding]: production.provider } }
  );
  const expected = expectedAdmissionBinding(admission);
  const options = { serverNow: ISSUED_AT, requireAuthoritativeProduction: true };

  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, {
      ...expected,
      scope: { ...expected.scope, representativeId: "anthony" }
    }, options),
    expectCode("route_iq_prospective_retention_admission_expected_binding_mismatch")
  );
  const changedRecordScope = structuredClone(admission);
  changedRecordScope.scope = { ...changedRecordScope.scope, representativeId: "anthony" };
  rehashAdmission(changedRecordScope);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(
      changedRecordScope,
      expected,
      options
    ),
    expectCode("route_iq_prospective_retention_admission_scope_binding_invalid")
  );
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, {
      ...expected,
      policySha256: retentionSha256("other-policy")
    }, options),
    expectCode("route_iq_prospective_retention_admission_expected_binding_mismatch")
  );
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(admission, {
      ...expected,
      legalHoldLedgerSha256: retentionSha256("other-ledger")
    }, options),
    expectCode("route_iq_prospective_retention_admission_expected_binding_mismatch")
  );

  const fixture = await createContext();
  const fixtureAdmission = await readRouteIqProspectiveSourceFixtureRetentionAdmission(
    fixture.request,
    { provider: fixture.provider }
  );
  const fixtureExpected = expectedAdmissionBinding(fixtureAdmission);
  assert.throws(
    () => validateRouteIqProspectiveProductionRetentionAdmission(fixtureAdmission, fixtureExpected, {
      serverNow: ISSUED_AT,
      requireAuthoritativeProduction: true
    }),
    expectCode("route_iq_prospective_retention_admission_classification_invalid")
  );
  assert.doesNotThrow(
    () => validateRouteIqProspectiveProductionRetentionAdmission(fixtureAdmission, fixtureExpected, {
      serverNow: ISSUED_AT,
      requireAuthoritativeProduction: false
    })
  );
});
