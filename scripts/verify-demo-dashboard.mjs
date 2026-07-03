import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourcePath = "demo-dashboard/index.html";
const deployPath = "deploy/cloudflare-pages/demo-dashboard/index.html";
const source = read(sourcePath);
const deploy = read(deployPath);

assert(source === deploy, "Demo dashboard source and deploy asset must stay in sync.");
assert(source.includes('data-prometheus-demo="investor-franchise-owner"'), "Demo dashboard must include internal demo route marker.");
assert(source.includes('data-demo-data="mock-only"'), "Demo dashboard must mark data as mock-only.");
assert(source.includes('content="mock-data-only"'), "Demo dashboard must include mock-data-only metadata.");
assert(source.includes("Mock Data Only"), "Demo dashboard must visibly disclose mock data.");
assert(source.includes("No live customer records"), "Demo dashboard must disclose no live customer records.");
assert(source.includes("No production data access"), "Demo dashboard must disclose no production data access.");
assert(source.includes("noindex,nofollow,noarchive"), "Demo dashboard must be noindex.");
assert(source.includes("frame-ancestors 'none'"), "Demo dashboard CSP must prevent framing.");

for (const section of [
  "Executive Overview",
  "Location Performance",
  "Rep Activity",
  "Territory Intelligence",
  "Opportunity Pipeline",
  "Prometheus Intelligence Summary",
  "Operating profile selector mock"
]) {
  assert(source.includes(section), `Demo dashboard missing section ${section}.`);
}

for (const metric of [
  "Total Field Visits",
  "Qualified Leads Generated",
  "Conversion Opportunities",
  "Follow-Ups Due",
  "Active Reps",
  "Locations Covered"
]) {
  assert(source.includes(metric), `Demo dashboard missing executive metric ${metric}.`);
}

for (const location of [
  "Houston North",
  "Houston West",
  "Houston South",
  "Cypress",
  "Pearland"
]) {
  assert(source.includes(location), `Demo dashboard missing mock location ${location}.`);
}

for (const profile of [
  "Fitness / Franchise Sales",
  "Roofing",
  "Security",
  "Medical",
  "Insurance",
  "General Outside Sales"
]) {
  assert(source.includes(profile), `Demo dashboard missing operating profile ${profile}.`);
}

for (const insight of [
  "Cypress shows the strongest lead density this week.",
  "Pearland has high visits but low conversion.",
  "Houston West has 12 follow-ups at risk.",
  "Saturday field activity is outperforming weekday outreach.",
  "Three locations need manager review."
]) {
  assert(source.includes(insight), `Demo dashboard missing intelligence insight: ${insight}`);
}

for (const forbidden of [
  "fetch(",
  "XMLHttpRequest",
  "active-pool",
  "runtime-pools",
  "qualified-prospects",
  "CustomerGraphSnapshot",
  "META_INSTAGRAM",
  "GOOGLE_MAPS",
  "GOOGLE_PLACES",
  "places.googleapis.com",
  "maps.googleapis.com"
]) {
  assert(!source.includes(forbidden), `Demo dashboard must not reference ${forbidden}.`);
}

console.log("Investor/franchise owner demo dashboard verified: mock-only route asset, required sections, deploy parity, and no production data access references.");
