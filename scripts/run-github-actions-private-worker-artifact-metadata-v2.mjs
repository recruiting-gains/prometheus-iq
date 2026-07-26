#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  formatPrivateWorkflowV2Failure,
  verifyPrivateQualificationArtifactMetadata
} from "./lib/github-actions-private-worker-workflow-v2.mjs";

export async function runPrivateWorkerArtifactMetadataV2Command({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (mode !== "verify") throw new Error("artifact_metadata_mode_invalid");
  return verifyPrivateQualificationArtifactMetadata(environment, fetchImpl);
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || mode !== "verify") {
      throw new Error("artifact_metadata_arguments_invalid");
    }
    const result = await runPrivateWorkerArtifactMetadataV2Command({ mode });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatPrivateWorkflowV2Failure(error)}\n`);
    process.exitCode = 1;
  }
}
