import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { Miniflare } from "miniflare";

import {
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS,
  CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
  isCloudflareUnattendedSmokeRequestAllowed
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import {
  authorizeCloudflareUnattendedSmokeRequest
} from "../workers/infrastructure/cloudflare-unattended-smoke-guard.js";
import {
  consumeFounderControlFile,
  inspectFounderControlFile,
  validateFounderControl
} from "../scripts/lib/cloudflare-unattended-control.mjs";
import {
  CLOUDFLARE_UNATTENDED_WRANGLER_MODULE,
  CLOUDFLARE_UNATTENDED_WRANGLER_VERSION,
  runCloudflareUnattendedLauncher
} from "../scripts/lib/cloudflare-unattended-launcher.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_FAILURE,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY,
  CloudflareUnattendedSmokeError,
  fixedCloudflareUnattendedSmokePlan,
  runCloudflareUnattendedSmoke
} from "../scripts/run-cloudflare-unattended-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const testNow = new Date("2026-07-14T18:05:00.000Z");
const testIssuer = new URL(`https://${["noncanonical-smoke-test", "cloudflareaccess", "com"].join(".")}`).origin;
const testAudience = ["noncanonical", "smoke", "audience"].join("-");
const testClientId = `${"a".repeat(32)}.access`;
const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const forgedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = await exportJWK(signingKeys.publicKey);
publicJwk.kid = "smoke-test-key";
publicJwk.alg = "RS256";
const keyResolver = createLocalJWKSet({ keys: [publicJwk] });

function guardEnv(overrides = {}) {
  return {
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled]: "ON",
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain]: testIssuer,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience]: testAudience,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId]: testClientId,
    ...overrides
  };
}

