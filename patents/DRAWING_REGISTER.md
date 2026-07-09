# Drawing Register

Initialized: 2026-07-09

Purpose: Track technical drawings, system diagrams, workflow diagrams, data-flow diagrams, and figure candidates for attorney review.

This register does not create formal patent drawings. It identifies technical figure candidates that counsel or a draftsperson may later convert into formal drawings.

## Storage

Source drawing workspace: `patents/drawings/`

Figure output workspace: `patents/figures/`

## Figure Candidates

## Route IQ Drawing Foundation v1

Status: Engineering placeholders documented

Disclosure supported: IP-001 - Route IQ Adaptive Representative Intelligence System

Source directory: `patents/drawings/route-iq/`

Boundary: These entries are engineering-style figure descriptions and placeholders only. They are not formal patent drawings, legal claims, marketing diagrams, artistic graphics, or USPTO forms.

### RIQ-FIG-001 - Overall Route IQ System Architecture

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-001-overall-route-iq-system-architecture.md`

Purpose: Show the principal computer-implemented components of Route IQ and the high-level flow from representative activity through evidence collection, learning, probability evaluation, recommendation generation, and representative feedback.

Components: Representative interface, evidence collection layer, learning engine, representative profile, territory intelligence, customer intelligence, outcome intelligence, probability engine, recommendation engine, external-system interfaces, administrative configuration, persistent storage, and synchronization layer.

Relationships: Representative evidence flows to evidence collection, evidence updates learning, learning updates intelligence stores, intelligence stores feed probability calculation, probability outputs feed recommendation generation, and representative response feeds back as new evidence.

Related disclosures: IP-001

### RIQ-FIG-002 - Representative Intelligence Loop

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-002-representative-intelligence-loop.md`

Purpose: Show the recurring loop by which Route IQ converts representative actions into evidence, updates intelligence layers, recalculates probabilities, generates recommendations, and returns adaptive guidance.

Components: Representative, representative action, evidence collection, learning engine, representative learning, territory learning, customer learning, outcome learning, probability recalculation, recommendation generation, and representative response.

Relationships: Representative action produces evidence, evidence updates learning states, learning states feed probability recalculation, recalculation feeds recommendations, and representative response restarts the loop.

Related disclosures: IP-001, IP-004

### RIQ-FIG-003 - Representative Learning Workflow

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-003-representative-learning-workflow.md`

Purpose: Show how Route IQ updates a dynamic representative profile from representative activity, recommendation response, evidence quality, and outcome history.

Components: Representative event input, activity classifier, recommendation response classifier, evidence quality evaluator, performance pattern evaluator, representative profile updater, representative profile data store, and probability engine input.

Relationships: Representative events are classified, evidence quality and response behavior are evaluated, representative attributes are updated, and the updated profile feeds probability calculation.

Related disclosures: IP-001

### RIQ-FIG-004 - Territory Learning Workflow

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-004-territory-learning-workflow.md`

Purpose: Show how Route IQ updates territory intelligence from field observations, customer density, timing patterns, local constraints, and historical outcomes.

Components: Territory data input, field observation input, customer density evaluator, timing pattern evaluator, local constraint evaluator, coverage and saturation evaluator, territory intelligence updater, territory intelligence data store, and probability engine input.

Relationships: Territory data and observations are evaluated, territory attributes are updated, and updated territory intelligence feeds probability calculations and recommendations.

Related disclosures: IP-001

### RIQ-FIG-005 - Customer Learning Workflow

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-005-customer-learning-workflow.md`

Purpose: Show how Route IQ updates customer intelligence from interactions, observed attributes, qualification evidence, objections, readiness signals, and follow-up requirements.

Components: Customer record input, representative interaction input, qualification evaluator, objection and signal classifier, relationship stage evaluator, evidence completeness evaluator, follow-up requirement evaluator, customer intelligence updater, customer intelligence data store, and probability engine input.

Relationships: Customer records and interactions are evaluated, customer attributes are updated, and updated customer intelligence feeds probability and recommendation processing.

Related disclosures: IP-001

### RIQ-FIG-006 - Outcome Learning Workflow

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-006-outcome-learning-workflow.md`

Purpose: Show how Route IQ learns from completed actions by comparing recommendations, representative behavior, predicted probabilities, and actual outcomes.

Components: Prior recommendation record, predicted probability record, representative action record, actual outcome record, outcome classifier, prediction comparison engine, weight or rule adjustment module, outcome intelligence updater, outcome intelligence data store, and probability engine feedback input.

Relationships: Predictions and recommendations are compared against actual outcomes, outcome intelligence is updated, and updated outcome intelligence feeds future probability calculations.

Related disclosures: IP-001

