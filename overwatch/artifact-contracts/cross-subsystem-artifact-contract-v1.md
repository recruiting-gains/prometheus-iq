# Cross-Subsystem Artifact Contract v1

## Purpose

This contract is the Prometheus subsystem connection layer. It defines how Prometheus subsystems communicate through canonical artifacts without duplicating ownership or contaminating workspaces.

## Architecture Law

Platform-level systems are shared. Workspace-level data is isolated.

No subsystem may:

- Regenerate another subsystem's artifact.
- Invent missing data.
- Consume fixture or demo data in production.
- Write into another subsystem's owned artifact path.
- Continue when an expected canonical artifact is missing.
- Mix customer data across workspaces.

Unknown or missing artifacts must fail closed.

## Canonical Registry

The machine-readable registry is:

`overwatch/artifact-contracts/canonical-artifact-registry.json`

Overwatch validation is:

`scripts/verify-cross-subsystem-artifact-contracts.mjs`

## Ownership Rules

Research writes dossiers.

Dashboard reads dossiers only.

CRM writes activity, lead, candidate, handoff, and pipeline state only through CRM-owned contracts and approved runtime paths.

Intelligence reads Research and CRM artifacts and may produce interpretation only through approved Intelligence-owned contracts.

Overwatch verifies contract consistency, canonical paths, workspace isolation, source/deploy parity, and fixture/demo-data prohibition.

## Smoothie Depot Canonical Artifacts

Research-owned:

- `research/workspaces/smoothie-depot/dossiers/dossier-register.json`
- `research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.md`
- `research/workspaces/smoothie-depot/dossiers/nutrition-depot-executive-due-diligence-dossier-v1.json`
- `research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json`

Dashboard-owned read-only consumers:

- `smoothie-depot-dashboard/index.html`
- `deploy/cloudflare-pages/smoothie-depot-dashboard/index.html`
- `smoothie-depot-dashboard/command-center.js`
- `deploy/cloudflare-pages/smoothie-depot-dashboard/command-center.js`

CRM-owned contracts and entry points:

- `crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json`
- `crm/crm-foundation.mjs`
- `consumeWorkspaceLeadIntakeHandoff`

Intelligence-owned planning contracts:

- `intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json`
- `intelligence/contracts/business-acquisition-intelligence-contracts.json`

## Fitness Connection Canonical Artifacts

Overwatch-owned workspace contracts:

- `overwatch/artifact-contracts/workspaces/fitness-connection/workspace-identity-contract-v1.json`
- `overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json`
- `overwatch/artifact-contracts/workspaces/fitness-connection/route-intelligence-data-contract-v1.json`
- `overwatch/artifact-contracts/workspaces/fitness-connection/crm-consumer-contract-v1.json`
- `overwatch/artifact-contracts/workspaces/fitness-connection/intelligence-consumer-contract-v1.json`

Dashboard-owned runtime consumers:

- `index.html`
- `deploy/cloudflare-pages/index.html`

Data-owned route intelligence artifacts:

- `overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json`
- `deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json`
- `deploy/cloudflare-pages/data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/promotion-gate.json`
- `data/qualified-prospects/google-qualified-businesses-v2/runtime-governance-overrides.json`
- `data/qualified-prospects/google-qualified-businesses-v2/founder-15-mile-pool.json`
- `data/qualified-prospects/google-qualified-businesses-v2/anthony-25-mile-pool.json`
- `data/qualified-prospects/google-qualified-businesses-v2/quality-report.json`
- `data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json`

CRM-owned contracts and entry points:

- `crm/crm-foundation.mjs`
- `consumeWorkspaceLeadIntakeHandoff`

Intelligence-owned profile and interpretation contracts:

- `intelligence/profiles/operating-profiles.json`
- `intelligence/contracts/operating-profile-contracts.json`
- `intelligence/contracts/adaptive-intelligence-contracts.json`
- `intelligence/contracts/field-learning-loop-contracts.json`
- `intelligence/contracts/recommendation-explainability-contracts.json`
- `intelligence/contracts/customer-intelligence-graph-contracts.json`

## Consumer Rules

Dashboard must render completed Research-owned canonical dossier artifacts read-only. It must expose the canonical artifact hash, render the full Markdown and structured JSON artifact, and fail closed for businesses without a completed canonical dossier.

Dashboard must not summarize, abbreviate, reinterpret, mutate, or create Research intelligence.

Dashboard must read Fitness Connection Active Pool and runtime pool artifacts only through approved Data contract paths and must not write Data artifacts.

CRM must route intake and future candidate records by `workspaceId`, reject unknown workspaces, and reject cross-workspace contamination before mutation.

CRM may consume Fitness Connection assigned lead artifacts only through the Data runtime artifact contract. CRM must not directly consume the Fitness Active Pool as mutable CRM state.

Intelligence must not activate production scoring, mutate Research or CRM artifacts, or let Smoothie Depot intelligence influence Fitness Connection recommendations.

Intelligence may interpret Fitness Connection Data artifacts only through approved read paths and must not mutate Data artifacts or change scoring through the Data contract.

Mobile may consume only role-scoped, workspace-scoped Fitness lead artifacts and must not consume Smoothie Depot candidate or franchise data.

Fitness Connection work must preserve the `fitness_connection` workspace, `fitness` Operating Profile, Founder/Rep separation, Anthony Rep-only access, Data-owned Active Pool governance, CRM-owned lead/activity state, and Smoothie Depot isolation.

Overwatch must reject future handoffs that bypass this registry, duplicate these contracts, introduce production fixture/demo data, or blur workspace ownership.

## Fixture and Demo Data Policy

Fixture/demo data may exist only in explicitly non-production validation or demo paths.

Known allowed non-production fixture/demo locations:

- `intelligence/fixtures/field-visit-evidence-fixtures.json`
- `demo-dashboard/index.html`
- `prometheus-os/demo-data.js`

The Smoothie Depot production dashboard must remain zero-state until real CRM/runtime records are explicitly authorized.

## Current Audit Findings

Broken links identified:

- None for the current Nutrition Depot canonical dossier path.

Incomplete links identified:

- Cranky Carrot and LEEMOO have no completed Research-owned canonical dossiers and must remain fail-closed in Dashboard.
- CRM durable candidate persistence is not authorized.
- Intelligence production interpretation over Research plus CRM is not authorized.
- Authenticated production browser smoke remains outside the contract layer and requires Cloudflare Access credentials or CDP when runtime verification is requested.

Required remediation order:

1. Keep Overwatch artifact contract verification active in `npm test`.
2. Social Media must register analytics/reporting and Website/CRM attribution artifacts.
3. Companion must register read-only subsystem consumer contracts before new subsystem-consuming founder responses.
4. Research must publish additional completed canonical dossiers before Dashboard populates additional Smoothie Depot mission slots.
5. CRM runtime persistence requires explicit CRM-owned approval.
6. Intelligence interpretation requires explicit Intelligence-owned approval and must preserve workspace isolation.
