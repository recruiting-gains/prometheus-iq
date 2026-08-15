import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import {
  PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY,
  PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_HASH_ALGORITHM,
  hashPrometheusRouteIqGymPreviewAssets
} from "../workers/infrastructure/prometheusrouteiq-website-gym-preview-assets.mjs";
import {
  ROUTE_IQ_GYM_PREVIEW_INTAKE_PATH,
  ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID,
  ROUTE_IQ_GYM_PREVIEW_WORKER_NAME,
  handlePrometheusRouteIqGymPreviewRequest
} from "../workers/infrastructure/prometheusrouteiq-website-gym-preview-entry.mjs";

const root = resolve(import.meta.dirname, "..");
const now = new Date("2026-08-14T18:31:00.000Z");
const noIndex = "noindex, nofollow, noarchive, nosnippet";
const smokePaths = Object.freeze([
  "/",
  "/investors",
  "/thank-you",
  "/privacy/",
  "/terms/",
  "/data-deletion/"
]);

function gymPayload(overrides = {}) {
  return {
    version: "route-iq-gym-request.v1",
    formId: "route_iq_gym_request",
    fullName: "Jordan Rivera",
    gymName: "Iron Harbor Training",
    cityState: "Houston, TX",
    outsideRepCount: 4,
    workEmail: "jordan@ironharbor.example",
    cell: "+1 713 555 0148",
    consent: true,
    submittedAt: "2026-08-14T18:30:00.000Z",
    acquisitionSource: "route_iq_website",
    attribution: {
      utm_source: "reddit",
      utm_medium: "paid_social",
      utm_campaign: "gym_first_launch"
    },
    websiteUrl: "",
    ...overrides
  };
}

