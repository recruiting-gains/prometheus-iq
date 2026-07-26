import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  RouteIqPaidCustomerDataError,
  buildRouteIqVerifiedBusinessAuditRecord,
  buildRouteIqVerifiedBusinessStorageRecord,
  createRouteIqVerifiedBusinessEvidenceStore,
  normalizeRouteIqVerifiedBusinessEvidence,
  routeIqVerifiedBusinessIneligibilityReasons,
  stableRouteIqVerifiedBusinessJson,
  validateRouteIqVerifiedBusinessEligibilityPolicy
} from "../data/route-iq-paid-customer-v1/route-iq-verified-business-evidence.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const medicalFixture = readJson(
  "data/route-iq-paid-customer-v1/fixtures/"
    + "synthetic-medical-business-development-v1.json"
);
const securityFixture = readJson(
  "data/route-iq-paid-customer-v1/fixtures/synthetic-security-services-v1.json"
);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function normalizeFixtureRecord(fixture, recordIndex = 0, {
  evidence = fixture.records[recordIndex],
  policy = fixture.eligibilityPolicy,
  scope = {
    companyId: fixture.companyId,
    workspaceId: fixture.workspaceId
  },
  evaluatedAt = fixture.evaluatedAt
} = {}) {
  return normalizeRouteIqVerifiedBusinessEvidence(evidence, {
    policy,
    authorizedScope: scope,
    evaluatedAt
  });
}

function makeStoredRecord(fixture, recordIndex, suffix) {
  const normalized = normalizeFixtureRecord(fixture, recordIndex);
  const storageRecord = buildRouteIqVerifiedBusinessStorageRecord(normalized, {
    storedAt: fixture.evaluatedAt,
    idempotencyKey: `synthetic_storage_${suffix}`
  });
  const auditRecord = buildRouteIqVerifiedBusinessAuditRecord({
    eventId: `riq_business_audit_${suffix.repeat(24).slice(0, 24)}`,
    companyId: storageRecord.companyId,
    workspaceId: storageRecord.workspaceId,
    businessId: storageRecord.businessId,
    evidenceId: storageRecord.evidenceId,
    eventType: "EVIDENCE_STORED",
    occurredAt: fixture.evaluatedAt,
    actorType: "PROMETHEUS_DATA",
    outcome: storageRecord.routeEligible ? "ACCEPTED" : "INELIGIBLE",
    reasonCodes: storageRecord.reasonCodes,
    payloadSha256: storageRecord.payloadSha256
  });
  return { auditRecord, normalized, storageRecord };
}

test("one normalizer admits unrelated synthetic industries without customer-specific branches", () => {
  const medical = normalizeFixtureRecord(medicalFixture);
  const security = normalizeFixtureRecord(securityFixture);

  assert.equal(medical.admission.routeEligible, true);
  assert.equal(security.admission.routeEligible, true);
  assert.equal(medical.admission.state, "ELIGIBLE");
  assert.equal(security.admission.state, "ELIGIBLE");
  assert.notEqual(medical.companyId, security.companyId);
  assert.notEqual(medical.workspaceId, security.workspaceId);
  assert.notEqual(medical.category.categoryId, security.category.categoryId);
  assert.equal(medical.customerRules.maximumFreshnessHours, 24);
  assert.equal(security.customerRules.maximumFreshnessHours, 24);
  assert.match(medical.recommendationEvidence.reasonCode, /^verified_/u);
  assert.match(security.recommendationEvidence.reasonCode, /^verified_/u);
  assert.equal(
    stableRouteIqVerifiedBusinessJson(normalizeFixtureRecord(medicalFixture)),
    stableRouteIqVerifiedBusinessJson(medical)
  );
});

