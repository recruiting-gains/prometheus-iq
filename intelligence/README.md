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
- `read-only-field-session-learning.mjs`: independently authorized, read-only projection engine for verified canonical Data field-session records; it produces governed Intelligence artifacts without replaying sessions or influencing recommendations.
- `read-only-field-session-learning.md`: source admission, threshold, explainability, immutability, and fail-closed architecture for the first archived-session learning layer.
- `recommendation-explainability-engine.mjs`: explanation-only engine that converts recommendation context into natural-language why, confidence, evidence, change, and next-action answers.
- `operating-profile-engine.mjs`: configuration-driven profile engine that maps industry-specific field outcomes into normalized evidence without changing production scoring, Dashboard runtime behavior, Mobile beta behavior, CRM runtime behavior, Website behavior, Companion behavior, or Infrastructure.
- `field-evidence-activation-foundation.md`: architecture-only activation foundation for real field evidence admission, normalized outcomes, safety controls, and profile-agnostic explainability.
- `customer-intelligence-graph.mjs`: read-only graph snapshot engine for per-customer Business, Visit, Lead, Outcome, Opportunity, Rep, Manager, Territory, Operating Profile, Customer, and Learning Signal relationships.
- `customer-intelligence-graph.md`: Customer Intelligence Graph architecture, CustomerGraphSnapshots, provenance, safe query contracts, customer isolation rules, graph objectives, and future consumer boundaries.
- `continuous-adaptive-route-replenishment.mjs`: production Route IQ queue controller for outcome-driven, representative-scoped, workspace-safe route maintenance.
- `contracts/adaptive-intelligence-contracts.json`: machine-readable contract registry for validation and future implementation planning.
- `contracts/field-learning-loop-contracts.json`: machine-readable Field Learning Loop contract registry for completed-visit evidence, normalized signals, confidence, explainability, and human override review.
- `contracts/read-only-field-session-learning-contracts.json`: active read-only consumer authorization, source ownership boundary, approved Data record kinds, output contracts, and protected behavior baselines.
- `config/read-only-field-session-learning-policy-v1.json`: governed evidence minima, confidence bands, recency weighting, evidence decay, and recommendation-influence safeguards.
- `artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json`: deterministic Intelligence-owned projection of the currently authorized canonical archived session.
- `contracts/recommendation-explainability-contracts.json`: reusable Mobile, Dashboard, and Companion explanation contracts.
- `contracts/operating-profile-contracts.json`: reusable Dashboard, CRM, Companion, Mobile, Website, Research, Sales, and Social Media profile contracts.
- `contracts/customer-intelligence-graph-contracts.json`: reusable graph node, relationship, snapshot, read-only query, Dashboard, CRM, Mobile, Website, Companion, Research, and Sales contracts.
- `contracts/business-acquisition-intelligence-contracts.json`: Smoothie Depot workspace-scoped Business Acquisition Intelligence planning contracts.
- `contracts/continuous-adaptive-route-replenishment-contracts.json`: queue, evidence, pool fallback, concurrency, persistence, and consumer compatibility contracts for continuous Route IQ replenishment.
- `profiles/operating-profiles.json`: initial General Outside Sales, Fitness, Roofing, Security, Medical, Insurance, Solar, Home Services, and Franchise Development operating profiles.
- `workspaces/smoothie-depot/workspace-intelligence-plan.md` and `.json`: isolated Smoothie Depot Workspace intelligence plan for franchise-owner candidate sourcing, qualification, JR handoff, commission tracking, and protection-period planning.
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

- Architecture-only foundations remain non-production unless a separately governed activation explicitly authorizes runtime use.
- Continuous Adaptive Route Replenishment v1 is the authorized production Route IQ activation and must remain scoped to the Fitness Connection workspace.
- Do not create alternate production recommendation or Dashboard queue behavior outside the continuous replenishment controller and existing Route Intelligence integration.
- Do not modify Active Pool scoring from this architecture package.
- Do not modify Route Intelligence runtime code from this architecture package.
- Do not modify Data governance from this architecture package.
- Do not modify Anthony beta behavior from this architecture package.
- Read-only archived-session learning is active only through `read-only-field-session-learning-contracts-v1`; production recommendation influence remains inactive.
- Do not activate recommendation-affecting field learning, historical replay, raw archive consumption, or archive mutation from this architecture package.
- Do not create a second route engine, second CRM model, second Research structure, second Sales methodology, or duplicate Companion reasoning layer.

## Duplicate Prevention

Future Adaptive Outside Sales Intelligence work must start here and extend these contracts. It must also reuse Route Intelligence V2, the Continuous Learning Framework, Golden Route Quality Gate v1, Runtime Pool Governance, CRM foundation contracts, Research source policy, and Sales operating-system artifacts before creating new abstractions.

Future Adaptive Field Learning Loop work must extend `adaptive-field-learning-loop-foundation.md` and `contracts/field-learning-loop-contracts.json`. Do not create a separate visit-learning store, unreviewed learning pipeline, duplicate confidence model, duplicate explanation model, or alternate human-override mechanism.

Future offline learning validation must extend `field-learning-offline-evidence-harness.mjs` and `fixtures/field-visit-evidence-fixtures.json`. Do not create a separate simulated evidence harness, separate confidence regression suite, or alternate explanation validator.

Future canonical archived-session learning must extend `read-only-field-session-learning.mjs`, `read-only-field-session-learning.md`, `contracts/read-only-field-session-learning-contracts.json`, and `config/read-only-field-session-learning-policy-v1.json`. Do not create a second Data archive reader, re-normalize Data records, replay historical sessions, parse raw reports directly, hard-code learning thresholds, or activate recommendation influence through the read-only projection.

Future recommendation explanation work must extend `recommendation-explainability-engine.mjs` and `contracts/recommendation-explainability-contracts.json`. Do not expose scoring formulas, proprietary weights, or create separate Mobile, Dashboard, or Companion explanation contracts.

Future operating-profile and field-evidence activation work must extend `operating-profile-engine.mjs`, `field-evidence-activation-foundation.md`, `profiles/operating-profiles.json`, and `contracts/operating-profile-contracts.json`. Do not create a separate industry configuration layer, parallel normalized outcome model, duplicate profile-specific Dashboard/CRM/Companion/Mobile/Website contract, or production learning activation path.

Future Customer Intelligence Graph work must extend `customer-intelligence-graph.mjs`, `customer-intelligence-graph.md`, and `contracts/customer-intelligence-graph-contracts.json`. Do not create a parallel customer graph, duplicate relationship vocabulary, cross-customer graph path, active confidence-propagation path, or Dashboard/CRM/Mobile/Companion/Research/Sales graph consumer without approved subsystem handoff.

Future Smoothie Depot or Business Acquisition Intelligence work must extend `workspaces/smoothie-depot/workspace-intelligence-plan.md`, `workspaces/smoothie-depot/workspace-intelligence-plan.json`, and `contracts/business-acquisition-intelligence-contracts.json`. Do not mix Smoothie Depot candidate intelligence with Fitness Connection Route Intelligence, Active Pool scoring, or customer workspace data.

Future adaptive route queue work must extend `continuous-adaptive-route-replenishment.mjs` and `contracts/continuous-adaptive-route-replenishment-contracts.json`. Do not create static pagination as a substitute, a second route queue, an unscoped queue store, a parallel scoring engine, or a fallback path that bypasses Active Pool, quarantine, completed-stop, workspace, or single-flight protections.
