import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES
} from "./lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  verifyCloudflareFounderAttendedCreateReceiptV2
} from "./verify-cloudflare-founder-attended-create-receipt-v2.mjs";
import {
  verifyCloudflareFounderAttendedSuccessfulResponseReconciliation
} from "./verify-cloudflare-founder-attended-successful-response-reconciliation.mjs";
import {
  verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation
} from "./verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs";
import {
  hasGovernedPublicDeploymentWorkflowV2PackageSuccessor,
  hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor
} from "./verify-overwatch-public-deployment-workflow-v2.mjs";
import {
  hasCurrentCanonicalPackageWiringSuccessor,
  hasLiveCanonicalIdentityVerifierSuccessor
} from "./verify-overwatch-cloudflare-founder-attended-service-token.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const governanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.md";
const reportPath =
  "overwatch/reports/BATCH-20260715-004-cloudflare-live-create-receipt-safe-provisioning-repair-v2.json";
const reconciliationGovernancePath =
  "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.json";
const reconciliationGovernanceDocumentationPath =
  "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.md";
const reconciliationReportPath =
  "overwatch/reports/BATCH-20260715-005-cloudflare-founder-attended-successful-response-reconciliation.json";
const keychainInteroperabilityGovernancePath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const githubDeploymentGovernancePath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const routeIq3dGovernancePath =
  "overwatch/governance/route-iq-3d-visual-continuity-v1.json";
const commercialReadinessGovernancePath =
  "overwatch/governance/route-iq-commercial-readiness-v1.json";
const fullSystemHarmonyGovernancePath =
  "overwatch/governance/full-system-harmony-audit-v1.json";
const liveCanonicalIdentityGovernancePath =
  "overwatch/governance/live-canonical-identity-migration-v1.json";
const currentReadinessSuccessorsPath =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";
const controlledRehearsalPackageSha256 =
  "8a2d68b09248fc561ade94744b4fd5a6b11dfdd3b49e7fd4895ee8b1ee1e547a";
const contractPath = "workers/infrastructure/cloudflare-founder-attended-create-receipt-v2.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const ownerCommit = "358f817f7fc81bd82560840e5fd54668a7f58abe";
const ownerParent = "f630c2af6e5e4722105d2b1e3ee959fb28f5da66";
const ownerTree = "887e54f6ff62dfd55730f81bf9348ee1ecd619bb";
const overwatchGovernanceCommit = "2bedfdc61b10e682d65a3308aad62640bc79f4ce";
const overwatchVerificationRepairCommit = "021bb0a76479136d92e9ba9721d9adbca5e1590a";
const overwatchRegistryFixtureRepairCommit = "327baa7085a5013f765c4a46eda07af5ad5470bb";
const reconciliationOwnerCommit = "326036a96d661e1a480f340a932ef8b85cafd408";
const reconciliationOwnerTree = "1212dd5da35b353741778f0ba92e1608c7864cf8";
const reconciliationOverwatchCommit = "4fbd3030c980a7e17230654dfe2ece0766793436";
const currentOverwatchVerifierSuccessors = Object.freeze([
  Object.freeze({
    commit: "6db68f845e91c967e34f3b825e4cbc2372cef6d8",
    tree: "6dfaddbe6ad9a3b3addb05cacc2b121c7bef1387",
    parent: "1861225879c60893f354e12385122330972d9ed8",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "overwatch: reconcile workflow v2 historical gates",
    paths: Object.freeze([
      "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json",
      "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
      "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
      "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
      "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
      "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
      "tests/overwatch-public-deployment-workflow-v2.test.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
        previousSha256: "35f0cf48a76785844b96907f31414b5f67169aed1fa9f2dad9706ff253ecfedc",
        successorSha256: "b6c04c6a67948bccb1e3f0078c6225fdd86be0d7192c01779bea623646c62799"
      }),
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
        previousSha256: "6cc5f5f7c0efdce15757416ef0c0c6c504d6283fd2abab05f3189072395b9434",
        successorSha256: "da87d718547e8df775ef58af73a78e3d40262182d6800d02ebcfbb63e8d35311"
      })
    ])
  }),
  Object.freeze({
    commit: "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    tree: "81aa187479948de9cd624d29f14557eea2909b79",
    parent: "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "Admit August 1 successors in paused access gates",
    paths: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
      "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
      "tests/overwatch-cloudflare-founder-attended-service-token.test.mjs",
      "tests/overwatch-cloudflare-unattended-access.test.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
        previousSha256: "6d0bbb82091b1c9f931da80db0656e7e8a8cefbe8a8488e17b55428b439eb932",
        successorSha256: "07a1ca72b14418cf1665e4ab239b4521256bc7723bc439a4789186f262c73f5f"
      }),
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
        previousSha256: "58bc993b1ad974a3e790cf2b33a7f4dec09b929c55f9887779a607ded30e2101",
        successorSha256: "0175623565a4fb3c82ad124ad3a810711d662adc94c2d60aecb93bb2f9a6a061"
      })
    ])
  }),
  Object.freeze({
    commit: "1a1e130b9ffe63948ceaf7fc7d5cfff647431e3e",
    tree: "c0dcdd559630b95120d7e0dd76bcc2e8b3616721",
    parent: "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "Reconcile attended response verifier successors",
    paths: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
      "tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
        previousSha256: "5f74e4384c89b9d42b70d4e604917c5f89a9b1fe47244528a1de76f96f7f64e7",
        successorSha256: "11d8a156dc28d888481aac9904ee832d820a4615b36b402712ab7ba6fd4c4227"
      })
    ])
  }),
  Object.freeze({
    commit: "03117292d4253b5ed31c8f47d38d149a59fa1cec",
    tree: "78579a1cd65666efd71d70bc87795c54a7359acc",
    parent: "b0ed9b5c5693577f4eea74cec757ffa4f2ab3708",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "overwatch: accept harmony package wiring successor",
    paths: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
      "tests/overwatch-cloudflare-founder-attended-service-token.test.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
        previousSha256: "4047aa80820da7992d00435fc5f4dc291a1cecabbb3997833e478be2d30ff1f7",
        successorSha256: "bcda2f36357cf27b892421f4257b10d18cf74063de5a6f6defe03be2317399e8"
      })
    ])
  }),
  Object.freeze({
    commit: "0e92d266392bc82c553d546d55ef33641c894f8d",
    tree: "76e3d754f32db5688edaa2f82c33bc96f6ffef70",
    parent: "eca6e63b84ce1df3ed18278dcfbbf9a241f8abcc",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "overwatch: reconcile attended package consumers",
    paths: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
      "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
        previousSha256: "da87d718547e8df775ef58af73a78e3d40262182d6800d02ebcfbb63e8d35311",
        successorSha256: "05c09251247f63a566d1a4bd633f00f62f76fa3e8dcc72b8a7fd1bf95158c706"
      }),
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
        previousSha256: "b6c04c6a67948bccb1e3f0078c6225fdd86be0d7192c01779bea623646c62799",
        successorSha256: "aed0a31fd6704626424e2d6f14f41200e62d47c671411d028d571d65e63218b0"
      })
    ])
  }),
  Object.freeze({
    commit: "02b398bdfeb1e5fb8a82bb009e4776630cb3f7d8",
    tree: "be501e4cb4edf62f49f3be2e8a5ab7d80a9e9acf",
    parent: "0e92d266392bc82c553d546d55ef33641c894f8d",
    identity: "Prometheus Overwatch <overwatch@prometheus.local>",
    subject: "overwatch: admit harmony attended successors",
    paths: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs"
    ]),
    transitions: Object.freeze([
      Object.freeze({
        path: "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
        previousSha256: "11d8a156dc28d888481aac9904ee832d820a4615b36b402712ab7ba6fd4c4227",
        successorSha256: "ba3ac1600a340b127c9a487087e77ffa65a22752656755582c7a8efe45605d8c"
      })
    ])
  })
]);

const expectedOwnerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-create-receipt-v2.md":
    "9bee82cf1f4859d5b058d35245242971dd2e2073b5026db7bd8361e0b113e800",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs":
    "4dfb5b35aa94dbb7a660e72881c06939bb01d0ce71843779bc5d9b8c29845ccb",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs":
    "2191c885aeffbb619143b54ce5fb10c1ec4ea24ef472ab1c2e93f48d2f9f96cb",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs":
    "1dceeaee0afba1f5cb4d72cc085f4a1df2eab5d40148d6c4e5969c7256494825",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs":
    "ef7bf7917c9590b8b0b12a06af6b3901c17098d60f2ece5e7023691b772e9dde",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs":
    "7b74ed168f4c4d30b901ed4ddbd052679d5098970529bce6b3071c0762c8790f",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-prepare.mjs":
    "2c55428bf1b4e2fdc69fb831e00d465b30f6df4d4a1e4fead131896f63c8325f",
  "scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs":
    "7dd6d8db8a0f1bf83158a4d4178823b7267765805ea48b29b85705a0e7d5686e",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs":
    "1f95ded85a5f5adc054d6bfd0d87f8260e1d7f7c0df4f6f80e59eb675ad740f5",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs":
    "cbf0bc909e6b56157fdfa99a16fd6bb86e520ee1d683727f33d617d15d0c3244",
  "workers/infrastructure/cloudflare-founder-attended-create-receipt-v2.json":
    "917d0c43cbdd763645a31237d738c627190b3d18174b343ca472a9f0074fe298"
});

const historicalV2ReasonCodes = Object.freeze(
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.filter(reasonCode => ![
    "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "CREATE_HTTP_STATUS_ALTERNATE_2XX",
    "CREATE_HTTP_STATUS_NON_2XX"
  ].includes(reasonCode))
);

const reconciliationOwnerHashes = Object.freeze({
  "docs/cloudflare-founder-attended-successful-response-reconciliation-v1.md":
    "f2c5e3003c3c513d3b2fb5613615ef73fe11ce5d41641b87610b6e77d342ae63",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs":
    "3f30028747a64263d5e6477796f524b124522e86d4347cf0ef225e7c25464a6d",
  "scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs":
    "4225767807a5031b44aa282db0fb75c50b6ac46d3cd8d095d307d1e31e76ed86",
  "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs":
    "98f0d70d94db251a8a43e211b35e7ea76e193de154ac730f3062f48e0628c319",
  "scripts/verify-cloudflare-founder-attended-successful-response-reconciliation.mjs":
    "bbb02046d6108cdb3de192e87b82f64aeccf70169c130eda669ffcb2810e2a65",
  "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs":
    "ea08617e18d506844ca0e0ab8471b853b0399ed712cfaf3e5fce85fbe82620f1",
  "workers/infrastructure/cloudflare-founder-attended-successful-response-reconciliation-v1.json":
    "de703f508861355fb69e8aa4afbc3fcc074fc403af53d3ef40ccef3bed00fd26"
});

const expectedReconciliationOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  reconciliationGovernanceDocumentationPath,
  reconciliationGovernancePath,
  reconciliationReportPath,
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "tests/cross-subsystem-artifact-contracts.test.mjs",
  "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs"
]);

const expectedOverwatchPaths = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governanceDocumentationPath,
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs"
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

