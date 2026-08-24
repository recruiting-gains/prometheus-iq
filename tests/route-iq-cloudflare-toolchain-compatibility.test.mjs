import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import Ajv from "ajv";
import { parse as parseJsonc, printParseErrorCode } from "jsonc-parser";

import { CLOUDFLARE_UNATTENDED_WRANGLER_VERSION } from "../scripts/lib/cloudflare-unattended-launcher.mjs";
import { PRIVATE_WORKER_DEPLOYMENT_POLICY } from "../scripts/lib/github-actions-private-worker-deployment.mjs";
import { PUBLIC_WORKER_DEPLOYMENT_POLICY } from "../scripts/lib/github-actions-public-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");
const readText = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(readText(path));
const readJsonc = path => {
  const errors = [];
  const value = parseJsonc(readText(path), errors, { allowTrailingComma: true });
  assert.deepEqual(
    errors,
    [],
    `${path}: ${errors.map(error => printParseErrorCode(error.error)).join(", ")}`
  );
  return value;
};

const contractPath =
  "workers/infrastructure/route-iq-cloudflare-toolchain-compatibility-v1.json";
const contract = readJson(contractPath);
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const testSuites = readJson("tests/test-suites.v1.json").suites;

const selectedVersions = Object.fromEntries(
  contract.selectedGraph.map(entry => [entry.package, entry.version])
);

test("selected Cloudflare toolchain graph is exact and normally resolved", () => {
  assert.deepEqual(selectedVersions, {
    wrangler: "4.120.1",
    miniflare: "5.20260804.0-alpha",
    workerd: "1.20260804.1",
    sharp: "0.35.2",
    undici: "7.29.0",
    ajv: "8.20.0",
    "jsonc-parser": "3.2.0"
  });
  assert.equal(packageJson.devDependencies.wrangler, selectedVersions.wrangler);
  assert.equal(packageJson.devDependencies.miniflare, selectedVersions.miniflare);
  assert.equal(packageJson.devDependencies.ajv, selectedVersions.ajv);
  assert.equal(packageJson.overrides, undefined);
  assert.equal(packageJson.resolutions, undefined);
  assert.equal(contract.normalResolution.forceUsed, false);
  assert.equal(contract.normalResolution.overridesUsed, false);
  assert.equal(contract.normalResolution.manualLockfileEditingUsed, false);

  for (const packageName of Object.keys(selectedVersions)) {
    const installed = readJson(`node_modules/${packageName}/package.json`);
    assert.equal(installed.version, selectedVersions[packageName], packageName);
    assert.equal(
      packageLock.packages[`node_modules/${packageName}`].version,
      selectedVersions[packageName],
      packageName
    );
  }

  assert.equal(
    packageLock.packages["node_modules/wrangler"].dependencies.miniflare,
    selectedVersions.miniflare
  );
  assert.equal(
    packageLock.packages["node_modules/wrangler"].dependencies.workerd,
    selectedVersions.workerd
  );
});

test("every active Infrastructure deployment consumer shares the governed Wrangler pin", () => {
  const expected = selectedVersions.wrangler;
  assert.equal(CLOUDFLARE_UNATTENDED_WRANGLER_VERSION, expected);
  assert.equal(PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion, expected);
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion, expected);

  const contractPins = [
    [
      "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json",
      contract => contract.auditedKeychainLauncher.pinnedWranglerVersion
    ],
    [
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
      contract => contract.qualification.wranglerVersion
    ],
    [
      "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
      contract => contract.wranglerFailureDiagnostics.wranglerVersion
    ],
    [
      "workers/infrastructure/github-actions-public-worker-deployment-v2.json",
      contract => contract.qualification.wranglerVersion
    ]
  ];
  for (const [path, select] of contractPins) {
    assert.equal(select(readJson(path)), expected, path);
  }

  for (const path of [
    "docs/cloudflare-unattended-deployment-access-v1.md",
    "docs/github-actions-public-worker-deployment-v2.md",
    "docs/route-iq-prospective-shadow-infrastructure-v1.md",
    "scripts/verify-cloudflare-unattended-access-architecture.mjs",
    "scripts/verify-cloudflare-unattended-runtime-guard.mjs"
  ]) {
    const source = readText(path);
    assert.ok(source.includes(expected), path);
    assert.equal(source.includes("4.110.0"), false, path);
  }
});

