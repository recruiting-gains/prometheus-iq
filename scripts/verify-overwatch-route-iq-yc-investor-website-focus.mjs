import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const governancePath = "overwatch/governance/route-iq-yc-investor-website-focus-v1.json";
const reportPath = "overwatch/reports/BATCH-20260719-002-route-iq-yc-investor-website-focus.json";
const startingCommit = "cb413fdf3a9676c238c02532261ffcf3a24f2b21";
const startingTree = "ccd8356a5f820df14c574ff2be5196459422acbe";
const ownerCommits = [
  "1172cd763e2ec81e45e647e338dbd77e0308bc13",
  "c6a7d760a6e5b088693ec5627a61b579ec540560",
  "cf3b5556a82383cd80cc9288c569c354d99f9ef4",
  "e2ea54a3eb8be96e3f0fb9d044da15fcfca0b308"
];
const ownerEmails = [
  "route-iq@prometheus.local",
  "intelligence@prometheus.local",
  "data@prometheus.local",
  "website@prometheus.local"
];
const overwatchPaths = [
  "overwatch/governance/route-iq-yc-investor-website-focus-v1.json",
  "overwatch/reports/BATCH-20260719-002-route-iq-yc-investor-website-focus.json",
  "package.json",
  "scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs",
  "tests/overwatch-route-iq-yc-investor-website-focus.test.mjs"
].sort();
const overwatchRepairPaths = [
  "package.json",
  "scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs"
].sort();

const read = path => readFileSync(resolve(root, path), "utf8");
const readBytes = path => readFileSync(resolve(root, path));
const readJson = path => JSON.parse(read(path));
const git = (...args) => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
}).trim();

function changedPaths(commit) {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").filter(Boolean).sort() : [];
}

function commitIdentity(commit) {
  const [author, committer] = git("show", "-s", "--format=%ae%n%ce", commit).split("\n");
  return { author, committer };
}

function verifyOwnership(governance, { requireOverwatchCommit }) {
  assert.equal(git("rev-parse", `${startingCommit}^{tree}`), startingTree);
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", startingCommit, "HEAD"], { cwd: root });
  const commits = git("rev-list", "--reverse", `${startingCommit}..HEAD`).split("\n").filter(Boolean);
  assert.deepEqual(commits.slice(0, ownerCommits.length), ownerCommits, "Owner commit order drifted.");
  assert.equal(git("rev-list", "--min-parents=2", `${startingCommit}..${ownerCommits.at(-1)}`), "", "Owner range contains a merge commit.");

  const dispatchedByCommit = new Map(
    governance.dispatchAudit.dispatches.filter(entry => entry.commit).map(entry => [entry.commit, entry])
  );
  for (let index = 0; index < ownerCommits.length; index += 1) {
    const commit = ownerCommits[index];
    const identity = commitIdentity(commit);
    assert.deepEqual(identity, { author: ownerEmails[index], committer: ownerEmails[index] });
    const dispatch = dispatchedByCommit.get(commit);
    assert.ok(dispatch, `Dispatch record missing for ${commit}.`);
    assert.deepEqual(changedPaths(commit), [...dispatch.files].sort(), `Changed-file ownership drifted for ${commit}.`);
  }

  const overwatchCommit = commits[ownerCommits.length];
  const overwatchRepairCommit = commits[ownerCommits.length + 1];
  if (requireOverwatchCommit) {
    assert.ok(overwatchCommit, "Overwatch release-gate commit is missing.");
    assert.deepEqual(commitIdentity(overwatchCommit), {
      author: "overwatch@prometheus.local",
      committer: "overwatch@prometheus.local"
    });
    assert.deepEqual(changedPaths(overwatchCommit), overwatchPaths);
    assert.equal(git("rev-parse", `${overwatchCommit}^`), ownerCommits.at(-1));
    if (overwatchRepairCommit) {
      assert.deepEqual(commitIdentity(overwatchRepairCommit), {
        author: "overwatch@prometheus.local",
        committer: "overwatch@prometheus.local"
      });
      assert.deepEqual(changedPaths(overwatchRepairCommit), overwatchRepairPaths);
      assert.equal(git("rev-parse", `${overwatchRepairCommit}^`), overwatchCommit);
    }
  }
  return {
    commits,
    overwatchCommit: overwatchCommit ?? null,
    overwatchRepairCommit: overwatchRepairCommit ?? null
  };
}

