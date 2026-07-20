import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError,
  assertPublicRepositoryIdentity,
  formatPublicDeploymentFailure,
  verifyPublicRepositoryIntegrity
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import {
  canonicalizeGeneratedWorkerSource,
  verifyPublicForwardRollbackArtifact
} from "../scripts/lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");

function git(repository, argumentsList, { input } = {}) {
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
      GIT_TERMINAL_PROMPT: "0"
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
    "-c", "user.name=Prometheus Infrastructure Test",
    "-c", "user.email=infrastructure-test@prometheus.local",
    "commit", "--quiet", "-m", "test: seed repository"
  ]);
  return repository;
}

function addCommit(repository, content = "two\n") {
  writeFileSync(join(repository, "record.txt"), content, "utf8");
  git(repository, ["add", "record.txt"]);
  git(repository, [
    "-c", "user.name=Prometheus Infrastructure Test",
    "-c", "user.email=infrastructure-test@prometheus.local",
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

test("valid and CI-equivalent full repositories pass exact strict integrity", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-valid-"));
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

test("benign dangling objects do not weaken or fail strict verification", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-dangling-"));
  try {
    const repository = createRepository(fixture);
    git(repository, ["hash-object", "-w", "--stdin"], { input: "unreferenced fixture\n" });
    assert.equal(verifyPublicRepositoryIntegrity(repository).status, "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("shallow and partial or promisor repositories fail closed before fsck", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-incomplete-"));
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

test("missing and corrupt objects remain fatal with bounded classifications", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-object-"));
  try {
    const missing = createRepository(fixture, "missing");
    const missingObject = git(missing, ["rev-parse", "HEAD:record.txt"]);
    rmSync(join(missing, ".git", "objects", missingObject.slice(0, 2), missingObject.slice(2)));
    expectIntegrityFailure(missing, "MISSING_OBJECT");

    const corrupt = createRepository(fixture, "corrupt");
    const corruptObject = git(corrupt, ["rev-parse", "HEAD:record.txt"]);
    const corruptPath = join(corrupt, ".git", "objects", corruptObject.slice(0, 2), corruptObject.slice(2));
    chmodSync(corruptPath, 0o600);
    writeFileSync(
      corruptPath,
      "corrupt fixture",
      "utf8"
    );
    expectIntegrityFailure(corrupt, "CORRUPT_OBJECT");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("invalid refs and exact identity mismatches remain fatal", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-ref-"));
  try {
    const repository = createRepository(fixture);
    writeFileSync(join(repository, ".git", "refs", "heads", "invalid"), `${"f".repeat(40)}\n`, "utf8");
    expectIntegrityFailure(repository, "INVALID_REF");

    const head = git(repository, ["rev-parse", "HEAD"]);
    const tree = git(repository, ["rev-parse", "HEAD^{tree}"]);
    assert.throws(
      () => assertPublicRepositoryIdentity({
        head,
        tree,
        originMain: head,
        branch: "main",
        originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
        status: "",
        unstagedClean: true,
        stagedClean: true
      }, { approvedCommit: "0".repeat(40), approvedTree: tree }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
    assert.throws(
      () => assertPublicRepositoryIdentity({
        head,
        tree,
        originMain: head,
        branch: "main",
        originUrl: "git@github.com:PrometheusRouteIQ/prometheus-iq.git",
        status: "",
        unstagedClean: true,
        stagedClean: true
      }, { approvedCommit: head, approvedTree: "0".repeat(40) }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck failure diagnostics classify causes without leaking subprocess content", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-diagnostic-"));
  try {
    const repository = createRepository(fixture);
    let error;
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
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof PublicDeploymentPolicyError);
    assert.equal(error.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
    assert.ok(error.diagnostics.includes("GIT_FSCK_CLASSIFICATIONS=INVALID_REF"));
    const output = formatPublicDeploymentFailure(error).join("\n");
    assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
    assert.match(output, /GIT_FSCK_STDOUT_BYTES=[0-9]+/u);
    assert.match(output, /GIT_FSCK_STDERR_BYTES=[0-9]+/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck capture overflow and unexpected successful output fail closed without content leakage", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-output-"));
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
      let error;
      try {
        verifyPublicRepositoryIntegrity(repository, { fsckRunner: () => result });
      } catch (caught) {
        error = caught;
      }
      assert.ok(error instanceof PublicDeploymentPolicyError);
      assert.equal(error.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
      const output = formatPublicDeploymentFailure(error).join("\n");
      assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
      assert.match(output, /GIT_FSCK_CAPTURE_LIMIT_BYTES=131072/u);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("malformed object diagnostics remain fatal and sanitized", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-malformed-"));
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

test("safe integrity workflow has no secret, environment, deployment, Cloudflare, or CRM write path", () => {
  const workflow = readFileSync(
    join(root, ".github", "workflows", "verify-prometheus-public-repository-integrity.yml"),
    "utf8"
  );
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /persist-credentials: false/u);
  for (const forbidden of [
    /\benvironment:/u,
    /\bsecrets\./u,
    /run-github-actions-public-worker-deployment/u,
    /\bwrangler\b/u,
    /api\.cloudflare\.com/u,
    /\bcurl\b/u,
    /\bPOST\b/u,
    /partner-intake/u
  ]) assert.doesNotMatch(workflow, forbidden);
});

test("unknown verification exceptions are not mislabeled as repository corruption", () => {
  assert.deepEqual(formatPublicDeploymentFailure(new Error("synthetic"), "verify"), [
    PUBLIC_DEPLOYMENT_FAILURE.PREFLIGHT_FAILED,
    "PREFLIGHT_DIAGNOSTIC=UNCLASSIFIED_INTERNAL_FAILURE"
  ]);
  assert.notEqual(
    formatPublicDeploymentFailure(new Error("synthetic"), "verify")[0],
    PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
  );
});

test("generated rollback worker comments canonicalize distinct checkout roots identically", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-rollback-paths-"));
  try {
    const results = [];
    for (const name of ["first", "second-longer-checkout-name"]) {
      const repository = join(fixture, name);
      const repositoryAlias = join(fixture, `${name}-alias`);
      const workspace = join(fixture, `${name}-workspace`);
      const generated = join(workspace, ".generated");
      const dependency = join(repository, "node_modules", "jose", "index.js");
      const runtime = join(workspace, "workers", "runtime.js");
      mkdirSync(dirname(dependency), { recursive: true });
      mkdirSync(dirname(runtime), { recursive: true });
      mkdirSync(generated, { recursive: true });
      writeFileSync(dependency, "export const dependency = true;\n", "utf8");
      writeFileSync(runtime, "export const runtime = true;\n", "utf8");
      symlinkSync(repository, repositoryAlias, "dir");
      const dependencyComment = relative(
        workspace,
        join(repositoryAlias, "node_modules", "jose", "index.js")
      ).split("\\").join("/");
      const runtimeComment = relative(workspace, runtime).split("\\").join("/");
      results.push(canonicalizeGeneratedWorkerSource(
        `// ${dependencyComment}\nconst dependency = true;\n\n// ${runtimeComment}\nconst runtime = true;\n`,
        { workspace, repositoryRoot: repository }
      ));
    }
    assert.equal(results[0], results[1]);
    assert.match(results[0], /^\/\/ node_modules\/jose\/index\.js/mu);
    assert.match(results[0], /^\/\/ workspace\/workers\/runtime\.js/mu);
    assert.doesNotMatch(results[0], /first|second-longer-checkout-name/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("rollback mismatch reports rollback failure rather than repository integrity", () => {
  assert.throws(
    () => verifyPublicForwardRollbackArtifact(root, "0".repeat(64)),
    error => error instanceof PublicDeploymentPolicyError
      && error.code === PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID
      && error.diagnostics.includes("ROLLBACK_DIAGNOSTIC=ARTIFACT_HASH_MISMATCH")
  );
});
