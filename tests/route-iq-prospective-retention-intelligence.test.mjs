import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  calculateRouteIqRetentionBoundary,
  openRouteIqRetentionGovernanceLedger,
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import {
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  computeRouteIqProspectiveRetentionPolicySha256,
  evaluateRouteIqProspectiveIntelligenceRetentionAdmission,
  loadRouteIqProspectiveRetentionPolicy,
  routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  routeIqProspectiveRetentionPolicyPath,
  routeIqProspectiveRetentionPolicySha256,
  validateRouteIqProspectiveRetentionPolicy,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";
import {
  createRetentionAuthority,
  createRetentionStore,
} from "./route-iq-retention-test-support.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");

async function dataAdmission(overrides = {}) {
  const sourceRecordSha256 = digest("prospective-source-record");
  const subject = {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    recordClass: "prospective_shadow_evidence",
    sourceRecordSha256,
  };
  const authority = createRetentionAuthority();
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store: createRetentionStore(),
    subject,
    authorityVerifier: authority.verifier,
  });
  const boundary = calculateRouteIqRetentionBoundary({
    subject,
    customerAccountId: "fitness_connection",
    createdAt: "2026-07-14T12:00:00.000Z",
    customerContractExpiresAt: null,
    customerOverrideAuthority: null,
  });
  const input = {
    dataAdmission: {
      dataPolicySha256: computeRouteIqProspectiveRetentionPolicySha256(),
      envelope: {
        policyVersion: routeIqProspectiveRetentionPolicyVersion,
        collectionState: "on",
        recommendationInfluence: "off",
        recordOrigin: "prospective",
        workspaceId: "fitness_connection",
        operatingProfileId: "fitness",
        representativeId: "cruz",
        evaluatedAt: "2026-07-14T12:00:00.000Z",
        retentionBoundary: {
          contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
          authorizationState: "founder_authorized_18_month_maximum",
          source: "authenticated_data_retention_contract",
          ...boundary,
        },
        derivedProjectionExpiresAt: "2027-01-14T12:00:00.000Z",
      },
      sourceSession: {
        coordinatorSessionId: `riq_session_${digest("coordinator-session")}`,
        fieldSessionId:
          "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-15",
        rawSha256: digest("canonical-raw"),
      },
    },
  };
  return { input: structuredClone({ ...input, ...overrides }), ledger };
}

test("final Data policy is hash-bound to the 18-calendar-month contract", () => {
  const policyBytes = readFileSync(
    new URL(`../${routeIqProspectiveRetentionPolicyPath}`, import.meta.url),
  );
  const policy = loadRouteIqProspectiveRetentionPolicy();
  assert.equal(digest(policyBytes), routeIqProspectiveRetentionPolicySha256);
  assert.equal(
    computeRouteIqProspectiveRetentionPolicySha256(),
    routeIqProspectiveRetentionPolicySha256,
  );
  assert.deepEqual(policy, JSON.parse(policyBytes.toString("utf8")));
  assert.equal(validateRouteIqProspectiveRetentionPolicy(policy), true);
  assert.equal(policy.batchId, "BATCH-20260714-004");
  assert.equal(policy.retentionDecision.maximumCalendarMonths, 18);
  assert.equal(policy.retentionDecision.customerContractMayShorten, true);
  assert.equal(policy.retentionDecision.customerContractMayExpand, false);
  assert.equal(policy.scope.collectionActivated, false);
  assert.equal(policy.scope.activeCohorts, 0);
  assert.equal(policy.scope.recommendationInfluence, "off");
});

test("runtime policy loading is detached and has no filesystem or import.meta dependency", () => {
  const moduleSource = readFileSync(
    new URL(
      "../intelligence/route-iq-prospective-retention-admission.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  const firstPolicy = loadRouteIqProspectiveRetentionPolicy();
  firstPolicy.scope.collectionActivated = true;

  assert.equal(
    loadRouteIqProspectiveRetentionPolicy().scope.collectionActivated,
    false,
  );
  assert.doesNotMatch(moduleSource, /from\s+["']node:(?:fs|path|url)["']/u);
  assert.doesNotMatch(moduleSource, /\bimport\.meta\b/u);
});

test("only a Data-ledger-authenticated, hash-bound admission is eligible", async () => {
  const { input, ledger } = await dataAdmission();
  const admission = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    input,
    { retentionGovernanceLedger: ledger },
  );
  assert.equal(admission.admissionVersion, routeIqProspectiveIntelligenceRetentionAdmissionVersion);
  assert.equal(admission.admitted, true);
  assert.equal(admission.retentionBoundary.maximumCalendarMonths, 18);
  assert.equal(admission.sourceEvidence.sourceRecordSha256, input.dataAdmission.envelope.retentionBoundary.subject.sourceRecordSha256);
  assert.equal(admission.representativeOutputAllowed, false);
  assert.equal(admission.recommendationInfluenceAllowed, false);
  assert.equal(admission.canonicalProductionEvaluationAllowed, true);
  assert.equal(JSON.stringify(admission).includes(input.dataAdmission.sourceSession.fieldSessionId), false);
});

test("missing authority, tampering, noncanonical evidence, expiry, and over-retention fail closed", async () => {
  const { input, ledger } = await dataAdmission();
  const cases = [
    [input, undefined, "legal_hold_state_unknown"],
    [{ dataAdmission: { ...input.dataAdmission, dataPolicySha256: digest("tampered-policy") } }, ledger, "route_iq_retention_data_policy_hash_mismatch"],
    [{ dataAdmission: { ...input.dataAdmission, envelope: { ...input.dataAdmission.envelope, recordOrigin: "historical" } } }, ledger, "record_origin_noncanonical"],
    [{ dataAdmission: { ...input.dataAdmission, envelope: { ...input.dataAdmission.envelope, derivedProjectionExpiresAt: "2028-02-14T12:00:00.000Z" } } }, ledger, "derived_projection_outlives_source"],
    [{ dataAdmission: { ...input.dataAdmission, envelope: { ...input.dataAdmission.envelope, evaluatedAt: "2028-01-14T12:00:00.000Z" } } }, ledger, "retention_deadline_expired"],
  ];
  for (const [candidate, candidateLedger, reason] of cases) {
    if (reason === "route_iq_retention_data_policy_hash_mismatch") {
      assert.throws(
        () => evaluateRouteIqProspectiveIntelligenceRetentionAdmission(candidate, { retentionGovernanceLedger: candidateLedger }),
        (error) => error?.code === reason,
      );
    } else {
      const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(candidate, { retentionGovernanceLedger: candidateLedger });
      assert.equal(result.admitted, false, reason);
      assert.equal(result.reasonCodes.includes(reason), true, reason);
    }
  }
});

test("the July 14 accidental archive remains hash-only and excluded", async () => {
  const { input, ledger } = await dataAdmission();
  input.dataAdmission.sourceSession = {
    coordinatorSessionId: `riq_session_${digest("disposed-session")}`,
    fieldSessionId: "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-14",
    rawSha256: "ceb72963ab4e98d6039c1a4a1a409d281bf9e41e6001bd78cca4c04364815765",
  };
  const result = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(input, {
    retentionGovernanceLedger: ledger,
  });
  assert.equal(result.admitted, false);
  assert.equal(result.reasonCodes.includes("administrative_disposition_policy_exclusion"), true);
  assert.deepEqual(result.audit, { sourceRawSha256: input.dataAdmission.sourceSession.rawSha256 });
  assert.equal(JSON.stringify(result).includes(input.dataAdmission.sourceSession.fieldSessionId), false);
});
