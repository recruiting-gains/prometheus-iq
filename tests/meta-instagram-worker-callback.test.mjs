import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  CALLBACK_PATH,
  STATUS_PATH,
  TOKEN_STORE_KEY
} from "../workers/prometheus-iq-worker.js";
import {
  INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS
} from "../social-media/infrastructure/instagram-runtime-controls.js";
import {
  META_INSTAGRAM_OAUTH_ENDPOINTS,
  createMetaInstagramOAuthState
} from "../social-media/infrastructure/meta-instagram-oauth-workflow.js";

const baseEnv = {
  META_APP_ID: "meta-app-id",
  META_APP_SECRET: "meta-app-secret-not-returned",
  META_OAUTH_STATE_SECRET: "oauth-state-secret-not-returned",
  META_OAUTH_CALLBACK_URL: "https://prometheus-iq.prometheusrouteiq.workers.dev/api/oauth/meta/instagram/callback",
  META_GRAPH_API_VERSION: "v21.0",
  INSTAGRAM_BUSINESS_ACCOUNT_ID: "17890000000000000",
  INSTAGRAM_OAUTH_SCOPES: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS.join(","),
  ASSETS: {
    fetch: async request => new Response(`asset:${new URL(request.url).pathname}`, {
      headers: { "Content-Type": "text/plain" }
    })
  }
};

function createTokenStore() {
  const writes = [];
  return {
    writes,
    async put(key, value, options) {
      writes.push({ key, value, options });
    }
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function createOrderedFetch(responses) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    assert.ok(next, `unexpected fetch call: ${String(input)}`);
    if (typeof next.assert === "function") next.assert(String(input), init);
    return jsonResponse(next.status || 200, next.body || {});
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function signedState(env = baseEnv) {
  const state = createMetaInstagramOAuthState({
    env,
    nonce: "callback-nonce"
  });
  assert.equal(state.ok, true);
  return state.state;
}

async function request(path, env, init = {}) {
  return worker.fetch(new Request(`https://prometheus-iq.prometheusrouteiq.workers.dev${path}`, {
    headers: { Accept: "application/json", ...(init.headers || {}) },
    method: init.method || "GET"
  }), env);
}

test("Meta Instagram callback status exposes only safe runtime and storage metadata", async () => {
  const tokenStore = createTokenStore();
  const response = await request(STATUS_PATH, {
    ...baseEnv,
    META_INSTAGRAM_TOKEN_STORE: tokenStore,
    META_INSTAGRAM_TOKEN_ENCRYPTION_KEY: "test-encryption-secret-with-at-least-32-chars"
  });
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.storage.tokenStoreBinding, true);
  assert.equal(body.storage.encryptionKeyConfigured, true);
  assert.equal(serialized.includes("meta-app-secret-not-returned"), false);
  assert.equal(serialized.includes("test-encryption-secret"), false);
});

test("Meta Instagram callback refuses to exchange code when token storage is missing", async () => {
  const originalFetch = globalThis.fetch;
  const fetchImpl = createOrderedFetch([]);
  globalThis.fetch = fetchImpl;
  try {
    const response = await request(`${CALLBACK_PATH}?code=oauth-code&state=${encodeURIComponent(signedState())}`, baseEnv);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.message.includes("not configured"), true);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Meta Instagram callback rejects invalid OAuth state before provider exchange", async () => {
  const tokenStore = createTokenStore();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createOrderedFetch([]);
  globalThis.fetch = fetchImpl;
  try {
    const response = await request(`${CALLBACK_PATH}?code=oauth-code&state=bad-state`, {
      ...baseEnv,
      META_INSTAGRAM_TOKEN_STORE: tokenStore,
      META_INSTAGRAM_TOKEN_ENCRYPTION_KEY: "test-encryption-secret-with-at-least-32-chars"
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.equal(body.message.includes("state"), true);
    assert.equal(fetchImpl.calls.length, 0);
    assert.equal(tokenStore.writes.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Meta Instagram callback stores returned token material only in encrypted backend storage", async () => {
  const tokenStore = createTokenStore();
  const fetchImpl = createOrderedFetch([
    {
      assert: (url, init) => {
        assert.equal(url, META_INSTAGRAM_OAUTH_ENDPOINTS.SHORT_LIVED_TOKEN);
        assert.equal(init.method, "POST");
      },
      body: {
        access_token: "short-lived-token-not-public",
        user_id: "ig-user-1",
        permissions: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS
      }
    },
    {
      assert: url => {
        assert.equal(url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.LONG_LIVED_TOKEN), true);
      },
      body: {
        access_token: "long-lived-token-not-public",
        token_type: "bearer",
        expires_in: 5184000
      }
    },
    {
      assert: url => {
        assert.equal(url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.ME), true);
      },
      body: {
        user_id: "ig-user-1",
        username: "prometheus.iq",
        account_type: "BUSINESS"
      }
    }
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const response = await request(`${CALLBACK_PATH}?code=oauth-code&state=${encodeURIComponent(signedState())}`, {
      ...baseEnv,
      META_INSTAGRAM_TOKEN_STORE: tokenStore,
      META_INSTAGRAM_TOKEN_ENCRYPTION_KEY: "test-encryption-secret-with-at-least-32-chars"
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.storage.persisted, true);
    assert.equal(body.storage.storageKey, TOKEN_STORE_KEY);
    assert.deepEqual(body.storage.tokenFields.sort(), [
      "INSTAGRAM_ACCESS_TOKEN",
      "INSTAGRAM_ACCOUNT_HANDLE",
      "INSTAGRAM_CONNECTION_VERIFIED_AT",
      "INSTAGRAM_GRANTED_SCOPES",
      "INSTAGRAM_TOKEN_EXPIRES_AT",
      "INSTAGRAM_USER_ID"
    ]);
    assert.equal(tokenStore.writes.length, 1);
    assert.equal(tokenStore.writes[0].key, TOKEN_STORE_KEY);
    assert.equal(tokenStore.writes[0].value.includes("long-lived-token-not-public"), false);
    assert.equal(tokenStore.writes[0].value.includes("meta-app-secret-not-returned"), false);
    assert.equal(serialized.includes("long-lived-token-not-public"), false);
    assert.equal(serialized.includes("short-lived-token-not-public"), false);
    assert.equal(serialized.includes("meta-app-secret-not-returned"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Meta Instagram Worker keeps existing asset behavior outside API routes", async () => {
  const response = await request("/?role=founder", baseEnv);
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(text, "asset:/");
});
