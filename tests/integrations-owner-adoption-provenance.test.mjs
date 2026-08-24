import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const legacyCommit = "cae2d9705a36291b5404dd0820ff15933c8b503d";
const expectedPaths = [
  "integrations/README.md",
  "integrations/business-hours-provider-adapter.js",
  "integrations/shared-workspace-lead-intake-contract.js",
  "tests/business-hours-provider-adapter.test.mjs",
  "tests/shared-workspace-lead-intake-contract.test.mjs",
].sort();
const expectedUnchangedHashes = new Map([
  [
    "integrations/business-hours-provider-adapter.js",
    "329cbede4d12cc7e9e6592a95202ff5253d813fa5d51aceb369260f1d3a3688e",
  ],
  [
    "integrations/shared-workspace-lead-intake-contract.js",
    "a39bf1b3f0988a932fc2f77d563bdaf483bd252cbe4260c53bc73564bf277d75",
  ],
  [
    "tests/business-hours-provider-adapter.test.mjs",
    "e50a3d7f6e1090b18b5024ed66a00fbfa6db2f9c30721a02664dd018aaaf0781",
  ],
  [
    "tests/shared-workspace-lead-intake-contract.test.mjs",
    "18c74be8201998e9cf11b3387a890cad7e2f12f3476086f1c502c6b1bc7736ed",
  ],
]);
const readmeLegacySha256 = "ed1a1bd5103e54d8885ed5a5af908d3b8d0e0a65967b6ec199da5a10116f3be9";
const readmeCurrentSha256 = "d647dadb0743c904af9534f0aeb873a1d3e7ddec4f04188ee4d90e8dc8a69e02";
const readmeLegacyBlob = "08d7e07aad1dac14dcc69735d4ecb9e71c8f4ae5";
const readmeCurrentBlob = "c7948d6e7d3b4074101baf22d3993f6b9a2402be";

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function gitBuffer(...argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
  });
}

function gitText(...argumentsList) {
  return gitBuffer(...argumentsList).toString("utf8").trim();
}

function sha256Bytes(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

test("Integrations owner-adoption provenance discloses the legacy commit without retroactive ownership", () => {
  const record = JSON.parse(fs.readFileSync(provenancePath, "utf8"));

  assert.equal(record.evidenceVersion, "prometheus-integrations-owner-adoption-v1");
  assert.equal(record.status, "LEGACY_LOCAL_COMMIT_WITH_OWNER_ACCEPTED_SUCCESSOR");
  assert.equal(record.legacyCommit, legacyCommit);
  assert.equal(record.canonicalOwner, "Prometheus Integrations");
  assert.equal(record.canonicalOwnerEmail, "integrations@prometheus.local");
  assert.equal(record.historyRewriteAllowed, false);
  assert.equal(record.currentFilesAdoptedUnchanged, false);
  assert.deepEqual(record.lineage, {
    adoptedUnchangedPathCount: 4,
    ownerAcceptedSuccessorPathCount: 1,
    ownerAcceptedSuccessorPath: "integrations/README.md",
  });
  assert.match(record.ownershipStatement, /does not claim retroactive Integrations ownership/i);
  assert.match(record.ownershipStatement, /does not rewrite history/i);
  assert.match(record.ownershipStatement, /Four current Integrations-owned files remain adopted unchanged/i);
  assert.match(record.ownershipStatement, /sole Integrations-accepted documentation successor/i);
});

test("Integrations provenance preserves four legacy-identical paths and one exact owner-accepted successor", () => {
  const record = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
  assert.deepEqual(record.paths.map((entry) => entry.path).sort(), expectedPaths);

  for (const entry of record.paths) {
    const absolutePath = path.join(repoRoot, entry.path);
    assert.equal(fs.existsSync(absolutePath), true, `${entry.path} must exist`);
    assert.equal(sha256(absolutePath), entry.currentRawSha256, `${entry.path} hash drifted`);
    const legacyBytes = gitBuffer("show", `${legacyCommit}:${entry.path}`);
    assert.equal(
      sha256Bytes(legacyBytes),
      entry.legacyCommitRawSha256,
      `${entry.path} legacy hash drifted`,
    );
  }

  const unchanged = record.paths.filter((entry) => entry.adoptedUnchanged === true);
  assert.equal(unchanged.length, 4);
  assert.deepEqual(unchanged.map((entry) => entry.path).sort(), [...expectedUnchangedHashes.keys()].sort());
  for (const entry of unchanged) {
    const expectedHash = expectedUnchangedHashes.get(entry.path);
    assert.equal(entry.currentRawSha256, expectedHash);
    assert.equal(entry.legacyCommitRawSha256, expectedHash);
    assert.equal(sha256(path.join(repoRoot, entry.path)), expectedHash);
    assert.equal(sha256Bytes(gitBuffer("show", `${legacyCommit}:${entry.path}`)), expectedHash);
  }

  const successors = record.paths.filter(
    (entry) => entry.adoptedUnchanged === false
      && entry.disposition === "OWNER_ACCEPTED_SUCCESSOR",
  );
  assert.equal(successors.length, 1);
  const [readme] = successors;
  assert.equal(readme.path, "integrations/README.md");
  assert.equal(readme.legacyCommitRawSha256, readmeLegacySha256);
  assert.equal(readme.currentRawSha256, readmeCurrentSha256);
  assert.notEqual(readme.legacyCommitRawSha256, readme.currentRawSha256);
  assert.equal(readme.legacyGitBlob, readmeLegacyBlob);
  assert.equal(readme.currentGitBlob, readmeCurrentBlob);
  assert.equal(gitText("rev-parse", `${legacyCommit}:integrations/README.md`), readmeLegacyBlob);
  assert.equal(gitText("rev-parse", "HEAD:integrations/README.md"), readmeCurrentBlob);
  assert.equal(readme.successorSource.commit, "93429ca65a9b48219b0ccd633f3436e2029ba825");
  assert.equal(readme.successorSource.tree, "2876679d8e276e5489330b3e7eeb88554f427817");
  assert.equal(readme.successorSource.parent, "46afabde3b0ad6678c98018ebbc31609dbc4a97a");
  assert.equal(
    readme.successorSource.author,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
  );
  assert.equal(readme.successorSource.committer, readme.successorSource.author);
  assert.match(readme.successorSource.change, /infrastructure:intake-contract:check/u);
  assert.match(readme.successorSource.change, /test:public/u);
  assert.match(readme.successorSource.impact, /Documentation and verification routing only/u);
  assert.match(readme.successorSource.impact, /no Worker runtime or production change/u);
  assert.match(readme.successorSource.impact, /no deployment required/u);
  const currentReadme = fs.readFileSync(path.join(repoRoot, readme.path), "utf8");
  assert.match(currentReadme, /npm run test:public/u);
  assert.doesNotMatch(currentReadme, /npm run infrastructure:intake-contract:check/u);
});
