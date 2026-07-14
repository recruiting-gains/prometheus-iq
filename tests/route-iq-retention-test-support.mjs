import { createHash, createHmac } from "node:crypto";

import {
  addRouteIqRetentionCalendarMonths,
  createRouteIqRetentionHmacAuthorityVerifier,
  readRouteIqRetentionLegalHoldSnapshot,
  routeIqCustomerRetentionOverrideAuthorityVersion,
  routeIqRetentionAuthorityAssertionVersion,
  routeIqRetentionOperationAuthorizationVersion
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function retentionSha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

export function createRetentionAuthority(secret = "route-iq-retention-test-authority-key-material-v1") {
  const keyVersion = `riq_retention_key_${retentionSha256(secret)}`;
  const verifier = createRouteIqRetentionHmacAuthorityVerifier({
    verificationKey: secret,
    keyVersion
  });
  return {
    keyVersion,
    verifier,
    sign(claims, {
      authority = "prometheus_founder",
      seed = stableJson(claims),
      authorizationReference = `riq_retention_auth_${retentionSha256(`authorization:${seed}`)}`,
      auditEventSha256 = retentionSha256(`audit:${seed}`)
    } = {}) {
      const body = {
        version: routeIqRetentionAuthorityAssertionVersion,
        authority,
        authorizationReference,
        keyVersion,
        auditEventSha256,
        claims
      };
      return {
        version: body.version,
        authority: body.authority,
        authorizationReference: body.authorizationReference,
        keyVersion: body.keyVersion,
        auditEventSha256: body.auditEventSha256,
        signature: createHmac("sha256", secret).update(stableJson(body)).digest("hex")
      };
    }
  };
}

export function createRetentionStore() {
  const ledgers = new Map();
  return {
    persistenceMode: "durable_append_only",
    async readRetentionLedger({ subjectKey }) {
      const records = structuredClone(ledgers.get(subjectKey) || []);
      return {
        records,
        head: {
          recordCount: records.length,
          lastRecordSha256: records.at(-1)?.recordSha256 || null
        }
      };
    },
    async appendRetentionRecord({
      subjectKey,
      expectedRecordCount,
      expectedPreviousRecordSha256,
      record
    }) {
      const records = ledgers.get(subjectKey) || [];
      if (records.length !== expectedRecordCount
        || (records.at(-1)?.recordSha256 || null) !== expectedPreviousRecordSha256) {
        throw new Error("test_retention_compare_and_append_conflict");
      }
      ledgers.set(subjectKey, [...records, structuredClone(record)]);
    },
    replaceRecordsForTest(subjectKey, records) {
      ledgers.set(subjectKey, structuredClone(records));
    }
  };
}

export function legalHoldAuthorityClaims({ eventType, recordedAt, subject }) {
  return {
    purpose: "legal_hold_transition",
    eventType,
    recordedAt,
    subject
  };
}

export function retentionOperationAuthorityClaims({
  operation,
  requestedAt,
  subject,
  retentionBoundary,
  administrativeDispositionTarget
}) {
  return {
    purpose: "retention_operation",
    authorizationVersion: routeIqRetentionOperationAuthorizationVersion,
    operation,
    requestedAt,
    subject,
    administrativeDispositionTarget,
    retentionBoundarySha256: retentionSha256(retentionBoundary)
  };
}

export function customerOverrideAuthorityClaims({
  subject,
  customerAccountId,
  createdAt,
  customerContractExpiresAt
}) {
  return {
    purpose: "customer_retention_override",
    authorityVersion: routeIqCustomerRetentionOverrideAuthorityVersion,
    subject,
    customerAccountId,
    sourceCreatedAt: createdAt,
    customerContractExpiresAt,
    policyMaximumExpiresAt: addRouteIqRetentionCalendarMonths(createdAt)
  };
}

export function aggregateAuthorityClaims({
  attestationVersion,
  artifactSha256,
  attestedAt,
  sourceSetSha256,
  legalHoldLedgerSetSha256,
  claims
}) {
  return {
    purpose: "deidentified_aggregate_attestation",
    attestationVersion,
    artifactSha256,
    attestedAt,
    sourceSetSha256,
    legalHoldLedgerSetSha256,
    claimsSha256: retentionSha256(claims)
  };
}

export function aggregateGovernanceBinding(sourceGovernance, asOf) {
  const governed = sourceGovernance.map(source => ({
    subject: source.subject,
    subjectSha256: retentionSha256(source.subject),
    snapshot: readRouteIqRetentionLegalHoldSnapshot(
      source.retentionGovernanceLedger,
      source.subject,
      asOf
    )
  })).sort((left, right) => left.subjectSha256.localeCompare(right.subjectSha256));
  return {
    sourceSetSha256: retentionSha256(governed.map(({ subject, subjectSha256 }) => ({
      subject,
      subjectSha256
    }))),
    legalHoldLedgerSetSha256: retentionSha256(governed.map(({ subjectSha256, snapshot }) => ({
      subjectSha256,
      legalHoldLedgerSha256: snapshot.ledgerSha256
    })))
  };
}
