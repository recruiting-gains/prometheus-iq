import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export const EARLY_GITHUB_HANDOFF_POLICY = Object.freeze({
  repository: "PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  workflow: "early-github-handoff-v1.yml",
  workflowPath: ".github/workflows/early-github-handoff-v1.yml",
  commitInput: "candidate_commit",
  treeInput: "candidate_tree",
  registrationTimeoutMs: 30_000,
  pollIntervalMs: 2_000,
  timestampToleranceMs: 5_000
});

export const EARLY_GITHUB_HANDOFF_STATUS = Object.freeze({
  CONFIRMED: "GITHUB HANDOFF CONFIRMED",
  PENDING: "GITHUB DISPATCH ACCEPTED — RUN REGISTRATION PENDING",
  CLOSE: "FOUNDER MAY CLOSE LAPTOP",
  LOCAL_REQUIRED: "LOCAL CONNECTION STILL REQUIRED"
});

export const EARLY_GITHUB_HANDOFF_FAILURE = Object.freeze({
  INPUT_INVALID: "EARLY_GITHUB_HANDOFF_INPUT_INVALID",
  REPOSITORY_INVALID: "EARLY_GITHUB_HANDOFF_REPOSITORY_INVALID",
  AUTHENTICATION_FAILED: "EARLY_GITHUB_HANDOFF_AUTHENTICATION_FAILED",
  DISPATCH_REJECTED: "EARLY_GITHUB_HANDOFF_DISPATCH_REJECTED",
  RUN_AMBIGUOUS: "EARLY_GITHUB_HANDOFF_RUN_AMBIGUOUS",
  RUN_RESPONSE_INVALID: "EARLY_GITHUB_HANDOFF_RUN_RESPONSE_INVALID"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]+$/u;
const SAFE_WORKFLOW = /^[A-Za-z0-9._/-]+\.ya?ml$/u;
const SECRET_NAME = /(?:AUTHORIZATION|COOKIE|CREDENTIAL|PASSWORD|PRIVATE_KEY|SECRET|TOKEN)/iu;

export class EarlyGithubHandoffError extends Error {
  constructor(code) {
    super(code);
    this.name = "EarlyGithubHandoffError";
    this.code = code;
  }
}

function fail(code) {
  throw new EarlyGithubHandoffError(code);
}

function exactObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateInputs(inputs, commit, tree) {
  if (!exactObject(inputs)) fail(EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID);
  const normalized = {};
  for (const [name, value] of Object.entries(inputs)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(name)
      || SECRET_NAME.test(name)
      || typeof value !== "string"
      || value.length > 4096
      || /[\u0000-\u001f\u007f]/u.test(value)) {
      fail(EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID);
    }
    normalized[name] = value;
  }
  if (normalized[EARLY_GITHUB_HANDOFF_POLICY.commitInput] !== undefined
    && normalized[EARLY_GITHUB_HANDOFF_POLICY.commitInput] !== commit) {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID);
  }
  if (normalized[EARLY_GITHUB_HANDOFF_POLICY.treeInput] !== undefined
    && normalized[EARLY_GITHUB_HANDOFF_POLICY.treeInput] !== tree) {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID);
  }
  normalized[EARLY_GITHUB_HANDOFF_POLICY.commitInput] = commit;
  normalized[EARLY_GITHUB_HANDOFF_POLICY.treeInput] = tree;
  return Object.freeze(normalized);
}

export function validateEarlyGithubHandoffRequest(value) {
  if (!exactObject(value)
    || !SAFE_REPOSITORY.test(value.repository || "")
    || !SAFE_WORKFLOW.test(value.workflow || "")
    || !SAFE_BRANCH.test(value.branch || "")
    || !SHA40.test(value.commit || "")
    || !SHA40.test(value.tree || "")
    || !Number.isInteger(value.registrationTimeoutMs)
    || value.registrationTimeoutMs < 0
    || value.registrationTimeoutMs > 120_000
    || !Number.isInteger(value.pollIntervalMs)
    || value.pollIntervalMs < 1
    || value.pollIntervalMs > 10_000) {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.INPUT_INVALID);
  }
  return Object.freeze({
    repository: value.repository,
    workflow: value.workflow,
    branch: value.branch,
    commit: value.commit,
    tree: value.tree,
    inputs: validateInputs(value.inputs || {}, value.commit, value.tree),
    registrationTimeoutMs: value.registrationTimeoutMs,
    pollIntervalMs: value.pollIntervalMs
  });
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) fail(EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID);
  return String(result.stdout || "").trim();
}

export function verifyEarlyGithubHandoffRepository({
  cwd,
  branch,
  commit,
  tree: expectedTree,
  git = runGit
}) {
  const head = git(cwd, ["rev-parse", "HEAD"]);
  const tree = git(cwd, ["rev-parse", "HEAD^{tree}"]);
  const currentBranch = git(cwd, ["branch", "--show-current"]);
  const origin = git(cwd, ["rev-parse", `refs/remotes/origin/${branch}`]);
  const status = git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const gitConfiguration = git(cwd, ["config", "--list"]);
  const pushRefspec = gitConfiguration.split("\n")
    .filter(line => line.startsWith("remote.origin.push="))
    .join("\n");
  if (head !== commit || tree !== expectedTree || currentBranch !== branch || origin !== commit
    || status !== "" || /(?:--all|--mirror|refs\/heads\/\*:|refs\/\*)/u.test(pushRefspec)) {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID);
  }
  return Object.freeze({
    head,
    tree,
    branch: currentBranch,
    origin,
    clean: true,
    localWorkRemaining: false
  });
}

