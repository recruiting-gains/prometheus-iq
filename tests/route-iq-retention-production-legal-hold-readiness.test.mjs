import assert from "node:assert/strict";
import test from "node:test";

import {
  createRouteIqRetentionProductionLegalHoldAuthorityClaims,
  openRouteIqRetentionGovernanceLedger,
  readRouteIqRetentionProductionLegalHoldReadiness,
  readRouteIqRetentionSourceFixtureLegalHoldReadiness,
  revalidateRouteIqRetentionProductionLegalHoldImmediatelyBeforeMutation,
  routeIqRetentionProductionLegalHoldAuthorityVersion,
  routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
  legalHoldAuthorityClaims,
  retentionSha256
} from "./route-iq-retention-test-support.mjs";

const EVALUATED_AT = "2028-01-01T00:00:00.000Z";
const SUBJECT = Object.freeze({
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  recordClass: "field_session_raw_evidence",
  sourceRecordSha256: retentionSha256("production-legal-hold-source-record")
});
const SCOPE = Object.freeze({
  ...SUBJECT,
  representativeId: "qualification_rep",
  evidenceIdentitySha256: retentionSha256("production-legal-hold-evidence-identity")
});

function offsetIso(value, milliseconds) {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function expectCode(expectedCode) {
  return error => error?.code === expectedCode;
}

async function createContext() {
  const authority = createRetentionAuthority("production-legal-hold-readiness-test-key-material");
  const store = createRetentionStore();
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store,
    subject: SUBJECT,
    authorityVerifier: authority.verifier
  });
  return { authority, store, ledger };
}

function makeAuthoritySource(context, {
  sourceClassification = "authoritative_production",
  environment = sourceClassification === "authoritative_production" ? "production" : "source_fixture",
  bindingIdentitySha256 = retentionSha256(`${sourceClassification}:binding`),
  assertionCount = 1,
  observedAtOffsetMilliseconds = 0,
  validForMilliseconds = routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds,
  transformAssertion = assertion => assertion,
  transformAuthority = authority => authority,
  authorityName = "prometheus_data_legal_hold_authority",
  resultOverride = null,
  onRead = () => {}
} = {}) {
  return {
    version: routeIqRetentionProductionLegalHoldAuthorityVersion,
    sourceClassification,
    environment,
    bindingIdentitySha256,
    async readAuthorityAssertions(request) {
      onRead(request);
      if (resultOverride) return resultOverride(request);
      const observedAt = offsetIso(request.evaluatedAt, observedAtOffsetMilliseconds);
      const unsigned = transformAssertion({
        version: routeIqRetentionProductionLegalHoldAuthorityVersion,
        sourceClassification,
        environment,
        bindingIdentitySha256,
        evaluatedAt: request.evaluatedAt,
        observedAt,
        validUntil: offsetIso(observedAt, validForMilliseconds),
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
        authority: authorityName,
        seed: `legal-hold-attestation:${retentionSha256(unsigned)}`
      });
      const assertion = { ...unsigned, authority: transformAuthority(authority) };
      return { assertions: Array.from({ length: assertionCount }, () => structuredClone(assertion)) };
    }
  };
}

async function appendHold(context, eventType, recordedAt, seed) {
  const claims = legalHoldAuthorityClaims({ eventType, recordedAt, subject: SUBJECT });
  return context.ledger.appendLegalHold({
    eventType,
    recordedAt,
    authority: context.authority.sign(claims, { seed })
  });
}

test("production legal-hold authority defaults unavailable while source-only fixtures remain non-production", async () => {
  const context = await createContext();
  assert.equal(context.ledger.authorityClassification, "source_fixture_or_local");
  assert.equal(context.ledger.productionAuthorityAvailable, false);

  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      { retentionGovernanceLedger: context.ledger }
    ),
    expectCode("route_iq_retention_production_legal_hold_unavailable")
  );
  const fixtureSource = makeAuthoritySource(context, { sourceClassification: "source_only_fixture" });
  const fixture = await readRouteIqRetentionSourceFixtureLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: EVALUATED_AT },
    { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: fixtureSource }
  );
  assert.equal(fixture.authoritative, true);
  assert.equal(fixture.sourceOnly, true);
  assert.equal(fixture.productionReady, false);
  assert.equal(fixture.physicalMutationAuthorized, false);

  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: fixtureSource }
    ),
    expectCode("route_iq_retention_production_legal_hold_source_not_production")
  );
});

