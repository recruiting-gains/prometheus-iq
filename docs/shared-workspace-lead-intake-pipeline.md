# Shared Workspace Lead Intake Pipeline v1

Subsystem: Prometheus Infrastructure
Status: implemented as shared platform infrastructure

## Purpose

Prometheus workspaces must not own lead intake infrastructure. The shared platform receives incoming partner/customer leads, validates them, protects them with Aegis, routes them to the correct isolated workspace, persists the submission, prepares the CRM handoff packet, notifies the founder, and returns public success metadata.

## Endpoint

```text
POST /api/partner-intake
```

Supported body types:

- `application/json`
- `application/x-www-form-urlencoded`

The endpoint is served by the shared Worker infrastructure and is available through the public website Worker. It does not require Dashboard, Companion, CRM runtime, Mobile, Intelligence runtime, or Website UI changes.

## Flow

```text
Website
POST /api/partner-intake
Validation
Spam protection
Workspace Router
Durable Storage
Workspace CRM handoff packet
Founder notification
Success Response
```

## Workspace Router

Current registered workspaces:

- `fitness_connection`
  - Workspace name: Fitness Connection
  - Operating profile: Fitness
  - CRM handoff path: `crm://workspace/fitness_connection/leads`
- `smoothie_depot`
  - Workspace name: Smoothie Depot
  - Operating profile: Franchise Development
  - CRM handoff path: `crm://workspace/smoothie_depot/candidate_pipeline`

The router accepts explicit workspace IDs and known aliases. Unknown workspaces fail closed with HTTP `400`; future customer workspaces must be registered before intake can route to them.

## Durable Storage

Cloudflare KV namespace:

```text
Binding: SHARED_LEAD_INTAKE_STORE
Namespace ID: 5c78f078c68147f089f7b6423c99688c
```

Each submission receives:

- submission ID
- timestamp
- workspace ID and name
- operating profile
- attribution
- source
- status
- CRM handoff packet
- founder notification status
- audit trail

Storage keys:

```text
shared-lead-intake/workspaces/{workspaceId}/submissions/{submissionId}
shared-lead-intake/submissions/{submissionId}
shared-lead-intake/audit/{workspaceId}/{submissionId}
shared-lead-intake/notifications/{workspaceId}/{submissionId}
```

The endpoint persists the submission before attempting founder notification. If founder email delivery is unavailable or fails, the submission remains stored and notification status is recorded as queued.

## CRM Boundary

Infrastructure prepares the workspace-scoped CRM handoff packet only.

Infrastructure does not:

- create CRM records
- mutate CRM runtime state
- own CRM stages
- mix workspace CRM data
- call customer-specific CRM logic

CRM remains the owner of customer records and future workspace-specific CRM consumption.

## Founder Notification

Email notification uses the Cloudflare Email Service Worker binding:

```text
Binding: FOUNDER_EMAIL
Destination: prometheusrouteiq@gmail.com
Default sender: intake@prometheusrouteiq.com
```

If Cloudflare Email Service sender/domain setup is incomplete, the endpoint records the notification as queued and returns success for the stored submission. Future hooks are reserved for Dashboard and Companion surfaces.

## Security

Operation Aegis protects the route as `lead_intake`:

- method guard
- KV-backed rate limiting
- no-store API responses
- strict API CSP
- no permissive CORS
- workspace isolation validation
- spam honeypot and timing checks
- audit logging

## Verification

Primary verification command:

```bash
npm run infrastructure:lead-intake:check
```

Supporting security verification:

```bash
npm run security:aegis:verify
npm run security:check
```

Production smoke:

```bash
curl -sS -X POST https://prometheusrouteiq.com/api/partner-intake \
  -H 'content-type: application/json' \
  --data '{"workspaceId":"fitness_connection","companyName":"Example","contactName":"Example Contact","contactMethod":"example@example.com","primaryGoal":"Validate shared intake","currentWorkflow":"Testing shared workspace lead intake.","openedAt":"2026-07-03T15:00:00.000Z"}'
```

Do not include secrets, private customer payloads, or credentials in verification examples.
