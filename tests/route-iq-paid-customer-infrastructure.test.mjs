import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  transitionRouteIqPaidCustomerOnboarding
} from "../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";
import {
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS,
  ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_RUNTIME_VERSION,
  handleRouteIqPaidCustomerOnboardingRequest
} from "../workers/infrastructure/route-iq-paid-customer-onboarding-runtime.js";

const fixtures = JSON.parse(readFileSync(new URL(
  "../administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json",
  import.meta.url
), "utf8"));
const runtimeContract = JSON.parse(readFileSync(new URL(
  "../workers/infrastructure/route-iq-paid-customer-onboarding-runtime-v1.json",
  import.meta.url
), "utf8"));
const rollbackContract = JSON.parse(readFileSync(new URL(
  "../workers/infrastructure/route-iq-paid-customer-onboarding-forward-rollback-v1.json",
  import.meta.url
), "utf8"));

function clone(value) {
  return structuredClone(value);
}

function validatedConfiguration(index = 0) {
  return clone(fixtures.configurations[index]);
}

function transition(configuration, state, at, extra = {}) {
  return transitionRouteIqPaidCustomerOnboarding(configuration, state, {
    transitionedAt: at,
    ...extra
  });
}

function provisioningConfiguration() {
  let configuration = validatedConfiguration();
  configuration = transition(
    configuration,
    "PREVIEW_READY",
    "2026-07-26T12:01:00.000Z"
  );
  configuration = transition(
    configuration,
    "AWAITING_APPROVAL",
    "2026-07-26T12:02:00.000Z",
    { approvalReference: "synthetic_approval_reference" }
  );
  return transition(
    configuration,
    "PROVISIONING",
    "2026-07-26T12:03:00.000Z"
  );
}

function activeConfiguration() {
  let configuration = provisioningConfiguration();
  configuration = transition(
    configuration,
    "READY_FOR_ACTIVATION",
    "2026-07-26T12:04:00.000Z"
  );
  return transition(
    configuration,
    "ACTIVE",
    "2026-07-26T12:05:00.000Z",
    { activationAuthorizationRef: "synthetic_test_only_activation_reference" }
  );
}

function principalFor(configuration, overrides = {}) {
  return {
    authorized: true,
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    userId: "user_synthetic_founder",
    accessMode: "founder_explicit_workspace_read_only",
    capabilities: {
      readWorkspaceOperations: true,
      administerWorkspaceRoster: false
    },
    ...overrides
  };
}

function workspaceAdminFor(configuration, overrides = {}) {
  return principalFor(configuration, {
    userId: "user_synthetic_workspace_admin",
    accessMode: "workspace_administration",
    capabilities: {
      readWorkspaceOperations: true,
      administerWorkspaceRoster: true
    },
    ...overrides
  });
}

