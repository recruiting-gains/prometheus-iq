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

Tracked reports are frozen before exact-version verification. Final hashes and post-push facts belong in the external Overwatch handoff so the repository does not create a self-referential report commit.

## Rollback

Every outgoing commit appears in a reverse-order rollback manifest with its owner, pre-release commit and tree, safe forward-revert procedure, and Data/contract considerations. Rollback uses new `git revert` commits. Reset, force-push, and remote-history rewriting are prohibited.

Runtime, Data, security, contract, migration, and cross-subsystem batches must exercise rollback in an isolated clone or worktree before push.

## Post-Push Verification

Overwatch verifies the remote HEAD and tree, zero divergence, clean worktree, absence of additional commits, absence of deployment or migration, absence of unauthorized external action, and the authorized recommendation-influence state.

Failure returns `POST_PUSH_VERIFICATION_FAILED`, suspends further automatic pushes, preserves history, and requires a governed repair or forward-revert batch.

## Final Statuses

- `AUTO_PUSH_COMPLETE`
- `BATCH_PASS_NO_PUSH_REQUIRED`
- `FOUNDER_REVIEW_REQUIRED`
- `PUSH_BLOCKED`
- `BATCH_FAILED`
- `POST_PUSH_VERIFICATION_FAILED`

## Installation Boundary

This installation changes governance and verification only. It creates no subsystem, deployment, production consumer, production-data mutation, recommendation influence, or prospective shadow evidence collection.
