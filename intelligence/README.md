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
- `off-route-learning-intelligence.mjs`: deterministic read-only projection for explicit visit-decision sources, recommendation overrides, source success cohorts, and representative-judgment confidence.
- `off-route-learning-intelligence.md`: source taxonomy, override boundary, unknown-safe historical handling, governed metrics, explainability, and future producer handoff.
- `shadow-decision-readiness.mjs`: Founder-only deterministic shadow ledger and conservative recommendation-readiness gate over Data chronological evidence; recommendation influence remains OFF.
- `shadow-decision-readiness.md`: temporal, statistical, segmentation, append-only outcome, isolation, and rollback architecture for Batch `BATCH-20260713-001`.
- `route-iq-prospective-retention-admission.mjs`: Intelligence-owned fail-closed admission gate that independently validates Data's exact retention envelope before any prospective evaluation can become readiness evidence.
- `provenance/reconstruct-legacy-protected-contracts-v1.mjs`: read-only owner reconstruction and explicit synchronization tool for the four Intelligence contracts touched by legacy mixed-ownership commit `049cf583`; it also inventories every additional Intelligence protected consumer before an owner successor commit is created. Later contract semantics are reconstructed from owner specifications and historical bases before hashes are recomputed, so a current contract cannot pass through hash synchronization alone.
- `provenance/specifications/administrative-disposition-admission-v1.json`: Intelligence-owned semantic derivation for append-only administrative-disposition admission across read-only learning, off-route learning, and shadow readiness. It contains no target contract hashes and preserves zero recommendation influence, audit retention, explicit-session exclusion, and undisposed zero-visit eligibility.
- `provenance/specifications/prospective-retention-admission-v1.json`: owner-derived Data-policy lineage, retention admission rules, exact July 14 exclusion, hash-only audit boundary, and complete Intelligence consumer matrix for `BATCH-20260714-003`.
- `provenance/legacy-provenance-gap-049cf583-v1.json`: generated Intelligence-owner evidence for `BATCH-20260713-002`, including the disclosed `LEGACY_PROVENANCE_GAP`, independent derivation sources, semantic and raw SHA-256 comparisons, integrated-base dependency, methodology constraints, and zero-influence state.
- `discovery-mode-intelligence-v2.mjs`: deterministic advisory composer for quality-bounded category exploration using canonical business-hours eligibility, existing Active Pool candidates, and authorized read-only evidence maturity.
- `discovery-mode-intelligence-v2.md`: Discovery queue architecture, category balancing, evidence thresholds, learning impact, explainability, configuration, and activation boundaries.
- `nearby-context-intelligence-v2.mjs`: deterministic, relationship-aware advisory projection for qualified secondary opportunities around a primary Route IQ arrival.
- `nearby-context-intelligence-v2.md`: canonical eligibility boundary, commercial relationship model, selection strategy, explainability, field findings, configuration, and activation boundary.
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
- `config/off-route-learning-intelligence-v1.json`: governed decision-source taxonomy, success policy, evidence thresholds, confidence model, and observation-only safety.
- `contracts/off-route-learning-intelligence-contracts.json`: read-only source, metric, explainability, isolation, validation-fixture, and protected-baseline contracts.
- `artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json`: deterministic source-learning projection of the currently authorized canonical archived visits.
- `config/discovery-mode-intelligence-v2.json`: governed category taxonomy, concentration limits, quality floor, evidence-policy inheritance, learning objectives, territory overrides, and relaxation policy.
- `contracts/discovery-mode-intelligence-v2-contracts.json`: advisory-only input, output, composition, isolation, explainability, and protected behavior contracts.
- `artifacts/discovery-mode-intelligence-v2/fitness_connection/cruz/discovery-queue-plan-v2.json`: deterministic advisory composition report derived from the current Active Pool and authorized read-only learning snapshot.
- `config/nearby-context-intelligence-v2.json`: governed commercial relationship priority, spatial bounds, fallback order, result limits, and activation safety.
- `contracts/nearby-context-intelligence-v2-contracts.json`: advisory input, eligibility, relationship, selection, explainability, isolation, and protected behavior contracts.
- `artifacts/nearby-context-intelligence-v2/fitness_connection/cruz/nearby-context-audit-v2.json`: deterministic Texans, Christian Brothers, and governed capability audit derived from current offline runtime data.
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
- Off-Route Learning Intelligence v1 reuses the authorized archive reader and remains observation-only. It classifies unavailable historical decision sources as Unknown and cannot infer overrides, change scoring, or influence recommendations.
- Prospective evaluation requires a Data-semantic-parity retention admission bound to the coordinator session, canonical field session, raw archive hash, and authorized expiry. Missing, expired, malformed, noncanonical, legal-hold, disposed, or over-retained evidence fails closed before evaluation.
- Discovery Mode Intelligence v2 is advisory only. It consumes the canonical Route IQ business-hours eligibility decision before category balancing and cannot create a production queue, change candidate scores, or influence recommendations without a separate explicit runtime activation handoff.
- Nearby Context Intelligence v2 is an Intelligence-owned advisory projection. It applies canonical eligibility and canonical identity deduplication before commercial relationship reasoning and cannot change primary recommendations, route scores, queue state, Dashboard runtime, or Data ownership.
- Legacy mixed-ownership commit `049cf583` remains disclosed as `LEGACY_PROVENANCE_GAP`. The Intelligence successor evidence is a new independent derivation, not a retroactive ownership claim. Protected hashes are synchronized only after Dashboard and Data owner commits are integrated, and every Intelligence-owned protected consumer must be clean before release verification. Administrative-disposition admission is reconstructed from the Intelligence-owned semantic specification against the pre-revision tree, then compared semantically and byte-for-byte with each canonical consumer.
- Do not activate recommendation-affecting field learning, historical replay, raw archive consumption, or archive mutation from this architecture package.
- Do not create a second route engine, second CRM model, second Research structure, second Sales methodology, or duplicate Companion reasoning layer.

