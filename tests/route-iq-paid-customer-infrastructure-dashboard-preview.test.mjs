import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validatePaidCustomerConfigurationPreviewEnvelope
} from "../dashboard/route-iq-dashboard-platform.mjs";
import {
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  isTrustedRouteIqPaidCustomerDecision
} from "../security/route-iq-paid-customer-isolation-v1.mjs";
import {
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";
import {
  ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES,
  ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH,
  handleRouteIqPaidCustomerDashboardPreviewRequest
} from "../workers/infrastructure/route-iq-paid-customer-dashboard-preview-runtime.js";
import {
  authorizeRouteIqPaidCustomerInfrastructureOperation
} from "../workers/infrastructure/route-iq-paid-customer-server-authority.js";

const NOW = new Date("2026-07-26T12:00:00.000Z");
const fixtures = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
  import.meta.url
), "utf8"));

function configuration(index = 0) {
  return structuredClone(fixtures.configurations[index]);
}

function authorizationFor(selected, {
  companyId = selected.company.companyId,
  workspaceId = selected.company.workspaceId,
  accessMode = "workspace_administration",
  capabilities = {
    readWorkspaceOperations: true,
    administerWorkspaceRoster: true
  }
} = {}) {
  return {
    principal: {
      authorized: true,
      companyId: workspaceId,
      workspaceId,
      operatingProfileId: selected.operatingProfile.industryTemplateId,
      userId: "user_synthetic_workspace_admin",
      accessMode,
      capabilities
    },
    runtimeAuthorization: {
      zipCoverage: {
        companyId,
        workspaceId
      }
    },
    accessExpiresAt: "2026-07-26T13:00:00.000Z"
  };
}