function gymRequest(payload = gymPayload(), init = {}) {
  return new Request(`https://prometheusrouteiq-website-gym-preview.example${ROUTE_IQ_GYM_PREVIEW_INTAKE_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

test("preview POST validates the gym contract and returns only a clearly synthetic canonical receipt", async () => {
  const inaccessibleEnvironment = new Proxy({}, {
    get() {
      assert.fail("Preview POST must not access any Worker binding.");
    }
  });
  const result = await handlePrometheusRouteIqGymPreviewRequest(
    gymRequest(),
    inaccessibleEnvironment,
    { now }
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("X-Robots-Tag"), noIndex);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await result.json(), {
    ok: true,
    version: "route-iq-request-crm-v1",
    contractVersion: "route-iq-gym-request.v1",
    receiptId: ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID,
    status: "synthetic_preview_only",
    duplicate: false,
    submittedAt: "2026-08-14T18:30:00.000Z",
    timestamp: "2026-08-14T18:30:00.000Z",
    synthetic: true,
    persisted: false,
    notificationSent: false
  });
  assert.equal(/^riq_receipt_[a-f0-9]{24}$/u.test(ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID), true);
  assert.equal(ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID.endsWith("0".repeat(24)), true);
});

test("preview POST rejects general, malformed, stale, spam, and oversized requests without touching assets", async () => {
  const inaccessibleEnvironment = new Proxy({}, {
    get() {
      assert.fail("Rejected API requests must not access any Worker binding.");
    }
  });
  const cases = [
    [
      gymRequest({
        version: "route-iq-public-request.v1",
        formId: "route_iq_request"
      }),
      422
    ],
    [gymRequest(gymPayload({ websiteUrl: "bot" })), 400],
    [gymRequest(gymPayload({ submittedAt: "2026-08-12T18:30:00.000Z" })), 422],
    [gymRequest("{not-json"), 400],
    [
      gymRequest("x".repeat(16 * 1024 + 1), {
        headers: { "Content-Type": "application/json" }
      }),
      413
    ]
  ];
  for (const [request, expectedStatus] of cases) {
    const result = await handlePrometheusRouteIqGymPreviewRequest(request, inaccessibleEnvironment, { now });
    const body = await result.json();
    assert.equal(result.status, expectedStatus);
    assert.equal(body.ok, false);
    assert.equal(body.synthetic, true);
    assert.equal(body.persisted, false);
    assert.equal(body.notificationSent, false);
    assert.equal(JSON.stringify(body).includes("Iron Harbor"), false);
  }
});

test("direct API routes never fall through while smoke GET and HEAD requests delegate only to ASSETS", async () => {
  const calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        calls.push({ method: request.method, url: request.url });
        return new Response(request.method === "HEAD" ? null : `asset:${new URL(request.url).pathname}`, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", "X-Origin": "asset-stub" }
        });
      }
    }
  };

  const apiGet = await handlePrometheusRouteIqGymPreviewRequest(
    new Request(`https://preview.example${ROUTE_IQ_GYM_PREVIEW_INTAKE_PATH}`),
    env
  );
  assert.equal(apiGet.status, 405);
  assert.equal(apiGet.headers.get("Allow"), "POST");
  assert.equal(calls.length, 0);

  const unknownApi = await handlePrometheusRouteIqGymPreviewRequest(
    new Request("https://preview.example/api/not-a-route"),
    env
  );
  assert.equal(unknownApi.status, 404);
  assert.equal(calls.length, 0);

  for (const path of smokePaths) {
    const get = await handlePrometheusRouteIqGymPreviewRequest(
      new Request(`https://preview.example${path}`),
      env
    );
    assert.equal(get.status, 200);
    assert.equal(await get.text(), `asset:${path}`);
    assert.equal(get.headers.get("X-Origin"), "asset-stub");
    assert.equal(get.headers.get("X-Robots-Tag"), noIndex);

    const head = await handlePrometheusRouteIqGymPreviewRequest(
      new Request(`https://preview.example${path}`, { method: "HEAD" }),
      env
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("X-Robots-Tag"), noIndex);
  }
  assert.deepEqual(calls, smokePaths.flatMap(path => [
    { method: "GET", url: `https://preview.example${path}` },
    { method: "HEAD", url: `https://preview.example${path}` }
  ]));

  const assetPost = await handlePrometheusRouteIqGymPreviewRequest(
    new Request("https://preview.example/gym", { method: "POST" }),
    env
  );
  assert.equal(assetPost.status, 405);
  assert.equal(assetPost.headers.get("Allow"), "GET, HEAD");
  assert.equal(calls.length, smokePaths.length * 2);
});

