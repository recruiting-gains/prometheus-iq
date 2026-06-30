import fs from "node:fs";
import path from "node:path";

const runtimeTargets = [
  "index.html",
  "landing.html",
  "landing.js",
  "src",
  "deploy/cloudflare-pages",
  "deploy/prometheusrouteiq-website",
  "founder-command-center"
];

const forbiddenPatterns = [
  { name: "Google API endpoint", regex: /\b(?:places|maps)\.googleapis\.com\b/i },
  { name: "Google API key env reference", regex: /\bGOOGLE_(?:MAPS|PLACES)_API_KEY\b/ }
];

const networkPrimitivePatterns = [
  { name: "Client fetch", regex: /\bfetch\s*\(/ },
  { name: "Client XMLHttpRequest", regex: /\bXMLHttpRequest\b/ }
];

const allowedGoogleUrlPattern = /https:\/\/(?:www\.)?google\.[^/]+\/maps\/|https:\/\/maps\.google\.[^/]+\/|https:\/\/maps\.app\.goo\.gl\//i;

function listFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const files = [];
  for (const entry of fs.readdirSync(target)) {
    if (["node_modules", "dist", ".git"].includes(entry)) continue;
    files.push(...listFiles(path.join(target, entry)));
  }
  return files;
}

const files = runtimeTargets
  .flatMap(listFiles)
  .filter(file => /\.(html|js|jsx|ts|tsx|css|json|webmanifest)$/.test(file));

const violations = [];
const networkPrimitives = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    const matches = text.match(new RegExp(pattern.regex.source, `${pattern.regex.flags.includes("i") ? "i" : ""}g`)) || [];
    if (!matches.length) continue;
    if (pattern.name === "Google API endpoint" && matches.every(match => allowedGoogleUrlPattern.test(match))) continue;
    violations.push({ file, pattern: pattern.name, count: matches.length });
  }
  for (const pattern of networkPrimitivePatterns) {
    const matches = text.match(new RegExp(pattern.regex.source, `${pattern.regex.flags.includes("i") ? "i" : ""}g`)) || [];
    if (matches.length) networkPrimitives.push({ file, pattern: pattern.name, count: matches.length });
  }
}

if (violations.length) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Normal app runtime contains live-call primitives or Google API endpoint/key references.",
    violations
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    checked_files: files.length,
    live_google_api_calls: 0,
    google_api_endpoint_or_key_references: 0,
    generic_network_primitives: networkPrimitives,
    note: "Runtime app files contain no Google API endpoint/key references. Google Maps links are static navigation links only."
  }, null, 2));
}
