import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError,
  assertPublicRepositoryIdentity,
  formatPublicDeploymentFailure,
  verifyPublicRepositoryIntegrity
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";

function git(repository, argumentsList, { input, environment = {} } = {}) {
  const result = spawnSync("git", argumentsList, {
    cwd: repository,
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      ...environment
    }
  });
  assert.equal(result.status, 0, `fixture Git failed: ${argumentsList.join(" ")}\n${result.stderr}`);
  return String(result.stdout || "").trim();
}

function createRepository(parent, name = "repository") {
  const repository = join(parent, name);
  mkdirSync(repository);
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(join(repository, "record.txt"), "one\n", "utf8");
  git(repository, ["add", "record.txt"]);
  git(repository, [
    "-c", "user.name=Prometheus Integrity Test",
    "-c", "user.email=integrity-test@prometheus.local",
    "commit", "--quiet", "-m", "test: seed repository"
  ]);
  return repository;
}

function addCommit(repository, content = "two\n") {
  writeFileSync(join(repository, "record.txt"), content, "utf8");
  git(repository, ["add", "record.txt"]);
  git(repository, [
    "-c", "user.name=Prometheus Integrity Test",
    "-c", "user.email=integrity-test@prometheus.local",
    "commit", "--quiet", "-m", "test: extend repository"
  ]);
}

function expectIntegrityFailure(repository, classification) {
  assert.throws(
    () => verifyPublicRepositoryIntegrity(repository),
    error => error instanceof PublicDeploymentPolicyError
      && error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
      && error.diagnostics.some(value => value.includes(classification))
  );
}

