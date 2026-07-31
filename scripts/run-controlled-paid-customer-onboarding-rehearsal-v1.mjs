#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTROLLED_REHEARSAL_V1_POLICY,
  controlledRehearsalContractSha256,
  formatControlledRehearsalFailure,
  runControlledRehearsalDeployment,
  runControlledRehearsalQualification,
  validateControlledRehearsalContext,
  verifyControlledRehearsalArtifact,
  verifyControlledRehearsalEvidence,
  verifyControlledRehearsalRepository
} from "./lib/controlled-paid-customer-onboarding-rehearsal-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const MODES = new Set([
  "authorize",
  "qualify",
  "verify-artifact",
  "deploy",
  "verify-evidence"
]);

export async function runControlledPaidCustomerOnboardingRehearsalV1Command({
  mode,
  environment = process.env
} = {}) {
  if (!MODES.has(mode)) throw new Error("controlled_rehearsal_mode_invalid");
  if (mode === "authorize") {
    const inputs = validateControlledRehearsalContext(environment);
    const repository = verifyControlledRehearsalRepository(root, inputs);
    return Object.freeze({
      status: "CONTROLLED_REHEARSAL_AUTHORIZATION_VERIFIED",
      commitCount: repository.commitCount,
      contractSha256: controlledRehearsalContractSha256(root)
    });
  }
  if (mode === "qualify") {
    return runControlledRehearsalQualification({ root, environment });
  }
  if (mode === "verify-artifact") {
    return verifyControlledRehearsalArtifact({ root, environment });
  }
  if (mode === "deploy") {
    return runControlledRehearsalDeployment({ root, environment });
  }
  return verifyControlledRehearsalEvidence({ root, environment });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || !MODES.has(mode)) {
      throw new Error("controlled_rehearsal_arguments_invalid");
    }
    const result = await runControlledPaidCustomerOnboardingRehearsalV1Command({
      mode
    });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatControlledRehearsalFailure(error)}\n`);
    process.exitCode = 1;
  }
}

export const controlledPaidCustomerOnboardingRehearsalV1Modes = MODES;
export const controlledPaidCustomerOnboardingRehearsalV1Policy =
  CONTROLLED_REHEARSAL_V1_POLICY;
