import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const provenancePath = path.join(
  repoRoot,
  "integrations",
  "provenance",
  "business-hours-provider-boundary-owner-adoption-v1.json"
);

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

test("Integrations owner-adoption provenance discloses the legacy commit without retroactive ownership", () => {
  const record = JSON.parse(fs.readFileSync(provenancePath, "utf8"));

  assert.equal(record.evidenceVersion, "prometheus-integrations-owner-adoption-v1");
  assert.equal(record.status, "LEGACY_LOCAL_COMMIT_ADOPTED_UNCHANGED");
  assert.equal(record.legacyCommit, "cae2d9705a36291b5404dd0820ff15933c8b503d");
  assert.equal(record.canonicalOwner, "Prometheus Integrations");
  assert.equal(record.canonicalOwnerEmail, "integrations@prometheus.local");
  assert.equal(record.historyRewriteAllowed, false);
  assert.equal(record.currentFilesAdoptedUnchanged, true);
  assert.match(record.ownershipStatement, /does not claim retroactive Integrations ownership/i);
  assert.match(record.ownershipStatement, /does not rewrite history/i);
});

test("Integrations owner-adoption provenance matches the adopted files byte-for-byte", () => {
  const record = JSON.parse(fs.readFileSync(provenancePath, "utf8"));

  for (const entry of record.paths) {
    const absolutePath = path.join(repoRoot, entry.path);
    assert.equal(fs.existsSync(absolutePath), true, `${entry.path} must exist`);
    assert.equal(entry.adoptedUnchanged, true, `${entry.path} must remain adopted unchanged`);
    assert.equal(entry.currentRawSha256, entry.legacyCommitRawSha256, `${entry.path} must match legacy commit bytes`);
    assert.equal(sha256(absolutePath), entry.currentRawSha256, `${entry.path} hash drifted`);
  }
});
