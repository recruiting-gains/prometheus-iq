# Beta Acceptance Criteria

Scope: Anthony second field test for Beta Stabilization Sprint 1 readiness.

## Required Pass Criteria

Anthony can continue beta if all are true:

- App startup is usable in the field.
- Login/access completes without blocking the session.
- Anthony remains in Rep mode only.
- Owner/admin controls are not visible.
- Route building works.
- Directions open for sampled route cards.
- Pin-drop / unit logging is reachable and usable.
- Nearby Opportunities appears after a verified/logged stop.
- Places loading does not block field use.
- Active Pool corrections are visible through route quality: known residential-house barber-shop cluster does not appear.
- End-of-day summary can be copied or exported.
- No Critical or High unresolved blocker remains at session close.

## Fail Criteria

Do not sign off if any are true:

- Anthony cannot open the app.
- Anthony cannot pass access/login.
- Anthony sees owner/admin controls.
- Route cards fail to render.
- Pin-drop/unit logging cannot be submitted.
- Nearby Opportunities cannot be verified after a valid logged stop.
- Places loading makes the app unusable in normal field conditions.
- A known residential-house barber-shop correction appears again.
- Copy/export cannot preserve the day's beta data.
- A security, privacy, or data exposure issue appears.

## Conditional Pass

Conditional pass is allowed only when:

- Core field workflows pass.
- Remaining issues are Low severity.
- Any Medium issue has a clear workaround.
- Founder review accepts the risk in `sign-off-packet.md`.

## Wider Beta Gate

Wider beta should not start until:

- Anthony second field test passes or receives explicit founder conditional pass.
- Device verification is complete.
- Tester sign-off is recorded.
- All Critical and High Sprint 1 issues have tester verification.
- Any new field-test issue is entered into `administration/registers/stabilization-issues.json`.
