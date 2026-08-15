import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  ROUTE_IQ_GYM_REQUEST_ACQUISITION_SOURCE,
  ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS,
  ROUTE_IQ_GYM_REQUEST_ENDPOINT,
  ROUTE_IQ_GYM_REQUEST_FORM_ID,
  ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN,
  ROUTE_IQ_GYM_REQUEST_VERSION,
  buildRouteIqGymRequestPayload,
  buildRouteIqGymThankYouPath,
  collectRouteIqGymAttribution,
  preserveRouteIqGymAttribution,
  submitRouteIqGymRequest
} from "../src/route-iq-gym-request-form.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readBytes = path => readFileSync(resolve(root, path));
const sha256 = path => createHash("sha256").update(readBytes(path)).digest("hex");
let buildComplete = false;

function validGymForm(overrides = {}) {
  return {
    fullName: "Jordan Rivera",
    gymName: "Iron Harbor Training",
    cityState: "Houston, TX",
    outsideRepCount: "4",
    workEmail: "JORDAN@IRONHARBOR.EXAMPLE",
    cell: "+1 713 555 0148",
    consent: true,
    websiteUrl: "",
    ...overrides
  };
}

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

test("the gym homepage follows the founder image, request, intelligence, bridge, and footer order", () => {
  const source = read("src/main.jsx");
  const gymPage = source.slice(source.indexOf("function GymPage()"), source.indexOf("function ThankYouPage()"));
  const markers = [
    'className="gym-hero-picture"',
    "Get Your Gym's Route Dashboard Built In 2 Hours",
    "Get My Gym Dashboard",
    "<GymRequestForm />",
    'id="intelligence"',
    'className="gym-intelligence-picture"',
    'className="gym-intelligence-columns"',
    "Gym sales is our first focused market.",
    "<GlobalFooter />"
  ];
  let position = -1;
  for (const marker of markers) {
    const next = gymPage.indexOf(marker);
    assert.ok(next > position, `${marker} must remain in the directed gym journey order.`);
    position = next;
  }

  assert.equal((gymPage.match(/<picture/gu) || []).length, 2);
  assert.equal((gymPage.match(/<img/gu) || []).length, 2);
  assert.match(gymPage, /01-772904932_1493675372780221_5358616428807129112_n-2\.webp/);
  assert.match(gymPage, /02-prometheus_route_iq_ad\.webp/);
  assert.match(gymPage, /fetchPriority="high"/);
  assert.match(gymPage, /loading="lazy"/);
  assert.match(gymPage, /width="2048"[\s\S]*height="1072"/);
  assert.match(gymPage, /width="2240"[\s\S]*height="1120"/);
});

