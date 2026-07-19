import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalFitnessConnectionDailyIntelligenceSnapshot,
  canonicalRouteIqIntelligenceJson,
  loadRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqCommercialReadinessIntelligenceContract,
  validateRouteIqDailyIntelligenceSnapshot
} from "../route-iq-daily-intelligence-snapshot.mjs";
import { verifyRouteIqCommercialReadinessIntelligence } from "../../scripts/verify-route-iq-commercial-readiness-intelligence.mjs";

export const legacyCommit = "9f9cb75dd8122bc07dda72d61e9ced119d409063";
export const evidencePath = "intelligence/provenance/route-iq-commercial-readiness-founder-snapshot-owner-reconstruction-v1.json";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shaPattern = /^[a-f0-9]{64}$/;
const affectedPaths = Object.freeze([
  "intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json",
  "intelligence/contracts/route-iq-commercial-readiness-intelligence-v1.json",
  "intelligence/fixtures/route-iq-commercial-readiness-daily-snapshot-v1.json",
  "intelligence/route-iq-commercial-readiness-intelligence-v1.md",
  "intelligence/route-iq-daily-intelligence-snapshot.mjs",
  "scripts/verify-route-iq-commercial-readiness-intelligence.mjs",
  "tests/route-iq-commercial-readiness-intelligence.test.mjs"
]);

const read = path => readFileSync(resolve(root, path));
const parse = path => JSON.parse(read(path).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function semanticSha256(path, bytes) {
  if (path.endsWith(".json")) return sha256(stable(JSON.parse(bytes.toString("utf8"))));
  const normalized = bytes.toString("utf8")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n*$/, "\n");
  return sha256(normalized);
}

function gitRead(commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024
  });
}

function gitText(args) {
  return execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();
}

function selectedArchiveContractSemanticSha256() {
  const contract = parse("intelligence/contracts/read-only-field-session-learning-contracts.json");
  return sha256(stable({
    canonicalSourceArtifacts: contract.canonicalSourceArtifacts,
    canonicalSourceSha256: contract.canonicalSourceSha256
  }));
}

function assertPathSemantics(path, contract, canonicalSnapshot, verification) {
  if (path.endsWith("route-iq-commercial-readiness-intelligence-v1.json")) {
    assert.deepEqual(validateRouteIqCommercialReadinessIntelligenceContract(parse(path)), []);
    return;
  }
  if (path.endsWith("route-iq-commercial-readiness-daily-snapshot-v1.json")) {
    const fixture = parse(path);
    assert.equal(fixture.canonical, false);
    assert.equal(fixture.productionConsumptionAllowed, false);
    assert.equal(fixture.principal.immutablePrincipalId, contract.founderAccess.authorizedMappings[0].immutablePrincipalId);
    return;
  }
  if (path.endsWith("founder-daily-intelligence-snapshot-v1.json")) {
    assert.deepEqual(parse(path), canonicalSnapshot);
    assert.deepEqual(validateRouteIqDailyIntelligenceSnapshot(canonicalSnapshot, contract), []);
    return;
  }
  const source = read(path).toString("utf8");
  if (path.endsWith("route-iq-daily-intelligence-snapshot.mjs")) {
    for (const token of [
      "projectCanonicalFitnessConnectionDailyIntelligenceInput",
      "buildCanonicalFitnessConnectionDailyIntelligenceSnapshot",
      "FOUNDER_FIELD_RESEARCH",
      "recommendationInfluence: \"OFF\""
    ]) assert.match(source, new RegExp(token));
    return;
  }
  if (path.endsWith("verify-route-iq-commercial-readiness-intelligence.mjs")) {
    assert.equal(verification.status, "passed");
    assert.equal(verification.canonicalFounderSnapshotSha256, canonicalSnapshot.snapshotSha256);
    return;
  }
  if (path.endsWith("route-iq-commercial-readiness-intelligence.test.mjs")) {
    for (const token of [
      "canonical July 11 Founder snapshot matches its stable checked-in artifact",
      "canonical Founder artifact excludes source names, addresses, notes, contact, GPS, and secrets",
      "canonical projection uses Data pseudonym and changes only with governed input"
    ]) assert.ok(source.includes(token), `Focused owner test semantic missing: ${token}`);
    return;
  }
  if (path.endsWith("route-iq-commercial-readiness-intelligence-v1.md")) {
    for (const token of [
      "FOUNDER_FIELD_RESEARCH",
      "Founder-only",
      "Founder-only GET/HEAD endpoint",
      "Recommendation influence remains `OFF`"
    ]) assert.ok(source.includes(token), `Owner documentation semantic missing: ${token}`);
    return;
  }
  assert.fail(`Unclassified affected path: ${path}`);
}

