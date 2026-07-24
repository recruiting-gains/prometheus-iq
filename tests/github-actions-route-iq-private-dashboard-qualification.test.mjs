import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildRouteIqPrivateDashboardQualification
} from "../scripts/run-route-iq-private-dashboard-qualification.mjs";
import {
  verifyGithubActionsRouteIqPrivateDashboardQualification
} from "../scripts/verify-github-actions-route-iq-private-dashboard-qualification.mjs";

const root = resolve(import.meta.dirname, "..");

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

test("private dashboard qualification workflow stays manual, secret-free, and non-deploying", () => {
  const result = verifyGithubActionsRouteIqPrivateDashboardQualification();
  assert.equal(result.status, "PASS");
});

test("qualification builder freezes exact commit/tree with rollback v3 digests", () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "route-iq-private-dashboard-qualification-"));
  try {
    const result = buildRouteIqPrivateDashboardQualification({
      environment: {
        PROMETHEUS_CANDIDATE_COMMIT: git(["rev-parse", "HEAD"]),
        PROMETHEUS_CANDIDATE_TREE: git(["rev-parse", "HEAD^{tree}"]),
        PROMETHEUS_BATCH_ID: "BATCH-20260723-001",
        PROMETHEUS_QUALIFIED_RELEASE_OUTPUT: outputDirectory
      }
    });
    assert.equal(result.status, "ROUTE_IQ_PRIVATE_DASHBOARD_QUALIFICATION_PASSED");
    assert.match(result.artifactSha256, /^[a-f0-9]{64}$/u);
    assert.match(result.manifestSha256, /^[a-f0-9]{64}$/u);
    const manifest = JSON.parse(readFileSync(join(
      outputDirectory,
      "route-iq-private-dashboard-qualification-manifest.json"
    ), "utf8"));
    assert.deepEqual(
      Object.keys(manifest.canonicalZipCoverageIntegration).sort(),
      [
        "customerPwaRuntime",
        "dashboardPlatform",
        "infrastructureAuthorization",
        "workspaceConfiguration"
      ]
    );
    for (const entry of Object.values(manifest.canonicalZipCoverageIntegration)) {
      assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
    }
    assert.match(manifest.deployParitySha256, /^[a-f0-9]{64}$/u);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
