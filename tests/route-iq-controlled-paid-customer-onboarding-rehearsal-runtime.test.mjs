import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import {
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES,
  ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION,
  RouteIqControlledPaidCustomerRehearsalRuntimeError,
  createControlledPaidCustomerRehearsalMemoryStore,
  executeControlledPaidCustomerOnboardingRehearsal,
  handleControlledPaidCustomerOnboardingRehearsalRequest,
  isControlledPaidCustomerOnboardingRehearsalPath
} from "../workers/infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.js";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV,
  CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION,
  cloudflareUnattendedSmokeContractVersion
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import {
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";

const evaluatedAt = new Date("2026-07-30T15:00:00.000Z");
const workerVersion = "11111111-1111-4111-8111-111111111111";
const issuer = "https://controlled-rehearsal.cloudflareaccess.com";
const audience = "controlled-rehearsal-audience";
const clientId = `${"a".repeat(32)}.access`;
const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = await exportJWK(signingKeys.publicKey);
publicJwk.kid = "controlled-rehearsal-test-key";
publicJwk.alg = "RS256";
const keyResolver = createLocalJWKSet({ keys: [publicJwk] });

const verifiedAuthorization = Object.freeze({
  contractVersion: cloudflareUnattendedSmokeContractVersion,
  kind: "service_principal",
  verified: true
});

async function servicePrincipalToken() {
  const now = Math.floor(evaluatedAt.getTime() / 1000);
  return new SignJWT({
    type: "app",
    sub: "",
    common_name: clientId
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: "controlled-rehearsal-test-key",
      typ: "JWT"
    })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 300)
    .sign(signingKeys.privateKey);
}

function exactRequest(init = {}) {
  return new Request(
    `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}`
      + ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH,
    init
  );
}

function guardEnvironment() {
  const permitted = new Set([
    CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled,
    CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain,
    CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience,
    CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId,
    CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
  ]);
  const values = {
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled]: "ON",
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain]: issuer,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience]: audience,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId]: clientId,
    [CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding]: { id: workerVersion }
  };
  return new Proxy(values, {
    get(target, property, receiver) {
      if (typeof property === "string" && !permitted.has(property)) {
        throw new Error("production_binding_access_forbidden");
      }
      return Reflect.get(target, property, receiver);
    }
  });
}

