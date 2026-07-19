const DurableObjectBase = globalThis.navigator?.userAgent === "Cloudflare-Workers"
  ? (await import("cloudflare:workers")).DurableObject
  : class NoncanonicalNodeDurableObjectShim {
      constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
      }
    };

const INTERNAL_ORIGIN = "https://route-iq-request-crm.internal";
const MAX_BODY_BYTES = 96 * 1024;
const MAX_KEY_LENGTH = 700;
const MAX_VALUE_BYTES = 80 * 1024;
const MAX_LIST_RESULTS = 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function fail(code, status = 400) {
  return json({ ok: false, code }, status);
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function validKey(value) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= MAX_KEY_LENGTH
    && /^[A-Za-z0-9._/-]+$/u.test(value)
    && !value.includes("..")
    && !value.startsWith("/");
}

function validMetadata(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const serialized = JSON.stringify(value);
  return utf8Bytes(serialized) <= 4096 ? value : null;
}

async function boundedBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (utf8Bytes(text) > MAX_BODY_BYTES) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function storedValue(value, metadata, now) {
  return Object.freeze({
    value,
    metadata,
    createdAt: now,
    updatedAt: now
  });
}

export class RouteIqRequestCrmCoordinator extends DurableObjectBase {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.origin !== INTERNAL_ORIGIN || request.method !== "POST") {
      return fail("route_iq_request_crm_internal_route_denied", 405);
    }
    if (!this.ctx?.storage?.get || !this.ctx?.storage?.put || !this.ctx?.storage?.transaction) {
      return fail("route_iq_request_crm_storage_unavailable", 503);
    }

    const body = await boundedBody(request);
    if (!body) return fail("route_iq_request_crm_internal_body_invalid");

    if (url.pathname === "/v1/get") return this.#get(body);
    if (url.pathname === "/v1/put") return this.#put(body);
    if (url.pathname === "/v1/put-if-absent") return this.#putIfAbsent(body);
    if (url.pathname === "/v1/list") return this.#list(body);
    return fail("route_iq_request_crm_internal_route_unknown", 404);
  }

  async #get(body) {
    if (!validKey(body.key)) return fail("route_iq_request_crm_key_invalid");
    const record = await this.ctx.storage.get(body.key);
    return json({ ok: true, value: record?.value ?? null });
  }

  async #put(body) {
    const metadata = validMetadata(body.metadata);
    if (!validKey(body.key)
      || typeof body.value !== "string"
      || utf8Bytes(body.value) > MAX_VALUE_BYTES
      || metadata === null) {
      return fail("route_iq_request_crm_record_invalid");
    }
    const now = new Date().toISOString();
    const existing = await this.ctx.storage.get(body.key);
    await this.ctx.storage.put(body.key, {
      ...storedValue(body.value, metadata, existing?.createdAt || now),
      updatedAt: now
    });
    return json({ ok: true });
  }

  async #putIfAbsent(body) {
    const metadata = validMetadata(body.metadata);
    if (!validKey(body.key)
      || typeof body.value !== "string"
      || utf8Bytes(body.value) > MAX_VALUE_BYTES
      || metadata === null) {
      return fail("route_iq_request_crm_record_invalid");
    }
    const inserted = await this.ctx.storage.transaction(async transaction => {
      const existing = await transaction.get(body.key);
      if (existing !== undefined && existing !== null) return false;
      const now = new Date().toISOString();
      await transaction.put(body.key, storedValue(body.value, metadata, now));
      return true;
    });
    return json({ ok: true, inserted });
  }

  async #list(body) {
    if (typeof body.prefix !== "string" || !validKey(`${body.prefix}placeholder`)) {
      return fail("route_iq_request_crm_prefix_invalid");
    }
    const records = await this.ctx.storage.list({
      prefix: body.prefix,
      limit: MAX_LIST_RESULTS + 1
    });
    const keys = [...records.keys()].sort();
    if (keys.length > MAX_LIST_RESULTS) {
      return fail("route_iq_request_crm_initial_capacity_exceeded", 409);
    }
    return json({ ok: true, keys: keys.map(name => ({ name })) });
  }
}

export const routeIqRequestCrmDurableObjectLimits = Object.freeze({
  maxBodyBytes: MAX_BODY_BYTES,
  maxKeyLength: MAX_KEY_LENGTH,
  maxValueBytes: MAX_VALUE_BYTES,
  maxListResults: MAX_LIST_RESULTS,
  storageBackend: "sqlite_backed_durable_object",
  atomicAdmission: "durable_object_storage_transaction"
});
