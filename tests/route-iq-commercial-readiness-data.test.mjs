import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  authorizeFounderIntelligenceAccess,
  authorizeRouteIqOperationalAccess,
  createCommercialIsolationFixtureRegistry,
  getCommercialWorkspace,
  listNormalRouteIqWorkspaces,
  loadCommercialWorkspaceRegistry,
  RouteIqCommercialWorkspaceError,
  validateCommercialWorkspaceRegistry
} from "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry.mjs";
import {
  buildGovernedCodexEvidenceBundle,
  loadFitnessConnectionEvidencePreservationManifest,
  RouteIqGovernedCodexEvidenceError,
  stablePrettyJson,
  validateGovernedCodexEvidenceBundle,
  verifyFitnessConnectionEvidencePreservation
} from "../data/route-iq-commercial-readiness-v1/governed-codex-evidence-bundle.mjs";
import {
  routeIqRetentionAdministrativeDispositionTarget
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const registry = loadCommercialWorkspaceRegistry();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("commercial workspace registry makes Route IQ configuration-driven without business forks", () => {
  assert.equal(registry.product, "route_iq");
  assert.equal(registry.activeProduct, true);
  assert.equal(registry.recommendationInfluence, "OFF");
  assert.equal(registry.prospectiveCollection, "OFF");
  assert.equal(registry.workspaces.length, 3);

  const active = listNormalRouteIqWorkspaces(registry);
  assert.deepEqual(active, [{
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    displayName: "Fitness Connection Field Research",
    classification: "FOUNDER_FIELD_RESEARCH"
  }]);

  const fitness = getCommercialWorkspace("fitness_connection", { registry });
  assert.equal(fitness.workspaceState, "active_founder_research");
  assert.equal(fitness.business.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(fitness.evidenceGovernance.classification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(fitness.business.publicRelationshipClaimsAllowed, false);
  assert.equal(fitness.productionActivationAuthorized, false);
  assert.deepEqual(fitness.retention, {
    maximumCalendarMonths: 18,
    customerMayShorten: true,
    customerMayExpand: false,
    legalHoldSupported: true,
    deletionMode: "append_only_auditable_data_owned"
  });

  assert.throws(
    () => getCommercialWorkspace("smoothie_depot", { registry }),
    error => error instanceof RouteIqCommercialWorkspaceError
      && error.code === "route_iq_commercial_workspace_inactive"
  );
  const smoothie = getCommercialWorkspace("smoothie_depot", { registry, includeInactive: true });
  assert.equal(smoothie.workspaceState, "inactive_historical");
  assert.equal(smoothie.normalOperationVisible, false);
  assert.equal(smoothie.users.length, 0);
  assert.equal(smoothie.codexEvidence.bundleAuthorized, false);

  const roofing = getCommercialWorkspace("summit_roofing_synthetic", { registry, includeSynthetic: true });
  assert.equal(roofing.operatingProfileId, "roofing");
  assert.equal(roofing.business.businessType, "roofing_outside_sales");
  assert.equal(roofing.workspaceState, "synthetic_validation_only");
  assert.equal(roofing.productionActivationAuthorized, false);
  assert.equal(roofing.intelligenceEligibility.recommendationInfluence, "OFF");
});

test("Founder intelligence requires exact immutable authenticated principal identity", () => {
  const fitness = getCommercialWorkspace("fitness_connection", { registry });
  const cruz = fitness.users.find(user => user.representativeId === "cruz");
  const anthony = fitness.users.find(user => user.representativeId === "anthony");
  const authorized = authorizeFounderIntelligenceAccess({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    authenticatedPrincipalId: cruz.authenticatedPrincipalId
  }, { registry });
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.accessMode, "founder_read_only");
  assert.equal(authorized.recommendationInfluence, "OFF");
  assert.equal(authorized.authenticationBasis, "exact_immutable_authenticated_principal_id");

  assert.throws(
    () => authorizeFounderIntelligenceAccess({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      displayName: "Cruz Garza"
    }, { registry }),
    error => error instanceof RouteIqCommercialWorkspaceError
      && error.code === "route_iq_commercial_workspace_fields_invalid"
  );
  assert.equal(anthony.authenticatedPrincipalId, null);
  assert.equal(anthony.identityMappingStatus, "pending_exact_authenticated_identity");
  assert.throws(
    () => authorizeFounderIntelligenceAccess({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      authenticatedPrincipalId: null
    }, { registry }),
    error => error.code === "route_iq_commercial_workspace_authentication_required"
  );

  const mapped = clone(registry);
  const mappedAnthony = mapped.workspaces
    .find(workspace => workspace.workspaceId === "fitness_connection")
    .users.find(user => user.representativeId === "anthony");
  mappedAnthony.authenticatedPrincipalId = `riq_principal_${"a".repeat(64)}`;
  mappedAnthony.identityMappingStatus = "exact_authenticated_identity_mapped";
  const validated = validateCommercialWorkspaceRegistry(mapped);
  assert.equal(authorizeFounderIntelligenceAccess({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    authenticatedPrincipalId: mappedAnthony.authenticatedPrincipalId
  }, { registry: validated }).representativeId, "anthony");
});

test("representatives retain operational access but cannot read Founder intelligence", () => {
  const configured = clone(registry);
  const workspace = configured.workspaces.find(item => item.workspaceId === "fitness_connection");
  const principal = `riq_principal_${"b".repeat(64)}`;
  workspace.users.push({
    userId: "representative_fixture",
    representativeId: "rep_fixture",
    displayName: "Representative Fixture",
    roleId: "representative",
    authenticatedPrincipalId: principal,
    identityMappingStatus: "exact_authenticated_identity_mapped",
    analysisPseudonym: "riq_rep_bbbbbbbbbbbbbbbbbbbbbbbb",
    active: true,
    founderIntelligenceEligibility: false
  });
  const validated = validateCommercialWorkspaceRegistry(configured);
  assert.equal(authorizeRouteIqOperationalAccess({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    authenticatedPrincipalId: principal
  }, { registry: validated }).authorized, true);
  assert.throws(
    () => authorizeFounderIntelligenceAccess({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      authenticatedPrincipalId: principal
    }, { registry: validated }),
    error => error.code === "route_iq_commercial_workspace_capability_unauthorized"
  );
});

test("ten configured businesses and one hundred users remain identity-isolated", () => {
  const fixture = createCommercialIsolationFixtureRegistry({ workspaceCount: 10, usersPerWorkspace: 10 });
  assert.equal(fixture.workspaces.length, 10);
  assert.equal(fixture.workspaces.reduce((count, workspace) => count + workspace.users.length, 0), 100);
  const principals = fixture.workspaces.flatMap(workspace => workspace.users.map(user => user.authenticatedPrincipalId));
  assert.equal(new Set(principals).size, 100);
  const firstWorkspace = fixture.workspaces[0];
  const secondWorkspace = fixture.workspaces[1];
  const firstPrincipal = firstWorkspace.users[0].authenticatedPrincipalId;
  assert.equal(authorizeRouteIqOperationalAccess({
    workspaceId: firstWorkspace.workspaceId,
    operatingProfileId: firstWorkspace.operatingProfileId,
    authenticatedPrincipalId: firstPrincipal
  }, { registry: fixture, includeSynthetic: true }).workspaceId, firstWorkspace.workspaceId);
  assert.throws(
    () => authorizeRouteIqOperationalAccess({
      workspaceId: secondWorkspace.workspaceId,
      operatingProfileId: secondWorkspace.operatingProfileId,
      authenticatedPrincipalId: firstPrincipal
    }, { registry: fixture, includeSynthetic: true }),
    error => error.code === "route_iq_commercial_workspace_principal_unauthorized"
  );
  assert.throws(
    () => authorizeFounderIntelligenceAccess({
      workspaceId: firstWorkspace.workspaceId,
      operatingProfileId: firstWorkspace.operatingProfileId,
      authenticatedPrincipalId: firstPrincipal
    }, { registry: fixture, includeSynthetic: true }),
    error => error.code === "route_iq_commercial_workspace_capability_unauthorized"
  );
});

test("retention cannot exceed eighteen months and must preserve legal-hold rules", () => {
  const invalid = clone(registry);
  invalid.workspaces[0].retention.maximumCalendarMonths = 19;
  assert.throws(
    () => validateCommercialWorkspaceRegistry(invalid),
    error => error.code === "route_iq_commercial_workspace_retention_invalid"
  );
  const expansion = clone(registry);
  expansion.workspaces[0].retention.customerMayExpand = true;
  assert.throws(
    () => validateCommercialWorkspaceRegistry(expansion),
    error => error.code === "route_iq_commercial_workspace_retention_invalid"
  );
});

test("all repository Founder field evidence remains byte-identical", () => {
  const report = verifyFitnessConnectionEvidencePreservation({ repoRoot });
  assert.equal(report.status, "PRESERVED_BYTE_IDENTICAL");
  assert.equal(report.classification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(report.fileCount, 9);
  assert.equal(report.aggregateSha256, "f7c328fc5da300e70355a6363049323ca6699eab2c54a12f0f1ed83ff07a02fd");
  assert.deepEqual(report.accidentalArchiveBoundary, {
    sessionId: routeIqRetentionAdministrativeDispositionTarget.sessionId,
    rawByteLength: 560,
    rawSha256: routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256,
    protectedArtifactCount: routeIqRetentionAdministrativeDispositionTarget.protectedArtifactCount,
    reason: routeIqRetentionAdministrativeDispositionTarget.reason,
    state: routeIqRetentionAdministrativeDispositionTarget.state,
    repositoryRawRecordPresence: "NOT_STORED_IN_REPOSITORY",
    productionDispositionVerification: "NOT_READ_IN_THIS_BATCH"
  });

  const tamperedManifest = clone(loadFitnessConnectionEvidencePreservationManifest(repoRoot));
  tamperedManifest.files[0].sha256 = "0".repeat(64);
  assert.throws(
    () => verifyFitnessConnectionEvidencePreservation({ repoRoot, manifest: tamperedManifest }),
    error => error instanceof RouteIqGovernedCodexEvidenceError
      && error.code === "route_iq_evidence_preservation_hash_mismatch"
  );
});

test("governed Codex bundle is deterministic, integrity-bound, and redacted", () => {
  const first = buildGovernedCodexEvidenceBundle({ repoRoot });
  const second = buildGovernedCodexEvidenceBundle({ repoRoot });
  assert.equal(stablePrettyJson(first), stablePrettyJson(second));
  assert.equal(validateGovernedCodexEvidenceBundle(first), true);
  assert.equal(first.manifest.workspaceId, "fitness_connection");
  assert.equal(first.manifest.operatingProfileId, "fitness");
  assert.equal(first.manifest.relationshipClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(first.manifest.redactionStatus, "REDACTED_ALLOWLIST_ONLY");
  assert.equal(first.manifest.authorizedRecordCount, 4);
  assert.equal(first.manifest.sourceArtifactCount, 9);
  assert.equal(first.canonicalProductionDatabase, false);
  assert.equal(first.manifest.dataQualitySummary.recommendationReadinessClaimed, false);
  assert.equal(first.manifest.dataQualitySummary.causalUpliftClaimed, false);
  assert.ok(first.manifest.exclusions.some(item => item.exclusionCode === "ACCIDENTAL_ARCHIVE_EXCLUDED_FROM_ANALYTICS"));
  const bytes = stablePrettyJson(first);
  for (const forbiddenValue of [
    "Galachy Tire Shop",
    "Cruz Garza",
    "Comeback today at 6pm",
    "8774 Almeda Genoa",
    "googlePlaceId",
    "placeName",
    '"notes"',
    '"address"',
    '"gps"',
    '"email"',
    '"phone"'
  ]) {
    assert.equal(bytes.includes(forbiddenValue), false, forbiddenValue);
  }
  assert.equal(first.authorizedRecords.every(record => record.representativeRef.startsWith("riq_rep_")), true);
  assert.equal(first.authorizedRecords.every(record => record.businessRef.startsWith("riq_business_")), true);
});

test("Codex bundle respects time windows and fails closed on unauthorized workspaces", () => {
  const bundle = buildGovernedCodexEvidenceBundle({
    repoRoot,
    from: "2026-07-11T19:00:00.000Z",
    to: "2026-07-11T20:00:00.000Z"
  });
  assert.equal(bundle.authorizedRecords.length, 2);
  assert.equal(bundle.manifest.exclusions.at(-1).exclusionCode, "OUTSIDE_REQUESTED_EVIDENCE_WINDOW");
  assert.equal(bundle.manifest.exclusions.at(-1).recordCount, 2);
  assert.throws(
    () => buildGovernedCodexEvidenceBundle({ repoRoot, workspaceId: "smoothie_depot" }),
    error => error.code === "route_iq_commercial_workspace_inactive"
  );
  assert.throws(
    () => buildGovernedCodexEvidenceBundle({ repoRoot, workspaceId: "summit_roofing_synthetic" }),
    error => error.code === "route_iq_commercial_workspace_synthetic_only"
  );
});

test("one-command builder writes a private deterministic analysis artifact", () => {
  const directory = mkdtempSync(join(tmpdir(), "route-iq-codex-evidence-"));
  const output = join(directory, "bundle.json");
  const command = resolve(repoRoot, "scripts/build-route-iq-governed-codex-evidence-bundle.mjs");
  const receipt = JSON.parse(execFileSync(process.execPath, [command, "--output", output], {
    cwd: repoRoot,
    encoding: "utf8"
  }));
  const firstBytes = readFileSync(output, "utf8");
  const secondReceipt = JSON.parse(execFileSync(process.execPath, [command, "--output", output], {
    cwd: repoRoot,
    encoding: "utf8"
  }));
  assert.equal(receipt.status, "GOVERNED_CODEX_EVIDENCE_BUNDLE_READY");
  assert.equal(receipt.bundleId, secondReceipt.bundleId);
  assert.equal(readFileSync(output, "utf8"), firstBytes);
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.equal(sha256(firstBytes), sha256(stablePrettyJson(buildGovernedCodexEvidenceBundle({ repoRoot }))));
});
