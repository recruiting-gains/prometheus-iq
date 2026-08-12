import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildRouteIqEligibleSessionManifest
} from "../../data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs";
import {
  buildRouteIqGovernedMultiSessionLearning,
  canonicalRouteIqGovernedLearningJson
} from "../route-iq-governed-multi-session-learning.mjs";

const root = resolve(import.meta.dirname, "../..");
export const routeIqGovernedLearningArtifactPath =
  "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function sourceInputs() {
  const source = readJson(
    "data/route-iq-field-sessions-v1/route-iq-governed-learning-source-v1.json"
  );
  const archivePackages = source.sourceSessions.map(session => ({
    evidenceClassification: source.evidenceClassification,
    manifest: readJson(session.manifest),
    verifiedFieldSession: readJson(session.verifiedFieldSession),
    calculatedMetrics: readJson(session.calculatedMetrics),
    historyUpdates: readJson(session.historyUpdates),
    administrativeDisposition: session.administrativeDisposition,
    consumptionEligibility: session.consumptionEligibility,
    correctionChain: session.correctionChain
  }));
  return {
    ...source,
    archivePackages,
    workspaceRegistry: readJson(
      "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json"
    )
  };
}

export function buildCanonicalRouteIqGovernedLearningArtifact() {
  const input = sourceInputs();
  const eligibleSessionManifest = buildRouteIqEligibleSessionManifest(input);
  return buildRouteIqGovernedMultiSessionLearning({
    eligibleSessionManifest,
    archivePackages: input.archivePackages,
    workspaceRegistry: input.workspaceRegistry
  });
}

export function verifyCanonicalRouteIqGovernedLearningArtifact({ write = false } = {}) {
  const artifact = buildCanonicalRouteIqGovernedLearningArtifact();
  const path = resolve(root, routeIqGovernedLearningArtifactPath);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }
  const stored = readJson(routeIqGovernedLearningArtifactPath);
  if (canonicalRouteIqGovernedLearningJson(stored)
    !== canonicalRouteIqGovernedLearningJson(artifact)) {
    throw new Error("route_iq_governed_learning_artifact_stale");
  }
  return Object.freeze({
    status: "PASS",
    artifactId: artifact.artifactId,
    artifactSha256: artifact.artifactSha256,
    manifestSha256: artifact.eligibleSessionManifest.manifestSha256,
    sessions: artifact.eligibleSessionManifest.totals.sessions,
    visits: artifact.eligibleSessionManifest.totals.visits,
    recommendationInfluence: artifact.safety.recommendationInfluence,
    productionRuntimeActivated: artifact.safety.productionRuntimeActivated
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyCanonicalRouteIqGovernedLearningArtifact({
    write: process.argv.includes("--write")
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
