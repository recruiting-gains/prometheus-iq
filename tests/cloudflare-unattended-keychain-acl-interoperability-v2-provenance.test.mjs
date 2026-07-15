import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  verifyCloudflareUnattendedKeychainAclV2Provenance
} from "../scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2-provenance.mjs";

const root = resolve(".");
const contractPath = resolve(
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2-provenance-v1.json"
);

test("Infrastructure provenance evidence pins all nine original v2 files", () => {
  assert.deepEqual(verifyCloudflareUnattendedKeychainAclV2Provenance(), {
    subjectCommit: "348978de14a09651565c84c0b445b8371c496131",
    pinnedFiles: 9,
    provenanceGap: "LOCAL_PROVENANCE_METADATA_GAP",
    result: "passed"
  });
});

test("provenance verification rejects an altered original content pin", t => {
  const directory = mkdtempSync(join(tmpdir(), "prometheus-keychain-acl-v2-provenance-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  contract.pinnedFiles[0].sha256 = "0".repeat(64);
  const altered = join(directory, "altered-provenance.json");
  writeFileSync(altered, `${JSON.stringify(contract)}\n`, { mode: 0o600 });
  assert.throws(() => verifyCloudflareUnattendedKeychainAclV2Provenance({
    repositoryRoot: root,
    contractPath: altered
  }), /source pin drifted/u);
});