export function evaluateFounderAttendedCreateReceiptV2Governance({ governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2",
  "Governance ID drifted.");
  require(governance.batchId === "BATCH-20260715-004", "Batch ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure",
    "Implementation owner drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch",
    "Verification owner drifted.");
  require(governance.dispatchAudit.implementationCommit.commit === ownerCommit,
    "Owner commit drifted.");
  require(governance.dispatchAudit.implementationCommit.parent === ownerParent,
    "Owner parent drifted.");
  require(governance.dispatchAudit.implementationCommit.tree === ownerTree,
    "Owner tree drifted.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true,
    "Ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedSubsystemImplementation === false,
    "Overwatch claims an implementation edit.");
  require(equal(governance.ownerEvidence, Object.entries(expectedOwnerHashes).map(
    ([path, sha256AtOwnerCommit]) => ({ path, sha256AtOwnerCommit })
  )), "Owner evidence map drifted.");

  require(governance.rootCauseClassification.historicalRejectedDimensionRecoverable === false,
    "Governance invents a historical response dimension.");
  require(governance.rootCauseClassification.historicalResponseRetained === false,
    "Governance claims the historical response was retained.");
  require(governance.rootCauseClassification.futureFailuresClassifiedByFixedNonsecretReason === true,
    "Fixed future classification is not required.");
  require(governance.officialResponseContracts.create.httpStatus === 200,
    "Create HTTP contract drifted.");
  require(governance.officialResponseContracts.create.nameEchoOptionalInProviderSchema === true,
    "Optional name echo drifted.");
  require(governance.officialResponseContracts.create.durationEchoOptionalInProviderSchema === true,
    "Optional duration echo drifted.");
  require(governance.officialResponseContracts.create.exactRequestDuration === "720h",
    "Duration drifted.");
  require(governance.officialResponseContracts.list.maximumPages === 100,
    "List page ceiling drifted.");
  require(governance.officialResponseContracts.delete.followUpExactNameAbsenceRequired === true,
    "Delete follow-up proof drifted.");
  require(governance.officialResponseContracts.delete.responseAloneConfirmsCleanup === false,
    "Delete response became sufficient cleanup proof.");

  const boundary = governance.createReceiptBoundary;
  require(boundary.freshAttendedGetRequired === true, "Fresh GET is not required.");
  require(boundary.freshOneShotControlRequired === true, "Fresh control is not required.");
  require(boundary.predecessorControlOrReceiptReuseAllowed === false,
    "Predecessor evidence reuse is allowed.");
  require(boundary.createAttemptsMaximum === 1, "Multiple POSTs are allowed.");
  require(boundary.automaticRetryAllowed === false, "Automatic retry is allowed.");
  require(boundary.returnedIdAloneAuthorizesDelete === false,
    "A returned ID alone can authorize deletion.");
  require(boundary.uniquePostCreateProofRequired === true, "Unique proof is not required.");
  require(boundary.wrongNameOrDurationDeleteAttempts === 0,
    "Wrong-name or wrong-duration deletion is allowed.");
  require(boundary.ambiguousMalformedMismatchedOrDuplicateProofDeleteAttempts === 0,
    "Ambiguous proof can delete.");
  require(boundary.compensationRequiresSeparateNativeTtyConfirmation === true,
    "Separate compensation attendance is not required.");
  require(boundary.compensationDeleteAttemptsMaximum === 1,
    "Compensation permits multiple DELETEs.");
  require(boundary.temporaryProvisioningApiTokenPreserved === true,
    "Temporary provisioning token is not preserved.");

  require(governance.credentialBoundary.keychainPairAllOrRollback === true,
    "Keychain pair is not atomic-or-rollback.");
  require(governance.credentialBoundary.valuesPrintedLoggedHashedMeasuredOrPersisted === false,
    "Credential metadata exposure is allowed.");
  require(equal(governance.reasonEvidence.allowedReasonCodes,
    historicalV2ReasonCodes),
  "Reason-code vocabulary drifted.");
  require(equal(governance.reasonEvidence.finalCliOutcomes,
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_FINAL_OUTCOMES),
  "Final outcome vocabulary drifted.");

  for (const [field, expected] of Object.entries({
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialCreatedDeletedStoredOrChanged: false,
    realControlReceiptOrReasonEvidenceCreated: false,
    temporaryProvisioningApiTokenChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) {
    require(governance.executionBoundary[field] === expected,
      `Execution boundary drifted: ${field}.`);
  }
  require(governance.releaseBoundary.deploymentAuthorized === false,
    "Governance authorizes deployment.");
  require(governance.releaseBoundary.liveGetAuthorizedByThisBatch === false,
    "Governance authorizes a live GET.");
  require(governance.releaseBoundary.controlPreparationAuthorized === false,
    "Governance authorizes control preparation.");
  require(governance.releaseBoundary.provisioningAuthorized === false,
    "Governance authorizes provisioning.");
  require(governance.releaseBoundary.nextSafeCommandMustBeGetOnly === true,
    "Next safe command is not constrained to GET-only.");

  require(report.batchId === "BATCH-20260715-004", "Report batch ID drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure",
    "Report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch",
    "Report verification owner drifted.");
  require(report.owners.implementationCommit === ownerCommit,
    "Report owner commit drifted.");
  require(report.owners.ownershipRespected === true, "Report does not affirm ownership.");
  require(report.completedWork.returnedIdAloneCannotAuthorizeDelete === true,
    "Report weakens delete identity.");
  require(report.completedWork.onePostMaximumNoRetry === true,
    "Report weakens one-POST behavior.");
  require(report.completedWork.nextActionGetOnly === true,
    "Report next action is not GET-only.");
  require(report.boundaries.cloudflareApiContacted === false,
    "Report claims Cloudflare contact.");
  require(report.boundaries.realKeychainValuesRead === false,
    "Report claims real Keychain access.");
  require(report.boundaries.deploymentPerformed === false,
    "Report claims deployment.");
  require(report.boundaries.recommendationInfluence === "OFF",
    "Report claims recommendation influence.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function evaluateFounderAttendedSuccessfulResponseReconciliationGovernance({
  governance,
  report
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId ===
    "cloudflare-founder-attended-successful-response-reconciliation-governance-v1",
  "Reconciliation governance ID drifted.");
  require(governance.batchId === "BATCH-20260715-005",
    "Reconciliation batch ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch",
    "Reconciliation governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure",
    "Reconciliation implementation owner drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch",
    "Reconciliation verification owner drifted.");
  require(governance.dispatchAudit.implementationCommit.commit === reconciliationOwnerCommit,
    "Reconciliation owner commit drifted.");
  require(governance.dispatchAudit.implementationCommit.parent ===
    overwatchRegistryFixtureRepairCommit, "Reconciliation parent drifted.");
  require(governance.dispatchAudit.implementationCommit.tree === reconciliationOwnerTree,
    "Reconciliation owner tree drifted.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true,
    "Reconciliation ownership is not affirmed.");
  require(governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
    "Overwatch claims an Infrastructure implementation edit.");
  require(equal(governance.ownerEvidence, Object.entries(reconciliationOwnerHashes).map(
    ([path, sha256AtOwnerCommit]) => ({ path, sha256AtOwnerCommit })
  )), "Reconciliation owner evidence drifted.");

  require(governance.observedLiveEvidence.source === "Founder-provided evidence",
    "Observed evidence provenance drifted.");
  require(governance.observedLiveEvidence.singleCreateAttemptObserved === true,
    "Observed one-request evidence drifted.");
  require(governance.observedLiveEvidence.workflowOutcome === "MANUAL_REVIEW",
    "Observed workflow outcome drifted.");
  require(governance.observedLiveEvidence.workflowReason === "CREATE_HTTP_STATUS_REJECTED",
    "Observed workflow reason drifted.");
  require(governance.observedLiveEvidence.keychainStorageOccurred === false,
    "Governance claims historical Keychain storage.");
  require(governance.observedLiveEvidence.historicalExactHttpStatusRecoverable === false,
    "Governance invents the historical HTTP status.");
  require(governance.observedLiveEvidence.historicalResponseOrCredentialMaterialRetained === false,
    "Governance claims historical sensitive material was retained.");

  require(governance.officialResponseContracts.create.documentedHttpStatus === 200,
    "Documented create status drifted.");
  require(governance.officialResponseContracts.create.clientIdOptionalInSchema === true,
    "Create client-ID schema interpretation drifted.");
  require(governance.officialResponseContracts.create.clientSecretOptionalInSchema === true,
    "Create client-secret schema interpretation drifted.");
  require(governance.officialResponseContracts.list.maximumPages === 100,
    "List page ceiling drifted.");
  require(governance.officialResponseContracts.delete.followUpExactNameAbsenceRequired === true,
    "Delete follow-up proof drifted.");

  const status = governance.statusReconciliation;
  require(status.documented200Class === "CREATE_HTTP_STATUS_DOCUMENTED_200",
    "Documented-200 class drifted.");
  require(status.alternate2xxClass === "CREATE_HTTP_STATUS_ALTERNATE_2XX",
    "Alternate-2xx class drifted.");
  require(status.non2xxClass === "CREATE_HTTP_STATUS_NON_2XX",
    "Non-2xx class drifted.");
  require(status.rawHttpStatusPersisted === false, "Raw status persistence is allowed.");
  require(status.boundedClassificationOnly === true, "Status evidence is not bounded.");
  require(status.bounded2xxEligibleOnlyForFurtherValidation === true,
    "2xx status became sufficient for success.");
  require(status.statusAloneCanReachSuccess === false, "Status alone can reach success.");
  require(status.non2xxCanReachSuccess === false, "Non-2xx can reach success.");
  require(status.invalidOrMissingStatusCanReachSuccess === false,
    "Invalid status can reach success.");
  require(status.transportUncertaintyCanReachSuccess === false,
    "Transport uncertainty can reach success.");
  require(status.successRequiresValidEnvelope === true
    && status.successRequiresValidClientId === true
    && status.successRequiresValidClientSecret === true,
  "Credential or envelope gates drifted.");
  require(status.successRequiresReturnedResourceIdProof === true
    && status.successRequiresExactNameProof === true
    && status.successRequiresExactDurationProof === true
    && status.exactDuration === "720h", "Exact proof gates drifted.");

  const safety = governance.safetyBoundary;
  require(safety.createAttemptsMaximumPerFreshControl === 1, "Multiple POSTs are allowed.");
  require(safety.automaticRetryAllowed === false, "Automatic retry is allowed.");
  require(safety.consumedOrAmbiguousControlReusable === false,
    "Consumed or ambiguous control reuse is allowed.");
  require(safety.keychainPairAllOrRollback === true, "Keychain rollback drifted.");
  require(safety.returnedIdAloneAuthorizesDelete === false,
    "Returned ID alone can authorize deletion.");
  require(safety.ambiguousMismatchedOrDuplicateProofDeleteAttempts === 0,
    "Ambiguous proof can delete.");
  require(safety.compensationRequiresSeparateFounderAuthorization === true
    && safety.compensationDeleteAttemptsMaximum === 1
    && safety.compensationRequiresExactIdNameAnd720hProof === true
    && safety.compensationRequiresFollowUpAbsenceGet === true,
  "Compensation boundary drifted.");
  require(safety.unrelatedTokenDeletionAllowed === false,
    "Unrelated token deletion is allowed.");
  require(safety.responseBodiesHeadersCookiesOrCredentialsPersisted === false,
    "Sensitive response persistence is allowed.");
  require(safety.credentialValuesPrintedLoggedHashedMeasuredOrExposed === false,
    "Credential metadata exposure is allowed.");

  require(governance.adversarialCoverage.focusedTests === 32,
    "Focused test count drifted.");
  for (const field of [
    "documented200", "alternate2xx", "non2xx", "malformedBody",
    "missingOrMalformedCredentials", "duplicateName", "transportAmbiguity",
    "keychainFailure", "cleanupFailure", "onePostNoRetry", "secretSafeOutput"
  ]) require(governance.adversarialCoverage[field] === true,
    `Adversarial coverage drifted: ${field}.`);

  for (const [field, expected] of Object.entries({
    cloudflareApiContacted: false,
    realKeychainValuesReadOrWritten: false,
    credentialCreatedDeletedStoredOrChanged: false,
    realControlReceiptOrEvidenceCreatedOrModified: false,
    temporaryProvisioningApiTokenChanged: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF"
  })) require(governance.executionBoundary[field] === expected,
    `Reconciliation execution boundary drifted: ${field}.`);

  require(governance.releaseBoundary.deploymentAuthorized === false,
    "Reconciliation governance authorizes deployment.");
  require(governance.releaseBoundary.liveGetAuthorizedByThisBatch === false,
    "Reconciliation governance authorizes a live GET.");
  require(governance.releaseBoundary.controlPreparationAuthorized === false,
    "Reconciliation governance authorizes control preparation.");
  require(governance.releaseBoundary.provisioningAuthorized === false,
    "Reconciliation governance authorizes provisioning.");
  require(governance.releaseBoundary.tokenCreationOrDeletionAuthorized === false,
    "Reconciliation governance authorizes a credential action.");
  require(governance.releaseBoundary.nextSafeCommand ===
    CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND,
  "Reconciliation next safe command drifted.");

  require(report.batchId === "BATCH-20260715-005", "Reconciliation report batch drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure",
    "Reconciliation report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch",
    "Reconciliation report verification owner drifted.");
  require(report.owners.implementationCommit === reconciliationOwnerCommit,
    "Reconciliation report commit drifted.");
  require(report.owners.ownershipRespected === true
    && report.owners.overwatchModifiedInfrastructureImplementation === false,
  "Reconciliation report ownership drifted.");
  require(report.completedWork.statusAloneCannotSucceed === true
    && report.completedWork.credentialAndExactProofRequired === true
    && report.completedWork.onePostMaximumNoRetry === true,
  "Reconciliation report safety claims drifted.");
  require(report.boundaries.cloudflareApiContacted === false
    && report.boundaries.realKeychainValuesReadOrWritten === false
    && report.boundaries.deploymentPerformed === false,
  "Reconciliation report external boundary drifted.");
  require(report.boundaries.recommendationInfluence === "OFF",
    "Reconciliation report changes recommendation influence.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerCommit(governance, reconciliationGovernance) {
  const fields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", ownerCommit
  ]).split("\n");
  if (!equal(fields, [
    ownerCommit,
    ownerParent,
    ownerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Classify attended Cloudflare create receipts"
  ])) throw new Error("Infrastructure commit metadata drifted.");
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", ownerCommit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
  const paths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ownerCommit])
    .split("\n").filter(Boolean);
  if (!equal(paths, Object.keys(expectedOwnerHashes))) {
    throw new Error("Infrastructure commit file set drifted.");
  }
  if (paths.some(path => path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }
  const evidence = new Map(governance.ownerEvidence.map(item => [item.path, item]));
  for (const [path, expectedHash] of Object.entries(expectedOwnerHashes)) {
    const ownerBytes = execFileSync("/usr/bin/git", ["show", `${ownerCommit}:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(ownerBytes) !== expectedHash
      || evidence.get(path)?.sha256AtOwnerCommit !== expectedHash) {
      throw new Error(`Infrastructure owner evidence drifted: ${path}`);
    }
  }

  const reconciliationFields = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    reconciliationOwnerCommit
  ]).split("\n");
  if (!equal(reconciliationFields, [
    reconciliationOwnerCommit,
    overwatchRegistryFixtureRepairCommit,
    reconciliationOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Reconcile attended Cloudflare 2xx create responses"
  ])) throw new Error("Infrastructure reconciliation commit metadata drifted.");
  const reconciliationPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", reconciliationOwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(reconciliationPaths, Object.keys(reconciliationOwnerHashes))) {
    throw new Error("Infrastructure reconciliation file set drifted.");
  }
  if (reconciliationPaths.some(path => path === "package.json" || path.startsWith("overwatch/"))) {
    throw new Error("Infrastructure reconciliation crossed the Overwatch ownership boundary.");
  }
  const reconciliationEvidence = new Map(
    reconciliationGovernance.ownerEvidence.map(item => [item.path, item])
  );
  for (const [path, expectedHash] of Object.entries(reconciliationOwnerHashes)) {
    const ownerBytes = execFileSync(
      "/usr/bin/git", ["show", `${reconciliationOwnerCommit}:${path}`], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    if (sha256(ownerBytes) !== expectedHash
      || reconciliationEvidence.get(path)?.sha256AtOwnerCommit !== expectedHash) {
      throw new Error(`Infrastructure reconciliation evidence drifted: ${path}`);
    }
  }
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === ownerCommit) return;
  const fields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s", overwatchGovernanceCommit
  ]).split("\n");
  if (!equal(fields, [
    ownerCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Govern attended Cloudflare create receipt repair"
  ])) throw new Error("Overwatch commit metadata drifted.");
  const paths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", overwatchGovernanceCommit
  ])
    .split("\n").filter(Boolean);
  if (!equal([...paths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch file set drifted.");
  }
  if (paths.some(path => path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/cloudflare-founder-attended-create-receipt-v2")
    || path.startsWith("scripts/run-cloudflare-founder-attended-create-receipt-v2"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchGovernanceCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === overwatchGovernanceCommit) return;
  const repairFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s",
    overwatchVerificationRepairCommit
  ]).split("\n");
  if (!equal(repairFields, [
    overwatchGovernanceCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Repair attended create receipt release verification"
  ])) throw new Error("Overwatch verification repair metadata drifted.");
  const repairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", overwatchVerificationRepairCommit
  ])
    .split("\n").filter(Boolean);
  if (!equal(repairPaths, [
    "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs"
  ])) throw new Error("Overwatch verification repair file set drifted.");
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchVerificationRepairCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === overwatchVerificationRepairCommit) return;
  const fixtureRepairFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s",
    overwatchRegistryFixtureRepairCommit
  ]).split("\n");
  if (!equal(fixtureRepairFields, [
    overwatchVerificationRepairCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Repair attended create receipt registry fixture"
  ])) throw new Error("Overwatch registry-fixture repair metadata drifted.");
  const fixtureRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    overwatchRegistryFixtureRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(fixtureRepairPaths, [
    "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
    "tests/cross-subsystem-artifact-contracts.test.mjs"
  ])) throw new Error("Overwatch registry-fixture repair file set drifted.");
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", overwatchRegistryFixtureRepairCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === overwatchRegistryFixtureRepairCommit) return;

  const ownerFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s",
    reconciliationOwnerCommit
  ]).split("\n");
  if (!equal(ownerFields, [
    overwatchRegistryFixtureRepairCommit,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Reconcile attended Cloudflare 2xx create responses"
  ])) throw new Error("Reconciliation owner successor metadata drifted.");
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", reconciliationOwnerCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
  if (head === reconciliationOwnerCommit) return;

  const reconciliationOverwatchFields = git([
    "show", "-s", "--format=%P%n%an <%ae>%n%cn <%ce>%n%s",
    reconciliationOverwatchCommit
  ]).split("\n");
  if (!equal(reconciliationOverwatchFields, [
    reconciliationOwnerCommit,
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Prometheus Overwatch <overwatch@prometheus.local>",
    "Govern attended Cloudflare response reconciliation"
  ])) throw new Error("Reconciliation Overwatch commit metadata drifted.");
  const reconciliationOverwatchPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", reconciliationOverwatchCommit
  ]).split("\n").filter(Boolean);
  if (!equal([...reconciliationOverwatchPaths].sort(),
    [...expectedReconciliationOverwatchPaths].sort())) {
    throw new Error("Reconciliation Overwatch file set drifted.");
  }
  if (reconciliationOverwatchPaths.some(path => path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/cloudflare-founder-attended-create-receipt-v2")
    || path.startsWith("scripts/run-cloudflare-founder-attended-create-receipt-v2")
    || path === "scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs"
    || path === "tests/cloudflare-founder-attended-create-receipt-v2.test.mjs")) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
  execFileSync("/usr/bin/git", [
    "merge-base", "--is-ancestor", reconciliationOverwatchCommit, "HEAD"
  ], { cwd: root, stdio: "ignore" });
}

function verifyImplementationBoundary() {
  const contract = readJson(contractPath);
  const reconciliationContract = readJson(
    "workers/infrastructure/cloudflare-founder-attended-successful-response-reconciliation-v1.json"
  );
  const workflow = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs");
  const production = read("scripts/lib/cloudflare-founder-attended-create-receipt-v2-production.mjs");
  const getOnly = read("scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
  if (contract.contractVersion !== "cloudflare-founder-attended-create-receipt-v2"
    || contract.status !== "IMPLEMENTED_SOURCE_NOT_EXECUTED"
    || contract.officialContracts.create.httpStatus !== 200
    || contract.postCreateProof.returnedIdAloneAuthorizesDelete !== false
    || contract.futureLifecycle.createAttemptsMaximum !== 1
    || contract.futureLifecycle.compensationAuthorizationSeparate !== true
    || contract.baseline.cloudflareApiContacted !== false
    || contract.baseline.realKeychainValuesRead !== false) {
    throw new Error("Infrastructure v2 contract drifted.");
  }
  if ((workflow.match(/method:\s*"POST"/gu) || []).length !== 1
    || (workflow.match(/method:\s*"DELETE"/gu) || []).length !== 1
    || !/totalEntries === 1 && expectedMatches === 1/u.test(workflow)
    || !/"compensate-v2-created-resource"/u.test(workflow)
    || /setTimeout|maxRetries|retryAfter|automaticRetry/iu.test(workflow)
    || /console\.(?:log|error)/u.test(workflow)) {
    throw new Error("Infrastructure v2 workflow boundary drifted.");
  }
  if (!/function classifyCreateHttpStatus/u.test(workflow)
    || !/status === 200/u.test(workflow)
    || !/status >= 200 && status < 300/u.test(workflow)
    || !/reason\(evaluation\.httpStatusReasonCode\)/u.test(workflow)
    || !/if \(!proof\.proven\)/u.test(workflow)
    || !/if \(!evaluation\.accepted\)/u.test(workflow)) {
    throw new Error("Infrastructure response reconciliation boundary drifted.");
  }
  if (!/provisionFounderAttendedCreateReceiptV2TestOnly/u.test(production)
    || /provisionFounderAttendedResponseContractSuccessorTestOnly/u.test(production)
    || !/attempts\.posts !== 1/u.test(production)
    || !/attempts\.deletes !== 1/u.test(production)
    || /setTimeout|maxRetries|retryAfter|automaticRetry/iu.test(production)) {
    throw new Error("Infrastructure v2 production adapter drifted.");
  }
  if (/method:\s*"(?:POST|PUT|PATCH|DELETE)"/u.test(getOnly)
    || /provisionFounderAttended/u.test(getOnly)
    || !/console\.log\(result\.outcome\)/u.test(getOnly)) {
    throw new Error("Next action is not structurally GET-only.");
  }
  const owner = verifyCloudflareFounderAttendedCreateReceiptV2();
  if (owner.status !== "passed") throw new Error("Infrastructure owner verifier failed.");
  const reconciliation = verifyCloudflareFounderAttendedSuccessfulResponseReconciliation();
  if (reconciliation.status !== "passed"
    || reconciliation.batchId !== "BATCH-20260715-005"
    || reconciliation.cloudflareApiContacted !== false
    || reconciliation.realKeychainValuesRead !== false) {
    throw new Error("Infrastructure reconciliation owner verifier failed.");
  }
  if (reconciliationContract.contractVersion !==
      "cloudflare-founder-attended-successful-response-reconciliation-v1"
    || reconciliationContract.status !== "IMPLEMENTED_SOURCE_NOT_EXECUTED"
    || reconciliationContract.statusReconciliation.statusAloneCanReachSuccess !== false
    || reconciliationContract.statusReconciliation.non2xxCanReachSuccess !== false
    || reconciliationContract.runtimeBoundaries.realExecutionAuthorized !== false) {
    throw new Error("Infrastructure reconciliation contract drifted.");
  }
}

function verifyPredecessorTransitions(governance, rotation) {
  for (const successor of currentOverwatchVerifierSuccessors) {
    const fields = git([
      "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", successor.commit
    ]).split("\n");
    const paths = git([
      "diff-tree", "--no-commit-id", "--name-only", "-r", successor.commit
    ]).split("\n").filter(Boolean).sort();
    if (!equal(fields, [
      successor.commit,
      successor.parent,
      successor.tree,
      successor.identity,
      successor.identity,
      successor.subject
    ]) || !equal(paths, [...successor.paths].sort())) {
      throw new Error(`Current Overwatch verifier successor drifted: ${successor.commit}`);
    }
  }
  const packageTransition = governance.protectedReleaseWiringTransitions[0];
  const keychainInteroperabilityGovernance = readJson(keychainInteroperabilityGovernancePath);
  const keychainTransition = keychainInteroperabilityGovernance.protectedReleaseWiringTransitions[0];
  const githubDeploymentGovernance = readJson(githubDeploymentGovernancePath);
  const githubDeploymentTransition = githubDeploymentGovernance.protectedReleaseWiringTransitions[0];
  const routeIq3dGovernance = readJson(routeIq3dGovernancePath);
  const routeIq3dTransition = routeIq3dGovernance.protectedReleaseWiringTransitions[0];
  const keychainVerifierTransitions = new Map(
    keychainInteroperabilityGovernance.protectedOverwatchVerifierSuccessors
      .map(item => [item.path, item])
  );
  const githubDeploymentVerifierTransitions = new Map(
    githubDeploymentGovernance.protectedOverwatchVerifierSuccessors
      .map(item => [item.path, item])
  );
  const commercialReadinessGovernance = readJson(commercialReadinessGovernancePath);
  const basePackage = execFileSync("/usr/bin/git", ["show", `${ownerParent}:package.json`], {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (packageTransition.previousSha256 !== sha256(basePackage)
    || packageTransition.successorSha256 !== keychainTransition.previousSha256
    || keychainTransition.successorSha256 !== githubDeploymentTransition.previousSha256
    || githubDeploymentTransition.successorSha256 !== routeIq3dTransition.previousSha256
    || !hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      predecessorGovernanceId: "route-iq-3d-visual-continuity-v1",
      historicalSha256: routeIq3dTransition.successorSha256,
      successorSha256: controlledRehearsalPackageSha256
    })
    || !hasCurrentCanonicalPackageWiringSuccessor({
      fullSystemHarmonyGovernance: readJson(fullSystemHarmonyGovernancePath),
      liveCanonicalIdentityGovernance: readJson(liveCanonicalIdentityGovernancePath),
      currentReadinessSuccessors: readJson(currentReadinessSuccessorsPath),
      predecessorSha256: controlledRehearsalPackageSha256,
      currentPackageSha256: sha256(read("package.json"))
    })
    || packageTransition.owner !== "Prometheus Overwatch"
    || keychainTransition.owner !== "Prometheus Overwatch"
    || githubDeploymentTransition.owner !== "Prometheus Overwatch"
    || routeIq3dTransition.owner !== "Prometheus Overwatch") {
    throw new Error("Package release-wiring transition drifted.");
  }
  for (const item of governance.overwatchVerificationSuccessors) {
    const previous = execFileSync("/usr/bin/git", ["show", `${ownerParent}:${item.path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const current = sha256(readFileSync(resolve(root, item.path)));
    const currentSuccessorOwner = currentOverwatchVerifierSuccessors.find(successor =>
      successor.transitions.some(mapping => (
        mapping.path === item.path
        && mapping.successorSha256 === current
      ))
    );
    const currentSuccessorTransition = currentSuccessorOwner?.transitions.find(mapping => (
      mapping.path === item.path
      && mapping.successorSha256 === current
    ));
    const currentSuccessorPrevious = currentSuccessorTransition
      ? sha256(execFileSync("/usr/bin/git", [
        "show", `${currentSuccessorOwner.parent}:${item.path}`
      ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] }))
      : null;
    const isCurrentOverwatchSuccessor = currentSuccessorTransition?.previousSha256 ===
      currentSuccessorPrevious;
    const isRotationSuccessor = item.path ===
        "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs"
      && rotation.status === "passed"
      && rotation.batchId === "BATCH-20260715-006"
      && rotation.implementationCommits.at(-1) ===
        "e10719d6d2ff312f2a5473c1fe000810e915509b";
    const verifierTransition = keychainVerifierTransitions.get(item.path);
    const githubDeploymentTransition =
      githubDeploymentVerifierTransitions.get(item.path);
    const isKeychainSuccessor = verifierTransition?.successorSha256 === current
      && verifierTransition?.owner === "Prometheus Overwatch"
      && (verifierTransition?.previousSha256 === item.successorSha256
        || isRotationSuccessor);
    const isGithubDeploymentSuccessor =
      githubDeploymentTransition?.previousSha256 === verifierTransition?.successorSha256
      && githubDeploymentTransition?.successorSha256 === current
      && githubDeploymentTransition?.owner === "Prometheus Overwatch";
    const isCommercialReadinessSuccessor =
      commercialReadinessGovernance.protectedBaselineSuccessors.some(mapping => (
        mapping.predecessorGovernanceId === githubDeploymentGovernance.governanceId
        && mapping.path === item.path
        && mapping.historicalSha256 === githubDeploymentTransition?.successorSha256
        && mapping.successorSha256 === current
        && mapping.owner === "Prometheus Overwatch"
      ));
    const routeIq3dTransition =
      routeIq3dGovernance.protectedOverwatchVerifierSuccessors.find(mapping => (
        mapping.predecessorGovernanceId === commercialReadinessGovernance.governanceId
        && mapping.path === item.path
        && mapping.historicalSha256 === sha256(execFileSync("/usr/bin/git", [
          "show", `${routeIq3dGovernance.startingRepositoryState.commit}:${item.path}`
        ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] }))
        && mapping.owner === "Prometheus Overwatch"
      ));
    const isRouteIq3dSuccessor = routeIq3dTransition?.successorSha256 === current;
    const isWorkflowV2Successor = routeIq3dTransition
      && hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
        path: item.path,
        historicalSha256: routeIq3dTransition.successorSha256,
        successorSha256: current
      });
    const isLiveCanonicalIdentitySuccessor =
      hasLiveCanonicalIdentityVerifierSuccessor({
        governance: readJson(liveCanonicalIdentityGovernancePath),
        path: item.path,
        currentSha256: current
      });
    if (item.previousSha256 !== sha256(previous)
      || (item.successorSha256 !== current
        && !isRotationSuccessor
        && !isKeychainSuccessor
        && !isGithubDeploymentSuccessor
        && !isCommercialReadinessSuccessor
        && !isRouteIq3dSuccessor
        && !isWorkflowV2Successor
        && !isLiveCanonicalIdentitySuccessor
        && !isCurrentOverwatchSuccessor)
      || (isRotationSuccessor && item.successorSha256 !== current
        && !isKeychainSuccessor
        && !isGithubDeploymentSuccessor
        && !isCommercialReadinessSuccessor
        && !isRouteIq3dSuccessor
        && !isWorkflowV2Successor
        && !isLiveCanonicalIdentitySuccessor
        && !isCurrentOverwatchSuccessor)
      || item.owner !== "Prometheus Overwatch") {
      throw new Error(`Overwatch verification successor drifted: ${item.path}`);
    }
  }
}

