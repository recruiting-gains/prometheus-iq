import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const baseline = "436d899d371b844585a61f232a7c371e33ef1174";
const read = path => readFileSync(resolve(root, path), "utf8");
const json = path => JSON.parse(read(path));

const publicIdentityPaths = [
  "landing.html",
  "src/main.jsx",
  "public-site-static/privacy/index.html",
  "public-site-static/terms/index.html",
  "public-site-static/data-deletion/index.html",
  "public-site-static/site.webmanifest",
  "public-site-static/site-20260701-brand-v2.webmanifest"
];

const currentOperationalIdentityPaths = [
  "README.md",
  "COMPANY_IDENTITY.md",
  "PRODUCT_VISION.md",
  "PROMETHEUS_CONSTITUTION.md",
  "PROMETHEUS_SYSTEM_MAP.md",
  "docs/route-iq-production-known-limitations-v1.md",
  "docs/route-iq-commercial-product-contract-v1.json",
  "docs/route-iq-public-positioning-claims-contract-v1.json",
  "administration/workflows/route-iq-first-customer-activation-v1.md",
  "administration/workflows/route-iq-paid-customer-revenue-lifecycle-v1.md",
  "data/qualified-prospects/README.md",
  "data/qualified-prospects/qualified-prospects.schema.json",
  "deploy/cloudflare-pages/README-DO-NOT-UPLOAD.txt",
  "sales/README.md",
  "social-media/founder-marketing-operating-system/brand-and-growth-strategy.md"
];

