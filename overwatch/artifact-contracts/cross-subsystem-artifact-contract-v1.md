# Cross-Subsystem Artifact Contract v1

## Purpose

This contract is the Prometheus subsystem connection layer. It defines how Research, Dashboard, CRM, Intelligence, and Overwatch communicate through canonical artifacts without duplicating ownership or contaminating workspaces.

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

## Consumer Rules

Dashboard must render completed Research-owned canonical dossier artifacts read-only. It must expose the canonical artifact hash, render the full Markdown and structured JSON artifact, and fail closed for businesses without a completed canonical dossier.

Dashboard must not summarize, abbreviate, reinterpret, mutate, or create Research intelligence.

CRM must route intake and future candidate records by `workspaceId`, reject unknown workspaces, and reject cross-workspace contamination before mutation.

Intelligence must not activate production scoring, mutate Research or CRM artifacts, or let Smoothie Depot intelligence influence Fitness Connection recommendations.

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

Required remediation order:

1. Keep Overwatch artifact contract verification active in `npm test`.
2. Research must publish additional completed canonical dossiers before Dashboard populates additional mission slots.
3. Dashboard may consume only completed Research-owned dossiers and must fail closed for missing dossiers.
4. CRM runtime persistence requires explicit CRM-owned approval.
5. Intelligence interpretation requires explicit Intelligence-owned approval and must preserve workspace isolation.
