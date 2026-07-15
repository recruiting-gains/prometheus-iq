#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const defaultContractPath =
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2-provenance-v1.json";
const originalFiles = Object.freeze([
  "docs/cloudflare-unattended-keychain-acl-interoperability-v2.md",
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift",
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift",
  "scripts/lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs",
  "tests/cloudflare-unattended-keychain-acl-interoperability-v2.test.mjs",
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2.json"
]);

function text(execFile, args, cwd) {
  return execFile("/usr/bin/git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function bytes(execFile, args, cwd) {
  return execFile("/usr/bin/git", args, {
    cwd,
    encoding: null,
    stdio: ["ignore", "pipe", "ignore"]
  });
}

export function verifyCloudflareUnattendedKeychainAclV2Provenance({
  repositoryRoot = root,
  contractPath = defaultContractPath,
  execFile = execFileSync,
  readFile = readFileSync
} = {}) {
  const resolvedContract = isAbsolute(contractPath)
    ? contractPath
    : resolve(repositoryRoot, contractPath);
  const contract = JSON.parse(readFile(resolvedContract, "utf8"));
  assert.equal(
    contract.contractVersion,
    "cloudflare-unattended-keychain-acl-interoperability-v2-provenance-v1"
  );
  assert.equal(contract.batchId, "BATCH-20260715-009");
  assert.equal(contract.implementationOwner, "Prometheus Infrastructure");
  assert.match(contract.subjectCommit, /^[0-9a-f]{40}$/u);
  assert.deepEqual(contract.pinnedFiles.map(entry => entry.path), originalFiles);
  assert.ok(contract.pinnedFiles.every(entry => /^[0-9a-f]{64}$/u.test(entry.sha256)));
  assert.equal(contract.provenanceGap.classification, "LOCAL_PROVENANCE_METADATA_GAP");
  assert.equal(contract.provenanceGap.contentOwnership, "Prometheus Infrastructure");
  assert.equal(contract.provenanceGap.cloudflareContacted, false);
  assert.equal(contract.provenanceGap.governedKeychainValuesRead, false);
  assert.equal(contract.provenanceGap.governedKeychainAclsChanged, false);
  assert.equal(contract.provenanceGap.deploymentPerformed, false);
  assert.equal(contract.provenanceGap.productionMutated, false);

  const metadata = text(execFile, [
    "show", "-s", "--format=%H%n%an <%ae>%n%cn <%ce>", contract.subjectCommit
  ], repositoryRoot).split("\n");
  assert.deepEqual(metadata, [
    contract.subjectCommit,
    contract.provenanceGap.author,
    contract.provenanceGap.committer
  ]);
  assert.notEqual(contract.provenanceGap.author, "Prometheus Infrastructure <infrastructure@prometheus.local>");

  const committedFiles = text(
    execFile,
    ["show", "--format=", "--name-only", contract.subjectCommit],
    repositoryRoot
  ).split("\n").filter(Boolean);
  assert.deepEqual(committedFiles, originalFiles);
  for (const pin of contract.pinnedFiles) {
    const digest = createHash("sha256")
      .update(bytes(execFile, ["show", `${contract.subjectCommit}:${pin.path}`], repositoryRoot))
      .digest("hex");
    assert.equal(digest, pin.sha256, `source pin drifted: ${pin.path}`);
  }
  return Object.freeze({
    subjectCommit: contract.subjectCommit,
    pinnedFiles: contract.pinnedFiles.length,
    provenanceGap: contract.provenanceGap.classification,
    result: "passed"
  });
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  process.stdout.write(`${JSON.stringify(verifyCloudflareUnattendedKeychainAclV2Provenance())}\n`);
}
