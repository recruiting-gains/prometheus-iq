# Cloudflare Founder-Attended 30-Day Access Service Token Provisioning v1

## Status

- Batch: `BATCH-20260714-007`
- Owner: Prometheus Infrastructure
- Source status: `IMPLEMENTED_SOURCE_NOT_EXECUTED`
- Cloudflare accessed: `false`
- Keychain values accessed: `false`
- Credential created: `false`
- Deployed or pushed: `false`

This source implements a future Founder-attended local operation. Its tests use injected Keychain and transport doubles. They do not contact Cloudflare, read the real Keychain, create credentials, modify Access policies, deploy Workers, or mutate production.

## Fixed Operation

The tool has one provisioning profile:

- Endpoint: `https://api.cloudflare.com/client/v4/accounts/{validated account}/access/service_tokens`
- Name: `Prometheus Overwatch Read-Only Smoke Verification`
- Duration: `720h`
- Body: `{"name":"Prometheus Overwatch Read-Only Smoke Verification","duration":"720h"}`

The account ID is read only from `com.prometheus.cloudflare.unattended.deployment/CLOUDFLARE_ACCOUNT_ID`. Its SHA-256 must exactly equal `2abc795ed0df284a522381c09dca33fc567105c74074140fd920c0dd45dcd536` before the endpoint is constructed. The raw account ID is never source-controlled, printed, logged, or returned.

After the one-shot control nonce is consumed, the tool performs one `GET` against the exact collection endpoint with no query string. It denies creation if the fixed name exists or if the response cannot prove the first page is complete. It then performs at most one `POST`. Redirects are not followed and requests are never retried.

## Credential Separation

The Founder must manually create a separate temporary Cloudflare API token with exactly:

- Permission: `Access: Service Tokens Write`
- Resource: the exact Prometheus account only
- Expiry: no more than 30 days (`720` hours)
- Automatic renewal: OFF

Store it only as this new macOS Keychain generic-password item:

| Keychain service | Keychain account |
| --- | --- |
| `com.prometheus.cloudflare.attended.service-token-provisioning` | `CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN` |

Use Keychain Access to move the value directly from Cloudflare's one-time display into the Keychain password field. Do not use a Terminal argument, shell variable, environment variable, file, note, report, screenshot, browser save, or source-controlled artifact.

The existing unattended `CLOUDFLARE_API_TOKEN` is outside the attended registry and is never read, modified, deleted, or passed to a child process. The created service-token pair is written directly to:

| Keychain service | Keychain account |
| --- | --- |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_ID` |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_SECRET` |

The Security.framework Swift helper receives write values through anonymous standard input. Secret values never enter argv, environment, files, or output. Both destination names must be absent before any value read, control consumption, or network access. A partial or ambiguous pair write triggers deletion of both possible destination items and name-only absence verification.

## One-Shot Control

Real `provision-attended` execution requires the Founder on the controlling TTY and the exact displayed confirmation phrase. Tests replace only this attendance adapter.

After confirmation and local preflight, the command creates the non-secret control at:

`$HOME/.prometheus/infrastructure/cloudflare-founder-attended-service-token-v1/control.json`

Missing control is OFF. The command will not replace an existing control. The file is a regular, single-link, current-user-owned `0600` file inside a current-user-owned `0700` directory. Its strict JSON fixes the directive, account digest, service-token name, and duration; binds the current clean commit and tree; and expires within 30 minutes.

Before the first network call, the nonce is consumed by exclusive creation of a persistent `0600` receipt in the owner-only sibling `control.json.consumed` directory. Concurrent or replayed consumption fails closed. Do not remove a consumed receipt to repeat an ambiguous operation.

## Invocation

Run from a clean committed checkout at the intended version. No command accepts an endpoint, account, name, duration, body, credential, retry, force, or override argument.

1. Confirm the temporary token and account-ID names are `PRESENT`, and both smoke destination names are `ABSENT`:

   ```bash
   npm run infrastructure:cloudflare-founder-attended:presence
   ```

2. With the Founder at the controlling TTY, create and consume the fixed one-shot control, run the duplicate preflight, and make at most one create attempt:

   ```bash
   npm run infrastructure:cloudflare-founder-attended:provision-attended
   ```

3. Whether provisioning succeeds, is compensated, or requires manual review, remove only the temporary Keychain item:

   ```bash
   npm run infrastructure:cloudflare-founder-attended:cleanup-temp
   ```

4. Immediately revoke the temporary Cloudflare API token in Cloudflare. Keychain deletion happens first; Cloudflare revocation is mandatory second.

5. Run name-only presence again. The temporary item must be `ABSENT`. After successful provisioning, both smoke destination names must be `PRESENT`:

   ```bash
   npm run infrastructure:cloudflare-founder-attended:presence
   ```

## Failure Handling

- Never rerun `provision-attended` after an ambiguous POST. Its persistent one-shot receipt remains consumed.
- A duplicate, redirect, malformed response, incomplete page, or GET failure stops before POST.
- A POST network failure, redirect, status failure, or response without a safely validated returned token ID enters explicit `manual review required` state without retry.
- If a strict Cloudflare success envelope contains the exact fixed name and a valid returned token ID but the rest of the response fails validation, the tool attempts one fixed `DELETE` at the validated account collection plus that ID.
- If Keychain pair storage fails, the tool first rolls back both possible local items and then attempts the same one-shot compensating `DELETE` using the validated ID.
- A strictly confirmed compensating delete reports a compensated failure. Ambiguous POST state, compensation failure, or local rollback failure reports manual review required.
- Manual review means the Founder inspects Cloudflare by the exact fixed name and deletes or revokes that service token before any separately reviewed recovery. Do not create a second token.
- If temporary cleanup fails, use Keychain Access to remove only `com.prometheus.cloudflare.attended.service-token-provisioning/CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN`, rerun name-only presence, and revoke the temporary token in Cloudflare.

Errors omit response bodies, credentials, request headers, account values or hashes, token IDs, prefixes, and value lengths. CLI output is fixed generic status text plus name-only presence.

## Local Verification

The Infrastructure gate is mock-only:

```bash
npm run infrastructure:cloudflare-founder-attended:check
```

It verifies the fixed constants and endpoint, exact three-mode CLI, strict owner-only control, replay and concurrency denial, controlling-TTY boundary, duplicate and redirect handling, single POST, compensating delete, manual-review states, pair rollback, cleanup scope, Security.framework stdin writes, secret-registry coverage, and leakage resistance.
