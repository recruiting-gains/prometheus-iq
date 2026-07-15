import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

export const CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS = Object.freeze({
  temporaryApiToken: Object.freeze({
    service: "com.prometheus.cloudflare.attended.service-token-provisioning",
    account: "CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"
  }),
  governedAccountId: Object.freeze({
    service: "com.prometheus.cloudflare.unattended.deployment",
    account: "CLOUDFLARE_ACCOUNT_ID"
  }),
  smokeClientId: Object.freeze({
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_ID"
  }),
  smokeClientSecret: Object.freeze({
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  })
});

export const CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER = resolve(
  import.meta.dirname,
  "../helpers/cloudflare-founder-attended-keychain.swift"
);

const ITEM_KEYS = Object.freeze(Object.keys(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS));
const READABLE_KEYS = new Set(["temporaryApiToken", "governedAccountId"]);
const WRITABLE_KEYS = new Set(["smokeClientId", "smokeClientSecret"]);
const MAX_SECRET_BYTES = 65_536;
const OWNERSHIP_TAG_PATTERN = /^prometheus-founder-attended-v1:[0-9a-f]{64}$/u;

function itemFor(key) {
  if (!ITEM_KEYS.includes(key)) throw new Error("founder_attended_keychain_item_denied");
  return CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS[key];
}

function ownershipInput(value) {
  if (!OWNERSHIP_TAG_PATTERN.test(value || "")) {
    throw new Error("founder_attended_keychain_ownership_invalid");
  }
  return Buffer.from(value, "utf8");
}

function assertNoHelperOutput(result, failureCode) {
  const hasOutput = (Buffer.isBuffer(result.stdout) || typeof result.stdout === "string")
    && result.stdout.length > 0;
  if (Buffer.isBuffer(result.stdout)) result.stdout.fill(0);
  if (hasOutput) throw new Error(failureCode);
}

function fixedHelperEnvironment(source) {
  const environment = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: typeof source?.HOME === "string" ? source.HOME : homedir(),
    TMPDIR: typeof source?.TMPDIR === "string" ? source.TMPDIR : tmpdir()
  };
  if (typeof source?.LANG === "string") environment.LANG = source.LANG;
  if (typeof source?.LC_ALL === "string") environment.LC_ALL = source.LC_ALL;
  return environment;
}

export function createFounderAttendedMacOsKeychain({
  spawnSyncImpl = spawnSync,
  helperPath = CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER,
  environment = process.env
} = {}) {
  const invoke = (operation, key, input) => {
    const item = itemFor(key);
    const result = spawnSyncImpl(
      "/usr/bin/swift",
      [helperPath, operation, item.service, item.account],
      {
        env: fixedHelperEnvironment(environment),
        input,
        encoding: null,
        maxBuffer: MAX_SECRET_BYTES,
        stdio: ["pipe", "pipe", "ignore"]
      }
    );
    return result || {};
  };

  return Object.freeze({
    hasItem(key) {
      const result = invoke("presence", key);
      assertNoHelperOutput(result, "founder_attended_keychain_presence_failed");
      if (result.error || ![0, 2].includes(result.status)) {
        throw new Error("founder_attended_keychain_presence_failed");
      }
      return result.status === 0;
    },

    readItem(key) {
      if (!READABLE_KEYS.has(key)) throw new Error("founder_attended_keychain_read_denied");
      const result = invoke("read", key);
      if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout) || !result.stdout.length) {
        throw new Error("founder_attended_keychain_read_failed");
      }
      const value = Buffer.from(result.stdout);
      result.stdout.fill(0);
      return value;
    },

    addItem(key, value, ownershipTag) {
      if (!WRITABLE_KEYS.has(key)) throw new Error("founder_attended_keychain_write_denied");
      const ownership = ownershipInput(ownershipTag);
      const secret = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value || "", "utf8");
      const input = Buffer.concat([ownership, Buffer.from("\n", "utf8"), secret]);
      try {
        if (!secret.length || secret.length > MAX_SECRET_BYTES) {
          throw new Error("founder_attended_keychain_write_failed");
        }
        const result = invoke("add", key, input);
        assertNoHelperOutput(result, "founder_attended_keychain_write_failed");
        if (result.error || result.status !== 0) {
          throw new Error("founder_attended_keychain_write_failed");
        }
        return Object.freeze({ created: true });
      } finally {
        secret.fill(0);
        ownership.fill(0);
        input.fill(0);
      }
    },

    deleteItem(key) {
      if (key !== "temporaryApiToken") throw new Error("founder_attended_keychain_delete_denied");
      const result = invoke("delete", key);
      assertNoHelperOutput(result, "founder_attended_keychain_delete_failed");
      if (result.error || result.status !== 0) {
        throw new Error("founder_attended_keychain_delete_failed");
      }
    },

    deleteOwnedItem(key, ownershipTag) {
      if (!WRITABLE_KEYS.has(key)) throw new Error("founder_attended_keychain_delete_denied");
      const input = ownershipInput(ownershipTag);
      try {
        const result = invoke("delete", key, input);
        assertNoHelperOutput(result, "founder_attended_keychain_delete_failed");
        if (result.error || ![0, 2].includes(result.status)) {
          throw new Error("founder_attended_keychain_delete_failed");
        }
        return Object.freeze({ deleted: result.status === 0 });
      } finally {
        input.fill(0);
      }
    }
  });
}

export function founderAttendedKeychainPresence(keychain) {
  return Object.freeze(ITEM_KEYS.map(key => {
    const item = itemFor(key);
    return Object.freeze({
      name: `${item.service}/${item.account}`,
      present: Boolean(keychain.hasItem(key))
    });
  }));
}

export function formatFounderAttendedKeychainPresence(results) {
  return results
    .map(result => `${result.name}: ${result.present ? "PRESENT" : "ABSENT"}`)
    .join("\n");
}
