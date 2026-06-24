# Pilot Support System

## Purpose

This support system keeps Anthony's live beta controlled, simple, and useful. The goal is to capture issues, protect the beta environment, and avoid unnecessary feature changes while the app is being tested.

## Beta Support Rule

During the beta, do not create new app features unless the pilot cannot continue without the change.

The founder's job is to observe, support, document, and protect the test.

## Bug Categories

### Critical

System crash, data loss, security issue, app cannot be opened, export/import broken, or GPS verification completely unusable.

Response target: same day if possible, within 24 hours.

### Major

Important workflow is broken, route does not load, logging cannot be completed, Anthony sees Cruz's profile/data, or owner/rep separation fails.

Response target: within 3 days, sooner if it affects the live pilot.

### Minor

UI confusion, wording issue, layout problem, non-blocking workflow friction, or recommendation explanation could be clearer.

Response target: document during beta and prioritize after daily review.

### Trivial

Cosmetic issues, typos, spacing, or small polish items.

Response target: save for post-beta unless quick and risk-free.

## Severity Scale

- 1: Severe. Pilot blocked or security/data risk.
- 2: High. Core workflow materially affected.
- 3: Medium. User can continue, but friction is meaningful.
- 4: Low. Annoying but not blocking.
- 5: Trivial. Cosmetic or wording only.

## Bug Report Template

Use this format for every issue:

```text
Date:
Reporter:
Device:
Browser:
App link used:
Issue category:
Severity 1-5:

What happened:
What should have happened:
Steps to repeat:
Screenshot attached:
Data at risk? Yes/No:
Blocks pilot? Yes/No:
Founder decision:
Status:
```

## Anthony End-Of-Day Feedback Template

```text
Date:
Did you use Prometheus today? Yes/No
How many locations did you visit?
How many were GPS verified?
How many conversations?
How many leads?
How many units?

Did the first route feel useful?
Were any locations bad or unrealistic?
Did anything confuse you?
Did the app feel fast enough?
Did logging feel easy?
What would make tomorrow easier?
Anything broken?
```

## Daily Beta Review Checklist

- Confirm Anthony could open the app.
- Confirm Anthony used the correct private rep link.
- Confirm Anthony did not see Cruz's profile selector or Cruz's route history.
- Confirm at least one visit can be logged.
- Confirm GPS verification works when Anthony intentionally submits a visit.
- Confirm export/backup still works.
- Review all feedback from Anthony.
- Separate bugs from feature requests.
- Decide whether any issue needs same-day action.
- Write one end-of-day pilot note.

## Founder Response Process

1. Acknowledge Anthony's feedback the same day.
2. Ask for a screenshot only if needed.
3. Classify the issue by category and severity.
4. Decide whether it blocks the beta.
5. Fix only critical or major beta blockers during the pilot.
6. Save non-critical feedback for post-beta review.
7. Keep a daily summary of what happened and what was learned.

## Same-Day Fix Rules

Same-day fixes are allowed only for:

- App cannot open.
- Anthony cannot log visits.
- Anthony cannot export data.
- Anthony sees Cruz's profile or data.
- GPS verification fails completely.
- A security/privacy issue appears.

Avoid same-day changes for:

- New feature ideas.
- Visual polish.
- Extra dashboards.
- New integrations.
- Google Places integration.
- Large recommendation rewrites.

## What To Capture Separately

Bug reports:

- Something is broken or incorrect.

UX feedback:

- Something is confusing, slow, or hard to use.

Feature requests:

- Something Anthony wishes existed but does not block the beta.

Pilot evidence:

- Visits, GPS verification, conversations, leads, units, follow-ups, and route usefulness.

## Do Not Do During Beta

- Do not create new app features unless the beta is blocked.
- Do not deploy directly to production without local verification.
- Do not modify Cloudflare or GitHub configuration unless it is required for safety or documentation.
- Do not expose proprietary route logic.
- Do not share Anthony's data outside the approved pilot context.

## End-Of-Day Founder Note

Use this short format:

```text
Date:
Anthony used app? Yes/No
Core workflow worked? Yes/No
Biggest beta issue:
Best evidence collected:
What Prometheus learned:
Tomorrow's one improvement:
Do we need a code change? Yes/No
```

## Recommendation

Use this support process for Anthony's 14-day beta. Keep the product stable, collect clean evidence, and only change the app when a real beta blocker appears.
