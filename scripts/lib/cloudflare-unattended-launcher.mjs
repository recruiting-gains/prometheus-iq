import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  KEYCHAIN_ITEMS
} from "../check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_UNATTENDED_CONTROL_PATH,
  consumeFounderControlFile,
  inspectFounderControlFile
} from "./cloudflare-unattended-control.mjs";
import {
  fixedCloudflareUnattendedSmokePlan
} from "../run-cloudflare-unattended-smoke.mjs";

export const CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES = Object.freeze([
  "presence",
  "smoke-dry-run",
  "smoke-read-only",
  "deployment-release"
]);

const SAFE_ENVIRONMENT_NAMES = Object.freeze([
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "SHELL"
]);

const DEPLOYMENT_CREDENTIALS = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID"
]);
const SMOKE_CREDENTIALS = Object.freeze([
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);

function itemFor(name) {
  const item = KEYCHAIN_ITEMS.find(candidate => candidate.account === name);
  if (!item) throw new Error(`keychain_item_not_registered:${name}`);
  return item;
}

export function createMacOsKeychainAdapter({ spawnSyncImpl = spawnSync } = {}) {
  return Object.freeze({
    hasItem(item) {
      const result = spawnSyncImpl(
        "/usr/bin/security",
        ["find-generic-password", "-s", item.service, "-a", item.account],
        { stdio: "ignore" }
      );
      return !result.error && result.status === 0;
    },
    readItem(item) {
      const result = spawnSyncImpl(
        "/usr/bin/security",
        ["find-generic-password", "-w", "-s", item.service, "-a", item.account],
        {
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          stdio: ["ignore", "pipe", "ignore"]
        }
      );
      const value = typeof result.stdout === "string" ? result.stdout.replace(/\r?\n$/u, "") : "";
      if (result.error || result.status !== 0 || !value) throw new Error(`keychain_item_unavailable:${item.account}`);
      return value;
    }
  });
}

function repositoryIdentity(root, execFile = execFileSync) {
  const run = args => execFile("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  return Object.freeze({
    commit: run(["rev-parse", "HEAD"]),
    tree: run(["rev-parse", "HEAD^{tree}"]),
    clean: run(["status", "--porcelain=v1", "--untracked-files=all"]) === ""
  });
}

function safeChildEnvironment(source, credentials) {
  const env = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" };
  for (const name of SAFE_ENVIRONMENT_NAMES) {
    if (typeof source?.[name] === "string") env[name] = source[name];
  }
  for (const [name, value] of Object.entries(credentials)) env[name] = value;
  return env;
}

function readCredentials(names, keychain) {
  const credentials = {};
  for (const name of names) credentials[name] = keychain.readItem(itemFor(name));
  return credentials;
}

function presence(names, keychain) {
  return names.map(name => Object.freeze({
    name,
    present: Boolean(keychain.hasItem(itemFor(name)))
  }));
}

function fixedCommands(root) {
  const expectedWrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const linkedWrangler = realpathSync(resolve(root, "node_modules/.bin/wrangler"));
  const wrangler = realpathSync(expectedWrangler);
  if (linkedWrangler !== wrangler || wrangler !== expectedWrangler || !statSync(wrangler).isFile()) {
    throw new Error("pinned_wrangler_executable_invalid");
  }
  const smoke = resolve(root, "scripts/run-cloudflare-unattended-smoke.mjs");
  return Object.freeze({
    deploymentDryRun: Object.freeze({
      name: "private_worker_deployment_dry_run",
      executable: process.execPath,
      args: Object.freeze([wrangler, "deploy", "--dry-run", "--config", "wrangler.jsonc", "--keep-vars"]),
      credentialNames: DEPLOYMENT_CREDENTIALS
    }),
    deployment: Object.freeze({
      name: "private_worker_deployment",
      executable: process.execPath,
      args: Object.freeze([wrangler, "deploy", "--config", "wrangler.jsonc", "--keep-vars"]),
      credentialNames: DEPLOYMENT_CREDENTIALS
    }),
    smoke: Object.freeze({
      name: "private_worker_read_only_smoke",
      executable: process.execPath,
      args: Object.freeze([smoke, "--execute-fixed-profile"]),
      credentialNames: SMOKE_CREDENTIALS
    })
  });
}

