import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  evaluateFounderAttendedTtyCompatibilityGovernance,
  hasTtyPackageReleaseWiringSuccessor,
  verifyOverwatchFounderAttendedTtyCompatibility
} from "../scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson("overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.json");
const report = readJson("overwatch/reports/BATCH-20260715-001-cloudflare-founder-attended-real-macos-tty-compatibility.json");
const fullSystemHarmonyGovernance = readJson(
  "overwatch/governance/full-system-harmony-audit-v1.json"
);
const liveCanonicalIdentityGovernance = readJson(
  "overwatch/governance/live-canonical-identity-migration-v1.json"
);
const currentReadinessSuccessors = readJson(
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedTtyCompatibilityGovernance({ governance: nextGovernance, report: nextReport });

test("Overwatch verifies the owner-authored macOS TTY compatibility repair", () => {
  const result = verifyOverwatchFounderAttendedTtyCompatibility();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.focusedOwnerTests, 91);
  assert.equal(result.macOsPtyIntegration, "PASS");
  assert.equal(result.rejectedPathExternalActivity, 0);
  assert.equal(result.cloudflareAccessPerformed, false);
  assert.equal(result.realKeychainValuesAccessed, false);
});

test("TTY verification accepts only the exact current canonical package successor", () => {
  const currentPackageSha256 =
    liveCanonicalIdentityGovernance.releasePreparation.packageReleaseWiringSuccessor.currentSha256;
  assert.equal(hasTtyPackageReleaseWiringSuccessor({
    fullSystemHarmonyGovernance,
    liveCanonicalIdentityGovernance,
    currentReadinessSuccessors,
    currentPackageSha256
  }), true);

  const changedReadiness = clone(currentReadinessSuccessors);
  changedReadiness.overwatchCurrentEvidence.find(item => item.path === "package.json")
    .successorSha256 = "0".repeat(64);
  assert.equal(hasTtyPackageReleaseWiringSuccessor({
    fullSystemHarmonyGovernance,
    liveCanonicalIdentityGovernance,
    currentReadinessSuccessors: changedReadiness,
    currentPackageSha256
  }), false);
  assert.equal(hasTtyPackageReleaseWiringSuccessor({
    fullSystemHarmonyGovernance,
    liveCanonicalIdentityGovernance,
    currentReadinessSuccessors,
    currentPackageSha256: "0".repeat(64)
  }), false);
});

test("Overwatch rejects ownership, commit, or owner-evidence substitution", () => {
  const owner = clone(governance);
  owner.dispatchAudit.implementationOwner = "Prometheus Overwatch";
  owner.dispatchAudit.overwatchModifiedSubsystemImplementation = true;
  assert.equal(evaluate(owner).ok, false);

  const commit = clone(governance);
  commit.dispatchAudit.implementationCommit.commit = "0".repeat(40);
  assert.equal(evaluate(commit).ok, false);

  const evidence = clone(governance);
  evidence.infrastructureOwnerEvidence[0].sha256AtOwnerCommit = "0".repeat(64);
  assert.equal(evaluate(evidence).ok, false);
});

test("Overwatch rejects weakened TTY, phrase, or ordering boundaries", () => {
  for (const mutate of [
    value => { value.defectAndRepair.stdinIsTtyRequired = false; },
    value => { value.defectAndRepair.stdoutIsTtyRequired = false; },
    value => { value.defectAndRepair.stdinAndStdoutConcreteDeviceEqualityRequired = false; },
    value => { value.defectAndRepair.controllingTtyCharacterDeviceRequired = false; },
    value => { value.defectAndRepair.controllingTtyAliasRdevComparedToConcreteTerminal = true; },
    value => { value.defectAndRepair.promptAndResponseUseControllingTtyOnly = false; },
    value => { value.defectAndRepair.maximumConfirmationBytes = 1024; },
    value => { value.defectAndRepair.exactConfirmationRequired = false; },
    value => { value.defectAndRepair.confirmationPrecedesKeychainControlNetworkAndDownstreamActivity = false; },
    value => { value.defectAndRepair.productionBypassAdded = true; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects Cloudflare, Keychain, credential, deployment, or influence claims", () => {
  for (const [field, value] of [
    ["cloudflareAccessPerformed", true],
    ["realKeychainValuesAccessed", true],
    ["credentialCreatedOrRevoked", true],
    ["deploymentPerformed", true],
    ["productionMutationPerformed", true],
    ["prospectiveCollection", "ON"],
    ["cohortActivation", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = value;
    assert.equal(evaluate(changed).ok, false, field);
  }
});

test("Overwatch independently reruns the real macOS PTY alias probe", {
  skip: process.platform !== "darwin" || !existsSync("/usr/bin/expect")
}, () => {
  const childPath = join(root, "tests/fixtures/cloudflare-founder-attended-tty-macos-pty-child.mjs");
  const expectPath = join(root, "tests/fixtures/cloudflare-founder-attended-tty-macos-pty.expect");
  const result = spawnSync("/usr/bin/expect", [expectPath, process.execPath, childPath], {
    cwd: root,
    encoding: "utf8",
    env: {
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TERM: "xterm-256color",
      TMPDIR: "/tmp"
    },
    maxBuffer: 1024 * 1024,
    timeout: 10_000
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const match = result.stdout.match(/PROMETHEUS_MACOS_TTY_RESULT=(\{[^\r\n]+\})/u);
  assert.ok(match, result.stdout);
  assert.deepEqual(JSON.parse(match[1]), {
    stdinIsTTY: true,
    stdoutIsTTY: true,
    stdinCharacterDevice: true,
    stdoutCharacterDevice: true,
    controllingTtyCharacterDevice: true,
    streamRdevsEqual: true,
    controllingTtyAliasRdevDiffers: true,
    confirmed: true
  });
});