function verifyPositioningAndClaims(governance, report) {
  const route = readJson("docs/route-iq-public-positioning-claims-contract-v1.json");
  const intelligence = readJson("intelligence/contracts/route-iq-public-intelligence-claims-v1.json");
  const data = readJson("data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json");
  assert.equal(route.batchId, governance.batchId);
  assert.equal(route.fiveSecondPositioning.primaryBuyer.role, "field_operations_leader");
  assert.equal(route.fiveSecondPositioning.primaryUser.role, "field_representative");
  assert.equal(route.fiveSecondPositioning.primaryPublicAction, "REQUEST_ROUTE_IQ");
  assert.equal(route.portfolio.soleActiveProduct.name, "Route IQ");
  assert.equal(route.fitnessConnectionBoundary.classification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(route.fitnessConnectionBoundary.customerClaimAllowed, false);
  assert.equal(route.safetyState.recommendationInfluence, "OFF");
  assert.equal(route.safetyState.prospectiveCollection, "OFF");
  assert.equal(route.safetyState.activeProspectiveCohorts, 0);
  assert.equal(route.safetyState.recommendationReadiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(route.investorObjectionResolution.length, 10);

  assert.equal(intelligence.batchId, governance.batchId);
  assert.equal(intelligence.currentGovernedState.recommendationInfluence, "OFF");
  assert.equal(intelligence.currentGovernedState.prospectiveCollection, "OFF");
  assert.equal(intelligence.currentGovernedState.activeCohorts, 0);
  assert.equal(intelligence.currentGovernedState.shadowReadiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligence.audienceBoundary.publicWebsiteMayExposeShadowOutputs, false);
  assert.equal(intelligence.audienceBoundary.representativeMayReceiveShadowRecommendation, false);
  assert.equal(intelligence.safety.routeOrderingChanged, false);
  assert.equal(intelligence.safety.routeScoringChanged, false);

  assert.equal(data.batchId, governance.batchId);
  assert.equal(data.status, "canonical_data_claim_boundaries_verified_cross_owner_corroborated");
  assert.equal(report.scorecard.length, 11);
  assert.ok(report.scorecard.every(entry => entry.after > entry.before));
  assert.equal(report.investorObjections.length, 10);
  assert.deepEqual(
    report.investorObjections.filter(entry => entry.status === "unresolved_disclosed").map(entry => entry.rank),
    [6, 7]
  );
  assert.equal(report.unresolvedWeaknesses.length, 4);
}

function verifyPublicWebsite(governance) {
  const publicPaths = [
    "src/main.jsx",
    "landing.html",
    "public-site-static/privacy/index.html",
    "public-site-static/terms/index.html",
    "public-site-static/data-deletion/index.html",
    "public-site-static/site.webmanifest",
    "public-site-static/site-20260701-brand-v2.webmanifest",
    "deploy/prometheusrouteiq-website/index.html",
    "deploy/prometheusrouteiq-website/privacy/index.html",
    "deploy/prometheusrouteiq-website/terms/index.html",
    "deploy/prometheusrouteiq-website/data-deletion/index.html"
  ];
  const publicText = publicPaths.map(read).join("\n");
  for (const pattern of [
    /Smoothie Depot/iu,
    /\bGaia\b/u,
    /\bAthena\b/u,
    /Fitness Connection/iu,
    /franchise(?:e|ing)? expansion/iu,
    /AI operating system/iu,
    /automatic route improvement/iu,
    /next route improves/iu,
    /Prometheus IQ/iu
  ]) assert.doesNotMatch(publicText, pattern);

  const source = read("src/main.jsx");
  for (const required of [
    "<h1>Route IQ</h1>",
    "field operations leader accountable for distributed teams",
    "representative visiting businesses or locations every day",
    "The field knows more than the systems do.",
    "not another route planner, CRM, map, or generic AI assistant",
    "Governed field evidence",
    "Governed intelligence",
    "Qualified probability",
    "Human decision",
    "REQUEST ROUTE IQ",
    "See How Route IQ Works",
    "does not prove causal uplift or recommendation superiority",
    "recommendation influence is off",
    "prospective collection is off and active cohorts are zero",
    "Success is reported only after durable acceptance",
    "unique receipt confirms the accepted request"
  ]) assert.ok(source.includes(required), `Required public positioning is missing: ${required}`);

  const landing = read("landing.html");
  const deployIndex = read("deploy/prometheusrouteiq-website/index.html");
  for (const html of [landing, deployIndex]) {
    assert.match(html, /<title>Route IQ \| Field Evidence to Decision Intelligence<\/title>/u);
    assert.match(html, /<link rel="canonical" href="https:\/\/prometheusrouteiq\.com\/">/u);
    assert.match(html, /twitter:card" content="summary_large_image"/u);
    assert.match(html, /route-iq-field-operations-social\.jpg/u);
  }
  const structuredText = landing.match(/<script type="application\/ld\+json">([^<]+)<\/script>/u)?.[1];
  assert.ok(structuredText, "JSON-LD is missing.");
  const graph = JSON.parse(structuredText)["@graph"];
  assert.deepEqual(graph.map(item => item["@type"]), ["Organization", "SoftwareApplication"]);
  assert.equal(graph[0].name, "Prometheus");
  assert.equal(graph[1].name, "Route IQ");
  assert.equal(graph[1].audience.audienceType, "Field operations leaders and field representatives");

  for (const page of ["privacy", "terms", "data-deletion"]) {
    assert.deepEqual(
      readBytes(`public-site-static/${page}/index.html`),
      readBytes(`deploy/prometheusrouteiq-website/${page}/index.html`),
      `${page} source/deploy bytes drifted.`
    );
  }
  for (const path of [
    "_headers",
    "legal.css",
    "robots.txt",
    "route-iq-field-operations-social.jpg",
    "route-iq-field-operations.jpg",
    "site-20260701-brand-v2.webmanifest",
    "site.webmanifest",
    "sitemap.xml"
  ]) {
    assert.deepEqual(readBytes(`public-site-static/${path}`), readBytes(`deploy/prometheusrouteiq-website/${path}`), `${path} source/deploy bytes drifted.`);
  }

  for (const removed of [
    "src/IntelligenceScene.jsx",
    "deploy/prometheusrouteiq-website/site.js",
    "deploy/prometheusrouteiq-website/vendor/three.core.js",
    "deploy/prometheusrouteiq-website/vendor/three.module.js",
    "deploy/prometheusrouteiq-website/assets/IntelligenceScene-2Bf4FzIg.js"
  ]) assert.equal(existsSync(resolve(root, removed)), false, `Legacy public payload remains: ${removed}`);

  const scriptPath = deployIndex.match(/src="\/(assets\/landing-[^"]+\.js)"/u)?.[1];
  const cssPath = deployIndex.match(/href="\/(assets\/landing-[^"]+\.css)"/u)?.[1];
  assert.ok(scriptPath && cssPath, "Active Website assets are missing.");
  const javascriptBytes = statSync(resolve(root, "deploy/prometheusrouteiq-website", scriptPath)).size;
  const cssBytes = statSync(resolve(root, "deploy/prometheusrouteiq-website", cssPath)).size;
  const heroBytes = statSync(resolve(root, "deploy/prometheusrouteiq-website/route-iq-field-operations.jpg")).size;
  const logoBytes = statSync(resolve(root, "deploy/prometheusrouteiq-website/assets/prometheus-company-icon-512-Dq1atHWc.png")).size;
  const criticalBytes = javascriptBytes + cssBytes + heroBytes + logoBytes + Buffer.byteLength(deployIndex);
  assert.ok(javascriptBytes <= governance.performanceBudget.javascriptBytesMaximum);
  assert.ok(cssBytes <= governance.performanceBudget.cssBytesMaximum);
  assert.ok(heroBytes <= governance.performanceBudget.heroImageBytesMaximum);
  assert.ok(criticalBytes <= governance.performanceBudget.criticalFirstLoadBytesMaximum);
  assert.doesNotMatch(read(`deploy/prometheusrouteiq-website/${scriptPath}`), /WebGLRenderer|IntelligenceScene|Fitness Connection|Smoothie Depot|\bGaia\b|\bAthena\b/u);
  return { javascriptBytes, cssBytes, heroBytes, criticalBytes };
}

function verifyCrmAndSafety(governance) {
  const crm = readJson("crm/route-iq-request-crm-contract-v1.json");
  const runtime = readJson("workers/infrastructure/route-iq-request-crm-runtime-v1.json");
  assert.deepEqual(crm.canonicalFields, [
    "businessName", "contactName", "businessEmail", "phone", "businessType", "numberOfLocations",
    "estimatedUsers", "territory", "primaryProblem", "desiredTimeline", "consent", "submittedAt", "acquisitionSource"
  ]);
  assert.equal(crm.durability.requiresAtomicPutIfAbsent, true);
  assert.equal(crm.durability.identicalRetryReturnsOriginalReceipt, true);
  assert.equal(crm.durability.changedIdempotencyRetryFailsClosed, true);
  assert.deepEqual(crm.exports, ["json", "csv"]);
  assert.equal(crm.monitoring.failureMetadataContainsRequestPii, false);
  assert.equal(crm.authorization.retrievalAndExport, "founder_only");
  assert.equal(crm.authorization.displayNameAuthorizationProhibited, true);
  assert.equal(crm.minimalPii.unknownFieldsRejected, true);
  assert.equal(crm.minimalPii.secretsAccepted, false);

  assert.equal(runtime.publicIntake.method, "POST");
  assert.equal(runtime.storage.backend, "sqlite_backed_durable_object");
  assert.equal(runtime.storage.atomicPutIfAbsent, "durable_object_storage_transaction");
  assert.equal(runtime.storage.productionProvisioned, false);
  assert.equal(runtime.notification.afterDurablePersistence, true);
  assert.equal(runtime.notification.contactPiiIncluded, false);
  assert.equal(runtime.notification.deliveryFailureIsMonitored, true);
  assert.equal(runtime.founderAccess.displayNameAuthorization, false);
  assert.equal(runtime.founderAccess.representativeAccess, false);
  assert.equal(runtime.boundaries.prospectiveCollection, "OFF");
  assert.equal(runtime.boundaries.activeCohorts, 0);
  assert.equal(runtime.boundaries.recommendationInfluence, "OFF");
  assert.equal(runtime.boundaries.deploymentPerformed, false);
  assert.equal(governance.crmBoundary.productionStorageActivationAuthorized, false);
}

export function verifyOverwatchRouteIqYcInvestorWebsiteFocus({
  requireClean = true,
  requireOverwatchCommit = true
} = {}) {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  assert.equal(governance.batchId, "BATCH-20260719-002");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.startingRepositoryState.commit, startingCommit);
  assert.equal(governance.startingRepositoryState.tree, startingTree);
  assert.equal(governance.dispatchAudit.implementationOwnershipRespected, true);
  assert.equal(governance.dispatchAudit.overwatchModifiedSubsystemImplementation, false);
  assert.equal(governance.publicPositioning.company, "Prometheus");
  assert.equal(governance.publicPositioning.soleActiveProduct, "Route IQ");
  assert.equal(governance.publicPositioning.primaryAction, "REQUEST_ROUTE_IQ");
  assert.equal(governance.safetyState.recommendationInfluence, "OFF");
  assert.equal(governance.safetyState.prospectiveCollection, "OFF");
  assert.equal(governance.safetyState.activeCohorts, 0);
  assert.equal(governance.releaseBoundary.deploymentAuthorized, false);

  const ownership = verifyOwnership(governance, { requireOverwatchCommit });
  verifyPositioningAndClaims(governance, report);
  const performance = verifyPublicWebsite(governance);
  verifyCrmAndSafety(governance);
  if (requireClean) assert.equal(git("status", "--porcelain"), "", "Working tree is not clean.");

  return {
    status: "PASS",
    batchId: governance.batchId,
    acceptanceGates: 15,
    ownerCommits,
    overwatchCommit: ownership.overwatchCommit,
    overwatchRepairCommit: ownership.overwatchRepairCommit,
    scorecardCategories: report.scorecard.length,
    investorObjections: report.investorObjections.length,
    unresolvedDisclosures: report.investorObjections.filter(entry => entry.status === "unresolved_disclosed").length,
    performance,
    recommendationInfluence: governance.safetyState.recommendationInfluence,
    prospectiveCollection: governance.safetyState.prospectiveCollection,
    activeCohorts: governance.safetyState.activeCohorts,
    deploymentPerformed: false
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = verifyOverwatchRouteIqYcInvestorWebsiteFocus();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
