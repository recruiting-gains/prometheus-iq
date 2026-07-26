import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  loadPaidCustomerConfigurationPreview,
  paidCustomerConfigurationEmptyState,
  routeIqPaidCustomerPreviewContractVersion,
  routeIqPaidCustomerPreviewPath,
  validatePaidCustomerConfigurationPreviewEnvelope
} from "../dashboard/route-iq-dashboard-platform.mjs";

const NOW = new Date("2026-07-26T12:00:00.000Z");

function ownerSession(overrides = {}) {
  return {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId: "workspace_aster",
    workspaceLabel: "Aster Field Operations",
    operatingProfileId: "profile_aster",
    userId: "user_workspace_owner",
    representativeId: "representative_workspace_owner",
    displayName: "Workspace owner",
    roleId: "workspace_owner",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: true,
      administerWorkspaceRoster: true,
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/paid-customer.json",
      businessManifestRegistry: "/data/paid-customer/manifest.json",
      businessRoster: "/data/paid-customer/roster.json",
      businessHours: "/data/paid-customer/hours.json"
    },
    expiresAt: "2026-07-26T13:00:00.000Z",
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    ...overrides
  };
}

function platform(overrides = {}) {
  return {
    workspace: {
      workspaceId: "workspace_aster",
      companyId: "company_aster",
      operatingProfile: { profileId: "profile_aster" },
      provenance: { configurationVersion: "paid-customer-v1.0.0" }
    },
    effectiveCapabilities: ["manage_workspace_configuration"],
    ...overrides
  };
}

function terminology(overrides = {}) {
  return {
    representativeSingular: "Field representative",
    representativePlural: "Field representatives",
    managerSingular: "Field manager",
    managerPlural: "Field managers",
    opportunitySingular: "Opportunity",
    opportunityPlural: "Opportunities",
    visitSingular: "Field visit",
    visitPlural: "Field visits",
    outcomeSingular: "Outcome",
    outcomePlural: "Outcomes",
    followUpSingular: "Follow-up",
    followUpPlural: "Follow-ups",
    ...overrides
  };
}

function previewEnvelope({
  industryLabel = "General outside sales",
  companyName = "Aster Field Operations",
  terms = terminology(),
  overrides = {}
} = {}) {
  const envelope = {
    contractVersion: routeIqPaidCustomerPreviewContractVersion,
    authorizationState: "server_verified",
    previewMode: "READ_ONLY",
    activationEffect: "NONE",
    workspaceId: "workspace_aster",
    companyId: "company_aster",
    configurationVersion: "paid-customer-v1.0.0",
    lifecycleState: "PREVIEW_READY",
    generatedAt: "2026-07-26T11:59:00.000Z",
    expiresAt: "2026-07-26T12:10:00.000Z",
    preview: {
      company: {
        displayName: companyName,
        industryLabel,
        operatingModelLabel: "Territory-based field sales"
      },
      terminology: terms,
      metrics: [
        {
          metricId: "qualified_outcomes",
          label: terms.outcomePlural,
          singularLabel: terms.outcomeSingular,
          pluralLabel: terms.outcomePlural,
          format: "COUNT",
          historyLabelPolicy: "EVENT_SNAPSHOT_IMMUTABLE"
        }
      ],
      goals: [
        {
          goalId: "daily_outcomes",
          label: `Daily ${terms.outcomePlural.toLowerCase()}`,
          metricId: "qualified_outcomes",
          targetDisplay: "4 per day"
        }
      ],
      outcomes: [
        {
          outcomeId: "qualified_progress",
          label: terms.outcomeSingular,
          classification: "SUCCESS"
        }
      ],
      followUpStages: [
        {
          stageId: "follow_up_pending",
          label: `${terms.followUpSingular} pending`,
          order: 1
        }
      ],
      territories: [
        {
          territoryId: "territory_central",
          displayName: "Central territory",
          timeZone: "America/Chicago",
          zipCodes: ["77001", "77002"]
        }
      ],
      targeting: {
        includedCategories: ["Authorized business category"],
        excludedCategories: ["Excluded business category"],
        excludedBusinessCount: 2,
        ruleSummary: "Only configured target profiles inside the authorized territory are eligible."
      },
      verification: {
        verifiedIdentityRequired: true,
        physicalAddressRequired: true,
        authorizedTerritoryRequired: true,
        businessCategoryRequired: true,
        currentOperatingStatusRequired: true,
        operatingHoursRequired: true,
        freshnessCeilingHours: 24,
        providerFailureRule: "FAIL_CLOSED"
      }
    }
  };
  return Object.assign(envelope, overrides);
}

