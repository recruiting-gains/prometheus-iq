#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PUBLIC_CRM_FOUNDER_ACCESS_POLICY,
  verifyPublicCrmFounderAccessContract
} from "./lib/cloudflare-public-crm-founder-access.mjs";

const root = resolve(import.meta.dirname, "..");
const paths = Object.freeze([
  PUBLIC_CRM_FOUNDER_ACCESS_POLICY.contractPath,
  "scripts/lib/cloudflare-public-crm-founder-access.mjs",
  "scripts/run-cloudflare-public-crm-founder-access.mjs",
  "scripts/verify-cloudflare-public-crm-founder-access.mjs",
  "tests/cloudflare-public-crm-founder-access.test.mjs",
  "docs/route-iq-public-crm-founder-access-v1.md"
]);

export function verifyCloudflarePublicCrmFounderAccess() {
  for (const path of paths) assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  const contract = verifyPublicCrmFounderAccessContract(root);
  const library = readFileSync(resolve(root, "scripts/lib/cloudflare-public-crm-founder-access.mjs"), "utf8");
  const runner = readFileSync(resolve(root, "scripts/run-cloudflare-public-crm-founder-access.mjs"), "utf8");
  const runtime = readFileSync(resolve(root, "workers/infrastructure/route-iq-request-crm-runtime.js"), "utf8");
  const documentation = readFileSync(resolve(root, "docs/route-iq-public-crm-founder-access-v1.md"), "utf8");

  assert.equal(contract.application.domain, PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationDomain);
  assert.equal(contract.policy.bypassAllowed, false);
  assert.equal(contract.policy.everyoneAllowed, false);
  assert.equal(contract.policy.displayNameAllowed, false);
  assert.equal(contract.httpBoundary.publicWebsiteProtected, false);
  assert.equal(contract.httpBoundary.publicIntake.cloudflareAccessRequired, false);
  assert.equal(contract.httpBoundary.founderEndpoints.cloudflareAccessRequired, true);
  assert.deepEqual(contract.workerSettings.names, [...PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames]);
  assert.match(library, /createRemoteJWKSet/u);
  assert.match(library, /jwtVerify/u);
  assert.match(library, /createHash\("sha256"\)/u);
  assert.match(library, /cloudflaredCommand/u);
  assert.match(library, /ghCommand/u);
  assert.match(runner, /createControllingTtyConfirmation/u);
  assert.match(runtime, /Cf-Access-Jwt-Assertion/u);
  assert.match(runtime, /FOUNDER_ACCESS_REQUIRED_CLAIMS = Object\.freeze\(\["sub", "iat", "exp"\]\)/u);
  assert.match(runtime, /algorithms: \["RS256"\]/u);
  assert.match(runtime, /route_iq_request_founder_auth_issuer_mismatch/u);
  assert.match(runtime, /route_iq_request_founder_auth_audience_mismatch/u);
  assert.match(runtime, /route_iq_request_founder_auth_signing_key_unknown/u);
  assert.match(runtime, /route_iq_request_founder_auth_signature_invalid/u);
  assert.match(runtime, /route_iq_request_founder_auth_jwks_timeout/u);
  assert.match(runtime, /route_iq_request_founder_auth_jwks_unavailable/u);
  assert.match(runtime, /createRemoteJWKSet/u);
  assert.match(runtime, /expectedSubjectSha256/u);
  assert.doesNotMatch(documentation, /Fitness Connection.*(?:customer|partner|sponsor|endorser)/iu);
  assert.doesNotMatch(library, /console\.(?:log|error|warn)|process\.stdout|process\.stderr/u);
  return Object.freeze({ status: "PUBLIC_CRM_FOUNDER_ACCESS_VERIFIED" });
}

try {
  process.stdout.write(`${verifyCloudflarePublicCrmFounderAccess().status}\n`);
} catch {
  process.stdout.write("FAIL\n");
  process.exitCode = 1;
}