async function accessToken({
  key = signingKeys.privateKey,
  issuer = testIssuer,
  audience = testAudience,
  commonName = testClientId,
  includeCommonName = true,
  subject = "",
  issuedAt = Math.floor(testNow.getTime() / 1000) - 30,
  expiresAt = Math.floor(testNow.getTime() / 1000) + 300
} = {}) {
  return new SignJWT({
    type: "app",
    sub: subject,
    ...(includeCommonName ? { common_name: commonName } : {})
  })
    .setProtectedHeader({ alg: "RS256", kid: "smoke-test-key", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
}

function smokeRequest(token, {
  method = "GET",
  path = "/",
  marker = CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue,
  includeClientCredentials = false
} = {}) {
  const headers = new Headers({
    ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
    ...(marker === null ? {} : { [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader]: marker })
  });
  if (includeClientCredentials) {
    headers.set(["CF-Access", "Client-Id"].join("-"), "synthetic-client-id");
    headers.set(["CF-Access", "Client-Secret"].join("-"), "synthetic-client-secret");
  }
  return new Request(`${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}${path}`, {
    method,
    headers
  });
}

const testHooks = Object.freeze({ enabled: true, keyResolver, currentDate: testNow });

test("ordinary Founder and representative traffic remains on the existing path", async () => {
  const ordinary = await authorizeCloudflareUnattendedSmokeRequest(
    new Request(`${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}/`),
    {}
  );
  assert.equal(ordinary.kind, "ordinary");

  const response = await handlePrometheusIqWorkerRequest(
    new Request(`${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}/`),
    { ASSETS: { async fetch() { return new Response("ordinary-runtime"); } } },
    {}
  );
  assert.equal(await response.text(), "ordinary-runtime");
  assert.equal(response.headers.has(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader), false);
});

test("valid service principal is signature-verified and confined to the read-only allowlist", async () => {
  const token = await accessToken();
  const response = await handlePrometheusIqWorkerRequest(
    smokeRequest(token, { includeClientCredentials: true }),
    {
      ...guardEnv(),
      ASSETS: {
        async fetch(request) {
          assert.equal(request.headers.has("Cf-Access-Jwt-Assertion"), false);
          assert.equal(request.headers.has(["CF-Access", "Client-Id"].join("-")), false);
          assert.equal(request.headers.has(["CF-Access", "Client-Secret"].join("-")), false);
          assert.equal(request.headers.has(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader), false);
          return new Response(`asset:${request.method}`);
        }
      }
    },
    {},
    { unattendedSmokeTestHooks: testHooks }
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:GET");
  assert.equal(
    response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader),
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue
  );
  assert.deepEqual(CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS, ["GET", "HEAD"]);
  assert.ok(CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS.length >= 10);
  assert.equal(CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS.includes("/index.html"), true);
});

test("missing or OFF guard configuration fails closed without calling assets", async () => {
  let assetCalls = 0;
  const token = await accessToken();
  for (const env of [{}, guardEnv({ [CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled]: "OFF" })]) {
    const response = await handlePrometheusIqWorkerRequest(
      smokeRequest(token),
      { ...env, ASSETS: { async fetch() { assetCalls += 1; return new Response("no"); } } },
      {},
      { unattendedSmokeTestHooks: testHooks }
    );
    assert.equal(response.status, 403);
  }
  assert.equal(assetCalls, 0);
});

test("forged, wrong-principal, wrong-issuer, wrong-audience, expired, and unmarked JWTs fail closed", async () => {
  const attempts = [
    smokeRequest(await accessToken({ key: forgedKeys.privateKey })),
    smokeRequest(await accessToken({ commonName: `${"b".repeat(32)}.access` })),
    smokeRequest(await accessToken({ issuer: new URL(`https://${["wrong", "cloudflareaccess", "com"].join(".")}`).origin })),
    smokeRequest(await accessToken({ audience: "wrong-audience" })),
    smokeRequest(await accessToken({ expiresAt: Math.floor(testNow.getTime() / 1000) - 1 })),
    smokeRequest(await accessToken(), { marker: null })
  ];
  for (const request of attempts) {
    const result = await authorizeCloudflareUnattendedSmokeRequest(request, guardEnv(), {
      noncanonicalTestHooks: testHooks
    });
    assert.equal(result.kind, "denied");
    assert.equal(result.response.status, 403);
  }
});

test("service JWT without marker and marker without verified service JWT are both denied", async () => {
  const token = await accessToken();
  const withoutMarker = await authorizeCloudflareUnattendedSmokeRequest(
    smokeRequest(token, { marker: null }),
    guardEnv(),
    { noncanonicalTestHooks: testHooks }
  );
  const markerOnly = await authorizeCloudflareUnattendedSmokeRequest(
    smokeRequest(null),
    guardEnv(),
    { noncanonicalTestHooks: testHooks }
  );
  assert.equal(withoutMarker.kind, "denied");
  assert.equal(markerOnly.kind, "denied");
});

test("another cryptographically valid service token cannot substitute for the configured identity", async () => {
  const token = await accessToken({ commonName: `${"b".repeat(32)}.access` });
  const result = await authorizeCloudflareUnattendedSmokeRequest(
    smokeRequest(token),
    guardEnv(),
    { noncanonicalTestHooks: testHooks }
  );
  assert.equal(result.kind, "denied");
});

test("broad methods, paths, query strings, origins, and malformed markers are denied", async () => {
  const token = await accessToken();
  const attempts = [
    smokeRequest(token, { method: "POST" }),
    smokeRequest(token, { path: "/api/dashboard/route-iq/field-session" }),
    smokeRequest(token, { path: "/?expand=true" }),
    smokeRequest(token, { path: "/index.html/" }),
    smokeRequest(token, { path: "/%69ndex.html" }),
    smokeRequest(token, { marker: "broader-access" }),
    new Request("https://prometheusrouteiq.com/", {
      headers: {
        "Cf-Access-Jwt-Assertion": token,
        [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader]:
          CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
      }
    })
  ];
  for (const request of attempts) {
    const result = await authorizeCloudflareUnattendedSmokeRequest(request, guardEnv(), {
      noncanonicalTestHooks: testHooks
    });
    assert.equal(result.kind, "denied");
  }
  assert.equal(
    isCloudflareUnattendedSmokeRequestAllowed("DELETE", new URL(CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN)),
    false
  );
});

test("human Access JWTs without the smoke marker do not enter the service-principal guard", async () => {
  const token = await accessToken({ subject: "noncanonical-human-subject", includeCommonName: false });
  const result = await authorizeCloudflareUnattendedSmokeRequest(
    smokeRequest(token, { marker: null }),
    {}
  );
  assert.equal(result.kind, "ordinary");
});

test("default-deny smoke client uses only fixed GET and HEAD requests without persistence", async () => {
  const syntheticId = "synthetic-client-id";
  const syntheticSecret = "synthetic-client-secret";
  const clientIdName = ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_");
  const clientSecretName = ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_");
  const observed = [];
  const result = await runCloudflareUnattendedSmoke({
    dryRun: false,
    credentials: {
      [clientIdName]: syntheticId,
      [clientSecretName]: syntheticSecret
    },
    async fetchImpl(url, options) {
      observed.push({ url: String(url), options });
      return new Response(null, {
        status: 200,
        headers: {
          [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader]:
            CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue
        }
      });
    }
  });
  assert.equal(result.status, "passed");
  assert.equal(result.attemptedWriteCount, 0);
  assert.equal(
    result.markerPolicy,
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
  );
  assert.equal(result.markerVerifiedCount, result.requestCount);
  assert.equal(result.markerOmittedCount, 0);
  assert.equal(observed.length, result.requestCount);
  for (const { url, options } of observed) {
    assert.equal(new URL(url).origin, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
    assert.ok(["GET", "HEAD"].includes(options.method));
    assert.equal(options.redirect, "manual");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.keepalive, false);
    assert.equal(Object.hasOwn(options, "body"), false);
    assert.equal(Object.hasOwn(options.headers, "Cookie"), false);
  }
  const output = JSON.stringify(result);
  assert.equal(output.includes(syntheticId), false);
  assert.equal(output.includes(syntheticSecret), false);
  assert.equal(output.includes(CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN), false);
  assert.equal(output.includes("\"path\""), false);
  assert.equal(output.includes("\"status\":200"), false);
});

test("bootstrap smoke permits an omitted guard marker but still requires Access, 2xx, and zero writes", async () => {
  const clientIdName = ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_");
  const clientSecretName = ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_");
  let calls = 0;
  const result = await runCloudflareUnattendedSmoke({
    dryRun: false,
    markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.BOOTSTRAP_ALLOW_MISSING,
    credentials: {
      [clientIdName]: "synthetic-client-id",
      [clientSecretName]: "synthetic-client-secret"
    },
    async fetchImpl(_url, options) {
      calls += 1;
      assert.ok(options.headers["CF-Access-Client-Id"]);
      assert.ok(options.headers["CF-Access-Client-Secret"]);
      return new Response(null, { status: 204 });
    }
  });
  assert.equal(result.status, "passed");
  assert.equal(result.requestCount, calls);
  assert.equal(result.attemptedWriteCount, 0);
  assert.equal(result.markerVerifiedCount, 0);
  assert.equal(result.markerOmittedCount, result.requestCount);
});

test("smoke uses the canonical root asset and never requests Cloudflare's redirecting index alias", async () => {
  const clientIdName = ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_");
  const clientSecretName = ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_");
  const observedPaths = [];
  const result = await runCloudflareUnattendedSmoke({
    dryRun: false,
    markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.BOOTSTRAP_ALLOW_MISSING,
    credentials: {
      [clientIdName]: "synthetic-client-id",
      [clientSecretName]: "synthetic-client-secret"
    },
    async fetchImpl(url) {
      const path = new URL(url).pathname;
      observedPaths.push(path);
      if (path === "/index.html") {
        return new Response(null, {
          status: 307,
          headers: { Location: "/" }
        });
      }
      return new Response(null, { status: 204 });
    }
  });
  assert.equal(result.status, "passed");
  assert.ok(observedPaths.includes("/"));
  assert.equal(observedPaths.includes("/index.html"), false);
});

test("real Miniflare assets runtime proves the canonical root and redirecting index alias", async t => {
  const miniflare = new Miniflare({
    modules: true,
    script: `export default {
      async fetch(request, env) {
        return env.ASSETS.fetch(request);
      }
    };`,
    compatibilityDate: "2026-06-30",
    assets: {
      directory: resolve(root, "deploy/cloudflare-pages"),
      binding: "ASSETS",
      routerConfig: {
        invoke_user_worker_ahead_of_assets: true,
        has_user_worker: true
      },
      assetConfig: {
        not_found_handling: "single-page-application"
      }
    }
  });
  t.after(() => miniflare.dispose());

  const dispatch = path => miniflare.dispatchFetch(
    `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}${path}`,
    { method: "GET", redirect: "manual" }
  );
  const rootResponse = await dispatch("/");
  const indexResponse = await dispatch("/index.html");
  const manifestResponse = await dispatch("/manifest.webmanifest");

  assert.equal(rootResponse.status, 200);
  assert.equal(rootResponse.headers.get("Location"), null);
  assert.equal(indexResponse.status, 307);
  assert.equal(indexResponse.headers.get("Location"), "/");
  assert.equal(manifestResponse.status, 200);
  assert.equal(manifestResponse.headers.get("Location"), null);

  const fixedPaths = fixedCloudflareUnattendedSmokePlan()
    .map(entry => new URL(entry.url).pathname);
  assert.ok(fixedPaths.includes("/"));
  assert.ok(fixedPaths.includes("/manifest.webmanifest"));
  assert.equal(fixedPaths.includes("/index.html"), false);
});

test("postdeployment smoke requires the exact marker and exposes only its fixed failure dimension", async () => {
  const clientIdName = ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_");
  const clientSecretName = ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_");
  await assert.rejects(
    runCloudflareUnattendedSmoke({
      dryRun: false,
      markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
      credentials: {
        [clientIdName]: "synthetic-client-id",
        [clientSecretName]: "synthetic-client-secret"
      },
      async fetchImpl() {
        return new Response(null, { status: 200 });
      }
    }),
    error => (
      error instanceof CloudflareUnattendedSmokeError
      && error.dimension === CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING
      && error.message.includes("http") === false
      && error.message.includes("/") === false
      && error.message.includes("200") === false
    )
  );
});

test("smoke redirects are rejected without a follow-up request", async () => {
  let calls = 0;
  await assert.rejects(
    runCloudflareUnattendedSmoke({
      dryRun: false,
      credentials: {
        [["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_")]: "synthetic-id",
        [["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_")]: "synthetic-secret"
      },
      async fetchImpl() {
        calls += 1;
        return new Response(null, {
          status: 302,
          headers: { Location: "https://example.invalid/blocked" }
        });
      }
    }),
    error => (
      error instanceof CloudflareUnattendedSmokeError
      && error.dimension === CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.REDIRECT_DENIED
      && error.message.includes("302") === false
      && error.message.includes("example.invalid") === false
    )
  );
  assert.equal(calls, 1);
});

test("smoke non-2xx and transport failures retain fixed nonsecret dimensions", async () => {
  const credentials = {
    [["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_")]: "synthetic-id",
    [["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_")]: "synthetic-secret"
  };
  const cases = [
    [
      async () => new Response(null, { status: 503 }),
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.HTTP_STATUS_REJECTED
    ],
    [
      async () => {
        throw new Error("sensitive transport detail");
      },
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED
    ]
  ];
  for (const [fetchImpl, dimension] of cases) {
    await assert.rejects(
      runCloudflareUnattendedSmoke({ dryRun: false, credentials, fetchImpl }),
      error => (
        error instanceof CloudflareUnattendedSmokeError
        && error.dimension === dimension
        && error.message.includes("503") === false
        && error.message.includes("sensitive") === false
      )
    );
  }
});

function validControl(overrides = {}) {
  return {
    schemaVersion: "cloudflare-unattended-deployment-control-v1",
    enabled: true,
    targetWorker: "prometheus-iq",
    environment: "production_private",
    authorizedCommit: "c".repeat(40),
    authorizedTree: "d".repeat(40),
    founderDirectiveId: "FOUNDER-DEPLOY-RUNTIME-GUARD-001",
    issuedAt: "2026-07-14T18:00:00.000Z",
    expiresAt: "2026-07-14T18:20:00.000Z",
    oneShotAuthorizationNonce: "synthetic-one-shot-nonce-000001",
    ...overrides
  };
}

const controlContext = Object.freeze({
  now: testNow,
  expectedCommit: "c".repeat(40),
  expectedTree: "d".repeat(40),
  expectedDirectiveId: "FOUNDER-DEPLOY-RUNTIME-GUARD-001"
});

test("Founder control rejects missing, OFF, malformed, expired, mismatched, and broad authorization", () => {
  assert.equal(validateFounderControl(validControl(), controlContext).valid, true);
  const cases = [
    [null, "control_missing_or_invalid"],
    [validControl({ enabled: false }), "control_off"],
    [validControl({ expiresAt: "2026-07-14T18:04:00.000Z" }), "expired"],
    [validControl({ targetWorker: "prometheusrouteiq-website" }), "wrong_target"],
    [validControl({ environment: "all" }), "wrong_environment"],
    [validControl({ authorizedCommit: "e".repeat(40) }), "commit_mismatch"],
    [validControl({ authorizedTree: "e".repeat(40) }), "tree_mismatch"],
    [validControl({ founderDirectiveId: " " }), "invalid_founder_directive"],
    [validControl({ founderDirectiveId: "FOUNDER-DIFFERENT-DIRECTIVE-001" }), "directive_mismatch"],
    [{ ...validControl(), methods: ["POST"] }, "control_shape_invalid"],
    [validControl({ expiresAt: "2026-07-14T19:00:00.000Z" }), "authorization_window_too_long"]
  ];
  for (const [control, reason] of cases) {
    assert.ok(validateFounderControl(control, controlContext).reasons.includes(reason));
  }
});

test("control file requires owner mode, rejects symlinks, and inspection does not consume", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-control-"));
  try {
    const controlPath = join(directory, "control.json");
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });
    const first = inspectFounderControlFile({ controlPath, ...controlContext });
    assert.equal(first.valid, true);
    assert.equal(existsSync(`${controlPath}.consumed`), false);

    chmodSync(controlPath, 0o644);
    assert.ok(inspectFounderControlFile({ controlPath, ...controlContext }).reasons.includes("control_wrong_mode"));
    chmodSync(controlPath, 0o600);

    const symlinkPath = join(directory, "control-link.json");
    symlinkSync(controlPath, symlinkPath);
    assert.ok(inspectFounderControlFile({
      controlPath: symlinkPath,
      ...controlContext
    }).reasons.includes("control_not_regular_file"));

    const duplicateKeyPath = join(directory, "control-duplicate-key.json");
    writeFileSync(
      duplicateKeyPath,
      `${JSON.stringify(validControl()).slice(0, -1)},\"enabled\":true}`,
      { mode: 0o600 }
    );
    assert.ok(inspectFounderControlFile({
      controlPath: duplicateKeyPath,
      ...controlContext
    }).reasons.includes("control_duplicate_or_nested_key"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("control rejects insecure parent, hardlink, FIFO, and symlink-parent paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-control-links-"));
  try {
    const controlPath = join(directory, "control.json");
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });

    const hardlinkPath = join(directory, "control-hardlink.json");
    linkSync(controlPath, hardlinkPath);
    assert.ok(inspectFounderControlFile({
      controlPath,
      ...controlContext
    }).reasons.includes("control_link_count_invalid"));

    rmSync(hardlinkPath);
    const fifoPath = join(directory, "control-fifo.json");
    const fifo = spawnSync("/usr/bin/mkfifo", [fifoPath], { stdio: "ignore" });
    assert.equal(fifo.status, 0);
    assert.ok(inspectFounderControlFile({
      controlPath: fifoPath,
      ...controlContext
    }).reasons.includes("control_not_regular_file"));

    chmodSync(directory, 0o755);
    assert.ok(inspectFounderControlFile({
      controlPath,
      ...controlContext
    }).reasons.includes("control_parent_wrong_mode"));
    chmodSync(directory, 0o700);

    const realParent = join(directory, "real-parent");
    const linkedParent = join(directory, "linked-parent");
    const realControl = join(realParent, "control.json");
    const mkdir = spawnSync("/bin/mkdir", ["-m", "700", realParent], { stdio: "ignore" });
    assert.equal(mkdir.status, 0);
    writeFileSync(realControl, JSON.stringify(validControl()), { mode: 0o600 });
    symlinkSync(realParent, linkedParent);
    assert.ok(inspectFounderControlFile({
      controlPath: join(linkedParent, "control.json"),
      ...controlContext
    }).reasons.includes("control_parent_invalid"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("one-shot control consumption is atomic and reused nonces fail closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-control-consume-"));
  try {
    const controlPath = join(directory, "control.json");
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });
    const consumed = consumeFounderControlFile({ controlPath, ...controlContext });
    assert.equal(consumed.consumed, true);
    assert.equal(readdirSync(`${controlPath}.consumed`).length, 1);
    assert.ok(inspectFounderControlFile({
      controlPath,
      ...controlContext
    }).reasons.includes("nonce_already_consumed"));
    assert.throws(
      () => consumeFounderControlFile({ controlPath, ...controlContext }),
      /nonce_already_consumed/u
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("concurrent consumers produce exactly one persistent nonce receipt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-control-race-"));
  try {
    const controlPath = join(directory, "control.json");
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });
    const moduleUrl = pathToFileURL(resolve(root, "scripts/lib/cloudflare-unattended-control.mjs")).href;
    const code = `
      import { consumeFounderControlFile } from ${JSON.stringify(moduleUrl)};
      try {
        consumeFounderControlFile({
          controlPath: process.argv[1],
          expectedCommit: process.argv[2],
          expectedTree: process.argv[3],
          now: new Date(process.argv[4])
        });
        process.exit(0);
      } catch {
        process.exit(1);
      }
    `;
    const run = () => new Promise(resolveClose => {
      const child = spawn(process.execPath, [
        "--input-type=module",
        "--eval",
        code,
        controlPath,
        controlContext.expectedCommit,
        controlContext.expectedTree,
        testNow.toISOString()
      ], { stdio: "ignore" });
      child.on("close", status => resolveClose(status));
    });
    const statuses = await Promise.all([run(), run()]);
    assert.deepEqual(statuses.sort(), [0, 1]);
    assert.equal(readdirSync(`${controlPath}.consumed`).length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("launcher presence and dry-run checks neither read values nor consume authorization", () => {
  let reads = 0;
  let spawns = 0;
  const keychain = {
    hasItem() { return false; },
    readItem() { reads += 1; return "not-used"; }
  };
  const presenceResult = runCloudflareUnattendedLauncher({ profile: "presence", root, keychain });
  const dryRunResult = runCloudflareUnattendedLauncher({ profile: "smoke-dry-run", root, keychain });
  assert.equal(presenceResult.controlConsumed, false);
  assert.equal(dryRunResult.controlConsumed, false);
  assert.equal(reads, 0);
  assert.equal(spawns, 0);
});

test("launcher pins the npm-supplied Wrangler version and executable path", () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const packageLock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const installed = JSON.parse(readFileSync(resolve(root, "node_modules/wrangler/package.json"), "utf8"));
  const expectedModule = resolve(root, CLOUDFLARE_UNATTENDED_WRANGLER_MODULE);

  assert.equal(packageJson.devDependencies.wrangler, CLOUDFLARE_UNATTENDED_WRANGLER_VERSION);
  assert.equal(
    packageLock.packages[""].devDependencies.wrangler,
    CLOUDFLARE_UNATTENDED_WRANGLER_VERSION
  );
  assert.equal(
    packageLock.packages["node_modules/wrangler"].version,
    CLOUDFLARE_UNATTENDED_WRANGLER_VERSION
  );
  assert.equal(installed.version, CLOUDFLARE_UNATTENDED_WRANGLER_VERSION);
  assert.equal(installed.bin.wrangler, "./bin/wrangler.js");
  assert.equal(realpathSync(resolve(root, "node_modules/.bin/wrangler")), expectedModule);
  assert.equal(realpathSync(expectedModule), expectedModule);
});

test("launcher consumes before fixed children and isolates deployment from smoke credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-launcher-"));
  const controlPath = join(directory, "control.json");
  const credentialNames = [
    ["CLOUDFLARE", "API", "TOKEN"].join("_"),
    ["CLOUDFLARE", "ACCOUNT", "ID"].join("_"),
    ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_"),
    ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_")
  ];
  const syntheticValues = Object.fromEntries(credentialNames.map((name, index) => [
    name,
    `synthetic-credential-${index + 1}`
  ]));
  const commands = [];
  try {
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });
    const result = runCloudflareUnattendedLauncher({
      profile: "deployment-release",
      root,
      controlPath,
      now: testNow,
      environment: {
        HOME: directory,
        PATH: process.env.PATH,
        NODE_OPTIONS: "--require /tmp/unapproved.js",
        PROMETHEUS_FOUNDER_DEPLOYMENT_DIRECTIVE_ID: "FOUNDER-DEPLOY-RUNTIME-GUARD-001",
        UNRELATED_SECRET: "must-not-pass"
      },
      keychain: {
        hasItem() { return true; },
        readItem(item) { return syntheticValues[item.account]; }
      },
      execFile(_file, args) {
        if (args[0] === "rev-parse" && args[1] === "HEAD") return `${"c".repeat(40)}\n`;
        if (args[0] === "rev-parse" && args[1] === "HEAD^{tree}") return `${"d".repeat(40)}\n`;
        if (args[0] === "status") return "";
        throw new Error("unexpected_git_command");
      },
      spawnChild(executable, args, options) {
        assert.equal(readdirSync(`${controlPath}.consumed`).length, 1);
        commands.push({ executable, args, options });
        return { status: 0 };
      }
    });
    assert.equal(result.controlConsumed, true);
    assert.equal(commands.length, 3);
    assert.match(commands[0].args[0], /node_modules\/wrangler\/bin\/wrangler\.js$/u);
    assert.deepEqual(commands[0].args.slice(1), ["deploy", "--dry-run", "--config", "wrangler.jsonc", "--keep-vars"]);
    assert.deepEqual(commands[1].args.slice(1), ["deploy", "--config", "wrangler.jsonc", "--keep-vars"]);
    assert.deepEqual(commands[2].args.slice(-1), ["--execute-fixed-profile"]);
    for (const command of commands) {
      assert.equal(command.options.stdio, "ignore");
      assert.equal(command.options.env.PATH, "/usr/bin:/bin:/usr/sbin:/sbin");
      assert.equal(Object.hasOwn(command.options.env, "UNRELATED_SECRET"), false);
      assert.equal(Object.hasOwn(command.options.env, "NODE_OPTIONS"), false);
    }
    for (const command of commands.slice(0, 2)) {
      assert.equal(command.options.env.CLOUDFLARE_API_TOKEN, syntheticValues.CLOUDFLARE_API_TOKEN);
      assert.equal(command.options.env.CLOUDFLARE_ACCOUNT_ID, syntheticValues.CLOUDFLARE_ACCOUNT_ID);
      assert.equal(Object.hasOwn(command.options.env, "CLOUDFLARE_ACCESS_CLIENT_ID"), false);
      assert.equal(Object.hasOwn(command.options.env, "CLOUDFLARE_ACCESS_CLIENT_SECRET"), false);
    }
    assert.equal(Object.hasOwn(commands[2].options.env, "CLOUDFLARE_API_TOKEN"), false);
    assert.equal(Object.hasOwn(commands[2].options.env, "CLOUDFLARE_ACCOUNT_ID"), false);
    assert.equal(commands[2].options.env.CLOUDFLARE_ACCESS_CLIENT_ID, syntheticValues.CLOUDFLARE_ACCESS_CLIENT_ID);
    assert.equal(commands[2].options.env.CLOUDFLARE_ACCESS_CLIENT_SECRET, syntheticValues.CLOUDFLARE_ACCESS_CLIENT_SECRET);
    const auditOutput = JSON.stringify(result);
    for (const value of Object.values(syntheticValues)) assert.equal(auditOutput.includes(value), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a failed fixed child burns the authorization and cannot be retried", () => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-launcher-burn-"));
  const controlPath = join(directory, "control.json");
  try {
    writeFileSync(controlPath, JSON.stringify(validControl()), { mode: 0o600 });
    assert.throws(() => runCloudflareUnattendedLauncher({
      profile: "smoke-read-only",
      root,
      controlPath,
      now: testNow,
      environment: {
        PROMETHEUS_FOUNDER_DEPLOYMENT_DIRECTIVE_ID: "FOUNDER-DEPLOY-RUNTIME-GUARD-001"
      },
      keychain: {
        hasItem() { return true; },
        readItem() { return "synthetic-value"; }
      },
      execFile(_file, args) {
        if (args[0] === "rev-parse" && args[1] === "HEAD") return `${"c".repeat(40)}\n`;
        if (args[0] === "rev-parse" && args[1] === "HEAD^{tree}") return `${"d".repeat(40)}\n`;
        if (args[0] === "status") return "";
        throw new Error("unexpected_git_command");
      },
      spawnChild() { return { status: 1 }; }
    }), /fixed_child_profile_failed/u);
    assert.ok(inspectFounderControlFile({
      controlPath,
      ...controlContext
    }).reasons.includes("nonce_already_consumed"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
