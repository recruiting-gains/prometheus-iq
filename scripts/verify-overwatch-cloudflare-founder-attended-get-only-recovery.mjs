import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor
} from "./verify-overwatch-public-deployment-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.md";
const reportPath =
  "overwatch/reports/BATCH-20260715-002-cloudflare-founder-attended-get-only-recovery.json";
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
const ownerCommit = "43eee7a13bb2f826c4ac750298d9e87dd28f4976";
const ownerParent = "89267707a3a62b2e3d61897476e4dda7adf95987";
const ownerTree = "79b2ce3883160e95fdeb4f0985689fa77f50cf6b";

const expectedOwnerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-get-only-recovery-v1.md":
    "01d56aeb3d644291c0197062ab1a14c13393e15b25411aad8475c8ee9d23b68d",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-command.mjs":
    "b9ab64537759affdfca2500219329c05b536c739574716e82ca8e447437a882c",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic-production.mjs":
    "230214dd395fb11a864c42357c8faa5a282ce51f19ae7aeb4bb372eb37f1e96a",
  "scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs":
    "7a6685093f14e192b1e65b9318bfbee35a34f4997b8f05db166a604bcf872c20",
  "scripts/lib/cloudflare-founder-attended-get-only-recovery-constants.mjs":
    "be773d044ba9ce34ea688e305c4963a75934a854160b65bdffa5f7b23a38e721",
  "scripts/lib/cloudflare-founder-attended-recovery-control-command.mjs":
    "d6575442ca04d59d550aacda49159c7d8922b6b0ad57e6bc5450215db424be2d",
  "scripts/lib/cloudflare-founder-attended-recovery-control-production.mjs":
    "15642b779e7bab5d144542e1a0d812d4f7c0aaf0d1924d8d56dfee25a892bb3a",
  "scripts/lib/cloudflare-founder-attended-recovery-control.mjs":
    "cfff45118d98d510815737ec52d351a05c425b53889bf4edbf740d0ae56a12d1",
  "scripts/lib/cloudflare-founder-attended-recovery-provisioning-production.mjs":
    "19c1022f5359b07f1e3ff1340bcd3d25e49c6366f4f7a29fd6d55c971a584104",
  "scripts/lib/cloudflare-founder-attended-recovery-provisioning.mjs":
    "e39bc50fbc80532016b4c2e8bc146f81540123dd5a23b4667c0f8fc29b765f6b",
  "scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs":
    "3e67ab7d0f1a8b138325f92de17101d3304207b84e2c8fcc827174e9a908989b",
  "scripts/run-cloudflare-founder-attended-prepare-recovery.mjs":
    "3e60b52951f0a16dca48a9c391b11009fbf8cb7b500874957896715c9a00cecc",
  "scripts/run-cloudflare-founder-attended-successor-recovery.mjs":
    "8ccff1f6bbb672a502a4a476f44b449b45bd5aef087ca4b0c91959065a915bd8",
  "scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs":
    "e773ad7275dda611252001d86ba04a844728663d0f8fc2cb88cda85b07f45655",
  "tests/cloudflare-founder-attended-get-only-recovery.test.mjs":
    "27f2bae0e6530f0aab382ed7c9710312297a97e449362d8aea67584c344db9ec",
  "workers/infrastructure/cloudflare-founder-attended-get-only-recovery-v1.json":
    "f8d2e60c2f572d973b127ea238fad27bf4a8d2be23d4665966ca9f58542b17f6"
});
const expectedOwnerPaths = Object.freeze(Object.keys(expectedOwnerHashes));
const fixedClassifications = Object.freeze([
  "LIVE_STATE_FAILED",
  "NETWORK_FAILED",
  "AUTHORIZATION_DENIED",
  "VALID_EMPTY_RESULT",
  "DUPLICATE_FOUND",
  "RESPONSE_CONTRACT_MISMATCH",
  "SAFE_TO_PREPARE_RECOVERY"
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

export function evaluateFounderAttendedGetOnlyRecoveryGovernance({ governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-founder-attended-get-only-recovery-governance-v1", "Governance ID drifted.");
  require(governance.version === "1.0.0", "Governance version drifted.");
  require(governance.batchId === "BATCH-20260715-002", "Batch ID drifted.");
  require(governance.status ===
    "OWNER_IMPLEMENTATION_VERIFIED_LIVE_DIAGNOSTIC_NOT_EXECUTED", "Governance status drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.dispatchAudit?.implementationOwner === "Prometheus Infrastructure",
    "Implementation owner drifted.");
  require(governance.dispatchAudit?.verificationOwner === "Prometheus Overwatch",
    "Verification owner drifted.");
  require(governance.dispatchAudit?.implementationOwnershipRespected === true,
    "Implementation ownership is not affirmed.");
  require(governance.dispatchAudit?.overwatchModifiedSubsystemImplementation === false,
    "Overwatch crossed the implementation boundary.");
  require(governance.dispatchAudit?.implementationCommit?.commit === ownerCommit,
    "Owner commit drifted.");
  require(governance.dispatchAudit?.implementationCommit?.parent === ownerParent,
    "Owner parent drifted.");
  require(governance.dispatchAudit?.implementationCommit?.tree === ownerTree,
    "Owner tree drifted.");
  require(equal(governance.infrastructureOwnerEvidence?.map(item => item.path), expectedOwnerPaths),
    "Owner evidence path set drifted.");
  require(governance.infrastructureOwnerEvidence?.every(item =>
    expectedOwnerHashes[item.path] === item.sha256AtOwnerCommit), "Owner hash mapping drifted.");
  require(equal(governance.protectedReleaseWiringTransitions, [{
    path: "package.json",
    previousSha256: "349ee1e54aec072348d58adc52f400d7c78176543d30cd92ec00831c110031cf",
    successorSha256: "2e77437c484eb4a39816857e93e3f503a057c3731e79f9015e59c2d4d6524199",
    owner: "Prometheus Overwatch",
    reason: "Register the independent GET-only recovery governance gate in the complete repository suite."
  }]), "Protected release-wiring transition drifted.");
  require(equal(governance.protectedPredecessorSuccessors, [{
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "package.json",
    historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
    successorSha256: "2e77437c484eb4a39816857e93e3f503a057c3731e79f9015e59c2d4d6524199",
    reason: "Carry the protected unattended-access package baseline through the new Overwatch release gate."
  }]), "Protected unattended-access successor mapping drifted.");

  const prior = governance.priorInvocationFinding || {};
  require(prior.classification === "PRE_CREATE_FAIL_CLOSED", "Prior classification drifted.");
  require(prior.creationPostAttempts === 0, "Prior invocation may have attempted creation.");
  require(prior.predecessorControlAndReceiptImmutable === true,
    "Predecessor evidence is not immutable.");
  require(prior.providerFailureClassification ===
    "PENDING_ONE_AUTHORIZED_ATTENDED_GET_ONLY_DIAGNOSTIC",
  "Provider cause was improperly inferred.");
  require(prior.providerFailureMustNotBeInferredBeforeDiagnostic === true,
    "Provider cause may be inferred without the diagnostic.");

  const diagnostic = governance.diagnosticBoundary || {};
  require(equal(diagnostic.providerMethodsAllowed, ["GET"]), "Diagnostic method widened.");
  require(diagnostic.fixedExactAccount === true, "Diagnostic account is not fixed.");
  require(diagnostic.fixedServiceTokenName ===
    "Prometheus Overwatch Read-Only Smoke Verification", "Diagnostic name drifted.");
  for (const field of [
    "resultOptional",
    "resultInfoOptional",
    "resultInfoMembersOptional",
    "validEmptyResultAccepted",
    "totalCountTreatedAsUnfilteredInventoryMetadata",
    "exactNameDuplicateFailsClosed"
  ]) require(diagnostic[field] === true, `Diagnostic invariant ${field} drifted.`);
  for (const field of [
    "requestBodyAllowed",
    "redirectFollowingAllowed",
    "automaticRetryAllowed",
    "productionExecutionCompleted",
    "secretOrIdentifierOutputAllowed"
  ]) require(diagnostic[field] === false, `Diagnostic boundary ${field} drifted.`);
  require(equal(diagnostic.allowedOutput, fixedClassifications), "Diagnostic output widened.");

  const recovery = governance.recoveryBoundary || {};
  for (const field of [
    "successorControlUsesNewPath",
    "requiresSuccessfulExactNameAbsenceEvidence",
    "requiresNativeControllingTty",
    "requiresExactFounderPhrase",
    "requiresCurrentCleanCommitAndTree",
    "requiresFreshNonce"
  ]) require(recovery[field] === true, `Recovery invariant ${field} drifted.`);
  for (const field of [
    "predecessorControlReuseAllowed",
    "predecessorReceiptReuseAllowed",
    "preparationProviderNetworkAllowed",
    "preparationProviderWriteAllowed",
    "futureProvisioningAuthorizedByDirective",
    "futureAutomaticRetryAllowed",
    "temporaryTokenDeletionAllowed"
  ]) require(recovery[field] === false, `Recovery boundary ${field} drifted.`);
  require(recovery.futureCreateAttemptsMaximum === 1, "Future create-attempt ceiling drifted.");

  for (const [field, expected] of Object.entries({
    deploymentPerformed: false,
    productionMutationPerformed: false,
    credentialCreatedOrDeleted: false,
    temporaryProvisioningTokenChanged: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) require(governance.executionBoundary?.[field] === expected,
    `Execution boundary ${field} drifted.`);
  require(governance.releaseBoundary?.deploymentAuthorized === false,
    "Deployment became authorized.");
  require(governance.releaseBoundary?.cloudflareWriteAuthorized === false,
    "A Cloudflare write became authorized.");

  require(report.batchId === "BATCH-20260715-002", "Report batch drifted.");
  require(report.owners?.implementation === "Prometheus Infrastructure",
    "Report implementation owner drifted.");
  require(report.owners?.verification === "Prometheus Overwatch",
    "Report verification owner drifted.");
  require(report.owners?.implementationCommit === ownerCommit, "Report owner commit drifted.");
  require(report.owners?.ownershipRespected === true, "Report ownership is not affirmed.");
  require(report.priorInvocation?.classification === "PRE_CREATE_FAIL_CLOSED",
    "Report prior classification drifted.");
  require(report.priorInvocation?.creationPostAttempts === 0,
    "Report claims a prior creation attempt.");
  require(report.boundaries?.cloudflareApiContacted === false,
    "Report claims Cloudflare contact.");
  require(report.boundaries?.temporaryProvisioningTokenChanged === false,
    "Report claims temporary-token mutation.");
  require(report.boundaries?.deploymentPerformed === false, "Report claims deployment.");
  require(report.boundaries?.productionMutationPerformed === false,
    "Report claims production mutation.");
  require(report.boundaries?.recommendationInfluence === "OFF",
    "Report claims recommendation influence.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerCommit(governance) {
  const responseContractGovernance = readJson(responseContractGovernancePath);
  const successorByPath = new Map(
    responseContractGovernance.protectedPredecessorSuccessors
      .filter(item => item.predecessorGovernanceId ===
        "cloudflare-founder-attended-get-only-recovery-governance-v1")
      .map(item => [item.path, item])
  );
  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", ownerCommit
  ]).split("\n");
  if (!equal(metadata, [
    ownerCommit,
    ownerParent,
    ownerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Add attended Cloudflare GET-only recovery gate"
  ])) throw new Error("Infrastructure owner commit metadata drifted.");
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit])
    .split("\n");
  if (!equal(changed, expectedOwnerPaths)) throw new Error("Owner commit file set drifted.");
  if (changed.some(path => path.startsWith("overwatch/") || path === "package.json")) {
    throw new Error("Infrastructure owner commit crossed the Overwatch boundary.");
  }
  for (const evidence of governance.infrastructureOwnerEvidence) {
    const committed = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${evidence.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const current = sha256(readFileSync(resolve(root, evidence.path)));
    const successor = successorByPath.get(evidence.path);
    const currentAccepted = current === evidence.sha256AtOwnerCommit || (
      successor?.historicalSha256 === evidence.sha256AtOwnerCommit
      && successor?.successorSha256 === current
      && successor?.owner === "Prometheus Infrastructure"
    );
    if (sha256(committed) !== evidence.sha256AtOwnerCommit || !currentAccepted) {
      throw new Error(`Owner evidence drifted: ${evidence.path}`);
    }
  }
}

function verifyZeroPostProof() {
  const production = read("scripts/lib/cloudflare-founder-attended-service-token-production.mjs");
  const predecessor = read("scripts/lib/cloudflare-founder-attended-service-token.mjs");
  if (!/Founder-attended provisioning stopped\. Manual review is required\./u.test(production)
    || !/Founder-attended provisioning failed closed after confirmed compensation\./u.test(production)
    || !/Founder-attended Cloudflare operation failed closed\./u.test(production)
    || !/method: "GET"[\s\S]+assertNoRemoteDuplicate\(listResponse\)[\s\S]+method: "POST"/u
      .test(predecessor)
    || !/catch \{[\s\S]*CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR/u.test(predecessor)
    || !/remoteCreateAttempts: 1/u.test(predecessor)) {
    throw new Error("Predecessor zero-POST proof source drifted.");
  }
}

function verifyRepairSource() {
  const diagnostic = read("scripts/lib/cloudflare-founder-attended-get-only-diagnostic.mjs");
  const diagnosticProduction =
    read("scripts/lib/cloudflare-founder-attended-get-only-diagnostic-production.mjs");
  const preparationProduction =
    read("scripts/lib/cloudflare-founder-attended-recovery-control-production.mjs");
  const recovery = read("scripts/lib/cloudflare-founder-attended-recovery-provisioning.mjs");
  if (!/const GET_ONLY_METHOD = "GET"/u.test(diagnostic)
    || /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u.test(diagnostic)
    || !/result"\) \? envelope\.result : \[\]/u.test(diagnostic)
    || !/if \(!Object\.hasOwn\(envelope, "result_info"\)\)/u.test(diagnostic)
    || !/total_count as the inventory size without search/u.test(diagnostic)
    || !/DUPLICATE_FOUND/u.test(diagnostic)) {
    throw new Error("GET-only diagnostic source boundary drifted.");
  }
  if (!/createFounderAttendedGetOnlyCloudflareTransport\(\)/u.test(diagnosticProduction)
    || /recovery-provisioning/u.test(diagnosticProduction)
    || /createFounderAttendedCloudflareTransport/u.test(diagnosticProduction)) {
    throw new Error("Production diagnostic composition widened.");
  }
  if (/CloudflareTransport|httpsRequest|\.request\(/u.test(preparationProduction)) {
    throw new Error("Local successor preparation gained a provider transport.");
  }
  const createCalls = recovery.match(/method:\s*"POST"/gu) || [];
  if (createCalls.length !== 1
    || !/await listFounderAttendedExactServiceTokenNameGetOnly/u.test(recovery)
    || !/remoteCreateAttempts: 1/u.test(recovery)
    || /retry/u.test(recovery)) {
    throw new Error("Future one-POST/no-retry recovery boundary drifted.");
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item =>
    item.artifactId === "cloudflare-founder-attended-get-only-recovery-governance-v1");
  const expected = {
    artifactId: "cloudflare-founder-attended-get-only-recovery-governance-v1",
    artifactType: "overwatch_infrastructure_attended_get_only_recovery_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedGetOnlyRecoveryGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (matches.length !== 1 || !equal(matches[0], expected)) {
    throw new Error("Canonical recovery governance registration drifted.");
  }
}

function verifyReleaseWiring() {
  const packageJson = readJson("package.json");
  const responseContractGovernance = readJson(responseContractGovernancePath);
  const responseContractTransition = responseContractGovernance.protectedReleaseWiringTransitions?.find(
    item => item.path === "package.json"
  );
  const createReceiptV2Governance = readJson(createReceiptV2GovernancePath);
  const packageTransition = createReceiptV2Governance.protectedReleaseWiringTransitions?.find(
    item => item.path === "package.json"
  );
  const keychainInteroperabilityGovernance = readJson(keychainInteroperabilityGovernancePath);
  const keychainTransition =
    keychainInteroperabilityGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const githubDeploymentGovernance = readJson(githubDeploymentGovernancePath);
  const githubDeploymentTransition =
    githubDeploymentGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const routeIq3dGovernance = readJson(routeIq3dGovernancePath);
  const routeIq3dTransition =
    routeIq3dGovernance.protectedReleaseWiringTransitions?.find(
      item => item.path === "package.json"
    );
  const command = "node scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs && node --test tests/overwatch-cloudflare-founder-attended-get-only-recovery.test.mjs";
  if (packageJson.scripts["overwatch:cloudflare-founder-attended-recovery:check"] !== command
    || !packageJson.scripts["test:overwatch"]
      .includes("tests/overwatch-cloudflare-founder-attended-get-only-recovery.test.mjs")
    || !packageJson.scripts["test:overwatch"]
      .includes("tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs")
    || !packageJson.scripts["test:overwatch"]
      .includes("tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs")
    || !packageJson.scripts["test:overwatch"]
      .includes("tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs")
    || !packageJson.scripts.test
      .includes("overwatch:cloudflare-founder-attended-recovery:check")
    || !packageJson.scripts.test
      .includes("overwatch:cloudflare-founder-attended-response-contract:check")
    || !packageJson.scripts.test
      .includes("overwatch:cloudflare-founder-attended-create-receipt-v2:check")
    || !packageJson.scripts.test
      .includes("overwatch:cloudflare-unattended-keychain-interoperability:check")
    || responseContractTransition?.successorSha256 !== packageTransition?.previousSha256
    || packageTransition?.successorSha256 !== keychainTransition?.previousSha256
    || keychainTransition?.successorSha256 !== githubDeploymentTransition?.previousSha256
    || githubDeploymentTransition?.successorSha256 !== routeIq3dTransition?.previousSha256
    || !hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      predecessorGovernanceId: "route-iq-3d-visual-continuity-v1",
      historicalSha256: routeIq3dTransition?.successorSha256,
      successorSha256: sha256(read("package.json"))
    })
    || packageTransition?.owner !== "Prometheus Overwatch"
    || keychainTransition?.owner !== "Prometheus Overwatch"
    || githubDeploymentTransition?.owner !== "Prometheus Overwatch"
    || routeIq3dTransition?.owner !== "Prometheus Overwatch") {
    throw new Error("Recovery release wiring drifted.");
  }
  if (/wrangler|curl|https:\/\/|run-cloudflare-founder-attended|provision|cleanup/u.test(command)) {
    throw new Error("Recovery release gate contains an external-action command.");
  }
}

export function verifyOverwatchFounderAttendedGetOnlyRecovery() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const evaluated = evaluateFounderAttendedGetOnlyRecoveryGovernance({ governance, report });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  verifyOwnerCommit(governance);
  verifyZeroPostProof();
  verifyRepairSource();
  verifyCanonicalRegistration();
  verifyReleaseWiring();
  const repositoryFiles = git([
    "ls-files", "--cached", "--others", "--exclude-standard"
  ]).split("\n").filter(Boolean);
  const trackedFiles = [...new Set([...listTrackedFiles(root), ...repositoryFiles])];
  if (scanTrackedRepository({ root, trackedFiles }).length !== 0) {
    throw new Error("Tracked secret findings detected.");
  }
  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-002",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: ownerCommit,
    priorInvocationClassification: "PRE_CREATE_FAIL_CLOSED",
    priorCreationPostAttempts: 0,
    focusedOwnerTests: 19,
    predecessorInfrastructureTests: 91,
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    temporaryTokenChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    recommendationInfluence: "OFF"
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(JSON.stringify(verifyOverwatchFounderAttendedGetOnlyRecovery(), null, 2));
}
