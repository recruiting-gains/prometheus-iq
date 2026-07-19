#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_CRM_FOUNDER_ACCESS_FAILURE,
  PublicCrmFounderAccessError,
  configurePublicCrmFounderPrincipal,
  verifyPublicCrmFounderAccessContract
} from "./lib/cloudflare-public-crm-founder-access.mjs";
import { createControllingTtyConfirmation } from "./lib/cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "..");

export async function runPublicCrmFounderAccessCommand({
  mode,
  setupPath,
  confirmation = createControllingTtyConfirmation()
} = {}) {
  if (mode === "verify" && setupPath === undefined) {
    verifyPublicCrmFounderAccessContract(root);
    return Object.freeze({ status: "PUBLIC_CRM_FOUNDER_ACCESS_CONTRACT_VERIFIED" });
  }
  if (mode === "configure-principal" && typeof setupPath === "string") {
    return configurePublicCrmFounderPrincipal({
      root,
      setupPath,
      confirm: confirmation.confirm.bind(confirmation)
    });
  }
  throw new PublicCrmFounderAccessError(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, setupPath, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || (mode === "verify" && setupPath !== undefined)) {
      throw new PublicCrmFounderAccessError(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
    }
    const result = await runPublicCrmFounderAccessCommand({ mode, setupPath });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    const code = error instanceof PublicCrmFounderAccessError
      ? error.code
      : PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED;
    process.stdout.write(`${code}\n`);
    process.exitCode = 1;
  }
}
