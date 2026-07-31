import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authorizeRouteIqPaidCustomerRevenueScope,
  createRouteIqPaidCustomerRevenueAuditIndex,
  loadRouteIqPaidCustomerRevenueFixture,
  routeIqPaidCustomerRevenueFixturePath,
  routeIqPaidCustomerRevenueSha256,
  stableRouteIqPaidCustomerRevenueJson,
  validateRouteIqPaidCustomerRevenueFixture
} from "../data/route-iq-paid-customer-revenue-readiness-v1/route-iq-paid-customer-revenue-readiness-v1.mjs";

function fixture() {
  return JSON.parse(readFileSync(routeIqPaidCustomerRevenueFixturePath, "utf8"));
}

function refreshEventHash(event) {
  const eventBody = structuredClone(event);
  delete eventBody.eventSha256;
  event.eventSha256 = routeIqPaidCustomerRevenueSha256(
    JSON.stringify(
      JSON.parse(stableRouteIqPaidCustomerRevenueJson(eventBody))
    )
  );
}

test("fictional commercial rehearsal is exact, tenant-scoped, multi-location, and non-active", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(value.company.fictional, true);
  assert.equal(value.locations.length, 2);
  assert.equal(value.principals.filter(item => item.role === "OWNER_MANAGER").length, 1);
  assert.equal(value.principals.filter(item => item.role === "REPRESENTATIVE").length, 2);
  assert.equal(value.lifecycle.currentState, "VALIDATED");
  assert.equal(value.lifecycle.activationAuthorized, false);
  assert.equal(value.lifecycle.productionAdmissionAuthorized, false);
  assert.deepEqual(
    new Set(value.lifecycle.snapshots.map(item => item.state)),
    new Set(["DRAFT", "VALIDATED"])
  );
  assert.equal(value.locations.every(item => item.active === false), true);
  assert.equal(value.principals.every(item => item.active === false), true);
});

test("tenant and workspace authorization rejects cross-company substitution", () => {
  const value = fixture();
  assert.deepEqual(
    authorizeRouteIqPaidCustomerRevenueScope(value, {
      companyId: value.companyId,
      workspaceId: value.workspaceId
    }),
    {
      companyId: value.companyId,
      workspaceId: value.workspaceId,
      authorized: true
    }
  );
  assert.throws(
    () => authorizeRouteIqPaidCustomerRevenueScope(value, {
      companyId: "company_unrelated_fixture",
      workspaceId: value.workspaceId
    }),
    error => error.code === "route_iq_revenue_data_cross_tenant"
  );
  const mixed = fixture();
  mixed.locations[0].workspaceId = "workspace_unrelated_fixture";
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(mixed),
    error => error.code === "route_iq_revenue_data_cross_tenant"
  );
});

test("location hours require one exact schedule entry per weekday and a valid IANA timezone", () => {
  const cases = [
    value => value.locations[0].operatingHours.pop(),
    value => { value.locations[0].operatingHours[6].day = "MONDAY"; },
    value => { value.locations[0].operatingHours[0].unexpected = true; },
    value => { value.locations[0].operatingHours[0].opens = "8:00"; },
    value => { value.locations[0].operatingHours[0].closes = null; },
    value => { value.locations[0].operatingHours[0].closes = "24:00"; },
    value => { value.locations[0].timeZone = "Mars/Olympus_Mons"; }
  ];
  for (const mutate of cases) {
    const value = fixture();
    mutate(value);
    assert.throws(
      () => validateRouteIqPaidCustomerRevenueFixture(value),
      error => [
        "route_iq_revenue_data_location_invalid",
        "route_iq_revenue_data_duplicate_identity",
        "route_iq_revenue_data_fields_invalid",
        "route_iq_revenue_data_operating_hours_invalid",
        "route_iq_revenue_data_timezone_invalid"
      ].includes(error.code)
    );
  }
});

