import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Script } from "node:vm";
import {
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  verifyCloudflareFounderAttendedServiceTokenArchitecture
} from "./verify-cloudflare-founder-attended-service-token.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const index = read("index.html");
const serviceWorker = read("sw.js");
const headers = read("_headers");
const deployIndex = read("deploy/cloudflare-pages/index.html");
const deployServiceWorker = read("deploy/cloudflare-pages/sw.js");
const deployHeaders = read("deploy/cloudflare-pages/_headers");
const publicHeaders = read("public-site-static/_headers");
const viteConfig = read("vite.config.js");

const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert(inlineScripts.length === 1, "Private app must contain exactly one CSP-hashed inline script.");
if (inlineScripts.length === 1) {
  try {
    new Script(inlineScripts[0][1], { filename: "index-inline.js" });
  } catch (error) {
    failures.push(`Private app script does not parse: ${error.message}`);
  }
  const hash = `sha256-${createHash("sha256").update(inlineScripts[0][1], "utf8").digest("base64")}`;
  for (const [name, content] of [["index.html", index], ["_headers", headers], ["deploy _headers", deployHeaders]]) {
    assert(content.includes(`'${hash}'`), `${name} does not contain the current private-app script hash.`);
  }
}

for (const [name, content] of [["index.html", index], ["_headers", headers], ["deploy _headers", deployHeaders]]) {
  assert(!/script-src[^;]*'unsafe-inline'/i.test(content), `${name} permits arbitrary inline scripts.`);
}

for (const requiredHeader of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "Cache-Control: no-store",
  "X-Robots-Tag: noindex"
]) {
  assert(headers.includes(requiredHeader), `_headers is missing ${requiredHeader}.`);
  assert(deployHeaders.includes(requiredHeader), `deploy _headers is missing ${requiredHeader}.`);
}

assert(!serviceWorker.includes('"./index.html"'), "Service worker must not cache authenticated index.html.");
assert(!serviceWorker.includes('caches.match("./index.html")'), "Service worker must not provide offline authenticated app access.");
assert(index === deployIndex, "Deployment index.html is out of sync with the reviewed source.");
assert(serviceWorker === deployServiceWorker, "Deployment sw.js is out of sync with the reviewed source.");
assert(!/name="location(?:Lat|Lng|Accuracy|CapturedAt)"/.test(index), "GPS coordinates must not be stored in editable form fields.");
assert(!index.includes("Math.random()"), "Security-relevant identifiers must use Web Crypto.");
assert(publicHeaders.includes("geolocation=()"), "Public website must not request geolocation permission.");
assert(publicHeaders.includes("X-Frame-Options: DENY"), "Public website must prevent framing.");
assert(viteConfig.includes('input: resolve(import.meta.dirname, "landing.html")'), "Public build must remain isolated from the private app.");

const excludedDirectories = new Set([".git", "backups", "dist-public", "node_modules"]);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsonc", ".md", ".mjs", ".toml", ".txt", ".yaml", ".yml"]);
const secretPatterns = [
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (excludedDirectories.has(entry)) continue;
    const absolute = resolve(directory, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (info.size > 2_000_000) continue;
    const extension = entry.includes(".") ? entry.slice(entry.lastIndexOf(".")) : "";
    if (!textExtensions.has(extension) && entry !== "_headers" && entry !== ".gitignore") continue;
    const content = readFileSync(absolute, "utf8");
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(content)) failures.push(`${relative(root, absolute)} contains a high-confidence ${label} pattern.`);
    }
  }
}

walk(root);

for (const finding of scanTrackedRepository({ root })) {
  failures.push(`${finding.path}:${finding.line} contains a high-confidence ${finding.kind}.`);
}
for (const failure of verifyLocalSecretArtifacts({ root })) {
  failures.push(`Cloudflare unattended local-secret protection failed: ${failure}.`);
}
try {
  verifyCloudflareFounderAttendedServiceTokenArchitecture();
} catch {
  failures.push("Cloudflare Founder-attended service-token Infrastructure architecture check failed.");
}

if (failures.length) {
  console.error("Security checks failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Security checks passed: CSP, deployment sync, navigation caching, GPS fields, identifiers, headers, secret patterns, and Cloudflare credential protections.");
}
