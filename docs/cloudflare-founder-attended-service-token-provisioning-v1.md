# Cloudflare Founder-Attended 30-Day Access Service Token Provisioning v1

## Status

- Batch: `BATCH-20260714-007`
- macOS TTY compatibility repair: `BATCH-20260715-001` (`Cloudflare Founder-Attended Real macOS TTY Compatibility Repair v1`)
- Owner: Prometheus Infrastructure
- Source status: `IMPLEMENTED_SOURCE_NOT_EXECUTED`
- Cloudflare accessed: `false`
- Keychain values accessed: `false`
- Credential created: `false`
- Deployed or pushed: `false`

This source implements a future Founder-attended local operation. Its tests use injected Keychain and transport doubles. A bounded native macOS PTY integration uses only a synthetic phrase and the TTY adapter. The tests do not contact Cloudflare, read the real Keychain, create credentials, modify Access policies, deploy Workers, or mutate production.

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

The Security.framework Swift helper receives write values through anonymous standard input. Secret values never enter argv, environment, files, or output. The helper itself enforces a fixed operation/item matrix before any `SecItem` call: presence for the four governed names, reads for only the temporary token and governed account ID, adds for only the smoke pair, and deletes for only the temporary token or smoke pair. It cannot be invoked as a generic Keychain reader or deleter.

Both destination names must be absent before any value read, control consumption, or network access. Each newly added smoke item carries a nonsecret, per-invocation ownership tag in `kSecAttrComment`. A partial or ambiguous pair write attempts deletion only when that exact tag still owns the item, then performs name-only absence verification. It never deletes a pre-existing or concurrently replaced destination item. Any remaining item requires manual review.

Source-level schema compatibility with the existing audited `/usr/bin/security find-generic-password -w -s ... -a ...` reader is preserved: the helper creates a default generic-password item with the same fixed service/account attributes and does not opt into a separate data-protection Keychain. The local macOS SDK declares `kSecAttrService`, `kSecAttrAccount`, `kSecAttrComment`, and `kSecValueData` for generic-password items. Mock tests verify the approved reader receives only fixed names in argv and captures the password through a pipe, with no secret in argv, environment, files, or terminal output.

The SDK does not establish that the default access-control list created for the Swift process will permit a later noninteractive `/usr/bin/security` read. The helper deliberately does not grant broad trusted-application access merely to make that assumption true. No real Keychain value was read or written for this source review, so runtime interoperability is not claimed. Before unattended readiness can be declared, the Founder must separately authorize an integration check through the audited unattended launcher that reads both fixed smoke names from the real Keychain, keeps values confined to captured pipes/process memory, emits only pass/fail, and performs no deployment. Until that check passes, readiness remains blocked.

## One-Shot Control

Real `provision-attended` execution requires the Founder on the controlling TTY and the exact displayed confirmation phrase. Both `stdin.isTTY` and `stdout.isTTY` must be true. The `stdin` and `stdout` file descriptors must each be character devices, and the `stdin` and `stdout` character-device `rdev` values must match so they identify the same concrete terminal.

The adapter opens only `/dev/tty` with read/write, no-follow, and no-controlling-terminal flags, then requires the opened descriptor to be a character device. On macOS, `/dev/tty` is an alias for the process controlling terminal and its alias device number differs from the concrete PTY device number reported by standard input and output. The `/dev/tty` `rdev` is intentionally not compared with either stream `rdev`. Prompt output and phrase input use only the opened `/dev/tty` descriptor.

Any false TTY flag, non-character descriptor, stream-device mismatch, `/dev/tty` open or type failure, wrong phrase, or oversized phrase rejects before Keychain activity, control creation or consumption, live repository/clock/random sampling, network transport, or another downstream external operation. The production entrypoint accepts no adapters or alternate attendance mechanism; it constructs the real TTY, Keychain, repository, clock, and HTTPS adapters internally. The clearly test-only core requires every adapter explicitly, so a fake confirmation cannot accidentally fall through to real Keychain or network defaults.

