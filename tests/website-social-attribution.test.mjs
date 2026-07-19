import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildRouteIqRequestPayload,
  resolveAcquisitionSource
} from "../src/route-iq-request-form.js";

const root = resolve(import.meta.dirname, "..");
const requestSource = readFileSync(resolve(root, "src/route-iq-request-form.js"), "utf8");

function validForm() {
  return {
    businessName: "Northstar Commercial Services",
    contactName: "Jordan Rivera",
    businessEmail: "jordan@northstar.example",
    phone: "",
    industry: "Commercial services",
    locationCount: "4",
    estimatedUserCount: "28",
    territory: "Greater Houston",
    primaryProblem: "Field teams need a governed way to plan visits and capture outcomes.",
    desiredTimeline: "Within 90 days",
    consent: true,
    websiteUrl: ""
  };
}

test("Route IQ request attribution retains only the normalized campaign source", () => {
  const source = resolveAcquisitionSource(
    "https://prometheusrouteiq.com/?utm_source=%20LinkedIn%20%20Campaign%20&utm_medium=social&utm_campaign=investor-review&access_token=must-not-retain&client_secret=also-secret",
    "https://referrer.example/path?cookie=private"
  );

  assert.equal(source, "LinkedIn Campaign");
  assert.doesNotMatch(source, /social|investor-review|must-not-retain|also-secret|private/u);
});

test("acquisition source is bounded and allows only a referrer hostname fallback", () => {
  assert.equal(
    resolveAcquisitionSource(`https://prometheusrouteiq.com/?utm_source=${"x".repeat(200)}`, ""),
    "x".repeat(80)
  );
  assert.equal(
    resolveAcquisitionSource(
      "https://prometheusrouteiq.com/?utm_campaign=ignored&token=must-not-retain",
      "https://Search.Example/path?authorization=private"
    ),
    "search.example"
  );
  assert.equal(resolveAcquisitionSource("not a url", "not a referrer"), "direct");
});

test("request payload keeps one bounded acquisition label without URL credential material", () => {
  const acquisitionSource = resolveAcquisitionSource(
    "https://prometheusrouteiq.com/?utm_source=direct-field&utm_content=private-content&password=must-not-retain",
    ""
  );
  const result = buildRouteIqRequestPayload({
    formData: validForm(),
    acquisitionSource,
    now: new Date("2026-07-19T12:00:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.acquisitionSource, "direct-field");
  assert.doesNotMatch(JSON.stringify(result.payload), /private-content|must-not-retain/u);
  assert.equal(Object.hasOwn(result.payload, "visitorId"), false);
  assert.equal(Object.hasOwn(result.payload, "sessionId"), false);
  assert.equal(Object.hasOwn(result.payload, "landingUrl"), false);
  assert.equal(Object.hasOwn(result.payload, "referrer"), false);
});

test("public request attribution creates no persistent visitor or session tracking", () => {
  assert.doesNotMatch(
    requestSource,
    /localStorage|sessionStorage|indexedDB|document\.cookie|visitorId|sessionId|landing_url|landingUrl/u
  );
  assert.match(requestSource, /url\.searchParams\.get\("utm_source"\)/u);
  assert.doesNotMatch(requestSource, /searchParams\.get\("(?:access_token|token|password|client_secret|authorization)"\)/u);
});
