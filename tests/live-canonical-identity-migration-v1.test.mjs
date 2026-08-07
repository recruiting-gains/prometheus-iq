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
  assert.equal(governance.releasePreparation.publicRollback.artifactSha256,
    "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6");
  assert.deepEqual(governance.releasePreparation.deploymentOrder, [
    "prometheusrouteiq-website",
    "prometheus-iq"
  ]);
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