function requestFor(path, configuration, {
  method = "POST",
  body = { configuration },
  workspaceId = configuration.company.workspaceId,
  headers = {}
} = {}) {
  return new Request(
    `https://prometheus-iq.example${path}?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {})
    }
  );
}

async function invoke(path, configuration, options = {}) {
  const principal = options.principal || principalFor(configuration);
  return handleRouteIqPaidCustomerOnboardingRequest(
    requestFor(path, configuration, options),
    options.env || {},
    { authorizePrincipal: async () => principal }
  );
}

test("Infrastructure contract fixes exact routes, non-persistence, owner composition, and rollback consequences", () => {
  assert.equal(runtimeContract.contractVersion, ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_RUNTIME_VERSION);
  assert.equal(runtimeContract.worker, "prometheus-iq");
  assert.equal(runtimeContract.routes.maximumBodyBytes, ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES);
  assert.deepEqual(
    Object.values(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS).sort(),
    [
      runtimeContract.routes.preview,
      runtimeContract.routes.provisioningPlan,
      runtimeContract.routes.suspensionPreview,
      runtimeContract.routes.offboardingPreview
    ].sort()
  );
  assert.equal(runtimeContract.ownerComposition.configurationValidation, "Prometheus Administration route-iq-paid-customer-onboarding-v1");
  assert.equal(runtimeContract.ownerComposition.verifiedBusinessEvidence, "Prometheus Data route-iq-verified-business-evidence-v1");
  assert.equal(runtimeContract.writes.production, false);
  assert.deepEqual(runtimeContract.bindingsAndMigrations, {
    newBindings: [],
    newDurableObjectClasses: [],
    newMigrations: [],
    newSecrets: [],
    newVariables: []
  });
  assert.equal(rollbackContract.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(rollbackContract.consequences.customerDataLossPossible, false);
  assert.equal(rollbackContract.consequences.acceptedRecordLossPossible, false);
  assert.equal(rollbackContract.consequences.schemaRollbackRequired, false);
  assert.equal(rollbackContract.nativeRollbackAllowed, false);
});

test("authenticated Founder preview is scoped, non-activating, and hands off exact Data contracts", async () => {
  const configuration = validatedConfiguration();
  const response = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    configuration
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.operation, "CONFIGURATION_PREVIEW");
  assert.deepEqual(body.scope, {
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId
  });
  assert.equal(body.result.activationPerformed, false);
  assert.equal(body.result.productionMutationCount, 0);
  assert.equal(body.verifiedBusinessHandoff.evidenceContractVersion, "route-iq-verified-business-evidence-v1");
  assert.equal(body.verifiedBusinessHandoff.eligibilityPolicyVersion, "route-iq-verified-business-eligibility-policy-v1");
  assert.equal(
    body.verifiedBusinessHandoff.admissionState,
    "FAIL_CLOSED_PENDING_DATA_AND_INTELLIGENCE_VALIDATION"
  );
  assert.deepEqual(body.safety, {
    customerActivation: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    usersProvisioned: false,
    crmMutationPerformed: false,
    productionMutationPerformed: false
  });
  assert.equal(body.audit.auditPersistencePerformed, false);
});

test("workspace administrators can preview while representatives and caller-supplied scope cannot", async () => {
  const configuration = validatedConfiguration();
  const admin = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    configuration,
    { principal: workspaceAdminFor(configuration) }
  );
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).audit.actorRole, "workspace_admin");

  const representative = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    configuration,
    {
      principal: principalFor(configuration, {
        accessMode: "representative",
        capabilities: {
          readWorkspaceOperations: false,
          administerWorkspaceRoster: false
        }
      })
    }
  );
  assert.equal(representative.status, 403);
  assert.equal(
    (await representative.json()).code,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.roleDenied
  );
});

test("company, workspace, and requested-workspace substitutions fail without disclosing another tenant", async () => {
  const configuration = validatedConfiguration();
  const other = validatedConfiguration(1);
  for (const options of [
    { principal: principalFor(other) },
    {
      principal: principalFor(configuration),
      workspaceId: other.company.workspaceId
    },
    {
      principal: principalFor(configuration, {
        companyId: other.company.companyId
      })
    }
  ]) {
    const response = await invoke(
      ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
      configuration,
      options
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.scopeDenied,
      message: "Route IQ paid-customer onboarding is unavailable."
    });
  }
});

test("authorization completes before the body is read or owner dependencies execute", async () => {
  const configuration = validatedConfiguration();
  let dependencyCalls = 0;
  const response = await handleRouteIqPaidCustomerOnboardingRequest(
    requestFor(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview, configuration, {
      body: { configuration: "not-a-configuration" }
    }),
    {},
    {
      authorizePrincipal: async () => {
        throw new Error("authentication failed");
      },
      dependencies: new Proxy({}, {
        get() {
          dependencyCalls += 1;
          throw new Error("dependency must not execute");
        }
      })
    }
  );
  assert.equal(response.status, 401);
  assert.equal(dependencyCalls, 0);
});

test("production authorization is unavailable by default when the existing customer access lane is OFF", async () => {
  const configuration = validatedConfiguration();
  const response = await handleRouteIqPaidCustomerOnboardingRequest(
    requestFor(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview, configuration),
    {}
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.authenticationRequired,
    message: "Route IQ paid-customer onboarding is unavailable."
  });
});

test("provisioning plan and receipt are deterministic, idempotent, and never persisted", async () => {
  const configuration = provisioningConfiguration();
  const first = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.provisioningPlan,
    configuration
  );
  const second = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.provisioningPlan,
    configuration
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstBody = await first.json();
  const secondBody = await second.json();
  assert.deepEqual(firstBody.result, secondBody.result);
  assert.equal(firstBody.result.plan.activationRequested, false);
  assert.equal(firstBody.result.plan.productionMutationAuthorized, false);
  assert.equal(firstBody.result.receipt.activationPerformed, false);
  assert.equal(firstBody.result.receipt.persistencePerformed, false);
  assert.equal(firstBody.audit.auditPersistencePerformed, false);
});

test("invalid lifecycle states and malformed owner configurations fail closed", async () => {
  const wrongState = validatedConfiguration();
  const planResponse = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.provisioningPlan,
    wrongState
  );
  assert.equal(planResponse.status, 422);
  assert.equal(
    (await planResponse.json()).code,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.configurationInvalid
  );

  const malformed = validatedConfiguration();
  malformed.safety.collection = "ON";
  const previewResponse = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    malformed
  );
  assert.equal(previewResponse.status, 422);
  assert.equal(
    (await previewResponse.json()).code,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.configurationInvalid
  );
});

test("suspension and offboarding previews preserve data boundaries and perform no write", async () => {
  const active = activeConfiguration();
  const suspensionResponse = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.suspensionPreview,
    active,
    {
      body: {
        configuration: active,
        transitionedAt: "2026-07-26T12:06:00.000Z",
        reasonCode: "synthetic_suspension"
      }
    }
  );
  assert.equal(suspensionResponse.status, 200);
  const suspension = await suspensionResponse.json();
  assert.equal(suspension.result.lifecycleState, "SUSPENDED");
  assert.equal(suspension.result.customerActivation, "OFF");
  assert.equal(suspension.result.auditEvent.accessBehavior, "DENY_OPERATIONAL_ACCESS");
  assert.equal(suspension.result.auditEvent.dataBehavior, "PRESERVE_APPEND_ONLY");
  assert.equal(suspension.result.persistencePerformed, false);

  const suspended = transition(
    active,
    "SUSPENDED",
    "2026-07-26T12:06:00.000Z"
  );
  const offboardingResponse = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.offboardingPreview,
    suspended,
    {
      body: {
        configuration: suspended,
        transitionedAt: "2026-07-26T12:07:00.000Z",
        reasonCode: "synthetic_offboarding"
      }
    }
  );
  assert.equal(offboardingResponse.status, 200);
  const offboarding = await offboardingResponse.json();
  assert.equal(offboarding.result.lifecycleState, "OFFBOARDED");
  assert.equal(offboarding.result.auditEvent.accessBehavior, "DENY_ALL_CUSTOMER_ACCESS");
  assert.equal(
    offboarding.result.auditEvent.dispositionBehavior,
    "SEPARATE_APPEND_ONLY_DATA_ACTION_REQUIRED"
  );
  assert.equal(offboarding.result.persistencePerformed, false);
});

test("method, route, media type, body size, and query limits fail closed", async () => {
  const configuration = validatedConfiguration();
  const get = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    configuration,
    { method: "GET" }
  );
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("Allow"), "POST");

  const invalidMedia = await invoke(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview,
    configuration,
    { headers: { "Content-Type": "text/plain" } }
  );
  assert.equal(invalidMedia.status, 415);

  const invalidQuery = await handleRouteIqPaidCustomerOnboardingRequest(
    new Request(`https://prometheus-iq.example${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuration })
    }),
    {},
    { authorizePrincipal: async () => principalFor(configuration) }
  );
  assert.equal(invalidQuery.status, 400);

  const oversized = await handleRouteIqPaidCustomerOnboardingRequest(
    new Request(
      `https://prometheus-iq.example${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview}?workspaceId=${configuration.company.workspaceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuration,
          padding: "x".repeat(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES)
        })
      }
    ),
    {},
    { authorizePrincipal: async () => principalFor(configuration) }
  );
  assert.equal(oversized.status, 413);
  assert.equal(
    (await oversized.json()).code,
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.bodyTooLarge
  );
});

test("protected switch drift rejects the request before owner contracts or storage can run", async () => {
  const configuration = validatedConfiguration();
  let authorized = false;
  let storageCalls = 0;
  const env = {
    ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION: "ON",
    CUSTOMER_STORE: {
      async put() {
        storageCalls += 1;
      }
    }
  };
  const response = await handleRouteIqPaidCustomerOnboardingRequest(
    requestFor(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview, configuration),
    env,
    {
      authorizePrincipal: async () => {
        authorized = true;
        return principalFor(configuration);
      }
    }
  );
  assert.equal(response.status, 503);
  assert.equal(authorized, false);
  assert.equal(storageCalls, 0);
});

test("private Worker dispatch keeps smoke and Aegis ordering and does not touch business stores", async () => {
  const configuration = validatedConfiguration();
  let customerWrites = 0;
  const response = await handlePrometheusIqWorkerRequest(
    requestFor(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview, configuration),
    {
      CUSTOMER_STORE: {
        async put() {
          customerWrites += 1;
        }
      }
    },
    { waitUntil() {} },
    {
      paidCustomerOnboardingTestHooks: {
        authorizePrincipal: async () => principalFor(configuration)
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Aegis-Route-Policy"), "public_api");
  assert.equal(customerWrites, 0);
  assert.equal((await response.json()).safety.productionMutationPerformed, false);
});