test("preview asset digest is deterministic, mutation-sensitive, and pinned to the exact committed directory", () => {
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/prometheusrouteiq-website-gym-preview-v1.json"),
    "utf8"
  ));
  const result = hashPrometheusRouteIqGymPreviewAssets();
  assert.deepEqual(result, {
    algorithm: PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_HASH_ALGORITHM,
    directory: PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY,
    fileCount: 26,
    totalBytes: 2470494,
    sha256: "4a148051d9deb34f9334c31b216120ce6665d1da30865e33725fcd7de6f7cf3b"
  });
  assert.deepEqual(contract.assetIntegrity, {
    directory: result.directory,
    algorithm: result.algorithm,
    fileCount: result.fileCount,
    totalBytes: result.totalBytes,
    sha256: result.sha256,
    source: "exact_committed_preview_asset_directory",
    binding: {
      commitInput: "candidate_commit",
      treeInput: "candidate_tree",
      qualificationOutput: "preview_assets_sha256",
      deploymentVerification: "recompute_equals_qualification_and_contract"
    }
  });

  const tracked = spawnSync("git", [
    "ls-files",
    "-z",
    "--",
    PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY
  ], { cwd: root, encoding: "utf8" });
  assert.equal(tracked.status, 0, tracked.stderr);
  const trackedFiles = tracked.stdout.split("\0").filter(Boolean);
  assert.equal(trackedFiles.length, result.fileCount);

  const temporaryRoot = mkdtempSync(join(tmpdir(), "route-iq-gym-preview-assets-"));
  const copiedDirectory = join(temporaryRoot, "assets");
  try {
    for (const sourcePath of [...trackedFiles].reverse()) {
      const relativePath = relative(
        PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY,
        sourcePath
      );
      const destination = join(copiedDirectory, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(root, sourcePath), destination);
    }
    assert.equal(hashPrometheusRouteIqGymPreviewAssets(copiedDirectory).sha256, result.sha256);
    appendFileSync(join(copiedDirectory, "index.html"), "\nsynthetic-mutation");
    assert.notEqual(hashPrometheusRouteIqGymPreviewAssets(copiedDirectory).sha256, result.sha256);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("preview config and entrypoint expose only ASSETS and contain no production runtime imports", () => {
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/prometheusrouteiq-website-gym-preview-v1.json"),
    "utf8"
  ));
  const config = JSON.parse(readFileSync(
    resolve(root, "wrangler.prometheusrouteiq-website-gym-preview.jsonc"),
    "utf8"
  ));
  assert.deepEqual(Object.keys(config).sort(), [
    "$schema",
    "assets",
    "compatibility_date",
    "compatibility_flags",
    "main",
    "name",
    "preview_urls",
    "workers_dev"
  ].sort());
  assert.equal(config.name, ROUTE_IQ_GYM_PREVIEW_WORKER_NAME);
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.assets, {
    directory: "./deploy/prometheusrouteiq-website",
    binding: "ASSETS",
    run_worker_first: true,
    not_found_handling: "single-page-application"
  });
  assert.equal(contract.batchId, "BATCH-20260814-002");
  assert.equal(contract.previewWorker.name, config.name);
  assert.deepEqual(contract.previewWorker.allowedBindings, ["ASSETS"]);
  assert.equal(contract.previewWorker.runWorkerFirst, true);
  assert.equal(contract.assetIntegrity.sha256, hashPrometheusRouteIqGymPreviewAssets().sha256);
  assert.equal(contract.intake.receiptId, ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID);
  assert.equal(contract.intake.persistenceAllowed, false);
  assert.equal(contract.intake.emailAllowed, false);
  assert.equal(contract.boundaries.productionDeploymentAllowed, false);
  assert.equal(contract.boundaries.crmBindingAllowed, false);
  const serialized = JSON.stringify(config);
  for (const forbidden of [
    "durable_objects",
    "kv_namespaces",
    "send_email",
    "vars",
    "routes",
    "route",
    "custom_domain",
    "migrations",
    "services",
    "version_metadata"
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  }

  const productionConfig = JSON.parse(readFileSync(
    resolve(root, "wrangler.prometheusrouteiq-website.jsonc"),
    "utf8"
  ));
  assert.equal(productionConfig.workers_dev, false);

  const entry = readFileSync(
    resolve(root, "workers/infrastructure/prometheusrouteiq-website-gym-preview-entry.mjs"),
    "utf8"
  );
  assert.match(entry, /crm\/route-iq-gym-intake\.mjs/u);
  assert.match(entry, /adaptRouteIqGymRequestForCrm/u);
  assert.match(entry, /env\?\.ASSETS\?\.fetch/u);
  assert.doesNotMatch(entry, /prometheus-iq-worker|route-iq-request-crm-runtime|route-iq-request-crm\.mjs/u);
  assert.doesNotMatch(entry, /persistRouteIqRequest|FOUNDER_EMAIL|send_email|waitUntil/u);
});

