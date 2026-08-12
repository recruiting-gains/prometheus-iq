import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createGovernedLearningAdvisoryViewModel,
  governedRuntimeNetworkOnlyPath,
  loadGovernedLearningAdvisory,
  renderGovernedLearningAdvisory,
  routeIqGovernedLearningAdvisoryEnvelopeVersion,
  routeIqGovernedLearningAdvisoryPath,
  validateGovernedLearningAdvisoryEnvelope
} from "../dashboard/route-iq-dashboard-platform.mjs";
import {
  buildRouteIqEligibleSessionManifest
} from "../data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs";
import {
  buildRouteIqGovernedMultiSessionLearning
} from "../intelligence/route-iq-governed-multi-session-learning.mjs";
import {
  loadFitnessGovernedLearningFixture
} from "./helpers/route-iq-governed-learning-fixtures.mjs";

const NOW = new Date("2026-08-12T12:00:00.000Z");
const dashboard = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function founderSession(overrides = {}) {
  return {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId: "fitness_connection",
    workspaceLabel: "Founder research",
    operatingProfileId: "fitness",
    principalRole: "founder",
    userId: "user_cruz_founder",
    representativeId: "representative_cruz_founder",
    displayName: "Founder",
    roleId: "fitness_founder_research_operator",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: true,
      administerWorkspaceRoster: false,
      founderIntelligence: true,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
      businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
      businessRoster: "/data/route-iq-commercial-readiness-v1/validation/fitness-approved-roster.json",
      businessHours: "/data/fixtures/fitness-business-hours.json"
    },
    expiresAt: "2026-08-12T13:00:00.000Z",
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    ...overrides
  };
}

function governedEnvelope() {
  const fixture = loadFitnessGovernedLearningFixture();
  const manifest = buildRouteIqEligibleSessionManifest(fixture);
  const learning = buildRouteIqGovernedMultiSessionLearning({
    eligibleSessionManifest: manifest,
    archivePackages: fixture.archivePackages,
    workspaceRegistry: fixture.workspaceRegistry
  });
  const advisory = clone(learning.dashboardAdvisory);
  delete advisory.safety.shadowDecisionReadinessExposed;
  return {
    contractVersion: routeIqGovernedLearningAdvisoryEnvelopeVersion,
    authorizationState: "server_verified",
    principal: {
      identityContextSource: "server_verified_identity_mapping",
      authenticationAuthority: "cloudflare_access",
      authenticated: true,
      callerSupplied: false,
      role: "founder"
    },
    scope: {
      workspaceId: learning.workspaceId,
      operatingProfileId: learning.operatingProfileId,
      customerId: learning.customerId,
      representativeId: learning.representativeId,
      authority: "server_resolved"
    },
    artifact: {
      artifactId: learning.artifactId,
      artifactSha256: learning.artifactSha256,
      generatedAt: learning.generatedAt,
      status: learning.status,
      freshnessState: "CURRENT_WITHIN_RETENTION_BOUNDARY",
      expiresAt: manifest.entries.map(entry => entry.retention.expiresAt).sort()[0]
    },
    advisory
  };
}

function response(value, overrides = {}) {
  return new Response(JSON.stringify(value), {
    status: overrides.status || 200,
    headers: {
      "cache-control": overrides.cacheControl || "private, no-store",
      "content-type": "application/json"
    }
  });
}

test("Dashboard validates and renders the existing Founder advisory surface", () => {
  const session = founderSession();
  const envelope = governedEnvelope();
  const view = createGovernedLearningAdvisoryViewModel(envelope, {
    session,
    expectedCustomerId: "fitness_connection_research",
    now: NOW
  });
  const html = renderGovernedLearningAdvisory(view);

  assert.equal(view.maturity.truthState, "Insufficient Evidence");
  assert.equal(view.maturity.sessions, 1);
  assert.equal(view.maturity.visits, 4);
  assert.match(html, /Governed|Evidence maturity/u);
  assert.match(html, /Insufficient Evidence/u);
  assert.match(html, /Category and time-window patterns/u);
  assert.match(html, /Evidence needed next/u);
  assert.doesNotMatch(html, /shadow|candidate|probability|brier|\bECE\b/iu);
});

