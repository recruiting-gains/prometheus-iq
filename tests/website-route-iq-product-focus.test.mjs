import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import {
  ROUTE_IQ_REQUEST_ENDPOINT,
  ROUTE_IQ_REQUEST_RECEIPT_PATTERN,
  buildRouteIqRequestPayload,
  resolveAcquisitionSource,
  submitRouteIqRequest
} from "../src/route-iq-request-form.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readBytes = path => readFileSync(resolve(root, path));
const size = path => statSync(resolve(root, path)).size;
let buildComplete = false;

function ensureFreshBuild() {
  if (buildComplete) return;
  const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", timeout: 120_000 });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  buildComplete = true;
}

function filesUnder(directory) {
  const absolute = resolve(root, directory);
  const result = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else result.push(relative(absolute, path));
    }
  };
  walk(absolute);
  return result.sort();
}

function validForm(overrides = {}) {
  return {
    businessName: "Northstar Commercial Services",
    contactName: "Jordan Rivera",
    businessEmail: "jordan@northstar.example",
    phone: "713-555-0134",
    industry: "Commercial services",
    locationCount: "4",
    estimatedUserCount: "28",
    territory: "Greater Houston",
    primaryProblem: "Field teams need a governed way to plan visits and capture outcomes.",
    desiredTimeline: "Within 90 days",
    consent: true,
    websiteUrl: "",
    ...overrides
  };
}

test("five-second positioning names one product, buyer, user, problem, difference, and action", () => {
  const source = read("src/main.jsx");
  const metadata = read("landing.html");

  assert.match(source, /<h1>Prometheus Route IQ<\/h1>/);
  assert.match(
    source,
    /<p className="patent-label">U\.S\. PATENT PENDING TECHNOLOGY<\/p>\s*<SectionLabel>Prometheus\.IQ Field Decision Intelligence<\/SectionLabel>/
  );
  assert.match(source, /Field decision intelligence for outside-sales teams/);
  assert.match(source, /outside-sales leaders and representatives/);
  assert.match(source, /most important field decision often happens between systems/);
  assert.match(source, /More than businesses on a map/);
  assert.match(source, />REQUEST ROUTE IQ</);
  assert.match(source, />See How Route IQ Works</);
  assert.match(metadata, /Prometheus Route IQ \| Field Decision Intelligence for Outside Sales/);
});

test("public claims explain the governed intelligence loop without publishing internal-report copy", () => {
  const source = read("src/main.jsx");
  const publicText = [
    source,
    read("landing.html"),
    read("public-site-static/privacy/index.html"),
    read("public-site-static/terms/index.html"),
    read("public-site-static/data-deletion/index.html"),
    read("public-site-static/site.webmanifest")
  ].join("\n");

  assert.match(source, /<SectionLabel>The intelligence loop<\/SectionLabel>/);
  assert.match(source, /When evidence quality and coverage support it, governed outcomes can contribute to authorized patterns over time/);
  assert.match(source, /representative and leader in control/);
  assert.match(source, /Route IQ organizes context so a person can compare approved opportunities/);
  assert.match(source, /<SectionLabel>Cross-industry configuration<\/SectionLabel>/);
  assert.doesNotMatch(source, /Probability is a governed method, not a promise/);
  assert.doesNotMatch(source, /Credibility starts with saying what is not proven/);
  assert.doesNotMatch(source, /Current readiness|recommendation influence|prospective collection|causal uplift|recommendation superiority/i);
  assert.doesNotMatch(source, /efficient data|methodology|qualification report|governance report/i);
  assert.doesNotMatch(publicText, /Fitness Connection|Gaia|Athena|franchise(?:e|ing)?|committed pilot/i);
  assert.doesNotMatch(publicText, /\b(?:customer|client|partner|pilot|sponsor|endorser)\s+(?:logo|testimonial|story|spotlight|case study|showcase|endorsement)\b|\b(?:trusted by|used by|deployed (?:at|with)|launch customer|design partner|official partner|active pilot|current customer)\b/i);
  assert.doesNotMatch(publicText, /AI operating system|automatic route improvement|better field direction|next route improves|proven recommendation superiority|guaranteed outcome/i);
});

