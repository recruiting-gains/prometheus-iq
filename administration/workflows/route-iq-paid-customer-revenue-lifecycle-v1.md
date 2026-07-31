# Route IQ Paid-Customer Revenue Lifecycle v1

Owner: Prometheus Administration

`Prometheus Route Intelligence LLC` is a proposed, unregistered entity. `Prometheus Route IQ`
is the product. This specification supplies no binding price, payment, legal, service, refund,
privacy, tax, or cancellation term.

## Authoritative Sequence

`DRAFT -> VALIDATION_FAILED -> DRAFT` is the failure-recovery loop.

`DRAFT -> VALIDATED -> AWAITING_COMMERCIAL_APPROVAL -> READY_FOR_ACTIVATION -> ACTIVE`
is the forward sequence. `SUSPENDED` and terminal `CANCELLED` are controlled service states.

Draft intake cannot provision a workspace, invite a user, attempt billing, activate a customer,
or create a production customer record. Validation proves only that a version-pinned intake is
complete enough for review. It is not customer acceptance, legal approval, activation, or
permission to collect revenue.

## Evidence Gates

`READY_FOR_ACTIVATION` requires verified Founder commercial approval, customer order-form
acceptance, legal review, data-handling approval, support ownership, and workspace validation.

`ACTIVE` additionally requires a registered entity, confirmed tax identity and bank account,
approved pricing, an approved production billing provider, customer payment authorization,
an executed agreement, and an approved refund/cancellation policy.

Unknown, missing, stale, contradictory, unpinned, or unauthorized evidence fails closed.
Evidence is referenced by safe identifiers; contracts and payment credentials are not copied
into lifecycle events.

## Recovery

Validation failure preserves the version pin, safe failure code, reviewer, and recovery action.
Failed activation or billing attempts do not advance state and must not be retried automatically.
Cancellation suspends access first, preserves governed evidence and retention obligations, and
requires separately approved financial and data disposition.