test("a fresh Data-attested production contract binds exact scope and never grants mutation authority", async () => {
  const context = await createContext();
  let readCount = 0;
  const source = makeAuthoritySource(context, { onRead: () => { readCount += 1; } });
  const readiness = await readRouteIqRetentionProductionLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: EVALUATED_AT },
    { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: source }
  );

  assert.equal(readCount, 1);
  assert.deepEqual(readiness.scope, SCOPE);
  assert.equal(readiness.legalHoldState, "none");
  assert.equal(readiness.recordCount, 0);
  assert.equal(readiness.productionReady, true);
  assert.equal(readiness.sourceOnly, false);
  assert.equal(readiness.deletionEligibleByLegalHold, true);
  assert.equal(readiness.revalidationRequiredImmediatelyBeforeMutation, true);
  assert.equal(readiness.physicalMutationAuthorized, false);
  assert.equal(readiness.overrideAllowed, false);
});

test("missing, ambiguous, malformed, and unverifiable production authority fail closed", async () => {
  const context = await createContext();
  const optionsFor = legalHoldAuthoritySource => ({
    retentionGovernanceLedger: context.ledger,
    legalHoldAuthoritySource
  });

  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, { assertionCount: 0 }))
    ),
    expectCode("route_iq_retention_production_legal_hold_missing")
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, { assertionCount: 2 }))
    ),
    expectCode("route_iq_retention_production_legal_hold_ambiguous")
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, {
        resultOverride: () => ({ assertions: [{}] })
      }))
    ),
    error => error?.code === "route_iq_retention_fields_missing"
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, {
        transformAssertion: assertion => ({
          ...assertion,
          authorityInjectedLater: true
        })
      }))
    ),
    expectCode("route_iq_retention_production_legal_hold_unavailable")
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, {
        transformAuthority: authority => ({ ...authority, signature: "0".repeat(64) })
      }))
    ),
    expectCode("route_iq_retention_authority_signature_invalid")
  );

  for (const authorityName of ["prometheus_infrastructure", "dashboard_admin", "generic_administration"]) {
    await assert.rejects(
      readRouteIqRetentionProductionLegalHoldReadiness(
        { scope: SCOPE, evaluatedAt: EVALUATED_AT },
        optionsFor(makeAuthoritySource(context, { authorityName }))
      ),
      expectCode("route_iq_retention_authority_unauthorized")
    );
  }
});

test("stale, future, and failed production authority reads are rejected deterministically", async () => {
  const context = await createContext();
  const optionsFor = legalHoldAuthoritySource => ({
    retentionGovernanceLedger: context.ledger,
    legalHoldAuthoritySource
  });

  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, {
        observedAtOffsetMilliseconds: -routeIqRetentionProductionLegalHoldMaximumAgeMilliseconds - 1
      }))
    ),
    expectCode("route_iq_retention_production_legal_hold_stale")
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, { observedAtOffsetMilliseconds: 1 }))
    ),
    expectCode("route_iq_retention_production_legal_hold_future")
  );
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      optionsFor(makeAuthoritySource(context, {
        resultOverride: () => { throw new Error("fixture-source-unavailable"); }
      }))
    ),
    expectCode("route_iq_retention_production_legal_hold_unavailable")
  );
});

test("workspace, operating-profile, representative, source, evidence, and record-class substitutions fail closed", async () => {
  const context = await createContext();

  for (const substitution of [
    { workspaceId: "other_workspace" },
    { operatingProfileId: "other_profile" }
  ]) {
    await assert.rejects(
      readRouteIqRetentionProductionLegalHoldReadiness(
        { scope: { ...SCOPE, ...substitution }, evaluatedAt: EVALUATED_AT },
        {
          retentionGovernanceLedger: context.ledger,
          legalHoldAuthoritySource: makeAuthoritySource(context)
        }
      ),
      expectCode("route_iq_retention_scope_unauthorized")
    );
  }

  for (const substitution of [
    { representativeId: "other_rep" },
    { evidenceIdentitySha256: retentionSha256("other-evidence") },
    { sourceRecordSha256: retentionSha256("other-source") },
    { recordClass: "prospective_shadow_evidence" }
  ]) {
    const source = makeAuthoritySource(context, {
      transformAssertion(assertion) {
        const scope = { ...assertion.scope, ...substitution };
        return {
          ...assertion,
          scope,
          subjectSha256: retentionSha256({
            workspaceId: scope.workspaceId,
            operatingProfileId: scope.operatingProfileId,
            recordClass: scope.recordClass,
            sourceRecordSha256: scope.sourceRecordSha256
          })
        };
      }
    });
    await assert.rejects(
      readRouteIqRetentionProductionLegalHoldReadiness(
        { scope: SCOPE, evaluatedAt: EVALUATED_AT },
        { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: source }
      ),
      expectCode("route_iq_retention_production_legal_hold_scope_mismatch")
    );
  }
});

