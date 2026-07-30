# GitHub-Hosted Autonomous Engineering Workflow v1

Owner: Prometheus Infrastructure

Status: implemented for independent Overwatch review; not dispatched and not
deployed by this engineering change.

## Purpose

The workflow at
`.github/workflows/github-hosted-autonomous-engineering-v1.yml` composes the
accepted private Worker v2 qualification, artifact, deployment, rollback, and
browser-acceptance components into one manual GitHub-hosted release path. Once
the Founder starts one exact run, no local repository, terminal, browser
session, Wi-Fi connection, retained file, or laptop process participates.

The existing private v2 workflows and implementation remain unchanged. The new
orchestrator admits only one exact `main` candidate, projects its already
validated inputs into the accepted v2 component contracts, and rejects any
other context.

## Governed sequence

1. A no-secret job validates the Founder, repository, branch, commit, tree,
   baseline ancestry, ownership, repair limits, and exact confirmation.
2. A clean GitHub-hosted runner runs the complete no-secret repository suite.
   `npm test` owns the single application build; no second build command is
   permitted. The independent Overwatch verifier and tests then run directly
   as nontransient commands, without relying on package-script wiring.
3. The accepted private v2 qualifier freezes the forward payload and paired
   forward-compatible rollback into one immutable artifact.
4. A fresh job downloads the artifact, checks GitHub metadata, and reverifies
   every content identity.
5. The rollback payload receives a credential-free Wrangler dry run. The
   accepted deployment lifecycle is then exercised in memory with one fixed
   nonsecret postdeployment failure, one forward attempt, one rollback, and no
   production request.
6. Another fresh runner redownloads the release and rollback evidence, repeats
   artifact verification and the credential-free rollback dry run, and emits
   independent recovery evidence.
7. Only after every preceding no-secret gate passes may a protected read-only
   job receive production credentials and verify the exact public and private
   Worker identities.
8. The protected deployment job then redownloads the exact artifact and
   invoke the accepted private v2 deployment component. That component already
   enforces private-only targeting, one forward attempt, authenticated GET/HEAD
   smoke, desktop and exact 390x844 acceptance, identity-before-script
   execution, public Worker isolation, and one forward-compatible rollback on
   critical failure.
9. A final fresh protected job independently downloads the deployment outcome,
   rollback demonstration, recovery verification, and production evidence. It
   validates every exact schema, artifact identity, upstream hash, phase,
   attempt count, and safety field before independently confirming production.

Every uploaded evidence record contains only fixed classifications, source and
artifact hashes, Worker version identifiers, counts, and boolean safety
results. Credentials, Access claims, headers, cookies, response bodies, and
customer records are prohibited.

Artifact verification accepts only an artifact whose metadata names this
dispatch's exact run and candidate. The outer context independently pins the
repository, `main` branch, Founder actor and triggering actor, this workflow
file, and run attempt one. An artifact from another run cannot be selected even
when its content hashes happen to match.

Runner-temporary artifact paths are bound only inside executable step
environments, where GitHub exposes the `runner` context. A release-blocking
source verifier rejects any `runner` expression in a job-level environment so
GitHub cannot reject the workflow before its first fail-closed identity gate.

The GitHub artifact token is step-scoped. It is injected only into the five
Node steps that call artifact metadata verification: initial independent
verification, rollback demonstration, recovery verification, and the private
deployment job's pre- and postdeployment artifact checks. Dependency
installation, the full suite, the deployment child process, production
evidence finalization, and uploads do not inherit it. The deployment wrapper
also rejects an accidentally inherited artifact token before its child can run.

## Bounded repair

This workflow is not a self-modifying agent. It cannot commit, push, dispatch
itself, call another workflow, or edit source. More than one in-run transient
recovery is prohibited; exactly one fresh-runner recovery is available.
Owner-produced source history may declare Infrastructure repair attempt `0`
through `5`, and remains limited to
nine commits, sixteen changed files, 6,000 changed lines, 524,288 patch bytes,
and 524,288 resulting file bytes across the exact Infrastructure and Overwatch
feature paths recorded in the contract. Binary diffs, symlinks, renames,
deletions, non-regular Git modes, and mode changes are rejected. Workflow
recursion is zero. Every source repair requires the complete clean
qualification and a newly generated immutable artifact.

