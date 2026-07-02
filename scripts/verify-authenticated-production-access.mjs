import { spawnSync } from "node:child_process";

const forwardedArgs = [];
let dryRun = false;
let help = false;
let cdpEndpoint = process.env.PROMETHEUS_PRODUCTION_CDP || "";

for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];

  if (token === "--help" || token === "-h") {
    help = true;
    continue;
  }

  if (token === "--dry-run") {
    dryRun = true;
    continue;
  }

  if (token === "--auth-cookie" || token.startsWith("--auth-cookie=")) {
    console.error("Do not pass Cloudflare Access cookies on the command line. Use CDP or environment variables.");
    process.exit(2);
  }

  if (token === "--cdp") {
    const value = process.argv[++index] || "";
    cdpEndpoint = value;
    forwardedArgs.push(token, value);
    continue;
  }

  if (token.startsWith("--cdp=")) {
    cdpEndpoint = token.slice("--cdp=".length);
    forwardedArgs.push(token);
    continue;
  }

  forwardedArgs.push(token);
}

if (help) {
  console.log(`Usage: node scripts/verify-authenticated-production-access.mjs [options]

Delegates to scripts/verify-production-release.mjs after confirming an authenticated
Cloudflare Access verification method is available.

Accepted authentication methods:
  --cdp http://127.0.0.1:<port>       Already-authenticated local Chrome CDP session.
  PROMETHEUS_PRODUCTION_CDP           CDP endpoint when --cdp is omitted.
  PROMETHEUS_ACCESS_COOKIE            Private Cookie header in environment only.
  CF_AUTHORIZATION / CF_APPSESSION    Private Cloudflare Access cookie values in environment only.

Forwarded release verifier options:
  --production-url <url>
  --worker-name <name>
  --expected-worker-version <id>
  --skip-existing-gates
  --json

Safety:
  --auth-cookie is intentionally rejected here to avoid putting session material in
  shell history or process arguments. Use CDP or environment variables instead.
`);
  process.exit(0);
}

const hasAccessCookie = Boolean(process.env.PROMETHEUS_ACCESS_COOKIE);
const hasSplitCookie = Boolean(process.env.CF_AUTHORIZATION || process.env.CF_APPSESSION);
const hasCdp = Boolean(cdpEndpoint);
const methods = [
  hasCdp ? "CDP" : "",
  hasAccessCookie ? "PROMETHEUS_ACCESS_COOKIE" : "",
  hasSplitCookie ? "CF_AUTHORIZATION/CF_APPSESSION" : ""
].filter(Boolean);

if (!methods.length) {
  console.error("Authenticated production verification is blocked: no Cloudflare Access session method was provided.");
  console.error("Provide --cdp http://127.0.0.1:<port>, PROMETHEUS_PRODUCTION_CDP, PROMETHEUS_ACCESS_COOKIE, or CF_AUTHORIZATION/CF_APPSESSION.");
  process.exit(2);
}

if (hasCdp && !forwardedArgs.some(arg => arg === "--cdp" || arg.startsWith("--cdp="))) {
  forwardedArgs.push("--cdp", cdpEndpoint);
}

const summary = {
  status: "ready",
  methods,
  cdp: hasCdp ? cdpEndpoint : null,
  cookieEnvironmentPresent: hasAccessCookie || hasSplitCookie,
  verifier: "scripts/verify-production-release.mjs",
  forwardedArgs: forwardedArgs.map(arg => arg.includes("CF_") || arg.includes("Cookie") ? "[redacted]" : arg)
};

if (dryRun) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

console.log(`Authenticated production verification method: ${methods.join(", ")}`);
const result = spawnSync(process.execPath, ["scripts/verify-production-release.mjs", ...forwardedArgs], {
  cwd: new URL("..", import.meta.url),
  env: process.env,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
