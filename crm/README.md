# Prometheus CRM

Prometheus CRM owns local CRM state for contacts, leads, follow-ups, task queues, visit history, sales activity history, and beta activity reporting.

## Boundary

CRM consumes existing Runtime Data / Dashboard-compatible route records. It does not choose routes, score prospects, render Dashboard UI, modify Companion behavior, or connect external communication providers such as Gmail, SMS, or Outlook.

CRM also owns the operating architecture for company accounts, pilot companies, enterprise opportunities, customer onboarding, customer success, expansion, renewal, account health, and executive relationships. Sales owns go-to-market method and customer-facing narrative; CRM owns the internal account system of record.

## Current Foundations

- `crm-foundation.mjs`: local beta CRM records, leads, follow-ups, tasks, visits, notes, sales activity, and reports.
- `enterprise-lifecycle-architecture.md`: account/customer-success architecture for 1 company, 10 companies, 100 companies, and enterprise deployments.
- `enterprise-lifecycle-model.json`: machine-readable CRM operating model for validation and future implementation.

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