const industryCases = [
  {
    industry: "Gym sales",
    terms: terminology({
      opportunitySingular: "Membership opportunity",
      opportunityPlural: "Membership opportunities",
      outcomeSingular: "Enrollment",
      outcomePlural: "Enrollments"
    })
  },
  {
    industry: "Medical business development",
    terms: terminology({
      opportunitySingular: "Facility",
      opportunityPlural: "Facilities",
      outcomeSingular: "Referral relationship",
      outcomePlural: "Referral relationships"
    })
  },
  {
    industry: "Security services",
    terms: terminology({
      opportunitySingular: "Assessment opportunity",
      opportunityPlural: "Assessment opportunities",
      outcomeSingular: "Proposal",
      outcomePlural: "Proposals"
    })
  },
  {
    industry: "Franchise development",
    terms: terminology({
      opportunitySingular: "Candidate",
      opportunityPlural: "Candidates",
      outcomeSingular: "Discovery call",
      outcomePlural: "Discovery calls"
    })
  },
  {
    industry: "Merchant services",
    terms: terminology({
      opportunitySingular: "Merchant",
      opportunityPlural: "Merchants",
      outcomeSingular: "Application",
      outcomePlural: "Applications"
    })
  },
  {
    industry: "Commercial distribution",
    terms: terminology({
      opportunitySingular: "Buyer",
      opportunityPlural: "Buyers",
      outcomeSingular: "Purchase order",
      outcomePlural: "Purchase orders"
    })
  }
];

test("six unrelated industries use one configuration projection without customer-specific branches", () => {
  for (const fixture of industryCases) {
    const projected = validatePaidCustomerConfigurationPreviewEnvelope(
      previewEnvelope({ industryLabel: fixture.industry, terms: fixture.terms }),
      { session: ownerSession(), platform: platform(), now: NOW }
    );
    assert.equal(projected.status, "READY");
    assert.equal(projected.previewMode, "READ_ONLY");
    assert.equal(projected.activationEffect, "NONE");
    assert.equal(projected.preview.company.industryLabel, fixture.industry);
    assert.equal(projected.preview.terminology.opportunitySingular, fixture.terms.opportunitySingular);
    assert.equal(projected.preview.metrics[0].metricId, "qualified_outcomes");
    assert.equal(Object.isFrozen(projected), true);
    assert.equal(Object.isFrozen(projected.preview.territories[0].zipCodes), true);
  }

  const implementation = readFileSync(
    new URL("../dashboard/route-iq-dashboard-platform.mjs", import.meta.url),
    "utf8"
  );
  for (const fixture of industryCases) {
    assert.doesNotMatch(implementation, new RegExp(fixture.industry, "iu"));
  }
});

test("preview transport is one no-store authenticated GET with no activation body", async () => {
  const calls = [];
  const result = await loadPaidCustomerConfigurationPreview({
    session: ownerSession(),
    platform: platform(),
    now: NOW,
    fetchFn: async (path, options) => {
      calls.push({ path, options });
      return new Response(JSON.stringify(previewEnvelope()), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "private, no-store"
        }
      });
    }
  });

  assert.equal(result.status, "READY");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, routeIqPaidCustomerPreviewPath);
  assert.deepEqual(calls[0].options, {
    method: "GET",
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" }
  });
  assert.equal(Object.hasOwn(calls[0].options, "body"), false);
});

test("expired and representative sessions fail before preview network access", async () => {
  for (const session of [
    ownerSession({ expiresAt: "2026-07-26T11:59:59.000Z" }),
    ownerSession({
      capabilities: {
        operateOwnRoute: true,
        readWorkspaceOperations: false,
        administerWorkspaceRoster: false,
        founderIntelligence: false,
        founderCrm: false
      }
    })
  ]) {
    let requests = 0;
    await assert.rejects(
      loadPaidCustomerConfigurationPreview({
        session,
        platform: platform(),
        now: NOW,
        fetchFn: async () => {
          requests += 1;
          return new Response();
        }
      }),
      error => [
        "route_iq_dashboard_preview_session_expired",
        "route_iq_dashboard_preview_forbidden"
      ].includes(error.code)
    );
    assert.equal(requests, 0);
  }
});