test("Infrastructure contract fixes the exact authenticated in-memory boundary", () => {
  const contract = JSON.parse(readFileSync(new URL(
    "../workers/infrastructure/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime-v1.json",
    import.meta.url
  ), "utf8"));
  assert.equal(
    contract.contractVersion,
    ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION
  );
  assert.equal(contract.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(contract.route.exactPath, ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH);
  assert.equal(contract.route.allowedMethod, "GET");
  assert.equal(contract.route.queryAllowed, false);
  assert.equal(contract.route.bodyAllowed, false);
  assert.equal(contract.route.ordinaryPrincipalAllowed, false);
  assert.deepEqual(contract.execution.productionBindingsAccessed, []);
  assert.deepEqual(contract.execution.durableObjectsAccessed, []);
  assert.equal(contract.execution.crmAccessed, false);
  assert.equal(contract.safety.customerActivation, "OFF");
  assert.equal(contract.safety.collection, "OFF");
  assert.equal(contract.safety.activeCohorts, 0);
  assert.equal(contract.safety.recommendationInfluence, "OFF");
  assert.equal(
    CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS.includes(
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH
    ),
    true
  );
  assert.equal(
    CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS.some(
      request => request.path === ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH
    ),
    false
  );
  assert.equal(
    isControlledPaidCustomerOnboardingRehearsalPath(
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH
    ),
    true
  );
  assert.equal(
    isControlledPaidCustomerOnboardingRehearsalPath(
      `${ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH}/`
    ),
    false
  );
});

test("fresh rehearsal proves Draft failure recovery Validated isolation hours and safety", async () => {
  const evidence = await executeControlledPaidCustomerOnboardingRehearsal();
  assert.deepEqual(evidence.lifecycle, {
    draft: "CREATED",
    controlledValidation: "FAILED_AS_EXPECTED",
    validationFailure: "CONTROLLED_LOCATION_SCOPE_INVALID",
    failureEvidence: "PRESERVED",
    recovery: "DRAFT_RESTORED",
    finalState: "VALIDATED",
    activated: false
  });
  assert.deepEqual(evidence.topology, {
    companyWorkspaceBinding: "EXACT",
    locationCount: 2,
    managerCount: 1,
    representativeCount: 2
  });
  assert.deepEqual(evidence.authorization, {
    managerWorkspaceRead: "AUTHORIZED",
    representativeOwnRecordRead: "AUTHORIZED",
    representativeWorkspaceRead: "DENIED",
    representativePrivilegedAccess: "DENIED",
    crossUserAccess: "DENIED",
    crossCompanyAccess: "DENIED",
    crossWorkspaceAccess: "DENIED"
  });
  assert.deepEqual(evidence.operatingHours, {
    openLocation: "ADMISSION_ELIGIBLE_VALIDATION_ONLY",
    closedLocation: "BUSINESS_NOT_OPEN_NOW",
    representativeRouting: "BLOCKED",
    recommendationInfluence: "OFF"
  });
  assert.deepEqual(evidence.safety, {
    billing: "BLOCKED",
    liveStripe: "DISABLED",
    customerActivation: "OFF",
    invitations: "NOT_SENT",
    providerRefresh: "OFF",
    scheduler: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    persistence: "NONE",
    productionBindingAccess: "NONE"
  });
  assert.equal(evidence.safeEmptyState, "PRESERVED");
  assert.deepEqual(evidence.cleanup, {
    status: "REMOVED",
    remainingRecords: 0
  });
});

test("every injected phase failure fails closed and unconditionally removes memory records", async () => {
  for (const phase of Object.values(
    ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES
  )) {
    const memory = createControlledPaidCustomerRehearsalMemoryStore();
    await assert.rejects(
      executeControlledPaidCustomerOnboardingRehearsal({
        memory,
        testHooks: {
          enabled: true,
          afterPhase(evidence) {
            assert.equal(typeof evidence.recordCount, "number");
            if (evidence.phase === phase) throw new Error("injected_failure_canary");
          }
        }
      }),
      error => {
        assert.ok(error instanceof RouteIqControlledPaidCustomerRehearsalRuntimeError);
        assert.equal(
          error.code,
          ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed
        );
        assert.equal(error.message.includes("canary"), false);
        return true;
      }
    );
    assert.equal(memory.recordCount(), 0);
  }
});

test("handler rejects ordinary authorization method query body and alternate paths", async () => {
  const ordinary = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    exactRequest(),
    { kind: "ordinary", verified: false }
  );
  assert.equal(ordinary.status, 403);

  const post = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    exactRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }),
    verifiedAuthorization
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET");

  const head = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    exactRequest({ method: "HEAD" }),
    verifiedAuthorization
  );
  assert.equal(head.status, 405);
  assert.equal(head.headers.get("Allow"), "GET");

  const query = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    new Request(
      `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}`
        + `${ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH}?page=1`
    ),
    verifiedAuthorization
  );
  assert.equal(query.status, 400);

  const body = await handleControlledPaidCustomerOnboardingRehearsalRequest({
    url: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}`
      + ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH,
    method: "GET",
    headers: new Headers({ "Content-Length": "1" }),
    body: {}
  }, verifiedAuthorization);
  assert.equal(body.status, 400);

  const alternate = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    new Request(
      `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}`
        + `${ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH}/`
    ),
    verifiedAuthorization
  );
  assert.equal(alternate.status, 404);
});

test("handler returns only bounded synthetic status evidence and no authorization material", async () => {
  const authorizationCanary = "authorization-secret-canary";
  const response = await handleControlledPaidCustomerOnboardingRehearsalRequest(
    exactRequest(),
    {
      ...verifiedAuthorization,
      authorizationCanary
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.status, "PASS");
  assert.equal(body.evidence.cleanup.remainingRecords, 0);
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    authorizationCanary,
    "Orion",
    "Fictional Way",
    "principal_orion",
    "company_orion",
    "workspace_orion",
    "riq_receipt_",
    "Fitness Connection",
    "Anthony"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("signed service principal reaches the exact route without any production binding access", async () => {
  const token = await servicePrincipalToken();
  const request = exactRequest({
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader]:
        CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
    }
  });
  const response = await handlePrometheusIqWorkerRequest(
    request,
    guardEnvironment(),
    {},
    {
      unattendedSmokeTestHooks: {
        enabled: true,
        keyResolver,
        currentDate: evaluatedAt
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader),
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue
  );
  assert.equal(
    response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader),
    workerVersion
  );
  const body = await response.json();
  assert.equal(body.status, "PASS");
  assert.equal(body.evidence.cleanup.remainingRecords, 0);
  assert.equal(JSON.stringify(body).includes(token), false);
});

test("ordinary Worker traffic cannot execute the rehearsal and expected failure stays nonsecret", async () => {
  const ordinary = await handlePrometheusIqWorkerRequest(
    exactRequest(),
    guardEnvironment(),
    {}
  );
  assert.equal(ordinary.status, 403);
  assert.equal(
    ordinary.headers.has(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader),
    false
  );

  const token = await servicePrincipalToken();
  const failed = await handlePrometheusIqWorkerRequest(
    exactRequest({
      headers: {
        "Cf-Access-Jwt-Assertion": token,
        [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader]:
          CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
      }
    }),
    guardEnvironment(),
    {},
    {
      unattendedSmokeTestHooks: {
        enabled: true,
        keyResolver,
        currentDate: evaluatedAt
      },
      controlledPaidCustomerRehearsalTestHooks: {
        enabled: true,
        afterPhase({ phase }) {
          if (phase === ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.validated) {
            throw new Error("runtime-sensitive-canary");
          }
        }
      }
    }
  );
  assert.equal(failed.status, 503);
  const body = await failed.json();
  assert.equal(
    body.code,
    ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed
  );
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("canary"), false);
  assert.equal(serialized.includes(token), false);
});
