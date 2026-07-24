import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import {
  authorizeFounderWorkspaceAccessFromRegistry,
  validateRouteIqWorkspaceConfigurationRegistry
} from "../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs";
import {
  routeIqAugust1FounderAccessRole,
  validateRouteIqAugust1LaunchEnvelope
} from "../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs";
import {
  loadRouteIq72HourOnboardingRehearsal
} from "../data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal.mjs";
import {
  buildRouteIq72HourOnboardingRuntimeEvidence
} from "../workers/infrastructure/route-iq-72-hour-onboarding-runtime.js";
import {
  projectRouteIqWorkspaceZipCoverage
} from "../workers/infrastructure/route-iq-multi-company-runtime-authorization.js";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const readJson = path => JSON.parse(read(path));
const governancePath = "overwatch/governance/route-iq-private-dashboard-founder-review-repairs-v1.json";
const configurationPath = "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json";
const rehearsalConfigurationPath =
  "administration/workspace-configurations/route-iq-72-hour-onboarding-rehearsal-v1.json";
const launchEnvelopePath =
  "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope-v1.json";
const ownerEmails = Object.freeze({
  "Prometheus Administration": "administration@prometheus.local",
  "Prometheus Data": "data@prometheus.local",
  "Prometheus Dashboard": "dashboard@prometheus.local",
  "Prometheus Infrastructure": "infrastructure@prometheus.local"
});

function git(args) {
  return execFileSync("git", args, {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8"
  }).trim();
}

function summitRegistry(rehearsal, canonicalRegistry) {
  const registry = structuredClone(canonicalRegistry);
  registry.registryVersion = "route-iq-cross-industry-workspaces-v2.2.1";
  registry.provenance.configurationVersion = "v2.2.1";
  registry.workspaces[1] = rehearsal.workspaceConfiguration;
  registry.founderBoundary.authorizedWorkspaceIds = [
    "fitness_connection",
    rehearsal.workspaceConfiguration.workspaceId
  ];
  return validateRouteIqWorkspaceConfigurationRegistry(registry);
}

