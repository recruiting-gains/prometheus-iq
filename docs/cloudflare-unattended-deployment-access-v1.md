# Cloudflare Unattended Deployment Access v1

## Status

- Batch: `BATCH-20260714-005`
- Owner: Prometheus Infrastructure
- Setup: `NOT_CONFIGURED`
- Unattended deployment ready: `false`
- Unattended smoke ready: `false`
- Deployment authorized or performed: `false`

This document defines a future unattended path. It does not create credentials, change Cloudflare, deploy a Worker, or authorize production access.

## Credential Separation

Use two independent credentials with different purposes and rotation schedules:

1. A narrowly scoped Cloudflare API token for Wrangler deployment automation. Wrangler receives only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the deployment child process.
2. A Cloudflare Access Service Token for machine authentication to the existing private Prometheus Access application. The smoke process receives only `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET`.

Never use the Founder's Cloudflare username, password, browser session cookie, MFA code, or Global API Key. Never share one token across deployment and smoke verification.

## Deployment API Token

The Founder must create the API token while physically at the laptop and scope it to the exact Prometheus Cloudflare account. The only permissions are:

- `Account Settings Read`
- `Workers Scripts Edit`

Do not grant Access, KV data, R2, DNS, Workers Routes, API-token management, Secrets Store, user, global, or other account permissions. If a later authenticated dry run demonstrates that another permission is necessary, stop with `FOUNDER_REVIEW_REQUIRED`; do not broaden the token during automation.

Use a 30-day expiry by default and never exceed 90 days without a new Founder decision. Automatic renewal is prohibited.

## Access Service Token

The Founder must separately create one Access Service Token and attach that exact token to a `Service Auth` policy on the existing private Prometheus IQ Access application. Do not select "Any Access Service Token" and do not add a Bypass policy.

Cloudflare Access authenticates the service principal; it does not make the resulting HTTP session read-only. Unattended smoke verification remains blocked until a separately authorized private-Worker guard:

- verifies the intended service principal,
- allows only `GET` and `HEAD`,
- allows only the explicit paths in the machine contract,
- denies every other method and path,
- runs behind a default-deny smoke client, and
- proves zero attempted writes.

No Access policy or Worker guard changes are authorized by this batch.

## Local Storage

Store each item in macOS Keychain using these source-controlled names only:

| Keychain service | Keychain account |
| --- | --- |
| `com.prometheus.cloudflare.unattended.deployment` | `CLOUDFLARE_API_TOKEN` |
| `com.prometheus.cloudflare.unattended.deployment` | `CLOUDFLARE_ACCOUNT_ID` |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_ID` |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_SECRET` |

A future audited launcher must retrieve each value without displaying it and inject it only into the child process that needs it. It must not export values into the persistent shell environment.

Do not store values in Git, `.env`, `.dev.vars`, shell startup files, shell history, command-line arguments, logs, reports, screenshots, browser storage, or service-worker storage. This batch intentionally contains no secret-reading launcher.

## Founder Deployment Control

The non-secret local control file is outside the repository:

`$HOME/.prometheus/overwatch/cloudflare-unattended-deployment-control-v1.json`

It must be owned by the local user, use mode `0600`, and default to `enabled: false`. A valid one-shot file must name the exact `prometheus-iq` target, private production environment, authorized commit, authorized tree, Founder directive, issue time, expiry, and one-shot authorization nonce.

Missing, unreadable, malformed, stale, reused, target-mismatched, or OFF control means no deployment. The control file never authorizes deployment by itself. A Founder deployment directive naming exact commit, tree, environment, release scope, and rollback plan remains mandatory. The one-shot nonce must be atomically consumed before deployment begins.

Automatic engineering push and production deployment remain separate decisions.

## Future Unattended Boundary

After all currently blocked setup and runtime guards are separately authorized and verified, Codex may perform only:

- name-only credential presence checks,
- local validation and dry runs,
- an exact private `prometheus-iq` deployment under a matching Founder directive and one-shot control,
- allowlisted read-only `GET`/`HEAD` smoke requests,
- Worker version and deployment metadata reads, and
- pre/post deployment comparison.

Codex may not manage tokens, service tokens, Access policies, Worker secrets, public Worker deployment, permissions, routes, KV/R2 data, production customer data, migrations not named by the directive, cohorts, collection, recommendation influence, log tailing, arbitrary HTTP requests, public releases, or external messages.

## Manual Laptop Setup Checklist

These steps are deliberately not automated:

1. Confirm the repository gate reports `NOT_CONFIGURED` and both readiness flags are `false`.
2. In Cloudflare, create the exact-account deployment API token with only the two listed permissions and a 30-day expiry.
3. In Keychain Access, create the two deployment items using the exact service/account names above. Do not enter values in Terminal.
4. Create a separate Access Service Token with a 30-day expiry.
5. In Keychain Access, create the two smoke items using the exact service/account names above.
6. Add that exact service token to a `Service Auth` policy on the existing private application. Do not use Bypass or Any Access Service Token.
7. Obtain separate Founder authorization for the server-side read-only service-principal guard and default-deny smoke client.
8. After that guard is deployed and verified, run the name-only Keychain and process presence preflight. Presence output must contain names and `PRESENT`/`ABSENT` only.
9. Create the non-secret control directory and control file outside the repository, set mode `0600`, and leave it OFF until an exact Founder deployment directive is active.
10. Perform a separately authorized dry run. If any permission, target, or guard differs, stop instead of expanding access.

## Rotation and Revocation Checklist

1. Set the Founder control file to OFF and invalidate any unconsumed nonce.
2. Rotate the deployment API token and Access Service Token independently.
3. Revoke the old credential before its successor is used unattended.
4. Store the successor only in its matching Keychain item; never copy it into a file or command line.
5. Revalidate exact account, exact application, permissions, Service Auth selector, expiry, and name-only presence.
6. Confirm revoked credentials are never reused.
7. To stop all unattended activity immediately, turn the local control OFF and revoke both credentials. Revoking the API token prevents deployment; revoking the Access Service Token prevents smoke authentication.

## Local Verification

Architecture and source-secret checks require no Cloudflare access:

```bash
npm run infrastructure:cloudflare-unattended-access:check
```

Default credential absence is expected and does not fail this architecture batch. The future deployment preflight is intentionally stricter:

```bash
npm run infrastructure:cloudflare-unattended-access:preflight
```

The strict preflight checks names only and must fail until all future setup and authorization work is complete.

## Official Cloudflare References

- [Wrangler system environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/)
- [Create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [Cloudflare Access policies and Service Auth](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Workers secret handling](https://developers.cloudflare.com/workers/configuration/secrets/)
