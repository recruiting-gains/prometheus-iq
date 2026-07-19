#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");

export function verifyRouteIqPublicForwardRollback(expectedSha256) {
  return verifyPublicForwardRollbackArtifact(root, expectedSha256);
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length > 1) {
    process.stdout.write("FAIL\n");
    process.exitCode = 1;
  } else {
    try {
      const result = verifyRouteIqPublicForwardRollback(argumentsList[0]);
      process.stdout.write(`${result.status} ${result.artifactSha256}\n`);
    } catch {
      process.stdout.write("FAIL\n");
      process.exitCode = 1;
    }
  }
}
