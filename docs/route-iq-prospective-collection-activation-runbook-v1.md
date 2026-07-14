# Route IQ prospective collection activation runbook v1

Batch: `BATCH-20260714-004`

Owner: Prometheus Infrastructure

Status: local activation-readiness procedure only. Collection remains `OFF`, active cohorts remain `0`, recommendation influence remains `OFF`, and no deployment or production access is authorized by this document.

## Safety boundary

This runbook applies only after the Founder separately authorizes an exact commit, tree, private `prometheus-iq` Worker target, dark-deployment scope, rollback artifact, and later activation scope. A source push is not deployment or activation approval. The public Website Worker is always excluded.

Stop before any production action if authentication is absent, interactive login or MFA is required, the exact authorized commit/tree differs, repository state is dirty, bindings or migrations differ, collection is not `OFF`, active cohorts are not zero, the deployed environment or counts are `UNVERIFIED`, production counts differ, a secret value would be exposed, or the public Worker target cannot be proven unchanged.

Do not place Access assertions, subjects, cohort values, authority keys, secret values, customer data, or production API responses in source control, terminal transcripts, screenshots, reports, or logs.

## Source-controlled cohort template

`workers/infrastructure/route-iq-prospective-shadow-activation-template-v1.json` is deliberately `INERT_DEFAULT_OFF`. It is not a valid value for `ROUTE_IQ_PROSPECTIVE_SHADOW_COHORT_CONFIG` and must never be deployed verbatim.

A separately Founder-authorized runtime cohort value must be generated from trusted server records and contain exactly:

- version `route-iq-prospective-cohort-config-v2`;
- state `ACTIVE`;
- canonical `issuedAt` and `expiresAt`, with a positive lifetime no longer than 24 hours;
- supported opportunity types exactly `[next_stop]`;
- exactly one governed workspace, operating profile, and internal representative scope.

Names, email addresses, addresses, Access subjects, customer identifiers, and free text are prohibited. Duplicate, additional, unknown, stale, future-issued, malformed, cross-workspace, cross-profile, cross-representative, or unsupported-opportunity configuration fails closed.

## Founder kill switch

The global kill switch is `ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION`. Missing, empty, malformed, lowercase, unknown, or any value other than exact `ON` is `OFF`. The cohort configuration is a second independent gate. Recommendation influence remains independently hard-coded `OFF`; collection activation must never change it.

There is no administrative UI. A future change requires authenticated Cloudflare operator access, the exact Founder authorization, a recorded before-state, a bounded one-representative configuration, a non-secret change identifier, an authoritative change timestamp, and a recorded after-state. Never record configuration values containing protected identity mappings.

Immediate disable procedure after authenticated access is available:

1. Confirm the private Worker target and current version named by the Founder authorization.
2. Change only `ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION` to `OFF`; do not remove the Durable Object binding, migration history, namespace, or secret references.
3. Verify the read-only bootstrap returns the opaque disabled response.
4. Verify attempted prospective writes stop, active cohort count is zero, and existing evidence remains preserved.
5. Compare Durable Object, KV, opportunity, conflict, exclusion, evaluation, field-session, visit, action, and outcome counts with the before-state.
6. Record the authenticated change and verification without secret or PII values.

Disabling collection must never interrupt representative workflows and never deletes or rewrites evidence.

## Unattended local readiness

No Cloudflare authentication is used for local readiness. Run the existing Infrastructure verifier and tests. They exercise:

- collection-OFF bootstrap and endpoint behavior with zero attempted application writes and zero storage access;
- missing, malformed, stale, future-issued, unauthorized, multi-representative, and unsupported-opportunity configuration;
- one synthetic, noncanonical ON fixture with exactly one governed internal representative and `next_stop` only;
- Durable Object, KV, prospective, conflict, exclusion, and evaluation counts at zero before activation;
- candidate, event, session, outbox, row, SQL, and storage budget ceilings;
- Data-owned administrative-disposition consumer exclusion contracts without appending or changing production data.

`auditRouteIqProspectiveActivationReadiness` is a pure evaluator. It accepts only supplied local observations, marks `productionVerified = false`, `deployedEnvironmentStatus = UNVERIFIED`, and `deployedCountsStatus = UNVERIFIED`, never accesses Cloudflare or storage, and never authorizes activation. Local zero counters prove source safety only; they are not a claim that deployed production counts are zero. A hypothetical ON fixture is compatibility coverage only and never activation authorization.

## Authenticated deployment review when the Founder returns

These steps require a new Founder deployment authorization and valid non-interactive Cloudflare authentication. If `npx wrangler whoami` requires browser login, password, MFA, a new token, or broader permissions, stop without deployment or mutation.

