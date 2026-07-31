# Route IQ Revenue Failure Recovery v1

- Stop activation and billing after uncertain authorization, duplicate request, provider error,
  identity mismatch, version drift, or partial state.
- Preserve safe evidence and distinguish no attempt, attempted, accepted, rejected, and unknown.
- Never automatically retry an ambiguous charge, invoice, refund, notification, invitation,
  cancellation, or activation.
- Reconcile with the authoritative provider and customer/workspace state using read-only checks.
- Route code, security, legal, billing, and customer-data defects to their owners.
- Resume only from a verified idempotency key and exact commercial-model version.
