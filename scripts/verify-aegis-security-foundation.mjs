import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const checks = [];

function check(name, condition, details = {}) {
  checks.push({
    name,
    status: condition ? "passed" : "failed",
    ...details
  });
}

function containsAll(content, values) {
  return values.every(value => content.includes(value));
}

const worker = read("workers/prometheus-iq-worker.js");
const aegisControls = read("workers/infrastructure/aegis-security-controls.js");
const packageJson = JSON.parse(read("package.json"));
const wranglerPrivate = read("wrangler.jsonc");
const wranglerWebsite = read("wrangler.prometheusrouteiq-website.jsonc");
const releaseChecklist = read("docs/prometheus-release-checklist.md");
const authenticatedAccessRunbook = read("docs/authenticated-production-verification-access.md");

check("Aegis Worker control module exists", existsSync(resolve(root, "workers/infrastructure/aegis-security-controls.js")));
check("Worker delegates API requests through Aegis controls", containsAll(worker, [
  "enforceAegisControls",
  "withAegisHeaders",
  "url.pathname.startsWith(\"/api/\")"
]));
check("Aegis controls classify protected public route groups", containsAll(aegisControls, [
  "lead_intake",
  "beta_request",
  "instagram_read",
  "oauth_callback",
  "public_status",
  "public_api"
]));
check("Aegis controls include hardened API headers", containsAll(aegisControls, [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Resource-Policy",
  "X-Content-Type-Options",
  "Cache-Control"
]));
check("Aegis controls avoid permissive CORS", !/Access-Control-Allow-Origin["']?\s*:\s*["']\*/.test(aegisControls));
check("Private Worker has dedicated AEGIS_RATE_LIMITS binding", containsAll(wranglerPrivate, [
  "\"binding\": \"AEGIS_RATE_LIMITS\"",
  "1365393c0e534e44af87519e46ea1450"
]));
check("Website Worker has dedicated AEGIS_RATE_LIMITS binding", containsAll(wranglerWebsite, [
  "\"binding\": \"AEGIS_RATE_LIMITS\"",
  "1365393c0e534e44af87519e46ea1450"
]));
check("Authenticated production verification runbook remains present", containsAll(authenticatedAccessRunbook, [
  "Cloudflare Access",
  "npm run verify:authenticated-production",
  "Do not pass cookies as command-line arguments"
]));
check("Release checklist points to authenticated production gate", releaseChecklist.includes("npm run verify:authenticated-production"));
check("GitHub Actions security gate exists", existsSync(resolve(root, ".github/workflows/security-gates.yml")));
check("Dependabot governance config exists", existsSync(resolve(root, ".github/dependabot.yml")));
check("Package exposes Aegis verifier", packageJson.scripts?.["security:aegis:verify"] === "node scripts/verify-aegis-security-foundation.mjs");

const failed = checks.filter(item => item.status === "failed");
const report = {
  status: failed.length ? "failed" : "passed",
  checks,
  githubGovernanceEvidence: {
    localFiles: {
      dependabot: existsSync(resolve(root, ".github/dependabot.yml")),
      securityWorkflow: existsSync(resolve(root, ".github/workflows/security-gates.yml"))
    },
    repositorySettings: "manual_or_api_verification_required",
    reason: "This verifier cannot read GitHub branch protection, secret scanning, push protection, or required review settings without GitHub API access."
  }
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
