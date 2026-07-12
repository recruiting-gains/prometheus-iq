import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRouteIqFieldSessionArchivePackage,
  routeIqFieldSessionArchiveVersion
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");

function argument(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`Missing required --${name}=... argument.`);
  return value;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

const sourcePath = resolve(requiredArgument("source"));
const evidencePath = resolve(requiredArgument("stress-evidence"));
const outputRoot = resolve(repoRoot, argument("output-root", "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions"));
const ingestedAt = requiredArgument("ingested-at");
const rawReportText = readFileSync(sourcePath, "utf8");

const runtimePools = readJson(resolve(repoRoot, "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json"));
const activePool = readJson(resolve(repoRoot, "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json"));
const businessHours = readJson(resolve(repoRoot, "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"));
const stressTestEvidence = readJson(evidencePath);

const preliminary = createRouteIqFieldSessionArchivePackage({
  rawReportText,
  originalFileName: basename(sourcePath),
  canonicalRawArtifactPath: "pending",
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  finalExportConfirmed: process.argv.includes("--confirm-final"),
  finalityBasis: "Founder-designated final Today report; unique matching local export generated at 2026-07-12T00:25:44.676Z.",
  ingestedAt,
  runtimePools,
  activePool,
  businessHours,
  stressTestEvidence
});

const sessionRoot = resolve(outputRoot, preliminary.sessionId);
const rawPath = resolve(sessionRoot, "raw", basename(sourcePath));
const canonicalRawArtifactPath = rawPath.slice(repoRoot.length + 1);
const archivePackage = createRouteIqFieldSessionArchivePackage({
  rawReportText,
  originalFileName: basename(sourcePath),
  canonicalRawArtifactPath,
  workspaceId: "fitness_connection",
  operatingProfileId: "fitness",
  finalExportConfirmed: process.argv.includes("--confirm-final"),
  finalityBasis: "Founder-designated final Today report; unique matching local export generated at 2026-07-12T00:25:44.676Z.",
  ingestedAt,
  runtimePools,
  activePool,
  businessHours,
  stressTestEvidence
});

mkdirSync(dirname(rawPath), { recursive: true });
if (existsSync(rawPath)) {
  const existing = readFileSync(rawPath, "utf8");
  if (existing !== rawReportText) throw new Error(`Append-only raw artifact already exists with different bytes: ${rawPath}`);
} else {
  copyFileSync(sourcePath, rawPath);
}

const normalizedPath = resolve(sessionRoot, "normalized", "field-session.json");
const calculatedPath = resolve(sessionRoot, "normalized", "calculated-metrics.json");
const stressPath = resolve(sessionRoot, "evidence", "stress-test-observations.json");
const historyPath = resolve(sessionRoot, "normalized", "history-updates.json");
writeJson(normalizedPath, archivePackage.normalizedRecord);
writeJson(calculatedPath, archivePackage.calculatedMetrics);
writeJson(stressPath, archivePackage.stressTestEvidence);
writeJson(historyPath, archivePackage.historyUpdates);

const manifest = {
  schemaVersion: routeIqFieldSessionArchiveVersion,
  sessionId: archivePackage.sessionId,
  workspaceId: archivePackage.normalizedRecord.workspaceId,
  operatingProfileId: archivePackage.normalizedRecord.operatingProfileId,
  representativeId: archivePackage.normalizedRecord.verifiedFields.representative.id,
  fieldSessionDate: archivePackage.normalizedRecord.verifiedFields.fieldSessionDate,
  status: "archived",
  sourceFinality: "founder_designated_final",
  rawSha256: archivePackage.rawSha256,
  rawByteLength: archivePackage.rawByteLength,
  ingestedAt,
  artifacts: {
    raw: canonicalRawArtifactPath,
    normalized: normalizedPath.slice(repoRoot.length + 1),
    calculatedMetrics: calculatedPath.slice(repoRoot.length + 1),
    stressTestEvidence: stressPath.slice(repoRoot.length + 1),
    historyUpdates: historyPath.slice(repoRoot.length + 1)
  },
  recordCounts: {
    fieldSessions: 1,
    completedVisits: archivePackage.normalizedRecord.verifiedFields.completedVisits.length,
    stressTestObservations: archivePackage.stressTestEvidence.observations.length,
    customerOutcomeHistoryEntries: archivePackage.historyUpdates.customerOutcomeHistory.length,
    categoryOutcomeHistoryEntries: archivePackage.historyUpdates.categoryOutcomeHistory.length
  },
  invariants: {
    rawEvidenceAppendOnly: true,
    rawAndNormalizedSeparated: true,
    verifiedAndCalculatedSeparated: true,
    dashboardBehaviorChanged: false,
    intelligenceScoringChanged: false,
    intelligenceRecommendationsChanged: false,
    automaticDashboardTriggerImplemented: false
  }
};
writeJson(resolve(sessionRoot, "manifest.json"), manifest);

console.log(JSON.stringify({
  status: "archived",
  sessionId: archivePackage.sessionId,
  rawSha256: archivePackage.rawSha256,
  rawArtifact: canonicalRawArtifactPath,
  visits: manifest.recordCounts.completedVisits,
  findings: manifest.recordCounts.stressTestObservations
}, null, 2));
