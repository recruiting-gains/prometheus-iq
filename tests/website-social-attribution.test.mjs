import test from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_DATA_SOURCES,
  createAttributionEvent
} from "../social-media/contracts/social-media-contract.js";
import {
  createWebsiteAttributionSession,
  readWebsiteAttribution
} from "../deploy/prometheusrouteiq-website/website-attribution.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
}

test("website attribution captures Instagram UTM sessions using the Social Media attribution contract", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const session = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=founder-build-in-public-v1&utm_content=route-demo",
    referrer: "https://l.instagram.com/",
    localStorage,
    sessionStorage,
    now: new Date("2026-07-01T12:00:00.000Z")
  });
  const event = createAttributionEvent(session.currentTouch);

  assert.equal(event.type, SOCIAL_ATTRIBUTION_EVENT_TYPES.WEBSITE_VISIT);
  assert.equal(event.target, SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC);
  assert.equal(event.source, SOCIAL_DATA_SOURCES.WEBSITE_CONTRACT);
  assert.equal(event.provider, "instagram");
  assert.equal(event.campaignId, "founder-build-in-public-v1");
  assert.equal(event.metadata.utm_source, "instagram");
  assert.equal(event.metadata.utm_medium, "social");
  assert.equal(event.metadata.utm_content, "route-demo");
  assert.equal(event.metadata.referrer_host, "l.instagram.com");
  assert.equal(event.metadata.landing_path, "/");
  assert.equal(event.confidence, 1);
});

test("website attribution stores first touch and session touch without creating CRM records", () => {
  const localStorage = memoryStorage();
  const firstSession = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=first-campaign",
    referrer: "",
    localStorage,
    sessionStorage: memoryStorage(),
    now: new Date("2026-07-01T12:00:00.000Z")
  });
  const secondSession = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/terms?utm_source=linkedin&utm_campaign=second-campaign",
    referrer: "https://linkedin.com/feed/",
    localStorage,
    sessionStorage: memoryStorage(),
    now: new Date("2026-07-01T12:05:00.000Z")
  });
  const events = readWebsiteAttribution(localStorage);

  assert.equal(firstSession.visitorId, secondSession.visitorId);
  assert.equal(secondSession.firstTouch.campaignId, "first-campaign");
  assert.equal(secondSession.currentTouch.campaignId, "second-campaign");
  assert.equal(events.length, 2);
  assert.equal(events.some(event => event.leadId), false);
  assert.equal(events.some(event => event.betaParticipantId), false);
});

test("website attribution sanitizes landing URLs and avoids credential-like parameters", () => {
  const session = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&access_token=must-not-store&utm_campaign=safe-campaign",
    referrer: "https://instagram.com/prometheus.iq",
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    now: new Date("2026-07-01T12:00:00.000Z")
  });
  const serialized = JSON.stringify(session);

  assert.equal(serialized.includes("must-not-store"), false);
  assert.equal(session.currentTouch.metadata.landing_url, "https://prometheusrouteiq.com/?utm_source=instagram&utm_campaign=safe-campaign");
});