test("manual workflow binds one exact Founder main run to the preview target and only two secrets", () => {
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/prometheusrouteiq-website-gym-preview-v1.json"),
    "utf8"
  ));
  const workflow = readFileSync(
    resolve(root, ".github/workflows/preview-prometheus-route-iq-gym-first.yml"),
    "utf8"
  );
  assert.match(workflow, /^name: Preview Prometheus Route IQ Gym First$/mu);
  assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:/mu);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule|workflow_call|repository_dispatch):/mu);
  for (const required of [
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.sha == inputs.candidate_commit",
    "inputs.batch_id == 'BATCH-20260814-002'",
    "github.run_attempt == 1",
    'test "$(git rev-parse HEAD^{tree})" = "$CANDIDATE_TREE"',
    'test "$(git rev-parse refs/remotes/origin/main)" = "$CANDIDATE_COMMIT"',
    "group: preview-prometheus-route-iq-gym-first",
    "cancel-in-progress: false",
    "npm ci",
    "npm run build",
    "npm test",
    "npm run security:check",
    "npm run security:aegis:verify",
    "environment:",
    "name: prometheus-public-worker-preview",
    "preview_url:",
    "version_id:",
    "preview_assets_sha256:",
    "prometheusrouteiq-website-gym-preview-assets.mjs",
    "needs.qualify.outputs.preview_assets_sha256",
    "Preview assets SHA-256:",
    "$GITHUB_STEP_SUMMARY"
  ]) {
    assert.equal(workflow.includes(required), true, `Missing workflow control: ${required}`);
  }
  assert.equal((workflow.match(/github\.run_attempt == 1/gu) || []).length, 2);
  assert.equal((workflow.match(/name: prometheus-public-worker-preview/gu) || []).length, 1);
  assert.equal((workflow.match(/name: prometheus-public-worker-production/gu) || []).length, 0);
  assert.deepEqual(
    [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/gu)].map(match => match[1]),
    ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
  );
  assert.doesNotMatch(workflow, /\$GITHUB_ENV|vars\./u);
  assert.equal((workflow.match(/npm run build/gu) || []).length, 1);

  const bindStart = workflow.indexOf("- name: Bind exact committed preview assets to commit and tree");
  const bindEnd = workflow.indexOf("- name: Prove the preview-only Wrangler configuration", bindStart);
  assert.ok(bindStart >= 0 && bindEnd > bindStart);
  const binding = workflow.slice(bindStart, bindEnd);
  assert.match(binding, /candidate_commit=%s/u);
  assert.match(binding, /candidate_tree=%s/u);
  assert.match(binding, /preview_assets_sha256=%s/u);
  assert.match(binding, /Qualified Route IQ gym preview assets/u);
  assert.match(binding, /Preview assets SHA-256:/u);
  assert.match(binding, /\$GITHUB_STEP_SUMMARY/u);

  const deployJob = workflow.slice(workflow.indexOf("\n  deploy-preview:"));
  assert.doesNotMatch(deployJob, /npm run build/u);
  const liveDeploy = deployJob.indexOf("npx wrangler deploy --strict");
  const smokeStart = deployJob.indexOf("- name: Smoke exact preview routes with GET and HEAD only");
  const smokeEnd = deployJob.indexOf("- name: Require unchanged exact source", smokeStart);
  assert.ok(liveDeploy >= 0 && smokeStart > liveDeploy && smokeEnd > smokeStart);
  const smoke = deployJob.slice(smokeStart, smokeEnd);
  assert.match(smoke, /methods=\("GET" "HEAD"\)/u);
  assert.match(smoke, /--request GET/u);
  assert.match(smoke, /--head/u);
  assert.match(smoke, /test "\$status" = "200"/u);
  assert.match(smoke, /X-Robots-Tag:[^\n]+noindex/u);
  assert.match(smoke, /test "\$smoke_count" -eq 12/u);
  assert.doesNotMatch(smoke, /\bPOST\b|--location|--request (?!GET\b)/u);
  for (const path of smokePaths) assert.equal(smoke.includes(`"${path}"`), true);

  assert.deepEqual(contract.postDeploymentSmoke, {
    methods: ["GET", "HEAD"],
    paths: smokePaths,
    expectedStatus: 200,
    redirectsAllowed: false,
    requiredResponseHeader: {
      name: "X-Robots-Tag",
      contains: "noindex"
    },
    postAllowed: false
  });
  assert.deepEqual(contract.workflow.outputs, [
    "candidate_commit",
    "candidate_tree",
    "preview_url",
    "version_id",
    "preview_assets_sha256"
  ]);
  assert.deepEqual(contract.officialNode24ActionSuccessor, {
    classification: "NEW_WORKFLOW_OFFICIAL_NODE24_PIN_SUCCESSOR",
    path: ".github/workflows/preview-prometheus-route-iq-gym-first.yml",
    sha256: createHash("sha256").update(workflow).digest("hex"),
    absentAtNode24MigrationBaseline: true,
    checkout: {
      commit: "3d3c42e5aac5ba805825da76410c181273ba90b1",
      occurrences: 2
    },
    setupNode: {
      commit: "820762786026740c76f36085b0efc47a31fe5020",
      occurrences: 2,
      nodeVersion: "24.4.1"
    },
    permissions: { contents: "read" },
    movingActionTags: 0,
    thirdPartyActions: 0,
    cacheInputs: 0
  });
  assert.equal((workflow.match(
    /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/gu
  ) || []).length, 2);
  assert.equal((workflow.match(
    /uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/gu
  ) || []).length, 2);
  assert.equal((workflow.match(/node-version: "24\.4\.1"/gu) || []).length, 2);

  const invocations = workflow.split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line.startsWith("npx wrangler deploy "));
  assert.equal(invocations.length, 2);
  assert.equal(invocations.filter(line => !line.includes(" --dry-run ")).length, 1);
  for (const invocation of invocations) {
    assert.match(invocation, /--config wrangler\.prometheusrouteiq-website-gym-preview\.jsonc/u);
    assert.match(invocation, /--name prometheusrouteiq-website-gym-preview(?:\s|$)/u);
    assert.doesNotMatch(invocation, /--config wrangler\.jsonc(?:\s|$)/u);
    assert.doesNotMatch(invocation, /--config wrangler\.prometheusrouteiq-website\.jsonc(?:\s|$)/u);
    assert.doesNotMatch(invocation, /--name prometheus-iq(?:\s|$)/u);
    assert.doesNotMatch(invocation, /--name prometheusrouteiq-website(?:\s|$)/u);
  }
});

