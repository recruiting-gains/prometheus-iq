import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS,
  verifyCloudflareFounderAttendedGetOnlyRecovery,
  verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly
} from "../scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs";
import {
  verifyCloudflareFounderAttendedCreateReceiptV2
} from "../scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs";
import {
  verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation
} from "../scripts/verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_OVERWATCH_RELEASE_WIRING_PATHS,
  verifyCloudflareFounderAttendedResponseContractRepair,
  verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly
} from "../scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

function git(root, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function createSyntheticRepository(t, infrastructurePaths) {
  const root = mkdtempSync(join(tmpdir(), "prometheus-owner-verifier-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of infrastructurePaths) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `governed Infrastructure predecessor: ${path}\n`, "utf8");
  }
  writeFileSync(join(root, "package.json"), "{\"scripts\":{}}\n", "utf8");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Synthetic Infrastructure Test"]);
  git(root, ["config", "user.email", "synthetic-infrastructure-test@prometheus.local"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "synthetic baseline"]);
  return Object.freeze({ root, baseline: git(root, ["rev-parse", "HEAD"]) });
}

test("standalone Infrastructure owner verifier passes at the current repository version", () => {
  assert.equal(verifyCloudflareFounderAttendedGetOnlyRecovery().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedResponseContractRepair().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedCreateReceiptV2().status, "passed");
});

test("package release wiring is delegated without removing any Infrastructure predecessor", () => {
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS.includes("package.json"),
    false
  );
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS, [
    "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
    "scripts/helpers/cloudflare-founder-attended-keychain.swift",
    "scripts/lib/cloudflare-founder-attended-constants.mjs",
    "scripts/lib/cloudflare-founder-attended-control.mjs",
    "scripts/lib/cloudflare-founder-attended-keychain.mjs",
    "scripts/lib/cloudflare-founder-attended-service-token-production.mjs",
    "scripts/lib/cloudflare-founder-attended-service-token.mjs",
    "scripts/lib/cloudflare-founder-attended-tty.mjs",
    "scripts/run-cloudflare-founder-attended-service-token.mjs",
    "scripts/verify-cloudflare-founder-attended-service-token.mjs",
    "workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"
  ]);
});

test("delegated package drift passes while real Infrastructure predecessor drift fails", t => {
  const fixture = createSyntheticRepository(
    t,
    CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS
  );
  writeFileSync(
    join(fixture.root, "package.json"),
    "{\"scripts\":{\"overwatch\":\"accepted\"}}\n",
    "utf8"
  );
  assert.doesNotThrow(() =>
    verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline
    })
  );

  writeFileSync(
    join(fixture.root, "scripts/lib/cloudflare-founder-attended-service-token.mjs"),
    "tampered Infrastructure predecessor\n",
    "utf8"
  );
  assert.throws(() =>
    verifyCloudflareFounderAttendedRecoveryPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline
    })
  );
});

test("BATCH-003 delegates package drift and rejects Infrastructure predecessor drift", t => {
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_OVERWATCH_RELEASE_WIRING_PATHS,
    ["package.json"]
  );
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(
      "package.json"
    ),
    false
  );
  for (const path of CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_INFRASTRUCTURE_PREDECESSOR_PATHS) {
    assert.equal(
      CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS.includes(path),
      true
    );
  }
  const fixture = createSyntheticRepository(
    t,
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS
  );
  writeFileSync(
    join(fixture.root, "package.json"),
    "{\"scripts\":{\"overwatch\":\"accepted\"}}\n",
    "utf8"
  );
  assert.doesNotThrow(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline
    })
  );

  writeFileSync(
    join(fixture.root, "scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs"),
    "tampered BATCH-003 Infrastructure predecessor\n",
    "utf8"
  );
  assert.throws(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline
    })
  );
});

test("the exact standalone command succeeds without package or Overwatch mutation", () => {
  for (const script of [
    "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs",
    "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
    "scripts/verify-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
    "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs"
  ]) {
    const output = execFileSync(process.execPath, [script], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    assert.equal(JSON.parse(output).status, "passed");
  }
});
