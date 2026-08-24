import test from "node:test";
import assert from "node:assert/strict";

import {
  EARLY_GITHUB_HANDOFF_FAILURE,
  EARLY_GITHUB_HANDOFF_STATUS,
  EarlyGithubHandoffError,
  createGithubActionsApi,
  dispatchEarlyGithubHandoff,
  earlyGithubHandoffFailureLines,
  earlyGithubHandoffStatusLines,
  validateEarlyGithubHandoffRequest,
  verifyEarlyGithubHandoffRepository
} from "../scripts/lib/early-github-handoff-v1.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const baseRequest = Object.freeze({
  repository: "PrometheusRouteIQ/prometheus-iq",
  workflow: "early-github-handoff-v1.yml",
  branch: "main",
  commit,
  tree,
  inputs: {},
  registrationTimeoutMs: 10,
  pollIntervalMs: 5
});
const repositoryState = Object.freeze({
  head: commit,
  tree,
  origin: commit,
  branch: "main",
  clean: true,
  localWorkRemaining: false
});

function runFixture(overrides = {}) {
  return {
    id: 123456789,
    html_url: "https://github.com/PrometheusRouteIQ/prometheus-iq/actions/runs/123456789",
    event: "workflow_dispatch",
    head_sha: commit,
    head_branch: "main",
    path: ".github/workflows/early-github-handoff-v1.yml",
    created_at: new Date(1_000).toISOString(),
    ...overrides
  };
}

function expectCode(promise, code) {
  return assert.rejects(promise, error =>
    error instanceof EarlyGithubHandoffError && error.code === code);
}

test("exact commit and tree are injected and conflicting inputs are rejected", () => {
  assert.equal(
    validateEarlyGithubHandoffRequest(baseRequest).inputs.candidate_commit,
    commit
  );
  assert.equal(
    validateEarlyGithubHandoffRequest(baseRequest).inputs.candidate_tree,
    tree
  );
  assert.throws(
    () => validateEarlyGithubHandoffRequest({
      ...baseRequest,
      inputs: { candidate_commit: "b".repeat(40) }
    }),
    error => error.code === EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID
  );
  assert.throws(
    () => validateEarlyGithubHandoffRequest({
      ...baseRequest,
      inputs: { candidate_tree: "c".repeat(40) }
    }),
    error => error.code === EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID
  );
});

test("missing commit or tree and a mismatched repository tree fail closed", () => {
  for (const field of ["commit", "tree"]) {
    const request = { ...baseRequest };
    delete request[field];
    assert.throws(
      () => validateEarlyGithubHandoffRequest(request),
      error => error.code === EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID
    );
  }
  assert.throws(
    () => verifyEarlyGithubHandoffRepository({
      cwd: "/synthetic",
      branch: "main",
      commit,
      tree,
      git: (_cwd, args) => ({
        "rev-parse HEAD": commit,
        "rev-parse HEAD^{tree}": "c".repeat(40),
        "branch --show-current": "main",
        "rev-parse refs/remotes/origin/main": commit,
        "status --porcelain=v1 --untracked-files=all": "",
        "config --list": "remote.origin.url=git@github.com:PrometheusRouteIQ/prometheus-iq.git"
      })[args.join(" ")]
    }),
    error => error.code === EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID
  );
});

test("valid exact commit and tree arguments are accepted", () => {
  const validated = validateEarlyGithubHandoffRequest(baseRequest);
  assert.equal(validated.commit, commit);
  assert.equal(validated.tree, tree);
  assert.equal(validated.inputs.candidate_commit, commit);
  assert.equal(validated.inputs.candidate_tree, tree);
});

test("successful dispatch returns one exact registered run and close status", async () => {
  const result = await dispatchEarlyGithubHandoff({
    request: baseRequest,
    repositoryState,
    clock: () => 1_000,
    sleep: async () => {},
    api: {
      dispatch: async () => {},
      listRuns: async () => [runFixture()]
    }
  });
  assert.equal(result.status, "REGISTERED");
  assert.deepEqual(earlyGithubHandoffStatusLines(result), [
    EARLY_GITHUB_HANDOFF_STATUS.CONFIRMED,
    "RUN ID 123456789",
    "RUN URL https://github.com/PrometheusRouteIQ/prometheus-iq/actions/runs/123456789",
    EARLY_GITHUB_HANDOFF_STATUS.CLOSE
  ]);
});

