# Cloudflare Founder-Attended Real macOS TTY Compatibility Repair Governance v1

## Batch

`BATCH-20260715-001`

## Ownership

Prometheus Infrastructure owns the TTY implementation, owner verifier, runbook, and owner tests. Prometheus Overwatch owns only this governance record, independent verification, canonical registration, report, and release wiring.

## Repair Boundary

Native macOS Terminal exposes stdin and stdout through a concrete terminal such as `/dev/ttys000`; `/dev/tty` is the controlling-terminal alias and may have a different `rdev`. The repaired guard still requires TTY flags, character-device stdin and stdout, and matching stdin/stdout `rdev` values. It opens `/dev/tty` safely and requires a character device, but does not compare the alias `rdev` with the concrete stream `rdev`.

The exact phrase is displayed and read only through `/dev/tty`. The 192-byte limit and exact match remain. Every rejected case stops before Keychain reads, control writes, repository or clock sampling, randomness, network calls, or downstream activity.

## Release Boundary

No Cloudflare access, real Keychain value access, credential creation or revocation, deployment, production mutation, collection activation, cohort activation, or recommendation influence is authorized. The existing temporary provisioning token is unchanged.
