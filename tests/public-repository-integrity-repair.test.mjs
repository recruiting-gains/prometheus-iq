import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError,
  assertPublicRepositoryIdentity,
  formatPublicDeploymentFailure,
  verifyPublicRepositoryIntegrity
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import {
  canonicalizeGeneratedSourceMap,
  canonicalizeGeneratedWorkerSource,
  verifyPublicForwardRollbackArtifact
} from "../scripts/lib/route-iq-public-forward-rollback.mjs";
import {
  INFRASTRUCTURE_OWNER_BOUNDARY,
  INFRASTRUCTURE_OWNER_VERIFIER_FAILURE,
  SAFE_NO_SECRET_PREDEPLOYMENT_RUN_COMMANDS,
  classifyInfrastructureOwnerVerifierFailure,
  verifyInfrastructureOwnerBoundary,
  verifySafeNoSecretPredeploymentWorkflow
} from "../scripts/verify-route-iq-public-repository-integrity-repair.mjs";

const root = resolve(import.meta.dirname, "..");
const actionsDependencySources = Object.freeze([
  "jose/dist/webapi/lib/buffer_utils.js",
  "jose/dist/webapi/lib/base64.js",
  "jose/dist/webapi/util/base64url.js",
  "jose/dist/webapi/lib/crypto_key.js",
  "jose/dist/webapi/lib/invalid_key_input.js",
  "jose/dist/webapi/util/errors.js",
  "jose/dist/webapi/lib/is_key_like.js",
  "jose/dist/webapi/lib/helpers.js",
  "jose/dist/webapi/lib/type_checks.js",
  "jose/dist/webapi/lib/signing.js",
  "jose/dist/webapi/lib/jwk_to_key.js",
  "jose/dist/webapi/lib/normalize_key.js",
  "jose/dist/webapi/key/import.js",
  "jose/dist/webapi/lib/validate_crit.js",
  "jose/dist/webapi/lib/validate_algorithms.js",
  "jose/dist/webapi/lib/check_key_type.js",
  "jose/dist/webapi/jws/flattened/verify.js",
  "jose/dist/webapi/jws/compact/verify.js",
  "jose/dist/webapi/lib/jwt_claims_set.js",
  "jose/dist/webapi/jwt/verify.js",
  "jose/dist/webapi/jwks/local.js",
  "jose/dist/webapi/jwks/remote.js",
  "jose/dist/webapi/util/decode_jwt.js"
]);
const actionsWorkspaceSources = Object.freeze([
  "intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json",
  "social-media/infrastructure/meta-instagram-oauth-workflow.js",
  "social-media/contracts/social-media-contract.js",
  "social-media/infrastructure/instagram-runtime-controls.js",
  "social-media/providers/instagram-business-provider.js",
  "social-media/reporting/founder-instagram-analytics-reporting-view.js",
  "workers/infrastructure/aegis-security-controls.js",
  "crm/route-iq-request-crm.mjs",
  "workers/infrastructure/route-iq-request-crm-runtime.js",
  "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
  "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
  "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs",
  "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
  "intelligence/route-iq-committed-outcome-evaluation.mjs",
  "intelligence/route-iq-prospective-retention-admission.mjs",
  "workers/infrastructure/route-iq-prospective-shadow-contract.js",
  "workers/infrastructure/route-iq-prospective-shadow-access.js",
  "workers/infrastructure/route-iq-prospective-shadow-authority.js",
  "workers/infrastructure/route-iq-prospective-shadow-retention-admission.js",
  "intelligence/shadow-decision-readiness-runtime.mjs",
  "scripts/lib/business-hours-governance.mjs",
  "intelligence/route-business-hours-eligibility.mjs",
  "intelligence/continuous-adaptive-route-replenishment.mjs",
  "workers/infrastructure/route-iq-prospective-shadow-orchestration.js",
  "workers/infrastructure/route-iq-prospective-shadow-runtime.js",
  "workers/infrastructure/cloudflare-unattended-smoke-contract.js",
  "workers/infrastructure/cloudflare-unattended-smoke-guard.js",
  "workers/infrastructure/route-iq-prospective-shadow-durable-object.js",
  "workers/infrastructure/route-iq-request-crm-durable-object.js",
  "workers/prometheus-iq-worker.js"
]);

function git(repository, argumentsList, { input, env = {} } = {}) {
  const result = spawnSync("git", argumentsList, {
    cwd: repository,
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      ...env
    }
  });
  assert.equal(result.status, 0, `fixture Git failed: ${argumentsList.join(" ")}\n${result.stderr}`);
  return String(result.stdout || "").trim();
}