test("the shared nav, gym CTA, intelligence columns, and bridge use the directed copy", () => {
  const source = read("src/main.jsx");
  const nav = source.slice(source.indexOf("function GlobalNav()"), source.indexOf("function GlobalFooter()"));
  const gymPage = source.slice(source.indexOf("function GymPage()"), source.indexOf("function ThankYouPage()"));
  for (const [href, label] of [
    ["/#gym-form", "For Gym Owners"],
    ["/investors", "For Investors"],
    ["/investors#industries", "For Enterprise"]
  ]) {
    assert.match(nav, new RegExp(`\\["${href}", "${label}"\\]`));
  }
  assert.equal((nav.match(/links\.map\(\(\[href, label\]\)/gu) || []).length, 2);
  assert.equal((nav.match(/className="header-action" href="\/#gym-form">Get Dashboard/gu) || []).length, 2);
  assert.match(gymPage, /<h1 id="gym-hero-heading" className="visually-hidden">Gym Owners: 29 Members In 48 Hours\. \$0 Ad Spend\.<\/h1>/);
  assert.match(gymPage, /Get My Gym Dashboard/);
  assert.match(gymPage, /Dashboard built in 2 hours\./);
  assert.match(gymPage, /<h3>Know Where To Go<\/h3>/);
  assert.match(gymPage, /<h3>Verify The Visit<\/h3>[\s\S]*GPS Verified Without Surveillance/);
  assert.match(gymPage, /<h3>Track The Outcome<\/h3>/);
  assert.match(gymPage, /The Bigger Vision: The Intelligence Layer For All Outside Sales/);
  assert.match(gymPage, /Gym sales is our first focused market\./);
  assert.match(gymPage, /Horizontal infrastructure for home services, healthcare, commercial, retail, B2B\./);
  assert.match(source, /function MobileGymCta\(\)[\s\S]*className={`mobile-fixed-cta\$\{formVisible \? " is-hidden" : ""\}`}[\s\S]*href="\/#gym-form"[\s\S]*Get Dashboard/);
  assert.match(nav, /<details className="mobile-nav">[\s\S]*Open navigation menu[\s\S]*className="mobile-nav-panel"/);
});

test("the compact gym form keeps the exact CRM field order and directed controls", () => {
  const source = read("src/main.jsx");
  const form = source.slice(source.indexOf("function GymRequestForm()"), source.indexOf("function GymPage()"));
  const fields = ["fullName", "gymName", "cityState", "outsideRepCount", "workEmail", "cell", "consent", "websiteUrl"];
  let position = -1;
  for (const name of fields) {
    const next = form.indexOf(`name="${name}"`);
    assert.ok(next > position, `${name} must remain in CRM contract order.`);
    position = next;
  }
  assert.match(form, /<form id="gym-form"/);
  for (const label of ["Full Name", "Gym Name", "City, State", "Number of Outside Reps", "Work Email", "Cell"]) {
    assert.match(form, new RegExp(`<span>${label}<\\/span>`));
  }
  assert.match(form, /<select name="outsideRepCount" defaultValue="" required>/);
  assert.deepEqual([...form.matchAll(/<option value="(\d+)">\d+<\/option>/gu)].map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(form, /I agree that Prometheus\.IQ may use this information to respond to my Route IQ request\./);
  assert.match(form, /Build My Dashboard/);
  assert.match(form, /We manually build it\. You'll get login \+ Loom walkthrough in ∼2 hours\./);
  assert.match(form, /window\.location\.assign\(thankYouPath\)/);
  assert.doesNotMatch(form, /kind: "success"|form\.reset\(\)/);
});

test("the supplied originals are byte-exact and WebP derivatives are present", () => {
  const firstJpeg = "public-site-static/01-772904932_1493675372780221_5358616428807129112_n-2.jpeg";
  const secondJpeg = "public-site-static/02-prometheus_route_iq_ad.jpg";
  const firstWebp = "public-site-static/01-772904932_1493675372780221_5358616428807129112_n-2.webp";
  const secondWebp = "public-site-static/02-prometheus_route_iq_ad.webp";

  assert.equal(sha256(firstJpeg), "0b65a6c611f3ea3d1aa03e819fc231ab63d109cea1027df0688b142cc5fe110d");
  assert.equal(sha256(secondJpeg), "cff89c9fc30f0030b5fdabf16ade3b31310062038a6c02cc1601033842b87e9d");
  for (const webp of [firstWebp, secondWebp]) {
    assert.equal(existsSync(resolve(root, webp)), true);
    const bytes = readBytes(webp);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  }
  assert.ok(readBytes(firstWebp).length < readBytes(firstJpeg).length);
  assert.ok(readBytes(secondWebp).length < readBytes(secondJpeg).length);
});

test("gym request payload matches the CRM public contract exactly", () => {
  const result = buildRouteIqGymRequestPayload({
    formData: validGymForm(),
    attribution: {
      utm_source: "reddit",
      utm_medium: "paid_social",
      utm_campaign: "gym_first_launch",
      utm_term: "warehouse_gym",
      utm_content: "intelligence_ad"
    },
    now: new Date("2026-08-14T18:30:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.payload), [
    "version", "formId", "fullName", "gymName", "cityState", "outsideRepCount", "workEmail", "cell",
    "consent", "submittedAt", "acquisitionSource", "attribution", "websiteUrl"
  ]);
  assert.equal(result.payload.version, ROUTE_IQ_GYM_REQUEST_VERSION);
  assert.equal(result.payload.formId, ROUTE_IQ_GYM_REQUEST_FORM_ID);
  assert.equal(result.payload.acquisitionSource, ROUTE_IQ_GYM_REQUEST_ACQUISITION_SOURCE);
  assert.equal(result.payload.outsideRepCount, 4);
  assert.equal(result.payload.workEmail, "jordan@ironharbor.example");
  assert.equal(result.payload.submittedAt, "2026-08-14T18:30:00.000Z");
  assert.equal(result.payload.websiteUrl, "");
  assert.deepEqual(Object.keys(result.payload.attribution), ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS);
});

test("gym payload validation fails closed before transport", () => {
  for (const formData of [
    validGymForm({ fullName: "" }),
    validGymForm({ gymName: "<script>alert(1)</script>" }),
    validGymForm({ outsideRepCount: "0" }),
    validGymForm({ outsideRepCount: "11" }),
    validGymForm({ workEmail: "not-an-email" }),
    validGymForm({ cell: "call me" }),
    validGymForm({ consent: false }),
    validGymForm({ websiteUrl: "bot" })
  ]) {
    assert.equal(buildRouteIqGymRequestPayload({ formData }).ok, false);
  }
  assert.equal(buildRouteIqGymRequestPayload({
    formData: validGymForm(),
    attribution: { click_id: "not-allowlisted" }
  }).ok, false);
  assert.equal(buildRouteIqGymRequestPayload({
    formData: validGymForm(),
    attribution: { utm_source: 42 }
  }).ok, false);
  assert.equal(buildRouteIqGymRequestPayload({
    formData: validGymForm(),
    attribution: Object.create({ utm_source: "reddit" })
  }).ok, false);
});

test("attribution reads and propagates only the five allowlisted UTM keys", () => {
  const current = "https://prometheusrouteiq.com/?utm_source=reddit&utm_medium=paid_social&utm_campaign=gym_launch&utm_term=owner&utm_content=ad&fbclid=drop&token=drop";
  assert.deepEqual(collectRouteIqGymAttribution(current), {
    utm_source: "reddit",
    utm_medium: "paid_social",
    utm_campaign: "gym_launch",
    utm_term: "owner",
    utm_content: "ad"
  });
  assert.equal(
    preserveRouteIqGymAttribution("/investors#top", current),
    "/investors?utm_source=reddit&utm_medium=paid_social&utm_campaign=gym_launch&utm_term=owner&utm_content=ad#top"
  );
  assert.equal(preserveRouteIqGymAttribution("mailto:test@example.com", current), "mailto:test@example.com");
  assert.doesNotMatch(preserveRouteIqGymAttribution("/investors", current), /fbclid|token/u);
});

test("submission redirects are possible only after ok true and a canonical receipt", async () => {
  const payload = buildRouteIqGymRequestPayload({ formData: validGymForm() }).payload;
  const receiptId = "riq_receipt_0123456789abcdef01234567";
  const calls = [];
  const accepted = await submitRouteIqGymRequest({
    payload,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, receiptId }), { status: 201 });
    }
  });

  assert.deepEqual(accepted, { ok: true, receiptId });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ROUTE_IQ_GYM_REQUEST_ENDPOINT);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(buildRouteIqGymThankYouPath(receiptId), `/thank-you?receipt=${receiptId}`);
  assert.equal(buildRouteIqGymThankYouPath("RIQ_RECEIPT_0123456789ABCDEF01234567"), "");
  assert.equal(ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN.test(receiptId), true);

  for (const response of [
    new Response(JSON.stringify({ ok: false, receiptId }), { status: 422 }),
    new Response(JSON.stringify({ ok: true }), { status: 201 }),
    new Response(JSON.stringify({ ok: true, receiptId: "riq_receipt_short" }), { status: 201 }),
    new Response("not-json", { status: 201 })
  ]) {
    await assert.rejects(() => submitRouteIqGymRequest({ payload, fetchImpl: async () => response }), /REQUEST_/u);
  }
});