test("public positioning supports human comparison without implying active selection or synthetic performance evidence", () => {
  const source = read("src/main.jsx");

  assert.match(source, /organizes context so a person can compare approved opportunities/);
  assert.match(source, /authorized evidence has sufficient quality and coverage/);
  assert.doesNotMatch(source, /Route IQ (?:selects|reorders|ranks)|which opportunity deserves attention|best next decision/i);
  assert.doesNotMatch(source, /every field outcome|where teams perform well|where they struggle/i);
  assert.doesNotMatch(source, /--value|72%|84%|39%/);
  assert.match(source, /Evidence dependent/);
});

test("Route IQ is explicitly differentiated without claiming to replace adjacent systems", () => {
  const source = read("src/main.jsx");
  for (const category of ["CRM", "Lead list", "Map", "Distance-only routing", "Generic AI advice", "Surveillance"]) {
    assert.match(source, new RegExp(category));
  }
  assert.match(source, /Route IQ complements the systems an outside-sales organization already uses/);
  assert.match(source, /without reducing field work to monitoring/);
  assert.doesNotMatch(source, /replace(?:s|d)? (?:a |your )?(?:route planner|CRM|maps)/i);
});

test("the customer-facing section order stays concise and all navigation anchors resolve", () => {
  const source = read("src/main.jsx");
  const styles = read("src/styles.css");
  const order = [
    'id="top"',
    'id="how-it-works"',
    'id="teams"',
    "<SectionLabel>The intelligence loop</SectionLabel>",
    "<SectionLabel>Route IQ capabilities</SectionLabel>",
    'id="different"',
    'id="industries"',
    'id="request"'
  ];
  let position = -1;
  for (const marker of order) {
    const next = source.indexOf(marker);
    assert.ok(next > position, `${marker} must appear in the customer journey order.`);
    position = next;
  }
  const ids = new Set([...source.matchAll(/id="([^"]+)"/gu)].map(match => match[1]));
  for (const href of [...source.matchAll(/href="#([^"]+)"/gu)].map(match => match[1])) {
    assert.equal(ids.has(href), true, `Navigation anchor #${href} must resolve.`);
  }
  assert.match(styles, /section\[id\] \{ scroll-margin-top: 72px; \}/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*section\[id\] \{ scroll-margin-top: 66px; \}/);
});

test("metadata, social preview, canonical URL, and structured data describe only Route IQ", () => {
  const metadata = read("landing.html");
  assert.match(metadata, /<link rel="canonical" href="https:\/\/prometheusrouteiq\.com\/">/);
  assert.match(metadata, /twitter:card" content="summary_large_image"/);
  assert.match(metadata, /route-iq-field-operations-social\.jpg/);
  assert.match(metadata, /<meta property="og:image:width" content="1200">/);
  assert.match(metadata, /<meta property="og:image:height" content="675">/);
  const structured = metadata.match(/<script type="application\/ld\+json">([^<]+)<\/script>/u)?.[1];
  assert.ok(structured, "The landing page must publish a JSON-LD record.");
  const graph = JSON.parse(structured)["@graph"];
  assert.deepEqual(graph.map(item => item["@type"]), ["Organization", "SoftwareApplication"]);
  assert.equal(graph[0].name, "Prometheus.IQ");
  assert.equal(graph[1].name, "Prometheus Route IQ");
  assert.equal(graph[1].audience.audienceType, "Field operations leaders and field representatives");
  assert.doesNotMatch(structured, /customer|partner|pilot|Fitness Connection/i);
  const structuredHash = createHash("sha256").update(structured).digest("base64");
  assert.match(metadata, new RegExp(`script-src 'self' 'sha256-${structuredHash.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}'`));
  assert.match(read("public-site-static/_headers"), new RegExp(`script-src 'self' 'sha256-${structuredHash.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}'`));
});

test("all legal pages are Route IQ focused, linked, and byte-identical to deployment", () => {
  for (const page of ["privacy", "terms", "data-deletion"]) {
    const sourcePath = `public-site-static/${page}/index.html`;
    const deployPath = `deploy/prometheusrouteiq-website/${page}/index.html`;
    assert.deepEqual(readBytes(sourcePath), readBytes(deployPath), `${page} source and deploy bytes drifted.`);
    const html = read(sourcePath);
    assert.match(html, /Prometheus/);
    assert.match(html, /Route IQ/);
    assert.match(html, /REQUEST ROUTE IQ/);
    assert.doesNotMatch(html, /Prometheus IQ|flagship product|AI operating system|outside-sales intelligence|improve routes over time/i);
  }
  assert.deepEqual(readBytes("public-site-static/legal.css"), readBytes("deploy/prometheusrouteiq-website/legal.css"));
  assert.deepEqual(readBytes("public-site-static/_headers"), readBytes("deploy/prometheusrouteiq-website/_headers"));
  assert.deepEqual(readBytes("public-site-static/site.webmanifest"), readBytes("deploy/prometheusrouteiq-website/site.webmanifest"));
  assert.match(read("public-site-static/privacy/index.html"), /up to 18 months/);
  assert.match(read("public-site-static/data-deletion/index.html"), /does not silently rewrite historical evidence/);
});

test("production build lazy-loads the governed 3D scene without restoring obsolete product claims", () => {
  ensureFreshBuild();
  const builtIndex = read("dist-public/index.html");
  const scriptPath = builtIndex.match(/<script[^>]+src="\/(assets\/landing-[^"]+\.js)"/u)?.[1];
  const cssPath = builtIndex.match(/<link[^>]+href="\/(assets\/landing-[^"]+\.css)"/u)?.[1];
  const scenePath = filesUnder("dist-public/assets").find(path => /^IntelligenceScene-.+\.js$/u.test(path));

  assert.ok(scriptPath, "Production index must reference one built Route IQ entry bundle.");
  assert.ok(cssPath, "Production index must reference one built Route IQ stylesheet.");
  assert.ok(scenePath, "Production build must emit a separate lazy IntelligenceScene bundle.");
  const entryBundle = read(`dist-public/${scriptPath}`);
  const sceneBundle = read(`dist-public/assets/${scenePath}`);
  assert.match(entryBundle, /REQUEST ROUTE IQ/);
  assert.match(entryBundle, /Field decision intelligence for outside-sales teams/);
  assert.match(entryBundle, /U\.S\. PATENT PENDING TECHNOLOGY/);
  assert.match(entryBundle, /Governed field outcomes can improve the context available over time/);
  assert.match(entryBundle, /IntelligenceScene-/);
  assert.doesNotMatch(entryBundle, /WebGLRenderer/);
  assert.match(sceneBundle, /WebGLRenderer/);
  assert.match(sceneBundle, /FIELD INTELLIGENCE CORE/);
  assert.match(entryBundle, /Cross-industry configuration/);
  assert.doesNotMatch(entryBundle, /Probability is a governed method|Credibility starts with saying what is not proven/);
  assert.doesNotMatch(`${entryBundle}\n${sceneBundle}`, /AI operating system|Fitness Connection|Gaia|Athena/i);
  assert.doesNotMatch(`${entryBundle}\n${sceneBundle}`, /\b(?:customer|client|partner|pilot|sponsor|endorser)\s+(?:logo|testimonial|story|spotlight|case study|showcase|endorsement)\b|\b(?:trusted by|used by|deployed (?:at|with)|launch customer|design partner|official partner|active pilot|current customer)\b/i);
});