function commitFixture(repository, {
  path,
  content,
  subject,
  authorName,
  authorEmail,
  committerName = authorName,
  committerEmail = authorEmail
}) {
  const absolutePath = join(repository, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
  git(repository, ["add", path]);
  git(repository, ["commit", "--quiet", "-m", subject], {
    env: {
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: committerName,
      GIT_COMMITTER_EMAIL: committerEmail
    }
  });
  const commit = git(repository, ["rev-parse", "HEAD"]);
  return Object.freeze({
    commit,
    tree: git(repository, ["rev-parse", "HEAD^{tree}"]),
    parent: git(repository, ["rev-parse", "HEAD^"]),
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    subject,
    files: Object.freeze([path])
  });
}

function commitFilesFixture(repository, {
  changes,
  subject,
  authorName,
  authorEmail,
  committerName = authorName,
  committerEmail = authorEmail
}) {
  const files = changes.map(change => change.path).sort();
  for (const change of changes) {
    const absolutePath = join(repository, change.path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, change.content, "utf8");
  }
  git(repository, ["add", "--", ...files]);
  git(repository, ["commit", "--quiet", "-m", subject], {
    env: {
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: committerName,
      GIT_COMMITTER_EMAIL: committerEmail
    }
  });
  return Object.freeze({
    commit: git(repository, ["rev-parse", "HEAD"]),
    tree: git(repository, ["rev-parse", "HEAD^{tree}"]),
    parent: git(repository, ["rev-parse", "HEAD^"]),
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    subject,
    files: Object.freeze(files)
  });
}

function createOwnerBoundaryRepository(parent, name) {
  const repository = join(parent, name);
  mkdirSync(repository);
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(join(repository, "baseline.txt"), "baseline\n", "utf8");
  git(repository, ["add", "baseline.txt"]);
  git(repository, ["commit", "--quiet", "-m", "baseline: seed"], {
    env: {
      GIT_AUTHOR_NAME: "Prometheus Foundation",
      GIT_AUTHOR_EMAIL: "foundation@prometheus.local",
      GIT_COMMITTER_NAME: "Prometheus Foundation",
      GIT_COMMITTER_EMAIL: "foundation@prometheus.local"
    }
  });

  const infrastructure = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const overwatch = {
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local"
  };
  const first = commitFixture(repository, {
    ...infrastructure,
    path: "scripts/infrastructure-first.mjs",
    content: "export const first = true;\n",
    subject: "infrastructure: first frozen owner commit"
  });
  const terminal = commitFixture(repository, {
    ...infrastructure,
    path: "scripts/infrastructure-terminal.mjs",
    content: "export const terminal = true;\n",
    subject: "infrastructure: terminal frozen owner commit"
  });
  const knownOverwatchSuccessor = commitFixture(repository, {
    ...overwatch,
    path: "overwatch/governance/known-successor.json",
    content: "{}\n",
    subject: "overwatch: known governance successor"
  });
  const repair = commitFixture(repository, {
    ...infrastructure,
    path: "docs/owner-boundary-repair.md",
    content: "owner boundary\n",
    subject: "infrastructure: synthetic owner boundary repair"
  });
  commitFixture(repository, {
    ...overwatch,
    path: "scripts/verify-overwatch-later-successor.mjs",
    content: "export const verified = true;\n",
    subject: "overwatch: later governance successor"
  });

  return Object.freeze({
    repository,
    boundary: Object.freeze({
      infrastructureCommits: Object.freeze([first, terminal]),
      knownOverwatchSuccessor,
      boundaryRepairSuccessor: Object.freeze({
        parent: knownOverwatchSuccessor.commit,
        authorName: infrastructure.authorName,
        authorEmail: infrastructure.authorEmail,
        committerName: infrastructure.authorName,
        committerEmail: infrastructure.authorEmail,
        subject: repair.subject,
        files: repair.files
      })
    })
  });
}

function createActionsCheckoutFixture(parent) {
  const ownerFixture = createOwnerBoundaryRepository(parent, "actions-source");
  const dependabotBranches = [
    "dependabot/github_actions/actions/checkout-7",
    "dependabot/github_actions/actions/setup-node-6",
    "dependabot/npm_and_yarn/framer-motion-12.42.2",
    "dependabot/npm_and_yarn/three-0.185.1",
    "dependabot/npm_and_yarn/vite-8.1.4"
  ];
  for (const branch of dependabotBranches) {
    git(ownerFixture.repository, ["branch", branch, "HEAD"]);
  }
  const checkout = join(parent, "actions-checkout");
  git(parent, [
    "clone", "--quiet", "--no-local", "--no-tags", "--no-single-branch",
    `file://${ownerFixture.repository}`, checkout
  ]);
  git(checkout, ["symbolic-ref", "--delete", "refs/remotes/origin/HEAD"]);
  git(checkout, ["remote", "set-url", "origin", PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl]);
  return Object.freeze({ ...ownerFixture, repository: checkout, dependabotBranches });
}

function addDashboardProvenanceSuccessors(ownerFixture) {
  const dashboardIdentity = {
    authorName: "Prometheus Dashboard",
    authorEmail: "dashboard@prometheus.local"
  };
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const dashboard = commitFilesFixture(ownerFixture.repository, {
    ...dashboardIdentity,
    subject: "dashboard: synthetic fixed-clock verification",
    changes: [
      {
        path: "scripts/verify-dashboard-runtime-workflows.mjs",
        content: "export const fixedClock = true;\n"
      },
      {
        path: "tests/dashboard-route-iq-product-focus.test.mjs",
        content: "export const fixedClockTest = true;\n"
      }
    ]
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic Dashboard provenance admission",
    changes: [
      {
        path: "docs/dashboard-provenance-admission.md",
        content: "dashboard provenance admission\n"
      },
      {
        path: "scripts/verify-dashboard-provenance-admission.mjs",
        content: "export const admitted = true;\n"
      }
    ]
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    dashboard,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      dashboardVerificationSuccessor: dashboard,
      dashboardProvenanceAdmissionSuccessor: Object.freeze({
        parent: dashboard.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addDashboardRuntimeHarnessSuccessors(ownerFixture) {
  const dashboardIdentity = {
    authorName: "Prometheus Dashboard",
    authorEmail: "dashboard@prometheus.local"
  };
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const startup = commitFilesFixture(ownerFixture.repository, {
    ...dashboardIdentity,
    subject: "dashboard: synthetic cross-platform Chrome discovery",
    changes: [
      {
        path: "scripts/verify-dashboard-runtime-workflows.mjs",
        content: "export const crossPlatformChrome = true;\n"
      },
      {
        path: "tests/dashboard-route-iq-product-focus.test.mjs",
        content: "export const crossPlatformChromeTest = true;\n"
      }
    ]
  });
  const lifecycle = commitFilesFixture(ownerFixture.repository, {
    ...dashboardIdentity,
    subject: "dashboard: synthetic deterministic Chrome lifecycle",
    changes: [
      {
        path: "scripts/verify-dashboard-runtime-workflows.mjs",
        content: "export const deterministicChromeLifecycle = true;\n"
      },
      {
        path: "tests/dashboard-route-iq-product-focus.test.mjs",
        content: "export const deterministicChromeLifecycleTest = true;\n"
      }
    ]
  });
  const adoption = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic Dashboard harness adoption",
    changes: [
      {
        path: ".github/workflows/verify-public-integrity.yml",
        content: "name: synthetic full no-secret verification\n"
      },
      {
        path: "docs/dashboard-harness-adoption.md",
        content: "Dashboard harness adoption\n"
      },
      {
        path: "scripts/verify-dashboard-harness-adoption.mjs",
        content: "export const adopted = true;\n"
      },
      {
        path: "tests/dashboard-harness-adoption.test.mjs",
        content: "export const adoptedTest = true;\n"
      },
      {
        path: "workers/infrastructure/dashboard-harness-adoption.json",
        content: "{}\n"
      }
    ]
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    startup,
    lifecycle,
    adoption,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      dashboardRuntimeHarnessSuccessors: Object.freeze([startup, lifecycle]),
      dashboardRuntimeHarnessAdoptionSuccessor: Object.freeze({
        parent: lifecycle.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: adoption.subject,
        files: adoption.files
      })
    })
  });
}

function addPublicIntakeSmokeProvenanceSuccessors(ownerFixture) {
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const smokeChanges = suffix => [
    {
      path: "scripts/run-public-intake-smoke.mjs",
      content: `export const smoke = "${suffix}";\n`
    },
    {
      path: "scripts/verify-public-intake-smoke.mjs",
      content: `export const verified = "${suffix}";\n`
    },
    {
      path: "tests/public-intake-smoke.test.mjs",
      content: `export const tested = "${suffix}";\n`
    }
  ];
  const strictSet = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic strict intake Allow set",
    changes: smokeChanges("strict")
  });
  const methodAware = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic method-aware intake Allow set",
    changes: smokeChanges("method-aware")
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic public intake provenance admission",
    changes: [
      {
        path: "docs/public-intake-provenance.md",
        content: "public intake provenance\n"
      },
      {
        path: "scripts/verify-public-intake-provenance.mjs",
        content: "export const admitted = true;\n"
      },
      {
        path: "tests/public-intake-provenance.test.mjs",
        content: "export const admittedTest = true;\n"
      },
      {
        path: "workers/infrastructure/public-intake-provenance.json",
        content: "{}\n"
      }
    ]
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    strictSet,
    methodAware,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      publicIntakeSmokeSuccessors: Object.freeze([strictSet, methodAware]),
      publicIntakeSmokeProvenanceAdmissionSuccessor: Object.freeze({
        parent: methodAware.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addCleanRunnerAssetGenerationSuccessor(ownerFixture) {
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const repair = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic clean-runner asset generation repair",
    changes: [
      {
        path: ".github/workflows/deploy-public-worker.yml",
        content: "name: synthetic clean-runner repair\n"
      },
      {
        path: "scripts/verify-public-assets.mjs",
        content: "export const generatedBeforeVerification = true;\n"
      },
      {
        path: "tests/public-assets.test.mjs",
        content: "export const exactIdentity = true;\n"
      }
    ]
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    repair,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      cleanRunnerAssetGenerationSuccessor: Object.freeze({
        parent: repair.parent,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: repair.subject,
        files: repair.files
      })
    })
  });
}

