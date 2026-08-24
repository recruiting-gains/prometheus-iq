import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const verifierPath = resolve(repositoryRoot, "scripts/verify-production-release.mjs");
const fixturePaths = [
  "_headers",
  "index.html",
  "sw.js",
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  "deploy/cloudflare-pages/_headers",
  "deploy/cloudflare-pages/index.html",
  "deploy/cloudflare-pages/manifest.webmanifest",
  "deploy/cloudflare-pages/sw.js",
  "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  "deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  "deploy/cloudflare-pages/intelligence/continuous-adaptive-route-replenishment.mjs",
  "deploy/cloudflare-pages/intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
  "deploy/cloudflare-pages/intelligence/contracts/operating-profile-contracts.json",
  "deploy/cloudflare-pages/intelligence/profiles/operating-profiles.json",
  "intelligence/continuous-adaptive-route-replenishment.mjs",
  "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
  "intelligence/contracts/operating-profile-contracts.json",
  "intelligence/profiles/operating-profiles.json"
];

function writeFixtureFile(root, path, value) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function runFixture(mutate = () => {}) {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "prometheus-production-release-"));
  try {
    for (const path of fixturePaths) {
      const target = resolve(fixtureRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(resolve(repositoryRoot, path), target);
    }
    mutate({
      read: path => readFileSync(resolve(fixtureRoot, path), "utf8"),
      write: (path, value) => writeFixtureFile(fixtureRoot, path, value)
    });
    return spawnSync(process.execPath, [
      verifierPath,
      "--local-only",
      "--skip-existing-gates",
      "--fixture-root",
      fixtureRoot
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" }
    });
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function mutateBothIndexes(fixture, mutate) {
  for (const path of ["index.html", "deploy/cloudflare-pages/index.html"]) {
    fixture.write(path, mutate(fixture.read(path)));
  }
}

test("production release verifier accepts the governed configuration-driven Dashboard", () => {
  const result = runFixture();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Production release verification: PASSED/u);
  assert.match(result.stdout, /"dashboardPlatformModuleAssetPath": "\.\/dashboard\/route-iq-dashboard-platform\.mjs\?paid-customer-preview-v1"/u);
  assert.match(result.stdout, /"legacyRuntimeDatasetConstantsPresent": false/u);
  assert.match(result.stdout, /"legacyRuntimePoolReferencePresent": false/u);
});

test("production release verifier declares only current mandatory gates and fails closed if one is absent", () => {
  const source = readFileSync(verifierPath, "utf8");
  assert.match(source, /\["existing security gate", "security:check"\]/u);
  assert.match(
    source,
    /\["current private runtime and workflow suite", "test:private"\]/u
  );
  assert.match(
    source,
    /\["existing zero live Google API gate", "verify:zero-google-api"\]/u
  );
  assert.doesNotMatch(
    source,
    /dashboard:runtime-pool:check|dashboard:runtime-workflows:check|intelligence:adaptive-route-replenishment:check/u
  );
  assert.match(source, /if \(!scripts\[scriptName\]\)/u);
  assert.match(source, /Required npm script is missing: \$\{scriptName\}/u);
  assert.doesNotMatch(source, /if \(scripts\[scriptName\]\)\s*runExistingGate/u);
});

test("production release verifier rejects restored legacy runtime-pool selection", () => {
  const result = runFixture(fixture => {
    mutateBothIndexes(fixture, source => source.replace(
      'const dashboardPlatformModulePath = "./dashboard/route-iq-dashboard-platform.mjs?paid-customer-preview-v1";',
      'const runtimeDatasetActivePath = "./data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";\n    const dashboardPlatformModulePath = "./dashboard/route-iq-dashboard-platform.mjs?paid-customer-preview-v1";'
    ));
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Generic Dashboard source must not declare legacy runtime-pool selection constants/u);
  assert.match(result.stdout, /Generic Dashboard source must not reference legacy runtime-pool catalogs/u);
});

test("production release verifier requires session-bound business-hours evidence", () => {
  const result = runFixture(fixture => {
    mutateBothIndexes(fixture, source => source.replace(
      'const businessHoursArtifactPath = routeIqCustomerPwaSession?.runtimeAssets.businessHours || "";',
      'const businessHoursArtifactPath = "./data/unscoped-business-hours.json";'
    ));
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Business-hours evidence is not derived from the authenticated session runtime assets/u);
});
