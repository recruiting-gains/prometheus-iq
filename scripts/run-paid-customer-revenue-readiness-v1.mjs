#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REVENUE_READINESS_V1_POLICY,
  revenueReadinessContractSha256,
  formatRevenueReadinessFailure,
  runRevenueReadinessDeployment,
  runRevenueReadinessQualification,
  validateRevenueReadinessContext,
  verifyRevenueReadinessArtifact,
  verifyRevenueReadinessEvidence,
  verifyRevenueReadinessRepository
} from "./lib/paid-customer-revenue-readiness-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const MODES = new Set([
  "authorize",
  "qualify",
  "verify-artifact",
  "deploy",
  "verify-evidence"
]);

export async function runPaidCustomerRevenueReadinessV1Command({
  mode,
  environment = process.env
} = {}) {
  if (!MODES.has(mode)) throw new Error("revenue_readiness_mode_invalid");
  if (mode === "authorize") {
    const inputs = validateRevenueReadinessContext(environment);
    const repository = verifyRevenueReadinessRepository(root, inputs);
    return Object.freeze({
      status: "REVENUE_READINESS_AUTHORIZATION_VERIFIED",
      commitCount: repository.commitCount,
      contractSha256: revenueReadinessContractSha256(root)
    });
  }
  if (mode === "qualify") {
    return runRevenueReadinessQualification({ root, environment });
  }
  if (mode === "verify-artifact") {
    return verifyRevenueReadinessArtifact({ root, environment });
  }
  if (mode === "deploy") {
    return runRevenueReadinessDeployment({ root, environment });
  }
  return verifyRevenueReadinessEvidence({ root, environment });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || !MODES.has(mode)) {
      throw new Error("revenue_readiness_arguments_invalid");
    }
    const result = await runPaidCustomerRevenueReadinessV1Command({
      mode
    });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatRevenueReadinessFailure(error)}\n`);
    process.exitCode = 1;
  }
}

export const paidCustomerRevenueReadinessV1Modes = MODES;
export const paidCustomerRevenueReadinessV1Policy =
  REVENUE_READINESS_V1_POLICY;