## Duplicate Prevention

Future Adaptive Outside Sales Intelligence work must start here and extend these contracts. It must also reuse Route Intelligence V2, the Continuous Learning Framework, Golden Route Quality Gate v1, Runtime Pool Governance, CRM foundation contracts, Research source policy, and Sales operating-system artifacts before creating new abstractions.

Future Adaptive Field Learning Loop work must extend `adaptive-field-learning-loop-foundation.md` and `contracts/field-learning-loop-contracts.json`. Do not create a separate visit-learning store, unreviewed learning pipeline, duplicate confidence model, duplicate explanation model, or alternate human-override mechanism.

Future offline learning validation must extend `field-learning-offline-evidence-harness.mjs` and `fixtures/field-visit-evidence-fixtures.json`. Do not create a separate simulated evidence harness, separate confidence regression suite, or alternate explanation validator.

Future canonical archived-session learning must extend `read-only-field-session-learning.mjs`, `read-only-field-session-learning.md`, `contracts/read-only-field-session-learning-contracts.json`, and `config/read-only-field-session-learning-policy-v1.json`. Do not create a second Data archive reader, re-normalize Data records, replay historical sessions, parse raw reports directly, hard-code learning thresholds, or activate recommendation influence through the read-only projection.

Future off-route decision learning must extend `off-route-learning-intelligence.mjs`, `off-route-learning-intelligence.md`, `config/off-route-learning-intelligence-v1.json`, and `contracts/off-route-learning-intelligence-contracts.json`. Do not infer decision source from notes, outcome, business origin, or missing recommendation evidence; do not treat every off-route visit as an override; and do not use validation-only fixtures as production evidence.

Future Discovery Mode category-composition work must extend `discovery-mode-intelligence-v2.mjs`, `discovery-mode-intelligence-v2.md`, `config/discovery-mode-intelligence-v2.json`, and `contracts/discovery-mode-intelligence-v2-contracts.json`. Do not add a fixed category rotation, second runtime queue, second business-hours eligibility engine, parallel scoring engine, direct Dashboard consumer, stress-observation learning path, or fallback that bypasses existing Active Pool, canonical eligibility, quality, duplicate, workspace, or explainability controls.

Future Nearby Context work must extend `nearby-context-intelligence-v2.mjs`, `nearby-context-intelligence-v2.md`, `config/nearby-context-intelligence-v2.json`, `contracts/nearby-context-intelligence-v2-contracts.json`, and its canonical audit. It must remove aliases through `routeQueueIdentity` before relationship inference and keep distinct multi-tenant Place IDs separate. Do not create a second nearby engine, second business-hours evaluator, parallel identity rule, live-Google runtime dependency, direct stress-observation learning path, or fallback that admits closed, quarantined, completed, duplicate, or cross-workspace businesses.

Future recommendation explanation work must extend `recommendation-explainability-engine.mjs` and `contracts/recommendation-explainability-contracts.json`. Do not expose scoring formulas, proprietary weights, or create separate Mobile, Dashboard, or Companion explanation contracts.

Future operating-profile and field-evidence activation work must extend `operating-profile-engine.mjs`, `field-evidence-activation-foundation.md`, `profiles/operating-profiles.json`, and `contracts/operating-profile-contracts.json`. Do not create a separate industry configuration layer, parallel normalized outcome model, duplicate profile-specific Dashboard/CRM/Companion/Mobile/Website contract, or production learning activation path.

Future Customer Intelligence Graph work must extend `customer-intelligence-graph.mjs`, `customer-intelligence-graph.md`, and `contracts/customer-intelligence-graph-contracts.json`. Do not create a parallel customer graph, duplicate relationship vocabulary, cross-customer graph path, active confidence-propagation path, or Dashboard/CRM/Mobile/Companion/Research/Sales graph consumer without approved subsystem handoff.

Future Smoothie Depot or Business Acquisition Intelligence work must extend `workspaces/smoothie-depot/workspace-intelligence-plan.md`, `workspaces/smoothie-depot/workspace-intelligence-plan.json`, and `contracts/business-acquisition-intelligence-contracts.json`. Do not mix Smoothie Depot candidate intelligence with Fitness Connection Route Intelligence, Active Pool scoring, or customer workspace data.

Future adaptive route queue work must extend `continuous-adaptive-route-replenishment.mjs` and `contracts/continuous-adaptive-route-replenishment-contracts.json`. Do not create static pagination as a substitute, a second route queue, an unscoped queue store, a parallel scoring engine, or a fallback path that bypasses Active Pool, quarantine, completed-stop, workspace, or single-flight protections.
