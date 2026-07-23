import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS,
  ROUTE_IQ_BUSINESS_AVAILABILITY_ENV,
  ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING
} from "../workers/infrastructure/route-iq-business-availability-contract.js";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    output += character;
  }
  return output;
}

function readJson(path) {
  return JSON.parse(read(path));
}

function readJsonc(path) {
  return JSON.parse(stripJsonComments(read(path)));
}

const privateConfig = readJsonc("wrangler.jsonc");
const publicConfig = readJsonc("wrangler.prometheusrouteiq-website.jsonc");
const worker = read("workers/prometheus-iq-worker.js");
const contract = read("workers/infrastructure/route-iq-business-availability-contract.js");
const coordinator = read("workers/infrastructure/route-iq-business-availability-durable-object.js");
const runtime = read("workers/infrastructure/route-iq-business-availability-runtime.js");
const sharedLead = read("workers/infrastructure/shared-lead-intake-pipeline.js");
const activation = readJson(
  "workers/infrastructure/route-iq-business-availability-activation-template-v1.json"
);
const rollback = readJson(
  "workers/infrastructure/route-iq-business-availability-forward-rollback-v1.json"
);
const administration = readJson(
  "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json"
);
const dataManifests = readJson(
  "data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json"
);
const integrations = read("integrations/business-hours-provider-adapter.js");

assert.equal(privateConfig.name, "prometheus-iq");
assert.equal(privateConfig.main, "workers/prometheus-iq-worker.js");
assert.equal(privateConfig.vars?.[ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.mode], "OFF");
assert.equal(Object.hasOwn(privateConfig.vars || {}, ROUTE_IQ_BUSINESS_AVAILABILITY_ENV.activation), false);
assert.equal(Object.hasOwn(privateConfig, "triggers"), false);
assert.deepEqual(
  privateConfig.durable_objects.bindings.filter(binding => (
    binding.name === ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING
  )),
  [{
    name: ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
    class_name: ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS
  }]
);
assert.deepEqual(
  privateConfig.migrations.filter(migration => migration.tag === ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION),
  [{
    tag: ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
    new_sqlite_classes: [ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS]
  }]
);
assert.equal(privateConfig.migrations.some(migration => Object.hasOwn(migration, "deleted_classes")), false);
assert.equal(
  privateConfig.durable_objects.bindings.some(binding => (
    binding.name === "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR"
    && binding.class_name === "RouteIqProspectiveShadowCoordinator"
  )),
  true
);
assert.equal(
  privateConfig.migrations.some(migration => (
    migration.tag === "route-iq-prospective-shadow-sqlite-v1"
    && migration.new_sqlite_classes?.includes("RouteIqProspectiveShadowCoordinator")
  )),
  true
);
assert.equal(
  privateConfig.services?.some(binding => binding.binding === ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING)
    || false,
  false
);

const publicConfigText = JSON.stringify(publicConfig);
for (const value of [
  ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS,
  ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING
]) {
  assert.equal(publicConfigText.includes(value), false);
}