test("representatives remain separated from Founder, billing, governance, and cross-company permissions", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  const representatives = value.principals.filter(item => item.role === "REPRESENTATIVE");
  for (const representative of representatives) {
    assert.equal(
      representative.permissions.some(permission =>
        ["founder", "billing", "governance", "cross_company"].includes(permission)
      ),
      false
    );
  }
  const overprivileged = fixture();
  overprivileged.principals.find(item => item.role === "REPRESENTATIVE")
    .permissions.push("billing");
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(overprivileged),
    error => error.code === "route_iq_revenue_data_representative_overprivileged"
  );
});

test("commercial history preserves superseded versions and pins current pricing and terms", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(value.commercial.history.length, 2);
  assert.equal(value.commercial.history[0].status, "SUPERSEDED");
  assert.equal(value.commercial.history[1].status, "CURRENT");
  assert.equal(
    value.commercial.history[1].pricingVersion,
    value.commercial.currentPricingVersion
  );
  assert.equal(
    value.commercial.history[1].commercialTermsVersion,
    value.commercial.currentCommercialTermsVersion
  );
  const erasedHistory = fixture();
  erasedHistory.commercial.history.shift();
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(erasedHistory),
    error => error.code === "route_iq_revenue_data_history_incomplete"
  );
});

test("duplicate idempotency identities and conflicting correlations fail closed", () => {
  const duplicate = fixture();
  duplicate.audit.events[1].idempotencyKey = duplicate.audit.events[0].idempotencyKey;
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(duplicate),
    error => error.code === "route_iq_revenue_data_duplicate_identity"
  );

  const correlationConflict = fixture();
  correlationConflict.audit.events[1].correlationId =
    correlationConflict.audit.events[0].correlationId;
  refreshEventHash(correlationConflict.audit.events[1]);
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(correlationConflict),
    error => error.code === "route_iq_revenue_data_correlation_conflict"
  );

  const index = createRouteIqPaidCustomerRevenueAuditIndex(fixture());
  assert.equal(index.eventCount, 2);
  assert.equal(index.idempotencyKeys.length, 2);
});

test("audit evidence references are declared and events remain chronological", () => {
  const unknownEvidence = fixture();
  unknownEvidence.audit.events[0].evidenceReferences = ["orion_rehearsal_unknown_evidence"];
  refreshEventHash(unknownEvidence.audit.events[0]);
  unknownEvidence.audit.events[1].previousEventSha256 = unknownEvidence.audit.events[0].eventSha256;
  refreshEventHash(unknownEvidence.audit.events[1]);
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(unknownEvidence),
    error => error.code === "route_iq_revenue_data_audit_evidence_unknown"
  );

  const outOfOrder = fixture();
  outOfOrder.audit.events[1].occurredAt = "2026-07-29T18:05:00.000Z";
  refreshEventHash(outOfOrder.audit.events[1]);
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(outOfOrder),
    error => error.code === "route_iq_revenue_data_audit_out_of_order"
  );
});

test("lifecycle and cleanup evidence remain semantically bound", () => {
  const lifecycle = fixture();
  lifecycle.lifecycle.snapshots[0].evidenceSha256 = "f".repeat(64);
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(lifecycle),
    error => error.code === "route_iq_revenue_data_lifecycle_evidence_unbound"
  );

  const duplicateCleanupHash = fixture();
  duplicateCleanupHash.cleanup.removalEvidence.evidenceSha256 =
    duplicateCleanupHash.cleanup.quarantineEvidence.evidenceSha256;
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(duplicateCleanupHash),
    error => error.code === "route_iq_revenue_data_cleanup_evidence_invalid"
  );

  const reversedCleanup = fixture();
  reversedCleanup.cleanup.removalEvidence.recordedAt = "2026-07-30T18:09:00.000Z";
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(reversedCleanup),
    error => error.code === "route_iq_revenue_data_cleanup_evidence_invalid"
  );
});

