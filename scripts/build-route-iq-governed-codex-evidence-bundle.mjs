#!/usr/bin/env node
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildGovernedCodexEvidenceBundle,
  stablePrettyJson
} from "../data/route-iq-commercial-readiness-v1/governed-codex-evidence-bundle.mjs";

const allowedFlags = new Set(["--workspace", "--profile", "--from", "--to", "--output"]);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowedFlags.has(flag) || typeof value !== "string" || !value || value.startsWith("--")) {
      throw new Error("Invalid arguments. Supported flags: --workspace --profile --from --to --output");
    }
    if (Object.hasOwn(parsed, flag)) throw new Error(`Duplicate argument: ${flag}`);
    parsed[flag] = value;
  }
  return parsed;
}

function writePrivateBundle(outputPath, bytes) {
  if (!isAbsolute(outputPath)) throw new Error("Output path must be absolute.");
  const absolute = resolve(outputPath);
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
  if (existsSync(absolute)) {
    const existing = lstatSync(absolute);
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error("Output path must be a regular file.");
    if (readFileSync(absolute, "utf8") === bytes) {
      chmodSync(absolute, 0o600);
      return absolute;
    }
  }
  const temporary = `${absolute}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporary, absolute);
    chmodSync(absolute, 0o600);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return absolute;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(import.meta.dirname, "..");
  const bundle = buildGovernedCodexEvidenceBundle({
    repoRoot,
    workspaceId: args["--workspace"] || "fitness_connection",
    operatingProfileId: args["--profile"],
    from: args["--from"],
    to: args["--to"]
  });
  const output = writePrivateBundle(
    args["--output"] || "/tmp/route-iq-governed-codex-evidence-bundle.json",
    stablePrettyJson(bundle)
  );
  process.stdout.write(JSON.stringify({
    status: "GOVERNED_CODEX_EVIDENCE_BUNDLE_READY",
    output,
    bundleId: bundle.bundleId,
    authorizedRecordCount: bundle.manifest.authorizedRecordCount,
    redactionStatus: bundle.manifest.redactionStatus,
    canonicalProductionDatabase: false
  }) + "\n");
} catch (error) {
  process.stderr.write(JSON.stringify({
    status: "GOVERNED_CODEX_EVIDENCE_BUNDLE_FAILED",
    code: error?.code || "route_iq_governed_codex_evidence_cli_failed"
  }) + "\n");
  process.exitCode = 1;
}
