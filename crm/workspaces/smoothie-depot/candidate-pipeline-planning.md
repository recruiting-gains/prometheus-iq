# Smoothie Depot CRM Candidate Pipeline Planning v1

Status: planning contracts only.

Workspace: Smoothie Depot.

Operating Profile: Franchise Development.

Owning subsystem: Prometheus CRM.

This plan defines CRM-owned contracts for tracking potential Smoothie Depot franchise-owner candidates from first identified business through JR handoff and closed franchise sale. It does not create runtime candidate records, does not modify Dashboard runtime, Website, Companion, Route Intelligence, Active Pool scoring, or production recommendation systems.

## Workspace Boundary

Every future candidate artifact must use `workspace_id: smoothie_depot` and `operating_profile_id: franchise_development`.

Fitness Connection remains isolated. Smoothie Depot candidate records must not be mixed with Fitness Connection records, and Smoothie Depot CRM planning must not influence Fitness Connection route recommendations, Active Pool scoring, or production scoring.

Allowed shared layers:

- shared Operating Profile architecture
- shared workspace isolation governance
- shared validation scripts
- Business Acquisition Intelligence planning contracts

Blocked influence paths:

- Smoothie Depot candidate records -> Fitness Connection records
- Smoothie Depot candidate records -> Fitness Connection Route Intelligence
- Smoothie Depot candidate records -> Active Pool scoring
- Fitness Connection records -> Smoothie Depot candidate pipeline

## Pipeline Stages

1. Business Identified
2. Owner Research Needed
3. Contact Found
4. Outreach Sent
5. Interested
6. Discovery Scheduled
7. Discovery Complete
8. Qualified Candidate
9. JR Handoff
10. FDD / Review
11. Closed Won
12. Not Qualified
13. No Response

Terminal stages: Closed Won, Not Qualified, No Response.

## Candidate Record Contract

Required candidate fields:

- candidate name
- business name
- business category
- phone
- email
- website
- address
- source
- Google rating
- review count
- owner/contact status
- preferred territory
- liquid capital self-reported
- net worth self-reported
- credit range self-reported
- number of locations desired
- readiness assessment status
- JR handoff status
- protected candidate start date
- protected candidate expiration date
- commission forecast
- next follow-up date
- notes

Required system fields:

- candidate ID
- workspace ID
- operating profile ID
- pipeline stage
- created at
- updated at
- source contract reference

## Business Prospect Record Contract

Purpose: preserve business-level context for the business associated with a candidate.

Required fields:

- business prospect ID
- workspace ID
- candidate reference
- business name
- business category
- website
- address
- source
- Google rating
- review count
- ownership research status
- territory fit notes
- research evidence references
- created at
- updated at

## JR Handoff Contract

Purpose: package a qualified candidate for JR review.

Required fields:

- handoff ID
- workspace ID
- candidate reference
- business prospect reference
- handoff status
- qualified candidate summary
- readiness assessment status
- preferred territory
- capital self-report summary
- desired location count
- protected candidate reference
- commission tracking reference
- evidence references
- handoff owner
- handoff created at
- handoff completed at

## Commission Tracking Contract

Purpose: plan commission forecast and eligibility tracking without financial automation.

Required fields:

- commission tracking ID
- workspace ID
- candidate reference
- JR handoff reference
- forecast amount
- forecast basis
- forecast confidence
- eligibility status
- trigger stage
- closed sale date
- review owner
- notes

## Protected Candidate Tracking Contract

Purpose: plan candidate protection windows for Cruz-sourced candidates.

Required fields:

- protected candidate ID
- workspace ID
- candidate reference
- protected candidate start date
- protected candidate expiration date
- protection status
- protected by
- JR handoff reference
- agreement basis
- review owner
- notes

Protection period duration is not assigned by this planning contract.

## Workspace Isolation Guardrail

Required values:

- workspace ID: `smoothie_depot`
- operating profile ID: `franchise_development`
- Fitness Connection separation confirmed: true
- Route Intelligence influence: false
- Active Pool scoring influence: false
- Dashboard runtime influence: false
- runtime mutation authorized: false

## Planned CRM Reports

- candidate pipeline counts
- JR handoff readiness queue
- protected candidate expiration watchlist
- commission forecast watchlist
- next follow-up queue
- not qualified and no response review

## Runtime Approval Required

Future runtime work requires explicit approval before creating candidate persistence, business prospect persistence, JR handoff queue operations, commission tracking updates, protected candidate window updates, or Dashboard consumption.