test("all four governed harnesses bind the official Miniflare v4 compatibility adapter", () => {
  for (const path of contract.harnessFiles) {
    const source = readText(path);
    const constructorCount = source.match(/new Miniflare\s*\(/gu)?.length ?? 0;
    const adaptedConstructorCount =
      source.match(/new Miniflare\s*\(\s*convertV4MiniflareOptions\s*\(/gu)?.length ?? 0;
    assert.ok(constructorCount > 0, path);
    assert.equal(adaptedConstructorCount, constructorCount, path);
    assert.match(
      source,
      /import \{ Miniflare, convertV4MiniflareOptions \} from "miniflare";/u,
      path
    );
  }
  assert.equal(contract.compatibilityGroup.adapter, "convertV4MiniflareOptions");
});

test("restart stores use v5 resource persistence while original assertions remain exact", () => {
  const business = readText("tests/route-iq-business-availability-infrastructure.test.mjs");
  const prospective = readText("tests/route-iq-prospective-shadow-infrastructure.test.mjs");

  for (const source of [business, prospective]) {
    assert.match(source, /resourcePersistencePath: persistencePath/u);
    assert.doesNotMatch(source, /durableObjectsPersist/u);
  }

  assert.match(
    business,
    /\[CRASH_BEFORE_CANONICAL, "noncanonical_crash_before_canonical", 0\]/u
  );
  assert.match(
    business,
    /\[CRASH_AFTER_CANONICAL, "noncanonical_crash_after_canonical", 1\]/u
  );
  assert.match(
    business,
    /\[CRASH_AFTER_PROJECTION_COMMIT, "noncanonical_crash_after_projection_commit", 1\]/u
  );
  assert.match(
    business,
    /assert\.equal\(beforeRetry\.body\.result\.acceptedSnapshots, acceptedAfterCrash\);/u
  );

  for (const name of [
    "real Miniflare seals the complete Intelligence lifecycle, links action, and persists restart state",
    "real Miniflare restart processes two same-session reconciliation links against their own exact projections",
    "real Miniflare SQLite allocator converges, closes, isolates scope, and survives restart"
  ]) {
    assert.ok(prospective.includes(`test("${name}"`), name);
  }
  assert.match(
    prospective,
    /admittedOutcomeCount: 2,[\s\S]*failedLinkCount: 2/u
  );
  assert.match(
    prospective,
    /assert\.deepEqual\(afterRestart\.body\.result, reopenedReceipt\);/u
  );
});

test("both Wrangler configs validate against the installed official schema", () => {
  const schema = readJson("node_modules/wrangler/config-schema.json");
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

  for (const path of contract.wranglerConfigs) {
    const config = readJsonc(path);
    const valid = validate(config);
    assert.equal(valid, true, `${path}: ${JSON.stringify(validate.errors)}`);
  }
});

test("the compatibility record explains each of the nine reproduced failures", () => {
  assert.equal(contract.priorRejectedCandidate.tests, 121);
  assert.equal(contract.priorRejectedCandidate.passed, 112);
  assert.equal(contract.priorRejectedCandidate.failed, 9);
  assert.equal(contract.priorFailureRootCauses.length, 9);
  assert.deepEqual(
    contract.priorFailureRootCauses.map(entry => entry.id),
    Array.from({ length: 9 }, (_, index) =>
      `prior-failure-${String(index + 1).padStart(2, "0")}`)
  );
  for (const entry of contract.priorFailureRootCauses) {
    for (const field of [
      "file",
      "test",
      "previousBehavior",
      "candidateBehavior",
      "rootCause",
      "upstreamChange",
      "repair",
      "protectionPreserved"
    ]) {
      assert.equal(typeof entry[field], "string", `${entry.id}.${field}`);
      assert.ok(entry[field].length > 0, `${entry.id}.${field}`);
    }
    assert.ok(entry.affectedSemantics.length > 0, `${entry.id}.affectedSemantics`);
  }
});

test("Node 24 action migration is classified and fail-closed outside this ownership scope", () => {
  assert.equal(
    contract.node24ActionMigration.classification,
    "valid-warning-deferred-cross-owner-successor"
  );
  assert.deepEqual(contract.node24ActionMigration.availableReplacements, [
    {
      action: "actions/checkout",
      version: "7.0.1",
      commit: "3d3c42e5aac5ba805825da76410c181273ba90b1",
      runsUsing: "node24"
    },
    {
      action: "actions/setup-node",
      version: "7.0.0",
      commit: "820762786026740c76f36085b0efc47a31fe5020",
      runsUsing: "node24"
    }
  ]);
  assert.equal(contract.node24ActionMigration.permissionsChanged, false);
  assert.equal(contract.node24ActionMigration.workflowFilesChanged, false);
});

test("the hosted suites retain the exact toolchain gate and governed harness", () => {
  const harnessScript = packageJson.scripts["infrastructure:cloudflare-toolchain-harness:check"];
  const batchScript = packageJson.scripts["infrastructure:cloudflare-toolchain-compatibility:check"];
  assert.equal(harnessScript, contract.compatibilityCommand);
  assert.equal(
    batchScript,
    "node --test tests/route-iq-cloudflare-toolchain-compatibility.test.mjs && npm run infrastructure:cloudflare-toolchain-harness:check"
  );
  assert.ok(testSuites.security.includes("tests/route-iq-cloudflare-toolchain-compatibility.test.mjs"));
  for (const file of [
    "tests/cloudflare-unattended-runtime-guard.test.mjs",
    "tests/route-iq-business-availability-infrastructure.test.mjs",
    "tests/route-iq-prospective-shadow-infrastructure.test.mjs",
    "tests/route-iq-request-crm-infrastructure.test.mjs"
  ]) assert.equal(Object.values(testSuites).flat().filter(candidate => candidate === file).length, 1);
  assert.equal(contract.compatibilityGroup.governedExistingTests, 121);
  assert.equal(contract.compatibilityGroup.requiredPasses, 121);
  assert.equal(contract.productionBoundary.cloudflareContactCount, 0);
  assert.equal(contract.productionBoundary.wranglerRemoteCommandCount, 0);
});
