import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_REQUEST_ENDPOINT,
  buildRouteIqRequestPayload,
  resolveAcquisitionSource,
  submitRouteIqRequest
} from "../src/route-iq-request-form.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

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

test("public website names Prometheus as the company and Route IQ as the only active product", () => {
  const source = read("src/main.jsx");
  const metadata = read("landing.html");
  const activeCopy = `${source}\n${metadata}`;

  assert.match(source, /<h1>Route IQ<\/h1>/);
  assert.match(source, /Prometheus \/ Active Product/);
  assert.match(source, /representatives, territories, customers, and outcomes/);
  assert.match(source, /decision-ready intelligence/);
  assert.match(source, />REQUEST ROUTE IQ</);
  assert.doesNotMatch(activeCopy, /Fitness Connection|Gaia|Athena|franchise|growth partnership|committed pilot/i);
  assert.doesNotMatch(activeCopy, /proven (?:performance|improvement|recommendation)|customer endorsement/i);
});

test("production website package serves the verified Route IQ bundle as its only active page", () => {
  const deployIndex = read("deploy/prometheusrouteiq-website/index.html");
  const scriptPath = deployIndex.match(/<script[^>]+src="\/(assets\/landing-[^"]+\.js)"/u)?.[1];

  assert.match(deployIndex, /<title>Route IQ by Prometheus/);
  assert.ok(scriptPath, "Production index must reference the built Route IQ bundle.");
  const activeBundle = read(`deploy/prometheusrouteiq-website/${scriptPath}`);
  assert.match(activeBundle, /REQUEST ROUTE IQ/);
  assert.match(activeBundle, /decision-ready intelligence/);
  assert.doesNotMatch(activeBundle, /Fitness Connection|Gaia|Athena|franchise|growth partnership|committed pilot/i);
});

test("Route IQ request UI captures only the governed public intake fields", () => {
  const source = read("src/main.jsx");
  const expected = [
    "businessName",
    "contactName",
    "businessEmail",
    "phone",
    "industry",
    "locationCount",
    "estimatedUserCount",
    "territory",
    "primaryProblem",
    "desiredTimeline",
    "consent",
    "websiteUrl"
  ];

  for (const name of expected) assert.match(source, new RegExp(`name="${name}"`));
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
    "version",
    "formId",
    "businessName",
    "contactName",
    "businessEmail",
    "phone",
    "industry",
    "locationCount",
    "estimatedUserCount",
    "territory",
    "primaryProblem",
    "desiredTimeline",
    "consent",
    "submittedAt",
    "acquisitionSource",
    "websiteUrl"
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
  const payload = buildRouteIqRequestPayload({
    formData: validForm(),
    now: new Date("2026-07-18T14:30:00.000Z")
  }).payload;
  const result = await submitRouteIqRequest({
    payload,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        submissionId: "route_iq_request_01J3ABCDEF",
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
  assert.deepEqual(result, {
    ok: true,
    receiptId: "route_iq_request_01J3ABCDEF",
    duplicate: false,
    submittedAt: "2026-07-18T14:30:01.000Z"
  });
  assert.equal("internalRecord" in result, false);
});

test("request submission fails closed on rejection, invalid JSON, or missing receipt without retry", async () => {
  const payload = buildRouteIqRequestPayload({ formData: validForm() }).payload;
  for (const response of [
    new Response(JSON.stringify({ ok: false }), { status: 422 }),
    new Response("not-json", { status: 201 }),
    new Response(JSON.stringify({ ok: true }), { status: 201 })
  ]) {
    let calls = 0;
    await assert.rejects(
      submitRouteIqRequest({ payload, fetchImpl: async () => { calls += 1; return response; } }),
      /REQUEST_/
    );
    assert.equal(calls, 1);
  }
});

test("source and deploy request modules stay byte-identical", () => {
  assert.equal(
    read("src/route-iq-request-form.js"),
    read("deploy/prometheusrouteiq-website/route-iq-request-form.js")
  );
});
