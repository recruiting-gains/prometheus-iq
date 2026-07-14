# Authenticated Production Verification Access

This is the standard Infrastructure/Auth method for verifying Cloudflare Access-protected Prometheus production deployments without weakening Access policy or committing session material.

## Unattended Status

The future unattended architecture is defined in `docs/cloudflare-unattended-deployment-access-v1.md` and is currently `NOT_CONFIGURED`.

Unattended verification must use a separate Cloudflare Access Service Token exposed to the smoke child process only as `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET`. It must never use a Founder browser cookie, password, MFA code, username, or Global API Key.

An Access Service Token authenticates a service principal but does not make HTTP read-only. Therefore unattended smoke remains blocked until a separately authorized server-side guard enforces `GET`/`HEAD` and an explicit read-only path allowlist, with a default-deny smoke client proving zero attempted writes. This batch does not change Access policy or runtime behavior.

## Scope

Supported deployments:

- `prometheus-iq`: private Dashboard, Mobile/PWA, and Intelligence runtime behind Cloudflare Access.
- `prometheusrouteiq-website`: public website and Worker routes where applicable. Public routes do not require Access cookies, but any private/protected website route must use the same authenticated method below.

Verification coverage is provided by `scripts/verify-production-release.mjs` and includes runtime headers, private route availability, build marker parity, service worker version, PWA manifest, Dashboard/Mobile startup, Intelligence/runtime route initialization, console/runtime/network health, CSP/security headers, cache behavior, and unintended Google API failure detection.

## Founder-Attended Method: Authenticated Local CDP Session

Use an isolated Chrome profile bound to localhost. Complete Cloudflare Access login in that browser, then let the verifier read only the required Cloudflare Access cookies and browser runtime state through CDP.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9225 \
  --user-data-dir="$HOME/.prometheus-auth-verify/chrome-profile" \
  --profile-directory=PrometheusVerify
```

In the opened browser:

1. Visit the protected production URL, such as `https://prometheus-iq.prometheusrouteiq.workers.dev/`.
2. Complete Cloudflare Access email/OTP with an approved identity.
3. Leave the authenticated browser open.

Run the release gate:

```bash
npm run verify:authenticated-production -- --expected-worker-version <WORKER_VERSION> --cdp http://127.0.0.1:9225
```

For an alternate protected Worker:

```bash
npm run verify:authenticated-production -- \
  --production-url https://prometheus-iq.prometheusrouteiq.workers.dev \
  --worker-name prometheus-iq \
  --expected-worker-version <WORKER_VERSION> \
  --cdp http://127.0.0.1:9225
```

Close the isolated Chrome window when verification is complete.

## Legacy Founder-Attended Fallback: Environment-Only Access Cookies

Use this only when CDP is unavailable and the Founder is attending the verification. This method is prohibited for unattended operation. Do not pass cookies as command-line arguments because they can land in shell history or process listings.

```bash
export PROMETHEUS_ACCESS_COOKIE='<private Cloudflare Access Cookie header>'
npm run verify:authenticated-production -- --expected-worker-version <WORKER_VERSION>
unset PROMETHEUS_ACCESS_COOKIE
```

Or split values:

```bash
export CF_AUTHORIZATION='<private CF_Authorization value>'
export CF_APPSESSION='<private CF_AppSession value>'
npm run verify:authenticated-production -- --expected-worker-version <WORKER_VERSION>
unset CF_AUTHORIZATION CF_APPSESSION
```

The authenticated wrapper rejects `--auth-cookie` intentionally. The underlying verifier still supports it for legacy use, but Overwatch release verification should use CDP or environment-only values.

## Security Rules

- Do not remove, bypass, or weaken Cloudflare Access.
- Never use Founder browser cookies for unattended verification.
- Keep deployment API-token and Access Service Token credentials separate.
- Do not commit cookies, OTPs, Access tokens, service tokens, screenshots containing credentials, or `.env` values.
- Do not paste cookie values into reports or chat.
- Use an approved Access identity or approved test identity with least privilege.
- Bind CDP to `127.0.0.1` only.
- Treat missing CDP/cookie input as a verification blocker. Do not claim authenticated production verification passed without a real authenticated render/runtime check.

## Expected Commands

Preflight without running production checks:

```bash
PROMETHEUS_PRODUCTION_CDP=http://127.0.0.1:9225 npm run verify:authenticated-production -- --dry-run
```

Full protected Dashboard release verification:

```bash
npm run verify:authenticated-production -- --expected-worker-version <WORKER_VERSION> --cdp http://127.0.0.1:9225
```

Local-only release gate when authenticated production access is not available:

```bash
npm run verify:production-release:local
```

The local-only gate is not a substitute for authenticated production verification.
