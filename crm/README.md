# Prometheus CRM

Prometheus CRM owns local CRM state for contacts, leads, follow-ups, task queues, visit history, sales activity history, and beta activity reporting.

## Boundary

CRM consumes existing Runtime Data / Dashboard-compatible route records. It does not choose routes, score prospects, render Dashboard UI, modify Companion behavior, or connect external communication providers such as Gmail, SMS, or Outlook.

CRM also owns the operating architecture for company accounts, pilot companies, enterprise opportunities, customer onboarding, customer success, expansion, renewal, account health, and executive relationships. Sales owns go-to-market method and customer-facing narrative; CRM owns the internal account system of record.

## Current Foundations

- `crm-foundation.mjs`: local beta CRM records, leads, follow-ups, tasks, visits, notes, sales activity, and reports.
- `enterprise-lifecycle-architecture.md`: account/customer-success architecture for 1 company, 10 companies, 100 companies, and enterprise deployments.
- `enterprise-lifecycle-model.json`: machine-readable CRM operating model for validation and future implementation.
- `paid-customer-workflow-configuration-v1.mjs`: production-readiness foundation for versioned, company-and-workspace-scoped CRM roles, stages, workflows, metrics, preview, idempotent provisioning projections, lifecycle controls, and append-only audit.
- `paid-customer-workflow-contract-v1.json`: machine-readable execution boundary for the paid-customer CRM foundation. Preview and provisioning remain non-activating, perform no production CRM mutation, and send no notification.

The earlier beta-oriented modules remain historical compatibility surfaces. New paid-customer workflow configuration must use the versioned paid-customer contract and stable internal identifiers rather than customer-specific branches or display labels as keys.

## Attribution

CRM consumes Website attribution output and normalizes CRM lead attribution through the Social Media attribution contract. Use `attachWebsiteAttributionToLead` to attach `lead_source`, `campaign_id`, `campaign_platform`, first touch, last touch, qualified status, and manual notes to lead records. Do not create a separate CRM attribution model and do not call social provider APIs from CRM.

## Operating Profiles

CRM consumes Operating Profile definitions from the Intelligence Engine. Fitness is the default profile. Use `buildCrmOperatingProfile`, `applyCrmOperatingProfileToLead`, `transitionLeadProfileStage`, and `recordProfileOutcomeForLead` for profile-driven terminology, CRM stages, outcome labels, and profile-aware pipeline reporting. Do not hardcode a new industry-specific CRM stage model inside CRM.

## Workspace Lead Intake

CRM consumes Infrastructure-prepared `shared_workspace_crm_lead_intake_packet.v1` handoff packets through `consumeWorkspaceLeadIntakeHandoff`. Use `persistWorkspaceLeadIntakeHandoff` with a CRM-owned durable store adapter to persist canonical workspace lead records under `crm-workspace-leads/` keys. Infrastructure owns receipt, routing, and intake storage; CRM owns customer lead persistence.

Only workspaces explicitly registered in `supportedWorkspaceLeadIntakeWorkspaces` may enter the CRM consumer. Removing or retiring a customer workspace means removing its registration; historical or caller-supplied identifiers cannot reactivate a route. Unknown, inactive, or unapproved workspace packets fail before CRM state or durable storage changes.

### Production Durable Store

Production CRM workspace leads use the dedicated Cloudflare Workers KV binding `CRM_WORKSPACE_LEAD_STORE` and namespace `f20a0a4f66fb4b53ab26644e2d3bd0dd`. `createCloudflareKvCrmWorkspaceLeadStore` implements the existing readable/writable persistence interface, while `persistWorkspaceLeadIntakeWithProductionStore` composes the Infrastructure handoff packet into CRM-owned durable records. `readWorkspaceLeadIntakeFromProductionStore` resolves the submission index and verifies the workspace partition before returning a record.

The production Worker persists the currently approved Fitness Connection lead handoffs and fails closed when the CRM binding is unavailable. Additional companies require a separately validated workspace configuration and runtime approval before CRM routing or persistence is possible.

## Route IQ Requests

`route-iq-request-crm.mjs` extends the existing CRM lead persistence model for commercial Route IQ requests. It strictly validates the approved request fields, assigns a server timestamp, stores no idempotency key in the canonical lead record, and requires an atomic `putIfAbsent` store primitive for deterministic duplicate and conflict handling. Identical content receives one stable receipt; reuse of an idempotency key with changed content fails closed.

Founder retrieval and JSON/CSV export require the exact immutable Cruz principal from Data's canonical `route-iq-commercial-workspace-registry-v1.json`. CRM does not maintain a second identity mapping. A display name, Founder role claim by itself, representative identity, or Anthony identity without a separately governed exact Data mapping is not sufficient. Failure telemetry contains only an opaque attempt identifier and fixed nonsecret status fields.

The public `POST /api/partner-intake` boundary does not require Cloudflare Access. Founder retrieval is limited to `GET /api/partner-intake/founder/requests`, `GET /api/partner-intake/founder/requests/{receiptId}`, `GET /api/partner-intake/founder/monitoring`, `GET /api/partner-intake/founder/monitoring/{receiptId}`, and `GET /api/partner-intake/founder/export`, all beneath the protected `/api/partner-intake/founder/*` application path. Monitoring responses contain only counts, exact receipt identifiers, fixed statuses, and fixed failure codes; they never contain contact or request fields. The Infrastructure adapter must verify the Cloudflare Access JWT and compare the SHA-256 digest of its immutable `sub` claim before it may construct CRM's canonical Founder principal. `Everyone`, `Bypass`, and display-name authorization are prohibited.

The value-free configuration-name contract is `ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN`, `ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE`, and `ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256`. Their values are runtime configuration and never belong in CRM source, tests, or reports.

## v1 Workflow

Supported lead states:

```text
New Lead -> Contacted -> Follow-up Required -> Appointment Scheduled -> Proposal -> Customer -> Closed Lost
```

Route visit outcomes update lead state and append immutable visit entries to both the contact and lead records. Follow-up-required outcomes create a pending follow-up and a matching founder or rep task.

## Reporting

`buildCrmReports` generates:

- Today's follow-ups
- Overdue follow-ups
- Anthony beta activity
- Founder activity summary
- Contact pipeline counts
- Task completion status

## v2 Enterprise Lifecycle

CRM v2 prepares Prometheus for multiple customer accounts without modifying production beta systems. It defines:

- Company accounts and account hierarchy.
- Contacts, decision makers, champions, and executive sponsors.
- Beta, pilot, customer, expansion, and renewal lifecycle records.
- Account timeline, meeting history, adoption, success milestones, and health scoring.
- District, regional, company, location, team, and rep hierarchy.
- Duplicate-prevention rules for Sales, Dashboard, Companion, Infrastructure, Data, and Intelligence Engine boundaries.