export function verifyOverwatchRouteIqPrivateDashboardFounderReviewRepairs() {
  const governance = readJson(governancePath);
  const registry = validateRouteIqWorkspaceConfigurationRegistry(readJson(configurationPath));
  const launch = validateRouteIqAugust1LaunchEnvelope(
    readJson(launchEnvelopePath),
    { workspaces: [] }
  );
  const rehearsalConfig = readJson(rehearsalConfigurationPath);
  const rehearsalData = loadRouteIq72HourOnboardingRehearsal({
    repoRoot: new URL("../", import.meta.url).pathname
  });

  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  for (const ownerCommit of governance.ownerCommits) {
    assert.equal(git(["merge-base", "--is-ancestor", ownerCommit.commit, "HEAD"]), "");
    const [authorName, authorEmail, subject] = git([
      "show",
      "-s",
      "--format=%an%n%ae%n%s",
      ownerCommit.commit
    ]).split("\n");
    assert.equal(authorName, ownerCommit.subsystem);
    assert.equal(authorEmail, ownerEmails[ownerCommit.subsystem]);
    assert.equal(subject, ownerCommit.subject);
  }
  assert.deepEqual(governance.founderAccess.authorizedWorkspaceIds, [
    "fitness_connection",
    "northstar_outside_sales_synthetic"
  ]);
  assert.deepEqual(registry.founderBoundary.authorizedWorkspaceIds,
    governance.founderAccess.authorizedWorkspaceIds);
  assert.equal(registry.founderBoundary.anthonyMappingStatus, "UNMAPPED");
  assert.equal(launch.state, "OFF");
  assert.deepEqual(launch.workspaceAdmissions, []);

  for (const workspaceId of governance.founderAccess.authorizedWorkspaceIds) {
    const authorization = authorizeFounderWorkspaceAccessFromRegistry({
      founderUserId: "user_cruz_founder",
      workspaceId
    }, registry);
    assert.equal(authorization.workspaceId, workspaceId);
    const projection = projectRouteIqWorkspaceZipCoverage({
      principal: {
        authorized: true,
        accessMode: "founder_explicit_workspace_read_only",
        workspaceId,
        operatingProfileId: authorization.operatingProfileId,
        userId: "user_cruz_founder",
        representativeId: "cruz",
        roleId: routeIqAugust1FounderAccessRole,
        capabilities: {
          operateOwnRoute: false,
          readWorkspaceOperations: true
        }
      },
      workspaceRegistry: registry
    });
    assert.equal(projection.workspaceId, workspaceId);
    assert.ok(projection.postalCodes.length > 0);
  }

  assert.equal(rehearsalConfig.workspaceConfiguration.workspaceId,
    governance.onboardingRehearsal.workspaceId);
  assert.equal(rehearsalData.manifest.workspaceId, governance.onboardingRehearsal.workspaceId);
  assert.equal(rehearsalData.manifest.companyId, governance.onboardingRehearsal.companyId);
  assert.equal(rehearsalData.manifest.operatingProfileId,
    governance.onboardingRehearsal.operatingProfileId);

  const evidence = buildRouteIq72HourOnboardingRuntimeEvidence({
    workspaceConfigurationRegistry: summitRegistry(rehearsalConfig, registry),
    principal: {
      authorized: true,
      workspaceId: rehearsalConfig.workspaceConfiguration.workspaceId,
      operatingProfileId: rehearsalConfig.workspaceConfiguration.operatingProfile.profileId,
      userId: "summit_rehearsal_rep_01",
      representativeId: "summit_rehearsal_rep_identity_01",
      roleId: "summit_rehearsal_representative"
    },
    runtimeAssets: {
      workspaceConfiguration: `/${rehearsalConfigurationPath}`,
      businessManifestRegistry:
        "/data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-manifest-registry-v1.json",
      businessRoster:
        "/data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-approved-business-roster-v1.json",
      businessHours:
        "/data/route-iq-72-hour-onboarding-rehearsal-v1/route-iq-72-hour-onboarding-rehearsal-business-hours-v1.json"
    },
    rehearsalStartedAt: "2026-07-23T12:00:00.000Z",
    automatedConfigurationStartedAt: "2026-07-23T12:05:00.000Z",
    automatedConfigurationCompletedAt: "2026-07-23T12:15:00.000Z",
    evidenceGeneratedAt: "2026-07-23T12:20:00.000Z"
  });
  assert.equal(evidence.elapsedEvidence.automatedConfigurationSeconds, 600);
  assert.equal(evidence.elapsedEvidence.elapsedSinceRehearsalStartSeconds, 1200);
  assert.equal(evidence.claimBoundary.seventyTwoHourStandardProven, false);
  assert.equal(evidence.safety.availabilityProviders, "OFF");
  assert.equal(evidence.safety.dailyScheduler, "OFF");

  assert.deepEqual(rehearsalData.registry.canonicalProductionBaseline.counts, {
    active: 0,
    reserve: 0,
    quarantine: 398
  });
  assert.deepEqual(governance.productionBoundary.dataCounts, {
    active: 0,
    reserve: 0,
    quarantine: 398
  });
  assert.equal(governance.productionBoundary.prospectiveCollection, "OFF");
  assert.equal(governance.productionBoundary.activeCohorts, 0);
  assert.equal(governance.productionBoundary.recommendationInfluence, "OFF");
  assert.equal(governance.productionBoundary.deploymentAuthorized, false);

  const dashboardRehearsalTest = read("tests/dashboard-summit-onboarding-rehearsal.test.mjs");
  for (const marker of [
    "390",
    "844",
    "formatEstimatedVisitDuration",
    "formatAvailabilityLabel",
    "routeIqDashboardRuntimeAssetKeys",
    "workspace.workspaceId"
  ]) assert.ok(dashboardRehearsalTest.includes(marker), `Dashboard rehearsal proof lacks ${marker}.`);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    founderWorkspaceCount: 2,
    rehearsalWorkspaceId: governance.onboardingRehearsal.workspaceId,
    automatedConfigurationSeconds: evidence.elapsedEvidence.automatedConfigurationSeconds,
    seventyTwoHourStandardProven: false,
    dataCounts: governance.productionBoundary.dataCounts,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    deploymentPerformed: false
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchRouteIqPrivateDashboardFounderReviewRepairs(), null, 2));
}
