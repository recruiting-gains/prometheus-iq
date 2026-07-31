import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor
} from "./verify-overwatch-public-deployment-workflow-v2.mjs";
import {
  hasFullSystemHarmonyPackageWiringSuccessor
} from "./verify-overwatch-cloudflare-founder-attended-service-token.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath = "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.json";
const governanceDocumentationPath = "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.md";
const reportPath = "overwatch/reports/BATCH-20260715-001-cloudflare-founder-attended-real-macos-tty-compatibility.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const responseContractGovernancePath =
  "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json";
const createReceiptV2GovernancePath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const keychainInteroperabilityGovernancePath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const githubDeploymentGovernancePath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const routeIq3dGovernancePath =
  "overwatch/governance/route-iq-3d-visual-continuity-v1.json";
const fullSystemHarmonyGovernancePath =
  "overwatch/governance/full-system-harmony-audit-v1.json";
const controlledRehearsalPackageSha256 =
  "8a2d68b09248fc561ade94744b4fd5a6b11dfdd3b49e7fd4895ee8b1ee1e547a";
const ownerCommit = "1853c6343090ed3430f7ba03a089f1008a12436c";
const ownerParent = "1a1a6143366175accb12752a095d11a39566bb90";
const ownerTree = "3936f8950d7884ad3358e5ba5b67a472e6afef97";

const expectedOwnerPaths = Object.freeze([
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
  "scripts/lib/cloudflare-founder-attended-tty.mjs",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs",
  "tests/cloudflare-founder-attended-service-token.test.mjs",
  "tests/fixtures/cloudflare-founder-attended-tty-macos-pty-child.mjs",
  "tests/fixtures/cloudflare-founder-attended-tty-macos-pty.expect"
]);
const expectedOwnerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-service-token-provisioning-v1.md": "9c7f700706b2f38a8273239eb4000271f1b5a1f481b3f2b670003ad4ecb6feb5",
  "scripts/lib/cloudflare-founder-attended-tty.mjs": "9f802314ca0084b884147f40856b6095828b283a5b0d28a918d6eaa80a6fac24",
  "scripts/verify-cloudflare-founder-attended-service-token.mjs": "929930cedf9c64651d86fa9b1089ed14c06973335ef39f8d3fdd6e976ecd37f3",
  "tests/cloudflare-founder-attended-service-token.test.mjs": "05ab27c49a5d629bfb556944081893b23fd3c4c3a247565a8ed02c6440fb496b",
  "tests/fixtures/cloudflare-founder-attended-tty-macos-pty-child.mjs": "954b98c0ccb0bcf9c5cc3c73d12c06f107854a4400e212c96a0fd482d5d0cd00",
  "tests/fixtures/cloudflare-founder-attended-tty-macos-pty.expect": "8db761ec5f2e8ab9723b5ff0f5b4d3d0868f39e718871c9ea7e77ec205d85f9d"
});

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