test("missing, stale, closed, and provider-failed evidence is never route eligible", () => {
  const missing = clone(medicalFixture.records[0]);
  missing.hours = {
    state: "MISSING",
    timeZone: null,
    weeklyScheduleVersion: null,
    verifiedAt: null,
    expiresAt: null,
    providerFailure: false
  };
  const missingResult = normalizeFixtureRecord(medicalFixture, 0, { evidence: missing });
  assert.equal(missingResult.admission.routeEligible, false);
  assert.ok(missingResult.admission.reasonCodes.includes("HOURS_MISSING"));

  const stale = clone(medicalFixture.records[0]);
  stale.hours.state = "STALE";
  const staleResult = normalizeFixtureRecord(medicalFixture, 0, { evidence: stale });
  assert.equal(staleResult.admission.routeEligible, false);
  assert.ok(staleResult.admission.reasonCodes.includes("HOURS_STALE"));

  const expired = clone(medicalFixture.records[0]);
  const expiredResult = normalizeFixtureRecord(medicalFixture, 0, {
    evidence: expired,
    evaluatedAt: "2026-07-27T10:00:00.000Z"
  });
  assert.equal(expiredResult.admission.routeEligible, false);
  assert.ok(expiredResult.admission.reasonCodes.includes("HOURS_STALE"));

  const closedResult = normalizeFixtureRecord(medicalFixture, 1);
  assert.equal(closedResult.admission.routeEligible, false);
  assert.ok(closedResult.admission.reasonCodes.includes("BUSINESS_CLOSED"));
  assert.ok(closedResult.admission.reasonCodes.includes("HOURS_CLOSED"));

  const providerFailed = clone(medicalFixture.records[0]);
  providerFailed.verificationSource.providerStatus = "FAILED";
  providerFailed.hours.state = "PROVIDER_FAILED";
  providerFailed.hours.providerFailure = true;
  const providerResult = normalizeFixtureRecord(medicalFixture, 0, {
    evidence: providerFailed
  });
  assert.equal(providerResult.admission.routeEligible, false);
  assert.deepEqual(
    providerResult.admission.reasonCodes.filter(reason => reason === "PROVIDER_FAILED"),
    ["PROVIDER_FAILED"]
  );
});

test("duplicate and conflicting evidence fails closed with fixed nonsecret reasons", () => {
  const unresolved = normalizeFixtureRecord(securityFixture, 1);
  assert.equal(unresolved.admission.routeEligible, false);
  assert.ok(unresolved.admission.reasonCodes.includes("DUPLICATE_UNRESOLVED"));

  const noncanonical = clone(securityFixture.records[0]);
  noncanonical.duplicateResolution = {
    state: "DUPLICATE_RESOLVED",
    canonicalBusinessId: "synthetic_commercial_property_999",
    relatedBusinessIds: ["synthetic_commercial_property_999"]
  };
  const noncanonicalResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: noncanonical
  });
  assert.equal(noncanonicalResult.admission.routeEligible, false);
  assert.ok(noncanonicalResult.admission.reasonCodes.includes("NONCANONICAL_DUPLICATE"));

  const conflicting = clone(securityFixture.records[0]);
  conflicting.identity.verificationState = "CONFLICTING";
  const conflictingResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: conflicting
  });
  assert.equal(conflictingResult.admission.routeEligible, false);
  assert.ok(conflictingResult.admission.reasonCodes.includes("EVIDENCE_CONFLICTING"));

  assert.equal(
    conflictingResult.admission.reasonCodes.every(reason =>
      routeIqVerifiedBusinessIneligibilityReasons.includes(reason)
    ),
    true
  );
});

test("territory, ZIP, inclusion, exclusion, and target-profile rules are explicit", () => {
  const outsideTerritory = clone(securityFixture.records[0]);
  outsideTerritory.territory.territoryId = "synthetic_security_unauthorized";
  const outsideTerritoryResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: outsideTerritory
  });
  assert.ok(outsideTerritoryResult.admission.reasonCodes.includes("TERRITORY_UNAUTHORIZED"));

  const outsidePostalCode = clone(securityFixture.records[0]);
  outsidePostalCode.territory.postalCode = "99999";
  outsidePostalCode.address.postalCode = "99999";
  const outsidePostalResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: outsidePostalCode
  });
  assert.ok(outsidePostalResult.admission.reasonCodes.includes("POSTAL_CODE_UNAUTHORIZED"));

  const excludedCategory = clone(securityFixture.records[0]);
  excludedCategory.category.categoryId = "private_residence";
  const excludedCategoryResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: excludedCategory
  });
  assert.ok(excludedCategoryResult.admission.reasonCodes.includes("CATEGORY_NOT_INCLUDED"));
  assert.ok(excludedCategoryResult.admission.reasonCodes.includes("CUSTOMER_EXCLUDED_CATEGORY"));

  const excludedPolicy = clone(securityFixture.eligibilityPolicy);
  excludedPolicy.excludedBusinessIds.push(securityFixture.records[0].businessId);
  const excludedBusinessResult = normalizeFixtureRecord(securityFixture, 0, {
    policy: excludedPolicy
  });
  assert.ok(excludedBusinessResult.admission.reasonCodes.includes("CUSTOMER_EXCLUDED_BUSINESS"));

  const noTargetMatch = clone(securityFixture.records[0]);
  noTargetMatch.targetProfile = {
    state: "NO_MATCH",
    reasonCode: "target_profile_not_satisfied"
  };
  const noTargetResult = normalizeFixtureRecord(securityFixture, 0, {
    evidence: noTargetMatch
  });
  assert.ok(noTargetResult.admission.reasonCodes.includes("TARGET_PROFILE_MISMATCH"));
});

