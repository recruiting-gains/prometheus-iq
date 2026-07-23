import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceBusinessArtifactManifestSchemaVersion = "route-iq-workspace-business-artifact-manifest-v1";
export const workspaceBusinessArtifactManifestRegistryVersion = "route-iq-workspace-business-artifact-manifest-registry-v1";
export const workspaceBusinessArtifactFallbackPolicy = "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(moduleDir, "../..");
const defaultRegistryPath = resolve(moduleDir, "route-iq-workspace-business-artifact-manifest-registry-v1.json");
const ID_PATTERN = /^[a-z][a-z0-9_]{2,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_STATES = new Set(["APPROVED", "PENDING_FOUNDER_APPROVAL", "APPROVED_SYNTHETIC_VALIDATION"]);
const CLASSIFICATIONS = new Set(["FOUNDER_FIELD_RESEARCH", "CUSTOMER_GOVERNED_DATA", "SYNTHETIC_NONCANONICAL"]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function exactKeys(value, expected, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_business_manifest_shape_invalid", `${scope} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail("route_iq_business_manifest_shape_invalid", `${scope} has unexpected or missing fields.`);
  }
}

function validTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function artifactRecords(payload, identityField) {
  const records = identityField === "google_place_id"
    ? payload?.production_candidates
    : payload?.records;
  if (!Array.isArray(records)) {
    fail("route_iq_business_manifest_artifact_invalid", "Manifest artifact does not contain the governed record array.");
  }
  return records;
}

function validateManifest(manifest, context, index) {
  const scope = `manifests[${index}]`;
  exactKeys(manifest, [
    "manifestId",
    "manifestVersion",
    "workspaceId",
    "operatingProfileId",
    "configurationVersion",
    "artifactType",
    "artifactPath",
    "artifactSha256",
    "recordIdentityField",
    "recordCount",
    "approvedRecordCount",
    "approvedRecordIds",
    "approvalState",
    "classification",
    "sourceProvenance",
    "freshness",
    "productionUseAuthorized",
    "demoFallbackAllowed",
    "crossWorkspaceFallbackAllowed"
  ], scope);
  for (const [field, value] of [
    ["manifestId", manifest.manifestId],
    ["workspaceId", manifest.workspaceId],
    ["operatingProfileId", manifest.operatingProfileId]
  ]) {
    if (!ID_PATTERN.test(value || "")) fail("route_iq_business_manifest_id_invalid", `${scope}.${field} is invalid.`);
  }
  if (manifest.manifestVersion !== workspaceBusinessArtifactManifestSchemaVersion
    || manifest.artifactType !== "approved_business_opportunity_roster"
    || !["google_place_id", "recordId"].includes(manifest.recordIdentityField)
    || !SHA256_PATTERN.test(manifest.artifactSha256 || "")
    || !APPROVAL_STATES.has(manifest.approvalState)
    || !CLASSIFICATIONS.has(manifest.classification)
    || manifest.demoFallbackAllowed !== false
    || manifest.crossWorkspaceFallbackAllowed !== false) {
    fail("route_iq_business_manifest_contract_invalid", `${scope} violates the governed manifest contract.`);
  }
  if (context.workspaceIds.has(manifest.workspaceId)) {
    fail("route_iq_business_manifest_workspace_duplicate", `Workspace ${manifest.workspaceId} has more than one canonical business artifact.`);
  }
  context.workspaceIds.add(manifest.workspaceId);
  if (!Number.isInteger(manifest.recordCount) || manifest.recordCount < 0
    || !Number.isInteger(manifest.approvedRecordCount) || manifest.approvedRecordCount < 0
    || !Array.isArray(manifest.approvedRecordIds)
    || manifest.approvedRecordCount !== manifest.approvedRecordIds.length
    || new Set(manifest.approvedRecordIds).size !== manifest.approvedRecordIds.length) {
    fail("route_iq_business_manifest_count_invalid", `${scope} record counts are invalid.`);
  }
  if (manifest.approvalState === "PENDING_FOUNDER_APPROVAL" && manifest.approvedRecordCount !== 0) {
    fail("route_iq_business_manifest_pending_approval_invalid", `${scope} cannot admit records while Founder approval is pending.`);
  }
  if (manifest.classification === "SYNTHETIC_NONCANONICAL" && manifest.productionUseAuthorized !== false) {
    fail("route_iq_business_manifest_synthetic_production_invalid", `${scope} cannot authorize synthetic production use.`);
  }
  exactKeys(manifest.sourceProvenance, ["producer", "producerVersion", "sourceSystem", "sourceRetrievedAt"], `${scope}.sourceProvenance`);
  exactKeys(manifest.freshness, ["maximumAgeHours", "evaluatedAt", "expiresAt", "state"], `${scope}.freshness`);
  if (!validTimestamp(manifest.sourceProvenance.sourceRetrievedAt)
    || !validTimestamp(manifest.freshness.evaluatedAt)
    || !validTimestamp(manifest.freshness.expiresAt)
    || !Number.isFinite(manifest.freshness.maximumAgeHours)
    || manifest.freshness.maximumAgeHours <= 0
    || manifest.freshness.maximumAgeHours > 24
    || !["FRESH", "STALE", "SYNTHETIC"].includes(manifest.freshness.state)) {
    fail("route_iq_business_manifest_freshness_invalid", `${scope} has an invalid freshness boundary.`);
  }

  const artifactPath = resolve(context.repoRoot, manifest.artifactPath);
  const artifactBytes = readFileSync(artifactPath);
  if (sha256(artifactBytes) !== manifest.artifactSha256) {
    fail("route_iq_business_manifest_hash_mismatch", `${scope} artifact hash does not match its immutable source.`);
  }
  const payload = JSON.parse(artifactBytes.toString("utf8"));
  const records = artifactRecords(payload, manifest.recordIdentityField);
  if (records.length !== manifest.recordCount) {
    fail("route_iq_business_manifest_count_mismatch", `${scope} source record count does not match.`);
  }
  const recordIds = records.map(record => String(record?.[manifest.recordIdentityField] || ""));
  if (recordIds.some(id => !id) || new Set(recordIds).size !== recordIds.length) {
    fail("route_iq_business_manifest_identity_invalid", `${scope} source identities are missing or duplicated.`);
  }
  const recordIdSet = new Set(recordIds);
  if (manifest.approvedRecordIds.some(id => !recordIdSet.has(id))) {
    fail("route_iq_business_manifest_approval_identity_invalid", `${scope} approves an identity outside its source artifact.`);
  }
  for (const id of manifest.approvedRecordIds) {
    if (context.approvedRecordIds.has(id)) {
      fail("route_iq_business_manifest_cross_workspace_overlap", `Approved identity ${id} appears in more than one workspace.`);
    }
    context.approvedRecordIds.add(id);
  }
}

export function validateWorkspaceBusinessArtifactManifestRegistry(registry, options = {}) {
  exactKeys(registry, ["schemaVersion", "registryVersion", "generatedAt", "fallbackPolicy", "manifests"], "registry");
  if (registry.schemaVersion !== workspaceBusinessArtifactManifestSchemaVersion
    || registry.registryVersion !== workspaceBusinessArtifactManifestRegistryVersion
    || registry.fallbackPolicy !== workspaceBusinessArtifactFallbackPolicy
    || !validTimestamp(registry.generatedAt)
    || !Array.isArray(registry.manifests)
    || registry.manifests.length < 2) {
    fail("route_iq_business_manifest_registry_invalid", "Workspace business artifact manifest registry is invalid.");
  }
  const context = {
    repoRoot: options.repoRoot || defaultRepoRoot,
    workspaceIds: new Set(),
    approvedRecordIds: new Set()
  };
  registry.manifests.forEach((manifest, index) => validateManifest(manifest, context, index));
  return structuredClone(registry);
}

export function loadWorkspaceBusinessArtifactManifestRegistry(options = {}) {
  const registry = JSON.parse(readFileSync(options.path || defaultRegistryPath, "utf8"));
  return validateWorkspaceBusinessArtifactManifestRegistry(registry, options);
}

export function getWorkspaceBusinessArtifactManifest(workspaceId, options = {}) {
  const registry = options.registry || loadWorkspaceBusinessArtifactManifestRegistry(options);
  const manifest = registry.manifests.find(candidate => candidate.workspaceId === workspaceId);
  if (!manifest) fail("route_iq_business_manifest_workspace_unknown", "No canonical approved-business artifact exists for this workspace.");
  if (manifest.demoFallbackAllowed || manifest.crossWorkspaceFallbackAllowed) {
    fail("route_iq_business_manifest_fallback_invalid", "Workspace business artifact permits an unauthorized fallback.");
  }
  return structuredClone(manifest);
}

export function approvedBusinessIdentitySet(workspaceId, options = {}) {
  return new Set(getWorkspaceBusinessArtifactManifest(workspaceId, options).approvedRecordIds);
}