function request({
  method = "GET",
  path = ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH,
  headers = {}
} = {}) {
  return new Request(`https://prometheus-iq.example${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Referer: "https://prometheus-iq.example/app?workspaceId=workspace_aster_security_synthetic",
      ...headers
    }
  });
}

function selectionFor(selected) {
  return {
    configuration: selected,
    configurationVersion: "v2.2.0",
    selectionAuthority: "prometheus_administration"
  };
}

function dashboardSession(selected) {
  return {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId: selected.company.workspaceId,
    workspaceLabel: selected.company.displayName,
    operatingProfileId: selected.operatingProfile.industryTemplateId,
    userId: "user_synthetic_workspace_admin",
    representativeId: "representative_synthetic_workspace_admin",
    displayName: "Workspace administrator",
    roleId: "workspace_administrator",
    capabilities: {
      operateOwnRoute: false,
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
    }
  };
}

function dashboardPlatform(selected) {
  return {
    workspace: {
      workspaceId: selected.company.workspaceId,
      companyId: selected.company.companyId,
      operatingProfile: {
        profileId: selected.operatingProfile.industryTemplateId
      },
      provenance: {
        configurationVersion: "v2.2.0"
      }
    },
    effectiveCapabilities: ["manage_workspace_configuration"]
  };
}

test("exact GET projects an envelope accepted by the Dashboard owner contract", async () => {
  const selected = configuration();
  let resolverCalls = 0;
  const response = await handleRouteIqPaidCustomerDashboardPreviewRequest(
    request(),
    {},
    {
      now: NOW,
      authorizePrincipal: async () => authorizationFor(selected),
      resolveSelectedConfiguration: async scope => {
        resolverCalls += 1;
        assert.deepEqual(scope, {
          companyId: selected.company.companyId,
          workspaceId: selected.company.workspaceId,
          storageScope: {
            companyId: selected.company.companyId,
            workspaceId: selected.company.workspaceId
          }
        });
        return selectionFor(selected);
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const envelope = await response.json();
  const normalized = validatePaidCustomerConfigurationPreviewEnvelope(envelope, {
    session: dashboardSession(selected),
    platform: dashboardPlatform(selected),
    now: NOW
  });
  assert.equal(normalized.status, "READY");
  assert.equal(normalized.activationEffect, "NONE");
  assert.equal(normalized.preview.company.displayName, selected.company.displayName);
  assert.equal(resolverCalls, 1);
});

test("Security owner contract creates the trusted non-enumerating storage decision", () => {
  const selected = configuration();
  const authorization = authorizationFor(selected);
  const authority = authorizeRouteIqPaidCustomerInfrastructureOperation({
    authorization,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview,
    requestedScope: {
      companyId: selected.company.companyId,
      workspaceId: selected.company.workspaceId
    },
    now: NOW
  });
  assert.equal(isTrustedRouteIqPaidCustomerDecision(authority.decision), true);
  assert.deepEqual(authority.decision.storageScope, {
    companyId: selected.company.companyId,
    workspaceId: selected.company.workspaceId
  });

  assert.throws(() => authorizeRouteIqPaidCustomerInfrastructureOperation({
    authorization,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview,
    requestedScope: {
      companyId: configuration(1).company.companyId,
      workspaceId: selected.company.workspaceId
    },
    now: NOW
  }), /server_authority_denied/u);
});

test("no governed selection returns private safe-empty classification after authorization", async () => {
  const selected = configuration();
  let authorizationCalls = 0;
  let resolverCalls = 0;
  const response = await handleRouteIqPaidCustomerDashboardPreviewRequest(
    request(),
    {},
    {
      now: NOW,
      authorizePrincipal: async () => {
        authorizationCalls += 1;
        return authorizationFor(selected);
      },
      resolveSelectedConfiguration: async () => {
        resolverCalls += 1;
        return null;
      }
    }
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    code: ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable,
    message: "Route IQ paid-customer configuration is unavailable."
  });
  assert.equal(authorizationCalls, 1);
  assert.equal(resolverCalls, 1);
});

test("cross-company and representative requests fail before owner configuration resolution", async () => {
  const selected = configuration();
  const other = configuration(1);
  for (const authorization of [
    authorizationFor(other),
    authorizationFor(selected, {
      accessMode: "customer_workspace_operational",
      capabilities: {
        readWorkspaceOperations: false,
        administerWorkspaceRoster: false
      }
    })
  ]) {
    let resolverCalls = 0;
    const response = await handleRouteIqPaidCustomerDashboardPreviewRequest(
      request(),
      {},
      {
        now: NOW,
        authorizePrincipal: async () => authorization,
        resolveSelectedConfiguration: async () => {
          resolverCalls += 1;
          return selectionFor(selected);
        }
      }
    );
    assert.equal(response.status, 404);
    assert.equal(resolverCalls, 0);
    assert.equal(
      (await response.json()).code,
      ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable
    );
  }
});

test("method, query, body, referrer, and protected-switch drift fail closed without writes", async () => {
  const selected = configuration();
  const cases = [
    { request: request({ method: "POST" }), env: {}, status: 405 },
    {
      request: request({ path: `${ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH}?workspaceId=x` }),
      env: {},
      status: 400
    },
    {
      request: request({ headers: { "Content-Length": "1" } }),
      env: {},
      status: 400
    },
    {
      request: request({ headers: { Referer: "https://outside.example/app?workspaceId=x" } }),
      env: {},
      status: 404
    },
    {
      request: request(),
      env: { ROUTE_IQ_PAID_CUSTOMER_ACTIVATION: "ON" },
      status: 503
    }
  ];
  for (const item of cases) {
    let authorizationCalls = 0;
    let resolverCalls = 0;
    const response = await handleRouteIqPaidCustomerDashboardPreviewRequest(
      item.request,
      item.env,
      {
        now: NOW,
        authorizePrincipal: async () => {
          authorizationCalls += 1;
          return authorizationFor(selected);
        },
        resolveSelectedConfiguration: async () => {
          resolverCalls += 1;
          return selectionFor(selected);
        }
      }
    );
    assert.equal(response.status, item.status);
    assert.equal(resolverCalls, 0);
    if ([400, 405, 503].includes(item.status)) assert.equal(authorizationCalls, 0);
  }
});

test("private Worker preserves smoke then Aegis ordering and never touches stores", async () => {
  const selected = configuration();
  let writes = 0;
  const response = await handlePrometheusIqWorkerRequest(
    request(),
    {
      CUSTOMER_STORE: {
        async put() {
          writes += 1;
        }
      }
    },
    { waitUntil() {} },
    {
      paidCustomerDashboardPreviewTestHooks: {
        now: NOW,
        authorizePrincipal: async () => authorizationFor(selected),
        resolveSelectedConfiguration: async () => selectionFor(selected)
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Aegis-Route-Policy"), "public_api");
  assert.equal(writes, 0);
  assert.equal((await response.json()).activationEffect, "NONE");
});
