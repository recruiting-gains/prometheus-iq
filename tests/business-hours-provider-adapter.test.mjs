import test from "node:test";
import assert from "node:assert/strict";

import {
  BUSINESS_HOURS_DATA_NORMALIZATION_INPUT_VERSION,
  BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT,
  BUSINESS_HOURS_PROVIDER_CODES,
  BUSINESS_HOURS_PROVIDER_MODES,
  BUSINESS_HOURS_PROVIDER_RESPONSE_VERSION,
  createBusinessHoursProviderAdapter,
  createDeterministicBusinessHoursMockTransport
} from "../integrations/business-hours-provider-adapter.js";

const providerId = "synthetic_hours_provider";
const endpoint = "https://provider.invalid/v1/business-hours";
const now = () => new Date("2026-07-23T12:00:00.000Z");
const businesses = Object.freeze([
  Object.freeze({ businessId: "business_alpha", providerIdentity: "place_alpha" }),
  Object.freeze({ businessId: "business_beta", providerIdentity: "place_beta" })
]);

function providerResult(providerIdentity, overrides = {}) {
  return {
    providerIdentity,
    timeZone: "America/Chicago",
    weeklyPeriods: [
      { openDay: 1, openTime: "09:00", closeDay: 1, closeTime: "17:00" }
    ],
    specialPeriods: [
      { date: "2026-12-25", status: "CLOSED" }
    ],
    appointmentWindows: [],
    open24Hours: false,
    appointmentOnly: false,
    providerUpdatedAt: "2026-07-23T11:55:00.000Z",
    ...overrides
  };
}

function providerEnvelope(results = businesses.map(item => providerResult(item.providerIdentity)), overrides = {}) {
  return {
    contractVersion: BUSINESS_HOURS_PROVIDER_RESPONSE_VERSION,
    providerId,
    observedAt: "2026-07-23T11:59:00.000Z",
    results,
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    requestId: "request_hours_001",
    businesses: [...businesses],
    ...overrides
  };
}

function activeAdapter(transport, overrides = {}) {
  return createBusinessHoursProviderAdapter({
    mode: BUSINESS_HOURS_PROVIDER_MODES.SHADOW,
    providerId,
    endpoint,
    requestHeaders: {
      Authorization: "Bearer synthetic-secret-placeholder"
    },
    transport,
    timeoutMs: 50,
    now,
    ...overrides
  });
}

test("contract is default OFF, GET-only, bounded, and Data-owned at its output", () => {
  assert.equal(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.defaultMode, "OFF");
  assert.deepEqual(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.methods, ["GET"]);
  assert.equal(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.maximumAttempts, 3);
  assert.equal(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.authorizedConsumerSubsystem, "Prometheus Data");
  assert.equal(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.directEligibilityOutputAllowed, false);
  assert.equal(BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.directRecommendationOutputAllowed, false);
});

test("OFF mode performs zero provider calls even when transport and endpoint are unusable", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 200, body: providerEnvelope() }
  ]);
  const adapter = createBusinessHoursProviderAdapter({
    mode: BUSINESS_HOURS_PROVIDER_MODES.OFF,
    endpoint: "not-an-endpoint",
    transport
  });

  const result = await adapter.read(request());

  assert.deepEqual(result, {
    ok: false,
    code: BUSINESS_HOURS_PROVIDER_CODES.MODE_OFF,
    attempts: 0,
    retryable: false,
    normalizationInputs: []
  });
  assert.equal(transport.calls.length, 0);
  assert.equal(transport.remaining(), 1);
});

