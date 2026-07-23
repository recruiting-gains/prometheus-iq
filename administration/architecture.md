# Administration Architecture

## Mission

Administration prepares Prometheus to operate a private beta program that can scale from one tester to hundreds without requiring changes to Dashboard, Companion, CRM, Infrastructure, or Integrations.

The subsystem is intentionally file-based at v1. That keeps operations inspectable, commit-friendly, and recoverable while Prometheus is still founder-led and before a backend administrative product exists.

## Ownership Model

Administration owns the operational state around beta activity:

- Who is approved to test.
- Which agreement path applies.
- Whether onboarding is complete.
- Which device/browser combinations are in use.
- Which permissions a tester should receive.
- Which release a tester is on.
- Which bugs and requests have been reported.
- Which test sessions produced beta findings.
- Which positive feedback, workflow observations, route quality observations, and performance observations were captured.
- Which release, regression, and tester sign-off records support closure.
- Which pilot companies are active or being evaluated.
- Which Route IQ companies and workspaces are admitted for Founder research, synthetic validation, pending customer approval, or customer operation.
- Which named users, roles, capabilities, locations, and territories are administratively admitted.
- Which versioned company configuration is current and where its Data and Intelligence owner artifacts must come from.
- Which dashboard requirements a future admin surface must satisfy.

Other subsystems continue to own implementation:

- Dashboard owns app UI and field workflows.
- Data owns business facts, opportunity records, provider observations, freshness, and provenance.
- Intelligence owns operating-profile semantics, route eligibility, and ranking.
- Infrastructure owns Cloudflare Access, deployment, authentication, and production verification.
- CRM owns outbound communication systems.
- Integrations owns third-party service connections.
- Companion remains founder-only.

## Operational Data Flow

1. A candidate tester or pilot company is proposed.
2. Administration records the candidate in the relevant registry.
3. Legal agreement path is selected and tracked by status only.
4. Infrastructure is asked to grant access only after Administration marks the tester approved.
5. Tester onboarding is completed using the Administration checklist.
6. Device inventory is recorded before first field use.
7. Release/version assignment is recorded.
8. Test session history is recorded when a tester uses Prometheus IQ in the field.
9. Bugs, feature requests, positive feedback, workflow observations, route quality observations, and performance observations are triaged through Administration workflows.
10. Confirmed engineering work is routed to the owning subsystem.
11. Release verification and regression verification are recorded after subsystem handoff.
12. Tester sign-off is recorded before closing beta-impacting issues.
13. Founder review uses the registers to decide whether to continue, pause, expand, or stop the beta.

## Scaling Model

The registers use stable IDs so future tooling can import them into a database or admin dashboard without changing the operating model.

Recommended scale stages:

- Stage 1: one tester, manual registers.
- Stage 2: up to 10 testers, weekly register review, strict device tracking, and issue routing discipline.
- Stage 3: up to 100 testers, required intake owner, release assignment, session history, regression verification, and weekly bug/request triage.
- Stage 4: enterprise pilots, controlled company profiles, approved user rosters, manager review cadence, legal/agreement tracking, and secure backend migration planning before adding live centralized beta data.

## Route IQ Configuration Authority

`contracts/route-iq-workspace-configuration-v2.schema.json` and its validator define the Administration-owned admission boundary. The registry names companies, workspace lifecycle, operating-profile references, locations, territories, users, roles, capabilities, reusable card fields, filters, sorts, actions, outcomes, KPIs, availability policy, owner artifact references, retention, fallback behavior, and provenance.

Administration does not copy business records into configuration. A workspace references a Data-owned approved opportunity artifact and an Intelligence-owned operating-profile contract. Missing, pending, mismatched, synthetic, cross-workspace, demo, or fallback sources fail closed.

The launch envelope remains a maximum of two companies and 40 named users. Cruz is the only attended Founder identity. Anthony is unmapped. Collection remains `OFF`, active cohorts remain `0`, and recommendation influence remains `OFF`.

## Founder Admin Dashboard Requirements

The future founder administrative dashboard should read from Administration-owned concepts, not from ad hoc notes. It should eventually expose:

- Tester status by lifecycle stage.
- NDA/agreement status.
- Onboarding completion.
- Device/browser inventory.
- App version assigned and last verified.
- Permission role assigned.
- Test session history.
- Open critical bugs.
- Open high-value feature requests.
- Positive feedback and workflow observations.
- Route quality and performance observations.
- Regression verification and tester sign-off status.
- Pilot company status.
- Release notes and beta-impact summaries.

This v1 does not implement that dashboard. It defines the requirements and operating records that the dashboard should consume later.

## Security Rules

- Do not store secrets, API keys, Cloudflare tokens, access cookies, passwords, or one-time PINs.
- Do not store personal customer data from a tester's employer.
- Do not treat an NDA as permission to collect third-party confidential data.
- Store legal status as an operational flag; signed legal documents belong in controlled customer/tester folders according to `legal/README.md`.
- Do not grant access directly from Administration files. Access changes remain Infrastructure-owned.

## Versioning

Administration records beta-visible changes in `registers/release-history.json`. Product releases continue to use the existing release checklist and deployment process. Administration release records should cite product commits or deployment IDs only when verified.
