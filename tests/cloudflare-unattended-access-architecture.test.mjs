import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ENVIRONMENT_CREDENTIAL_NAMES,
  KEYCHAIN_ITEMS,
  formatPresenceReport,
  inspectEnvironmentPresence,
  inspectKeychainPresence,
  presenceRequirementFailures,
  scanTextForCloudflareSecrets,
  verifyLocalSecretArtifacts
} from "../scripts/check-cloudflare-unattended-secret-presence.mjs";
import {
  validateFounderControl,
  verifyCloudflareUnattendedAccessArchitecture
} from "../scripts/verify-cloudflare-unattended-access-architecture.mjs";

const root = resolve(import.meta.dirname, "..");
const contract = JSON.parse(readFileSync(
  resolve(root, "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json"),
  "utf8"
));

function validControl(overrides = {}) {
  return {
    schemaVersion: "cloudflare-unattended-deployment-control-v1",
    enabled: true,
    targetWorker: "prometheus-iq",
    environment: "production_private",
    authorizedCommit: "a".repeat(40),
    authorizedTree: "b".repeat(40),
    founderDirectiveId: "FOUNDER-DEPLOY-0001",
    issuedAt: "2026-07-14T12:00:00.000Z",
    expiresAt: "2026-07-14T12:15:00.000Z",
    oneShotAuthorizationNonce: "synthetic-nonce-000000000001",
    ...overrides
  };
}

const controlContext = Object.freeze({
  now: new Date("2026-07-14T12:05:00.000Z"),
  expectedCommit: "a".repeat(40),
  expectedTree: "b".repeat(40)
});

test("architecture is explicitly not configured, authorized, or deployed", () => {
  const result = verifyCloudflareUnattendedAccessArchitecture();
  assert.equal(result.status, "passed");
  assert.equal(result.setupStatus, "NOT_CONFIGURED");
  assert.equal(result.unattendedDeploymentReady, false);
  assert.equal(result.unattendedSmokeReady, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.publicWorkerAllowed, false);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.prospectiveCollection, "OFF");
});

test("strict unattended preflight cannot pass while readiness guards are incomplete", () => {
  assert.throws(
    () => verifyCloudflareUnattendedAccessArchitecture({ requireReady: true }),
    /NOT_CONFIGURED/u
  );
});

test("deployment and smoke credentials remain separate and least-privilege", () => {
  assert.deepEqual(contract.deploymentCredential.environmentNames, ENVIRONMENT_CREDENTIAL_NAMES.slice(0, 2));
  assert.deepEqual(contract.smokeCredential.environmentNames, ENVIRONMENT_CREDENTIAL_NAMES.slice(2));
  assert.equal(contract.credentialSeparation.sharedCredentialAllowed, false);
  assert.deepEqual(contract.deploymentCredential.permissions, [
    "Account Settings Read",
    "Workers Scripts Edit"
  ]);
  assert.equal(contract.deploymentCredential.resourceScope.include, "exact_account_only");
  assert.equal(contract.deploymentCredential.resourceScope.zoneResourcesGranted, false);
  assert.equal(contract.smokeCredential.policy.action, "Service Auth");
  assert.equal(contract.smokeCredential.policy.anyServiceTokenAllowed, false);
});

test("source guard is implemented without claiming configured smoke readiness", () => {
  assert.equal(contract.smokeCredential.httpReadOnlyGuaranteeProvidedByAccess, false);
  assert.equal(contract.servicePrincipalReadOnlyGuard.status, "IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED");
  assert.equal(contract.servicePrincipalReadOnlyGuard.sourceImplemented, true);
  assert.equal(contract.servicePrincipalReadOnlyGuard.productionConfigured, false);
  assert.equal(contract.servicePrincipalReadOnlyGuard.productionDeployed, false);
  assert.equal(contract.servicePrincipalReadOnlyGuard.requiredBeforeUnattendedSmoke, true);
  assert.deepEqual(contract.servicePrincipalReadOnlyGuard.allowedMethods, ["GET", "HEAD"]);
  assert.equal(contract.servicePrincipalReadOnlyGuard.allOtherMethodsAndPaths, "DENY");
  assert.equal(contract.servicePrincipalReadOnlyGuard.writeAttemptCountRequired, 0);
});