test("thank-you is refreshable, noindex, and never invents accepted state", () => {
  const source = read("src/main.jsx");
  const page = source.slice(source.indexOf("function ThankYouPage()"), source.indexOf("function RouteIqRequestForm()"));
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN\.test\(receipt\)/);
  assert.match(page, /Got it\. Building your dashboard now\./);
  assert.match(page, /We're building your gym's custom route dashboard\. You'll get email with login \+ Loom walkthrough in ∼2 hours from Prometheusrouteiq@gmail\.com\. Check spam\./);
  assert.equal((page.match(/<li>/gu) || []).length, 3);
  assert.match(page, /We build now/);
  assert.match(page, /You get login/);
  assert.match(page, /Reps get first route today/);
  assert.match(page, /Back to Home/);
  assert.match(page, /This page does not confirm a request\./);
  assert.match(page, /Return To Gym Form/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|accepted|stored/iu);
  assert.match(source, /noindex,nofollow,noarchive/);
});

test("metadata, canonical, and social images are selected by route", () => {
  const source = read("src/main.jsx");
  const metadata = read("landing.html");
  assert.match(metadata, /<link rel="canonical" href="https:\/\/prometheusrouteiq\.com\/">/);
  assert.match(metadata, /Prometheus Route IQ for Gyms \| Field Sales Intelligence/);
  assert.match(metadata, /U\.S\. small and independent warehouse-style gyms/);
  assert.match(metadata, /01-772904932_1493675372780221_5358616428807129112_n-2\.jpeg/);
  assert.match(source, /U\.S\. small and independent warehouse-style gyms/);
  assert.match(source, /canonical: "https:\/\/prometheusrouteiq\.com\/investors"/);
  assert.match(source, /canonical: "https:\/\/prometheusrouteiq\.com\/thank-you"/);
  assert.match(source, /pathname === "\/investors"/);
  assert.match(source, /pathname === "\/thank-you"/);
  assert.match(source, /meta\[property="og:url"\]/);
  assert.match(source, /meta\[name="robots"\]/);
});