test("supported-device critical assets, fallback image, and lazy 3D bundle stay within separate budgets", () => {
  ensureFreshBuild();
  const builtIndex = read("dist-public/index.html");
  const scriptPath = builtIndex.match(/src="\/(assets\/landing-[^"]+\.js)"/u)?.[1];
  const cssPath = builtIndex.match(/href="\/(assets\/landing-[^"]+\.css)"/u)?.[1];
  const logoPath = filesUnder("dist-public/assets").find(path => /^prometheus-company-icon-512-.+\.png$/u.test(path));
  const scenePath = filesUnder("dist-public/assets").find(path => /^IntelligenceScene-.+\.js$/u.test(path));
  assert.ok(scriptPath && cssPath);
  assert.ok(logoPath && scenePath);

  const javascriptBytes = size(`dist-public/${scriptPath}`);
  const cssBytes = size(`dist-public/${cssPath}`);
  const logoBytes = size(`dist-public/assets/${logoPath}`);
  const fallbackImageBytes = size("dist-public/route-iq-field-operations.jpg");
  const lazySceneBytes = size(`dist-public/assets/${scenePath}`);
  const supportedDeviceCriticalBytes = javascriptBytes + cssBytes + logoBytes + size("dist-public/index.html");

  assert.doesNotMatch(read("landing.html"), /<link[^>]+rel="preload"[^>]+route-iq-field-operations\.jpg/u);
  assert.doesNotMatch(builtIndex, /<link[^>]+rel="preload"[^>]+route-iq-field-operations\.jpg/u);
  assert.ok(javascriptBytes <= 375_000, `Critical JavaScript budget exceeded: ${javascriptBytes}`);
  assert.ok(cssBytes <= 25_000, `CSS budget exceeded: ${cssBytes}`);
  assert.ok(fallbackImageBytes <= 200_000, `Fallback-only image budget exceeded: ${fallbackImageBytes}`);
  assert.ok(supportedDeviceCriticalBytes <= 475_000, `Supported-device critical first-load budget exceeded: ${supportedDeviceCriticalBytes}`);
  assert.ok(lazySceneBytes <= 950_000, `Lazy 3D bundle budget exceeded: ${lazySceneBytes}`);
});