### RIQ-FIG-007 - Probability Recommendation Engine

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-007-probability-recommendation-engine.md`

Purpose: Show how Route IQ converts representative, territory, customer, and outcome intelligence into probability values and representative-facing recommendations.

Components: Representative profile input, territory intelligence input, customer intelligence input, outcome intelligence input, current session context, administrative constraints, quality gates, probability engine, candidate action generator, ranking and filtering module, recommendation engine, recommendation output, and explanation output.

Relationships: Intelligence inputs and context feed probability calculation, candidate actions are generated and ranked, constraints filter results, and recommendation outputs are delivered to the representative.

Related disclosures: IP-001

### RIQ-FIG-008 - Complete Computer-Implemented Data Flow

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-008-complete-computer-implemented-data-flow.md`

Purpose: Show the end-to-end software data flow from representative login through evidence capture, storage, learning updates, probability processing, recommendation output, external integrations, and feedback capture.

Components: Representative client application, authentication service, application API, evidence collection service, normalization and validation service, persistent data store, learning engine service, intelligence stores, probability engine service, recommendation engine service, delivery service, external integration adapters, and audit or event log.

Relationships: Client events flow through APIs and evidence services into storage, learning services update intelligence stores, probability and recommendation services generate outputs, and feedback is captured as additional evidence.

Related disclosures: IP-001

### RIQ-FIG-009 - Example Representative Session

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-009-example-representative-session.md`

Purpose: Show a representative session sequence from login through recommendation, representative action, evidence submission, learning update, and next recommendation.

Components: Login step, session initialization, representative profile load, territory and customer context load, prior outcome intelligence load, candidate action retrieval, probability calculation, recommendation display, representative decision, field or customer action, evidence submission, learning update, and next recommendation.

Relationships: Login loads session context, context feeds probability calculation, recommendations prompt representative action, submitted evidence updates learning, and updated learning triggers the next recommendation.

Related disclosures: IP-001

### RIQ-FIG-010 - Alternative System Embodiment

Status: Placeholder documented

Source: `patents/drawings/route-iq/FIG-010-alternative-system-embodiment.md`

Purpose: Show that Route IQ may be implemented across different interfaces and deployment patterns while preserving the same adaptive representative intelligence architecture.

Components: Web representative interface, mobile representative interface, offline-capable local store, CRM-embedded panel, manager console, messaging interface, API-only recommendation service, batch learning processor, real-time event processor, shared intelligence services, shared persistent storage, and external system adapters.

Relationships: Multiple interfaces submit evidence and receive recommendations through shared intelligence services; real-time, batch, and offline modes update the same representative, territory, customer, and outcome intelligence architecture.

Related disclosures: IP-001

## General Figure Candidates

### FIG-001 - Prometheus Platform Architecture

Status: Planned

Subject: Shared architecture across Route IQ, Gaia, Athena, Evidence Engine, Intelligence Loop, dashboards, and platform data stores.

Related disclosures: IP-003, IP-004, IP-007

### FIG-002 - Route IQ Adaptive Representative Intelligence Architecture

Status: Planned

Subject: Representative, evidence collection, learning engine, representative profile, territory intelligence, customer intelligence, outcome intelligence, probability engine, recommendation engine, and representative feedback.

Related disclosures: IP-001

### FIG-003 - Route IQ Representative Intelligence Loop

Status: Planned

Subject: Representative learning, territory learning, customer learning, outcome learning, probability recalculation, recommendation generation, action, evidence collection, and continuous adaptation.

Related disclosures: IP-001, IP-004

### FIG-004 - Gaia Research Orchestration Workflow

Status: Planned

Subject: Research objective intake, source queue, evidence capture, synthesis, confidence notes, and downstream handoff.

Related disclosures: IP-005

### FIG-005 - Athena Recommendation Workflow

Status: Planned

Subject: Decision context, evidence retrieval, recommendation generation, explainability, risk flags, and follow-up actions.

Related disclosures: IP-006

### FIG-006 - Evidence Engine Data Lifecycle

Status: Planned

Subject: Evidence intake, source metadata, normalization, entity linkage, confidence markers, review history, and reuse.

Related disclosures: IP-003

### FIG-007 - Intelligence Loop Feedback Cycle

Status: Planned

Subject: Evidence, intelligence, recommendation, action, outcome, and future update cycle.

Related disclosures: IP-004

### FIG-008 - Cross-Subsystem Handoff Architecture

Status: Planned

Subject: Structured handoff of evidence, route outputs, research summaries, recommendations, and dashboard records across Prometheus subsystems.

Related disclosures: IP-007

## Drawing Preparation Checklist

- Identify the technical process or architecture being shown.
- Identify all major components.
- Identify data inputs and outputs.
- Identify feedback loops.
- Identify optional or alternative components.
- Identify human-in-the-loop and automated variants.
- Link each figure to one or more invention register entries.
- Store source drawings in `patents/drawings/`.
- Store rendered figures in `patents/figures/`.
