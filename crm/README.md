# Prometheus CRM

Prometheus CRM owns local CRM state for contacts, leads, follow-ups, task queues, visit history, sales activity history, and beta activity reporting.

## Boundary

CRM consumes existing Runtime Data / Dashboard-compatible route records. It does not choose routes, score prospects, render Dashboard UI, modify Companion behavior, or connect external communication providers such as Gmail, SMS, or Outlook.

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
