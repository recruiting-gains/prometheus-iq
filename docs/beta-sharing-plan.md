# Prometheus Beta Sharing Plan

## Goal

After two weeks of using and refining Prometheus personally, the next step is to give it to one coworker as a private test. The goal is not to sell it yet. The goal is to prove that another outside salesperson can use it, enter their own results, and improve route decisions.

## Before Sharing

Prometheus should be stable enough that a coworker can use it without help every day.

Minimum checklist:

- Add Visit works.
- Add Place works.
- New Locations Today works.
- Route Builder updates from results.
- Stats update from visits.
- Backup export works.
- Import backup works.
- Reset App works.
- App language is simple and not too specific to only one person.
- The coworker can start with a clean copy, not your personal data.

## Friday Beta Release Checklist

Use this checklist before sending a live beta link to an approved tester.

- Confirm the live deployment matches the approved local dashboard source.
- Confirm the exact tester URL opens the current dashboard, not an old file preview or stale Cloudflare version.
- Confirm the tester opens in Rep mode only.
- Confirm Owner or admin controls are not visible to the tester.
- Confirm Google-qualified Route Intelligence appears on the live tester URL.
- Confirm direction links open from the route cards.
- Confirm Cloudflare Access still protects the app.
- Confirm the tester email is included in the existing Cloudflare Access policy.
- Confirm no `.env`, API keys, tokens, screenshots, or internal Founder Companion files are included in anything sent externally.

## Cloudflare Access Email Approval

For a private beta user, use the existing Cloudflare Access application and policy. Do not create a duplicate Access app for each tester.

Process:

1. Add the tester's email address to the approved beta policy.
2. Save the existing policy.
3. Open the exact protected beta URL.
4. Have the tester request an email One-Time PIN from Cloudflare Access.
5. The tester must use the newest PIN from the newest email in the same login session.
6. Verify the dashboard opens in Rep mode after the PIN is accepted.

One-Time PIN behavior:

- PINs are single-use.
- PINs can expire.
- Requesting multiple PINs can make older emails invalid.
- Using a PIN from a different browser tab, old challenge, or stale login page can trigger an "already used" or invalid-code experience.

If a tester sees "This one-time PIN has already been used":

1. Close old Cloudflare login tabs.
2. Reopen the exact protected beta link.
3. Request a fresh PIN.
4. Use the newest email only.
5. Do not request another PIN unless the first fresh attempt fails.
6. If it still fails, review Cloudflare Access logs for the tester email and confirm the policy still includes the tester.

## Google Maps / Places Verification

Google Maps and Places must be verified on the exact live user URL, not only on the local file.

Before beta:

- Confirm the approved local dashboard contains Google-qualified businesses.
- Confirm `deploy/cloudflare-pages/index.html` matches the approved dashboard source.
- Confirm Cloudflare serves that same deployed source.
- Confirm the tester route uses qualified storefronts instead of stale manual seed locations.
- Confirm blocked or poor targets are not primary route recommendations.

## 2026-06-26 Anthony Beta Stabilization Note

Verified live beta URL:

`https://prometheus-iq.prometheusrouteiq.workers.dev/?role=rep&rep=Anthony&verify=20260626-beta`

Live deployment verification:

- The approved local dashboard source was synced to `deploy/cloudflare-pages/index.html`.
- The Cloudflare deployment package was updated from the approved source.
- The existing Prometheus IQ Worker was manually redeployed through Cloudflare.
- Verified live deployment ID: `ea14d08a`.
- The live Anthony URL opened in Rep mode.
- Owner/admin controls were not visible.
- The live route used Google-qualified Anthony recommendations, starting with Adolfo's Barber Shop, Universal Barbering Of Houston, Estetica Unisex Zaleta, Glam Beauty Studio, ClearWater Express Wash, and Kruzzers Auto Care LLC.
- Route cards included directions links and walk-in/ask-for guidance.

Cloudflare Access verification:

- The existing `Prometheus IQ Private Beta` Access app was reused.
- Email One-Time PIN was the selected login method for the app.
- `Anthony.garza719@gmail.com` was included in the existing allow policy.
- The old Cloudflare identity provider exists globally but was not selected for this app.