test("successful reads are fixed GET requests and emit only Data normalization inputs", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 200, body: providerEnvelope() }
  ]);
  const result = await activeAdapter(transport).read(request());

  assert.equal(result.ok, true);
  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.SUCCESS);
  assert.equal(result.attempts, 1);
  assert.equal(result.normalizationInputs.length, 2);
  assert.equal(result.normalizationInputs[0].schemaVersion, BUSINESS_HOURS_DATA_NORMALIZATION_INPUT_VERSION);
  assert.equal(result.normalizationInputs[0].businessId, "business_alpha");
  assert.equal(result.normalizationInputs[0].source.providerIdentity, "place_alpha");
  assert.equal(result.normalizationInputs[0].source.retrievedAt, "2026-07-23T12:00:00.000Z");
  assert.equal(result.normalizationInputs[0].availabilityObservation.timeZone, "America/Chicago");
  assert.equal("eligible" in result.normalizationInputs[0], false);
  assert.equal("recommendation" in result.normalizationInputs[0], false);
  assert.equal("rawResponse" in result.normalizationInputs[0], false);

  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].method, "GET");
  assert.equal(transport.calls[0].redirect, "manual");
  assert.equal(transport.calls[0].cache, "no-store");
  assert.equal(transport.calls[0].hasBody, false);
  assert.deepEqual(transport.calls[0].headerNames, ["Accept", "Authorization"]);
  assert.match(transport.calls[0].url, /provider_identity=place_alpha/u);
  assert.match(transport.calls[0].url, /provider_identity=place_beta/u);
});

test("redirects are rejected without following or retrying", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    {
      status: 302,
      headers: { location: "https://other.invalid/v1/business-hours" },
      body: {}
    },
    { status: 200, body: providerEnvelope() }
  ]);
  const result = await activeAdapter(transport, { retryDelaysMs: [0] }).read(request());

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.REDIRECT_REJECTED);
  assert.equal(result.attempts, 1);
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.remaining(), 1);
});

test("malformed and non-JSON bodies fail closed without retry", async () => {
  const malformed = createDeterministicBusinessHoursMockTransport([
    { status: 200, bodyText: "not-json" }
  ]);
  const wrongType = createDeterministicBusinessHoursMockTransport([
    { status: 200, headers: { "content-type": "text/html" }, bodyText: "{}" }
  ]);

  const malformedResult = await activeAdapter(malformed, { retryDelaysMs: [0] }).read(request());
  const wrongTypeResult = await activeAdapter(wrongType, { retryDelaysMs: [0] }).read(request());

  assert.equal(malformedResult.code, BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE);
  assert.equal(wrongTypeResult.code, BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE);
  assert.equal(malformed.calls.length, 1);
  assert.equal(wrongType.calls.length, 1);
});

test("strict field allowlists reject eligibility fields and nested provider drift", async () => {
  const eligibilityField = createDeterministicBusinessHoursMockTransport([
    {
      status: 200,
      body: providerEnvelope([
        { ...providerResult("place_alpha"), eligible: true },
        providerResult("place_beta")
      ])
    }
  ]);
  const nestedField = createDeterministicBusinessHoursMockTransport([
    {
      status: 200,
      body: providerEnvelope([
        providerResult("place_alpha", {
          weeklyPeriods: [
            {
              openDay: 1,
              openTime: "09:00",
              closeDay: 1,
              closeTime: "17:00",
              providerNote: "not-allowlisted"
            }
          ]
        }),
        providerResult("place_beta")
      ])
    }
  ]);

  assert.equal(
    (await activeAdapter(eligibilityField).read(request())).code,
    BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE
  );
  assert.equal(
    (await activeAdapter(nestedField).read(request())).code,
    BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE
  );
});

test("timeouts are bounded and retry only within the caller-supplied budget", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { type: "timeout" },
    { status: 200, body: providerEnvelope() }
  ]);
  const slept = [];
  const result = await activeAdapter(transport, {
    timeoutMs: 5,
    retryDelaysMs: [7],
    sleep: async delay => slept.push(delay)
  }).read(request());

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.SUCCESS);
  assert.equal(result.attempts, 2);
  assert.deepEqual(slept, [7]);
  assert.equal(transport.calls.length, 2);
});

test("authorization denial never retries", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 403, body: { message: "denied" } },
    { status: 200, body: providerEnvelope() }
  ]);
  const result = await activeAdapter(transport, { retryDelaysMs: [0] }).read(request());

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.AUTHORIZATION_DENIED);
  assert.equal(result.retryable, false);
  assert.equal(result.attempts, 1);
  assert.equal(transport.calls.length, 1);
});

test("partial results return no normalization input and are never retried", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 200, body: providerEnvelope([providerResult("place_alpha")]) },
    { status: 200, body: providerEnvelope() }
  ]);
  const result = await activeAdapter(transport, { retryDelaysMs: [0] }).read(request());

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.PARTIAL_RESULT);
  assert.deepEqual(result.normalizationInputs, []);
  assert.equal(result.attempts, 1);
  assert.equal(transport.calls.length, 1);
});

