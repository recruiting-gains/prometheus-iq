# Verified Engineering Batch Automatic Commit + Push Governance v1

Status: Active after verified installation on `origin/main`

Owner: Prometheus Overwatch

Installation batch: `BATCH-20260713-003`

Permanence: Permanent until the Founder revokes or supersedes it.

## Purpose

This policy removes routine per-batch Founder push approval after a Founder-authorized Engineering Directive. It preserves subsystem ownership, independent Overwatch verification, exact-version release control, rollback capability, and Founder authority over deployment and material decisions.

The canonical machine-readable policy is `overwatch/governance/verified-engineering-batch-auto-push-v1.json`.

## Authority

- A directive is authorized only when the Founder directly submits, approves, or orders it.
- A Chief Architect draft or recommendation is not implementation authorization.
- Subsystem owners may create meaningful local commits for their owned work inside the authorized directive.
- Subsystems never push and never deploy.
- Overwatch may commit only Overwatch-owned governance, verification, reporting, and release-gate assets.
- Only Overwatch may push an eligible batch to `origin/main`.
- Production deployment always requires separate Founder approval naming the exact commit, tree, environment, scope, and rollback plan.

## Automatic Push Gate

Overwatch may push without another Founder prompt only when every requirement below passes:

1. Work remains inside the Founder-authorized directive.
2. Every outgoing commit is mapped to its correct owner.
3. The range contains no blocked, failed, unrelated, unapproved, or unexplained commit.
4. Ownership and provenance are verified.
5. Directive acceptance criteria pass.
6. Applicable security, secret, Aegis, contract, isolation, lint, typecheck, build, diff, index, Git, ownership, and release gates pass.
7. Every tracked implementation, governance, verification, artifact, release-wiring, and report change is committed before final verification.
8. The final HEAD and tree are frozen.
9. The complete applicable suite passes against that exact candidate.
10. HEAD and tree remain unchanged across verification.
11. The working tree has no staged, unstaged, untracked, or conflicted path.
12. Every outgoing commit has a documented safe forward-revert path.
13. The push cannot trigger deployment, migration, publication, external messaging, production-data mutation, recommendation activation, or another unauthorized external action.
14. Recommendation influence remains in its authorized state.

`INSUFFICIENT_EVIDENCE` may coexist with engineering auto-push eligibility when it is the expected product-readiness result. It is never recommendation readiness.

## Founder Review Gate

Overwatch returns `FOUNDER_REVIEW_REQUIRED` instead of pushing when a batch introduces a material decision not clearly authorized by the directive. This includes deployment, recommendation influence, representative-facing shadow recommendations, automated business actions, new or materially changed representative/customer behavior, mandatory workflow changes, new PII, material privacy or permission changes, new subsystems or major architecture, new production event architecture, new vendors or recurring costs, destructive migrations, historical archive rewrites, material security-boundary changes, public publication, material legal or IP commitments, incomplete gates, or out-of-scope work.

Overwatch must not infer authorization from a broad or unrelated directive.

## Exact-Version Procedure

Before push, Overwatch records the candidate HEAD, candidate tree, expected `origin/main`, and exact outgoing range. It then runs the complete applicable suite against that candidate, confirms the repository did not change, fetches the remote immediately before push, verifies the expected base and normal fast-forward relationship, and verifies that no Git or Cloudflare integration can deploy from the push.

If the remote moved, the tree changed, or another commit appeared, Overwatch returns `PUSH_BLOCKED`. It does not merge, rebase, overwrite, or force-push.

## Autonomous Predeployment Closure

For public deployment preparation and equivalent release-readiness work, Overwatch continues autonomously through ordinary test, CI, integrity, portability, provenance, ownership, workflow, build, and verification failures. It diagnoses the failure, dispatches the repair to the correct subsystem owner, requires focused regression coverage, verifies the integrated result, creates correctly attributed commits, performs a normal fast-forward push when eligible, and reruns safe no-secret CI until one immutable candidate is stable.

