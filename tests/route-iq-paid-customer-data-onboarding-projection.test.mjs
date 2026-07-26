import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  RouteIqPaidCustomerDataError,
  projectRouteIqVerifiedBusinessEligibilityPolicy,
  routeIqPaidCustomerVerifiedBusinessHandoffVersion,
  routeIqVerifiedBusinessAuditVersion,
  routeIqVerifiedBusinessEligibilityPolicyVersion,
  routeIqVerifiedBusinessEvidenceVersion,
  routeIqVerifiedBusinessNormalizedVersion,
  routeIqVerifiedBusinessStorageVersion,
  stableRouteIqVerifiedBusinessJson,
  validateRouteIqPaidCustomerVerifiedBusinessHandoff,
  validateRouteIqVerifiedBusinessEligibilityPolicy
} from "../data/route-iq-paid-customer-v1/route-iq-verified-business-evidence.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const fixtureEnvelope = JSON.parse(readFileSync(resolve(
  repoRoot,
  "administration/workspace-configurations/"
    + "route-iq-paid-customer-synthetic-fixtures-v1.json"
), "utf8"));
const configurations = fixtureEnvelope.configurations;

function clone(value) {
  return structuredClone(value);
}

function project(configuration, options = {}) {
  return projectRouteIqVerifiedBusinessEligibilityPolicy(configuration, {
    authorizedScope: {
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId
    },
    ...options
  });
}

function buildInfrastructureHandoff(configuration) {
  return {
    contractVersion: routeIqPaidCustomerVerifiedBusinessHandoffVersion,
    ownerSubsystem: "Prometheus Infrastructure",
    receivingSubsystem: "Prometheus Data",
    evidenceContractVersion: routeIqVerifiedBusinessEvidenceVersion,
    normalizedEvidenceVersion: routeIqVerifiedBusinessNormalizedVersion,
    eligibilityPolicyVersion: routeIqVerifiedBusinessEligibilityPolicyVersion,
    storageRecordVersion: routeIqVerifiedBusinessStorageVersion,
    auditRecordVersion: routeIqVerifiedBusinessAuditVersion,
    scope: {
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId,
      immutable: true
    },
    territory: {
      territoryId: configuration.territory.territoryId,
      authorizedZipCodes: [...configuration.territory.authorizedZipCodes]
    },
    customerRules: {
      includedCategoryIds: [...configuration.targeting.includedCategoryIds],
      excludedCategoryIds: [...configuration.targeting.excludedCategoryIds],
      excludedBusinessIds: [...configuration.targeting.excludedBusinessIds]
    },
    freshnessCeilingHours: configuration.verification.freshnessCeilingHours,
    evidenceQualityRequired: configuration.verification.evidenceQualityRequired,
    admissionState: "FAIL_CLOSED_PENDING_DATA_AND_INTELLIGENCE_VALIDATION",
    businessActivationPerformed: false,
    providerRefresh: "OFF",
    scheduler: "OFF",
    productionMutationPerformed: false
  };
}

test("both unrelated Administration fixtures deterministically project to valid isolated policies", () => {
  assert.equal(configurations.length, 2);
  const policies = configurations.map(configuration => {
    const handoff = buildInfrastructureHandoff(configuration);
    const policy = project(configuration, {
      infrastructureHandoff: handoff
    });
    assert.deepEqual(
      policy,
      validateRouteIqVerifiedBusinessEligibilityPolicy(policy)
    );
    assert.equal(policy.policyId, configuration.configurationId);
    assert.equal(policy.policyVersion, `v${configuration.configurationRevision}`);
    assert.equal(policy.companyId, configuration.company.companyId);
    assert.equal(policy.workspaceId, configuration.company.workspaceId);
    assert.equal(policy.minimumEvidenceQuality, "LOW");
    assert.equal(policy.maximumFreshnessHours, 24);
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(
      stableRouteIqVerifiedBusinessJson(
        project(configuration)
      ),
      stableRouteIqVerifiedBusinessJson(policy)
    );
    return policy;
  });

  assert.notEqual(policies[0].companyId, policies[1].companyId);
  assert.notEqual(policies[0].workspaceId, policies[1].workspaceId);
  assert.notEqual(
    policies[0].authorizedTerritories[0].territoryId,
    policies[1].authorizedTerritories[0].territoryId
  );
  assert.equal(
    policies[0].authorizedTerritories[0].postalCodes.some(postalCode =>
      policies[1].authorizedTerritories[0].postalCodes.includes(postalCode)
    ),
    false
  );
});

test("Data independently validates the exact Infrastructure handoff without importing it", () => {
  for (const configuration of configurations) {
    const policy = project(configuration);
    const handoff = validateRouteIqPaidCustomerVerifiedBusinessHandoff(
      buildInfrastructureHandoff(configuration),
      { expectedEligibilityPolicy: policy }
    );
    assert.equal(handoff.scope.immutable, true);
    assert.equal(handoff.providerRefresh, "OFF");
    assert.equal(handoff.scheduler, "OFF");
    assert.equal(handoff.businessActivationPerformed, false);
    assert.equal(handoff.productionMutationPerformed, false);
    assert.equal(Object.isFrozen(handoff), true);
  }
});

