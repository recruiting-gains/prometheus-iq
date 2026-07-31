import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { agentTools, classifyPermission, runAgentTool } from "../prometheus-os/agent-actions.js";
import { PermissionLevel } from "../prometheus-os/audit-log.js";

const contract = JSON.parse(readFileSync(new URL(
  "../intelligence/contracts/route-iq-companion-operational-boundary-v1.json",
  import.meta.url
), "utf8"));

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const swiftShell = source("../mac-companion/PrometheusCompanion.swift");
const companionInfo = source("../mac-companion/Info.plist");
const companionRuntime = source("../prometheus-os/app.js");
const companionRouter = source("../prometheus-os/companion-command-router.js");
const privateWorker = source("../workers/prometheus-iq-worker.js");

test("Companion remains dormant, disconnected, and unable to perform Route IQ operations", () => {
  assert.equal(contract.status, "DORMANT_DISCONNECTED");
  assert.equal(contract.runtimeIntegrationAuthorized, false);
  assert.deepEqual(contract.operationalRouteIqActions, []);
  assert.equal(contract.activationRequiresSeparateGovernedAuthorization, true);
});

test("inactive Companion cannot cross tenants or claim an action completed", () => {
  assert.equal(contract.crossTenantToolAccessAllowed, false);
  assert.equal(contract.inactiveActionCompletionClaimAllowed, false);
  assert.equal(contract.adviceOnlyWhenInactive, true);
  assert.equal(contract.requiredInactiveOutcome, "NO_ACTION_PERFORMED");
});

test("accepted Companion shell and runtime have no production Route IQ endpoint", () => {
  const acceptedSource = [swiftShell, companionInfo, companionRuntime, companionRouter].join("\n");
  const urls = acceptedSource.match(/https?:\/\/[^\s"')]+/gu) || [];
  assert.ok(urls.length > 0, "Expected the accepted localhost Companion endpoints to remain explicit.");
  for (const value of urls) {
    const host = new URL(value.replace(/[>,.;]+$/u, "")).hostname;
    assert.ok(
      ["127.0.0.1", "localhost"].includes(host)
        || value === "http://www.apple.com/DTDs/PropertyList-1.0.dtd",
      `Unexpected Companion network host: ${host}`
    );
  }
  assert.doesNotMatch(acceptedSource, /\/api\/dashboard\/route-iq|prometheus-iq\.[a-z0-9.-]*workers\.dev/iu);
});

test("Companion tool inventory has no tenant action or customer mutation binding", () => {
  const toolNames = Object.keys(agentTools);
  assert.ok(toolNames.length > 0);
  for (const toolName of toolNames) {
    assert.doesNotMatch(toolName, /(tenant|workspace).*(read|write|switch|tool)|(?:activate|provision|suspend|delete).*(customer|provider|billing)|(?:customer|provider|billing).*(activate|provision|suspend|delete)/iu);
  }
});

test("private Worker has no Companion import, route, launch, or runtime linkage", () => {
  assert.doesNotMatch(privateWorker, /companion|PrometheusCompanion|prometheus-os/iu);
});

test("hostile Companion commands remain blocked or approval-gated and cannot claim completion", () => {
  const cases = [
    ["delete files", PermissionLevel.BLOCKED],
    ["print api token", PermissionLevel.BLOCKED],
    ["deploy Route IQ to production", PermissionLevel.APPROVAL_REQUIRED],
    ["modify Route IQ", PermissionLevel.APPROVAL_REQUIRED],
    ["change production provider configuration", PermissionLevel.APPROVAL_REQUIRED]
  ];
  for (const [command, expected] of cases) {
    assert.equal(classifyPermission(command), expected, command);
    const result = runAgentTool("nonexistent-route-iq-action", command);
    assert.equal(result.permissionLevel, expected);
    assert.match(result.body, /blocked|approval required|not execute/iu);
    assert.doesNotMatch(result.body, /completed|activated|deployed successfully|mutation succeeded/iu);
  }
});
