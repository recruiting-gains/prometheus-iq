#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  verifyPublicRepositoryIntegrity
} from "./lib/github-actions-public-worker-deployment.mjs";
import { buildPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath = PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityContractPath;
const expectedPreservedObjects = Object.freeze({
  src: "2386f04cd661cf75549c170b40ef4c01bd235b04",
  crm: "85aeb4e16887a0a1b4faf7c0d463173b322db60c",
  "deploy/prometheusrouteiq-website": "5c9a75c75e81770aa4825a911bafc6c005f46d4f",
  "workers/prometheus-iq-worker.js": "c3199013a4685ef0d9df601ff05b0052e1abb99d",
  "wrangler.prometheusrouteiq-website.jsonc": "91bf94141dc7a90ebd957ce7747f7ac27cd797dd",
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json":
    "98ba4eabf1870282230ac44bbe444acbe9d322c9"
});
const expectedOwnerFiles = Object.freeze([
  ".github/workflows/deploy-prometheus-public-worker.yml",
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-github-actions-public-worker-deployment.mjs",
  "scripts/run-public-worker-repository-integrity-diagnostic.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const pinnedNodeSuccessorFiles = Object.freeze([
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const knownOverwatchSuccessorFiles = Object.freeze([
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const ownerBoundaryRepairFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const ciPortabilityRepairFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const dashboardVerificationSuccessorFiles = Object.freeze([
  "scripts/verify-dashboard-runtime-workflows.mjs",
  "tests/dashboard-route-iq-product-focus.test.mjs"
]);
const dashboardProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const publicIntakeSmokeSuccessorFiles = Object.freeze([
  "scripts/run-cloudflare-public-worker-smoke.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs"
]);
const publicIntakeSmokeProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const cleanRunnerAssetGenerationSuccessorFiles = Object.freeze([
  ".github/workflows/deploy-prometheus-public-worker.yml",
  "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const keychainCiPortabilitySuccessorFiles = Object.freeze([
  "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
  "tests/cloudflare-unattended-keychain-interoperability.test.mjs"
]);
const keychainCiProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const keychainCiOverwatchMappingFiles = Object.freeze([
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json",
  "overwatch/reports/BATCH-20260715-008-cloudflare-unattended-keychain-interoperability.json",
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
]);
const historicalKeychainFixtureProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const dashboardRuntimeHarnessSuccessorFiles = Object.freeze([
  "scripts/verify-dashboard-runtime-workflows.mjs",
  "tests/dashboard-route-iq-product-focus.test.mjs"
]);
const dashboardRuntimeHarnessAdoptionFiles = Object.freeze([
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const safeNoSecretAssetOrderingRepairFiles = Object.freeze([
  ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const cloudflareDeploymentReadRepairFiles = Object.freeze([
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json"
]);
const cloudflareDeploymentReadProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const wranglerDeploymentDiagnosticRepairFiles = Object.freeze([
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json"
]);
const wranglerDeploymentDiagnosticProvenanceAdmissionFiles = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);

export const SAFE_NO_SECRET_PREDEPLOYMENT_RUN_COMMANDS = Object.freeze([
  "node scripts/run-public-worker-repository-integrity-diagnostic.mjs",
  "npm ci",
  "npm run build",
  "npm test",
  "npm run lint",
  "npm run typecheck",
  "npm run security:check",
  "npm run security:aegis:verify",
  "npm run infrastructure:route-iq-forward-rollback:check",
  "npm run infrastructure:route-iq-public-deployment-assets:check",
  "node scripts/verify-route-iq-public-forward-rollback.mjs",
  "node scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "node scripts/verify-github-actions-public-worker-deployment.mjs",
  "npm run overwatch:artifact-contracts:check",
  "node scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs"
]);

export const INFRASTRUCTURE_OWNER_VERIFIER_FAILURE = Object.freeze({
  ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY:
    "OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
  ROLLBACK_GENERATION_FAILED: "OWNER_VERIFIER_ROLLBACK_GENERATION_FAILED",
  ROLLBACK_INVALID: "OWNER_VERIFIER_ROLLBACK_INVALID",
  REPOSITORY_INTEGRITY_FAILED: "OWNER_VERIFIER_REPOSITORY_INTEGRITY_FAILED",
  CONTRACT_OR_PROVENANCE_INVALID: "OWNER_VERIFIER_CONTRACT_OR_PROVENANCE_INVALID",
  INTERNAL_FAILURE: "OWNER_VERIFIER_INTERNAL_FAILURE"
});

export const INFRASTRUCTURE_OWNER_BOUNDARY = Object.freeze({
  infrastructureCommits: Object.freeze([
    Object.freeze({
      commit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
      tree: "8b5202428cfdb6a3586bdc90f39cce4d3ea02e97",
      parent: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: repair public repository integrity diagnostics",
      files: expectedOwnerFiles,
      contractBlob: "673857de365f5c193684afd125970b7b2f65e99d"
    }),
    Object.freeze({
      commit: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
      tree: "025d3d01cae56753f9d0c5e63af5ea369a52b4ff",
      parent: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: pin safe integrity diagnostic runtime",
      files: pinnedNodeSuccessorFiles,
      contractBlob: "67fccf3fbd534f877097b33154028c84c0ffbbc2"
    })
  ]),
  knownOverwatchSuccessor: Object.freeze({
    commit: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    tree: "464118922a37710452ec85009df24007e9a4ffdf",
    parent: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local",
    committerName: "Prometheus Overwatch",
    committerEmail: "overwatch@prometheus.local",
    subject: "overwatch: record public integrity repair readiness",
    files: knownOverwatchSuccessorFiles
  }),
  boundaryRepairSuccessor: Object.freeze({
    parent: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: constrain repository integrity owner boundary",
    files: ownerBoundaryRepairFiles
  }),
  ciPortabilityRepairSuccessor: Object.freeze({
    parent: "8d312bf747a289c675eb37adf582b43c860c635e",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: repair public integrity verifier portability",
    files: ciPortabilityRepairFiles
  }),
  dashboardVerificationSuccessor: Object.freeze({
    commit: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    tree: "2bd8186faafd7c922c17da9401c6dddbc64163bb",
    parent: "03ed86e25bda0a67e55757969966f4bc61c4b63e",
    authorName: "Prometheus Dashboard",
    authorEmail: "dashboard@prometheus.local",
    committerName: "Prometheus Dashboard",
    committerEmail: "dashboard@prometheus.local",
    subject: "dashboard: stabilize Eventbrite expansion verification",
    files: dashboardVerificationSuccessorFiles
  }),
  dashboardProvenanceAdmissionSuccessor: Object.freeze({
    parent: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit Dashboard verification successor",
    files: dashboardProvenanceAdmissionFiles
  }),
  publicIntakeSmokeSuccessors: Object.freeze([
    Object.freeze({
      commit: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
      tree: "1e75df8788becfd8b1bfd3fa1d1505a7492e2b01",
      parent: "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: accept strict public intake Allow set",
      files: publicIntakeSmokeSuccessorFiles
    }),
    Object.freeze({
      commit: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
      tree: "16918f0b77ae5ac7d1697b8f324d77e90b0ae50f",
      parent: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: validate intake Allow by probe method",
      files: publicIntakeSmokeSuccessorFiles
    })
  ]),
  publicIntakeSmokeProvenanceAdmissionSuccessor: Object.freeze({
    parent: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit public intake smoke successors",
    files: publicIntakeSmokeProvenanceAdmissionFiles
  }),
  cleanRunnerAssetGenerationSuccessor: Object.freeze({
    parent: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: generate public assets before verification",
    files: cleanRunnerAssetGenerationSuccessorFiles
  }),
  keychainCiPortabilitySuccessor: Object.freeze({
    commit: "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
    tree: "955431d084ed6e529490e71e6432c8007217db36",
    parent: "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "Make Keychain owner verifier portable in CI",
    files: keychainCiPortabilitySuccessorFiles
  }),
  keychainCiOverwatchMappingSuccessor: Object.freeze({
    commit: "06a6464035d3b8d46f308c77955a80a62ddfa957",
    tree: "23ec45072e108c932fedd29481aca78de5b71773",
    parent: "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local",
    committerName: "Prometheus Overwatch",
    committerEmail: "overwatch@prometheus.local",
    subject: "Record Keychain CI portability successor",
    files: keychainCiOverwatchMappingFiles
  }),
  keychainCiProvenanceAdmissionSuccessor: Object.freeze({
    parent: "06a6464035d3b8d46f308c77955a80a62ddfa957",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit Keychain CI portability successor",
    files: keychainCiProvenanceAdmissionFiles
  }),
  keychainCiMappingCompatibilityRepairSuccessor: Object.freeze({
    parent: "89f6e5c0e40d759289793fb6a6f1767a6888d6c4",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: pin Keychain Overwatch mapping",
    files: keychainCiProvenanceAdmissionFiles
  }),
  historicalKeychainFixtureSuccessors: Object.freeze([
    Object.freeze({
      commit: "a69dd6ac8785f0906d1ad91e9ca156f5250dc22e",
      tree: "459845ad3a1494ffad84471c56fe5cc152c8b11d",
      parent: "5f33e24e1e61f4866f49f96669c9c54e80cbb099",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: distinguish historical Keychain fixture successor",
      files: Object.freeze([
        "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
        "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs"
      ])
    }),
    Object.freeze({
      commit: "0165ffc56a18408be5c2e970223944fa1dd02593",
      tree: "e8d3d8a9031eebfa8a9ebf46666bfd6b961b9c83",
      parent: "a69dd6ac8785f0906d1ad91e9ca156f5250dc22e",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: report current owner verifier coverage",
      files: Object.freeze([
        "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs"
      ])
    }),
    Object.freeze({
      commit: "41d9f1fa9273482261500708d7299a1997f6ec69",
      tree: "647e652e2fd152b8220cfc6e632c039dd33ea277",
      parent: "0165ffc56a18408be5c2e970223944fa1dd02593",
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local",
      subject: "overwatch: govern historical Keychain fixture repairs",
      files: Object.freeze([
        "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json",
        "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
        "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
        "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
      ])
    })
  ]),
  historicalKeychainFixtureProvenanceAdmissionSuccessor: Object.freeze({
    parent: "41d9f1fa9273482261500708d7299a1997f6ec69",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit historical Keychain fixture successors",
    files: historicalKeychainFixtureProvenanceAdmissionFiles
  }),
  dashboardRuntimeHarnessSuccessors: Object.freeze([
    Object.freeze({
      commit: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
      tree: "ace6df9882d8033c5ffc08770b60a35653434e7e",
      parent: "3a2bd37f779e070b868256178bc40dbede8605c8",
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      committerName: "Prometheus Dashboard",
      committerEmail: "dashboard@prometheus.local",
      subject: "dashboard: stabilize runtime harness startup",
      files: dashboardRuntimeHarnessSuccessorFiles
    }),
    Object.freeze({
      commit: "577b9217185be2324824c5c4eeeaf6cd89300477",
      tree: "37c857d916b336b87e7f4f878d74332cc62cf329",
      parent: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      committerName: "Prometheus Dashboard",
      committerEmail: "dashboard@prometheus.local",
      subject: "Harden Dashboard Chrome harness lifecycle",
      files: dashboardRuntimeHarnessSuccessorFiles
    })
  ]),
  dashboardRuntimeHarnessAdoptionSuccessor: Object.freeze({
    parent: "577b9217185be2324824c5c4eeeaf6cd89300477",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: adopt Dashboard runtime harness repair",
    files: dashboardRuntimeHarnessAdoptionFiles
  }),
  safeNoSecretAssetOrderingRepairSuccessor: Object.freeze({
    parent: "5d5ffe858d7e132778c96746eabd4a99afe9d1f4",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: order clean-runner public asset generation",
    files: safeNoSecretAssetOrderingRepairFiles
  }),
  cloudflareDeploymentReadRepairSuccessors: Object.freeze([
    Object.freeze({
      commit: "e896cabe19fc696834659ed1cbe05f027c434553",
      tree: "d70f2f892755e1d9f86dd08be3d559344b5fcc66",
      parent: "5c920ad7c56289791d12c756d4b9627bf18b4632",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: classify Cloudflare deployment read failures",
      files: cloudflareDeploymentReadRepairFiles
    }),
    Object.freeze({
      commit: "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
      tree: "f62ebac98952b9cc1156a81e9bf0cec2e0563dcb",
      parent: "e896cabe19fc696834659ed1cbe05f027c434553",
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: "infrastructure: extend bounded Cloudflare state deadline",
      files: cloudflareDeploymentReadRepairFiles
    })
  ]),
  cloudflareDeploymentReadProvenanceAdmissionSuccessor: Object.freeze({
    parent: "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit Cloudflare deployment read repairs",
    files: cloudflareDeploymentReadProvenanceAdmissionFiles
  }),
  wranglerDeploymentDiagnosticRepairSuccessor: Object.freeze({
    commit: "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    tree: "31abba310779208a7f940321adfe8916a8dd31ca",
    parent: "9a2c27da613f1222039c5a8ae583ce9f70d98056",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: classify Wrangler deployment failures",
    files: wranglerDeploymentDiagnosticRepairFiles
  }),
  wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor: Object.freeze({
    parent: "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    authorName: "Prometheus Infrastructure",
    authorEmail: "infrastructure@prometheus.local",
    committerName: "Prometheus Infrastructure",
    committerEmail: "infrastructure@prometheus.local",
    subject: "infrastructure: admit Wrangler deployment diagnostic repair",
    files: wranglerDeploymentDiagnosticProvenanceAdmissionFiles
  })
});

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function sha256AtCommit(commit, path) {
  return createHash("sha256").update(execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  })).digest("hex");
}

function countExactTrimmedLine(source, expected) {
  return source.split("\n").filter(line => line.trim() === expected).length;
}

export function verifySafeNoSecretPredeploymentWorkflow(source = read(
  PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath
)) {
  assert.match(source, /^on:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n/mu);
  assert.doesNotMatch(
    source,
    /^  (?:push|pull_request|pull_request_target|schedule|repository_dispatch|workflow_call|workflow_run):/mu
  );
  assert.match(source, /group: verify-prometheus-public-repository-integrity/u);
  assert.match(source, /cancel-in-progress: false/u);
  assert.equal(countExactTrimmedLine(source, "runs-on: ubuntu-latest"), 1);
  assert.equal(countExactTrimmedLine(source, "timeout-minutes: 90"), 1);
  for (const requiredIdentityCheck of [
    "github.event_name == 'workflow_dispatch'",
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.ref_name == 'main'",
    "github.ref_type == 'branch'",
    "github.workflow == 'Verify Prometheus Public Repository Integrity'",
    "github.workflow_ref == 'PrometheusRouteIQ/prometheus-iq/.github/workflows/verify-prometheus-public-repository-integrity.yml@refs/heads/main'",
    "github.run_attempt == 1"
  ]) assert.equal(source.split(requiredIdentityCheck).length - 1, 1,
    `${requiredIdentityCheck} must appear exactly once`);

  const actions = source.split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("uses: "));
  assert.deepEqual(actions, [
    "uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
  ]);
  for (const required of [
    "repository: PrometheusRouteIQ/prometheus-iq",
    "ref: main",
    "fetch-depth: 0",
    "persist-credentials: false",
    "clean: true",
    "node-version: \"24\""
  ]) assert.equal(countExactTrimmedLine(source, required), 1, `${required} must appear exactly once`);

  const runCommands = source.split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("run: ") && line !== "run: |")
    .map(line => line.slice("run: ".length));
  assert.deepEqual(runCommands, SAFE_NO_SECRET_PREDEPLOYMENT_RUN_COMMANDS);
  assert.equal(countExactTrimmedLine(source, "run: |"), 1);
  for (const cleanupCommand of [
    "git diff --exit-code",
    "git diff --cached --exit-code",
    "test -z \"$(git status --porcelain=v1 --untracked-files=all)\"",
    "node scripts/run-public-worker-repository-integrity-diagnostic.mjs"
  ]) assert.ok(countExactTrimmedLine(source, cleanupCommand) >= 1,
    `${cleanupCommand} final integrity command is required`);

  for (const forbidden of [
    /^\s*environment:/mu,
    /^\s*env:/mu,
    /\bsecrets\./u,
    /\bvars\./u,
    /\bCLOUDFLARE_[A-Z0-9_]+\b/u,
    /\bGITHUB_TOKEN\b/u,
    /\bGH_TOKEN\b/u,
    /\bid-token:\s*write\b/u,
    /\bcontents:\s*write\b/u,
    /\bcontinue-on-error:/u,
    /\|\|\s*true/u,
    /run-github-actions-public-worker-deployment\.mjs/u,
    /\bwrangler\b/iu,
    /api\.cloudflare\.com/iu,
    /\b(?:curl|wget)\b/iu,
    /\b(?:POST|PUT|PATCH|DELETE)\b/u,
    /partner-intake/iu,
    /actions\/upload-artifact/iu,
    /npm\s+publish/iu
  ]) assert.doesNotMatch(source, forbidden);

  return Object.freeze({
    status: "SAFE_NO_SECRET_FULL_PREDEPLOYMENT_WORKFLOW_VERIFIED",
    runCommands: Object.freeze([...runCommands])
  });
}

function git(argumentsList) {
  return gitAt(root, argumentsList);
}

function gitAt(repositoryRoot, argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  }).trim();
}

function commitSnapshot(repositoryRoot, commit) {
  const [hash, tree, parents, authorName, authorEmail, committerName, committerEmail, ...subject] = gitAt(
    repositoryRoot,
    ["show", "-s", "--format=%H%n%T%n%P%n%an%n%ae%n%cn%n%ce%n%s", commit]
  ).split("\n");
  return Object.freeze({
    commit: hash,
    tree,
    parents: parents.split(" ").filter(Boolean),
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    subject: subject.join("\n"),
    files: gitAt(repositoryRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
      .split("\n").filter(Boolean).sort()
  });
}

function assertCommitSnapshot(repositoryRoot, expected) {
  const actual = commitSnapshot(repositoryRoot, expected.commit);
  assert.equal(actual.commit, expected.commit);
  assert.equal(actual.tree, expected.tree);
  assert.deepEqual(actual.parents, [expected.parent]);
  for (const field of ["authorName", "authorEmail", "committerName", "committerEmail", "subject"]) {
    assert.equal(actual[field], expected[field], `${expected.commit} ${field} drifted`);
  }
  assert.deepEqual(actual.files, [...expected.files].sort(), `${expected.commit} file scope drifted`);
  if (expected.contractBlob) {
    assert.equal(
      gitAt(repositoryRoot, ["rev-parse", `${expected.commit}:${PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityContractPath}`]),
      expected.contractBlob,
      `${expected.commit} contract blob drifted`
    );
  }
  return actual;
}

function isOverwatchOwnedPath(path) {
  return path.startsWith("overwatch/")
    || path.startsWith("scripts/verify-overwatch-")
    || path.startsWith("tests/overwatch-");
}

export function verifyInfrastructureOwnerBoundary(repositoryRoot, boundary = INFRASTRUCTURE_OWNER_BOUNDARY) {
  for (const expected of boundary.infrastructureCommits) {
    assertCommitSnapshot(repositoryRoot, expected);
    gitAt(repositoryRoot, ["merge-base", "--is-ancestor", expected.commit, "HEAD"]);
  }
  const terminal = boundary.infrastructureCommits.at(-1).commit;
  const descendants = gitAt(repositoryRoot, ["rev-list", "--reverse", `${terminal}..HEAD`])
    .split("\n").filter(Boolean);
  assert.ok(descendants.length >= 1, "known Overwatch successor is missing");
  assert.equal(descendants[0], boundary.knownOverwatchSuccessor.commit);
  assertCommitSnapshot(repositoryRoot, boundary.knownOverwatchSuccessor);

  let previous = terminal;
  let repairSeen = false;
  let ciPortabilityRepairSeen = false;
  let dashboardVerificationSeen = false;
  let dashboardProvenanceAdmissionSeen = false;
  let publicIntakeSmokeSuccessorsSeen = 0;
  let publicIntakeSmokeProvenanceAdmissionSeen = false;
  let cleanRunnerAssetGenerationSeen = false;
  let keychainCiPortabilitySuccessorSeen = false;
  let keychainCiOverwatchMappingSeen = false;
  let keychainCiProvenanceAdmissionSeen = false;
  let keychainCiMappingCompatibilityRepairSeen = false;
  let historicalKeychainFixtureSuccessorsSeen = 0;
  let historicalKeychainFixtureProvenanceAdmissionSeen = false;
  let dashboardRuntimeHarnessSuccessorsSeen = 0;
  let dashboardRuntimeHarnessAdoptionSeen = false;
  let safeNoSecretAssetOrderingRepairSeen = false;
  let cloudflareDeploymentReadRepairSuccessorsSeen = 0;
  let cloudflareDeploymentReadProvenanceAdmissionSeen = false;
  let wranglerDeploymentDiagnosticRepairSeen = false;
  let wranglerDeploymentDiagnosticProvenanceAdmissionSeen = false;
  for (const commit of descendants) {
    const actual = commitSnapshot(repositoryRoot, commit);
    assert.deepEqual(actual.parents, [previous], `${commit} must remain a linear non-merge successor`);
    if (commit === boundary.knownOverwatchSuccessor.commit) {
      previous = commit;
      continue;
    }
    const repair = boundary.boundaryRepairSuccessor;
    const isRepair = !repairSeen
      && actual.parents[0] === repair.parent
      && actual.authorName === repair.authorName
      && actual.authorEmail === repair.authorEmail
      && actual.committerName === repair.committerName
      && actual.committerEmail === repair.committerEmail
      && actual.subject === repair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...repair.files].sort());
    if (isRepair) {
      repairSeen = true;
      previous = commit;
      continue;
    }
    const portabilityRepair = boundary.ciPortabilityRepairSuccessor;
    const isPortabilityRepair = portabilityRepair
      && !ciPortabilityRepairSeen
      && actual.parents[0] === portabilityRepair.parent
      && actual.authorName === portabilityRepair.authorName
      && actual.authorEmail === portabilityRepair.authorEmail
      && actual.committerName === portabilityRepair.committerName
      && actual.committerEmail === portabilityRepair.committerEmail
      && actual.subject === portabilityRepair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...portabilityRepair.files].sort());
    if (isPortabilityRepair) {
      ciPortabilityRepairSeen = true;
      previous = commit;
      continue;
    }
    const dashboardVerification = boundary.dashboardVerificationSuccessor;
    if (dashboardVerification && commit === dashboardVerification.commit) {
      assert.equal(dashboardVerificationSeen, false, "Dashboard verification successor repeated");
      assertCommitSnapshot(repositoryRoot, dashboardVerification);
      dashboardVerificationSeen = true;
      previous = commit;
      continue;
    }
    const dashboardAdmission = boundary.dashboardProvenanceAdmissionSuccessor;
    const isDashboardAdmission = dashboardAdmission
      && !dashboardProvenanceAdmissionSeen
      && dashboardVerificationSeen
      && actual.parents[0] === dashboardAdmission.parent
      && actual.authorName === dashboardAdmission.authorName
      && actual.authorEmail === dashboardAdmission.authorEmail
      && actual.committerName === dashboardAdmission.committerName
      && actual.committerEmail === dashboardAdmission.committerEmail
      && actual.subject === dashboardAdmission.subject
      && JSON.stringify(actual.files) === JSON.stringify([...dashboardAdmission.files].sort());
    if (isDashboardAdmission) {
      dashboardProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    const expectedSmokeSuccessor = boundary.publicIntakeSmokeSuccessors?.[publicIntakeSmokeSuccessorsSeen];
    if (expectedSmokeSuccessor && commit === expectedSmokeSuccessor.commit) {
      assertCommitSnapshot(repositoryRoot, expectedSmokeSuccessor);
      publicIntakeSmokeSuccessorsSeen += 1;
      previous = commit;
      continue;
    }
    const smokeAdmission = boundary.publicIntakeSmokeProvenanceAdmissionSuccessor;
    const isSmokeAdmission = smokeAdmission
      && !publicIntakeSmokeProvenanceAdmissionSeen
      && publicIntakeSmokeSuccessorsSeen === boundary.publicIntakeSmokeSuccessors.length
      && actual.parents[0] === smokeAdmission.parent
      && actual.authorName === smokeAdmission.authorName
      && actual.authorEmail === smokeAdmission.authorEmail
      && actual.committerName === smokeAdmission.committerName
      && actual.committerEmail === smokeAdmission.committerEmail
      && actual.subject === smokeAdmission.subject
      && JSON.stringify(actual.files) === JSON.stringify([...smokeAdmission.files].sort());
    if (isSmokeAdmission) {
      publicIntakeSmokeProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    const cleanRunnerRepair = boundary.cleanRunnerAssetGenerationSuccessor;
    const isCleanRunnerRepair = cleanRunnerRepair
      && !cleanRunnerAssetGenerationSeen
      && actual.parents[0] === cleanRunnerRepair.parent
      && actual.authorName === cleanRunnerRepair.authorName
      && actual.authorEmail === cleanRunnerRepair.authorEmail
      && actual.committerName === cleanRunnerRepair.committerName
      && actual.committerEmail === cleanRunnerRepair.committerEmail
      && actual.subject === cleanRunnerRepair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...cleanRunnerRepair.files].sort());
    if (isCleanRunnerRepair) {
      cleanRunnerAssetGenerationSeen = true;
      previous = commit;
      continue;
    }
    const keychainCiSuccessor = boundary.keychainCiPortabilitySuccessor;
    if (keychainCiSuccessor && commit === keychainCiSuccessor.commit) {
      assert.equal(keychainCiPortabilitySuccessorSeen, false,
        "Keychain CI portability successor repeated");
      assertCommitSnapshot(repositoryRoot, keychainCiSuccessor);
      keychainCiPortabilitySuccessorSeen = true;
      previous = commit;
      continue;
    }
    const keychainCiMapping = boundary.keychainCiOverwatchMappingSuccessor;
    if (keychainCiMapping && commit === keychainCiMapping.commit) {
      assert.equal(keychainCiOverwatchMappingSeen, false,
        "Keychain CI Overwatch mapping repeated");
      assert.equal(keychainCiPortabilitySuccessorSeen, true,
        "Keychain CI Overwatch mapping preceded its owner repair");
      assertCommitSnapshot(repositoryRoot, keychainCiMapping);
      keychainCiOverwatchMappingSeen = true;
      previous = commit;
      continue;
    }
    const keychainCiAdmission = boundary.keychainCiProvenanceAdmissionSuccessor;
    const isKeychainCiAdmission = keychainCiAdmission
      && !keychainCiProvenanceAdmissionSeen
      && keychainCiPortabilitySuccessorSeen
      && keychainCiOverwatchMappingSeen
      && actual.parents[0] === keychainCiAdmission.parent
      && actual.authorName === keychainCiAdmission.authorName
      && actual.authorEmail === keychainCiAdmission.authorEmail
      && actual.committerName === keychainCiAdmission.committerName
      && actual.committerEmail === keychainCiAdmission.committerEmail
      && actual.subject === keychainCiAdmission.subject
      && JSON.stringify(actual.files) === JSON.stringify([...keychainCiAdmission.files].sort());
    if (isKeychainCiAdmission) {
      keychainCiProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    const keychainCiMappingRepair = boundary.keychainCiMappingCompatibilityRepairSuccessor;
    const isKeychainCiMappingRepair = keychainCiMappingRepair
      && !keychainCiMappingCompatibilityRepairSeen
      && keychainCiProvenanceAdmissionSeen
      && actual.parents[0] === keychainCiMappingRepair.parent
      && actual.authorName === keychainCiMappingRepair.authorName
      && actual.authorEmail === keychainCiMappingRepair.authorEmail
      && actual.committerName === keychainCiMappingRepair.committerName
      && actual.committerEmail === keychainCiMappingRepair.committerEmail
      && actual.subject === keychainCiMappingRepair.subject
      && JSON.stringify(actual.files) === JSON.stringify([...keychainCiMappingRepair.files].sort());
    if (isKeychainCiMappingRepair) {
      keychainCiMappingCompatibilityRepairSeen = true;
      previous = commit;
      continue;
    }
    const historicalKeychainFixtureSuccessor =
      boundary.historicalKeychainFixtureSuccessors?.[historicalKeychainFixtureSuccessorsSeen];
    if (historicalKeychainFixtureSuccessor
      && commit === historicalKeychainFixtureSuccessor.commit) {
      assertCommitSnapshot(repositoryRoot, historicalKeychainFixtureSuccessor);
      historicalKeychainFixtureSuccessorsSeen += 1;
      previous = commit;
      continue;
    }
    const historicalKeychainFixtureAdmission =
      boundary.historicalKeychainFixtureProvenanceAdmissionSuccessor;
    const isHistoricalKeychainFixtureAdmission = historicalKeychainFixtureAdmission
      && !historicalKeychainFixtureProvenanceAdmissionSeen
      && historicalKeychainFixtureSuccessorsSeen ===
        boundary.historicalKeychainFixtureSuccessors.length
      && actual.parents[0] === historicalKeychainFixtureAdmission.parent
      && actual.authorName === historicalKeychainFixtureAdmission.authorName
      && actual.authorEmail === historicalKeychainFixtureAdmission.authorEmail
      && actual.committerName === historicalKeychainFixtureAdmission.committerName
      && actual.committerEmail === historicalKeychainFixtureAdmission.committerEmail
      && actual.subject === historicalKeychainFixtureAdmission.subject
      && JSON.stringify(actual.files) ===
        JSON.stringify([...historicalKeychainFixtureAdmission.files].sort());
    if (isHistoricalKeychainFixtureAdmission) {
      historicalKeychainFixtureProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    const dashboardRuntimeHarnessSuccessor =
      boundary.dashboardRuntimeHarnessSuccessors?.[dashboardRuntimeHarnessSuccessorsSeen];
    if (dashboardRuntimeHarnessSuccessor
      && commit === dashboardRuntimeHarnessSuccessor.commit) {
      assertCommitSnapshot(repositoryRoot, dashboardRuntimeHarnessSuccessor);
      dashboardRuntimeHarnessSuccessorsSeen += 1;
      previous = commit;
      continue;
    }
    const dashboardRuntimeHarnessAdoption = boundary.dashboardRuntimeHarnessAdoptionSuccessor;
    const isDashboardRuntimeHarnessAdoption = dashboardRuntimeHarnessAdoption
      && !dashboardRuntimeHarnessAdoptionSeen
      && dashboardRuntimeHarnessSuccessorsSeen ===
        boundary.dashboardRuntimeHarnessSuccessors.length
      && actual.parents[0] === dashboardRuntimeHarnessAdoption.parent
      && actual.authorName === dashboardRuntimeHarnessAdoption.authorName
      && actual.authorEmail === dashboardRuntimeHarnessAdoption.authorEmail
      && actual.committerName === dashboardRuntimeHarnessAdoption.committerName
      && actual.committerEmail === dashboardRuntimeHarnessAdoption.committerEmail
      && actual.subject === dashboardRuntimeHarnessAdoption.subject
      && JSON.stringify(actual.files) ===
        JSON.stringify([...dashboardRuntimeHarnessAdoption.files].sort());
    if (isDashboardRuntimeHarnessAdoption) {
      dashboardRuntimeHarnessAdoptionSeen = true;
      previous = commit;
      continue;
    }
    const safeNoSecretAssetOrderingRepair =
      boundary.safeNoSecretAssetOrderingRepairSuccessor;
    const isSafeNoSecretAssetOrderingRepair = safeNoSecretAssetOrderingRepair
      && !safeNoSecretAssetOrderingRepairSeen
      && dashboardRuntimeHarnessAdoptionSeen
      && actual.parents[0] === safeNoSecretAssetOrderingRepair.parent
      && actual.authorName === safeNoSecretAssetOrderingRepair.authorName
      && actual.authorEmail === safeNoSecretAssetOrderingRepair.authorEmail
      && actual.committerName === safeNoSecretAssetOrderingRepair.committerName
      && actual.committerEmail === safeNoSecretAssetOrderingRepair.committerEmail
      && actual.subject === safeNoSecretAssetOrderingRepair.subject
      && JSON.stringify(actual.files) ===
        JSON.stringify([...safeNoSecretAssetOrderingRepair.files].sort());
    if (isSafeNoSecretAssetOrderingRepair) {
      safeNoSecretAssetOrderingRepairSeen = true;
      previous = commit;
      continue;
    }
    const cloudflareDeploymentReadRepair =
      boundary.cloudflareDeploymentReadRepairSuccessors?.[
        cloudflareDeploymentReadRepairSuccessorsSeen
      ];
    if (cloudflareDeploymentReadRepair && commit === cloudflareDeploymentReadRepair.commit) {
      assertCommitSnapshot(repositoryRoot, cloudflareDeploymentReadRepair);
      cloudflareDeploymentReadRepairSuccessorsSeen += 1;
      previous = commit;
      continue;
    }
    const cloudflareDeploymentReadAdmission =
      boundary.cloudflareDeploymentReadProvenanceAdmissionSuccessor;
    const isCloudflareDeploymentReadAdmission = cloudflareDeploymentReadAdmission
      && !cloudflareDeploymentReadProvenanceAdmissionSeen
      && cloudflareDeploymentReadRepairSuccessorsSeen
        === boundary.cloudflareDeploymentReadRepairSuccessors.length
      && actual.parents[0] === cloudflareDeploymentReadAdmission.parent
      && actual.authorName === cloudflareDeploymentReadAdmission.authorName
      && actual.authorEmail === cloudflareDeploymentReadAdmission.authorEmail
      && actual.committerName === cloudflareDeploymentReadAdmission.committerName
      && actual.committerEmail === cloudflareDeploymentReadAdmission.committerEmail
      && actual.subject === cloudflareDeploymentReadAdmission.subject
      && JSON.stringify(actual.files)
        === JSON.stringify([...cloudflareDeploymentReadAdmission.files].sort());
    if (isCloudflareDeploymentReadAdmission) {
      cloudflareDeploymentReadProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    const wranglerDeploymentDiagnosticRepair =
      boundary.wranglerDeploymentDiagnosticRepairSuccessor;
    if (wranglerDeploymentDiagnosticRepair
      && commit === wranglerDeploymentDiagnosticRepair.commit) {
      assert.equal(wranglerDeploymentDiagnosticRepairSeen, false,
        "Wrangler deployment diagnostic repair repeated");
      assertCommitSnapshot(repositoryRoot, wranglerDeploymentDiagnosticRepair);
      wranglerDeploymentDiagnosticRepairSeen = true;
      previous = commit;
      continue;
    }
    const wranglerDeploymentDiagnosticAdmission =
      boundary.wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor;
    const isWranglerDeploymentDiagnosticAdmission = wranglerDeploymentDiagnosticAdmission
      && !wranglerDeploymentDiagnosticProvenanceAdmissionSeen
      && wranglerDeploymentDiagnosticRepairSeen
      && actual.parents[0] === wranglerDeploymentDiagnosticAdmission.parent
      && actual.authorName === wranglerDeploymentDiagnosticAdmission.authorName
      && actual.authorEmail === wranglerDeploymentDiagnosticAdmission.authorEmail
      && actual.committerName === wranglerDeploymentDiagnosticAdmission.committerName
      && actual.committerEmail === wranglerDeploymentDiagnosticAdmission.committerEmail
      && actual.subject === wranglerDeploymentDiagnosticAdmission.subject
      && JSON.stringify(actual.files)
        === JSON.stringify([...wranglerDeploymentDiagnosticAdmission.files].sort());
    if (isWranglerDeploymentDiagnosticAdmission) {
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen = true;
      previous = commit;
      continue;
    }
    assert.equal(actual.authorName, "Prometheus Overwatch");
    assert.equal(actual.authorEmail, "overwatch@prometheus.local");
    assert.equal(actual.committerName, "Prometheus Overwatch");
    assert.equal(actual.committerEmail, "overwatch@prometheus.local");
    assert.match(actual.subject, /^overwatch: /u);
    assert.ok(actual.files.length > 0 && actual.files.every(isOverwatchOwnedPath));
    previous = commit;
  }
  const result = {
    terminalOwnerCommit: terminal,
    descendants: descendants.length,
    repairSeen,
    ciPortabilityRepairSeen,
    dashboardVerificationSeen,
    dashboardProvenanceAdmissionSeen
  };
  if (boundary.publicIntakeSmokeSuccessors) {
    result.publicIntakeSmokeSuccessorsSeen = publicIntakeSmokeSuccessorsSeen;
    result.publicIntakeSmokeProvenanceAdmissionSeen = publicIntakeSmokeProvenanceAdmissionSeen;
  }
  if (boundary.cleanRunnerAssetGenerationSuccessor) {
    result.cleanRunnerAssetGenerationSeen = cleanRunnerAssetGenerationSeen;
  }
  if (boundary.keychainCiPortabilitySuccessor) {
    result.keychainCiPortabilitySuccessorSeen = keychainCiPortabilitySuccessorSeen;
    result.keychainCiOverwatchMappingSeen = keychainCiOverwatchMappingSeen;
    result.keychainCiProvenanceAdmissionSeen = keychainCiProvenanceAdmissionSeen;
    result.keychainCiMappingCompatibilityRepairSeen =
      keychainCiMappingCompatibilityRepairSeen;
  }
  if (boundary.historicalKeychainFixtureSuccessors) {
    result.historicalKeychainFixtureSuccessorsSeen =
      historicalKeychainFixtureSuccessorsSeen;
    result.historicalKeychainFixtureProvenanceAdmissionSeen =
      historicalKeychainFixtureProvenanceAdmissionSeen;
  }
  if (boundary.dashboardRuntimeHarnessSuccessors) {
    result.dashboardRuntimeHarnessSuccessorsSeen = dashboardRuntimeHarnessSuccessorsSeen;
    result.dashboardRuntimeHarnessAdoptionSeen = dashboardRuntimeHarnessAdoptionSeen;
  }
  if (boundary.safeNoSecretAssetOrderingRepairSuccessor) {
    result.safeNoSecretAssetOrderingRepairSeen = safeNoSecretAssetOrderingRepairSeen;
  }
  if (boundary.cloudflareDeploymentReadRepairSuccessors) {
    result.cloudflareDeploymentReadRepairSuccessorsSeen =
      cloudflareDeploymentReadRepairSuccessorsSeen;
    result.cloudflareDeploymentReadProvenanceAdmissionSeen =
      cloudflareDeploymentReadProvenanceAdmissionSeen;
  }
  if (boundary.wranglerDeploymentDiagnosticRepairSuccessor) {
    result.wranglerDeploymentDiagnosticRepairSeen = wranglerDeploymentDiagnosticRepairSeen;
    result.wranglerDeploymentDiagnosticProvenanceAdmissionSeen =
      wranglerDeploymentDiagnosticProvenanceAdmissionSeen;
  }
  return Object.freeze(result);
}

export function classifyInfrastructureOwnerVerifierFailure(error) {
  if (error?.message === "public_forward_rollback_source_map_outside_boundary") {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY;
  }
  if (error instanceof PublicDeploymentPolicyError) {
    if (error.code === PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED) {
      return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.REPOSITORY_INTEGRITY_FAILED;
    }
    if (error.code === PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID) {
      return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_INVALID;
    }
  }
  if (typeof error?.message === "string"
    && error.message.startsWith("public_forward_rollback_")) {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.ROLLBACK_GENERATION_FAILED;
  }
  if (error?.code === "ERR_ASSERTION") {
    return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.CONTRACT_OR_PROVENANCE_INVALID;
  }
  return INFRASTRUCTURE_OWNER_VERIFIER_FAILURE.INTERNAL_FAILURE;
}

export function verifyRouteIqPublicRepositoryIntegrityRepair() {
  const contract = JSON.parse(read(contractPath));
  assert.equal(contract.version, "route-iq-public-repository-integrity-repair-v1");
  assert.equal(contract.batchId, "BATCH-20260719-008");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(
    contract.status,
    "OWNER_WRANGLER_DEPLOYMENT_DIAGNOSTIC_REPAIR_ADMITTED_NOT_PUSHED_NOT_DEPLOYED"
  );
  assert.deepEqual(contract.ownerFiles, expectedOwnerFiles);
  assert.deepEqual(contract.ownerBoundary, INFRASTRUCTURE_OWNER_BOUNDARY);
  assert.deepEqual(contract.baseline, {
    branch: "main",
    head: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d",
    tree: "f86156dc10fb90cedc00274d3654e89edfff562a",
    originMain: "d5174c50ee7b02f930b5fa1f50723ce9db3e447d"
  });
  assert.equal(git(["rev-parse", `${contract.baseline.head}^{tree}`]), contract.baseline.tree);
  git(["merge-base", "--is-ancestor", contract.baseline.head, "HEAD"]);
  const ownerBoundary = verifyInfrastructureOwnerBoundary(root);
  if (git(["rev-parse", "HEAD"]) !== INFRASTRUCTURE_OWNER_BOUNDARY.ciPortabilityRepairSuccessor.parent) {
    assert.equal(ownerBoundary.ciPortabilityRepairSeen, true);
  }
  assert.equal(ownerBoundary.dashboardVerificationSeen, true);
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY.dashboardProvenanceAdmissionSuccessor.parent) {
    assert.equal(ownerBoundary.dashboardProvenanceAdmissionSeen, true);
  }
  assert.equal(
    ownerBoundary.publicIntakeSmokeSuccessorsSeen,
    INFRASTRUCTURE_OWNER_BOUNDARY.publicIntakeSmokeSuccessors.length
  );
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY.publicIntakeSmokeProvenanceAdmissionSuccessor.parent) {
    assert.equal(ownerBoundary.publicIntakeSmokeProvenanceAdmissionSeen, true);
  }
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY.cleanRunnerAssetGenerationSuccessor.parent) {
    assert.equal(ownerBoundary.cleanRunnerAssetGenerationSeen, true);
  }
  assert.equal(
    ownerBoundary.dashboardRuntimeHarnessSuccessorsSeen,
    INFRASTRUCTURE_OWNER_BOUNDARY.dashboardRuntimeHarnessSuccessors.length
  );
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY.dashboardRuntimeHarnessAdoptionSuccessor.parent) {
    assert.equal(ownerBoundary.dashboardRuntimeHarnessAdoptionSeen, true);
  }
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY.safeNoSecretAssetOrderingRepairSuccessor.parent) {
    assert.equal(ownerBoundary.safeNoSecretAssetOrderingRepairSeen, true);
  }
  assert.equal(
    ownerBoundary.cloudflareDeploymentReadRepairSuccessorsSeen,
    INFRASTRUCTURE_OWNER_BOUNDARY.cloudflareDeploymentReadRepairSuccessors.length
  );
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY
      .cloudflareDeploymentReadProvenanceAdmissionSuccessor.parent) {
    assert.equal(ownerBoundary.cloudflareDeploymentReadProvenanceAdmissionSeen, true);
  }
  assert.equal(ownerBoundary.wranglerDeploymentDiagnosticRepairSeen, true);
  if (git(["rev-parse", "HEAD"])
    !== INFRASTRUCTURE_OWNER_BOUNDARY
      .wranglerDeploymentDiagnosticProvenanceAdmissionSuccessor.parent) {
    assert.equal(ownerBoundary.wranglerDeploymentDiagnosticProvenanceAdmissionSeen, true);
  }

  assert.deepEqual(contract.cloudflareDeploymentReadRepair, {
    failedRunId: 29780926642,
    failedHead: "5c920ad7c56289791d12c756d4b9627bf18b4632",
    failedTree: "5db5225a8f09d5e2295a89d4a7f2a3fa1305ff8b",
    classificationCommit: "e896cabe19fc696834659ed1cbe05f027c434553",
    classificationTree: "d70f2f892755e1d9f86dd08be3d559344b5fcc66",
    deadlineCommit: "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
    deadlineTree: "f62ebac98952b9cc1156a81e9bf0cec2e0563dcb",
    observedDeadlineMs: 15000,
    productionDeadlineMs: 30000,
    testDeadlineMaximumMs: 1000,
    maximumSerializedStateReads: 12,
    maximumSerializedReadBudgetMs: 360000,
    retriesAllowed: 0,
    deploymentAttemptsAllowed: 1,
    publicVersionCreated: false,
    rollbackRequired: false,
    deploymentAssetsModified: false,
    rollbackArtifactsModified: false,
    cloudflareContactedByRepair: false
  });

  assert.deepEqual(contract.wranglerDeploymentDiagnosticRepair, {
    batchId: "BATCH-20260720-007",
    failedRunId: 29786701514,
    failedHead: "9a2c27da613f1222039c5a8ae583ce9f70d98056",
    failedTree: "f28390609db59464e6c520d3201d281d044bb770",
    repairCommit: "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    repairTree: "31abba310779208a7f940321adfe8916a8dd31ca",
    preRepairFailureDimension: "UNCLASSIFIABLE_FROM_PRE_REPAIR_WRAPPER",
    matchingSuccessfulCloudflareMutationAuditEntries: 0,
    retroactiveReasonAssignmentAllowed: false,
    priorRunEvidencePreservedSeparately: true,
    cloudflareContactedByRepair: false,
    deploymentPerformedByRepair: false,
    deploymentAssetsModified: false,
    rollbackArtifactsModified: false
  });

  assert.deepEqual(contract.cleanRunnerAssetGenerationRepair, {
    batchId: "BATCH-20260720-002",
    owner: "Prometheus Infrastructure",
    failedRunId: 29723618108,
    baselineHead: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    baselineTree: "e0d86821386d2f3d348eb88ae25f85f367878280",
    rootCause: "DIST_PUBLIC_WAS_READ_BEFORE_DETERMINISTIC_BUILD_ON_A_CLEAN_RUNNER",
    generatedDirectory: "dist-public",
    buildCommand: "npm run build",
    jobsRepaired: ["verification", "deploy"],
    buildAfterDependencyInstall: true,
    buildBeforeNoSecretVerification: true,
    deploymentAssetsModified: false,
    rollbackArtifactModified: false,
    workflowRerunPerformed: false,
    deploymentPerformed: false,
    cloudflareContacted: false
  });

  const failed = contract.failedRun;
  assert.equal(failed.runId, 29714512987);
  assert.equal(failed.verificationJobId, 88264893824);
  assert.equal(failed.deploymentJobId, 88264927103);
  assert.equal(failed.head, contract.baseline.head);
  assert.equal(failed.tree, contract.baseline.tree);
  assert.equal(failed.gitVersion, "2.54.0");
  assert.equal(failed.fetchDepth, 0);
  assert.equal(failed.command, "node scripts/run-github-actions-public-worker-deployment.mjs verify");
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.sanitizedStdout, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(failed.sanitizedStderr, "");
  assert.equal(failed.reportedResult, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(failed.gitFsckExecuted, false);
  assert.equal(failed.artifactsProduced, 0);
  assert.equal(failed.deploymentJobSkipped, true);
  assert.equal(failed.protectedEnvironmentAccessed, false);
  assert.equal(failed.cloudflareContacted, false);
  assert.equal(failed.immutableEvidence, true);

  const reproduction = contract.reproduction;
  assert.equal(reproduction.suppressedDiagnostic, "ROLLBACK_HASH_MISMATCH");
  assert.equal(reproduction.previouslySuppressedGitFsckDiagnostic, "NONE_FSCK_NOT_REACHED");
  assert.equal(reproduction.failureStage, "ROLLBACK_ARTIFACT_VERIFICATION_BEFORE_GIT_FSCK");
  assert.equal(reproduction.reachableRepositoryCorruptionReproduced, false);
  assert.equal(reproduction.runnerSpecificGitCauseProven, false);
  assert.deepEqual(reproduction.localFullStrictFsck, {
    exitCode: 0,
    outputBytes: 237516,
    outputLines: 4318,
    benignDanglingLines: 4318
  });
  assert.deepEqual(reproduction.cleanFullCheckoutStrictFsck, {
    exitCode: 0,
    outputBytes: 0,
    outputLines: 0
  });
  assert.notEqual(
    reproduction.preRepairRollbackIdentity.localArtifactSha256,
    reproduction.preRepairRollbackIdentity.cleanCheckoutArtifactSha256
  );
  assert.notEqual(
    reproduction.preRepairRollbackIdentity.localGeneratedWorkerSha256,
    reproduction.preRepairRollbackIdentity.cleanCheckoutGeneratedWorkerSha256
  );

  const repair = contract.repair;
  assert.deepEqual(repair.gitIntegrityArguments, [
    "fsck", "--full", "--strict", "--no-dangling", "--no-progress"
  ]);
  assert.equal(repair.fsckCaptureLimitBytes, 131072);
  for (const field of [
    "systemGitConfigurationDisabled",
    "globalGitConfigurationDisabled",
    "shallowRepositoryRejected",
    "partialCloneRejected",
    "promisorRepositoryRejected",
    "unsupportedObjectFormatRejected",
    "boundedNonsecretDiagnostics",
    "nonemptySuccessfulFsckOutputRejected",
    "integrityRunsBeforeRollbackAndCredentialAccess",
    "exactHttpsAndSshRepositoryOriginsOnly",
    "generatedWorkerPathsCanonicalized",
    "filesystemAliasPathsCanonicalized",
    "sourceMapSourcesResolvedAgainstValidatedRoot",
    "sourceMapRealpathContainmentRequired"
  ]) assert.equal(repair[field], true, `${field} must remain enabled`);
  assert.equal(repair.genericOwnerVerifierFailureAllowed, false);
  assert.equal(repair.fsckFailureOutputExposed, false);
  assert.equal(repair.unknownPreflightFailureClass, "PREFLIGHT_FAILED");
  assert.equal(repair.rollbackFailureClass, "ROLLBACK_INVALID");
  assert.equal(repair.repositoryFailureClass, "REPOSITORY_INTEGRITY_FAILED");

  const rollback = buildPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, repair.canonicalRollbackIdentity.artifactSha256);
  for (const field of [
    "candidateDeploymentAssetsSha256",
    "websiteAssetsSha256",
    "configurationSha256",
    "generatedWorkerSha256",
    "generatedSourceMapSha256"
  ]) assert.equal(rollback[field], repair.canonicalRollbackIdentity[field]);

  const safeCi = contract.safeCiVerification;
  assert.equal(safeCi.workflow, PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath);
  assert.equal(safeCi.trigger, "workflow_dispatch");
  assert.equal(safeCi.dispatched, true);
  assert.equal(safeCi.contentsPermission, "read");
  assert.equal(safeCi.pinnedNodeVersion, "24");
  for (const field of [
    "checkoutBeforeNodeSetup",
    "nodeSetupBeforeRepositoryScripts",
    "diagnosticBeforeDependencyInstall",
    "diagnosticBeforeRollbackGeneration"
  ]) assert.equal(safeCi[field], true, `${field} must remain enabled`);
  for (const field of [
    "automaticTriggersAllowed",
    "protectedEnvironmentUsed",
    "secretsAllowed",
    "cloudflareRequestsAllowed",
    "deploymentAllowed",
    "productionMutationAllowed",
    "crmSubmissionAllowed"
  ]) assert.equal(safeCi[field], false, `${field} must remain disabled`);

  const fullPredeploymentCi = contract.safeNoSecretFullPredeploymentCi;
  assert.deepEqual(fullPredeploymentCi, {
    batchId: "BATCH-20260720-006",
    owner: "Prometheus Infrastructure",
    workflow: PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath,
    workflowSha256: "025bbc2fa4802a737d85d40d1ab3c38334c9458fa29b19a78f9b151da8bcb4b9",
    trigger: "workflow_dispatch",
    repository: "PrometheusRouteIQ/prometheus-iq",
    founderActor: "PrometheusRouteIQ",
    branch: "main",
    runAttempt: 1,
    runner: "ubuntu-latest",
    timeoutMinutes: 90,
    contentsPermission: "read",
    requiredCommands: SAFE_NO_SECRET_PREDEPLOYMENT_RUN_COMMANDS,
    finalCleanGitChecks: [
      "git diff --exit-code",
      "git diff --cached --exit-code",
      "test -z \"$(git status --porcelain=v1 --untracked-files=all)\"",
      "node scripts/run-public-worker-repository-integrity-diagnostic.mjs"
    ],
    protectedEnvironmentUsed: false,
    secretsAllowed: false,
    cloudflareRequestsAllowed: false,
    deploymentAllowed: false,
    productionMutationAllowed: false,
    crmSubmissionAllowed: false,
    notificationAllowed: false,
    workflowDispatchPerformed: false
  });
  assert.equal(sha256(fullPredeploymentCi.workflow), fullPredeploymentCi.workflowSha256);
  verifySafeNoSecretPredeploymentWorkflow();

  assert.deepEqual(contract.safeCiFailure, {
    runId: 29717192952,
    jobId: 88272671229,
    head: "8d312bf747a289c675eb37adf582b43c860c635e",
    tree: "36f163193fdb91cf241ddb0ff03bce200c7506c6",
    runner: "ubuntu-24.04",
    gitVersion: "2.54.0",
    nodeVersion: "24.18.0",
    npmVersion: "11.16.0",
    refCount: 7,
    origin: "HTTPS_EXACT_REPOSITORY",
    tagsPresent: false,
    repositoryIntegrityDiagnostic: "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED",
    ownerVerifierOutput: "FAIL",
    exactFailure: "PUBLIC_FORWARD_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
    rejectedSourceCount: 53,
    sourceMapRootValidated: true,
    deployCapabilityPresent: false,
    protectedEnvironmentAccessed: false,
    secretsAccessed: false,
    cloudflareContacted: false,
    productionMutated: false,
    consumed: true
  });

  const safeWorkflow = read(PUBLIC_WORKER_DEPLOYMENT_POLICY.integrityWorkflowPath);
  const checkout = safeWorkflow.indexOf("uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5");
  const setupNode = safeWorkflow.indexOf("uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
  const firstRepositoryNodeScript = safeWorkflow.indexOf("run: node scripts/");
  const diagnostic = safeWorkflow.indexOf("run: node scripts/run-public-worker-repository-integrity-diagnostic.mjs");
  const npmInstall = safeWorkflow.indexOf("run: npm ci");
  const deterministicBuild = safeWorkflow.indexOf("run: npm run build");
  const repositorySuite = safeWorkflow.indexOf("run: npm test");
  const rollbackVerification = safeWorkflow.indexOf(
    "run: node scripts/verify-route-iq-public-repository-integrity-repair.mjs"
  );
  assert.ok(checkout >= 0 && checkout < setupNode);
  assert.ok(setupNode < firstRepositoryNodeScript);
  assert.equal(firstRepositoryNodeScript, diagnostic);
  assert.ok(
    diagnostic < npmInstall
      && npmInstall < deterministicBuild
      && deterministicBuild < repositorySuite
      && repositorySuite < rollbackVerification
  );

  assert.deepEqual(contract.safeNoSecretAssetOrderingRepair, {
    batchId: "BATCH-20260720-006",
    owner: "Prometheus Infrastructure",
    failedRunId: 29776569151,
    failedJobId: 88467261279,
    head: "5d5ffe858d7e132778c96746eabd4a99afe9d1f4",
    tree: "e0164513b6a807796558c2d7bf6c059184839659",
    runner: "ubuntu-24.04",
    nodeVersion: "24.18.0",
    classification: "DIST_PUBLIC_READ_BEFORE_BUILD_IN_SAFE_NO_SECRET_WORKFLOW",
    failingCommand: "npm test",
    failingPath: "dist-public",
    dependencyInstallPassed: true,
    dashboardHarnessReached: false,
    deploymentCapabilityPresent: false,
    protectedEnvironmentAccessed: false,
    secretsAccessed: false,
    cloudflareContacted: false,
    productionMutated: false,
    repair: {
      command: "npm run build",
      afterDependencyInstall: true,
      beforeRepositorySuite: true,
      topLevelBuildSteps: 1,
      assetParityPreserved: true,
      failureHidden: false,
      blanketRetryAdded: false,
      continueOnErrorAdded: false
    }
  });

  assert.deepEqual(contract.successorRepair, {
    owner: "Prometheus Infrastructure",
    classification: "PINNED_NODE_ORDERING_REPAIR",
    predecessorCommit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    predecessorAmended: false,
    ambientHostedNodeAllowed: false,
    repositoryNodeExecutionOrder: [
      "CHECKOUT_COMPLETE_HISTORY",
      "SETUP_PINNED_NODE_24",
      "RUN_REPOSITORY_DIAGNOSTIC",
      "INSTALL_LOCKED_DEPENDENCIES",
      "VERIFY_ROLLBACK_IDENTITY"
    ]
  });

  assert.deepEqual(contract.ciPortabilityRepair, {
    owner: "Prometheus Infrastructure",
    classification: "SOURCE_MAP_ROOT_RELATIVE_RESOLUTION_REPAIR",
    predecessorCommit: "8d312bf747a289c675eb37adf582b43c860c635e",
    predecessorCommitsPreserved: true,
    rootCause:
      "RELATIVE_SOURCE_MAP_ENTRIES_WERE_RESOLVED_FROM_PROCESS_CWD_INSTEAD_OF_VALIDATED_SOURCE_ROOT",
    macPathCoincidenceMaskedFailure: true,
    githubRefShapeCausedFailure: false,
    fixedFailureClassification: "OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY",
    automaticRetryAllowed: false,
    safeCiRunConsumed: true
  });

  assert.deepEqual(contract.dashboardVerificationProvenance, {
    classification: "DASHBOARD_TEST_ONLY_WALL_CLOCK_STABILIZATION",
    implementationOwner: "Prometheus Dashboard",
    verificationOwner: "Prometheus Infrastructure",
    commit: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    tree: "2bd8186faafd7c922c17da9401c6dddbc64163bb",
    parent: "03ed86e25bda0a67e55757969966f4bc61c4b63e",
    files: dashboardVerificationSuccessorFiles,
    fileSha256: {
      "scripts/verify-dashboard-runtime-workflows.mjs":
        "6834b7ee4ef2091e489d356fe868dead38881e1340ff37c17f96afe308060be2",
      "tests/dashboard-route-iq-product-focus.test.mjs":
        "5d012fd1bbc31000ae92196eefc6a53af81b850faa01c22cdb7fb96750cfabaf"
    },
    focusedTestsPassed: 8,
    browserWorkflowChecksPassed: 184,
    productRuntimeModified: false,
    generatedDeploymentAssetsModified: false,
    generallyAuthorizesDashboardSuccessors: false
  });
  for (const [path, expected] of Object.entries(contract.dashboardVerificationProvenance.fileSha256)) {
    assert.equal(
      sha256AtCommit(contract.dashboardVerificationProvenance.commit, path),
      expected,
      `${path} historical Dashboard verification evidence drifted`
    );
  }

  assert.deepEqual(contract.dashboardRuntimeHarnessProvenance, {
    batchId: "BATCH-20260720-005",
    failedRunId: 29764135072,
    implementationOwner: "Prometheus Dashboard",
    verificationOwner: "Prometheus Infrastructure",
    classification: "DASHBOARD_CROSS_PLATFORM_CDP_HARNESS_LIFECYCLE_REPAIR",
    rootCauses: [
      "MACOS_ONLY_DEFAULT_CHROME_PATH_ON_UBUNTU",
      "ASYNCHRONOUS_SPAWN_FAILURE_MASKED_AS_GENERIC_FETCH_FAILURE",
      "UNRESERVED_RANDOM_CDP_PORT",
      "CLEANUP_REGISTERED_AFTER_READINESS",
      "READINESS_BUDGET_TOO_SHORT_UNDER_CPU_CONTENTION",
      "CDP_PAGE_TARGETS_NOT_CLOSED_BETWEEN_SCENARIOS"
    ],
    ownerCommits: [
      {
        commit: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
        tree: "ace6df9882d8033c5ffc08770b60a35653434e7e",
        parent: "3a2bd37f779e070b868256178bc40dbede8605c8",
        subject: "dashboard: stabilize runtime harness startup"
      },
      {
        commit: "577b9217185be2324824c5c4eeeaf6cd89300477",
        tree: "37c857d916b336b87e7f4f878d74332cc62cf329",
        parent: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
        subject: "Harden Dashboard Chrome harness lifecycle"
      }
    ],
    ownerIdentity: {
      authorName: "Prometheus Dashboard",
      authorEmail: "dashboard@prometheus.local",
      committerName: "Prometheus Dashboard",
      committerEmail: "dashboard@prometheus.local"
    },
    files: dashboardRuntimeHarnessSuccessorFiles,
    fileSha256: {
      "scripts/verify-dashboard-runtime-workflows.mjs":
        "a8de222e3365885ecb866a1700f1c1b78f43aec58718246b9a4de663d5734f4d",
      "tests/dashboard-route-iq-product-focus.test.mjs":
        "81a88eae103a380d0e2e4b070636dca8033c143abf0b00b72d004b66487683ef"
    },
    focusedTestsPassed: 18,
    browserWorkflowChecksPassed: 185,
    consecutiveRealChromeRunsPassed: 3,
    concurrentRealChromeLaunchesPassed: 4,
    startupInterruptCleanupPassed: true,
    productRuntimeModified: false,
    publicWebsiteModified: false,
    crmModified: false,
    generatedDeploymentAssetsModified: false,
    rollbackContractModified: false,
    generallyAuthorizesDashboardSuccessors: false
  });
  for (const [path, expected] of Object.entries(
    contract.dashboardRuntimeHarnessProvenance.fileSha256
  )) {
    assert.equal(sha256(path), expected, `${path} final Dashboard harness evidence drifted`);
  }

  assert.deepEqual(contract.preservation.gitObjects, expectedPreservedObjects);
  for (const [path, expected] of Object.entries(expectedPreservedObjects)) {
    assert.equal(git(["rev-parse", `HEAD:${path}`]), expected, `${path} changed`);
  }
  assert.equal(
    sha256("overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json"),
    contract.preservation.previousReadinessSuccessorSha256
  );
  assert.equal(git([
    "diff", "--name-only", `${contract.baseline.head}..HEAD`, "--",
    "src", "crm", "deploy/prometheusrouteiq-website", "workers/prometheus-iq-worker.js",
    "wrangler.prometheusrouteiq-website.jsonc",
    "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json"
  ]), "");
  for (const field of [
    "websiteImplementationModified",
    "crmImplementationModified",
    "dashboardRuntimeModified",
    "generatedDeploymentAssetsModified",
    "previousReadinessSuccessorModified"
  ]) assert.equal(contract.preservation[field], false);

  for (const field of [
    "deploymentPerformed",
    "protectedEnvironmentAccessed",
    "secretAccessed",
    "cloudflareContacted",
    "productionDataMutated",
    "crmRequestSubmitted",
    "notificationSent",
    "privateWorkerModified"
  ]) assert.equal(contract.boundaries[field], false, `${field} boundary widened`);
  assert.equal(contract.boundaries.safeNonDeploymentWorkflowDispatched, true);
  assert.equal(contract.boundaries.deploymentWorkflowDispatched, false);
  assert.equal(contract.boundaries.historicalRepairRangePushed, true);
  assert.equal(contract.boundaries.currentRepairPushPerformed, false);
  assert.equal(contract.boundaries.collection, "OFF");
  assert.equal(contract.boundaries.activeCohortCount, 0);
  assert.equal(contract.boundaries.recommendationInfluence, "OFF");

  verifyPublicRepositoryIntegrity(root);
  return Object.freeze({
    status: "ROUTE_IQ_PUBLIC_REPOSITORY_INTEGRITY_REPAIR_VERIFIED",
    rollbackArtifactSha256: rollback.artifactSha256
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${verifyRouteIqPublicRepositoryIntegrityRepair().status}\n`);
  } catch (error) {
    process.stdout.write(`${classifyInfrastructureOwnerVerifierFailure(error)}\n`);
    process.exitCode = 1;
  }
}
