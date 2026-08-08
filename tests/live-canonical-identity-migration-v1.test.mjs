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
  assert.deepEqual(governance.protectedConsumerSuccessors, [
    {
      classification: "LIVE_CANONICAL_IDENTITY_INTELLIGENCE_CONSUMER_REPAIR",
      subsystem: "Prometheus Intelligence Engine",
      owner: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      commit: "0515e5993547e5e1b3a0b5897f12ac53060a8b35",
      parent: "cad76ff923278a84245c42749c8d3d1cceb78f4d",
      tree: "4bcc06a1c15e74e8a7673d21afa8659721ee264a",
      subject: "intelligence: compose canonical archive successor",
      historicalEvidenceRewritten: false,
      intelligenceBehaviorChanged: false,
      recommendationInfluenceChanged: false,
      evidence: [
        {
          path: "scripts/verify-shadow-decision-readiness.mjs",
          previousSha256:
            "856b7f43150cc4eba0a9fee6d2df2f4254f32026dd64d92829cd4df74f17e364",
          currentSha256:
            "0ef3dff897cb9ed90dd90a81b55e09e7a8649153192c943fd595a8a1f144b12b"
        },
        {
          path: "tests/shadow-decision-readiness.test.mjs",
          previousSha256:
            "59cc3737e55222816115ef1608c7a43502894935f256a1bc4812d83dbc2c9cbb",
          currentSha256:
            "726510bdd55114d81ae0cc1290b884d851f6b1b5dc0b7107e0bd9f78e9e1b4b6"
        }
      ]
    },
    {
      classification: "LIVE_CANONICAL_IDENTITY_INTELLIGENCE_CONSUMER_REPAIR",
      subsystem: "Prometheus Intelligence Engine",
      owner: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      commit: "a6e85f05fe57a5bff8b2fc6bc168f541272ac0b8",
      parent: "c1d0cf056e6cd13689254a062636be783a1a66c7",
      tree: "efadb319180da76a28787843f7132252d7866625",
      subject: "intelligence: compose canonical protected consumers",
      historicalEvidenceRewritten: false,
      intelligenceBehaviorChanged: false,
      recommendationInfluenceChanged: false,
      evidence: [
        {
          path: "intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs",
          previousSha256:
            "89529db78c45767e77f2daa0fd88c20fb7eba6aed4293b333e1e0d1afe9801ce",
          currentSha256:
            "da7660a5e7e846f772ee9ef59d8bae502a2c43942a2eeec65639d4df9ba687cb"
        },
        {
          path: "tests/intelligence-architecture.test.mjs",
          previousSha256:
            "cc0512118357d6798d6f30c0cc540769e4839f8daeedd261f3a2c34332ac02d2",
          currentSha256:
            "dd7449ad92b8932b9d7dc0fe29d25f7f2e3a4b931726f1400d35156476e0a00c"
        }
      ]
    }
  ]);
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
  assert.deepEqual(governance.releasePreparation.privateWorkflowContinuitySuccessor, {
    classification: "LIVE_CANONICAL_IDENTITY_PRIVATE_WORKFLOW_SUCCESSOR",
    ownerCommit: "e6913bce779473417d06da128a19b89cee26936c",
    ownerParent: "38204f4889705c2b31ac36fa6280772c0c5b18e0",
    ownerTree: "d4a746da623979fa3059500a482bfe11d3bb6e74",
    owner: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    ownerSubsystem: "Prometheus Infrastructure",
    subject: "infrastructure: qualify canonical identity private payload",
    previousDeployParitySha256:
      "8967e7f269f415bf02921e094a010bccd742260d333c9717218b99936a07bbfa",
    currentDeployParitySha256:
      "a9c8837fb8978ee43f372f229f7b08286d8ebd2efce93e76971e8a39f47730f9",
    previousForwardPayloadSha256:
      "800e3ebe685d8b801d1b07a34c228ffe1ddea536623c67354d51fd9f601df7f6",
    currentForwardPayloadSha256:
      "5a5269a5a5669f87bacbe3f18f6783485f7f8da5ca2c0e3ffd57bbcca281ef51",
    rollbackBundleSha256:
      "ab76b6c7ffa0d3899e008c3f92fc41e61139f9a23d40c31d22609d80df919028",
    historicalContinuityRewritten: false,
    productionMutationAuthorized: false,
    evidence: [
      {
        path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
        previousSha256:
          "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
        currentSha256:
          "2bc9eb64d77ba28754ff00c33f5d7d72de844931a2dbfa34087feebe04a583de"
      },
      {
        path: "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
        previousSha256:
          "30810573fc0926c03a6bbc5337db4ce7030c419a4b08c64b219db7c3abeb371b",
        currentSha256:
          "936c4af96a9091fc5f785cf86b2b4a0b2a0a75d7b3cae9bf8a0959acdb59015e"
      }
    ]
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