function workflowIdentityMatches(run, workflow) {
  const path = typeof run.path === "string" ? run.path : "";
  return basename(path) === basename(workflow);
}

export function matchingWorkflowRuns({
  runs,
  workflow,
  branch,
  commit,
  dispatchedAt,
  now
}) {
  if (!Array.isArray(runs)) fail(EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID);
  const earliest = dispatchedAt - EARLY_GITHUB_HANDOFF_POLICY.timestampToleranceMs;
  const latest = now + EARLY_GITHUB_HANDOFF_POLICY.timestampToleranceMs;
  return runs.filter(run => {
    const createdAt = Date.parse(run?.created_at || "");
    return Number.isFinite(createdAt)
      && createdAt >= earliest
      && createdAt <= latest
      && run.event === "workflow_dispatch"
      && run.head_sha === commit
      && run.head_branch === branch
      && workflowIdentityMatches(run, workflow)
      && Number.isSafeInteger(run.id)
      && typeof run.html_url === "string"
      && run.html_url.startsWith("https://github.com/");
  });
}

function authenticationFailure(status) {
  return status === 401 || status === 403;
}

export function createGithubActionsApi({ token, fetchImpl = globalThis.fetch }) {
  if (typeof token !== "string" || token.length < 1 || typeof fetchImpl !== "function") {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.AUTHENTICATION_FAILED);
  }
  const request = async (url, options = {}) => fetchImpl(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  return Object.freeze({
    async dispatch({ repository, workflow, branch, inputs }) {
      const response = await request(
        `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: branch, inputs })
        }
      );
      if (authenticationFailure(response.status)) {
        fail(EARLY_GITHUB_HANDOFF_FAILURE.AUTHENTICATION_FAILED);
      }
      if (response.status !== 204) fail(EARLY_GITHUB_HANDOFF_FAILURE.DISPATCH_REJECTED);
    },
    async listRuns({ repository, workflow, branch }) {
      const query = new URLSearchParams({
        event: "workflow_dispatch",
        branch,
        per_page: "100"
      });
      const response = await request(
        `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs?${query}`
      );
      if (authenticationFailure(response.status)) {
        fail(EARLY_GITHUB_HANDOFF_FAILURE.AUTHENTICATION_FAILED);
      }
      if (response.status !== 200) fail(EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID);
      let body;
      try {
        body = await response.json();
      } catch {
        fail(EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID);
      }
      if (!exactObject(body) || !Array.isArray(body.workflow_runs)) {
        fail(EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID);
      }
      return body.workflow_runs;
    }
  });
}

export async function dispatchEarlyGithubHandoff({
  request,
  api,
  repositoryState,
  clock = () => Date.now(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
  const validated = validateEarlyGithubHandoffRequest(request);
  if (repositoryState?.localWorkRemaining !== false
    || repositoryState?.clean !== true
    || repositoryState?.head !== validated.commit
    || repositoryState?.tree !== validated.tree
    || repositoryState?.origin !== validated.commit
    || repositoryState?.branch !== validated.branch) {
    fail(EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID);
  }
  const dispatchedAt = clock();
  await api.dispatch(validated);
  const deadline = dispatchedAt + validated.registrationTimeoutMs;
  do {
    const now = clock();
    const runs = await api.listRuns(validated);
    const matches = matchingWorkflowRuns({
      runs,
      workflow: validated.workflow,
      branch: validated.branch,
      commit: validated.commit,
      dispatchedAt,
      now
    });
    if (matches.length > 1) fail(EARLY_GITHUB_HANDOFF_FAILURE.RUN_AMBIGUOUS);
    if (matches.length === 1) {
      return Object.freeze({
        status: "REGISTERED",
        runId: matches[0].id,
        runUrl: matches[0].html_url,
        dispatchAccepted: true,
        localWorkRemaining: false
      });
    }
    if (now >= deadline) break;
    await sleep(Math.min(validated.pollIntervalMs, Math.max(0, deadline - now)));
  } while (true);
  return Object.freeze({
    status: "REGISTRATION_PENDING",
    dispatchAccepted: true,
    localWorkRemaining: false
  });
}

export function earlyGithubHandoffStatusLines(result) {
  if (result?.dispatchAccepted !== true || result?.localWorkRemaining !== false) {
    return Object.freeze([
      EARLY_GITHUB_HANDOFF_STATUS.LOCAL_REQUIRED,
      EARLY_GITHUB_HANDOFF_FAILURE.REPOSITORY_INVALID
    ]);
  }
  if (result.status === "REGISTERED"
    && Number.isSafeInteger(result.runId)
    && typeof result.runUrl === "string") {
    return Object.freeze([
      EARLY_GITHUB_HANDOFF_STATUS.CONFIRMED,
      `RUN ID ${result.runId}`,
      `RUN URL ${result.runUrl}`,
      EARLY_GITHUB_HANDOFF_STATUS.CLOSE
    ]);
  }
  if (result.status === "REGISTRATION_PENDING") {
    return Object.freeze([
      EARLY_GITHUB_HANDOFF_STATUS.PENDING,
      EARLY_GITHUB_HANDOFF_STATUS.CLOSE
    ]);
  }
  return Object.freeze([
    EARLY_GITHUB_HANDOFF_STATUS.LOCAL_REQUIRED,
    EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID
  ]);
}

export function earlyGithubHandoffFailureLines(error) {
  const code = error instanceof EarlyGithubHandoffError
    ? error.code
    : EARLY_GITHUB_HANDOFF_FAILURE.RUN_RESPONSE_INVALID;
  return Object.freeze([EARLY_GITHUB_HANDOFF_STATUS.LOCAL_REQUIRED, code]);
}
