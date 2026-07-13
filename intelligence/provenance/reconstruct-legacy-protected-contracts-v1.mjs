import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const batchId = "BATCH-20260713-002";
export const legacyProvenanceGapCommit =
  "049cf583b04900b2cbf38bbffc5f6293252365d0";
export const preGapCommit =
  "13c0bbfb72b72e1b492369fdfe896fffbddefaa6";
export const provenanceStatus = "LEGACY_PROVENANCE_GAP";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidencePath =
  "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
const shaPattern = /^[a-f0-9]{64}$/;

const contractDefinitions = Object.freeze([
  {
    id: "read_only_field_session_learning",
    path: "intelligence/contracts/read-only-field-session-learning-contracts.json",
    sourceCommit: "9ece009c0b4c23f40d7cd8f8745925a8ccf7b830",
    reconstructionSources: [
      "intelligence/read-only-field-session-learning.md",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/config/read-only-field-session-learning-policy-v1.json",
      "scripts/verify-read-only-field-session-learning.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json",
    ],
  },
  {
    id: "off_route_learning",
    path: "intelligence/contracts/off-route-learning-intelligence-contracts.json",
    sourceCommit: "e341115fa326c83f216175616e89c7334944330e",
    reconstructionSources: [
      "intelligence/off-route-learning-intelligence.md",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/config/off-route-learning-intelligence-v1.json",
      "scripts/verify-off-route-learning-intelligence.mjs",
      "tests/off-route-learning-intelligence.test.mjs",
      "intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json",
    ],
  },
  {
    id: "discovery_mode_v2",
    path: "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
    sourceCommit: "9ece009c0b4c23f40d7cd8f8745925a8ccf7b830",
    reconstructionSources: [
      "intelligence/discovery-mode-intelligence-v2.md",
      "intelligence/discovery-mode-intelligence-v2.mjs",
      "intelligence/config/discovery-mode-intelligence-v2.json",
      "scripts/verify-discovery-mode-intelligence-v2.mjs",
      "tests/discovery-mode-intelligence-v2.test.mjs",
      "intelligence/artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json",
    ],
  },
  {
    id: "nearby_context_v2",
    path: "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
    sourceCommit: "9ece009c0b4c23f40d7cd8f8745925a8ccf7b830",
    reconstructionSources: [
      "intelligence/nearby-context-intelligence-v2.md",
      "intelligence/nearby-context-intelligence-v2.mjs",
      "intelligence/config/nearby-context-intelligence-v2.json",
      "scripts/verify-nearby-context-intelligence-v2.mjs",
      "tests/nearby-context-intelligence-v2.test.mjs",
      "intelligence/artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json",
    ],
  },
]);

const additionalConsumerMetadata = Object.freeze({
  "intelligence/contracts/shadow-decision-readiness-contracts.json": {
    id: "shadow_decision_readiness",
    generator: "scripts/verify-shadow-decision-readiness.mjs",
  },
});