export function verifyRouteIqCommercialReadinessFounderSnapshotOwnerReconstruction() {
  const evidence = parse(evidencePath);
  assert.equal(evidence.legacyCommit, legacyCommit);
  assert.equal(evidence.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(evidence.status, "OWNER_RECONSTRUCTED_IDENTICAL");
  assert.equal(evidence.classification, "DISCLOSED_LOCAL_AUTHOR_IDENTITY_CONTAMINATION");
  assert.equal(evidence.legacyCommitMetadata.historyRewritten, false);
  assert.equal(evidence.legacyCommitMetadata.retroactiveOwnershipClaimed, false);
  assert.equal("successorCommit" in evidence, false, "Tracked evidence must remain non-self-referential.");

  const metadata = gitText(["show", "-s", "--format=%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", legacyCommit]).split("\n");
  assert.deepEqual(metadata, [
    evidence.legacyCommitMetadata.parent,
    evidence.legacyCommitMetadata.tree,
    evidence.legacyCommitMetadata.recordedAuthor,
    evidence.legacyCommitMetadata.recordedCommitter,
    evidence.legacyCommitMetadata.subject
  ]);
  execFileSync("git", ["merge-base", "--is-ancestor", legacyCommit, "HEAD"], {cwd: root});

  const committedPaths = gitText(["diff-tree", "--no-commit-id", "--name-only", "-r", legacyCommit])
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.deepEqual(committedPaths, [...affectedPaths].sort());
  assert.deepEqual(evidence.affectedPaths.map(entry => entry.path).sort(), [...affectedPaths].sort());

  const contract = loadRouteIqCommercialReadinessIntelligenceContract();
  assert.deepEqual(validateRouteIqCommercialReadinessIntelligenceContract(contract), []);
  const canonicalSnapshot = buildCanonicalFitnessConnectionDailyIntelligenceSnapshot({
    contract,
    previousSnapshot: null
  });
  const canonicalBytes = Buffer.from(`${JSON.stringify(canonicalSnapshot, null, 2)}\n`, "utf8");
  const verification = verifyRouteIqCommercialReadinessIntelligence();
  assert.equal(verification.status, "passed");
  assert.equal(verification.canonicalFounderArtifactFileSha256, sha256(canonicalBytes));
  assert.equal(canonicalSnapshot.snapshotSha256, evidence.reconstruction.snapshotSha256);
  assert.equal(sha256(canonicalBytes), evidence.reconstruction.artifactFileSha256);
  assert.equal(selectedArchiveContractSemanticSha256(), evidence.derivationSources[1].selectedSemanticSha256);

  const comparisons = evidence.affectedPaths.map(entry => {
    const legacyBytes = gitRead(legacyCommit, entry.path);
    const currentBytes = read(entry.path);
    assert.equal(sha256(legacyBytes), entry.legacyCommitSha256, entry.path);
    assert.equal(sha256(currentBytes), entry.canonicalSha256, entry.path);
    assert.equal(entry.reconstructedSha256, entry.canonicalSha256, entry.path);
    assert.equal(semanticSha256(entry.path, currentBytes), entry.semanticSha256, entry.path);
    assert.equal(legacyBytes.equals(currentBytes), true, entry.path);
    assert.equal(entry.result, "IDENTICAL", entry.path);
    assertPathSemantics(entry.path, contract, canonicalSnapshot, verification);
    return {
      path: entry.path,
      rawSha256: entry.canonicalSha256,
      semanticSha256: entry.semanticSha256,
      result: entry.result
    };
  });

  assert.equal(evidence.comparisonSummary.affectedPathCount, affectedPaths.length);
  assert.equal(evidence.comparisonSummary.byteIdenticalCount, affectedPaths.length);
  assert.equal(evidence.comparisonSummary.semanticIdenticalCount, affectedPaths.length);
  assert.equal(evidence.comparisonSummary.correctedCount, 0);
  assert.equal(evidence.comparisonSummary.result, "IDENTICAL");
  assert.equal(evidence.boundaries.recommendationInfluence, "OFF");
  assert.equal(evidence.boundaries.representativeReadable, false);
  assert.equal(evidence.boundaries.deploymentPerformed, false);
  assert.equal(evidence.boundaries.productionMutationPerformed, false);

  return {
    status: "passed",
    batchId: evidence.batchId,
    ownerSubsystem: evidence.ownerSubsystem,
    legacyCommit,
    classification: evidence.classification,
    affectedPathCount: comparisons.length,
    comparisonResult: evidence.comparisonSummary.result,
    correctionRequired: evidence.reconstruction.correctionRequired,
    snapshotSha256: canonicalSnapshot.snapshotSha256,
    artifactFileSha256: sha256(canonicalBytes),
    comparisons,
    recommendationInfluence: evidence.boundaries.recommendationInfluence
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyRouteIqCommercialReadinessFounderSnapshotOwnerReconstruction(), null, 2));
}