test("accepted dispatch with delayed registration returns the governed pending status", async () => {
  let now = 1_000;
  const result = await dispatchEarlyGithubHandoff({
    request: baseRequest,
    repositoryState,
    clock: () => now,
    sleep: async milliseconds => { now += milliseconds; },
    api: {
      dispatch: async () => {},
      listRuns: async () => []
    }
  });
  assert.equal(result.status, "REGISTRATION_PENDING");
  assert.deepEqual(earlyGithubHandoffStatusLines(result), [
    EARLY_GITHUB_HANDOFF_STATUS.PENDING,
    EARLY_GITHUB_HANDOFF_STATUS.CLOSE
  ]);
});

test("dispatch rejection fails closed without premature close status", async () => {
  const error = new EarlyGithubHandoffError(
    EARLY_GITHUB_HANDOFF_FAILURE.DISPATCH_REJECTED
  );
  await expectCode(dispatchEarlyGithubHandoff({
    request: baseRequest,
    repositoryState,
    clock: () => 1_000,
    api: {
      dispatch: async () => { throw error; },
      listRuns: async () => []
    }
  }), EARLY_GITHUB_HANDOFF_FAILURE.DISPATCH_REJECTED);
  const lines = earlyGithubHandoffFailureLines(error);
  assert.equal(lines[0], EARLY_GITHUB_HANDOFF_STATUS.LOCAL_REQUIRED);
  assert.equal(lines.includes(EARLY_GITHUB_HANDOFF_STATUS.CLOSE), false);
});

test("multiple exact run matches are rejected as ambiguous", async () => {
  await expectCode(dispatchEarlyGithubHandoff({
    request: baseRequest,
    repositoryState,
    clock: () => 1_000,
    api: {
      dispatch: async () => {},
      listRuns: async () => [runFixture(), runFixture({ id: 123456790 })]
    }
  }), EARLY_GITHUB_HANDOFF_FAILURE.RUN_AMBIGUOUS);
});

test("authentication failure emits only a fixed nonsecret classification", async () => {
  const secret = "never-display-this-token";
  const api = createGithubActionsApi({
    token: secret,
    fetchImpl: async () => ({ status: 401 })
  });
  let failure;
  try {
    await api.dispatch(baseRequest);
  } catch (error) {
    failure = error;
  }
  const output = earlyGithubHandoffFailureLines(failure).join("\n");
  assert.match(output, /EARLY_GITHUB_HANDOFF_AUTHENTICATION_FAILED/u);
  assert.doesNotMatch(output, new RegExp(secret, "u"));
  assert.doesNotMatch(output, /FOUNDER MAY CLOSE LAPTOP/u);
});

test("local work or unsynchronized origin prohibits premature close status", async () => {
  await expectCode(dispatchEarlyGithubHandoff({
    request: baseRequest,
    repositoryState: { ...repositoryState, localWorkRemaining: true },
    api: { dispatch: async () => {}, listRuns: async () => [] }
  }), EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID);

  const responses = new Map([
    ["rev-parse HEAD", commit],
    ["rev-parse HEAD^{tree}", tree],
    ["branch --show-current", "main"],
    ["rev-parse refs/remotes/origin/main", "b".repeat(40)],
    ["status --porcelain=v1 --untracked-files=all", ""],
    ["config --list", "remote.origin.url=git@github.com:PrometheusRouteIQ/prometheus-iq.git"]
  ]);
  assert.throws(
    () => verifyEarlyGithubHandoffRepository({
      cwd: "/synthetic",
      branch: "main",
      commit,
      tree,
      git: (_cwd, args) => responses.get(args.join(" "))
    }),
    error => error.code === EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID
  );
});