Overwatch does not return an intermediate `HOLD` for a fixable engineering failure and does not request deployment authorization while the candidate is still changing. A source, contract, manifest, artifact, or rollback-identity change invalidates the frozen candidate and requires a new qualification. A temporary runner or external infrastructure failure before the production mutation boundary does not invalidate an otherwise unchanged candidate.

Overwatch returns to the Founder only when one of these conditions is true:

- One immutable candidate passed every required gate and needs exact deployment authorization.
- Founder authentication, credentials, MFA, or a physical identity action is unavoidable.
- A material product, security, privacy, CRM schema, data-handling, or deployment-scope decision is required.
- A destructive or irreversible action is required.
- A genuine blocker remains after all safe in-scope remedies are exhausted.

This standing closure authority never authorizes deployment, production mutation, secret-value access during a no-secret batch, or reuse of authorization for a materially changed candidate.

Tracked reports are frozen before exact-version verification. Final hashes and post-push facts belong in the external Overwatch handoff so the repository does not create a self-referential report commit.

## Rollback

Every outgoing commit appears in a reverse-order rollback manifest with its owner, pre-release commit and tree, safe forward-revert procedure, and Data/contract considerations. Rollback uses new `git revert` commits. Reset, force-push, and remote-history rewriting are prohibited.

Runtime, Data, security, contract, migration, and cross-subsystem batches must exercise rollback in an isolated clone or worktree before push.

When a deployed release has applied a stateful migration, a native provider rollback to code that predates that migration is not an acceptable rollback plan. The rollback manifest must instead identify and verify a new forward-compatible deployment candidate that preserves applied migration history, required class exports, bindings, protected secret references, and existing state while making the affected behavior inert. Stateful namespaces and classes cannot be deleted as a rollback shortcut. Deploying the forward candidate still requires separate Founder approval.

## Production Smoke Safety

Authenticated production browser verification is read-only by construction. It uses a new browser context, configures and confirms the exact required viewport before production navigation, and installs a default-deny write guard before that navigation. A viewport mismatch stops the test before interaction.

The guard blocks application write requests, service workers, form submissions, downloads, popups, and dialogs. Production layout verification never activates finalization or any other state-changing control. Every smoke test records production application-data counts before and after the browser run. Any attempted write, dialog, record-count drift, or other application-data change invalidates the smoke verification.

## Post-Push Verification

Overwatch verifies the remote HEAD and tree, zero divergence, clean worktree, absence of additional commits, absence of deployment or migration, absence of unauthorized external action, and the authorized recommendation-influence state.

Failure returns `POST_PUSH_VERIFICATION_FAILED`, suspends further automatic pushes, preserves history, and requires a governed repair or forward-revert batch.

## Early GitHub Handoff

After the minimum safe local preflight passes, Overwatch commits and normally
pushes the exact candidate promptly, then uses the governed Early GitHub
Handoff command to dispatch hosted qualification. The command binds the run to
the exact commit and branch, verifies GitHub accepted the dispatch, and locates
one unambiguous run by workflow identity, commit, branch, and dispatch time.

Overwatch reports that the Founder may close the laptop only after machine-
verified dispatch acceptance and proof that no local work remains. Long local
suites that duplicate hosted qualification are avoided unless they are needed
to prevent an unsafe or predictably failing dispatch. This timing policy never
weakens security, qualification, deployment, rollback, evidence, or protected-
state controls.

## Final Statuses

- `AUTO_PUSH_COMPLETE`
- `BATCH_PASS_NO_PUSH_REQUIRED`
- `FOUNDER_REVIEW_REQUIRED`
- `PUSH_BLOCKED`
- `BATCH_FAILED`
- `POST_PUSH_VERIFICATION_FAILED`

## Installation Boundary

This installation changes governance and verification only. It creates no subsystem, deployment, production consumer, production-data mutation, recommendation influence, or prospective shadow evidence collection.
