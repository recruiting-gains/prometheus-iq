import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  currentFounderAttendedResponseContractUid
} from "./cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ACCOUNT_ALLOWLIST
} from "./cloudflare-founder-attended-response-contract-constants.mjs";
import {
  diagnoseFounderAttendedResponseContractAbsenceTestOnly,
  prepareFounderAttendedResponseContractControlTestOnly,
  provisionFounderAttendedResponseContractSuccessorTestOnly
} from "./cloudflare-founder-attended-response-contract-workflow.mjs";
import { createFounderAttendedMacOsKeychain } from "./cloudflare-founder-attended-keychain.mjs";
import { createFounderAttendedCloudflareTransport } from "./cloudflare-founder-attended-service-token.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");

function commonOptions() {
  return Object.freeze({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
    expectedUid: currentFounderAttendedResponseContractUid()
  });
}

export async function diagnoseFounderAttendedResponseContractAbsence() {
  return diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    ...commonOptions(),
    transport: createFounderAttendedCloudflareTransport(),
    randomBytesImpl: randomBytes
  });
}

export function prepareFounderAttendedResponseContractControl() {
  return prepareFounderAttendedResponseContractControlTestOnly({
    ...commonOptions(),
    randomBytesImpl: randomBytes
  });
}

export async function provisionFounderAttendedResponseContractSuccessor() {
  return provisionFounderAttendedResponseContractSuccessorTestOnly({
    ...commonOptions(),
    transport: createFounderAttendedCloudflareTransport()
  });
}

function requireNoArguments() {
  if (process.argv.slice(2).length !== 0) throw new Error("argument_denied");
}

export async function runFounderAttendedResponseContractDiagnosticCli() {
  try {
    requireNoArguments();
    const result = await diagnoseFounderAttendedResponseContractAbsence();
    console.log(result.outcome);
    if (result.outcome === "LOCAL_ARTIFACT_COLLISION") process.exitCode = 1;
  } catch {
    console.error("MANUAL_REVIEW");
    process.exitCode = 1;
  }
}

export function runFounderAttendedResponseContractPreparationCli() {
  try {
    requireNoArguments();
    prepareFounderAttendedResponseContractControl();
    console.log("SAFE_TO_PREPARE_RECOVERY");
  } catch {
    console.error("MANUAL_REVIEW");
    process.exitCode = 1;
  }
}

export async function runFounderAttendedResponseContractProvisioningCli() {
  try {
    requireNoArguments();
    const result = await provisionFounderAttendedResponseContractSuccessor();
    console.log(result.outcome);
    if (result.outcome !== "SUCCESS") process.exitCode = 1;
  } catch {
    console.error("MANUAL_REVIEW");
    process.exitCode = 1;
  }
}