test("Dashboard fetches the advisory as same-origin no-store GET only", async () => {
  const session = founderSession();
  const envelope = governedEnvelope();
  let request;
  const result = await loadGovernedLearningAdvisory({
    session,
    expectedCustomerId: "fitness_connection_research",
    now: NOW,
    fetchFn: async (path, options) => {
      request = { path, options };
      return response(envelope);
    }
  });

  assert.equal(request.path, routeIqGovernedLearningAdvisoryPath);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.redirect, "error");
  assert.equal(result.scope.customerId, "fitness_connection_research");
  assert.equal(governedRuntimeNetworkOnlyPath(routeIqGovernedLearningAdvisoryPath), true);
});

test("Dashboard fails closed for non-Founder, cross-customer, stale, malformed, or forbidden output", async () => {
  const envelope = governedEnvelope();
  const representative = founderSession({
    principalRole: "representative",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: false,
      administerWorkspaceRoster: false,
      founderIntelligence: false,
      founderCrm: false
    }
  });
  assert.throws(() => validateGovernedLearningAdvisoryEnvelope(envelope, {
    session: representative,
    expectedCustomerId: "fitness_connection_research",
    now: NOW
  }), /authenticated Founder/u);

  assert.throws(() => validateGovernedLearningAdvisoryEnvelope(envelope, {
    session: founderSession(),
    expectedCustomerId: "northstar_field_supply_company_synthetic",
    now: NOW
  }), /current server-authorized artifact/u);

  const stale = clone(envelope);
  stale.artifact.expiresAt = NOW.toISOString();
  assert.throws(() => validateGovernedLearningAdvisoryEnvelope(stale, {
    session: founderSession(),
    expectedCustomerId: "fitness_connection_research",
    now: NOW
  }), /current server-authorized artifact/u);

  const forbidden = clone(envelope);
  forbidden.advisory.candidateRanking = [];
  assert.throws(() => validateGovernedLearningAdvisoryEnvelope(forbidden, {
    session: founderSession(),
    expectedCustomerId: "fitness_connection_research",
    now: NOW
  }), /malformed or unsafe/u);

  await assert.rejects(() => loadGovernedLearningAdvisory({
    session: founderSession(),
    expectedCustomerId: "fitness_connection_research",
    now: NOW,
    fetchFn: async () => response(envelope, { cacheControl: "public, max-age=60" })
  }), /temporarily unavailable/u);
});

test("Dashboard escapes advisory text and never writes it into browser persistence", () => {
  const envelope = governedEnvelope();
  envelope.advisory.dataQualityWarnings = ["<img src=x onerror=alert(1)>"];
  const view = createGovernedLearningAdvisoryViewModel(envelope, {
    session: founderSession(),
    expectedCustomerId: "fitness_connection_research",
    now: NOW
  });
  const html = renderGovernedLearningAdvisory(view);
  assert.doesNotMatch(html, /<img/u);
  assert.match(html, /&lt;img/u);

  const source = dashboard.match(
    /async function loadFounderGovernedLearningAdvisory\(\)[\s\S]*?\n    \}/u
  )?.[0] || "";
  assert.match(source, /loadGovernedLearningAdvisory/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\./u);
  assert.doesNotMatch(source, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
});

test("Desktop and exact mobile contracts keep the advisory visible, bounded, and read-only", () => {
  const markup = dashboard.match(
    /<section id="founderGovernedLearningAdvisory"[\s\S]*?<\/section>/u
  )?.[0] || "";
  assert.match(markup, /owner-only/u);
  assert.match(markup, /aria-live="polite"/u);
  assert.doesNotMatch(markup, /<(?:button|form|input|select|textarea)\b/iu);
  assert.match(dashboard, /\.governed-learning-summary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/u);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.governed-learning-summary,[\s\S]*?grid-template-columns:\s*1fr;/u);
  assert.match(dashboard, /founderGovernedLearningTimeoutMs = 2500/u);
});
