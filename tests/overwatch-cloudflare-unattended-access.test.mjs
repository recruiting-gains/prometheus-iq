import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  evaluateCloudflareUnattendedAccessGovernance,
  verifyOverwatchCloudflareUnattendedAccess
} from "../scripts/verify-overwatch-cloudflare-unattended-access.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const infrastructure = readJson("workers/infrastructure/cloudflare-unattended-deployment-access-v1.json");
const governance = readJson("overwatch/governance/cloudflare-unattended-deployment-access-v1.json");
const report = readJson("overwatch/reports/BATCH-20260714-005-cloudflare-unattended-deployment-access.json");
const clone = value => structuredClone(value);
const evaluate = (infra = infrastructure, gov = governance, batchReport = report) => (
  evaluateCloudflareUnattendedAccessGovernance({ infrastructure: infra, governance: gov, report: batchReport })
);

test("Overwatch independently verifies the unattended access architecture and held release boundary", () => {
  const result = verifyOverwatchCloudflareUnattendedAccess();
  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260714-005");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.setupStatus, "NOT_CONFIGURED");
  assert.equal(result.repositorySecretFindings, 0);
  assert.equal(result.unattendedDeploymentReady, false);
  assert.equal(result.unattendedSmokeReady, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.cloudflareAccessPerformed, false);
  assert.equal(result.productionMutationPerformed, false);
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.recommendationInfluence, "OFF");
});

test("Overwatch rejects a combined deployment and smoke credential", () => {
  const mutated = clone(infrastructure);
  mutated.credentialSeparation.sharedCredentialAllowed = true;
  const result = evaluate(mutated);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(failure => failure.includes("separate")));
});

test("Overwatch rejects broader Cloudflare deployment permissions", () => {
  const mutated = clone(infrastructure);
  mutated.deploymentCredential.permissions.push("Workers KV Storage Edit");
  const result = evaluate(mutated);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(failure => failure.includes("least-privilege")));
});

test("Overwatch rejects account, zone, and target expansion", () => {
  const account = clone(infrastructure);
  account.deploymentCredential.resourceScope.include = "all_accounts";
  assert.equal(evaluate(account).ok, false);

  const zone = clone(infrastructure);
  zone.deploymentCredential.resourceScope.zoneResourcesGranted = true;
  assert.equal(evaluate(zone).ok, false);

  const target = clone(infrastructure);
  target.target.publicWorkerAllowed = true;
  assert.equal(evaluate(target).ok, false);
});

test("Overwatch rejects Any Access Service Token and false read-only claims", () => {
  const anyToken = clone(infrastructure);
  anyToken.smokeCredential.policy.anyServiceTokenAllowed = true;
  assert.equal(evaluate(anyToken).ok, false);

  const falseReadOnly = clone(infrastructure);
  falseReadOnly.smokeCredential.httpReadOnlyGuaranteeProvidedByAccess = true;
  assert.equal(evaluate(falseReadOnly).ok, false);
});

test("Overwatch rejects an enabled or reusable Founder control boundary", () => {
  const enabled = clone(infrastructure);
  enabled.founderDeploymentControl.defaultState = "ON";
  assert.equal(evaluate(enabled).ok, false);

  const reusable = clone(infrastructure);
  reusable.founderDeploymentControl.authorizationNonceReusable = true;
  assert.equal(evaluate(reusable).ok, false);

  const unbounded = clone(infrastructure);
  unbounded.founderDeploymentControl.maximumLifetimeMinutes = 1440;
  assert.equal(evaluate(unbounded).ok, false);
});

test("Overwatch rejects smoke readiness before both read-only layers exist", () => {
  const mutated = clone(governance);
  mutated.smokeReadOnlyBoundary.unattendedSmokeReady = true;
  const result = evaluate(infrastructure, mutated);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(failure => failure.includes("smoke readiness")));
});

test("Overwatch rejects deployment, Cloudflare access, production mutation, collection, or recommendation influence", () => {
  for (const [field, value] of [
    ["deploymentAuthorized", true],
    ["deploymentPerformed", true],
    ["cloudflareAccessPerformed", true],
    ["tokenCreationPerformed", true],
    ["serviceTokenCreationPerformed", true],
    ["accessPolicyChangePerformed", true],
    ["secretStoragePerformed", true],
    ["productionMutationPerformed", true],
    ["prospectiveCollection", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const mutated = clone(governance);
    mutated.deploymentBoundary[field] = value;
    assert.equal(evaluate(infrastructure, mutated).ok, false, field);
  }
});

test("Overwatch rejects implementation ownership inversion", () => {
  const mutated = clone(governance);
  mutated.dispatchAudit.implementationOwner = "Prometheus Overwatch";
  mutated.dispatchAudit.overwatchModifiedSubsystemImplementation = true;
  const result = evaluate(infrastructure, mutated);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(failure => failure.includes("Implementation owner")));
  assert.ok(result.failures.some(failure => failure.includes("must not modify")));
});