function verifyCanonicalRegistration() {
  const registry = readJson(registryPath);
  const matches = registry.governanceArtifacts.filter(item => item.artifactId ===
    "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2");
  const expected = {
    artifactId: "cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-governance-v2",
    artifactType: "overwatch_infrastructure_attended_create_receipt_safe_provisioning_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: governancePath,
    documentationPath: governanceDocumentationPath,
    schema: "CloudflareFounderAttendedLiveCreateReceiptSafeProvisioningRepairGovernanceV2",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (matches.length !== 1 || !equal(matches[0], expected)) {
    throw new Error("Canonical v2 governance registration drifted.");
  }
  const reconciliationMatches = registry.governanceArtifacts.filter(item => item.artifactId ===
    "cloudflare-founder-attended-successful-response-reconciliation-governance-v1");
  const reconciliationExpected = {
    artifactId: "cloudflare-founder-attended-successful-response-reconciliation-governance-v1",
    artifactType:
      "overwatch_infrastructure_attended_successful_response_reconciliation_governance",
    ownerSubsystem: "Prometheus Overwatch",
    path: reconciliationGovernancePath,
    documentationPath: reconciliationGovernanceDocumentationPath,
    schema: "CloudflareFounderAttendedSuccessfulResponseReconciliationGovernanceV1",
    writeAllowed: ["Prometheus Overwatch"],
    readAllowed: ["Prometheus Infrastructure", "Prometheus Overwatch"],
    productionConsumer: false,
    failClosedIfMissing: true
  };
  if (reconciliationMatches.length !== 1
    || !equal(reconciliationMatches[0], reconciliationExpected)) {
    throw new Error("Canonical reconciliation governance registration drifted.");
  }
}

function verifyReleaseWiring(governance) {
  const packageJson = readJson("package.json");
  const expectedOverwatch =
    "node scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs && node --test tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs";
  const expectedOwner =
    "node scripts/verify-cloudflare-founder-attended-create-receipt-v2.mjs && node --test tests/cloudflare-founder-attended-create-receipt-v2.test.mjs";
  if (packageJson.scripts["overwatch:cloudflare-founder-attended-create-receipt-v2:check"] !==
      expectedOverwatch
    || packageJson.scripts["infrastructure:cloudflare-founder-attended-create-receipt-v2:check"] !==
      expectedOwner
    || !packageJson.scripts["test:overwatch"].includes(
      "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs")
    || !packageJson.scripts["test:overwatch"].includes(
      "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs")
    || !packageJson.scripts.test.includes(
      "overwatch:cloudflare-founder-attended-create-receipt-v2:check")
    || !packageJson.scripts.test.includes(
      "infrastructure:cloudflare-founder-attended-create-receipt-v2:check")
    || !packageJson.scripts.test.includes(
      "overwatch:cloudflare-unattended-keychain-interoperability:check")
    || !packageJson.scripts.test.includes(
      "infrastructure:cloudflare-unattended-keychain-interoperability:check")) {
    throw new Error("v2 release wiring drifted.");
  }
  const releaseCommands = `${expectedOverwatch} ${expectedOwner}`;
  if (/wrangler|curl|https:\/\/|run-cloudflare-founder-attended-create-receipt-v2/u
    .test(releaseCommands)) {
    throw new Error("v2 release gate contains a live action.");
  }
  if (governance.releaseBoundary.nextSafeCommandMustBeGetOnly !== true
    || CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND !==
      "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs") {
    throw new Error("Next safe command governance drifted.");
  }
}

function verifyNoAutomaticDeployment() {
  const workflowPaths = git(["ls-files", ".github/workflows"])
    .split("\n").filter(Boolean);
  for (const path of workflowPaths) {
    const source = read(path);
    if (/wrangler\s+(?:deploy|versions\s+upload|versions\s+deploy)|cloudflare.*deploy/iu
      .test(source)) {
      throw new Error(`Push may trigger deployment: ${path}`);
    }
  }
}

function verifySecretSafety() {
  const repositoryFiles = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n").filter(Boolean);
  const trackedFiles = [...new Set([...listTrackedFiles(root), ...repositoryFiles])];
  if (scanTrackedRepository({ root, trackedFiles }).length !== 0) {
    throw new Error("Tracked or outgoing secret findings detected.");
  }
  if (verifyLocalSecretArtifacts({ root }).length !== 0) {
    throw new Error("Local secret artifact protection failed.");
  }
}

export function verifyOverwatchFounderAttendedCreateReceiptV2() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const reconciliationGovernance = readJson(reconciliationGovernancePath);
  const reconciliationReport = readJson(reconciliationReportPath);
  const evaluated = evaluateFounderAttendedCreateReceiptV2Governance({ governance, report });
  if (!evaluated.ok) throw new Error(evaluated.failures.join("\n"));
  const reconciliationEvaluated =
    evaluateFounderAttendedSuccessfulResponseReconciliationGovernance({
      governance: reconciliationGovernance,
      report: reconciliationReport
    });
  if (!reconciliationEvaluated.ok) {
    throw new Error(reconciliationEvaluated.failures.join("\n"));
  }
  verifyOwnerCommit(governance, reconciliationGovernance);
  verifyOverwatchOwnership();
  verifyImplementationBoundary();
  const rotation = verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation();
  verifyPredecessorTransitions(governance, rotation);
  verifyCanonicalRegistration();
  verifyReleaseWiring(governance);
  verifyNoAutomaticDeployment();
  verifySecretSafety();
  return Object.freeze({
    status: "passed",
    batchId: rotation.batchId,
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: rotation.implementationCommits.at(-1),
    focusedOwnerTests: rotation.focusedOwnerTests,
    currentOverwatchVerifierSuccessorCommits: Object.freeze(
      currentOverwatchVerifierSuccessors.map(successor => successor.commit)
    ),
    cloudflareApiContacted: false,
    realKeychainValuesRead: false,
    credentialActionPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    cohortActivation: "OFF",
    recommendationInfluence: "OFF",
    nextSafeCommand: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_NEXT_SAFE_COMMAND
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    console.log(JSON.stringify(verifyOverwatchFounderAttendedCreateReceiptV2(), null, 2));
  } catch {
    console.error("Overwatch Cloudflare Founder-attended create-receipt v2 check failed.");
    process.exitCode = 1;
  }
}