test("credential-free Wrangler dry run emits an asset-only isolated preview bundle", { timeout: 120_000 }, () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "route-iq-gym-preview-bundle-"));
  try {
    const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
    assert.equal(existsSync(wrangler), true, "Run npm ci before the preview Infrastructure test.");
    const result = spawnSync(process.execPath, [
      wrangler,
      "deploy",
      "--dry-run",
      "--strict",
      "--config",
      "wrangler.prometheusrouteiq-website-gym-preview.jsonc",
      "--name",
      ROUTE_IQ_GYM_PREVIEW_WORKER_NAME,
      "--outdir",
      outputDirectory
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        CI: "1",
        HOME: process.env.HOME,
        NO_COLOR: "1",
        NO_UPDATE_NOTIFIER: "1",
        PATH: process.env.PATH,
        WRANGLER_SEND_METRICS: "false"
      },
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.match(output, /env\.ASSETS\s+Assets/u);
    const bundle = readFileSync(
      join(outputDirectory, "prometheusrouteiq-website-gym-preview-entry.js"),
      "utf8"
    );
    assert.match(bundle, /synthetic_preview_only/u);
    for (const forbidden of [
      "ROUTE_IQ_REQUEST_CRM_COORDINATOR",
      "FOUNDER_EMAIL",
      "AEGIS_RATE_LIMITS",
      "SHARED_LEAD_INTAKE_STORE",
      "CRM_WORKSPACE_LEAD_STORE"
    ]) {
      assert.equal(bundle.includes(forbidden), false);
      assert.equal(output.includes(forbidden), false);
    }
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
