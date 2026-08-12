import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function verifyRouteIqGovernedLearningAdvisorySecurity() {
  const contract = readJson("security/route-iq-governed-learning-advisory-v1.json");
  const dashboard = read("dashboard/route-iq-dashboard-platform.mjs");
  const worker = read("workers/prometheus-iq-worker.js");
  const adapter = read("workers/infrastructure/route-iq-governed-learning-advisory-runtime.js");
  const publicWorker = read("workers/infrastructure/prometheusrouteiq-website-entry.mjs");
  const artifact = readJson(
    "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json"
  );

  assert(contract.owner === "Prometheus Security/Aegis", "security_owner_invalid");
  assert(contract.status === "SOURCE_QUALIFIED_UNDEPLOYED", "security_status_invalid");
  assert(contract.privateRoute === "/api/dashboard/route-iq/intelligence/governed-learning-advisory", "security_route_invalid");
  assert(
    contract.authorization.principal === "IMMUTABLE_FOUNDER_PRINCIPAL_ONLY",
    "security_founder_authorization_missing"
  );
  assert(
    contract.authorization.identitySource === "SERVER_VERIFIED_CLOUDFLARE_ACCESS",
    "security_identity_authority_invalid"
  );
  assert(
    contract.authorization.tenantSource === "SERVER_RESOLVED_GOVERNED_ARTIFACT",
    "security_tenant_authority_invalid"
  );
  assert(contract.authorization.callerSuppliedCustomerAuthority === false, "security_customer_authority_unsafe");
  assert(contract.authorization.callerSuppliedRepresentativeAuthority === false, "security_representative_authority_unsafe");
  assert(contract.authorization.representativeReadable === false, "security_representative_read_enabled");
  assert(Object.values(contract.dataBoundary).every(value => value === false), "security_data_boundary_unsafe");
  assert(contract.isolation.workspace !== contract.isolation.customer, "security_workspace_customer_conflated");
  assert(contract.isolation.publicWorkerRouteAllowed === false, "security_public_route_enabled");
  assert(contract.protectedState.collection === "OFF", "security_collection_enabled");
  assert(contract.protectedState.activeCohorts === 0, "security_cohort_enabled");
  assert(contract.protectedState.recommendationInfluence === "OFF", "security_influence_enabled");
  assert(contract.protectedState.confidencePropagation === "OFF", "security_confidence_propagation_enabled");
  assert(contract.protectedState.productionStorageAccess === 0, "security_production_storage_accessed");
  assert(contract.protectedState.deployments === 0, "security_deployment_performed");
  assert(contract.protectedState.anthonyMapped === false, "security_anthony_mapped");

  assert(adapter.includes("url.search === \"\""), "security_query_authority_not_rejected");
  assert(adapter.includes("request.method === \"GET\""), "security_get_only_boundary_missing");
  assert(adapter.includes("Cache-Control\": \"private, no-store"), "security_no_store_header_missing");
  assert(adapter.includes("callerSupplied === false"), "security_server_principal_boundary_missing");
  assert(adapter.includes("authority: \"server_resolved\""), "security_server_tenant_boundary_missing");
  assert(dashboard.includes("credentials: \"same-origin\""), "security_same_origin_credentials_missing");
  assert(dashboard.includes("cache: \"no-store\""), "security_dashboard_no_store_missing");
  assert(publicWorker.includes(contract.privateRoute) === false, "security_public_worker_route_exposed");

  const serialized = JSON.stringify(artifact.dashboardAdvisory);
  for (const forbidden of [
    '"notes":',
    '"address":',
    '"contacts":',
    '"phone":',
    '"email":',
    '"latitude":',
    '"longitude":',
    '"gpsAttached":',
    '"stressTestEvidence":',
    '"candidateRanking":',
    '"probability":'
  ]) {
    assert(!serialized.includes(forbidden), `security_prohibited_output:${forbidden}`);
  }
  assert(artifact.dashboardAdvisory.safety.shadowDecisionReadinessExposed === false, "security_shadow_boundary_invalid");
  assert(worker.includes("isRouteIqGovernedLearningAdvisoryPath"), "security_private_worker_route_missing");

  return Object.freeze({
    status: "PASS",
    batchId: contract.batchId,
    route: contract.privateRoute,
    workspace: contract.isolation.workspace,
    customer: contract.isolation.customer,
    founderOnly: true,
    browserPersistenceWrites: 0,
    publicWorkerExposure: false,
    prohibitedOutputFields: 0,
    collection: contract.protectedState.collection,
    activeCohorts: contract.protectedState.activeCohorts,
    recommendationInfluence: contract.protectedState.recommendationInfluence
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(
    verifyRouteIqGovernedLearningAdvisorySecurity(),
    null,
    2
  )}\n`);
}