export function evaluateFounderAttendedTtyCompatibilityGovernance({ governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId === "cloudflare-founder-attended-real-macos-tty-compatibility-repair-governance-v1", "Governance ID drifted.");
  require(governance.version === "1.0.0", "Governance version drifted.");
  require(governance.batchId === "BATCH-20260715-001", "Batch ID drifted.");
  require(governance.status === "OWNER_IMPLEMENTATION_VERIFIED_NOT_EXECUTED", "Governance status drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.dispatchAudit?.implementationOwner === "Prometheus Infrastructure", "Implementation owner drifted.");
  require(governance.dispatchAudit?.verificationOwner === "Prometheus Overwatch", "Verification owner drifted.");
  require(governance.dispatchAudit?.implementationOwnershipRespected === true, "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit?.overwatchModifiedSubsystemImplementation === false, "Overwatch crossed the implementation boundary.");
  require(governance.dispatchAudit?.implementationCommit?.commit === ownerCommit, "Owner commit drifted.");
  require(governance.dispatchAudit?.implementationCommit?.parent === ownerParent, "Owner parent drifted.");
  require(governance.dispatchAudit?.implementationCommit?.tree === ownerTree, "Owner tree drifted.");
  require(equal(governance.infrastructureOwnerEvidence?.map(item => item.path), expectedOwnerPaths), "Owner evidence path set drifted.");
  require(governance.infrastructureOwnerEvidence?.every(item =>
    expectedOwnerHashes[item.path] === item.sha256AtOwnerCommit
  ), "Owner evidence hash mapping drifted.");

  const repair = governance.defectAndRepair || {};
  for (const field of [
    "stdinIsTtyRequired",
    "stdoutIsTtyRequired",
    "stdinCharacterDeviceRequired",
    "stdoutCharacterDeviceRequired",
    "stdinAndStdoutConcreteDeviceEqualityRequired",
    "controllingTtyOpenedWithReadWriteNoFollowNoCtty",
    "controllingTtyCharacterDeviceRequired",
    "promptAndResponseUseControllingTtyOnly",
    "exactConfirmationRequired",
    "confirmationPrecedesKeychainControlNetworkAndDownstreamActivity"
  ]) {
    require(repair[field] === true, `Repair invariant ${field} drifted.`);
  }
  require(repair.controllingTtyAliasRdevComparedToConcreteTerminal === false, "The invalid alias rdev comparison returned.");
  require(repair.maximumConfirmationBytes === 192, "Confirmation byte ceiling drifted.");
  require(repair.productionBypassAdded === false, "A production bypass was added.");
  require(repair.alternateAttendanceMethodAdded === false, "An alternate attendance method was added.");

  const verification = governance.independentVerification || {};
  require(verification.ownerFocusedTests === "91/91_PASS_ZERO_SKIPS", "Owner test evidence drifted.");
  require(verification.realMacOsPtyIntegration === "PASS", "Real macOS PTY evidence is not passing.");
  require(verification.aliasRdevDifferenceObserved === true, "Alias rdev variance was not observed.");
  require(verification.stdinStdoutConcreteRdevEqualityObserved === true, "Concrete stream equality was not observed.");
  require(verification.rejectedCasesHaveZeroKeychainReads === true, "Rejected paths may read Keychain values.");
  require(verification.rejectedCasesHaveZeroControlWrites === true, "Rejected paths may write controls.");
  require(verification.rejectedCasesHaveZeroNetworkCalls === true, "Rejected paths may call the network.");

  for (const [field, expected] of Object.entries({
    cloudflareAccessPerformed: false,
    realKeychainValuesAccessed: false,
    credentialCreatedOrRevoked: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) {
    require(governance.executionBoundary?.[field] === expected, `Execution boundary ${field} drifted.`);
  }
  require(governance.releaseBoundary?.deploymentAuthorized === false, "Deployment became authorized.");
  require(governance.releaseBoundary?.productionExecutionAuthorized === false, "Production execution became authorized.");
  require(governance.releaseBoundary?.temporaryProvisioningTokenChanged === false, "The temporary provisioning token changed.");

  require(report.batchId === "BATCH-20260715-001", "Report batch ID drifted.");
  require(report.owners?.implementation === "Prometheus Infrastructure", "Report implementation owner drifted.");
  require(report.owners?.verification === "Prometheus Overwatch", "Report verification owner drifted.");
  require(report.owners?.implementationCommit === ownerCommit, "Report owner commit drifted.");
  require(report.owners?.ownershipRespected === true, "Report does not affirm ownership.");
  require(report.owners?.overwatchModifiedInfrastructureImplementation === false, "Report claims an ownership violation.");
  require(report.verificationAtOwnerHandoff?.infrastructureFocusedTests === "91/91_PASS_ZERO_SKIPS", "Report owner tests drifted.");
  require(report.verificationAtOwnerHandoff?.realMacOsPtyIntegration === "PASS", "Report PTY result drifted.");
  require(report.verificationAtOwnerHandoff?.rejectedPathExternalActivity === "ZERO", "Report rejected-path activity drifted.");
  require(report.boundaries?.credentialCreatedOrRevoked === false, "Report claims credential activity.");
  require(report.boundaries?.temporaryProvisioningTokenChanged === false, "Report claims the temporary token changed.");
  require(report.boundaries?.deploymentPerformed === false, "Report claims deployment.");
  require(report.boundaries?.productionMutationPerformed === false, "Report claims production mutation.");
  require(report.boundaries?.prospectiveCollection === "OFF", "Report claims collection activation.");
  require(report.boundaries?.cohortActivation === "OFF", "Report claims cohort activation.");
  require(report.boundaries?.recommendationInfluence === "OFF", "Report claims recommendation influence.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerCommit(governance) {
  const keychainOwnerGovernance = readJson(
    keychainInteroperabilityGovernancePath
  );
  const keychainOwnerSuccessors = new Map(
    keychainOwnerGovernance.ownerImplementationSuccessors
      .map(item => [item.path, item])
  );
  const metadata = git(["show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", ownerCommit]).split("\n");
  if (!equal(metadata, [
    ownerCommit,
    ownerParent,
    ownerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Repair founder-attended macOS TTY compatibility"
  ])) {
    throw new Error("Infrastructure owner commit metadata drifted.");
  }
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit]).split("\n");
  if (!equal(changed, expectedOwnerPaths)) throw new Error("Infrastructure owner commit file set drifted.");
  if (changed.some(path => path.startsWith("overwatch/")
    || path === "package.json"
    || path === "wrangler.jsonc"
    || path.startsWith("workers/")
    || path === "index.html")) {
    throw new Error("Infrastructure owner commit crossed a governance or production boundary.");
  }

  for (const evidence of governance.infrastructureOwnerEvidence) {
    const committed = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${evidence.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(committed) !== evidence.sha256AtOwnerCommit) {
      throw new Error(`Owner evidence hash drifted: ${evidence.path}`);
    }
    const current = sha256(readFileSync(resolve(root, evidence.path)));
    const successor = keychainOwnerSuccessors.get(evidence.path);
    const accepted = current === evidence.sha256AtOwnerCommit
      || (successor?.previousSha256 === evidence.sha256AtOwnerCommit
        && successor?.successorSha256 === current
        && successor?.owner === "Prometheus Infrastructure");
    if (!accepted) {
      throw new Error(`Owner implementation changed after handoff: ${evidence.path}`);
    }
  }

  const transitionByPath = new Map(
    governance.protectedPredecessorSuccessors
      .filter(item => item.predecessorGovernanceId === "cloudflare-founder-attended-service-token-provisioning-governance-v1")
      .map(item => [item.path, item])
  );
  for (const path of [
    "docs/cloudflare-founder-attended-service-token-provisioning-v1.md",
    "scripts/lib/cloudflare-founder-attended-tty.mjs",
    "scripts/verify-cloudflare-founder-attended-service-token.mjs",
    "tests/cloudflare-founder-attended-service-token.test.mjs"
  ]) {
    const transition = transitionByPath.get(path);
    const historical = execFileSync("/usr/bin/git", ["show", `${ownerParent}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (!transition
      || sha256(historical) !== transition.historicalSha256
      || expectedOwnerHashes[path] !== transition.successorSha256) {
      throw new Error(`Protected predecessor transition drifted: ${path}`);
    }
  }

  const packageTransitions = governance.protectedPredecessorSuccessors.filter(item => item.path === "package.json");
  const currentPackageHash = sha256(read("package.json"));
  const recoveryGovernance = readJson(
    "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.json"
  );
  const recoveryPackage = recoveryGovernance.protectedReleaseWiringTransitions?.find(item =>
    item.path === "package.json"
  );
  const responseContractGovernance = readJson(responseContractGovernancePath);
  const responseContractPackage =
    responseContractGovernance.protectedReleaseWiringTransitions?.find(item =>
      item.path === "package.json"
    );
  const createReceiptV2Governance = readJson(createReceiptV2GovernancePath);
  const createReceiptV2Package =
    createReceiptV2Governance.protectedReleaseWiringTransitions?.find(item =>
      item.path === "package.json"
    );
  const keychainInteroperabilityGovernance = readJson(keychainInteroperabilityGovernancePath);
  const keychainPackage =
    keychainInteroperabilityGovernance.protectedReleaseWiringTransitions?.find(item =>
      item.path === "package.json"
    );
  const githubDeploymentGovernance = readJson(githubDeploymentGovernancePath);
  const githubDeploymentPackage =
    githubDeploymentGovernance.protectedReleaseWiringTransitions?.find(item =>
      item.path === "package.json"
    );
  const routeIq3dGovernance = readJson(routeIq3dGovernancePath);
  const routeIq3dPackage =
    routeIq3dGovernance.protectedReleaseWiringTransitions?.find(item =>
      item.path === "package.json"
    );
  const founderPackage = packageTransitions.find(item =>
    item.predecessorGovernanceId === "cloudflare-founder-attended-service-token-provisioning-governance-v1"
  );
  const unattendedPackage = packageTransitions.find(item =>
    item.predecessorGovernanceId === "cloudflare-unattended-deployment-access-governance-v1"
  );
  if (!founderPackage
    || founderPackage.historicalSha256 !== "50070d78fa9446c10c8309466ec5f51678d1646bdec2f2799284b87f0d1073b0"
    || founderPackage.successorSha256 !== recoveryPackage?.previousSha256
    || !unattendedPackage
    || unattendedPackage.historicalSha256 !== "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d"
    || unattendedPackage.successorSha256 !== recoveryPackage?.previousSha256
    || recoveryPackage.successorSha256 !== responseContractPackage?.previousSha256
    || recoveryPackage.owner !== "Prometheus Overwatch"
    || responseContractPackage?.successorSha256 !== createReceiptV2Package?.previousSha256
    || createReceiptV2Package?.successorSha256 !== keychainPackage?.previousSha256
    || keychainPackage?.successorSha256 !== githubDeploymentPackage?.previousSha256
    || githubDeploymentPackage?.successorSha256 !== routeIq3dPackage?.previousSha256
    || !hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      predecessorGovernanceId: "route-iq-3d-visual-continuity-v1",
      historicalSha256: routeIq3dPackage?.successorSha256,
      successorSha256: controlledRehearsalPackageSha256
    })
    || !hasFullSystemHarmonyPackageWiringSuccessor({
      governance: readJson(fullSystemHarmonyGovernancePath),
      predecessorSha256: controlledRehearsalPackageSha256,
      successorSha256: currentPackageHash
    })
    || createReceiptV2Package?.owner !== "Prometheus Overwatch"
    || keychainPackage?.owner !== "Prometheus Overwatch"
    || githubDeploymentPackage?.owner !== "Prometheus Overwatch"
    || routeIq3dPackage?.owner !== "Prometheus Overwatch"
    || responseContractPackage?.owner !== "Prometheus Overwatch") {
    throw new Error("Protected package release-wiring transition drifted.");
  }
}

function verifyRepairSource() {
  const source = read("scripts/lib/cloudflare-founder-attended-tty.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-service-token-production.mjs");
  if (!/input\?\.isTTY !== true/u.test(source)
    || !/output\?\.isTTY !== true/u.test(source)
    || !/inputInfo\.isCharacterDevice\(\)/u.test(source)
    || !/outputInfo\.isCharacterDevice\(\)/u.test(source)
    || !/inputInfo\.rdev !== outputInfo\.rdev/u.test(source)
    || !/ttyInfo\.isCharacterDevice\(\)/u.test(source)
    || /ttyInfo\.rdev/u.test(source)
    || !/constants\.O_RDWR \| noFollow \| noControllingTty/u.test(source)
    || !/operations\.writeSync\(fd,/u.test(source)
    || !/operations\.readSync\(fd,/u.test(source)) {
    throw new Error("Repaired TTY source invariants drifted.");
  }
  if (!/confirmation: createControllingTtyConfirmation\(\)/u.test(production)
    || /createControllingTtyConfirmationTestOnly/u.test(production)) {
    throw new Error("Production attendance composition drifted.");
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item =>
    item.artifactId === "cloudflare-founder-attended-real-macos-tty-compatibility-repair-governance-v1"
  );
  if (matches.length !== 1 || !equal(matches[0], {
    artifactId: "cloudflare-founder-attended-real-macos-tty-compatibility-repair-governance-v1",
    artifactType: "overwatch_infrastructure_attended_tty_compatibility_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedRealMacOsTtyCompatibilityRepairGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  })) {
    throw new Error("Canonical TTY repair governance registration drifted.");
  }
}

function verifyReleaseWiring() {
  const packageJson = readJson("package.json");
  const command = "node scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs && node --test tests/overwatch-cloudflare-founder-attended-tty-compatibility.test.mjs";
  if (packageJson.scripts["overwatch:cloudflare-founder-attended-tty:check"] !== command
    || !packageJson.scripts["test:overwatch"].includes("tests/overwatch-cloudflare-founder-attended-tty-compatibility.test.mjs")
    || !packageJson.scripts.test.includes("overwatch:cloudflare-founder-attended-tty:check")) {
    throw new Error("TTY repair release wiring drifted.");
  }
  if (/wrangler\s+deploy|\bcurl\b|https:\/\/|provision-attended|cleanup-temp/u.test(command)) {
    throw new Error("TTY repair release gate contains an external-action command.");
  }
}

export function verifyOverwatchFounderAttendedTtyCompatibility() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluated = evaluateFounderAttendedTtyCompatibilityGovernance({ governance, report });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  verifyOwnerCommit(governance);
  verifyRepairSource();
  verifyCanonicalRegistration();
  verifyReleaseWiring();
  if (scanTrackedRepository({ root }).length !== 0) throw new Error("Tracked secret findings detected.");
  if (verifyLocalSecretArtifacts({ root }).length !== 0) throw new Error("Local secret artifact protection failed.");
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-001",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: ownerCommit,
    focusedOwnerTests: 91,
    macOsPtyIntegration: "PASS",
    rejectedPathExternalActivity: 0,
    cloudflareAccessPerformed: false,
    realKeychainValuesAccessed: false,
    credentialCreatedOrRevoked: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(JSON.stringify(verifyOverwatchFounderAttendedTtyCompatibility(), null, 2));
}
