# Prometheus Integrations

Shared integration contracts for backend-safe third-party service access.

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