function runFixedChild(command, credentials, {
  root,
  environment,
  spawnChild
}) {
  const result = spawnChild(command.executable, [...command.args], {
    cwd: root,
    env: safeChildEnvironment(environment, credentials),
    stdio: "ignore"
  });
  if (result?.error || result?.status !== 0) throw new Error(`fixed_child_profile_failed:${command.name}`);
  return Object.freeze({ name: command.name, status: "passed" });
}

export function runCloudflareUnattendedLauncher({
  profile,
  root = resolve(import.meta.dirname, "../.."),
  controlPath = CLOUDFLARE_UNATTENDED_CONTROL_PATH,
  now = new Date(),
  environment = process.env,
  keychain = createMacOsKeychainAdapter(),
  spawnChild = spawnSync,
  execFile = execFileSync
} = {}) {
  if (!CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES.includes(profile)) {
    throw new Error("launcher_profile_invalid");
  }
  if (profile === "presence") {
    return Object.freeze({
      status: "checked",
      profile,
      controlConsumed: false,
      credentials: Object.freeze(presence([...DEPLOYMENT_CREDENTIALS, ...SMOKE_CREDENTIALS], keychain))
    });
  }
  if (profile === "smoke-dry-run") {
    return Object.freeze({
      status: "dry_run",
      profile,
      controlConsumed: false,
      requests: fixedCloudflareUnattendedSmokePlan()
    });
  }

  const requiredCredentials = profile === "deployment-release"
    ? [...DEPLOYMENT_CREDENTIALS, ...SMOKE_CREDENTIALS]
    : [...SMOKE_CREDENTIALS];
  const credentialPresence = presence(requiredCredentials, keychain);
  if (credentialPresence.some(entry => !entry.present)) throw new Error("required_keychain_item_absent");

  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const expectedDirectiveId = environment?.PROMETHEUS_FOUNDER_DEPLOYMENT_DIRECTIVE_ID;
  if (!/^FOUNDER-[A-Z0-9][A-Z0-9._:-]{5,127}$/u.test(expectedDirectiveId || "")) {
    throw new Error("founder_directive_context_missing_or_invalid");
  }
  const inspected = inspectFounderControlFile({
    controlPath,
    now,
    expectedCommit: identity.commit,
    expectedTree: identity.tree,
    expectedDirectiveId
  });
  if (!inspected.valid) throw new Error(`founder_control_denied:${inspected.reasons.join(",")}`);
  const consumed = consumeFounderControlFile({
    controlPath,
    now,
    expectedCommit: identity.commit,
    expectedTree: identity.tree,
    expectedDirectiveId
  });
  const commands = fixedCommands(root);
  const results = [];

  if (profile === "deployment-release") {
    const deploymentCredentials = readCredentials(DEPLOYMENT_CREDENTIALS, keychain);
    results.push(runFixedChild(commands.deploymentDryRun, deploymentCredentials, {
      root,
      environment,
      spawnChild
    }));
    const afterDryRun = repositoryIdentity(root, execFile);
    if (!afterDryRun.clean
      || afterDryRun.commit !== identity.commit
      || afterDryRun.tree !== identity.tree) {
      throw new Error("repository_changed_after_deployment_dry_run");
    }
    results.push(runFixedChild(commands.deployment, deploymentCredentials, {
      root,
      environment,
      spawnChild
    }));
  }

  const smokeCredentials = readCredentials(SMOKE_CREDENTIALS, keychain);
  results.push(runFixedChild(commands.smoke, smokeCredentials, {
    root,
    environment,
    spawnChild
  }));
  return Object.freeze({
    status: "passed",
    profile,
    targetWorker: consumed.control.targetWorker,
    authorizedCommit: consumed.control.authorizedCommit,
    authorizedTree: consumed.control.authorizedTree,
    founderDirectiveId: consumed.control.founderDirectiveId,
    controlConsumed: true,
    commands: Object.freeze(results)
  });
}
