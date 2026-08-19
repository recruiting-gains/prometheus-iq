import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  materializePinnedPublicStatefulFiles,
  PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE,
  verifyPublicForwardRollbackArtifact,
  verifyPublicForwardRollbackBuildSource
} from "../scripts/lib/route-iq-public-forward-rollback.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rollbackContract = JSON.parse(readFileSync(
  join(root, "workers/infrastructure/route-iq-public-forward-rollback-v1.json"),
  "utf8"
));
const expectedArtifactSha256 =
  "a2cb4150124ff7569aa09cd50d60a12160ba52f2ef97b29967d92f494cb17f71";

function git(repository, argumentsList, options = {}) {
  return execFileSync("git", argumentsList, {
    cwd: repository,
    encoding: options.encoding || "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function cloneProvenance() {
  return JSON.parse(JSON.stringify(rollbackContract.candidateStatefulFiles));
}

function expectPinnedSourceFailure(candidateStatefulFiles) {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-public-pinned-failure-"));
  try {
    const destination = join(fixture, "materialized");
    mkdirSync(destination, { mode: 0o700 });
    assert.throws(
      () => materializePinnedPublicStatefulFiles(root, destination, candidateStatefulFiles),
      { message: "public_forward_rollback_pinned_source_invalid" }
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("public rollback build is pinned to the governed Infrastructure source snapshot", {
  timeout: 120_000
}, () => {
  const source = verifyPublicForwardRollbackBuildSource(root);
  assert.deepEqual(source, PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE);
  assert.equal(source.artifactSha256, expectedArtifactSha256);
  assert.equal(
    source.packageLockSha256,
    sha256(readFileSync(join(root, "package-lock.json")))
  );

  const currentWorker = git(root, ["show", "HEAD:workers/prometheus-iq-worker.js"]);
  const sourceWorker = git(root, [
    "show",
    `${source.commit}:workers/prometheus-iq-worker.js`
  ]);
  assert.notEqual(
    sha256(currentWorker),
    sha256(sourceWorker),
    "private HEAD drift must remain independent from the pinned public rollback build source"
  );
  assert.notEqual(
    sha256(sourceWorker),
    rollbackContract.candidateStatefulFiles["workers/prometheus-iq-worker.js"].sha256
  );
  assert.equal(
    verifyPublicForwardRollbackArtifact(root, expectedArtifactSha256).artifactSha256,
    expectedArtifactSha256
  );
});

test("a committed private HEAD drift cannot change the pinned public rollback artifact", {
  timeout: 120_000
}, () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-public-private-head-drift-"));
  const repository = join(fixture, "repository");
  try {
    git(root, ["clone", "--quiet", "--shared", root, repository]);
    symlinkSync(resolve(root, "node_modules"), join(repository, "node_modules"), "dir");
    const privateWorker = join(repository, "workers/prometheus-iq-worker.js");
    appendFileSync(privateWorker, "\n// private-only committed drift fixture\n", "utf8");
    git(repository, ["add", "--", "workers/prometheus-iq-worker.js"]);
    git(repository, [
      "-c", "user.name=Prometheus Infrastructure Test",
      "-c", "user.email=infrastructure-test@prometheus.local",
      "commit", "--quiet", "-m", "test: private-only drift"
    ]);
    assert.notEqual(
      git(repository, ["rev-parse", "HEAD"]).trim(),
      PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE.commit
    );
    assert.equal(
      verifyPublicForwardRollbackArtifact(repository, expectedArtifactSha256).artifactSha256,
      expectedArtifactSha256
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("pinned stateful provenance materializes exact regular blobs from governed commits", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-public-pinned-materialization-"));
  try {
    const destination = join(fixture, "materialized");
    mkdirSync(destination, { mode: 0o700 });
    const result = materializePinnedPublicStatefulFiles(
      root,
      destination,
      rollbackContract.candidateStatefulFiles
    );
    assert.equal(
      result.status,
      "PUBLIC_FORWARD_ROLLBACK_PINNED_STATEFUL_FILES_MATERIALIZED"
    );
    assert.equal(
      result.fileCount,
      Object.keys(rollbackContract.candidateStatefulFiles).length
    );
    for (const [path, provenance] of Object.entries(rollbackContract.candidateStatefulFiles)) {
      const materialized = join(destination, path);
      const stats = lstatSync(materialized);
      assert.equal(stats.isFile(), true);
      assert.equal(stats.isSymbolicLink(), false);
      assert.equal(stats.mode & 0o777, 0o600);
      assert.equal(sha256(readFileSync(materialized)), provenance.sha256);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("tampered provenance source commits and blob hashes fail closed", () => {
  const targetPath = "workers/infrastructure/route-iq-request-crm-runtime.js";

  const wrongSourceCommit = cloneProvenance();
  const governedSource = wrongSourceCommit[targetPath];
  const historicalSourceCommit = git(root, ["log", "--all", "--format=%H", "--", targetPath])
    .trim()
    .split("\n")
    .find(commit => commit !== governedSource.sourceCommit
      && sha256(git(root, ["show", `${commit}:${targetPath}`])) !== governedSource.sha256);
  assert.match(historicalSourceCommit || "", /^[0-9a-f]{40}$/u);
  wrongSourceCommit[targetPath].sourceCommit = historicalSourceCommit;
  expectPinnedSourceFailure(wrongSourceCommit);

  const missingSourceCommit = cloneProvenance();
  missingSourceCommit[targetPath].sourceCommit = "0".repeat(40);
  expectPinnedSourceFailure(missingSourceCommit);

  const wrongBlobHash = cloneProvenance();
  wrongBlobHash[targetPath].sha256 = "0".repeat(64);
  expectPinnedSourceFailure(wrongBlobHash);
});

test("a symlinked materialization ancestor is rejected without an outside write", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-public-pinned-symlink-"));
  try {
    const destination = join(fixture, "materialized");
    const outside = join(fixture, "outside");
    mkdirSync(destination, { mode: 0o700 });
    mkdirSync(outside, { mode: 0o700 });
    symlinkSync(outside, join(destination, "workers"), "dir");
    const workerOnly = {
      "workers/prometheus-iq-worker.js":
        rollbackContract.candidateStatefulFiles["workers/prometheus-iq-worker.js"]
    };
    assert.throws(
      () => materializePinnedPublicStatefulFiles(root, destination, workerOnly),
      { message: "public_forward_rollback_pinned_source_invalid" }
    );
    assert.equal(existsSync(join(outside, "prometheus-iq-worker.js")), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
