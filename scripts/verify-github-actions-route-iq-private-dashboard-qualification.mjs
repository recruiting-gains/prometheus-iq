import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workflowPath = ".github/workflows/qualify-route-iq-private-dashboard-release.yml";
const runnerPath = "scripts/run-route-iq-private-dashboard-qualification.mjs";
const contractPath = "workers/infrastructure/github-actions-route-iq-private-dashboard-qualification-v1.json";
const testPath = "tests/github-actions-route-iq-private-dashboard-qualification.test.mjs";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

export function verifyGithubActionsRouteIqPrivateDashboardQualification() {
  for (const path of [workflowPath, runnerPath, contractPath, testPath]) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }

  const workflow = read(workflowPath);
  const runner = read(runnerPath);
  const contract = JSON.parse(read(contractPath));

  assert.match(workflow, /^name: Qualify Route IQ Private Dashboard Release$/mu);
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu);
  assert.doesNotMatch(workflow, /^  (?:push|schedule|repository_dispatch|workflow_call):/mu);
  assert.match(workflow, /^permissions:\n  contents: read\n  actions: write$/mu);
  assert.match(workflow, /github\.actor == 'PrometheusRouteIQ'/u);
  assert.match(workflow, /github\.triggering_actor == 'PrometheusRouteIQ'/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /github\.run_attempt == 1/u);
  assert.match(workflow, /candidate_commit:/u);
  assert.match(workflow, /candidate_tree:/u);
  assert.match(workflow, /batch_id:/u);
  assert.match(workflow, /npm ci/u);
  assert.match(workflow, /npm run build/u);
  assert.match(workflow, /npm test/u);
  assert.match(workflow, /npm run lint/u);
  assert.match(workflow, /npm run typecheck/u);
  assert.match(workflow, /npm run security:check/u);
  assert.match(workflow, /node scripts\/check-cloudflare-unattended-secret-presence\.mjs --source=environment/u);
  assert.match(workflow, /npm run security:aegis:verify/u);
  assert.match(workflow, /node scripts\/sync-route-iq-private-dashboard-deploy-assets\.mjs/u);
  assert.match(workflow, /node scripts\/run-route-iq-private-dashboard-qualification\.mjs/u);
  assert.match(workflow, /actions\/upload-artifact@/u);
  assert.doesNotMatch(workflow, /wrangler(?:\.js)?\s+deploy/u);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_ACCESS_CLIENT_ID|CLOUDFLARE_ACCESS_CLIENT_SECRET/u);

  assert.match(runner, /qualification_secret_context_invalid/u);
  assert.match(runner, /private_dashboard_deploy_parity_invalid/u);
  assert.match(runner, /buildRouteIqPrivateForwardRollbackCandidateV3/u);
  assert.match(runner, /rollback-v3/u);
  assert.match(runner, /qualified_artifact_sha256/u);
  assert.doesNotMatch(runner, /wrangler(?:\.js)?\s+deploy/u);
  assert.doesNotMatch(runner, /process\.env\.CLOUDFLARE_|environment\.CLOUDFLARE_/u);

  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.workflowPath, workflowPath);
  assert.equal(contract.runnerPath, runnerPath);
  assert.equal(contract.verifierPath, "scripts/verify-github-actions-route-iq-private-dashboard-qualification.mjs");
  assert.equal(contract.testPath, testPath);
  assert.equal(contract.trigger, "workflow_dispatch");
  assert.equal(contract.repository, "PrometheusRouteIQ/prometheus-iq");
  assert.equal(contract.branch, "main");
  assert.equal(contract.actor, "PrometheusRouteIQ");
  assert.equal(contract.automaticTriggerAllowed, false);
  assert.equal(contract.cloudflareCredentialsAllowed, false);
  assert.equal(contract.deploymentStepsAllowed, false);
  assert.equal(contract.artifactUploadRequired, true);
  assert.equal(contract.qualificationArtifact.includesExactCommitAndTree, true);
  assert.equal(contract.qualificationArtifact.includesRollbackV3Digests, true);
  assert.equal(contract.qualificationArtifact.includesArtifactDigest, true);

  return Object.freeze({ status: "PASS", workflowPath, runnerPath });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(verifyGithubActionsRouteIqPrivateDashboardQualification(), null, 2)}\n`);
}