test("offline, cacheable, malformed, and stale preview responses fail closed", async () => {
  await assert.rejects(
    loadPaidCustomerConfigurationPreview({
      session: ownerSession(),
      platform: platform(),
      now: NOW,
      fetchFn: async () => {
        throw new TypeError("offline");
      }
    }),
    error => error.code === "route_iq_dashboard_preview_network_unavailable"
  );

  await assert.rejects(
    loadPaidCustomerConfigurationPreview({
      session: ownerSession(),
      platform: platform(),
      now: NOW,
      fetchFn: async () => new Response(JSON.stringify(previewEnvelope()), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" }
      })
    }),
    error => error.code === "route_iq_dashboard_preview_unavailable"
  );

  await assert.rejects(
    loadPaidCustomerConfigurationPreview({
      session: ownerSession(),
      platform: platform(),
      now: NOW,
      fetchFn: async () => new Response("{", {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "private, no-store" }
      })
    }),
    error => error.code === "route_iq_dashboard_preview_malformed"
  );

  const stale = previewEnvelope({ overrides: { expiresAt: "2026-07-26T11:59:59.000Z" } });
  assert.throws(
    () => validatePaidCustomerConfigurationPreviewEnvelope(stale, {
      session: ownerSession(),
      platform: platform(),
      now: NOW
    }),
    error => error.code === "route_iq_dashboard_preview_envelope_expired"
  );
});

test("workspace, company, profile, configuration, and activation substitutions fail closed", () => {
  const cases = [
    previewEnvelope({ overrides: { workspaceId: "workspace_other" } }),
    previewEnvelope({ overrides: { companyId: "company_other" } }),
    previewEnvelope({ overrides: { configurationVersion: "paid-customer-v1.0.1" } }),
    previewEnvelope({ overrides: { activationEffect: "ACTIVATE" } })
  ];
  for (const envelope of cases) {
    assert.throws(
      () => validatePaidCustomerConfigurationPreviewEnvelope(envelope, {
        session: ownerSession(),
        platform: platform(),
        now: NOW
      }),
      error => error.code === "route_iq_dashboard_preview_envelope_invalid"
    );
  }

  assert.throws(
    () => validatePaidCustomerConfigurationPreviewEnvelope(previewEnvelope(), {
      session: ownerSession(),
      platform: platform({
        workspace: {
          ...platform().workspace,
          operatingProfile: { profileId: "profile_other" }
        }
      }),
      now: NOW
    }),
    error => error.code === "route_iq_dashboard_preview_platform_scope_invalid"
  );
});

test("hostile labels, duplicate identities, bad ZIPs, and permissive verification are rejected", () => {
  const mutations = [
    envelope => {
      envelope.preview.company.displayName = "<img src=x onerror=alert(1)>";
    },
    envelope => {
      envelope.preview.terminology.outcomePlural = "${customer.secret}";
    },
    envelope => {
      envelope.preview.metrics.push(structuredClone(envelope.preview.metrics[0]));
    },
    envelope => {
      envelope.preview.territories[0].zipCodes = ["7700A"];
    },
    envelope => {
      envelope.preview.verification.providerFailureRule = "USE_STALE";
    },
    envelope => {
      envelope.preview.verification.operatingHoursRequired = false;
    }
  ];

  for (const mutate of mutations) {
    const envelope = previewEnvelope();
    mutate(envelope);
    assert.throws(
      () => validatePaidCustomerConfigurationPreviewEnvelope(envelope, {
        session: ownerSession(),
        platform: platform(),
        now: NOW
      }),
      error => error.code.startsWith("route_iq_dashboard_preview_")
    );
  }
});

test("metric label changes preserve prior immutable preview meaning by stable internal ID", () => {
  const first = validatePaidCustomerConfigurationPreviewEnvelope(
    previewEnvelope(),
    { session: ownerSession(), platform: platform(), now: NOW }
  );
  const changed = previewEnvelope();
  changed.preview.metrics[0].label = "Completed outcomes";
  changed.preview.metrics[0].singularLabel = "Completed outcome";
  changed.preview.metrics[0].pluralLabel = "Completed outcomes";
  const second = validatePaidCustomerConfigurationPreviewEnvelope(
    changed,
    { session: ownerSession(), platform: platform(), now: NOW }
  );

  assert.equal(first.preview.metrics[0].metricId, second.preview.metrics[0].metricId);
  assert.equal(first.preview.metrics[0].label, "Outcomes");
  assert.equal(second.preview.metrics[0].label, "Completed outcomes");
  assert.equal(first.preview.metrics[0].historyLabelPolicy, "EVENT_SNAPSHOT_IMMUTABLE");
  assert.equal(second.preview.metrics[0].historyLabelPolicy, "EVENT_SNAPSHOT_IMMUTABLE");
});

test("paid-customer empty state is explicit, non-activating, and free of test-era language", () => {
  const state = paidCustomerConfigurationEmptyState();
  assert.deepEqual(state, {
    title: "No paid-customer configuration selected",
    message: "No paid-customer configuration is selected or activated for this secure session.",
    detail: "A validated configuration and explicit approval are required before customer operations can begin."
  });
  assert.doesNotMatch(JSON.stringify(state), /\bbeta\b|\btester\b|Anthony|Fitness Connection/iu);
});
