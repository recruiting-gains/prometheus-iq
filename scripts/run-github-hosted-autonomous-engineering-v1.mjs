#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatAutonomousEngineeringV1Failure,
  finalizeAutonomousDeploymentEvidence,
  independentlyVerifyAutonomousProduction,
  inspectAutonomousProductionBaseline,
  runAutonomousDeployment,
  runAutonomousFullSuite,
  runAutonomousQualification,
  runAutonomousRollbackDemonstration,
  selectAutonomousQualification,
  validateAutonomousEngineeringV1Context,
  verifyAutonomousArtifact,
  verifyAutonomousEngineeringV1Repository,
  verifyAutonomousRollbackRecovery
} from "./lib/github-hosted-autonomous-engineering-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const MODES = new Set([
  "authorize",
  "full-suite",
  "select-qualification",
  "inspect-baseline",
  "qualify",
  "verify-artifact",
  "rollback-demo",
  "verify-recovery",
  "deploy",
  "finalize-deployment",
  "verify-production"
]);

export async function runGithubHostedAutonomousEngineeringV1Command({
  mode,
  environment = process.env
} = {}) {
  if (!MODES.has(mode)) throw new Error("autonomous_mode_invalid");
  if (mode === "authorize") {
    const inputs = validateAutonomousEngineeringV1Context(environment);
    const repository = verifyAutonomousEngineeringV1Repository(root, inputs);
    return Object.freeze({
      status: "GITHUB_HOSTED_AUTONOMOUS_AUTHORIZATION_VERIFIED",
      changedFileCount: repository.changedFileCount
    });
  }
  if (mode === "inspect-baseline") {
    return inspectAutonomousProductionBaseline({ root, environment });
  }
  if (mode === "full-suite") {
    return runAutonomousFullSuite({ root, environment });
  }
  if (mode === "select-qualification") {
    return selectAutonomousQualification({ environment });
  }
  if (mode === "qualify") {
    return runAutonomousQualification({ root, environment });
  }
  if (mode === "verify-artifact") {
    return verifyAutonomousArtifact({ root, environment });
  }
  if (mode === "rollback-demo") {
    return runAutonomousRollbackDemonstration({ root, environment });
  }
  if (mode === "verify-recovery") {
    return verifyAutonomousRollbackRecovery({ root, environment });
  }
  if (mode === "deploy") {
    return runAutonomousDeployment({ root, environment });
  }
  if (mode === "finalize-deployment") {
    return finalizeAutonomousDeploymentEvidence({ root, environment });
  }
  return independentlyVerifyAutonomousProduction({ root, environment });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || !MODES.has(mode)) {
      throw new Error("autonomous_arguments_invalid");
    }
    const result = await runGithubHostedAutonomousEngineeringV1Command({
      mode
    });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatAutonomousEngineeringV1Failure(error)}\n`);
    process.exitCode = 1;
  }
}
