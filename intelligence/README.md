# Prometheus Intelligence Engine

Purpose: own the reasoning, learning, confidence, explanation, and recommendation-quality architecture behind Prometheus.

Prometheus Intelligence Engine is not the Dashboard, CRM, Data refresh engine, Research organization, Sales operating system, Companion, or Infrastructure. It is the architecture layer that decides how approved evidence should eventually influence outside-sales recommendations while remaining explainable, deterministic, governed, and enterprise-safe.

## Current Architecture Package

- `adaptive-outside-sales-intelligence-engine.md`: long-term architecture for the Adaptive Outside Sales Intelligence Engine.
- `adaptive-field-learning-loop-foundation.md`: production-safe foundation for converting future completed field visits into reviewable evidence, learning signals, confidence metadata, explanations, and human overrides.
- `subsystem-contracts.md`: reusable contracts for learning inputs, confidence outputs, explanations, overrides, and future subsystem integration.
- `future-subsystem-handoffs.md`: prepared handoffs for Dashboard, CRM, Research, Companion, Data, Sales, and future enterprise systems.
- `field-learning-loop-handoffs.md`: future handoff boundaries for Dashboard, CRM, Research, Companion, and Sales field-learning work.
- `field-learning-offline-evidence-harness.mjs`: offline-only simulated evidence harness for validating evidence ingestion, learning signals, confidence snapshots, explanations, and human overrides.
- `recommendation-explainability-engine.mjs`: explanation-only engine that converts recommendation context into natural-language why, confidence, evidence, change, and next-action answers.
- `operating-profile-engine.mjs`: configuration-driven profile engine that maps industry-specific field outcomes into normalized evidence without changing production scoring, Dashboard runtime behavior, Mobile beta behavior, CRM runtime behavior, Website behavior, Companion behavior, or Infrastructure.
- `field-evidence-activation-foundation.md`: architecture-only activation foundation for real field evidence admission, normalized outcomes, safety controls, and profile-agnostic explainability.
- `contracts/adaptive-intelligence-contracts.json`: machine-readable contract registry for validation and future implementation planning.
- `contracts/field-learning-loop-contracts.json`: machine-readable Field Learning Loop contract registry for completed-visit evidence, normalized signals, confidence, explainability, and human override review.
- `contracts/recommendation-explainability-contracts.json`: reusable Mobile, Dashboard, and Companion explanation contracts.
- `contracts/operating-profile-contracts.json`: reusable Dashboard, CRM, Companion, Mobile, Website, Research, Sales, and Social Media profile contracts.
- `profiles/operating-profiles.json`: initial General Outside Sales, Fitness, Roofing, Security, Medical, Insurance, Solar, and Home Services operating profiles.
- `fixtures/field-visit-evidence-fixtures.json`: simulated field visit evidence fixtures for regression testing before live beta evidence is admitted.

## Existing Sources Reused

- `COMPANY_IDENTITY.md`: company identity and outside-sales operating-system mission.
- `PRODUCT_VISION.md`: canonical product vision and long-term platform direction.
- `RESEARCH_FOUNDATION.md`, `research/README.md`, and `research/architecture.md`: Research foundation and source policy.
- `sales/README.md` and Sales foundation documents: Sales foundation fallback because root `SALES_FOUNDATION.md` is absent.
- `crm/README.md` and CRM enterprise lifecycle foundation: CRM foundation fallback because root `CRM_FOUNDATION.md` is absent.
- `docs/route-intelligence-v2-architecture.md`: current Route Intelligence learning architecture.
- `docs/continuous-learning-framework.md`: long-term learning rules.
- `scripts/verify-route-intelligence-quality-gate.mjs`: current golden route quality gate.
- Runtime governance outputs under `data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/`.

## Boundary Rules

- Do not modify production recommendation logic from this architecture package.
- Do not modify Dashboard behavior from this architecture package.
- Do not modify Active Pool scoring from this architecture package.
- Do not modify Route Intelligence runtime code from this architecture package.
- Do not modify Data governance from this architecture package.
- Do not modify Anthony beta behavior from this architecture package.
- Do not activate production field learning from this architecture package.
- Do not create a second route engine, second CRM model, second Research structure, second Sales methodology, or duplicate Companion reasoning layer.

## Duplicate Prevention

Future Adaptive Outside Sales Intelligence work must start here and extend these contracts. It must also reuse Route Intelligence V2, the Continuous Learning Framework, Golden Route Quality Gate v1, Runtime Pool Governance, CRM foundation contracts, Research source policy, and Sales operating-system artifacts before creating new abstractions.

Future Adaptive Field Learning Loop work must extend `adaptive-field-learning-loop-foundation.md` and `contracts/field-learning-loop-contracts.json`. Do not create a separate visit-learning store, unreviewed learning pipeline, duplicate confidence model, duplicate explanation model, or alternate human-override mechanism.

Future offline learning validation must extend `field-learning-offline-evidence-harness.mjs` and `fixtures/field-visit-evidence-fixtures.json`. Do not create a separate simulated evidence harness, separate confidence regression suite, or alternate explanation validator.

Future recommendation explanation work must extend `recommendation-explainability-engine.mjs` and `contracts/recommendation-explainability-contracts.json`. Do not expose scoring formulas, proprietary weights, or create separate Mobile, Dashboard, or Companion explanation contracts.

Future operating-profile and field-evidence activation work must extend `operating-profile-engine.mjs`, `field-evidence-activation-foundation.md`, `profiles/operating-profiles.json`, and `contracts/operating-profile-contracts.json`. Do not create a separate industry configuration layer, parallel normalized outcome model, duplicate profile-specific Dashboard/CRM/Companion/Mobile/Website contract, or production learning activation path.
