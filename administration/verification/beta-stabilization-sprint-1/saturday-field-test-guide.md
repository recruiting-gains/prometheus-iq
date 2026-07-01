# Saturday Field Test Guide

Field test date: Saturday, July 4, 2026  
Tester: Anthony  
Purpose: verify Beta Stabilization Sprint 1 fixes in a real field session.  
Sign-off: not automatic; sign-off packet must be completed after the session.

## 1. Startup

- Open Prometheus IQ from Anthony's normal path.
- Record whether this is browser or installed PWA.
- Record approximate startup feel: fast / acceptable / slow / blocked.
- Confirm no unusual blank screen, stale cache, or reload loop appears.

## 2. Login

- Open the exact private beta link.
- Complete Cloudflare Access flow if prompted.
- Use only the newest One-Time PIN if a PIN is required.
- Record any login friction.

## 3. Rep Mode

- Confirm Anthony is in Rep mode.
- Confirm visible tabs are appropriate for Rep use.
- Confirm owner/admin controls are not visible.
- If any owner/admin surface appears, stop and record a Critical issue.

## 4. Build Route

- Build or open Today's Route.
- Confirm route cards render.
- Open at least one Directions link.
- Record any route card that looks generic, residential, unfindable, duplicated, or not walk-in friendly.

## 5. Nearby Opportunities

- Log a verified stop or controlled test visit.
- Confirm Nearby Opportunities appears after the logged stop.
- Confirm recommendations are nearby, business-like, and not the current/already-visited location.
- Record any empty state or poor recommendation with location context.

## 6. Places

- Open Places.
- Confirm initial loading is acceptable.
- Confirm the full list or usable subset appears without blocking field work.
- Search or scan enough to confirm the view is usable.

## 7. Unit Logging

- Open pin-drop / result logging.
- Confirm modal scrolls.
- Confirm submit action is reachable.
- Log a real field result or controlled test result.
- Confirm counts update as expected.

## 8. Route Quality

- Sample route cards.
- Confirm the known residential-house barber-shop cluster at `10820 Hughes Rd, Houston, TX 77089, USA` does not appear.
- Confirm recommended stops look like real walk-in businesses.
- Record any questionable recommendation as a route quality observation or Data issue.

## 9. Performance

Record field perception:

- Startup:
- Route ready:
- Places loading:
- Logging modal:
- Nearby Opportunities:

Classify performance as:

- Pass: field-usable.
- Conditional: usable but noticeable friction.
- Fail: blocks or materially slows field work.

## 10. End-Of-Day Summary

- Use Copy Today Summary.
- Export report if needed.
- Confirm summary contains date, tester, visits, conversations, leads, units, notes/outcomes, visited place names, and timestamps.
- Save any feedback, issue, or feature request into Administration intake after the session.

## Closeout

After the session:

1. Update `sign-off-packet.md`.
2. Update `issue-verification-matrix.md` and `.json`.
3. Update `administration/registers/stabilization-issues.json` tester verification fields.
4. Add any new issues or observations.
5. Decide whether Anthony is ready for wider beta recommendation or needs another controlled field test.
