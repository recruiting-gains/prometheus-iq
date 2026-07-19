import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import {
  PUBLIC_CRM_FOUNDER_ACCESS_FAILURE,
  PUBLIC_CRM_FOUNDER_ACCESS_POLICY,
  PublicCrmFounderAccessError,
  configurePublicCrmFounderPrincipal,
  derivePublicCrmFounderSettings,
  readPublicCrmFounderAccessSetup,
  storePublicCrmFounderEnvironmentSettings,
  validatePublicCrmFounderAccessSetup,
  verifyPublicCrmFounderAccessContract
} from "../scripts/lib/cloudflare-public-crm-founder-access.mjs";
import { verifyCloudflarePublicCrmFounderAccess } from "../scripts/verify-cloudflare-public-crm-founder-access.mjs";

const root = resolve(import.meta.dirname, "..");
const now = new Date("2026-07-19T18:00:00.000Z");
const issuer = "https://prometheus-test.cloudflareaccess.com";
const audience = "a".repeat(64);
const founderEmail = "founder@example.com";
const identityProviderId = "11111111-1111-4111-8111-111111111111";

function setup(overrides = {}) {
  return {
    version: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.setupVersion,
    applicationName: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationName,
    applicationDomain: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationDomain,
    policyName: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.policyName,
    teamDomain: issuer,
    audience,
    founderEmail,
    identityProviderId,
    githubRepository: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubRepository,
    githubEnvironment: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubEnvironment,
    nonce: "b".repeat(32),
    createdAt: "2026-07-19T17:50:00.000Z",
    expiresAt: "2026-07-19T18:10:00.000Z",
    ...overrides
  };
}

async function tokenFixture(email = founderEmail) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { alg: "RS256", use: "sig", kid: "public-crm-founder-test" });
  const subject = "immutable-founder-subject-test";
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 30)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 300)
    .sign(privateKey);
  return {
    token: Buffer.from(token, "utf8"),
    subject,
    keyResolver: createLocalJWKSet({ keys: [jwk] })
  };
}

test("Access contract protects only Founder paths and rejects broad policy constructs", () => {
  const contract = verifyPublicCrmFounderAccessContract(root);
  assert.equal(contract.application.domain, "prometheusrouteiq.com/api/partner-intake/founder/*");
  assert.equal(contract.policy.bypassAllowed, false);
  assert.equal(contract.policy.everyoneAllowed, false);
  assert.equal(contract.policy.displayNameAllowed, false);
  assert.equal(contract.httpBoundary.publicWebsiteProtected, false);
  assert.equal(contract.httpBoundary.publicIntake.cloudflareAccessRequired, false);
  assert.equal(contract.httpBoundary.founderEndpoints.cloudflareAccessRequired, true);
  assert.equal(verifyCloudflarePublicCrmFounderAccess().status, "PUBLIC_CRM_FOUNDER_ACCESS_VERIFIED");
});

test("attended setup is exact, short-lived, owner-only, regular, and nonsymlinked", () => {
  assert.equal(validatePublicCrmFounderAccessSetup(setup(), now).audience, audience);
  for (const invalid of [
    setup({ audience: "invalid" }),
    setup({ founderEmail: "Founder@Example.com" }),
    setup({ expiresAt: "2026-07-19T19:00:00.000Z" }),
    setup({ policyName: "Everyone" })
  ]) {
    assert.throws(() => validatePublicCrmFounderAccessSetup(invalid, now), PublicCrmFounderAccessError);
  }

  const directory = mkdtempSync(join(tmpdir(), "public-crm-founder-setup-test-"));
  const path = join(directory, "setup.json");
  const link = join(directory, "setup-link.json");
  try {
    writeFileSync(path, JSON.stringify(setup()), { mode: 0o600 });
    assert.equal(readPublicCrmFounderAccessSetup(path, now).nonce, "b".repeat(32));
    chmodSync(path, 0o644);
    assert.throws(() => readPublicCrmFounderAccessSetup(path, now), PublicCrmFounderAccessError);
    chmodSync(path, 0o600);
    symlinkSync(path, link);
    assert.throws(() => readPublicCrmFounderAccessSetup(link, now), PublicCrmFounderAccessError);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("signed Access token maps only the exact email and returns only protected settings", async () => {
  const fixture = await tokenFixture();
  const values = await derivePublicCrmFounderSettings({
    token: fixture.token,
    setup: setup(),
    keyResolver: fixture.keyResolver,
    currentDate: now
  });
  assert.deepEqual(values, {
    teamDomain: issuer,
    audience,
    subjectSha256: createHash("sha256").update(fixture.subject).digest("hex")
  });
  assert.equal(JSON.stringify(values).includes(fixture.subject), false);

  const wrong = await tokenFixture("another@example.com");
  await assert.rejects(
    derivePublicCrmFounderSettings({
      token: wrong.token,
      setup: setup(),
      keyResolver: wrong.keyResolver,
      currentDate: now
    }),
    error => error.code === PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.PRINCIPAL_INVALID
  );
});

test("GitHub setting writer uses names in arguments and values only on stdin", () => {
  const settings = {
    teamDomain: issuer,
    audience,
    subjectSha256: "c".repeat(64)
  };
  const calls = [];
  let listCount = 0;
  const spawnCommand = (command, args, options = {}) => {
    calls.push({ command, args: [...args], input: options.input ? Buffer.from(options.input) : null });
    if (args[0] === "secret" && args[1] === "list") {
      listCount += 1;
      return Buffer.from(JSON.stringify(listCount === 1
        ? []
        : PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames.map(name => ({ name }))));
    }
    return Buffer.alloc(0);
  };
  const result = storePublicCrmFounderEnvironmentSettings(settings, spawnCommand);
  assert.equal(result.status, "PUBLIC_CRM_FOUNDER_SETTINGS_CONFIGURED");
  const setters = calls.filter(call => call.args[1] === "set");
  assert.equal(setters.length, 3);
  const argumentText = setters.flatMap(call => call.args).join(" ");
  for (const value of Object.values(settings)) assert.equal(argumentText.includes(value), false);
  assert.deepEqual(setters.map(call => call.input.toString("utf8")), Object.values(settings));
  for (const call of calls) call.input?.fill(0);
});

test("existing setting names fail closed before any write", () => {
  let writes = 0;
  assert.throws(
    () => storePublicCrmFounderEnvironmentSettings({
      teamDomain: issuer,
      audience,
      subjectSha256: "c".repeat(64)
    }, (_command, args) => {
      if (args[1] === "list") {
        return Buffer.from(JSON.stringify([{ name: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames[0] }]));
      }
      writes += 1;
      return Buffer.alloc(0);
    }),
    error => error.code === PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETTINGS_ALREADY_PRESENT
  );
  assert.equal(writes, 0);
});

test("Founder confirmation precedes setup reads, authentication, and GitHub settings", async () => {
  const directory = mkdtempSync(join(tmpdir(), "public-crm-founder-order-test-"));
  const path = join(directory, "setup.json");
  writeFileSync(path, JSON.stringify(setup()), { mode: 0o600 });
  let spawnCalls = 0;
  try {
    await assert.rejects(
      configurePublicCrmFounderPrincipal({
        root,
        setupPath: path,
        confirm: () => false,
        spawnCommand: () => { spawnCalls += 1; return Buffer.alloc(0); },
        currentDate: now
      }),
      error => error.code === PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.TTY_REQUIRED
    );
    assert.equal(spawnCalls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
