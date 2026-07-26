# Cloudflare Unattended Deployment Access v1

## Status

- Architecture batch: `BATCH-20260714-005`
- Runtime guard batch: `BATCH-20260714-006`
- Owner: Prometheus Infrastructure
- Setup: `NOT_CONFIGURED`
- Unattended deployment ready: `false`
- Unattended smoke ready: `false`
- Guard status: `IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED`
- Deployment authorized or performed: `false`

The runtime guard and local fixed-profile tooling are implemented in source but are not configured or deployed. This work does not create credentials, change Cloudflare, deploy a Worker, access Keychain values, contact production, or authorize production access.

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

Cloudflare Access authenticates the service principal; it does not make the resulting HTTP session read-only. The source-controlled private-Worker guard now:

- verifies the Access application JWT signature with Cloudflare's JWKS,
- requires exact issuer, application audience, expiry, `type: app`, empty `sub`, and `common_name` equal to the configured service-token Client ID,
- allows only `GET` and `HEAD`,
- allows only the explicit paths in the machine contract,
- denies every other method and path,
- requires the exact smoke request marker and returns a verified guard marker,
- runs behind a default-deny fixed-origin smoke client, and
- proves zero attempted writes.

Missing, malformed, stale, or OFF guard configuration denies service-principal smoke requests while preserving ordinary Founder and representative Access behavior. Source implementation is not deployment: no Access policy or production Worker change is authorized by this batch.

The private `wrangler.jsonc` sets `assets.run_worker_first` to `true`, so every private static and API request reaches the guard before `ASSETS` or API routing. The public Worker configuration is unchanged. A JWT that structurally claims service-token identity is forced into this restricted branch even without the marker and is denied when the marker is missing. The marker alone never authorizes a request.

The future runtime configuration names are:

- `PROMETHEUS_UNATTENDED_SMOKE_GUARD`
- `PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN`
- `PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE`
- `PROMETHEUS_UNATTENDED_SMOKE_SERVICE_TOKEN_CLIENT_ID`

None are added to `wrangler.jsonc` or production by this batch. The guard defaults OFF unless the first value is exactly `ON` and every other value validates.

The fixed smoke profile uses `/` as the sole HTML entry path. Cloudflare Workers
static assets canonically serve the root `index.html` at `/` and redirect the
noncanonical `/index.html` alias under the default HTML handling mode. The
client therefore omits `/index.html` and never follows that or any other
redirect. The guard retains its historical read-only alias so this private
smoke correction does not alter the shared public Worker bundle.

## Local Storage

Store each item in macOS Keychain using these source-controlled names only:

| Keychain service | Keychain account |
| --- | --- |
| `com.prometheus.cloudflare.unattended.deployment` | `CLOUDFLARE_API_TOKEN` |
| `com.prometheus.cloudflare.unattended.deployment` | `CLOUDFLARE_ACCOUNT_ID` |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_ID` |
| `com.prometheus.cloudflare.unattended.smoke` | `CLOUDFLARE_ACCESS_CLIENT_SECRET` |

The audited launcher checks item presence by name only. A future authorized launch retrieves values into process memory, suppresses child output, and injects only the deployment pair or smoke pair into its corresponding fixed child profile. Values never enter arguments, audit output, persistent shell environment, or the other credential profile.

Do not store values in Git, `.env`, `.dev.vars`, shell startup files, shell history, command-line arguments, logs, reports, screenshots, browser storage, or service-worker storage. The launcher contains a future Keychain read path, but no value is read unless a fixed launch profile has passed credential-name presence, repository, and one-shot Founder-control checks.

## Founder Deployment Control

The non-secret local control file is outside the repository:

`$HOME/.prometheus/overwatch/cloudflare-unattended-deployment-control-v1.json`

It must be owned by the local user, use mode `0600`, and default to `enabled: false`. A valid one-shot file must name the exact `prometheus-iq` target, private production environment, authorized commit, authorized tree, Founder directive, issue time, expiry, and one-shot authorization nonce.

The launcher requires a regular, single-link, non-symlink file owned by the current user with exact mode `0600`, an immediate parent directory owned by the current user with mode `0700`, strict bounded JSON with no duplicate keys, canonical timestamps, and the current repository commit and tree. The file's directive must exactly match the non-secret `PROMETHEUS_FOUNDER_DEPLOYMENT_DIRECTIVE_ID` supplied by the governed release invocation. Missing, unreadable, malformed, stale, reused, target-mismatched, directive-mismatched, broad, or OFF control means no launch. Presence and dry-run inspection do not consume the nonce. A real fixed child launch writes an exclusive `0600` consumed marker inside a `0700` sibling directory before any child starts. A crash or failed child leaves that marker intact, so the authorization is burned rather than replayed. Reuse fails closed.

The control file never authorizes deployment by itself. A Founder deployment directive naming exact commit, tree, environment, release scope, and rollback plan remains mandatory.

Automatic engineering push and production deployment remain separate decisions.

## Future Unattended Boundary

After credentials, Access policy, guard runtime configuration, and a deployment are separately authorized and verified, Codex may perform only:

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
7. Obtain separate Founder deployment authorization for the source guard and configure its four runtime names without placing values in source control.
8. After the guard is deployed and verified, run the name-only Keychain and process presence preflight. Presence output must contain names and `PRESENT`/`ABSENT` only.
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
npm run infrastructure:cloudflare-unattended-runtime-guard:check
```

The tracked-secret gate derives every regular file from the Git index and scans the corresponding bytes in the clean worktree without extension or size exemptions. It refuses to claim coverage when tracked worktree bytes differ from the index. A file is skipped only when its bytes contain NUL, which is the binary-content boundary. Findings contain only path, line, and finding type; matched values are never printed, logged, or returned.

Default credential absence is expected and does not fail this architecture batch. The future deployment preflight is intentionally stricter:

```bash
npm run infrastructure:cloudflare-unattended-access:preflight
```

The strict preflight checks names only and must fail until all future setup and authorization work is complete.

The smoke client itself defaults to an inert plan and performs no network access:

```bash
node scripts/run-cloudflare-unattended-smoke.mjs --dry-run
```

The launcher exposes only `presence`, `smoke-dry-run`, `smoke-read-only`, and `deployment-release`. The two launch profiles require a valid one-shot Founder control and fixed child commands. Wrangler is an exact direct dev dependency at `4.110.0` and must resolve to the npm-supplied `node_modules/wrangler/bin/wrangler.js`; arbitrary executables, arguments, shell execution, inherited `NODE_OPTIONS`, and unrelated credentials are unavailable. Do not run launch profiles until credentials, runtime configuration, deployment authorization, and Overwatch release approval are all complete.

## Official Cloudflare References

- [Wrangler system environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/)
- [Create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [Cloudflare Access policies and Service Auth](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Cloudflare Access application token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Validate Cloudflare Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Workers secret handling](https://developers.cloudflare.com/workers/configuration/secrets/)
