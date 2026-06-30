# Prometheus Integrations

Shared integration contracts for backend-safe third-party service access.

## Founder Calendar & Message Contract v1

Entrypoints:

```text
integrations/founder-communications-contract.js
integrations/founder-communications-service.js
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
```

The default service adapter returns safe disconnected responses. It does not connect to Google Calendar, Gmail, Outlook, or any other provider. Future provider adapters must keep credentials backend-only and return these shared models so Companion, Dashboard, and Mobile consume the same interface.

Message sending is a future-ready contract only. It requires an explicit authorization id and returns unsupported capability until a provider adapter implements sending outside Companion business logic.

## Verification

```bash
node --check integrations/founder-communications-contract.js
node --check integrations/founder-communications-service.js
node --test tests/founder-communications-contract.test.mjs
```
