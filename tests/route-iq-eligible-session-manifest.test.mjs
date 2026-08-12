import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildRouteIqEligibleSessionManifest,
  canonicalRouteIqEligibleSessionManifestJson,
  materializeRouteIqEligibleSessionPackages
} from "../data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs";
import {
  createSyntheticGovernedLearningFixture,
  loadFitnessGovernedLearningFixture
} from "./helpers/route-iq-governed-learning-fixtures.mjs";

const root = resolve(import.meta.dirname, "..");
const historicalPaths = [
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/manifest.json",
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/normalized/field-session.json",
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/normalized/calculated-metrics.json",
  "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/normalized/history-updates.json"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fileHashes() {
  return historicalPaths.map(path => createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex"));
}

function build(fixture) {
  return buildRouteIqEligibleSessionManifest(fixture);
}

test("Data builds a byte-stable, hash-bound Fitness founder-research manifest", () => {
  const fixture = loadFitnessGovernedLearningFixture();
  const before = fileHashes();
  const first = build(fixture);
  const second = build(clone(fixture));
  assert.equal(
    canonicalRouteIqEligibleSessionManifestJson(first),
    canonicalRouteIqEligibleSessionManifestJson(second)
  );
  assert.equal(first.workspaceId, "fitness_connection");
  assert.equal(first.customerId, "fitness_connection_research");
  assert.notEqual(first.workspaceId, first.customerId);
  assert.equal(first.evidenceClassification, "FOUNDER_FIELD_RESEARCH");
  assert.equal(first.totals.sessions, 1);
  assert.equal(first.totals.visits, 4);
  assert.match(first.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(fileHashes(), before);
});

test("Data accumulates synthetic non-Fitness sessions chronologically without sensitive fields", () => {
  const fixture = createSyntheticGovernedLearningFixture();
  fixture.archivePackages.reverse();
  fixture.retentionDecisions.reverse();
  const manifest = build(fixture);
  assert.deepEqual(
    manifest.entries.map(entry => entry.fieldSessionDate),
    ["2026-08-01", "2026-08-02"]
  );
  assert.equal(manifest.customerId, "northstar_field_supply_company_synthetic");
  assert.equal(manifest.operatingProfileId, "general_outside_sales");
  assert.equal(manifest.totals.sessions, 2);
  assert.equal(manifest.totals.visits, 2);
  const packages = materializeRouteIqEligibleSessionPackages(
    manifest,
    fixture.archivePackages
  );
  const serialized = JSON.stringify({ manifest, packages });
  for (const forbidden of [
    '"notes":',
    '"gpsAttached":',
    '"address":',
    '"phone":',
    '"email":',
    '"stressTestObservations":',
    '"stressTestEvidence":',
    '"secret":'
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Data rejects duplicate sessions, source replay, and cross-scope packages", () => {
  const duplicate = createSyntheticGovernedLearningFixture();
  duplicate.archivePackages.push(clone(duplicate.archivePackages[0]));
  assert.throws(() => build(duplicate), /failed closed/u);

  const replay = createSyntheticGovernedLearningFixture();
  replay.archivePackages[1].manifest.rawSha256 = replay.archivePackages[0].manifest.rawSha256;
  replay.archivePackages[1].verifiedFieldSession.sourceProvenance.rawSha256 = replay.archivePackages[0].manifest.rawSha256;
  replay.archivePackages[1].calculatedMetrics.calculationProvenance.sourceRawSha256 = replay.archivePackages[0].manifest.rawSha256;
  replay.retentionDecisions[1].sourceRecordSha256 = replay.archivePackages[0].manifest.rawSha256;
  assert.throws(() => build(replay), /failed closed/u);

  const crossScope = createSyntheticGovernedLearningFixture();
  crossScope.archivePackages[0].historyUpdates.workspaceId = "fitness_connection";
  assert.throws(() => build(crossScope), /failed closed/u);
});

test("Data rejects excluded, unresolved, malformed, expired, and unauthorized evidence", () => {
  const excluded = createSyntheticGovernedLearningFixture();
  excluded.archivePackages[0].administrativeDisposition = { state: "EXCLUDED_FROM_ANALYTICS" };
  assert.throws(() => build(excluded), /failed closed/u);

  const unresolved = createSyntheticGovernedLearningFixture();
  unresolved.archivePackages[0].consumptionEligibility = {
    eligible: false,
    state: "REVIEW_REQUIRED",
    deletionState: "NONE"
  };
  assert.throws(() => build(unresolved), /failed closed/u);

  const malformed = createSyntheticGovernedLearningFixture();
  delete malformed.archivePackages[0].calculatedMetrics;
  assert.throws(() => build(malformed), /failed closed/u);

  const expired = createSyntheticGovernedLearningFixture();
  expired.retentionDecisions[0].expiresAt = expired.evaluatedAt;
  assert.throws(() => build(expired), /failed closed/u);

  const unauthorized = createSyntheticGovernedLearningFixture();
  unauthorized.archivePackages[0].evidenceClassification = "CUSTOMER_GOVERNED_DATA";
  assert.throws(() => build(unauthorized), /failed closed/u);
});

test("Data binds package materialization to the exact admitted artifact graph", () => {
  const fixture = createSyntheticGovernedLearningFixture();
  const manifest = build(fixture);
  const changed = clone(fixture.archivePackages);
  changed[0].historyUpdates.customerOutcomeHistory[0].loggedOutcome = "Changed";
  assert.throws(
    () => materializeRouteIqEligibleSessionPackages(manifest, changed),
    /failed closed/u
  );
});
