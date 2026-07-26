import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  routeIqVerifiedBusinessAuditVersion,
  routeIqVerifiedBusinessEligibilityPolicyVersion,
  routeIqVerifiedBusinessEvidenceVersion,
  routeIqVerifiedBusinessIneligibilityReasons,
  routeIqVerifiedBusinessNormalizedVersion,
  routeIqVerifiedBusinessStorageVersion,
  validateRouteIqVerifiedBusinessEligibilityPolicy,
  validateRouteIqVerifiedBusinessEvidence
} from "../data/route-iq-paid-customer-v1/route-iq-verified-business-evidence.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const dataRoot = "data/route-iq-paid-customer-v1";
const fixturePaths = [
  `${dataRoot}/fixtures/synthetic-medical-business-development-v1.json`,
  `${dataRoot}/fixtures/synthetic-security-services-v1.json`
];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

test("versioned JSON contracts pin evidence, policy, normalized, storage, and audit identities", () => {
  const evidenceSchema = readJson(
    `${dataRoot}/route-iq-verified-business-evidence-v1.schema.json`
  );
  const policySchema = readJson(
    `${dataRoot}/route-iq-verified-business-eligibility-policy-v1.schema.json`
  );
  const recordsSchema = readJson(
    `${dataRoot}/route-iq-verified-business-records-v1.schema.json`
  );

  assert.equal(
    evidenceSchema.properties.schemaVersion.const,
    routeIqVerifiedBusinessEvidenceVersion
  );
  assert.equal(
    policySchema.properties.schemaVersion.const,
    routeIqVerifiedBusinessEligibilityPolicyVersion
  );
  assert.equal(
    recordsSchema.$defs.storageRecord.properties.schemaVersion.const,
    routeIqVerifiedBusinessStorageVersion
  );
  assert.equal(
    recordsSchema.$defs.auditRecord.properties.schemaVersion.const,
    routeIqVerifiedBusinessAuditVersion
  );
  assert.equal(
    recordsSchema.$defs.storageRecord
      .properties.normalizedEvidence.properties.schemaVersion.const,
    routeIqVerifiedBusinessNormalizedVersion
  );
  assert.deepEqual(
    new Set(recordsSchema.$defs.reasonCode.enum),
    new Set(routeIqVerifiedBusinessIneligibilityReasons)
  );
  assert.equal(evidenceSchema.additionalProperties, false);
  assert.equal(policySchema.additionalProperties, false);
  assert.equal(recordsSchema.$defs.storageRecord.additionalProperties, false);
  assert.equal(recordsSchema.$defs.auditRecord.additionalProperties, false);
});

test("synthetic fixtures are unrelated, noncanonical, nonactivating, and contract-valid", () => {
  const fixtures = fixturePaths.map(readJson);
  assert.equal(new Set(fixtures.map(fixture => fixture.companyId)).size, 2);
  assert.equal(new Set(fixtures.map(fixture => fixture.workspaceId)).size, 2);
  assert.equal(new Set(fixtures.map(fixture => fixture.operatingProfileId)).size, 2);

  for (const fixture of fixtures) {
    assert.equal(fixture.classification, "SYNTHETIC_NONCANONICAL");
    assert.equal(fixture.productionUseAuthorized, false);
    assert.equal(fixture.providerActivationAuthorized, false);
    assert.equal(fixture.recordCount, fixture.records.length);
    assert.equal(
      validateRouteIqVerifiedBusinessEligibilityPolicy(fixture.eligibilityPolicy)
        .workspaceId,
      fixture.workspaceId
    );
    for (const evidence of fixture.records) {
      assert.equal(validateRouteIqVerifiedBusinessEvidence(evidence).companyId, fixture.companyId);
      assert.equal(evidence.workspaceId, fixture.workspaceId);
    }
  }
});

test("paid-customer fixtures contain no real customer, representative, or CRM evidence", () => {
  const bytes = fixturePaths
    .map(path => readFileSync(resolve(repoRoot, path), "utf8"))
    .join("\n");
  for (const forbidden of [
    "Anthony",
    "Fitness Connection",
    "Cruz Garza",
    "riq_receipt_",
    "googlePlaceId",
    "CUSTOMER_PRODUCTION",
    "productionUseAuthorized\": true",
    "providerActivationAuthorized\": true"
  ]) {
    assert.equal(bytes.includes(forbidden), false, forbidden);
  }
  assert.equal((bytes.match(/Synthetic/gu) || []).length >= 6, true);
});

test("Data package exposes no activation or canonical-pool mutation path", () => {
  const moduleSource = readFileSync(
    resolve(dataRoot, "route-iq-verified-business-evidence.mjs"),
    "utf8"
  );
  const readme = readFileSync(resolve(dataRoot, "README.md"), "utf8");
  for (const prohibitedImplementation of [
    "active-pool.json",
    "reserve-pool.json",
    "quarantine-pool.json",
    "fetch(",
    "wrangler",
    "CLOUDFLARE_",
    "process.env"
  ]) {
    assert.equal(moduleSource.includes(prohibitedImplementation), false);
  }
  assert.match(readme, /activates no provider/u);
  assert.match(readme, /changes no Active,\s+Reserve, or Quarantine pool/u);
});