test("cleanup is correlated, reversible, and affects zero production records", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(value.cleanup.quarantineEvidence.status, "QUARANTINED");
  assert.equal(value.cleanup.removalEvidence.status, "REMOVED");
  assert.equal(
    value.cleanup.quarantineEvidence.correlationId,
    value.cleanup.removalEvidence.correlationId
  );
  assert.equal(value.cleanup.quarantineEvidence.affectedProductionRecords, 0);
  assert.equal(value.cleanup.removalEvidence.affectedProductionRecords, 0);
  assert.equal(value.cleanup.rollbackSupported, true);
  assert.equal(value.cleanup.productionMutationAuthorized, false);

  const crossAttempt = fixture();
  crossAttempt.cleanup.removalEvidence.correlationId = "correlation_other_cleanup";
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(crossAttempt),
    error => error.code === "route_iq_revenue_data_cleanup_correlation_invalid"
  );
});

test("zero-write accounting rejects any production, CRM, billing, invitation, or audit write", () => {
  for (const field of [
    "productionWrites",
    "crmWrites",
    "billingWrites",
    "invitationWrites"
  ]) {
    const changed = fixture();
    changed.protectedStateAfter[field] = 1;
    assert.throws(
      () => validateRouteIqPaidCustomerRevenueFixture(changed),
      error => error.code === "route_iq_revenue_data_protected_state_changed"
    );
  }
  const auditWrite = fixture();
  auditWrite.audit.events[0].productionWriteCount = 1;
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(auditWrite),
    error => error.code === "route_iq_revenue_data_audit_invalid"
  );
});

test("protected state remains immutable before and after rehearsal", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(
    stableRouteIqPaidCustomerRevenueJson(value.protectedStateBefore),
    stableRouteIqPaidCustomerRevenueJson(value.protectedStateAfter)
  );
  assert.deepEqual(
    {
      collection: value.protectedStateAfter.collection,
      cohorts: value.protectedStateAfter.activeCohorts,
      recommendations: value.protectedStateAfter.recommendationInfluence,
      providerRefresh: value.protectedStateAfter.providerRefresh,
      scheduler: value.protectedStateAfter.scheduler,
      customerActivation: value.protectedStateAfter.customerActivation,
      active: value.protectedStateAfter.activePool,
      reserve: value.protectedStateAfter.reservePool,
      quarantine: value.protectedStateAfter.quarantinePool
    },
    {
      collection: "OFF",
      cohorts: 0,
      recommendations: "OFF",
      providerRefresh: "OFF",
      scheduler: "OFF",
      customerActivation: "OFF",
      active: 0,
      reserve: 0,
      quarantine: 398
    }
  );
  const drift = fixture();
  drift.protectedStateAfter.snapshotSha256 = "c".repeat(64);
  assert.throws(
    () => validateRouteIqPaidCustomerRevenueFixture(drift),
    error => error.code === "route_iq_revenue_data_protected_state_drift"
  );
});

test("retention, export, and deletion responsibilities remain classified and unauthorized", () => {
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(value.responsibilities.retention.responsibleSubsystem, "PROMETHEUS_DATA");
  assert.equal(value.responsibilities.export.customerAuthorizationRequired, true);
  assert.equal(value.responsibilities.deletion.customerAuthorizationRequired, true);
  assert.equal(
    Object.values(value.responsibilities).every(
      responsibility => responsibility.productionExecutionAuthorized === false
    ),
    true
  );
});

test("fixture contains no real customer, existing receipt, external billing object, or provider data", () => {
  const text = readFileSync(routeIqPaidCustomerRevenueFixturePath, "utf8").toLowerCase();
  for (const forbidden of [
    "fitness connection",
    "anthony",
    "riq_receipt_",
    "stripe",
    "google places",
    "google maps"
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
  const value = loadRouteIqPaidCustomerRevenueFixture();
  assert.equal(value.commercial.liveBillingAuthorized, false);
  assert.equal(value.commercial.paymentProviderObjectId, null);
  assert.equal(value.evidenceReferences.every(item => item.productionRecord === false), true);
});
