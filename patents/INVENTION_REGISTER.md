# Invention Register

Initialized: 2026-07-09

Purpose: Track Prometheus invention disclosures and candidate technical concepts for attorney review. Entries do not indicate patentability and do not contain legal claims.

## Register Fields

Each invention record should include:

- Identifier.
- Working title.
- Status.
- Related subsystem.
- Problem being solved.
- Existing limitations.
- Technical solution.
- Architecture.
- Workflow.
- Alternative implementations.
- Embodiments.
- Potential variations.
- Future extensions.
- Relationship to other Prometheus products.
- Source materials.
- Inventor notes.
- Attorney-review questions.

## Current Invention Candidates

### IP-001 - Route IQ Adaptive Representative Intelligence System

Status: Founder-filed U.S. provisional application recorded

Related subsystem: Route IQ

Summary: Computer-implemented adaptive representative intelligence system that collects representative activity evidence, updates representative profile intelligence, territory intelligence, customer intelligence, and outcome intelligence, calculates future action probabilities, and generates adaptive recommendations for a representative.

Documentation status: Documented in `DISCLOSURE_PACKAGE_V1.md` and `route-iq/TECHNICAL_DISCLOSURE_V1.md`.

Continuous adaptive replenishment evidence: `route-iq/CONTINUOUS_ADAPTIVE_ROUTE_REPLENISHMENT_V1.md` documents the 2026-07-11 outcome-driven, representative-scoped route queue maintenance expansion without making patentability claims.

Invention number: 1

Evidence status: Evidence register v1 created at `route-iq/INVENTION_EVIDENCE_REGISTER.md`.

Filing status:

- Founder-controlled U.S. provisional application filing recorded on 2026-07-09.
- Application number: 64/107,865.
- Confirmation number: 3435.
- Patent Center number: 78484033.
- Receipt timestamp: 2026-07-09 12:52:12 AM ET.
- Fee paid: $130.00 provisional application filing fee.
- Filing report: `route-iq/ROUTE_IQ_USPTO_PROVISIONAL_FILING_REPORT_V1.md`.
- Electronic Acknowledgement Receipt archived at `../output/pdf/route-iq/filing/USPTO_ACKNOWLEDGEMENT_RECEIPT_64_107865.pdf`.
- Electronic Payment Receipt archived at `../output/pdf/route-iq/filing/USPTO_PAYMENT_RECEIPT_64_107865.pdf`.

Founder-confirmed invention history:

- First conception date: May 1, 2026.
- Decision to create Representative Intelligence Loop: May 3, 2026.
- Early invention discussions: None.
- Conception source: Founder conceived the invention independently.
- First working implementation: May 8, 2026.
- Core insight: Route IQ should continuously learn the representative, not only the territory or customer, and adapt future visit recommendations based on representative-specific historical performance.

Known evidence captured:

- Earliest repository-supported multi-representative intelligence planning located at `docs/prometheus-multi-rep-intelligence-plan.md`, dated June 22, 2026.
- Earliest repository-supported implementation evidence located in commit `e9d3b46` dated 2026-06-22, `Add Anthony prospect seed routing`.
- Route Intelligence V2 architecture documented in commit `6a5cd3e` dated 2026-06-27.
- Continuous learning framework documented in commit `0a16046` dated 2026-06-27.
- Adaptive field learning and operating profile evidence foundations documented in July 2026 implementation commits.
- Route IQ technical disclosure and drawing foundation documented in patent-preparation commits `c095e70` and `4bfa427`.
- Continuous Adaptive Route Replenishment v1 documented on 2026-07-11 before implementation, covering persisted route queues, latest-evidence regeneration, single-flight replenishment, Active Pool priority, governed Full Pool fallback, and explicit exhausted-pool behavior.

Attorney-review questions:

- Review filed provisional application package and receipt records.
- Confirm post-filing ownership, assignment, and follow-on utility filing planning.
- Review founder-confirmed invention timeline and supporting artifacts.
- Identify first working implementation artifact for the May 8, 2026 implementation.
- Identify public disclosures.
- Review relationship to mapping, CRM, navigation, calendar, and data-source integrations as possible inputs or interfaces rather than the core invention.
- Identify concrete evidence schemas, probability calculations, and recommendation outputs from implementation artifacts.
- Review `route-iq/INVENTION_EVIDENCE_REGISTER.md` and identify which evidence should be included in attorney materials.

### IP-002 - Runtime Pool Segmentation and Promotion Governance

Status: Candidate disclosure scaffold

Related subsystem: Route IQ and platform data governance

Summary: System for segmenting prospect records into active, reserve, quarantine, rejected, or other runtime pools based on quality gates and operational readiness.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify unique segmentation rules and technical enforcement mechanisms.
- Identify source data contracts and generated artifacts.
- Review promotion, quarantine, and rejection workflows.

### IP-003 - Evidence Engine for Field and Research Intelligence

Status: Candidate disclosure scaffold

Related subsystem: Shared architecture

Summary: System for capturing, normalizing, preserving, and reusing evidence across research, route intelligence, field work, dashboards, and decision support.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify evidence schemas and provenance requirements.
- Identify examples of human and automated evidence intake.
- Review relationship to research reports, dashboards, and field observations.

### IP-004 - Intelligence Loop for Adaptive Business Execution

Status: Candidate disclosure scaffold

Related subsystem: Shared architecture, Route IQ, Gaia, Athena

Summary: Feedback loop that uses evidence, recommendations, actions, outcomes, and future updates to improve business execution workflows.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify feedback events and update mechanisms.
- Identify what changes after each loop.
- Review customer-specific and cross-customer embodiments.

### IP-005 - Gaia Research Orchestration System

Status: Candidate disclosure scaffold

Related subsystem: Gaia

Summary: Structured research orchestration layer for collecting, normalizing, synthesizing, and handing off business intelligence.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify first Gaia implementation artifacts.
- Identify source queues, confidence markers, and handoff formats.
- Review use of agent-assisted and human-led research embodiments.

### IP-006 - Athena Evidence-Backed Decision Support System

Status: Candidate disclosure scaffold

Related subsystem: Athena

Summary: Decision-support layer that converts evidence, context, objectives, and operating state into recommendations, risk flags, and follow-up actions.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify recommendation generation process.
- Identify explainability and confidence records.
- Review dashboard, founder, customer success, and sales embodiments.

### IP-007 - Shared Prometheus Cross-Subsystem Intelligence Handoff Architecture

Status: Candidate disclosure scaffold

Related subsystem: Platform

Summary: Shared architecture for moving structured context, evidence, decisions, and outputs across Prometheus subsystems while preserving source-of-truth boundaries.

Documentation status: Covered at scaffold level in `DISCLOSURE_PACKAGE_V1.md`.

Attorney-review questions:

- Identify canonical data contracts.
- Identify handoff records and subsystem boundaries.
- Review architecture diagrams and continuity reports.

## Intake Backlog

- Add conception and reduction-to-practice dates after inventor interview.
- Link repository files, demos, reports, and diagrams for each entry.
- Add detailed embodiments for each candidate.
- Add known public disclosures for attorney review.
- Add non-patent IP notes where copyright, trade secret, or trademark protection may be more appropriate.