test("cross-company and cross-workspace handoff substitution fails closed", () => {
  const firstPolicy = project(configurations[0]);
  const secondHandoff = buildInfrastructureHandoff(configurations[1]);
  assert.throws(
    () => validateRouteIqPaidCustomerVerifiedBusinessHandoff(secondHandoff, {
      expectedEligibilityPolicy: firstPolicy
    }),
    error => error instanceof RouteIqPaidCustomerDataError
      && error.code === "route_iq_paid_customer_handoff_policy_mismatch"
  );

  const mixedScope = buildInfrastructureHandoff(configurations[0]);
  mixedScope.scope.workspaceId = configurations[1].company.workspaceId;
  assert.throws(
    () => project(configurations[0], {
      infrastructureHandoff: mixedScope
    }),
    error => error.code === "route_iq_paid_customer_handoff_policy_mismatch"
  );

  assert.throws(
    () => projectRouteIqVerifiedBusinessEligibilityPolicy(configurations[0], {
      authorizedScope: {
        companyId: configurations[1].company.companyId,
        workspaceId: configurations[1].company.workspaceId
      }
    }),
    error => error.code === "route_iq_paid_customer_projection_scope_unauthorized"
  );
});

test("malformed and contradictory Administration configurations cannot project", () => {
  const missingTargeting = clone(configurations[0]);
  delete missingTargeting.targeting;
  assert.throws(
    () => project(missingTargeting),
    error => error instanceof RouteIqPaidCustomerDataError
      && error.code === "route_iq_paid_customer_onboarding_configuration_invalid"
  );

  const contradictory = clone(configurations[0]);
  contradictory.targeting.excludedCategoryIds.push(
    contradictory.targeting.includedCategoryIds[0]
  );
  assert.throws(
    () => project(contradictory),
    error => error.code === "route_iq_paid_customer_onboarding_configuration_invalid"
  );

  const draft = clone(configurations[0]);
  draft.lifecycle.state = "DRAFT";
  draft.lifecycle.revision += 1;
  draft.lifecycle.lastTransitionAt = "2026-07-26T13:00:00.000Z";
  assert.throws(
    () => project(draft),
    error => error.code === "route_iq_paid_customer_onboarding_state_ineligible"
  );
});

test("malformed, contradictory, and active handoffs cannot become Data policy evidence", () => {
  const configuration = configurations[0];
  const policy = project(configuration);

  const overlap = buildInfrastructureHandoff(configuration);
  overlap.customerRules.excludedCategoryIds.push(
    overlap.customerRules.includedCategoryIds[0]
  );
  assert.throws(
    () => validateRouteIqPaidCustomerVerifiedBusinessHandoff(overlap, {
      expectedEligibilityPolicy: policy
    }),
    error => error.code === "route_iq_paid_customer_handoff_rules_conflict"
  );

  for (const mutation of [
    handoff => {
      handoff.providerRefresh = "ON";
    },
    handoff => {
      handoff.scheduler = "ON";
    },
    handoff => {
      handoff.businessActivationPerformed = true;
    },
    handoff => {
      handoff.productionMutationPerformed = true;
    }
  ]) {
    const handoff = buildInfrastructureHandoff(configuration);
    mutation(handoff);
    assert.throws(
      () => validateRouteIqPaidCustomerVerifiedBusinessHandoff(handoff, {
        expectedEligibilityPolicy: policy
      }),
      error => error.code === "route_iq_paid_customer_handoff_activation_forbidden"
    );
  }

  const weakEvidence = buildInfrastructureHandoff(configuration);
  weakEvidence.evidenceQualityRequired = false;
  assert.throws(
    () => validateRouteIqPaidCustomerVerifiedBusinessHandoff(weakEvidence),
    error => error.code === "route_iq_paid_customer_handoff_evidence_policy_invalid"
  );

  const stale = buildInfrastructureHandoff(configuration);
  stale.freshnessCeilingHours = 25;
  assert.throws(
    () => validateRouteIqPaidCustomerVerifiedBusinessHandoff(stale),
    error => error.code === "route_iq_paid_customer_handoff_evidence_policy_invalid"
  );
});

test("projection never activates providers, schedulers, customers, collection, cohorts, or influence", () => {
  for (const configuration of configurations) {
    const policy = project(configuration);
    assert.deepEqual(
      Object.keys(policy).sort(),
      [
        "authorizedTerritories",
        "companyId",
        "excludedBusinessIds",
        "excludedCategoryIds",
        "includedCategoryIds",
        "maximumFreshnessHours",
        "minimumEvidenceQuality",
        "policyId",
        "policyVersion",
        "schemaVersion",
        "workspaceId"
      ].sort()
    );
    assert.equal(configuration.safety.customerActivation, "OFF");
    assert.equal(configuration.safety.collection, "OFF");
    assert.equal(configuration.safety.activeCohorts, 0);
    assert.equal(configuration.safety.recommendationInfluence, "OFF");
    assert.equal(configuration.safety.providerRefresh, "OFF");
    assert.equal(configuration.safety.scheduler, "OFF");
  }
});
