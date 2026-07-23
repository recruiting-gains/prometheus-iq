# Prometheus Integrations

Shared integration contracts for backend-safe third-party service access.

## Shared Workspace Lead Intake Contract v1

Entrypoints:

```text
integrations/shared-workspace-lead-intake-contract.js
workers/infrastructure/shared-lead-intake-pipeline.js
```

The contract registers the Infrastructure-owned intake path for isolated workspace lead capture:

- `POST /api/partner-intake`
- `SHARED_LEAD_INTAKE_STORE`
- an Administration-owned governed workspace registry with no embedded customer routes
- intake submission artifact shape
- `shared_workspace_crm_lead_intake_packet.v1`
- Founder email notification event state
- failure/retry event semantics
- audit metadata
- Aegis `lead_intake` metadata
- unknown or missing workspace fail-closed behavior

Infrastructure validates, protects, routes, persists, and prepares handoff packets. CRM owns CRM business logic and consumes handoff packets through `consumeWorkspaceLeadIntakeHandoff`. Dashboard and Companion do not read raw intake data without a future explicit approval.

Verification:

```bash
npm run infrastructure:intake-contract:check
```

## Business Hours Provider Adapter v1

Entrypoint:

```text
integrations/business-hours-provider-adapter.js
```

The provider-neutral adapter is a Worker-safe boundary between a governed external
hours provider and Prometheus Data normalization. It:

- defaults to `OFF` and performs zero transport calls while disabled
- permits `GET` only and rejects redirects
- accepts a fixed HTTPS endpoint and strict opaque business/provider identities
- enforces a strict response-field allowlist
- requires complete, identity-matched results
- uses a bounded caller-supplied retry schedule
- enforces request timeouts without retaining provider responses
- returns only `route-iq-business-hours-data-normalization-input.v1`
- never returns eligibility, recommendation, credential, header, or raw-response data

No provider credential, paid-provider activation, or live provider endpoint is
configured by this contract. Data remains responsible for normalization,
freshness, provenance acceptance, and current-state derivation. Intelligence
remains responsible for route eligibility.

Verification:

```bash
node --test tests/business-hours-provider-adapter.test.mjs
```

## Founder Calendar & Message Contract v1

Entrypoints:

```text
integrations/founder-communications-contract.js
integrations/founder-communications-service.js
integrations/google-founder-communications-adapter.js
integrations/microsoft-founder-communications-adapter.js
```

The contract defines provider-neutral data models for:

- founder calendar events
- upcoming meetings
- daily agenda responses
- message summaries
- draft message requests
- future message send requests
- connection state, capability status, and standardized errors

Connection states:

```text
connected
disconnected
permission_required
sync_pending
sync_complete
error
```

The default service adapter returns safe disconnected responses unless a provider is selected through backend environment configuration. Provider adapters keep credentials backend-only and return these shared models so Companion, Dashboard, and Mobile consume the same interface.

Message sending is a future-ready contract only. It requires an explicit authorization id and returns unsupported capability until a provider adapter implements sending outside Companion business logic.

## Provider Selection

```text
PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER=google
PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER=microsoft
PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER=outlook
```

Supported provider adapters:

- Google Calendar + Gmail
- Microsoft Outlook / Microsoft 365 through Microsoft Graph

## Google Configuration

```text
GOOGLE_FOUNDER_CLIENT_ID=
GOOGLE_FOUNDER_CLIENT_SECRET=
GOOGLE_FOUNDER_REFRESH_TOKEN=
GOOGLE_FOUNDER_SCOPES=https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly
```

The Google adapter supports:

- calendar events
- upcoming meetings
- daily agenda
- Gmail message summaries
- Gmail draft retrieval

It does not send email or create calendar invitations.

## Microsoft Configuration

```text
MICROSOFT_FOUNDER_TENANT_ID=common
MICROSOFT_FOUNDER_CLIENT_ID=
MICROSOFT_FOUNDER_CLIENT_SECRET=
MICROSOFT_FOUNDER_REFRESH_TOKEN=
MICROSOFT_FOUNDER_SCOPES=Calendars.Read Mail.Read
```

The Microsoft adapter supports:

- Outlook calendar events
- upcoming meetings
- daily agenda
- Outlook message summaries
- Outlook draft retrieval

It does not send email or create calendar invitations.

## Security Boundary

- Tokens stay in backend environment variables.
- Access tokens are refreshed server-side.
- Provider errors redact token-like fields before returning status details.
- Send operations return unsupported capability responses.
- Draft creation is intentionally disabled in v1; retrieval is supported where provider APIs expose drafts.

## Verification

```bash
node --check integrations/founder-communications-contract.js
node --check integrations/founder-communications-service.js
node --check integrations/oauth-provider-auth.js
node --check integrations/google-founder-communications-adapter.js
node --check integrations/microsoft-founder-communications-adapter.js
node --test tests/founder-communications-contract.test.mjs
node --test tests/founder-communications-provider-adapters.test.mjs
```
