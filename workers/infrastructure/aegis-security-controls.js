const DEFAULT_WINDOW_SECONDS = 60;

const ROUTE_POLICIES = Object.freeze({
  lead_intake: Object.freeze({
    id: "lead_intake",
    limit: 10,
    methods: ["GET", "POST", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  }),
  beta_request: Object.freeze({
    id: "beta_request",
    limit: 10,
    methods: ["GET", "POST", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  }),
  instagram_read: Object.freeze({
    id: "instagram_read",
    limit: 30,
    methods: ["GET", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  }),
  oauth_callback: Object.freeze({
    id: "oauth_callback",
    limit: 12,
    methods: ["GET", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  }),
  public_status: Object.freeze({
    id: "public_status",
    limit: 60,
    methods: ["GET", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  }),
  public_api: Object.freeze({
    id: "public_api",
    limit: 60,
    methods: ["GET", "POST", "OPTIONS"],
    windowSeconds: DEFAULT_WINDOW_SECONDS
  })
});

const AEGIS_API_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(), clipboard-read=(), clipboard-write=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-Robots-Tag": "noindex"
});

function aegisRoutePolicy(pathname) {
  if (/^\/api\/(?:lead|leads|intake|enterprise|partner-intake)/i.test(pathname)) return ROUTE_POLICIES.lead_intake;
  if (/^\/api\/(?:beta|private-beta|request-beta)/i.test(pathname)) return ROUTE_POLICIES.beta_request;
  if (/^\/api\/.*(?:status|health)$/i.test(pathname)) return ROUTE_POLICIES.public_status;
  if (/^\/api\/oauth\//i.test(pathname)) return ROUTE_POLICIES.oauth_callback;
  if (/^\/api\/social\/instagram\/(?:snapshot|report)$/i.test(pathname)) return ROUTE_POLICIES.instagram_read;
  if (pathname.startsWith("/api/")) return ROUTE_POLICIES.public_api;
  return null;
}

function clientAddress(request) {
  return request.headers.get("CF-Connecting-IP")
    || (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim()
    || "unknown";
}

function overrideNumber(env, name, fallback) {
  const value = Number(env?.[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolvedPolicy(policy, env) {
  const prefix = `AEGIS_RATE_LIMIT_${policy.id.toUpperCase()}`;
  return {
    ...policy,
    limit: overrideNumber(env, `${prefix}_MAX`, policy.limit),
    windowSeconds: overrideNumber(env, `${prefix}_WINDOW_SECONDS`, policy.windowSeconds)
  };
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimitKey({ request, url, policy, now = Date.now() }) {
  const windowId = Math.floor(now / (policy.windowSeconds * 1000));
  const fingerprint = await sha256Hex([
    clientAddress(request),
    url.hostname,
    policy.id,
    request.method
  ].join("|"));
  return `aegis:${policy.id}:${windowId}:${fingerprint}`;
}

function rateLimitHeaders({ policy, count, store, limited = false }) {
  const remaining = Math.max(policy.limit - count, 0);
  return {
    "Retry-After": limited ? String(policy.windowSeconds) : undefined,
    "X-Aegis-Route-Policy": policy.id,
    "X-Aegis-RateLimit-Store": store,
    "X-RateLimit-Limit": String(policy.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window-Seconds": String(policy.windowSeconds)
  };
}

function cleanHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
}

function jsonAegisResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      ...cleanHeaders(headers),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function optionsResponse(policy) {
  return new Response(null, {
    status: 204,
    headers: {
      ...AEGIS_API_HEADERS,
      Allow: policy.methods.filter(method => method !== "OPTIONS").join(", ")
    }
  });
}

async function enforceAegisControls(request, env, now = Date.now()) {
  const url = new URL(request.url);
  const basePolicy = aegisRoutePolicy(url.pathname);
  if (!basePolicy) return { ok: true, policy: null, headers: {} };

  const policy = resolvedPolicy(basePolicy, env);
  if (request.method === "OPTIONS") {
    return { ok: false, policy, response: optionsResponse(policy) };
  }

  if (!policy.methods.includes(request.method)) {
    return {
      ok: false,
      policy,
      response: jsonAegisResponse({
        ok: false,
        message: "Method not allowed."
      }, 405, { Allow: policy.methods.filter(method => method !== "OPTIONS").join(", ") })
    };
  }

  const store = env?.AEGIS_RATE_LIMITS;
  if (!store?.get || !store?.put) {
    return {
      ok: true,
      policy,
      headers: rateLimitHeaders({ policy, count: 0, store: "not-configured" })
    };
  }

  const key = await rateLimitKey({ request, url, policy, now });
  const current = Number(await store.get(key) || 0);
  const next = current + 1;
  if (next > policy.limit) {
    return {
      ok: false,
      policy,
      response: jsonAegisResponse({
        ok: false,
        code: "rate_limited",
        message: "Too many requests. Retry after the current rate-limit window."
      }, 429, rateLimitHeaders({ policy, count: next, store: "kv", limited: true }))
    };
  }

  await store.put(key, String(next), { expirationTtl: policy.windowSeconds * 2 });
  return {
    ok: true,
    policy,
    headers: rateLimitHeaders({ policy, count: next, store: "kv" })
  };
}

function withAegisHeaders(response, aegis = {}) {
  if (!aegis.policy) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(aegis.headers || {})) {
    if (value !== undefined) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(AEGIS_API_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export {
  AEGIS_API_HEADERS,
  ROUTE_POLICIES,
  aegisRoutePolicy,
  enforceAegisControls,
  withAegisHeaders
};