1. Freeze the Founder-authorized commit and tree; verify `git status --porcelain=v1` is empty and local `main` equals `origin/main`.
2. Verify the private target is `prometheus-iq`; verify the public Worker version and deployment ID before any upload.
3. Record private Worker version, traffic, binding names, Durable Object migration tag, namespace identity, protected secret names only, active cohort count, collection state, recommendation influence, and all production record counts.
4. Verify the exact July 14 accidental archive hash and Data-owned disposition using read-only consumer gates. Confirm it remains byte-preserved and excluded from learning, readiness, evaluation, analytics, and recommendation inputs. Do not add, delete, or rewrite a disposition during smoke testing.
5. Verify the immutable forward-rollback package digest authorized by the Founder and run its local dry-run. Native Cloudflare rollback is prohibited after the stateful migration.
6. Run `npx wrangler deploy --dry-run --strict --keep-vars --config wrangler.jsonc` and inspect the generated binding/migration summary. Stop on any new resource, migration, secret, route, or public target.
7. Only under the exact deployment authorization, run `npx wrangler deploy --keep-vars --config wrangler.jsonc` for the private Worker.
8. Confirm the exact new private version at 100% intended traffic, the authorized commit/tree annotation, preserved migration/binding/secret references, collection `OFF`, active cohorts `0`, recommendation influence `OFF`, zero Durable Object objects, and unchanged public Worker.
9. Run the production read-only smoke verifier at exactly 390x844 with its default-deny write guard installed before navigation. Confirm zero dialogs, downloads, service-worker writes, form submissions, state-changing control activation, or application write attempts.
10. Compare every production count and protected archive hash with the before-state. Any mismatch requires `FOUNDER_REVIEW_REQUIRED`.

Dark deployment does not authorize collection.

## Separate activation review

Activation is a later, separately Founder-authorized operation. Before changing the global switch:

1. Reconfirm the deployed commit/tree/version, private target, public Worker, collection `OFF`, active cohorts `0`, recommendation influence `OFF`, and clean before-counts.
2. Reconfirm the Data-owned Founder boundary: raw and prospective evidence maximum 18 UTC calendar months from canonical creation; authenticated/hash/scope-bound customer shortening only; no expansion; legal hold pauses deletion/disposition until authorized release; indefinite aggregate only through a Data-attested non-identifying artifact; and physical production deletion remains unactivated.
3. Reconfirm the exact accidental archive remains byte-preserved and excluded by Data's exact disposition, not a broad zero-visit rule.
4. Construct the exact v2 cohort value from trusted server records. Validate it locally without printing it.
5. Apply the cohort value through the existing authenticated runtime-configuration procedure, retaining collection `OFF`.
6. Read the server-controlled bootstrap and confirm it remains disabled while the switch is OFF.
7. After a second explicit Founder activation approval, set only the global switch to exact `ON`.
8. Verify one active cohort, `next_stop` only, opaque bootstrap output, recommendation influence `OFF`, a fresh Data-signed retention admission, and budget/usage monitoring. Never expose shadow output.
9. Immediately set collection back to `OFF` and stop if any blocker, unexpected write, missing/stale/malformed/expired/held/cross-scope/tampered Data admission, budget breach, UI change, missing exclusion, conflict spike, or count mismatch appears.

## Monitoring and activation blockers

Before activation, all of the following must be known and passing: endpoint state, attempted application writes, active cohort count, Durable Object object count, KV writes, opportunities, conflicts, exclusions, evaluations, field-session counts, archive hashes, disposition consumer exclusion, candidate/event/session/outbox/row/SQL/storage usage, public Worker identity, and recommendation influence.

Activation remains blocked while any deployed environment/count is `UNVERIFIED`, any production fact is unavailable, authentication is unavailable, collection-OFF produces a write attempt, the exact production disposition is unresolved, Data retention admission is missing, stale, malformed, expired, held, cross-scope, hash-mismatched, or tampered, the one-representative scope is not Founder-approved, physical deletion is presumed active, costs are unreviewed, or a budget/usage signal is nonzero without an explained governed record.

## Forward rollback

Rollback is a new Founder-authorized forward deployment built from the verified inert package. First set collection `OFF`. Preserve the SQLite migration history, Durable Object class and namespace, binding, protected secret references, and all evidence. Do not use native rollback, `deleted_classes`, reset, force-push, history rewriting, data deletion, or archive rewrite.

After forward rollback, verify the prior application behavior, collection `OFF`, active cohorts `0`, recommendation influence `OFF`, zero coordinator calls/writes, unchanged production counts, and unchanged public Worker. Source rollback uses new forward-revert commits only.
