# Route IQ PWA Installation And Recovery v1

Document ID: `route-iq-pwa-installation-and-recovery-v1`
Owner: Prometheus Mobile
Status: production customer procedure
Application model: one generic Route IQ operational PWA

## Purpose

This guide installs and verifies the single generic PWA used for Route IQ field operations. It does not grant access, create a customer-specific application, authorize a user, or change production.

The generic manifest displays the installed name `Route IQ`. Do not create a customer-branded clone, customer-specific manifest, separate codebase, or alternate install URL.

## Preconditions

Do not install for a customer user until all are true:

- the customer company is explicitly approved for production activation;
- the named user is on the exact Founder- and customer-approved roster;
- Infrastructure verified the immutable authenticated principal;
- the user's company, operating profile, territory, and least-privileged role are approved;
- total scope remains at or below two companies and 40 named customer users;
- Anthony remains unmapped;
- collection is `OFF`, active cohorts are `0`, and recommendation influence is `OFF`;
- the canonical private Route IQ URL is supplied through the approved secure channel;
- the device is not shared between customer users.

An installation is not proof that access is authorized.

## Supported Operating Expectations

- One named user uses one authenticated device session at a time unless separately approved.
- The PWA requires a secure network connection for navigation and current authentication.
- Route IQ fails closed when secure navigation is unavailable. It is not represented as a full offline application.
- The service worker may cache a bounded application shell, but it must not replay application writes in the background.
- A session expiration requires fresh authentication.
- Customer users must not share one-time codes, browser profiles, PWA sessions, or devices.

## Install On iPhone Or iPad

1. Open the approved Route IQ URL in Safari, not an embedded browser.
2. Complete the approved authentication flow as the exact named user.
3. Confirm the page shows the expected customer workspace and least-privileged role.
4. Tap Safari's Share button.
5. Select `Add to Home Screen`.
6. Keep the governed application name shown by the current manifest. Do not add a customer-specific name that could be mistaken for a separate application.
7. Tap `Add`.
8. Close Safari.
9. Open the new Home Screen icon.
10. Confirm it opens in standalone mode and requests authentication when required.

If `Add to Home Screen` is unavailable, stop and record the iOS version, Safari version, device class, and exact safe error description. Do not install through an unapproved browser or profile.

## Install On Android

1. Open the approved Route IQ URL in current Chrome.
2. Complete the approved authentication flow as the exact named user.
3. Confirm the expected customer workspace and least-privileged role.
4. Open Chrome's menu.
5. Select `Install app` or `Add to Home screen`, whichever Chrome presents.
6. Accept the governed generic application name.
7. Complete installation.
8. Close Chrome.
9. Open Route IQ from the installed icon.
10. Confirm standalone presentation and fresh authentication behavior.

Do not sideload an application package or install a customer-specific copy.

## First-Open Verification

The installer and user verify together:

- [ ] Correct customer workspace is shown.
- [ ] Correct operating profile and territory are shown.
- [ ] Correct least-privileged role is shown.
- [ ] No other customer workspace or user data appears.
- [ ] No Founder CRM, Founder intelligence, owner, or administrative control appears to a representative.
- [ ] Route IQ is the active operational product.
- [ ] Route queue and permitted controls fit without horizontal panning.
- [ ] Directions opens the expected mapping application.
- [ ] Session expiration returns to authentication rather than exposing cached protected content.
- [ ] No shadow ranking, probability, readiness state, or recommendation is displayed.
- [ ] Collection remains `OFF`, cohorts remain `0`, and recommendation influence remains `OFF` in owner evidence.

Do not create a visit, result, field session, CRM request, or other production record merely to prove installation unless the Founder separately authorizes that exact write.

## Update Procedure

After an authorized release:

1. Record the expected app build and Worker identity from Infrastructure evidence.
2. Close every Route IQ browser and PWA window.
3. Reopen the installed PWA while online.
4. Complete fresh authentication if requested.
5. Confirm the expected version or current behavior.
6. Repeat close and reopen once if the previous service worker is still controlling the session.
7. If the expected build still does not appear, stop and open a High support issue.

Do not repeatedly refresh, clear storage, or reinstall in a loop. Do not instruct the user to bypass Access or use an alternate hostname.

## Session Expiration

Expected behavior:

- protected navigation requests fresh authentication;
- previously protected content is not newly served as an authenticated session;
- no write is replayed because the session expired;
- the user returns through the approved identity flow.

If protected content remains available after confirmed revocation or expiration, stop use and report a Critical incident.

## Offline And Network Loss

Route IQ is designed to fail closed for secure navigation when the network is unavailable. The expected result is a reconnect/sign-in message, not full field operation.

When connectivity drops:

1. Do not repeatedly press a state-changing control.
2. Do not assume a delayed or ambiguous write succeeded or failed.
3. Record the time, workflow, and safe error description.
4. Restore connectivity.
5. Contact support before resubmitting an ambiguous result.

No automatic retry, background replay, duplicate result, or late rehabilitation of an invalid prospective event is allowed.

## Safe Recovery

Use this order:

1. Confirm network access.
2. Close and reopen the PWA.
3. Authenticate through the approved route.
4. Confirm the correct customer workspace and role.
5. Check the support channel for a known incident.
6. Ask support to compare the expected service-worker and Worker identities.
7. Reinstall only when support authorizes it and confirms no unpreserved local work would be lost.

Before reinstalling:

- do not clear site data blindly;
- do not delete an app with an ambiguous unsynchronized action;
- preserve an approved export when available and safe;
- record the device and existing installed-app state;
- confirm the named user can complete fresh authentication.

## Remove From A Device

PWA removal and access removal are separate actions.

1. Obtain customer and Founder direction for the named user.
2. Infrastructure removes or pauses access through its governed procedure.
3. Verify a clean session is denied.
4. Confirm production evidence remains preserved.
5. Remove the Home Screen application from the device.
6. Administration records the device and access status.

Deleting the icon alone does not remove access, identity mapping, or production evidence.

## Support Boundary

Report PWA issues through `administration/workflows/route-iq-production-support-triage-v1.md`.

Prometheus Mobile owns device, browser, installed-app, offline, service-worker presentation, and reinstall behavior. Infrastructure owns Access, Worker delivery, production version, and deployment. Dashboard owns visible field workflow. No one may use PWA troubleshooting to bypass authentication, change a user's role, activate Anthony, or expand launch scope.