test("policies have no targeting-changing defaults and reject contradictory rules", () => {
  const missingTerritories = clone(medicalFixture.eligibilityPolicy);
  delete missingTerritories.authorizedTerritories;
  assert.throws(
    () => validateRouteIqVerifiedBusinessEligibilityPolicy(missingTerritories),
    error => error instanceof RouteIqPaidCustomerDataError
      && error.code === "route_iq_paid_customer_fields_invalid"
  );

  const categoryConflict = clone(medicalFixture.eligibilityPolicy);
  categoryConflict.excludedCategoryIds.push(categoryConflict.includedCategoryIds[0]);
  assert.throws(
    () => validateRouteIqVerifiedBusinessEligibilityPolicy(categoryConflict),
    error => error.code === "route_iq_paid_customer_category_policy_conflict"
  );

  const stalePolicy = clone(medicalFixture.eligibilityPolicy);
  stalePolicy.maximumFreshnessHours = 25;
  assert.throws(
    () => validateRouteIqVerifiedBusinessEligibilityPolicy(stalePolicy),
    error => error.code === "route_iq_paid_customer_freshness_policy_invalid"
  );
});

test("scoped storage is idempotent and binds append-only audit evidence", () => {
  const store = createRouteIqVerifiedBusinessEvidenceStore();
  const record = makeStoredRecord(medicalFixture, 0, "a");
  const authorization = {
    companyId: medicalFixture.companyId,
    workspaceId: medicalFixture.workspaceId
  };

  assert.equal(store.write({
    authorization,
    storageRecord: record.storageRecord,
    auditRecord: record.auditRecord
  }).status, "ACCEPTED");
  assert.equal(store.write({
    authorization,
    storageRecord: record.storageRecord,
    auditRecord: record.auditRecord
  }).status, "ALREADY_ACCEPTED");

  const listed = store.listWorkspaceRecords({
    scope: authorization,
    authorization,
    routeEligibleOnly: true
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].companyId, medicalFixture.companyId);
  assert.equal(listed[0].workspaceId, medicalFixture.workspaceId);
  assert.equal(store.listWorkspaceAudit({
    scope: authorization,
    authorization
  }).length, 1);

  const conflictingStorage = buildRouteIqVerifiedBusinessStorageRecord(record.normalized, {
    storedAt: medicalFixture.evaluatedAt,
    idempotencyKey: "synthetic_storage_conflict"
  });
  const conflictingAudit = buildRouteIqVerifiedBusinessAuditRecord({
    eventId: `riq_business_audit_${"b".repeat(24)}`,
    companyId: conflictingStorage.companyId,
    workspaceId: conflictingStorage.workspaceId,
    businessId: conflictingStorage.businessId,
    evidenceId: conflictingStorage.evidenceId,
    eventType: "EVIDENCE_STORED",
    occurredAt: medicalFixture.evaluatedAt,
    actorType: "PROMETHEUS_DATA",
    outcome: "ACCEPTED",
    reasonCodes: [],
    payloadSha256: conflictingStorage.payloadSha256
  });
  assert.throws(
    () => store.write({
      authorization,
      storageRecord: conflictingStorage,
      auditRecord: conflictingAudit
    }),
    error => error.code === "route_iq_paid_customer_storage_conflict"
  );
});

test("server-side scope checks prevent cross-company reads, inference, writes, and audit access", () => {
  const store = createRouteIqVerifiedBusinessEvidenceStore();
  const medicalRecord = makeStoredRecord(medicalFixture, 0, "c");
  const securityRecord = makeStoredRecord(securityFixture, 0, "d");
  const medicalScope = {
    companyId: medicalFixture.companyId,
    workspaceId: medicalFixture.workspaceId
  };
  const securityScope = {
    companyId: securityFixture.companyId,
    workspaceId: securityFixture.workspaceId
  };
  store.write({
    authorization: medicalScope,
    storageRecord: medicalRecord.storageRecord,
    auditRecord: medicalRecord.auditRecord
  });
  store.write({
    authorization: securityScope,
    storageRecord: securityRecord.storageRecord,
    auditRecord: securityRecord.auditRecord
  });

  assert.deepEqual(
    store.listWorkspaceRecords({
      scope: medicalScope,
      authorization: medicalScope
    }).map(record => record.companyId),
    [medicalFixture.companyId]
  );
  assert.deepEqual(
    store.listWorkspaceRecords({
      scope: securityScope,
      authorization: securityScope
    }).map(record => record.companyId),
    [securityFixture.companyId]
  );

  for (const operation of [
    () => store.listWorkspaceRecords({
      scope: medicalScope,
      authorization: securityScope
    }),
    () => store.listWorkspaceAudit({
      scope: medicalScope,
      authorization: securityScope
    }),
    () => store.readBusinessRecord({
      scope: medicalScope,
      authorization: securityScope,
      businessId: medicalRecord.storageRecord.businessId,
      evidenceId: medicalRecord.storageRecord.evidenceId
    }),
    () => store.write({
      authorization: securityScope,
      storageRecord: medicalRecord.storageRecord,
      auditRecord: medicalRecord.auditRecord
    })
  ]) {
    assert.throws(
      operation,
      error => error.code === "route_iq_paid_customer_scope_unauthorized"
        && !error.message.includes(medicalRecord.storageRecord.businessId)
    );
  }
});

