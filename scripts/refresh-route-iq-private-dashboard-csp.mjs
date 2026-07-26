#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const indexPath = "index.html";
const headersPath = "_headers";
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu;
const SCRIPT_HASH = /script-src[^;]*'(sha256-[A-Za-z0-9+/=]+)'/gu;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function exactInlineScript(index) {
  const matches = [...index.matchAll(INLINE_SCRIPT)];
  if (matches.length !== 1) throw new Error("route_iq_private_csp_inline_script_count_invalid");
  return matches[0][1];
}

function pinnedHashes(value) {
  return [...value.matchAll(SCRIPT_HASH)].map(match => match[1]);
}

function atomicWrite(path, value) {
  const absolute = resolve(root, path);
  const mode = lstatSync(absolute).mode & 0o777;
  const temporary = resolve(dirname(absolute), `.${randomUUID()}.route-iq-csp.tmp`);
  try {
    writeFileSync(temporary, value, { encoding: "utf8", flag: "wx", mode: 0o600 });
    chmodSync(temporary, mode);
    renameSync(temporary, absolute);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function currentRouteIqPrivateDashboardCspHash(index = read(indexPath)) {
  return `sha256-${createHash("sha256")
    .update(exactInlineScript(index), "utf8")
    .digest("base64")}`;
}

export function inspectRouteIqPrivateDashboardCsp() {
  const index = read(indexPath);
  const headers = read(headersPath);
  const expectedHash = currentRouteIqPrivateDashboardCspHash(index);
  const indexHashes = pinnedHashes(index);
  const headerHashes = pinnedHashes(headers);
  return Object.freeze({
    ok: indexHashes.length === 1
      && headerHashes.length === 1
      && indexHashes[0] === expectedHash
      && headerHashes[0] === expectedHash,
    expectedHash,
    indexHashes: Object.freeze(indexHashes),
    headerHashes: Object.freeze(headerHashes)
  });
}

export function refreshRouteIqPrivateDashboardCsp({ write = false } = {}) {
  const inspection = inspectRouteIqPrivateDashboardCsp();
  if (!write || inspection.ok) return inspection;
  if (inspection.indexHashes.length !== 1
    || inspection.headerHashes.length !== 1
    || inspection.indexHashes[0] !== inspection.headerHashes[0]) {
    throw new Error("route_iq_private_csp_existing_pin_ambiguous");
  }
  const staleHash = inspection.indexHashes[0];
  const expectedHash = inspection.expectedHash;
  const index = read(indexPath);
  const headers = read(headersPath);
  if (index.split(staleHash).length !== 2 || headers.split(staleHash).length !== 2) {
    throw new Error("route_iq_private_csp_replacement_scope_invalid");
  }
  atomicWrite(indexPath, index.replace(staleHash, expectedHash));
  atomicWrite(headersPath, headers.replace(staleHash, expectedHash));
  const refreshed = inspectRouteIqPrivateDashboardCsp();
  if (!refreshed.ok) throw new Error("route_iq_private_csp_refresh_failed");
  return refreshed;
}

function cli() {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== "--write")) {
    throw new Error("route_iq_private_csp_argument_invalid");
  }
  const result = refreshRouteIqPrivateDashboardCsp({
    write: args.includes("--write")
  });
  process.stdout.write(`${result.ok ? "PASS" : "CSP_DRIFT"}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    cli();
  } catch {
    process.stdout.write("FAIL\n");
    process.exitCode = 1;
  }
}
