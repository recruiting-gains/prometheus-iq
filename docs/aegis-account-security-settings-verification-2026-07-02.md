# Operation Aegis Account Security Settings Verification

Date: 2026-07-02
Subsystem: Prometheus Infrastructure
Task: Account Security Settings Guided Verification v1

## Scope

This report records account-level GitHub and Cloudflare security verification performed through authenticated dashboard access. No application logic, Companion files, credentials, tokens, OAuth secrets, or private keys were modified or recorded.

## GitHub Governance

Repository verified:

- `PrometheusRouteIQ/prometheus-iq`
- Visibility: private
- Direct collaborators: 0
- Owner access retained

Controls enabled through GitHub repository settings:

- Dependency graph
- Dependabot alerts
- Dependabot security updates
- Grouped security updates
- Dependabot malware alerts

Branch protection:

- Classic branch protection rule created for `main`.
- Required pull request before merging enabled.
- Required approving review count set to 1.
- Dismiss stale pull request approvals enabled.
- Require conversation resolution before merge enabled.
- Enforce branch protection for administrators enabled.
- Force-push allowance left disabled.
- Branch deletion allowance left disabled.
- Required status checks not enabled because stable required check names were not confirmed for the current private-beta release flow.
- Signed commits not enabled because the current release path has not been migrated to mandatory signing.

Plan limitation:

- GitHub displayed the `main` branch protection rule as not enforced on this private repository.
- Rulesets were unavailable for enforcement until the repository is moved to an eligible GitHub Team or Enterprise organization plan.
- Code scanning, secret scanning, and push protection were not exposed for this private repository in the current account surface. GitHub Security Overview reported Advanced Security as organization-plan limited.

## Cloudflare Access

Access application verified:

- Application: `Prometheus IQ Private Beta`
- Type: self-hosted
- Protected destination: `prometheus-iq.prometheusrouteiq.workers.dev`
- Application ID observed: `ff70fcc7-13a0-4582-9f33-a6d5186f6bc7`
- Policy: `Prometheus IQ Owner Access`
- Policy ID observed: `f75760de-4448-470f-8460-1281508d3bfa`
- Policy action: Allow
- Include selector: Emails
- Approved identities: founder-approved email identities only
- Identity provider: One-time PIN
- Accept all identity providers: Off
- Instant authentication: On
- Application session duration: 24 hours
- Policy session duration: same as application session timeout
- Cloudflare One Client authentication: Off
- Temporary authentication: Off
- Purpose justification: Off

Zero Trust account settings verified:

- App Launcher team domain present.
- Global session duration uses application session timeout.
- Client session duration displayed as 8 hours.
- Block traffic to all domains in this account: Off, preserved to avoid breaking the public website.
- MFA methods were visible and off for biometrics, security key, authenticator application, and PIV key.

Manual security decision:

- MFA was not enabled during this pass because no founder MFA enrollment/lockout acceptance workflow was completed in the verified dashboard flow. Enabling MFA should be done only after the founder confirms enrollment and recovery path.

## Cloudflare WAF And Rate Review

Cloudflare zone verified:

- Zone: `prometheusrouteiq.com`
- Zone ID observed through Cloudflare API: `ca07fdeb6c2b749a164eca2f8652a5ef`
- Plan: Free Website
- Managed rulesets visible through API:
  - Cloudflare Normalization Ruleset
  - Cloudflare Managed Free Ruleset
  - DDoS L7 ruleset

Custom WAF control enabled through the Cloudflare dashboard:

- Rule name: `Prometheus Aegis public API method guard`
- Phase: custom security rule / `http_request_firewall_custom`
- Action: Block
- Expression:

```text
(http.host in {"prometheusrouteiq.com" "www.prometheusrouteiq.com"} and starts_with(http.request.uri.path, "/api/") and not http.request.method in {"GET" "POST" "OPTIONS" "HEAD"})
```

Purpose:

- Blocks unsafe HTTP methods on public `/api/` routes at Cloudflare before Worker route logic.
- Preserves normal `GET`, `POST`, `OPTIONS`, and `HEAD` behavior for public website/API traffic.
- Complements the existing Worker-side Aegis method guards and KV-backed rate limiting.

Rate limiting status:

- Cloudflare rate-limiting rule creation was visible in the dashboard menu, but API entrypoint reads for `http_ratelimit` returned authorization errors from the available automation token.
- Volume-based route limiting remains enforced by existing Worker/KV Aegis controls through `AEGIS_RATE_LIMITS`.
- Account-level Cloudflare rate-volume rules should be revisited with a token or dashboard flow that has explicit Zone WAF/rate-limit write permission.

## Live Verification Evidence

Commands executed:

```bash
curl -sS -o /tmp/aegis_home.out -w 'home_http=%{http_code}\n' https://prometheusrouteiq.com/
curl -sS -I https://prometheusrouteiq.com/
curl -sS -o /tmp/aegis_private.out -w 'private_http=%{http_code}\n' https://prometheus-iq.prometheusrouteiq.workers.dev/
curl -sS -X DELETE -o /tmp/aegis_delete.out -D /tmp/aegis_delete.headers -w 'delete_api_http=%{http_code}\n' https://prometheusrouteiq.com/api/aegis-method-guard-probe
curl -sS -o /tmp/aegis_get_probe.out -D /tmp/aegis_get_probe.headers -w 'get_api_probe_http=%{http_code}\n' https://prometheusrouteiq.com/api/aegis-method-guard-probe
curl -sS -o /tmp/aegis_status.out -D /tmp/aegis_status.headers -w 'instagram_status_http=%{http_code}\n' https://prometheusrouteiq.com/api/oauth/meta/instagram/status
```

Results:

- `https://prometheusrouteiq.com/` returned HTTP `200`.
- Public website headers include CSP, Permissions Policy, Referrer Policy, X-Content-Type-Options, and X-Frame-Options.
- Unauthenticated `https://prometheus-iq.prometheusrouteiq.workers.dev/` returned Cloudflare Access HTTP `302`.
- `DELETE https://prometheusrouteiq.com/api/aegis-method-guard-probe` returned Cloudflare HTTP `403`.
- `GET https://prometheusrouteiq.com/api/aegis-method-guard-probe` reached the Worker and returned HTTP `404` with Aegis headers, proving the WAF rule did not block allowed methods.
- `GET https://prometheusrouteiq.com/api/oauth/meta/instagram/status` returned HTTP `200` with `X-Aegis-Route-Policy: public_status`, `X-Aegis-RateLimit-Store: kv`, `Cache-Control: no-store`, HSTS, strict CSP, and rate-limit headers.

## Remaining Blockers

- GitHub branch protection/ruleset enforcement requires eligible GitHub plan support for private repositories.
- GitHub secret scanning, push protection, and code scanning require GitHub Advanced Security or an eligible organization plan.
- Cloudflare Access MFA should be enabled after founder enrollment and recovery verification.
- Account-level Cloudflare rate-volume rules require confirmed Zone WAF/rate-limit write permission and a conservative rollout plan.
- Required GitHub status checks should be enabled after stable CI check names are confirmed.

## Checkpoint

Operation Aegis account-level verification is complete for the available authenticated dashboard/API surfaces. Security posture improved through GitHub dependency protections and a Cloudflare custom WAF method guard, while plan-limited and manual-enrollment controls are explicitly documented.