test("storage integrity and audit scope tampering fail before persistence", () => {
  const store = createRouteIqVerifiedBusinessEvidenceStore();
  const record = makeStoredRecord(medicalFixture, 0, "e");
  const authorization = {
    companyId: medicalFixture.companyId,
    workspaceId: medicalFixture.workspaceId
  };
  const tamperedStorage = clone(record.storageRecord);
  tamperedStorage.normalizedEvidence.businessId = "synthetic_tampered_business";
  assert.throws(
    () => store.write({
      authorization,
      storageRecord: tamperedStorage,
      auditRecord: record.auditRecord
    }),
    error => error.code === "route_iq_paid_customer_storage_record_invalid"
  );

  const tamperedKey = clone(record.storageRecord);
  tamperedKey.storageKey = tamperedKey.storageKey.replace(
    medicalFixture.workspaceId,
    securityFixture.workspaceId
  );
  assert.throws(
    () => store.write({
      authorization,
      storageRecord: tamperedKey,
      auditRecord: record.auditRecord
    }),
    error => error.code === "route_iq_paid_customer_storage_record_invalid"
  );

  const wrongAudit = buildRouteIqVerifiedBusinessAuditRecord({
    eventId: `riq_business_audit_${"f".repeat(24)}`,
    companyId: securityFixture.companyId,
    workspaceId: securityFixture.workspaceId,
    businessId: record.storageRecord.businessId,
    evidenceId: record.storageRecord.evidenceId,
    eventType: "EVIDENCE_STORED",
    occurredAt: medicalFixture.evaluatedAt,
    actorType: "PROMETHEUS_DATA",
    outcome: "ACCEPTED",
    reasonCodes: [],
    payloadSha256: record.storageRecord.payloadSha256
  });
  assert.throws(
    () => store.write({
      authorization,
      storageRecord: record.storageRecord,
      auditRecord: wrongAudit
    }),
    error => error.code === "route_iq_paid_customer_audit_scope_invalid"
  );
  assert.equal(store.listWorkspaceRecords({
    scope: authorization,
    authorization
  }).length, 0);
});

test("malformed, unsafe, and cross-scope evidence is rejected rather than normalized", () => {
  const unsafe = clone(medicalFixture.records[0]);
  unsafe.identity.legalName = "<script>unsafe()</script>";
  assert.throws(
    () => normalizeFixtureRecord(medicalFixture, 0, { evidence: unsafe }),
    error => error.code === "route_iq_paid_customer_text_invalid"
  );

  const unknownField = clone(medicalFixture.records[0]);
  unknownField.productionUseAuthorized = true;
  assert.throws(
    () => normalizeFixtureRecord(medicalFixture, 0, { evidence: unknownField }),
    error => error.code === "route_iq_paid_customer_fields_invalid"
  );

  const crossScope = clone(medicalFixture.records[0]);
  crossScope.companyId = securityFixture.companyId;
  assert.throws(
    () => normalizeFixtureRecord(medicalFixture, 0, { evidence: crossScope }),
    error => error.code === "route_iq_paid_customer_scope_unauthorized"
  );
});

test("canonical production pools stay active 0, reserve 0, quarantine 398", () => {
  const root = "data/qualified-prospects/google-qualified-businesses-v2/"
    + "runtime-pool-segmentation-v1/";
  const manifest = readJson(`${root}runtime-pool-manifest.json`);
  const active = readJson(`${root}active-pool.json`);
  const reserve = readJson(`${root}reserve-pool.json`);
  const quarantine = readJson(`${root}quarantine-pool.json`);

  assert.deepEqual(manifest.counts, { active: 0, reserve: 0, quarantine: 398 });
  assert.equal(active.count, 0);
  assert.equal(active.records.length, 0);
  assert.equal(reserve.count, 0);
  assert.equal(reserve.records.length, 0);
  assert.equal(quarantine.count, 398);
  assert.equal(quarantine.records.length, 398);
});