test("unknown, duplicate, and provider-level identities fail closed", async () => {
  const unknown = createDeterministicBusinessHoursMockTransport([
    {
      status: 200,
      body: providerEnvelope([
        providerResult("place_alpha"),
        providerResult("place_other")
      ])
    }
  ]);
  const duplicate = createDeterministicBusinessHoursMockTransport([
    {
      status: 200,
      body: providerEnvelope([
        providerResult("place_alpha"),
        providerResult("place_alpha")
      ])
    }
  ]);
  const providerMismatch = createDeterministicBusinessHoursMockTransport([
    {
      status: 200,
      body: providerEnvelope(undefined, { providerId: "other_provider" })
    }
  ]);

  assert.equal(
    (await activeAdapter(unknown).read(request())).code,
    BUSINESS_HOURS_PROVIDER_CODES.IDENTITY_MISMATCH
  );
  assert.equal(
    (await activeAdapter(duplicate).read(request())).code,
    BUSINESS_HOURS_PROVIDER_CODES.IDENTITY_MISMATCH
  );
  assert.equal(
    (await activeAdapter(providerMismatch).read(request())).code,
    BUSINESS_HOURS_PROVIDER_CODES.IDENTITY_MISMATCH
  );
});

test("retryable provider failures obey the exact capped caller schedule", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 503, body: {} },
    { status: 429, body: {} },
    { status: 200, body: providerEnvelope() }
  ]);
  const slept = [];
  const result = await activeAdapter(transport, {
    retryDelaysMs: [11, 29],
    sleep: async delay => slept.push(delay)
  }).read(request());

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.SUCCESS);
  assert.equal(result.attempts, 3);
  assert.deepEqual(slept, [11, 29]);
  assert.equal(transport.calls.length, 3);
});

test("over-broad retry schedules and invalid requests make zero calls", async () => {
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 200, body: providerEnvelope() }
  ]);
  const invalidConfiguration = activeAdapter(transport, {
    retryDelaysMs: [0, 0, 0]
  });
  const invalidRequestAdapter = activeAdapter(transport);

  const configResult = await invalidConfiguration.read(request());
  const requestResult = await invalidRequestAdapter.read(request({
    businesses: [
      { businessId: "duplicate", providerIdentity: "place_alpha" },
      { businessId: "duplicate", providerIdentity: "place_beta" }
    ]
  }));

  assert.equal(configResult.code, BUSINESS_HOURS_PROVIDER_CODES.INVALID_CONFIGURATION);
  assert.equal(requestResult.code, BUSINESS_HOURS_PROVIDER_CODES.INVALID_REQUEST);
  assert.equal(transport.calls.length, 0);
});

test("secret-bearing transport failures expose only fixed nonsecret classifications", async () => {
  const sensitiveValue = "synthetic-sensitive-placeholder";
  let callCount = 0;
  const transport = async () => {
    callCount += 1;
    throw new Error(`provider failed with ${sensitiveValue}`);
  };
  const result = await activeAdapter(transport, {
    requestHeaders: {
      Authorization: `Bearer ${sensitiveValue}`,
      "X-Provider-Token": sensitiveValue
    }
  }).read(request());
  const serialized = JSON.stringify(result);

  assert.equal(result.code, BUSINESS_HOURS_PROVIDER_CODES.NETWORK_FAILED);
  assert.equal(callCount, 1);
  assert.doesNotMatch(serialized, new RegExp(sensitiveValue, "u"));
  assert.doesNotMatch(serialized, /authorization|header|cookie|token/iu);
});

test("deterministic mock transport retains names and request shape but no header values", async () => {
  const sensitiveValue = "synthetic-sensitive-placeholder";
  const transport = createDeterministicBusinessHoursMockTransport([
    { status: 200, body: providerEnvelope() }
  ]);
  await activeAdapter(transport, {
    requestHeaders: {
      Authorization: `Bearer ${sensitiveValue}`,
      "X-Provider-Token": sensitiveValue
    }
  }).read(request());

  const serializedCalls = JSON.stringify(transport.calls);
  assert.doesNotMatch(serializedCalls, new RegExp(sensitiveValue, "u"));
  assert.deepEqual(
    transport.calls[0].headerNames,
    ["Accept", "Authorization", "X-Provider-Token"]
  );
});
