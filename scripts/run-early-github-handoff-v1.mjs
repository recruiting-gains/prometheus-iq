#!/usr/bin/env node

import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EARLY_GITHUB_HANDOFF_POLICY,
  createGithubActionsApi,
  dispatchEarlyGithubHandoff,
  earlyGithubHandoffFailureLines,
  earlyGithubHandoffStatusLines,
  verifyEarlyGithubHandoffRepository
} from "./lib/early-github-handoff-v1.mjs";

function parseArguments(argv) {
  const values = {
    repository: EARLY_GITHUB_HANDOFF_POLICY.repository,
    workflow: EARLY_GITHUB_HANDOFF_POLICY.workflow,
    branch: EARLY_GITHUB_HANDOFF_POLICY.branch,
    registrationTimeoutMs: EARLY_GITHUB_HANDOFF_POLICY.registrationTimeoutMs,
    pollIntervalMs: EARLY_GITHUB_HANDOFF_POLICY.pollIntervalMs
  };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error("arguments_invalid");
    if (name === "--repository") values.repository = value;
    else if (name === "--workflow") values.workflow = value;
    else if (name === "--branch") values.branch = value;
    else if (name === "--commit") values.commit = value;
    else if (name === "--inputs-json") values.inputsPath = value;
    else if (name === "--registration-timeout-ms") values.registrationTimeoutMs = Number(value);
    else if (name === "--poll-interval-ms") values.pollIntervalMs = Number(value);
    else throw new Error("arguments_invalid");
  }
  if (!values.commit) throw new Error("arguments_invalid");
  return values;
}

function readInputs(path) {
  if (!path) return {};
  const absolute = resolve(path);
  const stats = lstatSync(absolute);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 65_536) {
    throw new Error("inputs_invalid");
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

export async function runEarlyGithubHandoffCommand({
  argv = process.argv.slice(2),
  environment = process.env,
  cwd = resolve(import.meta.dirname, "..")
} = {}) {
  const parsed = parseArguments(argv);
  const request = {
    repository: parsed.repository,
    workflow: parsed.workflow,
    branch: parsed.branch,
    commit: parsed.commit,
    inputs: readInputs(parsed.inputsPath),
    registrationTimeoutMs: parsed.registrationTimeoutMs,
    pollIntervalMs: parsed.pollIntervalMs
  };
  const repositoryState = verifyEarlyGithubHandoffRepository({
    cwd,
    branch: request.branch,
    commit: request.commit
  });
  const api = createGithubActionsApi({
    token: environment.GH_TOKEN || environment.GITHUB_TOKEN
  });
  return dispatchEarlyGithubHandoff({ request, api, repositoryState });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await runEarlyGithubHandoffCommand();
    process.stdout.write(`${earlyGithubHandoffStatusLines(result).join("\n")}\n`);
  } catch (error) {
    process.stdout.write(`${earlyGithubHandoffFailureLines(error).join("\n")}\n`);
    process.exitCode = 1;
  }
}
