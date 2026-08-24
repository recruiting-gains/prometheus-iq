# Prometheus Engineering Router

Read only `README.md`, `docs/TEST_RELEASE_MAP.md`, and files relevant to the assigned task. Exclude historical reports, retired governance, deployment mirrors, legal/IP records, large evidence pools, and dormant `mac-companion/` or `prometheus-os/` source unless the task specifically requires them.

## Change Routing

- **Control-plane only:** run the repository suites affected by the change and use Early GitHub Handoff as the minimum hosted lane.
- **Public runtime:** use the public qualifier; do not dispatch Early Handoff as a duplicate.
- **Private runtime:** use the private v2 qualifier; do not dispatch Early Handoff as a duplicate.
- **Shared runtime:** qualify public and private artifacts independently when both import closures change.
- **Deployment:** use only the protected application-specific lane and exact hosted-qualified artifact. Never rebuild at deployment.
- **Audit, planning, ordinary content, or attended Reddit review:** no automatic engineering handoff.

Every engineering completion requires exact commit/tree evidence, a clean synchronized branch, the mapped security checks, artifact identity when applicable, and preserved rollback evidence. Do not weaken tests, branch protection, environment protection, access control, secret handling, or production isolation. Do not create per-task workflows, one-off governance registries, compatibility wrappers, or append-only master-state documents when an active suite and Git evidence already cover the behavior.

## Early GitHub Handoff — Mandatory When Routed

When Early GitHub Handoff is the minimum correct lane:

- Minimize how long the Founder’s Mac must remain connected.
- Complete authorized changes and only the minimum safe local preflight.
- Commit and push the exact commit promptly.
- Dispatch the governed workflow through GitHub CLI or API, bound to the exact commit SHA, tree, and branch.
- Machine-verify GitHub acceptance and retrieve the matching run by workflow identity, commit SHA, branch, and dispatch timestamp.
- Reject ambiguous matches and report the run ID and URL immediately.
- Avoid long local suites that duplicate hosted qualification unless needed to prevent an unsafe or predictably failing dispatch.
- Never weaken security, qualification, deployment, rollback, evidence, or protected-state controls.

If dispatch is accepted and no local work remains:

```text
GITHUB HANDOFF CONFIRMED
FOUNDER MAY CLOSE LAPTOP
```

If GitHub accepted dispatch but registration is pending:

```text
GITHUB DISPATCH ACCEPTED — RUN REGISTRATION PENDING
FOUNDER MAY CLOSE LAPTOP
```

If dispatch is not conclusively verified or local work remains:

```text
LOCAL CONNECTION STILL REQUIRED
[exact blocker]
```

Never issue a laptop-closing status merely because a command was attempted.

## Social Boundaries

Meta AI owns ordinary Instagram, Facebook, and LinkedIn content creation and planning. Preserve the repository's technical Instagram runtime, callbacks, token-store boundaries, CRM attribution, and website attribution; do not create a replacement social operating system or Meta repository integration.

Reddit assistance is Founder-initiated, attended, read-only, limited to public discussions the Founder selects and opens, and limited to five concise advisory talking points per review batch. Review community rules and flag affiliation, claims, promotion, privacy, and sensitivity risks. Never automate searching, scrolling, scraping, scheduling, login, posting, commenting, voting, following, joining, messaging, credentials, links, claims, patent language, competitor comparisons, or performance statements. The Founder performs every account action and approves anything that may be posted.
