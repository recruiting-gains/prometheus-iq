#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const configurationPath = resolve(root, "tests/test-suites.v1.json");
const suiteNames = Object.freeze([
  "core",
  "public",
  "private",
  "security",
  "release",
  "historical"
]);

export function trackedTests(repositoryRoot = root) {
  return execFileSync("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "*test.mjs"
  ], { cwd: repositoryRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter(file => existsSync(resolve(repositoryRoot, file)))
    .sort();
}

export function validateTestSuiteConfiguration({
  repositoryRoot = root,
  configuration = JSON.parse(readFileSync(configurationPath, "utf8"))
} = {}) {
  if (configuration.schemaVersion !== "prometheus-test-suites-v1") {
    throw new Error("TEST_SUITE_SCHEMA_INVALID");
  }
  if (JSON.stringify(Object.keys(configuration.suites)) !== JSON.stringify(suiteNames)) {
    throw new Error("TEST_SUITE_NAMES_INVALID");
  }
  const classified = [];
  for (const name of suiteNames) {
    const files = configuration.suites[name];
    if (!Array.isArray(files) || files.length === 0 || files.some(file => typeof file !== "string")) {
      throw new Error(`TEST_SUITE_INVALID:${name}`);
    }
    if (JSON.stringify(files) !== JSON.stringify([...files].sort())) {
      throw new Error(`TEST_SUITE_ORDER_INVALID:${name}`);
    }
    classified.push(...files);
  }
  const duplicates = classified.filter((file, index) => classified.indexOf(file) !== index);
  if (duplicates.length > 0) throw new Error(`TEST_CLASSIFICATION_DUPLICATE:${duplicates[0]}`);
  const isolatedSuites = configuration.isolatedFiles || {};
  for (const name of Object.keys(isolatedSuites)) {
    if (!suiteNames.includes(name)) throw new Error(`TEST_ISOLATION_SUITE_INVALID:${name}`);
    const files = isolatedSuites[name];
    if (!Array.isArray(files) || files.length === 0 || files.some(file => typeof file !== "string")) {
      throw new Error(`TEST_ISOLATION_INVALID:${name}`);
    }
    if (JSON.stringify(files) !== JSON.stringify([...files].sort())) {
      throw new Error(`TEST_ISOLATION_ORDER_INVALID:${name}`);
    }
    const duplicate = files.find((file, index) => files.indexOf(file) !== index);
    if (duplicate) throw new Error(`TEST_ISOLATION_DUPLICATE:${duplicate}`);
    const outsideSuite = files.find(file => !configuration.suites[name].includes(file));
    if (outsideSuite) throw new Error(`TEST_ISOLATION_OUTSIDE_SUITE:${outsideSuite}`);
  }
  const actual = trackedTests(repositoryRoot);
  if (JSON.stringify([...classified].sort()) !== JSON.stringify(actual)) {
    const classifiedSet = new Set(classified);
    const actualSet = new Set(actual);
    const missing = actual.find(file => !classifiedSet.has(file));
    const stale = classified.find(file => !actualSet.has(file));
    throw new Error(`TEST_CLASSIFICATION_INCOMPLETE:${missing || stale || "UNKNOWN"}`);
  }
  return Object.freeze({
    status: "TEST_CLASSIFICATION_VALID",
    total: actual.length,
    counts: Object.freeze(Object.fromEntries(
      suiteNames.map(name => [name, configuration.suites[name].length])
    ))
  });
}

export function testSuiteExecutionGroups(name, configuration) {
  if (!suiteNames.includes(name)) throw new Error("TEST_SUITE_NAME_INVALID");
  const isolated = new Set(configuration.isolatedFiles?.[name] || []);
  const concurrent = configuration.suites[name].filter(file => !isolated.has(file));
  return Object.freeze([
    ...(concurrent.length > 0
      ? [Object.freeze({ concurrency: 4, files: Object.freeze(concurrent) })]
      : []),
    ...(isolated.size > 0
      ? [Object.freeze({ concurrency: 1, files: Object.freeze([...isolated]) })]
      : [])
  ]);
}

export function runTestSuite(name, { repositoryRoot = root } = {}) {
  if (!suiteNames.includes(name)) throw new Error("TEST_SUITE_NAME_INVALID");
  const configuration = JSON.parse(readFileSync(configurationPath, "utf8"));
  validateTestSuiteConfiguration({ repositoryRoot, configuration });
  for (const group of testSuiteExecutionGroups(name, configuration)) {
    const result = spawnSync(process.execPath, [
      "--test",
      `--test-concurrency=${group.concurrency}`,
      ...group.files
    ], {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: { ...process.env, PROMETHEUS_TEST_SUITE: name }
    });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      return result.status;
    }
  }
  return 0;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [name, ...extra] = process.argv.slice(2);
  if (extra.length > 0 || !suiteNames.includes(name)) {
    console.error("TEST_SUITE_NAME_INVALID");
    process.exitCode = 1;
  } else {
    try {
      runTestSuite(name);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "TEST_SUITE_FAILED");
      process.exitCode = 1;
    }
  }
}