Remaining login truth:

Anthony's fresh PIN flow must still be validated on Anthony's own device and email session. If he sees an "already used" PIN message, use the recovery steps above before changing Access configuration.

## Companion Founder Acceptance Note

Prometheus Companion is a founder-only operating system and should not be sent to beta testers.

Before Founder Acceptance:

- Confirm the installed Companion runtime is synced with the repository version.
- Confirm the local backend is running.
- Confirm the Prometheus OS server is running.
- Confirm voice, routing, and premium TTS are working before Cruz tests.

## Codex / Browser Recovery Note

If Codex, ChatGPT, Cloudflare, or Google requires authentication, Cruz should complete sign-in, two-factor authentication, payment, or approval manually. API keys, tokens, passwords, billing details, and private credentials should never be pasted into chat or committed to GitHub.

## Anthony Feedback Questions

Ask Anthony these after his first beta use:

- Were you able to log in without help?
- Did the route open in Rep mode only?
- Did the route recommendations look like real places you could walk into?
- Did any recommendation feel like a poor sales target?
- Did directions open correctly?
- Did Prometheus help you decide where to go first?
- What was confusing on the first screen?
- What would make you trust the route more?
- What did you actually visit?
- What happened at each visit: conversation, lead, follow-up, sale, or no opportunity?

## Best First Sharing Method

For the first coworker test, keep it simple:

1. Make a clean copy of the app folder.
2. Rename it for the coworker or test version, such as `Prometheus-Beta`.
3. Clear any personal test data in the browser before handing it over.
4. Send the coworker the app folder or host it on a simple private web link.
5. Have the coworker use it daily for 1-2 weeks.
6. Ask them to export a backup file at the end of each week.
7. Compare their results to yours.

## Clean Beta Copy

The coworker needs their own data, not yours.

Options:

- Use **Reset App** before they start.
- Give them a fresh browser/device.
- Change the internal storage key for their copy if needed.
- Have them export their own backup file every few days.

## What To Measure

Do not only ask if they "like" the app. Measure whether it helps.

Track:

- Places visited per day.
- Conversations per day.
- Leads per day.
- Units per day.
- Units per visit.
- Best location categories.
- Best time windows.
- Places that wasted time.
- Whether planned routes reduced random driving.
- Whether they found better places faster than usual.
- Whether the app made them more consistent.

## Coworker Test Questions

Ask these after 1 week:

- Was it easy to log visits while working outside?
- Did the route list help you decide where to go?
- Did New Locations Today give you useful ideas?
- What did you ignore or not use?
- What felt slow or annoying?
- What should be one tap instead of several taps?
- Did it help you waste less gas or less time?
- Did it help you find better-producing locations?

## Success Proof

The strongest demo is not a screenshot. It is before-and-after field production.

Example proof:

- Before Prometheus: random outside stops, no clear location history.
- After Prometheus: planned route, 18 places tested, 6 green/yellow locations found, best category identified, units per visit improved.

Useful demo story:

> Two salespeople used Prometheus for two weeks. The app showed which location categories produced units, which areas wasted time, and which daily routes were worth repeating. Both reps stopped guessing where to go and started using production history to plan outside sales.

## When To Move Beyond One Coworker

Only expand after the first coworker can use it without you standing next to them.

Next beta stages:

- Stage 1: You only.
- Stage 2: One coworker.
- Stage 3: Three salespeople at the same gym.
- Stage 4: Another Fitness Connection location.
- Stage 5: A different kind of outside sales business.

## What To Build Before Charging

Before selling Prometheus as a subscription, it needs:

- Separate accounts or separate workspaces per salesperson.
- Manager view.
- Easy setup for different businesses.
- Exportable weekly reports.
- Cloud data storage.
- Login.
- Clean onboarding.
- Mobile install instructions.
- A demo dataset.
- A pricing page.

## Short-Term Recommendation

In two weeks, do not jump straight to selling.

The next step should be:

Give one coworker a clean beta version, have them use it for 7-14 days, collect their exported results, and compare whether Prometheus helped them plan better routes, save gas, and find better-producing locations faster.
