import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = [
  "crm/crm-foundation.mjs",
  "crm/cloudflare-kv-workspace-lead-store.mjs",
  "crm/workspace-lead-persistence.mjs",
  "crm/workspace-lead-production-runtime.mjs",
  "tests/crm-foundation.test.mjs",
  "tests/crm-cloudflare-kv-workspace-lead-store.test.mjs",
  "tests/crm-enterprise-foundation.test.mjs",
  "scripts/lint-crm.mjs",
  "scripts/typecheck-crm.mjs",
  "scripts/validate-crm-enterprise-foundation.mjs",
  "scripts/validate-crm-production-store.mjs",
  "workers/infrastructure/shared-lead-intake-pipeline.js",
  "workers/prometheus-iq-worker.js"
];
const providerBoundaryFiles = [
  "crm/crm-foundation.mjs",
  "crm/cloudflare-kv-workspace-lead-store.mjs",
  "crm/workspace-lead-persistence.mjs",
  "crm/workspace-lead-production-runtime.mjs",
  "tests/crm-foundation.test.mjs"
];

const forbiddenProviderPatterns = [
  /\bgmail\b/i,
  /\boutlook\b/i,
  /\bsms\b/i,
  /\btwilio\b/i,
  /\bsendgrid\b/i
];

const failures = [];

for (const file of files) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) failures.push(`${file} failed node --check: ${check.stderr || check.stdout}`);
}

for (const file of providerBoundaryFiles) {
  const content = readFileSync(file, "utf8");
  for (const pattern of forbiddenProviderPatterns) {
    if (pattern.test(content)) failures.push(`${file} references an external communication provider boundary term: ${pattern}`);
  }
}

if (failures.length) {
  console.error("CRM lint failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("CRM lint passed: syntax and external-provider boundary checks.");
}