test("name-only environment presence never reads or reports values", () => {
  const requested = [];
  const results = inspectEnvironmentPresence(name => {
    requested.push(name);
    return name.endsWith("ACCOUNT_ID");
  });
  const report = formatPresenceReport(results);

  assert.deepEqual(requested, ENVIRONMENT_CREDENTIAL_NAMES);
  assert.match(report, /CLOUDFLARE_ACCOUNT_ID: PRESENT/u);
  assert.match(report, /CLOUDFLARE_API_TOKEN: ABSENT/u);
  assert.doesNotMatch(report, /value|length|hash|prefix/iu);
});

test("name-only Keychain presence uses synthetic status adapters", () => {
  const requested = [];
  const results = inspectKeychainPresence(item => {
    requested.push(item);
    return item.account === "CLOUDFLARE_ACCESS_CLIENT_ID";
  });
  const report = formatPresenceReport(results);

  assert.deepEqual(requested, KEYCHAIN_ITEMS);
  assert.match(report, /com\.prometheus\.cloudflare\.unattended\.smoke\/CLOUDFLARE_ACCESS_CLIENT_ID: PRESENT/u);
  assert.doesNotMatch(report, /secret-value-not-for-output/u);
});

test("default absence passes architecture checks while require-present fails", () => {
  const absent = inspectEnvironmentPresence(() => false);
  assert.deepEqual(presenceRequirementFailures(absent, false), []);
  assert.equal(presenceRequirementFailures(absent, true).length, ENVIRONMENT_CREDENTIAL_NAMES.length);
});

test("tracked-source scanner detects high-confidence tokens without echoing them", () => {
  const syntheticToken = ["cf", "ut_", "A".repeat(40)].join("");
  const findings = scanTextForCloudflareSecrets(`credential ${syntheticToken}`, "fixture.txt");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "Cloudflare API token format");
  assert.equal(JSON.stringify(findings).includes(syntheticToken), false);
});

test("tracked-source scanner detects literal assignments and permits references", () => {
  const literal = ["literal", "-credential-value"].join("");
  const assigned = scanTextForCloudflareSecrets(
    ["CLOUDFLARE_API_TOKEN", literal].join("="),
    "fixture.txt"
  );
  const references = scanTextForCloudflareSecrets([
    "CLOUDFLARE_API_TOKEN=${KEYCHAIN_INJECTED_VALUE}",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET=<KEYCHAIN_VALUE>",
    "CF_AUTHORIZATION=process.env.CF_AUTHORIZATION"
  ].join("\n"), "fixture.txt");

  assert.equal(assigned.length, 1);
  assert.equal(assigned[0].kind, "literal Cloudflare credential assignment");
  assert.deepEqual(references, []);
});

test("secret-like local artifacts are ignored and untracked", () => {
  assert.deepEqual(verifyLocalSecretArtifacts({ root }), []);
});

test("Founder control requires exact target, version, expiry, and unused nonce", () => {
  assert.equal(validateFounderControl(validControl(), controlContext).valid, true);
  assert.ok(validateFounderControl(validControl({ enabled: false }), controlContext).reasons.includes("control_off"));
  assert.ok(validateFounderControl(validControl({ targetWorker: "prometheusrouteiq-website" }), controlContext).reasons.includes("wrong_target"));
  assert.ok(validateFounderControl(validControl({ authorizedTree: "c".repeat(40) }), controlContext).reasons.includes("tree_mismatch"));
  assert.ok(validateFounderControl(validControl({ expiresAt: "2026-07-14T12:04:00.000Z" }), controlContext).reasons.includes("expired"));
  assert.ok(validateFounderControl(validControl(), {
    ...controlContext,
    consumedNonces: new Set(["synthetic-nonce-000000000001"])
  }).reasons.includes("nonce_already_consumed"));
});

test("Founder control cannot use an unlimited authorization window", () => {
  const result = validateFounderControl(validControl({
    expiresAt: "2026-07-14T13:00:00.000Z"
  }), controlContext);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("authorization_window_too_long"));
});

test("forbidden unattended actions remain explicit", () => {
  for (const action of [
    "token_management",
    "access_policy_management",
    "secret_management",
    "public_worker_deployment",
    "production_data_write",
    "cohort_activation",
    "prospective_collection_activation",
    "recommendation_influence_activation",
    "log_tail_or_data_bearing_log_read",
    "arbitrary_HTTP_request"
  ]) {
    assert.ok(contract.unattendedActions.denied.includes(action));
  }
});
