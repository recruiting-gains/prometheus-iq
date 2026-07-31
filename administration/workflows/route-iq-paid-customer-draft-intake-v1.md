# Route IQ Draft-Only Customer Intake v1

Intake creates one Administration-owned `DRAFT` record containing an opaque intake ID, exact
commercial-model pin, proposed company display name, requested operating profile, decision-maker
role, requested territories, estimated users, desired timing, and required review evidence.

The intake surface must:

- collect only necessary business contact and configuration information;
- validate authorization to submit and consent to follow-up;
- reject secrets, payment credentials, government identifiers, uncontrolled attachments, and
  unnecessary personal data;
- assign no production company, workspace, user, role, territory, provider, or billing identity;
- send no invitation and initiate no billing, collection, activation, or recommendation action;
- remain isolated from customer production records;
- report validation errors without echoing sensitive input.

Draft export or deletion requires authorized Administration handling. A Draft may move only to
`VALIDATION_FAILED` or `VALIDATED`. Every later state is governed by the revenue lifecycle.