test("a fresh source build emits the complete deployable Website package", () => {
  ensureFreshBuild();
  const generated = filesUnder("dist-public");
  assert.ok(generated.includes("index.html"));
  assert.ok(generated.includes("privacy/index.html"));
  assert.ok(generated.includes("terms/index.html"));
  assert.ok(generated.includes("data-deletion/index.html"));
  assert.ok(generated.some(path => /^assets\/landing-.+\.js$/u.test(path)));
  assert.ok(generated.some(path => /^assets\/IntelligenceScene-.+\.js$/u.test(path)));
  const entryPath = generated.find(path => /^assets\/landing-.+\.js$/u.test(path));
  assert.match(read(`dist-public/${entryPath}`), /\/api\/partner-intake/);
});

test("Route IQ request UI captures only governed fields and explains durable acceptance", () => {
  const source = read("src/main.jsx");
  const expected = [
    "businessName", "contactName", "businessEmail", "phone", "industry", "locationCount",
    "estimatedUserCount", "territory", "primaryProblem", "desiredTimeline", "consent", "websiteUrl"
  ];
  for (const name of expected) assert.match(source, new RegExp(`name="${name}"`));
  assert.match(source, /Success appears only after durable acceptance/);
  assert.match(source, /You will receive a unique receipt/);
  assert.match(source, /Prometheus\.IQ then reviews the request and may follow up/);
  assert.match(source, /role="status"/);
  assert.match(source, /Receipt <strong>/);
  assert.equal(ROUTE_IQ_REQUEST_ENDPOINT, "/api/partner-intake");
});

