# Drawing Register

Initialized: 2026-07-09

Purpose: Track technical drawings, system diagrams, workflow diagrams, data-flow diagrams, and figure candidates for attorney review.

This register does not create formal patent drawings. It identifies technical figure candidates that counsel or a draftsperson may later convert into formal drawings.

## Storage

Source drawing workspace: `patents/drawings/`

Figure output workspace: `patents/figures/`

## Figure Candidates

### FIG-001 - Prometheus Platform Architecture

Status: Planned

Subject: Shared architecture across Route IQ, Gaia, Athena, Evidence Engine, Intelligence Loop, dashboards, and platform data stores.

Related disclosures: IP-003, IP-004, IP-007

### FIG-002 - Route IQ Prospect Qualification Workflow

Status: Planned

Subject: Candidate intake, normalization, qualification, scoring, approval, and route-ready output.

Related disclosures: IP-001

### FIG-003 - Route IQ Runtime Pool Segmentation

Status: Planned

Subject: Active pool, reserve pool, quarantine pool, rejected records, promotion gates, and governance artifacts.

Related disclosures: IP-001, IP-002

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