test("the sitemap preserves the homepage and legal routes while adding investors and excluding thank-you", () => {
  const sitemap = read("public-site-static/sitemap.xml");
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(match => match[1]), [
    "https://prometheusrouteiq.com/",
    "https://prometheusrouteiq.com/investors",
    "https://prometheusrouteiq.com/privacy",
    "https://prometheusrouteiq.com/terms",
    "https://prometheusrouteiq.com/data-deletion"
  ]);
  assert.doesNotMatch(sitemap, /thank-you/u);
  for (const page of ["privacy", "terms", "data-deletion"]) {
    assert.deepEqual(
      readBytes(`public-site-static/${page}/index.html`),
      readBytes(`deploy/prometheusrouteiq-website/${page}/index.html`)
    );
  }
});

test("the public Website palette and disabled measurement placeholders stay bounded", () => {
  const styles = read("src/styles.css");
  const legalStyles = read("public-site-static/legal.css");
  const scene = read("src/IntelligenceScene.jsx");
  const publicSource = [styles, legalStyles, scene, read("src/main.jsx"), read("src/route-iq-gym-request-form.js"), read("landing.html")].join("\n");
  const allowedHex = new Set(["#000", "#000000", "#FFF", "#FFFFFF", "#FF6A00"]);
  for (const token of `${styles}\n${legalStyles}\n${scene}`.match(/#[0-9a-f]{3,8}/giu) || []) {
    assert.equal(allowedHex.has(token.toUpperCase()), true, `Unexpected palette token ${token}`);
  }
  assert.doesNotMatch(publicSource, /\b(?:blue|green|teal|coral)\b/iu);
  assert.doesNotMatch(publicSource, /localStorage|sessionStorage|indexedDB|document\.cookie/iu);
  assert.match(publicSource, /id="reddit-measurement-placeholder" data-provider="reddit" data-status="disabled"/);
  assert.match(publicSource, /id="meta-measurement-placeholder" data-provider="meta" data-status="disabled"/);
  assert.doesNotMatch(publicSource, /connect\.facebook\.net|facebook\.com\/tr|redditstatic\.com|events\.reddit\.com/iu);
});

test("the gym initial viewport and mobile fixed CTA have stable responsive constraints", () => {
  const source = read("src/main.jsx");
  const styles = read("src/styles.css");
  assert.match(source, /<h2 id="gym-form-title">Get Your Gym's Route Dashboard Built In 2 Hours<\/h2>[\s\S]*<GymRequestForm \/>/);
  assert.match(source, /<form id="gym-form"[\s\S]*<input name="fullName"/);
  assert.match(styles, /\.gym-hero-section \{[\s\S]*min-height: 100svh;[\s\S]*padding: 72px 0 14px;/);
  assert.match(styles, /\.gym-form-grid \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.gym-form-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.mobile-fixed-cta \{[\s\S]*bottom: max\(10px, env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.mobile-fixed-cta\.is-hidden \{[\s\S]*pointer-events: none/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.mobile-nav \{ display: block; \}/);
  assert.match(styles, /\.gym-page \.site-footer \{ padding-bottom: calc\(96px \+ env\(safe-area-inset-bottom\)\); \}/);
});

test("the investor route retains every prior section in order, 3D motion, and a deck mailto", () => {
  const source = read("src/main.jsx");
  const investor = source.slice(source.indexOf("function InvestorPage()"), source.indexOf("const pathname"));
  const markers = [
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
  for (const marker of markers) {
    const next = investor.indexOf(marker);
    assert.ok(next > position, `${marker} must remain in the original investor order.`);
    position = next;
  }
  assert.match(source, /React\.lazy\(\(\) => import\("\.\/IntelligenceScene\.jsx"\)\)/);
  assert.match(investor, /<HeroVisual \/>/);
  assert.match(investor, /whileInView=/);
  assert.match(investor, /Built for private onboarding, executive review, and field operating discipline\./);
  assert.match(investor, /Request Investor Deck/);
  assert.match(source, /mailto:\$\{contactEmail\}\?subject=Request%20Investor%20Deck/);
});

test("a fresh build emits both founder assets and the lazy investor scene", () => {
  ensureFreshBuild();
  const generated = filesUnder("dist-public");
  assert.ok(generated.includes("index.html"));
  assert.ok(generated.includes("01-772904932_1493675372780221_5358616428807129112_n-2.jpeg"));
  assert.ok(generated.includes("01-772904932_1493675372780221_5358616428807129112_n-2.webp"));
  assert.ok(generated.includes("02-prometheus_route_iq_ad.jpg"));
  assert.ok(generated.includes("02-prometheus_route_iq_ad.webp"));
  assert.ok(generated.some(path => /^assets\/landing-.+\.js$/u.test(path)));
  assert.ok(generated.some(path => /^assets\/IntelligenceScene-.+\.js$/u.test(path)));
  const entryPath = generated.find(path => /^assets\/landing-.+\.js$/u.test(path));
  const entry = read(`dist-public/${entryPath}`);
  assert.match(entry, /Gym sales is our first focused market/);
  assert.match(entry, /Built for private onboarding, executive review, and field operating discipline/);
  assert.match(entry, /\/thank-you\?receipt=/);
  assert.match(entry, /route-iq-gym-request\.v1/);
});