test("append-only chronology and future ledger state cannot be presented as current authority", async () => {
  const chronology = await createContext();
  const firstAt = offsetIso(EVALUATED_AT, -10_000);
  await appendHold(chronology, "LEGAL_HOLD_APPLIED", firstAt, "chronology-first-hold");
  await assert.rejects(
    appendHold(chronology, "LEGAL_HOLD_RELEASED", firstAt, "chronology-duplicate-time"),
    expectCode("route_iq_retention_ledger_chronology_invalid")
  );

  const future = await createContext();
  await appendHold(future, "LEGAL_HOLD_APPLIED", offsetIso(EVALUATED_AT, 1), "future-hold");
  await assert.rejects(
    readRouteIqRetentionProductionLegalHoldReadiness(
      { scope: SCOPE, evaluatedAt: EVALUATED_AT },
      {
        retentionGovernanceLedger: future.ledger,
        legalHoldAuthoritySource: makeAuthoritySource(future)
      }
    ),
    expectCode("route_iq_retention_production_legal_hold_future")
  );
});

test("an active hold blocks production readiness and a later release preserves the no-mutation boundary", async () => {
  const context = await createContext();
  const source = makeAuthoritySource(context);
  await appendHold(context, "LEGAL_HOLD_APPLIED", offsetIso(EVALUATED_AT, -2_000), "active-hold");
  const held = await readRouteIqRetentionProductionLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: EVALUATED_AT },
    { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: source }
  );
  assert.equal(held.legalHoldState, "active");
  assert.equal(held.productionReady, false);
  assert.equal(held.deletionEligibleByLegalHold, false);
  assert.equal(held.physicalMutationAuthorized, false);

  const releasedAt = offsetIso(EVALUATED_AT, 1_000);
  await appendHold(context, "LEGAL_HOLD_RELEASED", offsetIso(EVALUATED_AT, 500), "released-hold");
  const released = await readRouteIqRetentionProductionLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: releasedAt },
    { retentionGovernanceLedger: context.ledger, legalHoldAuthoritySource: source }
  );
  assert.equal(released.legalHoldState, "none");
  assert.equal(released.productionReady, true);
  assert.equal(released.physicalMutationAuthorized, false);
});

test("immediate revalidation accepts unchanged state and rejects a changed hold snapshot", async () => {
  const unchanged = await createContext();
  const unchangedSource = makeAuthoritySource(unchanged);
  const prior = await readRouteIqRetentionProductionLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: EVALUATED_AT },
    { retentionGovernanceLedger: unchanged.ledger, legalHoldAuthoritySource: unchangedSource }
  );
  const revalidatedAt = offsetIso(EVALUATED_AT, 1_000);
  const revalidation = await revalidateRouteIqRetentionProductionLegalHoldImmediatelyBeforeMutation(
    { priorReadiness: prior, revalidatedAt },
    { retentionGovernanceLedger: unchanged.ledger, legalHoldAuthoritySource: unchangedSource }
  );
  assert.equal(revalidation.state, "PRODUCTION_LEGAL_HOLD_REVALIDATED_NONE");
  assert.equal(revalidation.revalidatedImmediatelyBeforeMutation, true);
  assert.equal(revalidation.exactPlanBoundFounderDeletionAuthorityRequired, true);
  assert.equal(revalidation.physicalMutationAuthorized, false);

  const tamperedPrior = structuredClone(prior);
  tamperedPrior.legalHoldSnapshotIdentitySha256 = retentionSha256("caller-rewritten-snapshot");
  await assert.rejects(
    revalidateRouteIqRetentionProductionLegalHoldImmediatelyBeforeMutation(
      { priorReadiness: tamperedPrior, revalidatedAt },
      { retentionGovernanceLedger: unchanged.ledger, legalHoldAuthoritySource: unchangedSource }
    ),
    expectCode("route_iq_retention_production_legal_hold_readiness_invalid")
  );

  const changed = await createContext();
  const changedSource = makeAuthoritySource(changed);
  const changedPrior = await readRouteIqRetentionProductionLegalHoldReadiness(
    { scope: SCOPE, evaluatedAt: EVALUATED_AT },
    { retentionGovernanceLedger: changed.ledger, legalHoldAuthoritySource: changedSource }
  );
  await appendHold(changed, "LEGAL_HOLD_APPLIED", offsetIso(EVALUATED_AT, 500), "changed-hold");
  await assert.rejects(
    revalidateRouteIqRetentionProductionLegalHoldImmediatelyBeforeMutation(
      { priorReadiness: changedPrior, revalidatedAt },
      { retentionGovernanceLedger: changed.ledger, legalHoldAuthoritySource: changedSource }
    ),
    expectCode("route_iq_retention_legal_hold_changed")
  );
});
