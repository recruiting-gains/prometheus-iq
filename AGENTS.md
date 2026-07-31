## Early GitHub Handoff — Mandatory

Every future Prometheus Overwatch engineering project must:

- Minimize how long the Founder’s Mac must remain connected.
- Complete authorized engineering changes and only the minimum safe local preflight checks.
- Commit and push the exact commit promptly.
- Dispatch the governed GitHub-hosted workflow through GitHub CLI or API.
- Bind qualification to the exact commit SHA and branch.
- Verify that GitHub accepted the dispatch.
- Retrieve the matching run using workflow identity, commit SHA, branch and dispatch timestamp.
- Reject ambiguous run matches.
- Report the run ID and URL as soon as registration occurs.
- Avoid long local test suites that duplicate hosted qualification unless required to prevent an unsafe or predictably failing dispatch.
- Never weaken security, qualification, deployment, rollback, evidence or protected-state controls.

Required status messages:

If dispatch is accepted and no local work remains:

```text
GITHUB HANDOFF CONFIRMED
FOUNDER MAY CLOSE LAPTOP
```

If GitHub accepted the dispatch but run registration is still pending:

```text
GITHUB DISPATCH ACCEPTED — RUN REGISTRATION PENDING
FOUNDER MAY CLOSE LAPTOP
```

If the dispatch is not conclusively verified or local work remains:

```text
LOCAL CONNECTION STILL REQUIRED
[exact blocker]
```

Never tell the Founder that the laptop may close merely because a workflow command was attempted. GitHub acceptance must be machine-verified and no remaining work may depend on the local Mac.
