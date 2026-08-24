import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_CI_PORTABILITY_SUCCESSOR,
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR,
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

function gitBytes(root, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"]
  });
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

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function createSyntheticFixtureSuccessor(fixture, { extraPath = null } = {}) {
  const transitions = CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR.transitions;
  for (const transition of transitions) {
    writeFileSync(
      join(fixture.root, transition.path),
      `authenticated Infrastructure successor: ${transition.path}\n`,
      "utf8"
    );
  }
  if (extraPath) {
    const absolute = join(fixture.root, extraPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, "unauthorized extra successor path\n", "utf8");
  }
  git(fixture.root, ["add", "."]);
  git(fixture.root, ["commit", "--quiet", "-m", "synthetic owner successor"]);
  const commit = git(fixture.root, ["rev-parse", "HEAD"]);
  const metadata = git(fixture.root, [
    "show",
    "-s",
    "--format=%T%x00%P%x00%an%x00%ae%x00%cn%x00%ce%x00%s%x00%aI%x00%cI",
    commit
  ]).split("\0");
  return Object.freeze({
    commit,
    tree: metadata[0],
    parent: metadata[1],
    authorName: metadata[2],
    authorEmail: metadata[3],
    committerName: metadata[4],
    committerEmail: metadata[5],
    subject: metadata[6],
    authoredAt: metadata[7],
    committedAt: metadata[8],
    transitions: transitions.map(transition => Object.freeze({
      status: "M",
      path: transition.path,
      beforeSha256: sha256(gitBytes(fixture.root, [
        "show",
        `${fixture.baseline}:${transition.path}`
      ])),
      afterSha256: sha256(gitBytes(fixture.root, [
        "show",
        `${commit}:${transition.path}`
      ]))
    }))
  });
}

test("standalone Infrastructure owner verifier passes at the current repository version", () => {
  assert.equal(verifyCloudflareFounderAttendedGetOnlyRecovery().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedResponseContractRepair().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedFreshAttemptEvidenceRotation().status, "passed");
  assert.equal(verifyCloudflareFounderAttendedCreateReceiptV2().status, "passed");
});

test("active Founder-attended verification is pinned to its exact Infrastructure successor", () => {
  const scriptPath = "scripts/verify-cloudflare-founder-attended-service-token.mjs";
  const baseline = "c7119fcee140ab8a130cdb888439277fdcbeb6b0";
  const successor = "b01d1851def2ef771d8f7c5936df8f51f120010f";
  assert.equal(
    git(repositoryRoot, ["rev-parse", `${baseline}:${scriptPath}`]),
    "8c9d8dab6de93f32a45ab278f8695ce33af32ed3"
  );
  assert.equal(
    git(repositoryRoot, ["rev-parse", `${successor}:${scriptPath}`]),
    "dc0d00f537ac8246beaebe661f0ea3dea206842a"
  );
  assert.equal(
    git(repositoryRoot, ["hash-object", scriptPath]),
    "dc0d00f537ac8246beaebe661f0ea3dea206842a"
  );
  assert.doesNotThrow(() => git(repositoryRoot, [
    "merge-base", "--is-ancestor", successor, "HEAD"
  ]));
  assert.deepEqual(
    git(repositoryRoot, [
      "show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce", successor
    ]).split("\0"),
    [
      "Prometheus Infrastructure",
      "infrastructure@prometheus.local",
      "Prometheus Infrastructure",
      "infrastructure@prometheus.local"
    ]
  );

  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["infrastructure:cloudflare-founder-attended:check"],
    `node ${scriptPath}`
  );
  const securitySource = readFileSync(join(repositoryRoot, "scripts/security-check.mjs"), "utf8");
  assert.match(
    securitySource,
    /verifyCloudflareFounderAttendedServiceTokenArchitecture[\s\S]*from "\.\/verify-cloudflare-founder-attended-service-token\.mjs"/u
  );
  assert.match(
    securitySource,
    /verifyCloudflareFounderAttendedServiceTokenArchitecture\(\);/u
  );
});

test("response-contract verifier pins the exact Keychain CI portability successor", () => {
  assert.equal(
    CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_CI_PORTABILITY_SUCCESSOR.commit,
    "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b"
  );
  assert.deepEqual(
    CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_CI_PORTABILITY_SUCCESSOR.transitions.map(
      transition => transition.path
    ),
    [
      "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
      "tests/cloudflare-unattended-keychain-interoperability.test.mjs"
    ]
  );
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
    [...new Set([
      ...CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS,
      ...CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR.transitions.map(
        transition => transition.path
      )
    ])]
  );
  const expectedOwnerSuccessor = createSyntheticFixtureSuccessor(fixture);
  writeFileSync(
    join(fixture.root, "package.json"),
    "{\"scripts\":{\"overwatch\":\"accepted\"}}\n",
    "utf8"
  );
  assert.doesNotThrow(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline,
      expectedOwnerSuccessor,
      expectedCurrentSuccessor: null
    })
  );
  assert.throws(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline,
      expectedOwnerSuccessor: {
        ...expectedOwnerSuccessor,
        authorEmail: "wrong-owner@prometheus.local"
      },
      expectedCurrentSuccessor: null
    })
  );
  assert.throws(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: fixture.root,
      expectedBaselineCommit: fixture.baseline,
      expectedOwnerSuccessor: {
        ...expectedOwnerSuccessor,
        transitions: expectedOwnerSuccessor.transitions.map((transition, index) => ({
          ...transition,
          afterSha256: index === 0 ? "0".repeat(64) : transition.afterSha256
        }))
      },
      expectedCurrentSuccessor: null
    })
  );

  const extraFixture = createSyntheticRepository(
    t,
    [...new Set([
      ...CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_INFRASTRUCTURE_PREDECESSOR_PATHS,
      ...CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_FIXTURE_OWNER_SUCCESSOR.transitions.map(
        transition => transition.path
      )
    ])]
  );
  const extraSuccessor = createSyntheticFixtureSuccessor(extraFixture, {
    extraPath: "tests/unauthorized-extra-successor.test.mjs"
  });
  assert.throws(() =>
    verifyCloudflareFounderAttendedResponseContractPredecessorImmutabilityTestOnly({
      repositoryRoot: extraFixture.root,
      expectedBaselineCommit: extraFixture.baseline,
      expectedOwnerSuccessor: extraSuccessor,
      expectedCurrentSuccessor: null
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
      expectedBaselineCommit: fixture.baseline,
      expectedOwnerSuccessor,
      expectedCurrentSuccessor: null
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
