import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ROUTE_IQ_REPRESENTATIVE_STYLE_PREVIEW_VERSION,
  buildRouteIqRepresentativeStylePreview,
  routeIqRepresentativeStyleQuestions
} from "../src/route-iq-representative-style-preview.js";
import { buildRouteIqGymRequestPayload } from "../src/route-iq-gym-request-form.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

const completeProfile = Object.freeze({
  languages: ["english", "spanish"],
  conversationStyle: "one_to_one",
  fieldEnvironment: "community_events",
  energyWindow: "after_lunch",
  interests: ["fitness_wellness", "community_events"],
  conversationPace: "deeper"
});

test("representative learning questions cover language, rapport, environment, timing, interests, and pace", () => {
  assert.deepEqual(routeIqRepresentativeStyleQuestions.map(question => question.id), [
    "languages",
    "conversationStyle",
    "fieldEnvironment",
    "energyWindow",
    "interests",
    "conversationPace"
  ]);
  const legends = routeIqRepresentativeStyleQuestions.map(question => question.legend).join("\n");
  assert.match(legends, /Which languages can you confidently use in a sales conversation\?/);
  assert.match(legends, /Where do you naturally build the strongest rapport\?/);
  assert.match(legends, /Which field environment brings out your best work\?/);
  assert.match(legends, /When do you usually feel most effective in the field\?/);
  assert.match(legends, /What do you genuinely enjoy outside work\?/);
  assert.match(legends, /Which conversation pace feels most natural\?/);
});

test("the preview is deterministic and presents declared answers only as evidence-bound hypotheses", () => {
  const first = buildRouteIqRepresentativeStylePreview(completeProfile);
  const second = buildRouteIqRepresentativeStylePreview(structuredClone(completeProfile));
  assert.deepEqual(first, second);
  assert.equal(first.version, ROUTE_IQ_REPRESENTATIVE_STYLE_PREVIEW_VERSION);
  assert.equal(first.complete, true);
  assert.equal(first.answeredCount, first.totalQuestions);
  assert.deepEqual(first.signals, [
    { label: "Conversation context", value: "One person at a time" },
    { label: "Field environment", value: "Community events" },
    { label: "Timing hypothesis", value: "After lunch" },
    { label: "Language context", value: "English, Spanish" },
    { label: "Affinity context", value: "Fitness and wellness, Community and events" },
    { label: "Conversation pace", value: "Fewer, deeper conversations" }
  ]);
  assert.match(first.boundary, /Only authorized field evidence can confirm, challenge, or strengthen it/);
  assert.doesNotMatch(first.boundary, /perfect|guarantee|proven superiority/iu);
});

test("unknown and adversarial selections fail closed without reaching the preview", () => {
  const result = buildRouteIqRepresentativeStylePreview({
    languages: ["english", "<script>alert(1)</script>", "english"],
    conversationStyle: "admin_override",
    fieldEnvironment: "community_events",
    energyWindow: 42,
    interests: ["prefer_not_to_say", "fitness_wellness"],
    conversationPace: "faster",
    workspaceId: "other_workspace"
  });
  assert.deepEqual(result.profile.languages, ["english"]);
  assert.equal(result.profile.conversationStyle, "");
  assert.equal(result.profile.energyWindow, "");
  assert.deepEqual(result.profile.interests, ["prefer_not_to_say"]);
  assert.equal(Object.hasOwn(result.profile, "workspaceId"), false);
  assert.doesNotMatch(JSON.stringify(result), /script|admin_override|other_workspace/iu);
});

test("field-style answers remain local to the React preview and are excluded from the public CRM payload", () => {
  const source = read("src/main.jsx");
  const component = source.slice(source.indexOf("function RepresentativeStylePreview()"), source.indexOf("function GymRequestForm()"));
  assert.match(component, /data-storage="memory-only"/);
  assert.match(component, /these answers stay in this browser tab\. They are not stored, sent with your request, or passed into production recommendations\./);
  assert.doesNotMatch(component, /fetch\(|submitRouteIq|FormData|localStorage|sessionStorage|indexedDB|document\.cookie/iu);

  const request = buildRouteIqGymRequestPayload({
    formData: {
      fullName: "Jordan Rivera",
      gymName: "Iron Harbor Training",
      cityState: "Houston, TX",
      outsideRepCount: "4",
      workEmail: "jordan@ironharbor.example",
      cell: "+1 713 555 0148",
      consent: true,
      websiteUrl: "",
      ...completeProfile
    },
    now: new Date("2026-08-15T18:30:00.000Z")
  });
  assert.equal(request.ok, true);
  for (const field of Object.keys(completeProfile)) assert.equal(Object.hasOwn(request.payload, field), false);
});

test("the public brand uses the no-green orange icon and places the patent designation above navigation", () => {
  const source = read("src/main.jsx");
  const styles = read("src/styles.css");
  assert.match(source, /prometheus-company-icon-orange-v2\.png/);
  assert.doesNotMatch(source, /prometheus-company-icon-512\.png/);
  assert.match(source, /className="patent-banner"[\s\S]*U\.S\. PATENT PENDING[\s\S]*<header className="site-header">/);
  assert.match(styles, /\.patent-banner \{[\s\S]*background: var\(--orange\);[\s\S]*color: var\(--black\)/);
  assert.match(styles, /\.site-header \{[\s\S]*inset: 30px 0 auto/);
});