test("request payload is bounded, normalized, attributed, and consent gated", () => {
  const result = buildRouteIqRequestPayload({
    formData: validForm({ businessEmail: "  JORDAN@NORTHSTAR.EXAMPLE  " }),
    now: new Date("2026-07-18T14:30:00.000Z"),
    acquisitionSource: "linkedin"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.payload), [
    "version", "formId", "businessName", "contactName", "businessEmail", "phone", "industry",
    "locationCount", "estimatedUserCount", "territory", "primaryProblem", "desiredTimeline", "consent",
    "submittedAt", "acquisitionSource", "websiteUrl"
  ]);
  assert.equal(result.payload.businessEmail, "jordan@northstar.example");
  assert.equal(result.payload.locationCount, 4);
  assert.equal(result.payload.estimatedUserCount, 28);
  assert.equal(result.payload.acquisitionSource, "linkedin");
  assert.equal(result.payload.submittedAt, "2026-07-18T14:30:00.000Z");
  assert.equal(buildRouteIqRequestPayload({ formData: validForm({ consent: false }) }).ok, false);
  assert.equal(buildRouteIqRequestPayload({ formData: validForm({ websiteUrl: "bot" }) }).ok, false);
  assert.equal(buildRouteIqRequestPayload({ formData: validForm({ businessEmail: "not-an-email" }) }).ok, false);
});

test("acquisition source uses a bounded campaign source and otherwise fails to direct", () => {
  assert.equal(resolveAcquisitionSource("https://prometheusrouteiq.com/?utm_source=linkedin", ""), "linkedin");
  assert.equal(resolveAcquisitionSource("https://prometheusrouteiq.com/", "https://search.example/path"), "search.example");
  assert.equal(resolveAcquisitionSource("not a url", "not a referrer"), "direct");
});

test("request submission uses one same-origin POST and exposes only the unique receipt", async () => {
  const calls = [];
  const payload = buildRouteIqRequestPayload({ formData: validForm(), now: new Date("2026-07-18T14:30:00.000Z") }).payload;
  const result = await submitRouteIqRequest({
    payload,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        receiptId: "riq_receipt_0123456789abcdef01234567",
        timestamp: "2026-07-18T14:30:01.000Z",
        internalRecord: { contact: "must-not-be-returned" }
      }), { status: 201, headers: { "content-type": "application/json" } });
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/partner-intake");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls[0].init.redirect, "error");
  assert.deepEqual(result, { ok: true, receiptId: "riq_receipt_0123456789abcdef01234567", duplicate: false, submittedAt: "2026-07-18T14:30:01.000Z" });
  assert.equal(ROUTE_IQ_REQUEST_RECEIPT_PATTERN.test(result.receiptId), true);
  assert.equal("internalRecord" in result, false);
});

test("request submission fails closed on rejection, invalid JSON, or any noncanonical receipt without retry", async () => {
  const payload = buildRouteIqRequestPayload({ formData: validForm() }).payload;
  for (const response of [
    new Response(JSON.stringify({ ok: false }), { status: 422 }),
    new Response("not-json", { status: 201 }),
    new Response(JSON.stringify({ ok: true }), { status: 201 }),
    new Response(JSON.stringify({ ok: true, submissionId: "riq_receipt_0123456789abcdef01234567" }), { status: 201 }),
    new Response(JSON.stringify({ ok: true, receipt: { id: "riq_receipt_0123456789abcdef01234567" } }), { status: 201 }),
    new Response(JSON.stringify({ ok: true, receiptId: "riq_receipt_0123456789ABCDEF01234567" }), { status: 201 }),
    new Response(JSON.stringify({ ok: true, receiptId: "riq_receipt_01234567" }), { status: 201 })
  ]) {
    let calls = 0;
    await assert.rejects(submitRouteIqRequest({ payload, fetchImpl: async () => { calls += 1; return response; } }), /REQUEST_/);
    assert.equal(calls, 1);
  }
});

test("the governed request module remains the source for the bundled public intake client", () => {
  const requestSource = read("src/route-iq-request-form.js");
  assert.match(requestSource, /export const ROUTE_IQ_REQUEST_ENDPOINT = "\/api\/partner-intake"/);
  assert.match(requestSource, /method: "POST"/);
  assert.match(requestSource, /credentials: "same-origin"/);
  assert.match(requestSource, /redirect: "error"/);
});
