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
const administrativeDispositionSpecificationPath =
  "intelligence/provenance/specifications/administrative-disposition-admission-v1.json";
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
    semanticRevision: "administrative_disposition_admission_v1",
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

function administrativeDispositionSpecification() {
  const specification = parse(read(administrativeDispositionSpecificationPath));
  assert.equal(
    specification.version,
    "route-iq-intelligence-administrative-disposition-admission-spec-v1",
  );
  assert.equal(specification.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.match(specification.semanticBaseCommit, /^[a-f0-9]{40}$/);
  assert.equal(specification.safety.recommendationInfluence, "OFF");
  assert.equal(specification.safety.routeScoringChanged, false);
  assert.equal(specification.safety.routeGenerationChanged, false);
  assert.equal(specification.safety.representativeExposureChanged, false);
  assert.equal(specification.safety.historicalArchiveRewriteAllowed, false);
  assert.equal(specification.safety.automaticZeroVisitExclusionAllowed, false);
  assert.equal(
    new Set(specification.requiredExcludedDomains).size,
    specification.requiredExcludedDomains.length,
  );
  return specification;
}

function renderProperty(name, value, indent = "  ") {
  const renderedValue = JSON.stringify(value, null, 2).replaceAll(
    "\n",
    `\n${indent}`,
  );
  return `${indent}${JSON.stringify(name)}: ${renderedValue}`;
}

function replaceOnce(source, marker, replacement, label) {
  const first = source.indexOf(marker);
  assert.notEqual(first, -1, `${label}: marker missing`);
  assert.equal(
    source.indexOf(marker, first + marker.length),
    -1,
    `${label}: marker is ambiguous`,
  );
  return `${source.slice(0, first)}${replacement}${source.slice(
    first + marker.length,
  )}`;
}

function insertBefore(source, marker, insertion, label) {
  return replaceOnce(source, marker, `${insertion}${marker}`, label);
}

function readOnlyDispositionAdmission(specification) {
  const disposition = specification.canonicalDisposition;
  const policy = specification.consumerPolicies.read_only_field_session_learning;
  return {
    schemaVersion: disposition.schemaVersion,
    excludedState: disposition.excludedState,
    authorizedReason: disposition.authorizedReason,
    disposedSessionAdmissionAllowed: policy.disposedSessionAdmissionAllowed,
    auditRecordRetentionRequired: policy.auditRecordRetentionRequired,
    sourceArchiveRewriteAllowed: policy.sourceArchiveRewriteAllowed,
    automaticZeroVisitExclusionAllowed:
      policy.automaticZeroVisitExclusionAllowed,
    unrelatedUndisposedZeroVisitSessionEligible:
      policy.unrelatedUndisposedZeroVisitSessionEligible,
    requiredExcludedDomains: [...specification.requiredExcludedDomains],
  };
}

function offRouteDispositionAdmission(specification) {
  const disposition = specification.canonicalDisposition;
  const policy = specification.consumerPolicies.off_route_learning;
  return {
    inheritedFromUpstreamReadOnlyLearning:
      policy.inheritedFromUpstreamReadOnlyLearning,
    schemaVersion: disposition.schemaVersion,
    excludedState: disposition.excludedState,
    disposedSessionObservationAllowed: policy.disposedSessionObservationAllowed,
    decisionSourceProjectionAllowed: policy.decisionSourceProjectionAllowed,
    representativeJudgmentProjectionAllowed:
      policy.representativeJudgmentProjectionAllowed,
    territoryOrCustomerMetricProjectionAllowed:
      policy.territoryOrCustomerMetricProjectionAllowed,
    recommendationInputProjectionAllowed:
      policy.recommendationInputProjectionAllowed,
    automaticZeroVisitExclusionAllowed:
      policy.automaticZeroVisitExclusionAllowed,
    unrelatedUndisposedZeroVisitSessionEligible:
      policy.unrelatedUndisposedZeroVisitSessionEligible,
  };
}

function shadowReadinessDispositionAdmission(specification) {
  const disposition = specification.canonicalDisposition;
  const policy = specification.consumerPolicies.shadow_decision_readiness;
  return {
    schemaVersion: disposition.schemaVersion,
    excludedState: disposition.excludedState,
    authorizedReason: disposition.authorizedReason,
    disposedSessionReadinessAdmissionAllowed:
      policy.disposedSessionReadinessAdmissionAllowed,
    disposedSessionEvaluationAdmissionAllowed:
      policy.disposedSessionEvaluationAdmissionAllowed,
    disposedSessionCalibrationAdmissionAllowed:
      policy.disposedSessionCalibrationAdmissionAllowed,
    disposedSessionBaselineAdmissionAllowed:
      policy.disposedSessionBaselineAdmissionAllowed,
    disposedSessionSegmentMetricAdmissionAllowed:
      policy.disposedSessionSegmentMetricAdmissionAllowed,
    disposedSessionRecommendationInputAllowed:
      policy.disposedSessionRecommendationInputAllowed,
    auditRecordRetentionRequired: policy.auditRecordRetentionRequired,
    automaticZeroVisitExclusionAllowed:
      policy.automaticZeroVisitExclusionAllowed,
    unrelatedUndisposedZeroVisitSessionEligible:
      policy.unrelatedUndisposedZeroVisitSessionEligible,
    requiredExcludedDomains: [...specification.requiredExcludedDomains],
  };
}

function applyLegacySemanticRevision(id, document, baseBytes, specification) {
  let text = baseBytes.toString("utf8");
  if (id === "read_only_field_session_learning") {
    document.administrativeDispositionAdmission =
      readOnlyDispositionAdmission(specification);
    document.allowedOperations.consumeAdministrativelyExcludedSessions =
      specification.consumerPolicies.read_only_field_session_learning
        .consumeAdministrativelyExcludedSessions;
    text = insertBefore(
      text,
      '  "learningPolicy": {',
      `${renderProperty(
        "administrativeDispositionAdmission",
        document.administrativeDispositionAdmission,
      )},\n`,
      `${id}: administrative disposition`,
    );
    text = replaceOnce(
      text,
      '    "consumeStressTestObservations": false\n',
      '    "consumeStressTestObservations": false,\n    "consumeAdministrativelyExcludedSessions": false\n',
      `${id}: excluded-session operation`,
    );
  } else if (id === "off_route_learning") {
    document.administrativeDispositionAdmission =
      offRouteDispositionAdmission(specification);
    document.readOnlySafety.consumeAdministrativelyExcludedSessions =
      specification.consumerPolicies.off_route_learning
        .consumeAdministrativelyExcludedSessions;
    text = insertBefore(
      text,
      '  "decisionSourceContract": {',
      `${renderProperty(
        "administrativeDispositionAdmission",
        document.administrativeDispositionAdmission,
      )},\n`,
      `${id}: administrative disposition`,
    );
    text = replaceOnce(
      text,
      '    "parseNotesIntoDecisionSource": false\n',
      '    "parseNotesIntoDecisionSource": false,\n    "consumeAdministrativelyExcludedSessions": false\n',
      `${id}: excluded-session safety`,
    );
  }
  const revisedBytes = Buffer.from(text);
  assert.deepEqual(parse(revisedBytes), document);
  return revisedBytes;
}

function applyShadowReadinessSemanticRevision(
  document,
  baseBytes,
  specification,
) {
  const policy = specification.consumerPolicies.shadow_decision_readiness;
  const additions = policy.protectedBaselineAdditions;
  for (const [name, path] of Object.entries(additions))
    document.protectedBehaviorBaselines[name] = { path, sha256: fileSha256(path) };
  for (const name of policy.requiredProtectedBehaviorBaselineKeyAdditions) {
    if (!document.requiredProtectedBehaviorBaselineKeys.includes(name)) {
      const insertionIndex =
        document.requiredProtectedBehaviorBaselineKeys.indexOf(
          "dataCoordinator",
        );
      assert.notEqual(insertionIndex, -1);
      document.requiredProtectedBehaviorBaselineKeys.splice(
        insertionIndex,
        0,
        name,
      );
    }
  }
  document.administrativeDispositionAdmission =
    shadowReadinessDispositionAdmission(specification);

  let text = baseBytes.toString("utf8");
  for (const [name, path] of Object.entries(additions)) {
    text = insertBefore(
      text,
      '    "dataRuntimeContract": {',
      `${renderProperty(name, { path, sha256: fileSha256(path) }, "    ")},\n`,
      `shadow readiness: ${name} baseline`,
    );
  }
  for (const name of policy.requiredProtectedBehaviorBaselineKeyAdditions) {
    text = insertBefore(
      text,
      '    "dataCoordinator",',
      `    ${JSON.stringify(name)},\n`,
      `shadow readiness: ${name} required key`,
    );
  }
  text = insertBefore(
    text,
    '  "outcomes": {',
    `${renderProperty(
      "administrativeDispositionAdmission",
      document.administrativeDispositionAdmission,
    )},\n`,
    "shadow readiness: administrative disposition",
  );
  const revisedBytes = Buffer.from(text);
  assert.deepEqual(parse(revisedBytes), document);
  return revisedBytes;
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
  const semanticSpecification = administrativeDispositionSpecification();
  const preGapBytes = gitRead(preGapCommit, definition.path);
  const sourceBytes = gitRead(definition.sourceCommit, definition.path);
  assert.equal(
    sha256(sourceBytes),
    sha256(preGapBytes),
    `Declared semantic source commit drifted before ${definition.path}`,
  );
  const preGapDocument = parse(preGapBytes);
  const semanticallyRevised = clone(preGapDocument);
  const semanticRevisionBytes = applyLegacySemanticRevision(
    definition.id,
    semanticallyRevised,
    preGapBytes,
    semanticSpecification,
  );
  const reconstructed = clone(semanticallyRevised);

  if (definition.id === "read_only_field_session_learning")
    hashMappedBaselines(reconstructed);
  else if (definition.id === "off_route_learning") {
    const upstream = reconstructedById.get("read_only_field_session_learning");
    assert.ok(upstream);
    reconstructed.upstreamReadOnlyLearning.contractSha256 =
      upstream.reconstructedRawSha256;
    hashProtectedObjectBaselines(reconstructed);
  } else hashProtectedObjectBaselines(reconstructed);

  const changes = collectStringChanges(semanticallyRevised, reconstructed);
  const reconstructedBytes = preserveFormatting(semanticRevisionBytes, changes);
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
    semanticRevision:
      definition.id === "read_only_field_session_learning" ||
      definition.id === "off_route_learning"
        ? {
            specificationPath: administrativeDispositionSpecificationPath,
            specificationSha256: fileSha256(
              administrativeDispositionSpecificationPath,
            ),
            specificationVersion: semanticSpecification.version,
            derivation: "historical_base_plus_owner_semantic_specification",
            targetHashesStoredInSpecification: false,
          }
        : null,
    reconstructionSources: definition.reconstructionSources.map((path) => ({
      path,
      sha256: fileSha256(path),
    })).concat(
      definition.id === "read_only_field_session_learning" ||
        definition.id === "off_route_learning"
        ? [
            {
              path: administrativeDispositionSpecificationPath,
              sha256: fileSha256(administrativeDispositionSpecificationPath),
            },
          ]
        : [],
    ),
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
  const semanticSpecification = administrativeDispositionSpecification();
  const canonicalBytes = read(path);
  const canonical = parse(canonicalBytes);
  const baseCommit = metadata.semanticRevision
    ? semanticSpecification.semanticBaseCommit
    : null;
  const baseBytes = baseCommit ? gitRead(baseCommit, path) : canonicalBytes;
  const semanticallyRevised = clone(parse(baseBytes));
  const semanticRevisionBytes = metadata.semanticRevision
    ? applyShadowReadinessSemanticRevision(
        semanticallyRevised,
        baseBytes,
        semanticSpecification,
      )
    : baseBytes;
  const reconstructed = clone(semanticallyRevised);
  if (
    Object.values(reconstructed.protectedBehaviorBaselines || {}).every(
      (baseline) => typeof baseline === "string",
    )
  )
    hashMappedBaselines(reconstructed);
  else hashProtectedObjectBaselines(reconstructed);
  const changes = collectStringChanges(semanticallyRevised, reconstructed);
  const reconstructedBytes = preserveFormatting(semanticRevisionBytes, changes);
  assert.deepEqual(parse(reconstructedBytes), reconstructed);
  return {
    id: metadata.id,
    path,
    generator: metadata.generator,
    reconstructionBaseCommit: baseCommit,
    reconstructionBaseRawSha256: sha256(baseBytes),
    semanticRevision: metadata.semanticRevision
      ? {
          id: metadata.semanticRevision,
          specificationPath: administrativeDispositionSpecificationPath,
          specificationSha256: fileSha256(
            administrativeDispositionSpecificationPath,
          ),
          specificationVersion: semanticSpecification.version,
          derivation: "historical_base_plus_owner_semantic_specification",
          targetHashesStoredInSpecification: false,
        }
      : null,
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
  const specification = administrativeDispositionSpecification();
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
  assert.deepEqual(
    readOnly.administrativeDispositionAdmission,
    readOnlyDispositionAdmission(specification),
  );
  assert.equal(
    readOnly.allowedOperations.consumeAdministrativelyExcludedSessions,
    false,
  );
  assert.equal(offRoute.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(offRoute.readOnlySafety.modifyData, false);
  assert.equal(offRoute.readOnlySafety.modifyDashboard, false);
  assert.equal(offRoute.readOnlySafety.activateRecommendationInfluence, false);
  assert.deepEqual(
    offRoute.administrativeDispositionAdmission,
    offRouteDispositionAdmission(specification),
  );
  assert.equal(
    offRoute.readOnlySafety.consumeAdministrativelyExcludedSessions,
    false,
  );
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

function assertAdditionalConsumerSemantics(additionalConsumers) {
  const specification = administrativeDispositionSpecification();
  const byId = new Map(
    additionalConsumers.map((result) => [result.id, result.reconstructed]),
  );
  const shadowReadiness = byId.get("shadow_decision_readiness");
  assert.ok(shadowReadiness);
  assert.deepEqual(
    shadowReadiness.administrativeDispositionAdmission,
    shadowReadinessDispositionAdmission(specification),
  );
  assert.equal(
    shadowReadiness.protectedBehaviorBaselines.dataArchiveRuntime.path,
    specification.consumerPolicies.shadow_decision_readiness
      .protectedBaselineAdditions.dataArchiveRuntime,
  );
  assert.ok(
    shadowReadiness.requiredProtectedBehaviorBaselineKeys.includes(
      "dataArchiveRuntime",
    ),
  );
  assert.equal(
    shadowReadiness.prospectiveRuntimeAdapter.currentState
      .recommendationInfluence,
    "OFF",
  );
  assert.equal(
    shadowReadiness.prospectiveRuntimeAdapter.readModel
      .recommendationInfluence,
    "OFF",
  );
  assert.equal(
    shadowReadiness.isolation.recommendationInfluence,
    "OFF",
  );
  assert.equal(
    shadowReadiness.administrativeDispositionAdmission
      .disposedSessionRecommendationInputAllowed,
    false,
  );
}

function publicResult(result) {
  const { reconstructedBytes, reconstructed, ...publicFields } = result;
  return {
    ...publicFields,
    canonicalBeforeRepairSemanticSha256: result.canonicalSemanticSha256,
    byteIdenticalBeforeRepair: result.byteIdentical,
    semanticIdenticalBeforeRepair: result.semanticIdentical,
    correctionRequired: !result.byteIdentical,
    comparisonResult: result.byteIdentical
      ? "IDENTICAL"
      : "CORRECTED_TO_INDEPENDENT_RECONSTRUCTION",
  };
}

function priorEvidenceForIntegratedBase(integratedBase) {
  if (!integratedBase) return null;
  try {
    const prior = JSON.parse(readText(evidencePath));
    if (prior.integratedBase === integratedBase) return prior;
    if (
      prior.legacyCommit !== legacyProvenanceGapCommit ||
      prior.preGapCommit !== preGapCommit ||
      prior.status !== provenanceStatus ||
      typeof prior.integratedBase !== "string" ||
      !/^[a-f0-9]{40}$/.test(prior.integratedBase)
    ) {
      return null;
    }
    execFileSync(
      "git",
      ["merge-base", "--is-ancestor", prior.integratedBase, integratedBase],
      { cwd: root },
    );
    return prior;
  } catch {
    return null;
  }
}

function retainBeforeRepairSnapshot(entry, priorEntry) {
  if (!priorEntry) return entry;
  return {
    ...entry,
    canonicalBeforeRepairRawSha256:
      priorEntry.canonicalBeforeRepairRawSha256,
    canonicalBeforeRepairSemanticSha256:
      priorEntry.canonicalBeforeRepairSemanticSha256 ||
      priorEntry.canonicalSemanticSha256,
    byteIdenticalBeforeRepair:
      priorEntry.byteIdenticalBeforeRepair ?? priorEntry.byteIdentical,
    semanticIdenticalBeforeRepair:
      priorEntry.semanticIdenticalBeforeRepair ?? priorEntry.semanticIdentical,
    correctionRequired: priorEntry.correctionRequired,
    comparisonResult: priorEntry.comparisonResult,
  };
}

function evidenceEntry(result, priorEntry) {
  const entry = publicResult(result);
  delete entry.canonicalSemanticSha256;
  delete entry.byteIdentical;
  delete entry.semanticIdentical;
  return retainBeforeRepairSnapshot(entry, priorEntry);
}

function evidenceFor(
  results,
  additionalConsumers,
  integratedBase,
  protectedConsumerInventory,
  priorEvidence,
) {
  const priorContracts = new Map(
    (priorEvidence?.contracts || []).map((entry) => [entry.path, entry]),
  );
  const priorAdditional = new Map(
    (priorEvidence?.additionalProtectedConsumerScan || []).map((entry) => [
      entry.path,
      entry,
    ]),
  );
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
      "Rebuild each legacy-affected contract from its pre-gap semantic form, apply the Intelligence-owned administrative-disposition admission specification without target hashes, reconstruct the shadow-readiness revision from its pre-revision base, derive protected hashes from declared source paths, derive the off-route upstream hash from the independently reconstructed read-only contract, and compare every complete result semantically and byte-for-byte with the canonical file.",
    semanticRevisionSpecification: {
      path: administrativeDispositionSpecificationPath,
      sha256: fileSha256(administrativeDispositionSpecificationPath),
      version: administrativeDispositionSpecification().version,
      semanticBaseCommit:
        administrativeDispositionSpecification().semanticBaseCommit,
      targetHashesStored: false,
    },
    protectedConsumerInventory,
    contracts: results.map((result) =>
      evidenceEntry(result, priorContracts.get(result.path)),
    ),
    additionalProtectedConsumerScan: additionalConsumers.map((result) =>
      evidenceEntry(result, priorAdditional.get(result.path)),
    ),
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

function recordAfterRepair(evidence, results, additionalConsumers) {
  const derived = new Map(
    [...results, ...additionalConsumers].map((result) => [result.path, result]),
  );
  for (const entries of [
    evidence.contracts,
    evidence.additionalProtectedConsumerScan,
  ]) {
    for (const entry of entries) {
      const result = derived.get(entry.path);
      assert.ok(result, entry.path);
      const canonicalAfterRepair = read(entry.path);
      const canonicalAfterRepairDocument = parse(canonicalAfterRepair);
      entry.canonicalAfterRepairRawSha256 = sha256(canonicalAfterRepair);
      entry.canonicalAfterRepairSemanticSha256 = semanticSha256(
        canonicalAfterRepairDocument,
      );
      entry.byteIdenticalAfterRepair = canonicalAfterRepair.equals(
        result.reconstructedBytes,
      );
      entry.semanticIdenticalAfterRepair =
        stable(canonicalAfterRepairDocument) === stable(result.reconstructed);
      assert.equal(entry.byteIdenticalAfterRepair, true, entry.path);
      assert.equal(entry.semanticIdenticalAfterRepair, true, entry.path);
      assert.equal(
        entry.canonicalAfterRepairRawSha256,
        entry.reconstructedRawSha256,
        entry.path,
      );
      assert.equal(
        entry.canonicalAfterRepairSemanticSha256,
        entry.reconstructedSemanticSha256,
        entry.path,
      );
    }
  }
  return evidence;
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
  assertAdditionalConsumerSemantics(additionalConsumers);
  const priorEvidence = priorEvidenceForIntegratedBase(integratedBase);
  const evidence = evidenceFor(
    results,
    additionalConsumers,
    integratedBase,
    discoveredProtectedConsumers,
    priorEvidence,
  );

  if (write) {
    for (const result of [...results, ...additionalConsumers])
      atomicWrite(result.path, result.reconstructedBytes);
  }
  recordAfterRepair(evidence, results, additionalConsumers);
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