Every successor commit must contain paths from exactly one approved subsystem.
There must be at least one Overwatch commit and the final successor commit must
be Overwatch-owned. The declared repair attempt is exactly the number of
Infrastructure commits minus one. This allows existing Infrastructure and
Overwatch commits to remain in their recorded order while bounding the final
nine-commit chain. Author and committer strings are provenance labels, not
authorization by themselves; authorization is the exact commit, exact tree,
Founder actor and triggering actor, exact `main` branch, and exact workflow
context.

GitHub propagates a skipped dependency through every downstream `needs` chain.
The optional fresh-runner recovery is expected to be skipped after a successful
primary qualification, so each later job uses `always()` only to evaluate its
explicit direct-dependency success predicates. A skipped optional recovery can
therefore continue to the selected artifact, while any required failed,
cancelled, or skipped job still fails closed.

Hosted run `30576383131` established this behavior without crossing a production
boundary: the primary clean qualification passed, artifact `8773054778` was
uploaded, and the selector passed, but GitHub skipped the five remaining jobs
because the optional recovery was skipped. No production job started and no
production secret or Worker was accessed. That qualification-only artifact is
audit evidence, not a deployable successor for a later commit.

One in-run recovery is available without another Founder interaction. It is a
fresh GitHub-hosted runner executing the entire install, audit, repository
suite, and qualification sequence. It is eligible only when the first runner
classifies dependency installation or production-dependency-audit transport as
transient. Those network-dependent operations run before `npm test`, so no
application build or artifact exists before recovery. A source failure, test
failure, artifact upload or identity failure, deployment failure, acceptance
failure, or unclassified error cannot use this path. A second transient failure
stops the workflow.

The maximum theoretical job execution time, including the one recovery path, is
210 minutes. The workflow verifier sums every job timeout and requires that
exact cap.

An out-of-scope path, mixed owner commit, merge commit, isolated retry, stale
baseline, production identity drift, or uncertain artifact fails closed.

The accepted legacy
`.github/workflows/deploy-prometheus-private-worker.yml` remains byte-unchanged.
It is a separate manual Founder lane with no `workflow_call`,
`repository_dispatch`, push, or schedule trigger and an exact workflow identity
guard of its own. This orchestrator has no source-write or self-dispatch route,
does not invoke that lane, and cannot reuse its authorization. Disabling the
legacy lane here would alter accepted predecessor behavior and Overwatch
evidence outside this feature without making this lane safer.

## Production boundary

The protected environment remains
`prometheus-private-worker-production`. The first production-secret access is
the read-only identity job after qualification, artifact verification, rollback
demonstration, and recovery verification have all passed. Secret values are
then supplied only to that identity job, the exact deployment step,
finalization, and final production acceptance. Qualification and all
preproduction proof jobs receive no production credential. Every workflow job
uses read-only GitHub permissions; artifact transfer relies on the scoped
runtime artifact token.

The deployment target is fixed to `prometheus-iq`. The public
`prometheusrouteiq-website` Worker is read only and must retain its exact
preflight identity. Existing bindings, secrets, Durable Objects, migrations,
routes, domains, Access controls, and protected operating switches continue to
be governed by the accepted private v2 lane.

## Rollback

The predeployment rollback demonstration is deliberately production-free. It
proves that the qualified rollback payload can pass Wrangler dry-run and that
the accepted lifecycle performs exactly one rollback after a controlled
critical failure. A second clean runner repeats the verification.

If a real deployment or production acceptance fails, only the qualified
forward-compatible rollback embedded in the release artifact is permitted.
Native provider rollback and automatic deployment retry remain prohibited.

## Founder dispatch inputs

The Founder supplies:

- exact candidate commit and tree from `main`
- batch ID
- exact current public and private Worker versions
- repair attempt number from 0 through 5
- `I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT`

No artifact hash is copied by the Founder. The single workflow creates,
transfers, and reverifies those identities internally.