test("current public identity establishes Prometheus Route IQ and Prometheus.IQ", () => {
  for (const path of publicIdentityPaths) {
    const source = read(path);
    assert.match(source, /Prometheus Route IQ/u, path);
    assert.match(source, /Prometheus\.IQ/u, path);
    assert.doesNotMatch(source, /\bPrometheus IQ\b/u, path);
  }

  const landing = read("landing.html");
  assert.match(landing, /<title>Prometheus Route IQ \|/u);
  assert.match(landing, /og:site_name" content="Prometheus\.IQ"/u);
  const graph = JSON.parse(landing.match(/<script type="application\/ld\+json">([^<]+)<\/script>/u)[1])["@graph"];
  assert.equal(graph[0].name, "Prometheus.IQ");
  assert.equal(graph[1].name, "Prometheus Route IQ");
  assert.equal(graph[1].publisher["@id"], graph[0]["@id"]);
});

test("PWA and first private identity-bearing screen use the canonical full name", () => {
  const customerManifest = json("manifest.webmanifest");
  const founderManifest = json("manifest-founder.webmanifest");
  for (const manifest of [customerManifest, founderManifest]) {
    assert.equal(manifest.name, "Prometheus Route IQ by Prometheus.IQ");
    assert.equal(manifest.short_name, "Route IQ");
  }
  assert.equal(customerManifest.start_url, "/app");
  assert.equal(customerManifest.scope, "./");
  const dashboard = read("index.html");
  assert.match(dashboard, /<title>Prometheus Route IQ<\/title>/u);
  assert.match(dashboard, /<h1>Prometheus Route IQ<\/h1>/u);
  assert.match(dashboard, /<h1>Prometheus Route IQ access unavailable<\/h1>/u);
  assert.equal((dashboard.match(/\bPrometheus IQ\b/gu) || []).length, 1);
  assert.match(dashboard, /\["Prometheus Route IQ", "Prometheus IQ"\]\.includes\(report\.app\)/u);
});

test("new field reports use canonical identity while legacy reports remain readable", () => {
  const dashboard = read("index.html");
  const archive = read("data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs");
  assert.match(dashboard, /app: "Prometheus Route IQ"/u);
  assert.match(dashboard, /Prometheus Route IQ Daily Rep Summary/u);
  assert.match(dashboard, /prometheus-route-iq-\$\{report\.rep\.id\}-daily-report/u);
  assert.match(archive, /\["Prometheus Route IQ", "Prometheus IQ"\]\.includes\(report\.app\)/u);
  const governance = json("overwatch/governance/live-canonical-identity-migration-v1.json");
  assert.deepEqual(governance.dataCompatibility.fieldSessionArchiveIdentitySuccessor, {
    classification: "CANONICAL_REPORT_IDENTITY_COMPATIBILITY_SUCCESSOR",
    path: "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
    previousSha256: "631c48d6fb0193f2356113d70ace4a7dbd0bf85d16ef8bf3a5a737a9430ce80a",
    currentSha256: "4b682c744aa19fa53813dfac838a638810e55c3067033f1cf711e83df6ee73c3",
    ownerCommit: "a0856eb22bda483aa87f361ef9bb54d63b61e686",
    ownerSubsystem: "Prometheus Data",
    acceptedCurrentReportIdentity: "Prometheus Route IQ",
    acceptedHistoricalReportIdentity: "Prometheus IQ",
    retentionSemanticsChanged: false,
    storageSchemaChanged: false,
    historicalContractsRewritten: false
  });
});

test("current operational sources use the canonical identity and supersede entity blockers", () => {
  for (const path of currentOperationalIdentityPaths) {
    const source = read(path);
    assert.match(source, /Prometheus Route IQ|Prometheus\.IQ/u, path);
    assert.doesNotMatch(source, /\bPrometheus IQ\b/u, path);
  }
  const company = read("COMPANY_IDENTITY.md");
  assert.match(company, /Company: Prometheus\.IQ/u);
  assert.match(company, /Flagship product: Prometheus Route IQ/u);
  assert.match(company, /Route IQ may be used only after Prometheus Route IQ has been established/u);

  const model = json("administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json");
  assert.deepEqual(model.company, {
    proposedName: "Prometheus.IQ",
    registrationStatus: "SOLE_PROPRIETOR"
  });
  assert.equal(model.liveRevenue.requiredEvidence.some(item => item.evidenceId === "registered_legal_entity"), false);
  assert.equal(model.liveRevenue.requiredEvidence.some(item => item.evidenceId === "operator_business_identity_confirmed"), true);

  const commercial = json("docs/route-iq-commercial-product-contract-v1.json");
  assert.equal(commercial.productPortfolio.company, "Prometheus.IQ");
  assert.equal(commercial.productPortfolio.soleActiveProductDisplayName, "Prometheus Route IQ");
  const positioning = json("docs/route-iq-public-positioning-claims-contract-v1.json");
  assert.equal(positioning.portfolio.company.name, "Prometheus.IQ");
  assert.equal(positioning.portfolio.soleActiveProduct.name, "Prometheus Route IQ");

  const companionRuntime = read("prometheus-os/backend/server.js");
  assert.match(companionRuntime, /private Prometheus Route IQ Worker protected by Cloudflare Access/u);
  assert.equal((companionRuntime.match(/\bPrometheus IQ\b/gu) || []).length, 1);
});

test("notification and export labels change without changing routes, bindings, or CRM field keys", () => {
  const runtime = read("workers/infrastructure/route-iq-request-crm-runtime.js");
  const crm = read("crm/route-iq-request-crm.mjs");
  assert.match(runtime, /New Prometheus Route IQ request/u);
  assert.match(runtime, /A Prometheus Route IQ request was durably accepted for Prometheus\.IQ Founder review/u);
  assert.match(runtime, /filename="prometheus-route-iq-requests\./u);
  assert.match(runtime, /ROUTE_IQ_REQUEST_CRM_PATH = "\/api\/partner-intake"/u);
  assert.match(runtime, /ROUTE_IQ_REQUEST_CRM_BINDING = "ROUTE_IQ_REQUEST_CRM_COORDINATOR"/u);
  for (const field of ["receiptId", "submittedAt", "businessName", "contactName", "businessEmail", "acquisitionSource", "status"]) {
    assert.match(crm, new RegExp(`"${field}"`, "u"));
  }
});

test("current governance records the launch facts and keeps protected receipts immutable", () => {
  const governance = json("overwatch/governance/live-canonical-identity-migration-v1.json");
  assert.equal(governance.canonicalIdentity.company, "Prometheus.IQ");
  assert.equal(governance.canonicalIdentity.product, "Prometheus Route IQ");
  assert.equal(governance.canonicalIdentity.operatingForm, "SOLE_PROPRIETOR");
  assert.equal(governance.currentState.llcFormationLaunchBlocker, false);
  assert.equal(governance.currentState.einAcquisitionLaunchBlocker, false);
  assert.equal(governance.currentState.publicSocialLaunch, "COMPLETED_2026_08_06");
  assert.equal(governance.currentState.pagesPubliclyAvailable, true);
  assert.equal(governance.currentState.founderEmailDelivery, "PRODUCTION_PROVEN");
  assert.deepEqual(governance.protectedReceipts, [
    "riq_receipt_e74e57903a211291a9f1f37a",
    "riq_receipt_b06adcc8fb2a58449ecf52a3",
    "riq_receipt_ba75a444905b0f6e78624b30"
  ]);
  assert.deepEqual(governance.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    activeBusinesses: 0,
    reserveBusinesses: 0,
    quarantinedBusinesses: 398,
    companion: "DORMANT",
    anthonyMapped: false,
    stripeMode: "NON_LIVE",
    leadSubmissionsAuthorized: 0,
    crmMutationsAuthorized: 0,
    notificationAttemptsAuthorized: 0
  });
  assert.equal(governance.ownerCommitChain.length, 10);
  assert.deepEqual(
    governance.ownerCommitChain.map(item => item.subsystem),
    [
      "Prometheus Route IQ",
      "Prometheus Administration",
      "Prometheus Data",
      "Prometheus Website",
      "Prometheus Dashboard",
      "Prometheus Sales",
      "Prometheus Companion",
      "Prometheus Infrastructure",
      "Prometheus Infrastructure",
      "Prometheus Infrastructure"
    ]
  );
  assert.equal(governance.releasePreparation.publicDeploymentAssetsSha256,
    "93526aca609a237fe26ba69f11d786549623b186fe7f106f3bf998e476dd22cf");
  assert.equal(governance.releasePreparation.publicWorkflowContractSha256,
    "17ac6ac53220f77fe2d49339e7a93566c7c2419bb19c462200a2077f1df34ca7");
  assert.equal(governance.releasePreparation.publicWorkflowsChanged, false);
  assert.equal(governance.releasePreparation.publicRollback.artifactSha256,
    "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6");
  assert.deepEqual(governance.releasePreparation.packageReleaseWiringSuccessor, {
    classification: "LIVE_CANONICAL_IDENTITY_PACKAGE_SUCCESSOR",
    path: "package.json",
    previousSha256: "6a7434c52a2491f4820d18657aa2a2dcf92d02c3fdf910a365555aa096dd8e5d",
    currentSha256: "3c7c9a50ffed874d711085ec95c04eb525f2caee88975eca20385f243aafda87",
    ownerCommit: "e9971e6d5efc20ed9d0d2190949276cd38d1f50c",
    ownerParent: "c7dc84a39de41bc5d87c6f4bd47533a82b8f6f3f",
    ownerTree: "903deca544eb0b21dcaa16a18e044cc3f3890e2e",
    ownerSubsystem: "Prometheus Overwatch",
    historicalPackageWiringRewritten: false
  });
  assert.deepEqual(governance.releasePreparation.deploymentOrder, [
    "prometheusrouteiq-website",
    "prometheus-iq"
  ]);
  const verifierSuccessors =
    governance.historicalVerifierReconciliations.founderAttendedPackageVerifiers;
  assert.equal(verifierSuccessors.classification,
    "LIVE_CANONICAL_IDENTITY_VERIFIER_SUCCESSORS");
  assert.equal(verifierSuccessors.expectedCommitCount, 5);
  assert.deepEqual(verifierSuccessors.commits.map(item => item.commit), [
    "8e104a35fae77e4c6776793026fd61493c444f30",
    "05bd5ba8b74a1ba7efe5f4425fc7f13431bd7eb9",
    "7161581fa0ed3c4fd61214d8a3e238fb5f5958e3",
    "fcc2caa2f91c2cd01cec4b71aa4c05a54633842b",
    "a95950713e018a31044be6b26ba67c6b97e1d5e8"
  ]);
  assert.equal(verifierSuccessors.runtimeBehaviorChanged, false);
  assert.equal(verifierSuccessors.credentialAccessChanged, false);
  assert.equal(verifierSuccessors.productionMutationAuthorized, false);
});

test("historical evidence and stable identifiers are not rewritten", () => {
  const unchanged = execFileSync("/usr/bin/git", [
    "diff", "--name-only", `${baseline}..HEAD`, "--",
    "PROMETHEUS EXECUTIVE PACKAGE",
    "PROMETHEUS OPERATING SYSTEM",
    "SENDABLE LEADERSHIP PACKET",
    "overwatch/reports",
    "data/route-iq-field-sessions-v1/workspaces",
    "administration/registers/beta-testers.json",
    "administration/registers/stabilization-issues.json"
  ], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(unchanged, "");

  const governance = json("overwatch/governance/live-canonical-identity-migration-v1.json");
  for (const stable of [
    "prometheusrouteiq.com",
    "PrometheusRouteIQ/prometheus-iq",
    "prometheus-iq",
    "prometheusrouteiq-website",
    "ROUTE_IQ_REQUEST_CRM_COORDINATOR",
    "intake@prometheusrouteiq.com",
    "prometheusrouteiq@gmail.com",
    "riq_receipt_*"
  ]) assert.ok(governance.identityInventory.stableTechnicalIdentifiers.includes(stable), stable);
});
