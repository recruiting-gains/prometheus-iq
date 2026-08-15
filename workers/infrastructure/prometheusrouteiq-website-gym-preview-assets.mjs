import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY =
  "deploy/prometheusrouteiq-website";
export const PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_HASH_ALGORITHM =
  "sha256-length-prefixed-relative-path-and-content-v1";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function regularFiles(root, current = root, output = []) {
  const entries = readdirSync(current).sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
  for (const name of entries) {
    const path = resolve(current, name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) fail("route_iq_gym_preview_asset_symlink_rejected");
    if (stats.isDirectory()) {
      regularFiles(root, path, output);
    } else if (stats.isFile()) {
      output.push({
        path,
        relativePath: relative(root, path).split("\\").join("/")
      });
    } else {
      fail("route_iq_gym_preview_asset_entry_invalid");
    }
  }
  return output;
}

function lengthFrame(pathLength, contentLength) {
  const frame = Buffer.alloc(16);
  frame.writeBigUInt64BE(BigInt(pathLength), 0);
  frame.writeBigUInt64BE(BigInt(contentLength), 8);
  return frame;
}

export function hashPrometheusRouteIqGymPreviewAssets(
  directory = PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY
) {
  const root = resolve(directory);
  const rootStats = lstatSync(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail("route_iq_gym_preview_asset_directory_invalid");
  }
  const files = regularFiles(root);
  if (files.length === 0) fail("route_iq_gym_preview_asset_directory_empty");

  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const file of files) {
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    const content = readFileSync(file.path);
    hash.update(lengthFrame(pathBytes.byteLength, content.byteLength));
    hash.update(pathBytes);
    hash.update(content);
    totalBytes += content.byteLength;
  }
  return Object.freeze({
    algorithm: PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_HASH_ALGORITHM,
    directory: relative(process.cwd(), root).split("\\").join("/"),
    fileCount: files.length,
    totalBytes,
    sha256: hash.digest("hex")
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = hashPrometheusRouteIqGymPreviewAssets(
    process.argv[2] || PROMETHEUS_ROUTE_IQ_GYM_PREVIEW_ASSET_DIRECTORY
  );
  process.stdout.write(`${result.sha256}\n`);
}