const read = (path) => readFileSync(resolve(root, path));
const readText = (path) => read(path).toString("utf8");
const parse = (bytes) => JSON.parse(bytes.toString("utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
const fileSha256 = (path) => sha256(read(path));
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const semanticSha256 = (value) => sha256(stable(value));

function gitRead(commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function jsonFilesBelow(path) {
  const absolute = resolve(root, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return jsonFilesBelow(child);
    return entry.isFile() && entry.name.endsWith(".json") ? [child] : [];
  });
}

function discoverProtectedConsumers() {
  return jsonFilesBelow("intelligence")
    .filter((path) => {
      const document = parse(read(path));
      return Boolean(document?.protectedBehaviorBaselines);
    })
    .sort();
}

function hashProtectedObjectBaselines(document) {
  for (const baseline of Object.values(
    document.protectedBehaviorBaselines || {},
  )) {
    assert.equal(typeof baseline?.path, "string");
    baseline.sha256 = fileSha256(baseline.path);
  }
}

function hashMappedBaselines(document) {
  for (const [name, path] of Object.entries(
    document.protectedBehaviorBaselinePaths || {},
  )) {
    assert.equal(typeof document.protectedBehaviorBaselines?.[name], "string");
    document.protectedBehaviorBaselines[name] = fileSha256(path);
  }
}

function collectStringChanges(before, after, path = [], changes = []) {
  if (before === after) return changes;
  if (
    typeof before === "string" &&
    typeof after === "string" &&
    shaPattern.test(before) &&
    shaPattern.test(after)
  ) {
    changes.push({ path: path.join("."), before, after });
    return changes;
  }
  assert.equal(Array.isArray(before), Array.isArray(after));
  assert.equal(
    Boolean(before && typeof before === "object"),
    Boolean(after && typeof after === "object"),
  );
  const beforeKeys = Object.keys(before || {}).sort();
  const afterKeys = Object.keys(after || {}).sort();
  assert.deepEqual(afterKeys, beforeKeys);
  for (const key of beforeKeys)
    collectStringChanges(before[key], after[key], [...path, key], changes);
  return changes;
}

function preserveFormatting(baseBytes, changes) {
  let output = baseBytes.toString("utf8");
  const replacements = new Map();
  for (const change of changes) {
    const prior = replacements.get(change.before);
    assert.ok(!prior || prior.after === change.after);
    replacements.set(change.before, {
      after: change.after,
      expectedOccurrences: (prior?.expectedOccurrences || 0) + 1,
    });
  }
  for (const [before, replacement] of replacements) {
    const token = `"${before}"`;
    const matches = output.split(token).length - 1;
    assert.equal(matches, replacement.expectedOccurrences);
    output = output.split(token).join(`"${replacement.after}"`);
  }
  return Buffer.from(output);
}

function deriveContract(definition, reconstructedById) {
  const preGapBytes = gitRead(preGapCommit, definition.path);
  const sourceBytes = gitRead(definition.sourceCommit, definition.path);
  assert.equal(
    sha256(sourceBytes),
    sha256(preGapBytes),
    `Declared semantic source commit drifted before ${definition.path}`,
  );
  const preGapDocument = parse(preGapBytes);
  const reconstructed = clone(preGapDocument);

  if (definition.id === "read_only_field_session_learning")
    hashMappedBaselines(reconstructed);
  else if (definition.id === "off_route_learning") {
    const upstream = reconstructedById.get("read_only_field_session_learning");
    assert.ok(upstream);
    reconstructed.upstreamReadOnlyLearning.contractSha256 =
      upstream.reconstructedRawSha256;
    hashProtectedObjectBaselines(reconstructed);
  } else hashProtectedObjectBaselines(reconstructed);

  const changes = collectStringChanges(preGapDocument, reconstructed);
  const reconstructedBytes = preserveFormatting(preGapBytes, changes);
  assert.deepEqual(parse(reconstructedBytes), reconstructed);

  const canonicalBytes = read(definition.path);
  const canonical = parse(canonicalBytes);
  const legacyBytes = gitRead(legacyProvenanceGapCommit, definition.path);
  const result = {
    id: definition.id,
    path: definition.path,
    preGapCommit,
    sourceCommit: definition.sourceCommit,
    sourceCommitRawSha256: sha256(sourceBytes),
    preGapMatchesSourceCommit: sourceBytes.equals(preGapBytes),
    preGapRawSha256: sha256(preGapBytes),
    legacyCommitRawSha256: sha256(legacyBytes),
    canonicalBeforeRepairRawSha256: sha256(canonicalBytes),
    reconstructedRawSha256: sha256(reconstructedBytes),
    canonicalSemanticSha256: semanticSha256(canonical),
    reconstructedSemanticSha256: semanticSha256(reconstructed),
    semanticIdentical: stable(canonical) === stable(reconstructed),
    byteIdentical: canonicalBytes.equals(reconstructedBytes),
    changedHashFields: changes,
    reconstructionSources: definition.reconstructionSources.map((path) => ({
      path,
      sha256: fileSha256(path),
    })),
    reconstructedBytes,
    reconstructed,
  };
  return result;
}

function deriveAdditionalConsumer(path) {
  const metadata = additionalConsumerMetadata[path] || {
    id: path,
    generator: null,
  };
  const canonicalBytes = read(path);
  const canonical = parse(canonicalBytes);
  const reconstructed = clone(canonical);
  if (
    Object.values(reconstructed.protectedBehaviorBaselines || {}).every(
      (baseline) => typeof baseline === "string",
    )
  )
    hashMappedBaselines(reconstructed);
  else hashProtectedObjectBaselines(reconstructed);
  const changes = collectStringChanges(canonical, reconstructed);
  const reconstructedBytes = preserveFormatting(canonicalBytes, changes);
  assert.deepEqual(parse(reconstructedBytes), reconstructed);
  return {
    id: metadata.id,
    path,
    generator: metadata.generator,
    canonicalBeforeRepairRawSha256: sha256(canonicalBytes),
    reconstructedRawSha256: sha256(reconstructedBytes),
    canonicalSemanticSha256: semanticSha256(canonical),
    reconstructedSemanticSha256: semanticSha256(reconstructed),
    semanticIdentical: stable(canonical) === stable(reconstructed),
    byteIdentical: canonicalBytes.equals(reconstructedBytes),
    changedHashFields: changes,
    reconstructedBytes,
    reconstructed,
  };
}

function assertContractSemantics(results) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const readOnly = byId.get("read_only_field_session_learning").reconstructed;
  const offRoute = byId.get("off_route_learning").reconstructed;
  const discovery = byId.get("discovery_mode_v2").reconstructed;
  const nearby = byId.get("nearby_context_v2").reconstructed;

  assert.equal(readOnly.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(readOnly.allowedOperations.modifyData, false);
  assert.equal(readOnly.allowedOperations.replaySessions, false);
  assert.equal(
    readOnly.productionSafety.productionRecommendationInfluenceActive,
    false,
  );
  assert.equal(offRoute.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(offRoute.readOnlySafety.modifyData, false);
  assert.equal(offRoute.readOnlySafety.modifyDashboard, false);
  assert.equal(offRoute.readOnlySafety.activateRecommendationInfluence, false);
  assert.equal(discovery.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(discovery.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(discovery.activationSafety.recommendationInfluenceActive, false);
  assert.equal(discovery.eligibilityContract.closedVerifiedEligible, false);
  assert.equal(nearby.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(nearby.outputContract.runtimeConsumptionAuthorized, false);
  assert.equal(nearby.activationSafety.recommendationReplacementActive, false);
  assert.equal(
    nearby.identityContract.duplicateRemovalBeforeRelationshipInference,
    true,
  );
}

function publicResult(result) {
  const { reconstructedBytes, reconstructed, ...publicFields } = result;
  return {
    ...publicFields,
    correctionRequired: !result.byteIdentical,
    comparisonResult: result.byteIdentical
      ? "IDENTICAL"
      : "CORRECTED_TO_INDEPENDENT_RECONSTRUCTION",
    finalCanonicalRawSha256: result.reconstructedRawSha256,
    finalCanonicalSemanticSha256: result.reconstructedSemanticSha256,
  };
}

function evidenceFor(
  results,
  additionalConsumers,
  integratedBase,
  protectedConsumerInventory,
) {
  return {
    evidenceVersion: "route-iq-intelligence-owner-provenance-repair-v1",
    batchId,
    status: provenanceStatus,
    legacyCommit: legacyProvenanceGapCommit,
    preGapCommit,
    integratedBase,
    ownershipStatement:
      "The legacy mixed-ownership commit remains disclosed. This evidence does not claim retroactive Intelligence ownership; it records a new independent Intelligence-owner derivation.",
    reconstructionMethod:
      "Rebuild each affected contract from its pre-gap semantic form, derive protected hashes from declared source paths, derive the off-route upstream hash from the independently reconstructed read-only contract, and compare the complete result semantically and byte-for-byte with the canonical file.",
    protectedConsumerInventory,
    contracts: results.map(publicResult),
    additionalProtectedConsumerScan: additionalConsumers.map(publicResult),
    methodologyConstraints: {
      requiredEvaluationOutcomes:
        "97 eligible, linked, scoreable evaluation outcomes after exclusions",
      requiredSampleAloneCanReachFounderReview: false,
      additionalRequiredGates: [
        "chronological_training_evaluation_separation",
        "calibration",
        "consecutive_window_stability",
        "segment_safety",
        "observational_baseline",
      ],
      calibrationBins: 5,
      minimumSupportedObservationsAcrossFivePopulatedBins: 100,
      sparseOrEmptyBinsMayBypassCoverage: false,
      causalUpliftOrRecommendationSuperiorityClaimAllowed: false,
      interpretation: "observational_only",
    },
    safety: {
      recommendationInfluence: "OFF",
      routeScoringChanged: false,
      routeGenerationChanged: false,
      representativeExposureChanged: false,
      prospectiveShadowCollectionStarted: false,
      productionConsumerIntroduced: false,
    },
  };
}

function atomicWrite(path, bytes) {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, bytes);
    renameSync(temporary, absolute);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function reconstructLegacyProtectedContracts({
  write = false,
  writeEvidence = false,
  integratedBase = null,
} = {}) {
  if (write || writeEvidence) {
    assert.equal(typeof integratedBase, "string");
    assert.match(integratedBase, /^[a-f0-9]{40}$/);
    assert.equal(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
        .toString("utf8")
        .trim(),
      integratedBase,
      "Owner synchronization must run against the declared integrated base.",
    );
  }

  const reconstructedById = new Map();
  const results = [];
  for (const definition of contractDefinitions) {
    const result = deriveContract(definition, reconstructedById);
    reconstructedById.set(definition.id, result);
    results.push(result);
  }
  assertContractSemantics(results);

  const legacyPaths = new Set(contractDefinitions.map(({ path }) => path));
  const discoveredProtectedConsumers = discoverProtectedConsumers();
  const additionalConsumers = discoveredProtectedConsumers
    .filter((path) => !legacyPaths.has(path))
    .map(deriveAdditionalConsumer);
  const evidence = evidenceFor(
    results,
    additionalConsumers,
    integratedBase,
    discoveredProtectedConsumers,
  );

  if (write) {
    for (const result of [...results, ...additionalConsumers])
      atomicWrite(result.path, result.reconstructedBytes);
  }
  if (writeEvidence)
    atomicWrite(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  return {
    batchId,
    status: provenanceStatus,
    integratedBase,
    contracts: results.map(publicResult),
    additionalProtectedConsumers: additionalConsumers.map(publicResult),
    discoveredProtectedConsumers,
    evidence,
    writesPerformed: write,
    evidenceWritten: writeEvidence,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes("--write");
  const writeEvidence = process.argv.includes("--write-evidence");
  const baseArgument = process.argv.find((value) =>
    value.startsWith("--integrated-base="),
  );
  const integratedBase = baseArgument?.slice("--integrated-base=".length) || null;
  const result = reconstructLegacyProtectedContracts({
    write,
    writeEvidence,
    integratedBase,
  });
  console.log(JSON.stringify(result, null, 2));
}