function addCloudflareDeploymentReadRepairSuccessors(ownerFixture) {
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const repairFiles = [
    "scripts/lib/github-actions-public-worker-deployment.mjs",
    "scripts/verify-github-actions-public-worker-deployment.mjs",
    "tests/github-actions-public-worker-deployment.test.mjs",
    "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json"
  ];
  const classification = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic classify Cloudflare deployment reads",
    changes: repairFiles.map(path => ({ path, content: `classification:${path}\n` }))
  });
  const deadline = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic bounded Cloudflare deadline",
    changes: repairFiles.map(path => ({ path, content: `deadline:${path}\n` }))
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic admit Cloudflare deployment read repairs",
    changes: [
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
    ].map(path => ({ path, content: `admission:${path}\n` }))
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    classification,
    deadline,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      cloudflareDeploymentReadRepairSuccessors: Object.freeze([classification, deadline]),
      cloudflareDeploymentReadProvenanceAdmissionSuccessor: Object.freeze({
        parent: deadline.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addWranglerDeploymentDiagnosticRepairSuccessors(ownerFixture) {
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const repairFiles = [
    "scripts/lib/github-actions-public-worker-deployment.mjs",
    "scripts/verify-github-actions-public-worker-deployment.mjs",
    "tests/github-actions-public-worker-deployment.test.mjs",
    "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json"
  ];
  const repair = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic classify Wrangler deployment failures",
    changes: repairFiles.map(path => ({ path, content: `wrangler-repair:${path}\n` }))
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic admit Wrangler deployment diagnostic repair",
    changes: [
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
    ].map(path => ({ path, content: `wrangler-admission:${path}\n` }))
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    repair,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      wranglerDeploymentDiagnosticRepairSuccessor: Object.freeze(repair),
      wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor: Object.freeze({
        parent: repair.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addPublicWorkerStartupRepairSuccessors(ownerFixture) {
  const intelligenceIdentity = {
    authorName: "Prometheus Intelligence",
    authorEmail: "intelligence@prometheus.local"
  };
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const intelligence = commitFilesFixture(ownerFixture.repository, {
    ...intelligenceIdentity,
    subject: "intelligence: synthetic Worker-safe retention loading",
    changes: [
      "intelligence/route-iq-prospective-retention-admission.mjs",
      "tests/route-iq-prospective-retention-intelligence.test.mjs"
    ].map(path => ({ path, content: `intelligence-startup:${path}\n` }))
  });
  const startup = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic public Worker startup gate",
    changes: [
      ".github/workflows/deploy-prometheus-public-worker.yml",
      "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/run-public-worker-workerd-startup-preflight.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
      "workers/infrastructure/prometheusrouteiq-website-entry.mjs",
      "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
      "wrangler.prometheusrouteiq-website.jsonc"
    ].map(path => ({ path, content: `startup-gate:${path}\n` }))
  });
  const rollback = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic align public adapter rollback",
    changes: [
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
    ].map(path => ({ path, content: `rollback-alignment:${path}\n` }))
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic admit public Worker startup repair chain",
    changes: [
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
    ].map(path => ({ path, content: `startup-admission:${path}\n` }))
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    intelligence,
    startup,
    rollback,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      publicWorkerStartupRepairSuccessors: Object.freeze([
        intelligence,
        startup,
        rollback
      ]),
      publicWorkerStartupProvenanceAdmissionSuccessor: Object.freeze({
        parent: rollback.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addPublicConfigEntryConsumerRepairSuccessor(ownerFixture) {
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const repair = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic align edge boundary with public entry",
    changes: [
      "docs/route-iq-public-crm-edge-boundary-infrastructure-v1.md",
      "scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs",
      "tests/route-iq-public-crm-edge-boundary-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-public-crm-edge-boundary-v1.json"
    ].map(path => ({ path, content: `config-consumer:${path}\n` }))
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic admit public config entry consumer repair",
    changes: [
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
    ].map(path => ({ path, content: `config-consumer-admission:${path}\n` }))
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    repair,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      publicConfigEntryConsumerRepairSuccessor: repair,
      publicConfigEntryConsumerProvenanceAdmissionSuccessor: Object.freeze({
        parent: repair.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function addCrmPublicWorkerAdapterRepairSuccessor(ownerFixture) {
  const overwatchIdentity = {
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local"
  };
  const crmIdentity = {
    authorName: "Prometheus CRM",
    authorEmail: "crm@prometheus.local"
  };
  const infrastructureIdentity = {
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local"
  };
  const closure = commitFixture(ownerFixture.repository, {
    ...overwatchIdentity,
    path: "overwatch/governance/synthetic-crm-adapter-closure.json",
    content: "{}\n",
    subject: "overwatch: synthetic close public adapter evidence"
  });
  const repair = commitFilesFixture(ownerFixture.repository, {
    ...crmIdentity,
    subject: "crm: synthetic accept governed public Worker adapter",
    changes: [
      "crm/production-worker-entrypoint-contract.mjs",
      "scripts/validate-crm-production-store.mjs",
      "tests/crm-cloudflare-kv-workspace-lead-store.test.mjs"
    ].map(path => ({ path, content: `crm-adapter:${path}\n` }))
  });
  const admission = commitFilesFixture(ownerFixture.repository, {
    ...infrastructureIdentity,
    subject: "infrastructure: synthetic admit CRM public Worker adapter repair",
    changes: [
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
    ].map(path => ({ path, content: `crm-adapter-admission:${path}\n` }))
  });
  return Object.freeze({
    repository: ownerFixture.repository,
    closure,
    repair,
    admission,
    boundary: Object.freeze({
      ...ownerFixture.boundary,
      crmPublicWorkerAdapterRepairSuccessor: repair,
      crmPublicWorkerAdapterProvenanceAdmissionSuccessor: Object.freeze({
        parent: repair.commit,
        authorName: infrastructureIdentity.authorName,
        authorEmail: infrastructureIdentity.authorEmail,
        committerName: infrastructureIdentity.authorName,
        committerEmail: infrastructureIdentity.authorEmail,
        subject: admission.subject,
        files: admission.files
      })
    })
  });
}

function createRepository(parent, name = "repository") {
  const repository = join(parent, name);
  mkdirSync(repository);
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(join(repository, "record.txt"), "one\n", "utf8");
  git(repository, ["add", "record.txt"]);
  git(repository, [
    "-c", "user.name=Prometheus Infrastructure Test",
    "-c", "user.email=infrastructure-test@prometheus.local",
    "commit", "--quiet", "-m", "test: seed repository"
  ]);
  return repository;
}

function addCommit(repository, content = "two\n") {
  writeFileSync(join(repository, "record.txt"), content, "utf8");
  git(repository, ["add", "record.txt"]);
  git(repository, [
    "-c", "user.name=Prometheus Infrastructure Test",
    "-c", "user.email=infrastructure-test@prometheus.local",
    "commit", "--quiet", "-m", "test: extend repository"
  ]);
}

function expectIntegrityFailure(repository, classification) {
  assert.throws(
    () => verifyPublicRepositoryIntegrity(repository),
    error => error instanceof PublicDeploymentPolicyError
      && error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
      && error.diagnostics.some(value => value.includes(classification))
  );
}

test("valid and CI-equivalent full repositories pass exact strict integrity", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-valid-"));
  try {
    const source = createRepository(fixture, "source");
    addCommit(source);
    git(source, ["branch", "verification-branch", "HEAD~1"]);
    git(source, ["tag", "verification-tag", "HEAD"]);
    const clone = join(fixture, "clone");
    git(fixture, ["clone", "--quiet", "--no-local", "--no-single-branch", `file://${source}`, clone]);
    const result = verifyPublicRepositoryIntegrity(clone);
    assert.equal(result.status, "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED");
    assert.equal(result.shallow, "false");
    assert.equal(result.objectFormat, "sha1");
    assert.equal(result.partialClone, false);
    assert.equal(result.promisor, false);
    assert.ok(result.refCount >= 3);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("GitHub Actions seven-ref HTTPS checkout passes integrity and owner provenance", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-actions-ref-shape-"));
  try {
    const actions = createActionsCheckoutFixture(fixture);
    const refs = git(actions.repository, ["for-each-ref", "--format=%(refname)"])
      .split("\n").filter(Boolean).sort();
    assert.deepEqual(refs, [
      "refs/heads/main",
      ...actions.dependabotBranches.map(branch => `refs/remotes/origin/${branch}`),
      "refs/remotes/origin/main"
    ].sort());
    assert.equal(refs.length, 7);
    assert.equal(git(actions.repository, ["tag", "--list"]), "");
    assert.equal(
      git(actions.repository, ["remote", "get-url", "origin"]),
      PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl
    );
    assert.equal(verifyPublicRepositoryIntegrity(actions.repository).refCount, 7);
    assert.deepEqual(verifyInfrastructureOwnerBoundary(actions.repository, actions.boundary), {
      terminalOwnerCommit: actions.boundary.infrastructureCommits.at(-1).commit,
      descendants: 3,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("benign dangling objects do not weaken or fail strict verification", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-dangling-"));
  try {
    const repository = createRepository(fixture);
    git(repository, ["hash-object", "-w", "--stdin"], { input: "unreferenced fixture\n" });
    assert.equal(verifyPublicRepositoryIntegrity(repository).status, "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("shallow and partial or promisor repositories fail closed before fsck", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-incomplete-"));
  try {
    const source = createRepository(fixture, "source");
    addCommit(source);
    const shallow = join(fixture, "shallow");
    git(fixture, ["clone", "--quiet", "--depth=1", `file://${source}`, shallow]);
    expectIntegrityFailure(shallow, "SHALLOW_REPOSITORY");

    const partial = createRepository(fixture, "partial");
    git(partial, ["config", "extensions.partialClone", "origin"]);
    git(partial, ["config", "remote.origin.promisor", "true"]);
    expectIntegrityFailure(partial, "PARTIAL_OR_PROMISOR_REPOSITORY");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("missing and corrupt objects remain fatal with bounded classifications", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-object-"));
  try {
    const missing = createRepository(fixture, "missing");
    const missingObject = git(missing, ["rev-parse", "HEAD:record.txt"]);
    rmSync(join(missing, ".git", "objects", missingObject.slice(0, 2), missingObject.slice(2)));
    expectIntegrityFailure(missing, "MISSING_OBJECT");

    const corrupt = createRepository(fixture, "corrupt");
    const corruptObject = git(corrupt, ["rev-parse", "HEAD:record.txt"]);
    const corruptPath = join(corrupt, ".git", "objects", corruptObject.slice(0, 2), corruptObject.slice(2));
    chmodSync(corruptPath, 0o600);
    writeFileSync(
      corruptPath,
      "corrupt fixture",
      "utf8"
    );
    expectIntegrityFailure(corrupt, "CORRUPT_OBJECT");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("invalid refs and exact identity mismatches remain fatal", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-ref-"));
  try {
    const repository = createRepository(fixture);
    writeFileSync(join(repository, ".git", "refs", "heads", "invalid"), `${"f".repeat(40)}\n`, "utf8");
    expectIntegrityFailure(repository, "INVALID_REF");

    const head = git(repository, ["rev-parse", "HEAD"]);
    const tree = git(repository, ["rev-parse", "HEAD^{tree}"]);
    assert.throws(
      () => assertPublicRepositoryIdentity({
        head,
        tree,
        originMain: head,
        branch: "main",
        originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
        status: "",
        unstagedClean: true,
        stagedClean: true
      }, { approvedCommit: "0".repeat(40), approvedTree: tree }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
    assert.throws(
      () => assertPublicRepositoryIdentity({
        head,
        tree,
        originMain: head,
        branch: "main",
        originUrl: "git@github.com:PrometheusRouteIQ/prometheus-iq.git",
        status: "",
        unstagedClean: true,
        stagedClean: true
      }, { approvedCommit: head, approvedTree: "0".repeat(40) }),
      error => error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck failure diagnostics classify causes without leaking subprocess content", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-diagnostic-"));
  try {
    const repository = createRepository(fixture);
    let error;
    try {
      verifyPublicRepositoryIntegrity(repository, {
        fsckRunner: (_command, argumentsList) => {
          assert.deepEqual(argumentsList, [
            "fsck",
            "--full",
            "--strict",
            "--no-dangling",
            "--no-progress"
          ]);
          return {
            status: 1,
            signal: null,
            error: undefined,
            stdout: `error: refs/heads/main: invalid sha1 pointer ${"f".repeat(40)}\nSECRET_VALUE=do-not-print`,
            stderr: "Authorization: Bearer do-not-print"
          };
        }
      });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof PublicDeploymentPolicyError);
    assert.equal(error.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
    assert.ok(error.diagnostics.includes("GIT_FSCK_CLASSIFICATIONS=INVALID_REF"));
    const output = formatPublicDeploymentFailure(error).join("\n");
    assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
    assert.match(output, /GIT_FSCK_STDOUT_BYTES=[0-9]+/u);
    assert.match(output, /GIT_FSCK_STDERR_BYTES=[0-9]+/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("fsck capture overflow and unexpected successful output fail closed without content leakage", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-output-"));
  try {
    const repository = createRepository(fixture);
    for (const result of [
      {
        status: null,
        signal: null,
        error: Object.assign(new Error("secret overflow detail"), { code: "ENOBUFS" }),
        stdout: "SECRET_VALUE=do-not-print",
        stderr: "Authorization: Bearer do-not-print"
      },
      {
        status: 0,
        signal: null,
        error: undefined,
        stdout: "unexpected fsck output containing do-not-print",
        stderr: ""
      }
    ]) {
      let error;
      try {
        verifyPublicRepositoryIntegrity(repository, { fsckRunner: () => result });
      } catch (caught) {
        error = caught;
      }
      assert.ok(error instanceof PublicDeploymentPolicyError);
      assert.equal(error.code, PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
      const output = formatPublicDeploymentFailure(error).join("\n");
      assert.doesNotMatch(output, /SECRET|Authorization|Bearer|do-not-print/iu);
      assert.match(output, /GIT_FSCK_CAPTURE_LIMIT_BYTES=131072/u);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("malformed object diagnostics remain fatal and sanitized", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-integrity-malformed-"));
  try {
    const repository = createRepository(fixture);
    assert.throws(
      () => verifyPublicRepositoryIntegrity(repository, {
        fsckRunner: () => ({
          status: 1,
          signal: null,
          error: undefined,
          stdout: "error in commit protected-value: missingTree: invalid format",
          stderr: ""
        })
      }),
      error => error instanceof PublicDeploymentPolicyError
        && error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
        && error.diagnostics.includes("GIT_FSCK_CLASSIFICATIONS=MALFORMED_OBJECT")
        && !formatPublicDeploymentFailure(error).join("\n").includes("protected-value")
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("safe integrity workflow runs the complete suite with no deployment or secret capability", () => {
  const workflow = readFileSync(
    join(root, ".github", "workflows", "verify-prometheus-public-repository-integrity.yml"),
    "utf8"
  );
  assert.deepEqual(verifySafeNoSecretPredeploymentWorkflow(workflow), {
    status: "SAFE_NO_SECRET_FULL_PREDEPLOYMENT_WORKFLOW_VERIFIED",
    runCommands: SAFE_NO_SECRET_PREDEPLOYMENT_RUN_COMMANDS
  });
  const checkout = workflow.indexOf("uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5");
  const setupNode = workflow.indexOf("uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
  const firstRepositoryNodeScript = workflow.indexOf("run: node scripts/");
  const diagnostic = workflow.indexOf("run: node scripts/run-public-worker-repository-integrity-diagnostic.mjs");
  const npmInstall = workflow.indexOf("run: npm ci");
  const deterministicBuild = workflow.indexOf("run: npm run build");
  const repositorySuite = workflow.indexOf("run: npm test");
  const rollbackVerification = workflow.indexOf(
    "run: node scripts/verify-route-iq-public-repository-integrity-repair.mjs"
  );
  assert.ok(checkout >= 0 && checkout < setupNode);
  assert.ok(setupNode < firstRepositoryNodeScript);
  assert.equal(firstRepositoryNodeScript, diagnostic);
  assert.ok(
    diagnostic < npmInstall
      && npmInstall < deterministicBuild
      && deterministicBuild < repositorySuite
      && repositorySuite < rollbackVerification
  );
  assert.equal(workflow.match(/^\s*run: npm run build$/gmu)?.length, 1);
  assert.ok(repositorySuite < workflow.indexOf("run: npm run lint"));
  assert.ok(workflow.indexOf("run: npm run lint") < workflow.indexOf("run: npm run typecheck"));
});

test("safe integrity workflow mutations fail closed before gaining capability or losing coverage", () => {
  const workflow = readFileSync(
    join(root, ".github", "workflows", "verify-prometheus-public-repository-integrity.yml"),
    "utf8"
  );
  for (const mutation of [
    source => source.replace("  workflow_dispatch:", "  push:"),
    source => source.replace("  contents: read", "  contents: write"),
    source => source.replace("    runs-on: ubuntu-latest", "    environment: production\n    runs-on: ubuntu-latest"),
    source => source.replace("    steps:", "    env:\n      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n    steps:"),
    source => source.replace("      - name: Require unchanged repository after verification",
      "      - name: Deploy\n        run: wrangler deploy\n\n      - name: Require unchanged repository after verification"),
    source => source.replace("        run: npm test", "        run: npm test || true"),
    source => source.replace("      - name: Generate exact public assets before repository verification\n        run: npm run build\n\n", ""),
    source => source.replace(
      "      - name: Generate exact public assets before repository verification\n        run: npm run build\n\n      - name: Run complete repository verification suite\n        run: npm test",
      "      - name: Run complete repository verification suite\n        run: npm test\n\n      - name: Generate exact public assets before repository verification\n        run: npm run build"
    ),
    source => source.replace("      - name: Run complete repository verification suite\n        run: npm test\n\n", ""),
    source => source.replace("github.actor == 'PrometheusRouteIQ'", "github.actor != ''"),
    source => source.replace("github.run_attempt == 1", "github.run_attempt >= 1")
  ]) assert.throws(() => verifySafeNoSecretPredeploymentWorkflow(mutation(workflow)));
});

test("owner boundary pins frozen Infrastructure commits and permits legitimate Overwatch successors", () => {
  const current = verifyInfrastructureOwnerBoundary(root);
  assert.equal(current.terminalOwnerCommit, "a2779239fc8f2d79d4b8781966d32cc23d4acbbd");
  assert.ok(current.descendants >= 1);
  assert.equal(current.dashboardVerificationSeen, true);
  assert.equal(current.publicIntakeSmokeSuccessorsSeen, 2);
  assert.equal(
    current.publicIntakeSmokeProvenanceAdmissionSeen,
    git(root, ["rev-parse", "HEAD"]) !== "6476c381c8e9512eaea4a90e0f6019138cfe1766"
  );
  assert.equal(
    current.cleanRunnerAssetGenerationSeen,
    git(root, ["rev-parse", "HEAD"])
      !== "1e4e9be843fe418ae8920ccb109b4259fda5455c"
  );
  assert.equal(current.keychainCiPortabilitySuccessorSeen, true);
  assert.equal(current.keychainCiOverwatchMappingSeen, true);
  assert.equal(current.keychainCiProvenanceAdmissionSeen, true);
  assert.equal(current.keychainCiMappingCompatibilityRepairSeen, true);
  assert.equal(current.historicalKeychainFixtureSuccessorsSeen, 3);
  assert.equal(current.historicalKeychainFixtureProvenanceAdmissionSeen, true);
  assert.equal(current.dashboardRuntimeHarnessSuccessorsSeen, 2);
  assert.equal(
    current.dashboardRuntimeHarnessAdoptionSeen,
    git(root, ["rev-parse", "HEAD"])
      !== "577b9217185be2324824c5c4eeeaf6cd89300477"
  );
  assert.equal(
    current.safeNoSecretAssetOrderingRepairSeen,
    git(root, ["rev-parse", "HEAD"])
      !== "5d5ffe858d7e132778c96746eabd4a99afe9d1f4"
  );
  assert.equal(current.cloudflareDeploymentReadRepairSuccessorsSeen, 2);
  assert.equal(
    current.cloudflareDeploymentReadProvenanceAdmissionSeen,
    git(root, ["rev-parse", "HEAD"])
      !== "f09b8c1ee6e4c0be14c41f672601e2e5854014eb"
  );
  assert.equal(current.wranglerDeploymentDiagnosticRepairSeen, true);
  assert.equal(
    current.wranglerDeploymentDiagnosticProvenanceAdmissionSeen,
    git(root, ["rev-parse", "HEAD"])
      !== "ba4d25df97e12852982e1bbdc2b1e89ef5265da1"
  );

  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-valid-"));
  try {
    const { repository, boundary } = createOwnerBoundaryRepository(fixture, "repository");
    assert.deepEqual(verifyInfrastructureOwnerBoundary(repository, boundary), {
      terminalOwnerCommit: boundary.infrastructureCommits.at(-1).commit,
      descendants: 3,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact Keychain CI successor and provenance admission", () => {
  const wrongOwnerTree = {
    ...INFRASTRUCTURE_OWNER_BOUNDARY,
    keychainCiPortabilitySuccessor: {
      ...INFRASTRUCTURE_OWNER_BOUNDARY.keychainCiPortabilitySuccessor,
      tree: "0".repeat(40)
    }
  };
  assert.throws(() => verifyInfrastructureOwnerBoundary(root, wrongOwnerTree));

  const wrongMappingSubject = {
    ...INFRASTRUCTURE_OWNER_BOUNDARY,
    keychainCiOverwatchMappingSuccessor: {
      ...INFRASTRUCTURE_OWNER_BOUNDARY.keychainCiOverwatchMappingSuccessor,
      subject: "overwatch: substituted mapping"
    }
  };
  assert.throws(() => verifyInfrastructureOwnerBoundary(root, wrongMappingSubject));

  const widenedAdmission = {
    ...INFRASTRUCTURE_OWNER_BOUNDARY,
    keychainCiProvenanceAdmissionSuccessor: {
      ...INFRASTRUCTURE_OWNER_BOUNDARY.keychainCiProvenanceAdmissionSuccessor,
      files: [
        ...INFRASTRUCTURE_OWNER_BOUNDARY.keychainCiProvenanceAdmissionSuccessor.files,
        "scripts/unapproved-keychain-provenance.mjs"
      ]
    }
  };
  assert.throws(() => verifyInfrastructureOwnerBoundary(root, widenedAdmission));
});

test("owner boundary pins the historical Keychain fixture chain and exact admission", () => {
  const wrongRepairTree = {
    ...INFRASTRUCTURE_OWNER_BOUNDARY,
    historicalKeychainFixtureSuccessors: [
      {
        ...INFRASTRUCTURE_OWNER_BOUNDARY.historicalKeychainFixtureSuccessors[0],
        tree: "0".repeat(40)
      },
      ...INFRASTRUCTURE_OWNER_BOUNDARY.historicalKeychainFixtureSuccessors.slice(1)
    ]
  };
  assert.throws(() => verifyInfrastructureOwnerBoundary(root, wrongRepairTree));

  const widenedAdmission = {
    ...INFRASTRUCTURE_OWNER_BOUNDARY,
    historicalKeychainFixtureProvenanceAdmissionSuccessor: {
      ...INFRASTRUCTURE_OWNER_BOUNDARY.historicalKeychainFixtureProvenanceAdmissionSuccessor,
      files: [
        ...INFRASTRUCTURE_OWNER_BOUNDARY
          .historicalKeychainFixtureProvenanceAdmissionSuccessor.files,
        "scripts/unapproved-historical-keychain-fixture.mjs"
      ]
    }
  };
  assert.throws(() => verifyInfrastructureOwnerBoundary(root, widenedAdmission));
});

test("owner boundary admits only the exact clean-runner asset-generation successor", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-clean-runner-"));
  try {
    const accepted = addCleanRunnerAssetGenerationSuccessor(
      createOwnerBoundaryRepository(fixture, "accepted")
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 4,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cleanRunnerAssetGenerationSeen: true
    });

    const scopeDrift = {
      ...accepted.boundary,
      cleanRunnerAssetGenerationSuccessor: {
        ...accepted.boundary.cleanRunnerAssetGenerationSuccessor,
        files: [
          ...accepted.boundary.cleanRunnerAssetGenerationSuccessor.files,
          "scripts/unapproved-owner-file.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, scopeDrift));

    const mixedOwnership = {
      ...accepted.boundary,
      cleanRunnerAssetGenerationSuccessor: {
        ...accepted.boundary.cleanRunnerAssetGenerationSuccessor,
        committerName: "Prometheus Overwatch",
        committerEmail: "overwatch@prometheus.local"
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, mixedOwnership));

    commitFixture(accepted.repository, {
      path: "scripts/unapproved-later-infrastructure.mjs",
      content: "export const unapproved = true;\n",
      subject: "infrastructure: unapproved later successor",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the ordered Cloudflare read repairs and Infrastructure provenance", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-cloudflare-reads-"));
  try {
    const accepted = addCloudflareDeploymentReadRepairSuccessors(
      createOwnerBoundaryRepository(fixture, "accepted")
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 6,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cloudflareDeploymentReadRepairSuccessorsSeen: 2,
      cloudflareDeploymentReadProvenanceAdmissionSeen: true
    });

    const reordered = {
      ...accepted.boundary,
      cloudflareDeploymentReadRepairSuccessors: [
        accepted.boundary.cloudflareDeploymentReadRepairSuccessors[1],
        accepted.boundary.cloudflareDeploymentReadRepairSuccessors[0]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, reordered));

    const mixedOwnership = {
      ...accepted.boundary,
      cloudflareDeploymentReadRepairSuccessors: [
        {
          ...accepted.boundary.cloudflareDeploymentReadRepairSuccessors[0],
          committerName: "Prometheus Overwatch",
          committerEmail: "overwatch@prometheus.local"
        },
        accepted.boundary.cloudflareDeploymentReadRepairSuccessors[1]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, mixedOwnership));

    const widenedAdmission = {
      ...accepted.boundary,
      cloudflareDeploymentReadProvenanceAdmissionSuccessor: {
        ...accepted.boundary.cloudflareDeploymentReadProvenanceAdmissionSuccessor,
        files: [
          ...accepted.boundary.cloudflareDeploymentReadProvenanceAdmissionSuccessor.files,
          "scripts/unapproved-cloudflare-read-admission.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, widenedAdmission));

    commitFixture(accepted.repository, {
      path: "scripts/unapproved-cloudflare-read-successor.mjs",
      content: "export const unapproved = true;\n",
      subject: "infrastructure: unapproved Cloudflare read successor",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact Wrangler diagnostic repair and provenance", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-wrangler-diagnostic-"));
  try {
    const accepted = addWranglerDeploymentDiagnosticRepairSuccessors(
      addCloudflareDeploymentReadRepairSuccessors(
        createOwnerBoundaryRepository(fixture, "accepted")
      )
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 8,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cloudflareDeploymentReadRepairSuccessorsSeen: 2,
      cloudflareDeploymentReadProvenanceAdmissionSeen: true,
      wranglerDeploymentDiagnosticRepairSeen: true,
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen: true
    });

    const wrongOwner = {
      ...accepted.boundary,
      wranglerDeploymentDiagnosticRepairSuccessor: {
        ...accepted.boundary.wranglerDeploymentDiagnosticRepairSuccessor,
        authorName: "Prometheus Overwatch"
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongOwner));

    const wrongParent = {
      ...accepted.boundary,
      wranglerDeploymentDiagnosticRepairSuccessor: {
        ...accepted.boundary.wranglerDeploymentDiagnosticRepairSuccessor,
        parent: accepted.boundary.cloudflareDeploymentReadRepairSuccessors[0].commit
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongParent));

    const wrongFiles = {
      ...accepted.boundary,
      wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor: {
        ...accepted.boundary.wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor,
        files: [
          ...accepted.boundary.wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor.files,
          "scripts/unapproved-wrangler-diagnostic-admission.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongFiles));

    const wrongHash = {
      ...accepted.boundary,
      wranglerDeploymentDiagnosticRepairSuccessor: {
        ...accepted.boundary.wranglerDeploymentDiagnosticRepairSuccessor,
        tree: "0000000000000000000000000000000000000000"
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongHash));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact public Worker startup repair chain", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-worker-startup-"));
  try {
    const accepted = addPublicWorkerStartupRepairSuccessors(
      addWranglerDeploymentDiagnosticRepairSuccessors(
        addCloudflareDeploymentReadRepairSuccessors(
          createOwnerBoundaryRepository(fixture, "accepted")
        )
      )
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 12,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cloudflareDeploymentReadRepairSuccessorsSeen: 2,
      cloudflareDeploymentReadProvenanceAdmissionSeen: true,
      wranglerDeploymentDiagnosticRepairSeen: true,
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen: true,
      publicWorkerStartupRepairSuccessorsSeen: 3,
      publicWorkerStartupProvenanceAdmissionSeen: true
    });

    const wrongIntelligenceOwner = {
      ...accepted.boundary,
      publicWorkerStartupRepairSuccessors: [
        {
          ...accepted.boundary.publicWorkerStartupRepairSuccessors[0],
          authorName: "Prometheus Infrastructure"
        },
        ...accepted.boundary.publicWorkerStartupRepairSuccessors.slice(1)
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      wrongIntelligenceOwner
    ));

    const reordered = {
      ...accepted.boundary,
      publicWorkerStartupRepairSuccessors: [
        accepted.boundary.publicWorkerStartupRepairSuccessors[1],
        accepted.boundary.publicWorkerStartupRepairSuccessors[0],
        accepted.boundary.publicWorkerStartupRepairSuccessors[2]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, reordered));

    const widenedRepair = {
      ...accepted.boundary,
      publicWorkerStartupRepairSuccessors: [
        accepted.boundary.publicWorkerStartupRepairSuccessors[0],
        {
          ...accepted.boundary.publicWorkerStartupRepairSuccessors[1],
          files: [
            ...accepted.boundary.publicWorkerStartupRepairSuccessors[1].files,
            "workers/infrastructure/unapproved-public-entry.mjs"
          ]
        },
        accepted.boundary.publicWorkerStartupRepairSuccessors[2]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, widenedRepair));

    const widenedAdmission = {
      ...accepted.boundary,
      publicWorkerStartupProvenanceAdmissionSuccessor: {
        ...accepted.boundary.publicWorkerStartupProvenanceAdmissionSuccessor,
        files: [
          ...accepted.boundary.publicWorkerStartupProvenanceAdmissionSuccessor.files,
          "scripts/unapproved-public-startup-admission.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      widenedAdmission
    ));

    commitFixture(accepted.repository, {
      path: "scripts/unapproved-public-startup-successor.mjs",
      content: "export const unapproved = true;\n",
      subject: "infrastructure: unapproved public startup successor",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      accepted.boundary
    ));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact public config entry consumer repair", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-config-consumer-"));
  try {
    const accepted = addPublicConfigEntryConsumerRepairSuccessor(
      addPublicWorkerStartupRepairSuccessors(
        addWranglerDeploymentDiagnosticRepairSuccessors(
          addCloudflareDeploymentReadRepairSuccessors(
            createOwnerBoundaryRepository(fixture, "accepted")
          )
        )
      )
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 14,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cloudflareDeploymentReadRepairSuccessorsSeen: 2,
      cloudflareDeploymentReadProvenanceAdmissionSeen: true,
      wranglerDeploymentDiagnosticRepairSeen: true,
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen: true,
      publicWorkerStartupRepairSuccessorsSeen: 3,
      publicWorkerStartupProvenanceAdmissionSeen: true,
      publicConfigEntryConsumerRepairSeen: true,
      publicConfigEntryConsumerProvenanceAdmissionSeen: true
    });

    const wrongOwner = {
      ...accepted.boundary,
      publicConfigEntryConsumerRepairSuccessor: {
        ...accepted.boundary.publicConfigEntryConsumerRepairSuccessor,
        authorName: "Prometheus Overwatch"
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongOwner));

    const wrongTree = {
      ...accepted.boundary,
      publicConfigEntryConsumerRepairSuccessor: {
        ...accepted.boundary.publicConfigEntryConsumerRepairSuccessor,
        tree: "0".repeat(40)
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, wrongTree));

    const widenedRepair = {
      ...accepted.boundary,
      publicConfigEntryConsumerRepairSuccessor: {
        ...accepted.boundary.publicConfigEntryConsumerRepairSuccessor,
        files: [
          ...accepted.boundary.publicConfigEntryConsumerRepairSuccessor.files,
          "wrangler.prometheusrouteiq-website.jsonc"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, widenedRepair));

    const widenedAdmission = {
      ...accepted.boundary,
      publicConfigEntryConsumerProvenanceAdmissionSuccessor: {
        ...accepted.boundary.publicConfigEntryConsumerProvenanceAdmissionSuccessor,
        files: [
          ...accepted.boundary.publicConfigEntryConsumerProvenanceAdmissionSuccessor.files,
          "scripts/unapproved-config-consumer-admission.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      widenedAdmission
    ));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact CRM public Worker adapter repair", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-crm-adapter-"));
  try {
    const accepted = addCrmPublicWorkerAdapterRepairSuccessor(
      addPublicConfigEntryConsumerRepairSuccessor(
        addPublicWorkerStartupRepairSuccessors(
          addWranglerDeploymentDiagnosticRepairSuccessors(
            addCloudflareDeploymentReadRepairSuccessors(
              createOwnerBoundaryRepository(fixture, "accepted")
            )
          )
        )
      )
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 17,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      cloudflareDeploymentReadRepairSuccessorsSeen: 2,
      cloudflareDeploymentReadProvenanceAdmissionSeen: true,
      wranglerDeploymentDiagnosticRepairSeen: true,
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen: true,
      publicWorkerStartupRepairSuccessorsSeen: 3,
      publicWorkerStartupProvenanceAdmissionSeen: true,
      publicConfigEntryConsumerRepairSeen: true,
      publicConfigEntryConsumerProvenanceAdmissionSeen: true,
      crmPublicWorkerAdapterRepairSeen: true,
      crmPublicWorkerAdapterProvenanceAdmissionSeen: true
    });

    const substitutedOwner = {
      ...accepted.boundary,
      crmPublicWorkerAdapterRepairSuccessor: {
        ...accepted.boundary.crmPublicWorkerAdapterRepairSuccessor,
        authorName: "Prometheus Infrastructure"
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      substitutedOwner
    ));

    const substitutedPaths = {
      ...accepted.boundary,
      crmPublicWorkerAdapterRepairSuccessor: {
        ...accepted.boundary.crmPublicWorkerAdapterRepairSuccessor,
        files: [
          ...accepted.boundary.crmPublicWorkerAdapterRepairSuccessor.files,
          "crm/unapproved-runtime.mjs"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      substitutedPaths
    ));

    const substitutedOrder = {
      ...accepted.boundary,
      crmPublicWorkerAdapterRepairSuccessor: {
        ...accepted.boundary.crmPublicWorkerAdapterRepairSuccessor,
        parent: accepted.boundary.publicConfigEntryConsumerRepairSuccessor.commit
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      accepted.repository,
      substitutedOrder
    ));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the ordered exact public-intake smoke and provenance successors", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-public-intake-"));
  try {
    const accepted = addPublicIntakeSmokeProvenanceSuccessors(
      createOwnerBoundaryRepository(fixture, "accepted")
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 6,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      publicIntakeSmokeSuccessorsSeen: 2,
      publicIntakeSmokeProvenanceAdmissionSeen: true
    });

    const reordered = {
      ...accepted.boundary,
      publicIntakeSmokeSuccessors: [
        accepted.boundary.publicIntakeSmokeSuccessors[1],
        accepted.boundary.publicIntakeSmokeSuccessors[0]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, reordered));

    const scopeDrift = {
      ...accepted.boundary,
      publicIntakeSmokeSuccessors: [
        {
          ...accepted.boundary.publicIntakeSmokeSuccessors[0],
          files: [...accepted.boundary.publicIntakeSmokeSuccessors[0].files, "scripts/extra-owner-file.mjs"]
        },
        accepted.boundary.publicIntakeSmokeSuccessors[1]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, scopeDrift));

    const mixedOwnership = {
      ...accepted.boundary,
      publicIntakeSmokeSuccessors: [
        {
          ...accepted.boundary.publicIntakeSmokeSuccessors[0],
          committerName: "Prometheus Overwatch",
          committerEmail: "overwatch@prometheus.local"
        },
        accepted.boundary.publicIntakeSmokeSuccessors[1]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, mixedOwnership));

    commitFixture(accepted.repository, {
      path: "scripts/unapproved-infrastructure-successor.mjs",
      content: "export const unapproved = true;\n",
      subject: "infrastructure: unapproved later successor",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the exact Dashboard verification and Infrastructure provenance successors", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-dashboard-"));
  try {
    const accepted = addDashboardProvenanceSuccessors(
      createOwnerBoundaryRepository(fixture, "accepted")
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 5,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: true,
      dashboardProvenanceAdmissionSeen: true
    });

    const unrecognized = createOwnerBoundaryRepository(fixture, "unrecognized");
    commitFilesFixture(unrecognized.repository, {
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      subject: "dashboard: unrecognized verification successor",
      changes: [
        {
          path: "scripts/verify-dashboard-runtime-workflows.mjs",
          content: "export const unrecognized = true;\n"
        },
        {
          path: "tests/dashboard-route-iq-product-focus.test.mjs",
          content: "export const unrecognizedTest = true;\n"
        }
      ]
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(
      unrecognized.repository,
      unrecognized.boundary
    ));

    commitFilesFixture(accepted.repository, {
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      subject: "dashboard: additional unapproved successor",
      changes: [{
        path: "scripts/verify-dashboard-runtime-workflows.mjs",
        content: "export const additional = true;\n"
      }]
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary admits only the ordered Dashboard harness pair and Infrastructure adoption", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-dashboard-harness-"));
  try {
    const accepted = addDashboardRuntimeHarnessSuccessors(
      createOwnerBoundaryRepository(fixture, "accepted")
    );
    assert.deepEqual(verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary), {
      terminalOwnerCommit: accepted.boundary.infrastructureCommits.at(-1).commit,
      descendants: 6,
      repairSeen: true,
      ciPortabilityRepairSeen: false,
      dashboardVerificationSeen: false,
      dashboardProvenanceAdmissionSeen: false,
      dashboardRuntimeHarnessSuccessorsSeen: 2,
      dashboardRuntimeHarnessAdoptionSeen: true
    });

    const reordered = {
      ...accepted.boundary,
      dashboardRuntimeHarnessSuccessors: [
        accepted.boundary.dashboardRuntimeHarnessSuccessors[1],
        accepted.boundary.dashboardRuntimeHarnessSuccessors[0]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, reordered));

    const mixedOwner = {
      ...accepted.boundary,
      dashboardRuntimeHarnessSuccessors: [
        {
          ...accepted.boundary.dashboardRuntimeHarnessSuccessors[0],
          committerName: "Prometheus Infrastructure",
          committerEmail: "infrastructure@prometheus.local"
        },
        accepted.boundary.dashboardRuntimeHarnessSuccessors[1]
      ]
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, mixedOwner));

    const adoptionScopeDrift = {
      ...accepted.boundary,
      dashboardRuntimeHarnessAdoptionSuccessor: {
        ...accepted.boundary.dashboardRuntimeHarnessAdoptionSuccessor,
        files: [
          ...accepted.boundary.dashboardRuntimeHarnessAdoptionSuccessor.files,
          "overwatch/governance/unowned.json"
        ]
      }
    };
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, adoptionScopeDrift));

    commitFilesFixture(accepted.repository, {
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      subject: "dashboard: unapproved third harness successor",
      changes: [{
        path: "scripts/verify-dashboard-runtime-workflows.mjs",
        content: "export const thirdSuccessor = true;\n"
      }]
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(accepted.repository, accepted.boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary rejects an Overwatch-authored Infrastructure-path mutation", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-path-"));
  try {
    const { repository, boundary } = createOwnerBoundaryRepository(fixture, "repository");
    commitFixture(repository, {
      path: "scripts/infrastructure-first.mjs",
      content: "export const first = false;\n",
      subject: "overwatch: mutate Infrastructure implementation",
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(repository, boundary));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner boundary rejects mixed ownership and merge successors", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-owner-boundary-invalid-"));
  try {
    const mixed = createOwnerBoundaryRepository(fixture, "mixed");
    commitFixture(mixed.repository, {
      path: "overwatch/governance/mixed-owner.json",
      content: "{}\n",
      subject: "overwatch: mixed owner successor",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local"
    });
    assert.throws(() => verifyInfrastructureOwnerBoundary(mixed.repository, mixed.boundary));

    const merged = createOwnerBoundaryRepository(fixture, "merged");
    const current = git(merged.repository, ["rev-parse", "HEAD"]);
    const mergeParent = git(merged.repository, ["rev-parse", "HEAD~1"]);
    const tree = git(merged.repository, ["rev-parse", "HEAD^{tree}"]);
    const mergeCommit = git(merged.repository, [
      "commit-tree", tree, "-p", current, "-p", mergeParent
    ], {
      input: "overwatch: merge successor\n",
      env: {
        GIT_AUTHOR_NAME: "Prometheus Overwatch",
        GIT_AUTHOR_EMAIL: "overwatch@prometheus.local",
        GIT_COMMITTER_NAME: "Prometheus Overwatch",
        GIT_COMMITTER_EMAIL: "overwatch@prometheus.local"
      }
    });
    git(merged.repository, ["update-ref", "refs/heads/main", mergeCommit, current]);
    assert.throws(
      () => verifyInfrastructureOwnerBoundary(merged.repository, merged.boundary),
      /linear non-merge successor/u
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("unknown verification exceptions are not mislabeled as repository corruption", () => {
  assert.deepEqual(formatPublicDeploymentFailure(new Error("synthetic"), "verify"), [
    PUBLIC_DEPLOYMENT_FAILURE.PREFLIGHT_FAILED,
    "PREFLIGHT_DIAGNOSTIC=UNCLASSIFIED_INTERNAL_FAILURE"
  ]);
  assert.notEqual(
    formatPublicDeploymentFailure(new Error("synthetic"), "verify")[0],
    PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED
  );
});

test("all 53 Actions source-map entries resolve from the validated source root", () => {
  assert.equal(actionsDependencySources.length, 23);
  assert.equal(actionsWorkspaceSources.length, 30);
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-source-map-actions-"));
  try {
    const repository = join(fixture, "prometheus-actions-exact");
    const workspace = join(fixture, "route-iq-linux-raw");
    const generated = join(workspace, ".generated");
    mkdirSync(generated, { recursive: true });
    const dependencyFiles = actionsDependencySources.map(path => join(repository, "node_modules", path));
    const workspaceFiles = actionsWorkspaceSources.map(path => join(workspace, path));
    for (const path of [...dependencyFiles, ...workspaceFiles]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "export const governed = true;\n", "utf8");
    }
    const relativeSources = [...dependencyFiles, ...workspaceFiles]
      .map(path => relative(generated, path).split("\\").join("/"));
    assert.equal(relativeSources.length, 53);
    assert.ok(relativeSources.every(path => path.startsWith("..")));

    const original = Object.freeze({
      version: 3,
      sourceRoot: generated,
      sources: Object.freeze(relativeSources),
      names: Object.freeze([]),
      mappings: ""
    });
    const canonical = canonicalizeGeneratedSourceMap(original, {
      sourceMapDirectory: generated,
      workspace,
      repositoryRoot: repository
    });
    assert.equal(canonical.sourceRoot, "generated");
    assert.deepEqual(canonical.sources, [
      ...actionsDependencySources.map(path => `node_modules/${path}`),
      ...actionsWorkspaceSources.map(path => `workspace/${path}`)
    ]);
    assert.equal(original.sourceRoot, generated);
    assert.deepEqual(original.sources, relativeSources);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("source-map resolution preserves a validated lexical root across filesystem aliases", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-source-map-root-alias-"));
  try {
    const repository = join(fixture, "repository");
    const workspace = join(fixture, "deep", "storage", "workspace");
    const workspaceAlias = join(fixture, "workspace-alias");
    const generated = join(workspace, ".generated");
    const generatedAlias = join(workspaceAlias, ".generated");
    const runtime = join(workspace, "workers", "runtime.js");
    const dependency = join(repository, "node_modules", "jose", "index.js");
    for (const path of [runtime, dependency]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "export const governed = true;\n", "utf8");
    }
    mkdirSync(generated, { recursive: true });
    symlinkSync(workspace, workspaceAlias, "dir");

    const sources = [runtime, dependency]
      .map(path => relative(generatedAlias, path).split("\\").join("/"));
    assert.ok(sources.every(path => path.startsWith("..")));
    assert.deepEqual(canonicalizeGeneratedSourceMap({
      version: 3,
      sourceRoot: generatedAlias,
      sources,
      names: [],
      mappings: ""
    }, {
      sourceMapDirectory: generatedAlias,
      workspace,
      repositoryRoot: repository
    }).sources, [
      "workspace/workers/runtime.js",
      "node_modules/jose/index.js"
    ]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("source-map canonicalization rejects malformed, missing, and realpath-escaped sources", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-source-map-adversarial-"));
  try {
    const repository = join(fixture, "repository");
    const workspace = join(fixture, "workspace");
    const generated = join(workspace, ".generated");
    const runtime = join(workspace, "workers", "runtime.js");
    const outside = join(fixture, "outside.js");
    const escaped = join(workspace, "workers", "escaped.js");
    mkdirSync(join(repository, "node_modules"), { recursive: true });
    mkdirSync(generated, { recursive: true });
    mkdirSync(dirname(runtime), { recursive: true });
    writeFileSync(runtime, "export const runtime = true;\n", "utf8");
    writeFileSync(outside, "export const outside = true;\n", "utf8");
    symlinkSync(outside, escaped);

    const canonicalize = sourceMap => canonicalizeGeneratedSourceMap(sourceMap, {
      sourceMapDirectory: generated,
      workspace,
      repositoryRoot: repository
    });
    for (const sourceMap of [
      null,
      {},
      { sourceRoot: generated, sources: "not-an-array" },
      { sourceRoot: workspace, sources: [relative(generated, runtime)] },
      { sourceRoot: generated, sources: [""] },
      { sourceRoot: generated, sources: [null] },
      { sourceRoot: generated, sources: ["bad\0source"] }
    ]) {
      assert.throws(canonicalize.bind(null, sourceMap), {
        message: "public_forward_rollback_source_map_invalid"
      });
    }
    assert.throws(
      () => canonicalize({ sourceRoot: generated, sources: ["../missing.js"] }),
      { message: "public_forward_rollback_source_map_source_invalid" }
    );
    for (const path of [outside, escaped]) {
      assert.throws(
        () => canonicalize({
          sourceRoot: generated,
          sources: [relative(generated, path).split("\\").join("/")]
        }),
        { message: "public_forward_rollback_source_map_outside_boundary" }
      );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("owner verifier emits only bounded fixed classifications without reason leakage", () => {
  const cases = [
    [
      new Error("public_forward_rollback_source_map_outside_boundary"),
      INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY
    ],
    [
      new Error("public_forward_rollback_SECRET_VALUE=do-not-print"),
      INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_GENERATION_FAILED
    ],
    [
      Object.assign(new Error("Authorization: Bearer do-not-print"), { code: "ERR_ASSERTION" }),
      INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.CONTRACT_OR_PROVENANCE_INVALID
    ],
    [
      new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, [
        "SECRET_VALUE=do-not-print"
      ]),
      INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.REPOSITORY_INTEGRITY_FAILED
    ],
    [
      new Error("cookie=do-not-print"),
      INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.INTERNAL_FAILURE
    ]
  ];
  for (const [error, expected] of cases) {
    const output = classifyInfrastructureOwnerVerifierFailure(error);
    assert.equal(output, expected);
    assert.match(output, /^[A-Z_]{1,80}$/u);
    assert.doesNotMatch(output, /SECRET|Authorization|Bearer|cookie|do-not-print/iu);
  }
  const verifier = readFileSync(
    join(root, "scripts", "verify-route-iq-public-repository-integrity-repair.mjs"),
    "utf8"
  );
  assert.doesNotMatch(verifier, /process\.stdout\.write\(["'`]FAIL/u);
});

test("generated rollback worker comments canonicalize distinct checkout roots identically", () => {
  const fixture = mkdtempSync(join(tmpdir(), "route-iq-rollback-paths-"));
  try {
    const results = [];
    for (const name of ["first", "second-longer-checkout-name"]) {
      const repository = join(fixture, name);
      const repositoryAlias = join(fixture, `${name}-alias`);
      const workspace = join(fixture, `${name}-workspace`);
      const generated = join(workspace, ".generated");
      const dependency = join(repository, "node_modules", "jose", "index.js");
      const runtime = join(workspace, "workers", "runtime.js");
      mkdirSync(dirname(dependency), { recursive: true });
      mkdirSync(dirname(runtime), { recursive: true });
      mkdirSync(generated, { recursive: true });
      writeFileSync(dependency, "export const dependency = true;\n", "utf8");
      writeFileSync(runtime, "export const runtime = true;\n", "utf8");
      symlinkSync(repository, repositoryAlias, "dir");
      const dependencyComment = relative(
        workspace,
        join(repositoryAlias, "node_modules", "jose", "index.js")
      ).split("\\").join("/");
      const runtimeComment = relative(workspace, runtime).split("\\").join("/");
      results.push(canonicalizeGeneratedWorkerSource(
        `// ${dependencyComment}\nconst dependency = true;\n\n// ${runtimeComment}\nconst runtime = true;\n`,
        { workspace, repositoryRoot: repository }
      ));
    }
    assert.equal(results[0], results[1]);
    assert.match(results[0], /^\/\/ node_modules\/jose\/index\.js/mu);
    assert.match(results[0], /^\/\/ workspace\/workers\/runtime\.js/mu);
    assert.doesNotMatch(results[0], /first|second-longer-checkout-name/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("rollback mismatch reports rollback failure rather than repository integrity", () => {
  assert.throws(
    () => verifyPublicForwardRollbackArtifact(root, "0".repeat(64)),
    error => error instanceof PublicDeploymentPolicyError
      && error.code === PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID
      && error.diagnostics.includes("ROLLBACK_DIAGNOSTIC=ARTIFACT_HASH_MISMATCH")
  );
});