test("full-history repositories pass strict release integrity", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-valid-"));
  try {
    const source = createRepository(fixture, "source");
    addCommit(source);
    git(source, ["branch", "verification-branch", "HEAD~1"]);
    git(source, ["tag", "verification-tag", "HEAD"]);
    const clone = join(fixture, "clone");
    git(fixture, ["clone", "--quiet", "--no-local", "--no-single-branch", `file://${source}`, clone]);
    const result = verifyPublicRepositoryIntegrity(clone);
    assert.equal(result.status, "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED");
    assert.equal(result.shallow, "false");
    assert.equal(result.objectFormat, "sha1");
    assert.equal(result.partialClone, false);
    assert.equal(result.promisor, false);
    assert.ok(result.refCount >= 3);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("benign dangling objects remain accepted by strict release integrity", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-dangling-"));
  try {
    const repository = createRepository(fixture);
    git(repository, ["hash-object", "-w", "--stdin"], { input: "unreferenced fixture\n" });
    assert.equal(
      verifyPublicRepositoryIntegrity(repository).status,
      "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED"
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("shallow, partial, and promisor repositories fail closed before qualification", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-incomplete-"));
  try {
    const source = createRepository(fixture, "source");
    addCommit(source);
    const shallow = join(fixture, "shallow");
    git(fixture, ["clone", "--quiet", "--depth=1", `file://${source}`, shallow]);
    expectIntegrityFailure(shallow, "SHALLOW_REPOSITORY");

    const partial = createRepository(fixture, "partial");
    git(partial, ["config", "extensions.partialClone", "origin"]);
    git(partial, ["config", "remote.origin.promisor", "true"]);
    expectIntegrityFailure(partial, "PARTIAL_OR_PROMISOR_REPOSITORY");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("missing and corrupt Git objects remain fatal with bounded classifications", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-object-"));
  try {
    const missing = createRepository(fixture, "missing");
    const missingObject = git(missing, ["rev-parse", "HEAD:record.txt"]);
    rmSync(join(missing, ".git", "objects", missingObject.slice(0, 2), missingObject.slice(2)));
    expectIntegrityFailure(missing, "MISSING_OBJECT");

    const corrupt = createRepository(fixture, "corrupt");
    const corruptObject = git(corrupt, ["rev-parse", "HEAD:record.txt"]);
    const corruptPath = join(
      corrupt,
      ".git",
      "objects",
      corruptObject.slice(0, 2),
      corruptObject.slice(2)
    );
    chmodSync(corruptPath, 0o600);
    writeFileSync(corruptPath, "corrupt fixture", "utf8");
    expectIntegrityFailure(corrupt, "CORRUPT_OBJECT");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("invalid refs and exact commit or tree identity substitutions fail closed", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-ref-"));
  try {
    const repository = createRepository(fixture);
    writeFileSync(join(repository, ".git", "refs", "heads", "invalid"), `${"f".repeat(40)}\n`, "utf8");
    expectIntegrityFailure(repository, "INVALID_REF");

    const head = git(repository, ["rev-parse", "HEAD"]);
    const tree = git(repository, ["rev-parse", "HEAD^{tree}"]);
    const identity = {
      head,
      tree,
      originMain: head,
      branch: "main",
      originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
      status: "",
      unstagedClean: true,
      stagedClean: true
    };
    assert.throws(
      () => assertPublicRepositoryIdentity(identity, {
        approvedCommit: "0".repeat(40),
        approvedTree: tree
      }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
    assert.throws(
      () => assertPublicRepositoryIdentity(identity, {
        approvedCommit: head,
        approvedTree: "0".repeat(40)
      }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck failures classify causes without leaking subprocess diagnostics", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-diagnostic-"));
  try {
    const repository = createRepository(fixture);
    let failure;
    try {
      verifyPublicRepositoryIntegrity(repository, {
        fsckRunner: (_command, argumentsList) => {
          assert.deepEqual(argumentsList, [
            "fsck",
            "--full",
            "--strict",
            "--no-dangling",
            "--no-progress"
          ]);
          return {
            status: 1,
            signal: null,
            error: undefined,
            stdout: `error: refs/heads/main: invalid sha1 pointer ${"f".repeat(40)}\nSECRET_VALUE=do-not-print`,
            stderr: "Authorization: Bearer do-not-print"
          };
        }
      });
    } catch (error) {
      failure = error;
    }
    assert.ok(failure instanceof PublicDeploymentPolicyError);
    assert.equal(failure.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
    assert.ok(failure.diagnostics.includes("GIT_FSCK_CLASSIFICATIONS=INVALID_REF"));
    const output = formatPublicDeploymentFailure(failure).join("\n");
    assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
    assert.match(output, /GIT_FSCK_STDOUT_BYTES=[0-9]+/u);
    assert.match(output, /GIT_FSCK_STDERR_BYTES=[0-9]+/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck capture overflow and unexpected success output fail closed without leakage", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-output-"));
  try {
    const repository = createRepository(fixture);
    for (const result of [
      {
        status: null,
        signal: null,
        error: Object.assign(new Error("secret overflow detail"), { code: "ENOBUFS" }),
        stdout: "SECRET_VALUE=do-not-print",
        stderr: "Authorization: Bearer do-not-print"
      },
      {
        status: 0,
        signal: null,
        error: undefined,
        stdout: "unexpected fsck output containing do-not-print",
        stderr: ""
      }
    ]) {
      let failure;
      try {
        verifyPublicRepositoryIntegrity(repository, { fsckRunner: () => result });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof PublicDeploymentPolicyError);
      assert.equal(failure.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
      const output = formatPublicDeploymentFailure(failure).join("\n");
      assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
      assert.match(output, /GIT_FSCK_CAPTURE_LIMIT_BYTES=131072/u);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("malformed object diagnostics remain fatal and sanitized", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-integrity-malformed-"));
  try {
    const repository = createRepository(fixture);
    assert.throws(
      () => verifyPublicRepositoryIntegrity(repository, {
        fsckRunner: () => ({
          status: 1,
          signal: null,
          error: undefined,
          stdout: "error in commit protected-value: missingTree: invalid format",
          stderr: ""
        })
      }),
      error => error instanceof PublicDeploymentPolicyError
        && error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
        && error.diagnostics.includes("GIT_FSCK_CLASSIFICATIONS=MALFORMED_OBJECT")
        && !formatPublicDeploymentFailure(error).join("\n").includes("protected-value")
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