After confirmation and local preflight, the command creates the non-secret control at:

`$HOME/.prometheus/infrastructure/cloudflare-founder-attended-service-token-v1/control.json`

Missing control is OFF. The command will not replace an existing control. The file is a regular, single-link, current-user-owned `0600` file inside a current-user-owned `0700` directory. Its strict JSON fixes the directive, account digest, service-token name, and duration; binds the current clean commit and tree; and expires within 30 minutes.

Only after confirmation and all potentially blocking Keychain presence/value reads does the command sample the live repository and wall clock. Before the first network call, the nonce is consumed by exclusive creation of a persistent `0600` receipt in the owner-only sibling `control.json.consumed` directory. A structurally valid existing control is consumed before contextual validation, so an expired authorization, invalid or backwards clock, or changed/dirty checkout cannot leave it reusable.

The command samples the live clock and repository again immediately before the duplicate-preflight `GET`, and again immediately before the single `POST`. Each sample must be monotonic, inside the 30-minute control window, clean, and bound to the exact authorized commit and tree. Failure stops before that network operation; a failure after `GET` therefore performs no `POST`. Concurrent or replayed consumption fails closed. Do not remove a consumed receipt to repeat an ambiguous operation.

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

6. Before declaring the pair ready for unattended use, complete the separately authorized Founder-attended interoperability check described above. Name-only presence is necessary but does not prove `/usr/bin/security -w` can return both values to the approved launcher.

## Failure Handling

- Never rerun `provision-attended` after an ambiguous POST. Its persistent one-shot receipt remains consumed.
- A duplicate, redirect, malformed response, incomplete page, or GET failure stops before POST.
- A POST network failure, redirect, status failure, or response without a safely validated returned token ID enters explicit `manual review required` state without retry.
- If a strict Cloudflare success envelope contains the exact fixed name and a valid returned token ID but the rest of the response fails validation, the tool attempts one fixed `DELETE` at the validated account collection plus that ID.
- If Keychain pair storage fails, the tool first rolls back only items still carrying this invocation's ownership tag and then attempts the same one-shot compensating `DELETE` using the validated ID.
- A strictly confirmed compensating delete reports a compensated failure. Ambiguous POST state, compensation failure, or local rollback failure reports manual review required.
- A process death can leave one or both destination names after the remote create. A later run fails before value reads, control handling, or network and reports manual review; it never guesses that a surviving item is safe to delete.
- Manual review means the Founder inspects Cloudflare by the exact fixed name and deletes or revokes that service token before any separately reviewed recovery. Do not create a second token.
- If temporary cleanup fails, use Keychain Access to remove only `com.prometheus.cloudflare.attended.service-token-provisioning/CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN`, rerun name-only presence, and revoke the temporary token in Cloudflare.

Errors omit response bodies, credentials, request headers, account values or hashes, token IDs, prefixes, and value lengths. CLI output is fixed generic status text plus name-only presence.

## Local Verification

The Infrastructure gate is Cloudflare- and Keychain-mock-only. Its macOS PTY check is local and synthetic:

```bash
npm run infrastructure:cloudflare-founder-attended:check
```

It verifies the fixed constants and endpoint, exact three-mode non-injectable production CLI, all-explicit test core, strict owner-only control, delayed-prompt expiry, live clock and repository revalidation, replay and concurrency denial, controlling-TTY boundary, macOS alias-versus-concrete terminal behavior, every terminal rejection before downstream activity, duplicate and redirect handling, single POST, compensating delete, manual-review states, invocation-owned pair rollback, cleanup scope, the native helper's pre-`SecItem` allowlist, source-level `/usr/bin/security` compatibility, secret-registry coverage, and leakage resistance. On macOS, the suite uses native `/usr/bin/expect` to allocate a real PTY with a 5-second child deadline and an independent 8-second parent deadline; it never waits indefinitely for terminal input.