assert.match(worker, /handleRouteIqBusinessAvailabilityRequest/u);
assert.match(worker, /handleRouteIqBusinessAvailabilityScheduled/u);
assert.match(worker, /RouteIqBusinessAvailabilityCoordinator/u);
assert.match(runtime, /authorizeRouteIqCustomerPwaRequest/u);
assert.match(runtime, /method:\s*"GET"/u);
assert.doesNotMatch(runtime, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
assert.match(runtime, /redirect:\s*"manual"/u);
assert.match(runtime, /cache:\s*"no-store"/u);
assert.match(runtime, /authorizedTerritoryIds/u);
assert.match(runtime, /validateRouteIqBusinessAvailabilitySnapshot/u);
assert.match(coordinator, /projection_outbox/u);
assert.match(coordinator, /projection_commits/u);
assert.match(coordinator, /refresh_conflicts/u);
assert.match(coordinator, /REFRESH_FAILURE_RECORDED/u);
assert.match(coordinator, /transactionSync/u);
assert.match(coordinator, /authoritative_record_time/u);
assert.match(contract, /maximumFreshnessHours:\s*24/u);
assert.match(contract, /FOUNDER_FIELD_RESEARCH/u);
assert.doesNotMatch(contract, /workspaceId:\s*"fitness_connection"/u);
assert.doesNotMatch(contract, /workspaceId:\s*"northstar_outside_sales_synthetic"/u);

assert.equal(activation.defaultState, "OFF");
assert.equal(activation.productionActivationAuthorized, false);
assert.equal(activation.schedule.declaredInWrangler, false);
assert.equal(activation.schedule.automaticRefreshActive, false);
assert.equal(activation.runtime.coordinatorBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING);
assert.equal(activation.runtime.dataProducerBinding, ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING);
assert.equal(activation.safety.prospectiveCollection, "OFF");
assert.equal(activation.safety.activeCohorts, 0);
assert.equal(activation.safety.recommendationInfluence, "OFF");

assert.equal(rollback.deploymentAuthorized, false);
assert.equal(rollback.nativeCloudflareRollbackAllowed, false);
assert.equal(rollback.finalBundleDeferred, true);
assert.equal(rollback.inertRuntime.mode, "OFF");
assert.equal(rollback.statefulCompatibility.binding, ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING);
assert.equal(rollback.statefulCompatibility.class, ROUTE_IQ_BUSINESS_AVAILABILITY_CLASS);
assert.equal(rollback.statefulCompatibility.migrationTag, ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION);
assert.equal(rollback.statefulCompatibility.preserveNamespace, true);
assert.equal(rollback.statefulCompatibility.preserveAcceptedSnapshots, true);
assert.equal(rollback.statefulCompatibility.deletedClassesMigrationAllowed, false);
assert.equal(rollback.existingPrivateStatePreserved.prospectiveCollection, "OFF");
assert.equal(rollback.existingPrivateStatePreserved.activeCohorts, 0);
assert.equal(rollback.existingPrivateStatePreserved.recommendationInfluence, "OFF");

assert.deepEqual(
  administration.workspaces.map(workspace => workspace.workspaceId).sort(),
  ["fitness_connection", "northstar_outside_sales_synthetic"]
);
assert.deepEqual(
  dataManifests.manifests.map(manifest => manifest.workspaceId).sort(),
  ["fitness_connection", "northstar_outside_sales_synthetic"]
);
assert.equal(
  administration.workspaces.find(workspace => workspace.workspaceId === "fitness_connection")
    ?.company.relationshipClassification,
  "FOUNDER_FIELD_RESEARCH"
);
assert.equal(administration.safety.collection, "OFF");
assert.equal(administration.safety.activeCohorts, 0);
assert.equal(administration.safety.recommendationInfluence, "OFF");
assert.equal(administration.founderBoundary.anthonyMappingStatus, "UNMAPPED");

assert.match(integrations, /defaultMode:\s*BUSINESS_HOURS_PROVIDER_MODES\.OFF/u);
assert.match(integrations, /methods:\s*Object\.freeze\(\["GET"\]\)/u);
assert.match(integrations, /authorizedConsumerSubsystem:\s*"Prometheus Data"/u);
assert.match(integrations, /directEligibilityOutputAllowed:\s*false/u);
assert.match(integrations, /directRecommendationOutputAllowed:\s*false/u);

assert.match(sharedLead, /ROUTE_IQ_SHARED_LEAD_WORKSPACE_REGISTRY/u);
assert.doesNotMatch(sharedLead, /const WORKSPACES\s*=/u);

const assignedSources = [
  "workers/infrastructure/route-iq-business-availability-contract.js",
  "workers/infrastructure/route-iq-business-availability-durable-object.js",
  "workers/infrastructure/route-iq-business-availability-runtime.js",
  "workers/infrastructure/route-iq-business-availability-activation-template-v1.json",
  "workers/infrastructure/route-iq-business-availability-forward-rollback-v1.json",
  "workers/infrastructure/shared-lead-intake-pipeline.js",
  "workers/prometheus-iq-worker.js",
  "docs/route-iq-business-availability-infrastructure-v1.md",
  "wrangler.jsonc"
];
const retiredIdentifier = ["smooth", "ie", "_", "depot"].join("");
const retiredDisplay = ["smooth", "ie", " ", "depot"].join("");
for (const path of assignedSources) {
  const source = read(path).toLowerCase();
  assert.equal(source.includes(retiredIdentifier), false, path);
  assert.equal(source.includes(retiredDisplay), false, path);
}

const secretPatterns = [
  /(?:api|access|client)[_-]?(?:token|secret)\s*[:=]\s*["'][^"']+["']/iu,
  /authorization\s*[:=]\s*["']bearer\s+/iu,
  /cfut_[A-Za-z0-9_-]+/u
];
for (const path of assignedSources) {
  const source = read(path);
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, path);
}

console.log(JSON.stringify({
  status: "PASS",
  target: "prometheus-iq",
  mode: "OFF",
  binding: ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  migration: ROUTE_IQ_BUSINESS_AVAILABILITY_MIGRATION,
  scheduledTriggerDeclared: false,
  publicWorkerAffected: false,
  collection: "OFF",
  activeCohorts: 0,
  recommendationInfluence: "OFF"
}, null, 2));
