# Prometheus IQ Cloud Beta And Business-Reply Plan

Prepared June 18, 2026. Anthony returns Tuesday, June 23, 2026.

## Recommended Two-Track Plan

### Track A: Anthony Phone Test By Tuesday

Goal: let Anthony use the existing simplified workflow on his phone without waiting for the commercial backend.

Deliverables:

- Host Prometheus IQ at a private HTTPS web address.
- Install it on Anthony's phone as a progressive web app.
- Give Anthony a clean, separate dataset.
- Keep Quick Result, Today, Route, and the daily goal workflow.
- Require an end-of-day export while data remains device-based.
- Run a short onboarding and one test entry before field use.

Estimated work: 4-8 focused hours.

Estimated cash cost: $0 for free hosting, plus approximately $10-$25 per year if a custom domain is purchased. No App Store fee is required for a progressive web app.

Limitations:

- No secure account login.
- No automatic owner dashboard.
- No live synchronization between Cruz and Anthony.
- Device loss or browser-data deletion could remove unsaved results, so daily exports are required.

### Track B: Secure Multi-User Private Beta

Goal: replace device-only storage with secure owner and representative accounts and shared cloud data.

Recommended initial stack:

- Existing Prometheus IQ web interface.
- Supabase Auth and Postgres for accounts and structured field data.
- Organization, membership, profile, place, visit, and settings records.
- Row Level Security so representatives see permitted data and owners see their team.
- Cloudflare Pages or equivalent static hosting.
- Existing JSON export retained as a secondary backup.
- Optional transactional email through Resend.

Required work:

1. Design the organization, user, place, visit, and settings schema.
2. Create Cruz's owner account and Anthony's representative account.
3. Add authentication and session handling.
4. Replace local-only saving with cloud reads and writes.
5. Add owner-versus-representative access rules at the database level.
6. Migrate Cruz's current data without duplicating visits.
7. Handle loading, network failure, sign-out, and failed-save states.
8. Deploy over HTTPS and install on both phones.
9. Test cross-account isolation and owner visibility.
10. Test backup, restore, phone installation, and the complete field workflow.

Estimated work for a minimum secure beta: 28-50 focused hours, normally 5-10 working days. A more dependable pilot release should receive 2-3 weeks including real-phone testing and fixes.

## Current Platform Costs

For two users, infrastructure can begin inexpensively:

- Static hosting: $0 on an appropriate free tier.
- Supabase Free: $0, but free projects may pause after inactivity and downloadable automatic backups are not included.
- Supabase Pro: from $25 per month; includes daily backups retained for seven days and avoids free-project pausing.
- Transactional email: $0 initially on Resend's free tier, currently up to 3,000 emails per month and 100 per day.
- Custom domain: planning estimate of $10-$25 per year, depending on registrar and domain.
- Recommended dependable two-user beta operating cost: approximately $25-$45 per month plus the annual domain.

Development-cost scenarios:

- Cruz plus Codex: primarily Cruz's time and the platform costs above.
- Independent contractor planning range: roughly $2,500-$7,500 for a minimum cloud beta, depending on rate, testing, and scope.
- Polished multi-business beta with onboarding, monitoring, administration, and deeper security review: potentially $8,000-$20,000 or more. Obtain written quotes before fundraising against these figures.

## If One Of The Five Businesses Replies

Do not promise an immediate customized product. Respond within one business day and request a 30-45 minute discovery conversation.

### Discovery Questions

- What does the field representative sell or accomplish?
- How many representatives and managers would participate?
- What does a successful field day look like?
- What terms replace visits, leads, and units in this business?
- How are territories and prospects selected today?
- Which tools or CRMs are already used?
- What information must the representative enter after a stop?
- Which baseline numbers already exist?
- What are the largest wastes of time, fuel, or opportunity?
- What must the manager see?
- What data is confidential or regulated?
- Who approves a pilot and controls the budget?

### Response Timetable

- Day 0-1: acknowledge interest and schedule discovery.
- Day 1-3: conduct discovery and document terminology, workflow, users, metrics, and constraints.
- Day 3-5: send a one-page pilot outline with scope, responsibilities, success measures, and timeline.
- Day 5-10: configure a same-workflow pilot after written approval.
- Weeks 2-4: allow extra time when the business needs new workflow logic, integrations, or security requirements.

Adaptation ranges after the shared cloud foundation exists:

- Mostly terminology, goals, and categories: 1-3 days.
- New workflow and manager reporting: 3-7 days.
- External CRM integrations, unusual permissions, or regulated data: 2-6 weeks or longer.

## Multi-User Pilot Readiness

Do not onboard several external testers until Prometheus IQ has:

- Real authentication.
- Database-enforced organization and role permissions.
- Separate tenant data.
- Automatic cloud persistence.
- Backup and recovery procedures.
- Error logging and basic monitoring.
- A privacy notice and tester agreement reviewed by qualified counsel.
- A defined pilot start, end, baseline, success metric, and support contact.

Initial proof target:

- Cruz plus Anthony first.
- Then 3-5 total testers.
- Then one controlled external-business pilot.
- Measure visits, conversations, leads, outcomes, units per visit, units per hour, and units per mile where practical.

## Decision

Use Track A to begin Anthony's field test on Tuesday without pretending it is secure cloud software. Build Track B immediately afterward as the foundation for shared owner visibility and external business pilots.

## Anthony Test And August 1 Target

Anthony pilot start: Tuesday, June 23, 2026.

Define the test as 14 calendar days with a target of at least 10 active field-sales days. The pilot closes July 6, 2026, unless missed workdays require a short documented extension.

During the pilot:

- Receive a separate end-of-day backup after Anthony's final entry.
- Preserve every original backup without importing it into Cruz's live app.
- Track visits, conversations, leads, units, units per visit, first recommended stop, route adherence, workflow issues, and backup receipt.
- Record starting and ending daily mileage if Prometheus IQ will later make a gas-savings claim.
- Conduct a day-seven usability review, but change the workflow only for a genuine blocker or data-loss risk.
- Continue business discovery conversations while the pilot runs; do not wait until day 14 to learn what interested businesses need.

After the pilot:

- July 7-10: validate backups, remove duplicate records, calculate results, and create a one-page case study with limitations.
- July 7-15: finish the secure cloud beta foundation needed for external organizations and multiple users.
- July 10-20: conduct discovery calls, define terminology and success metrics, and send written pilot outlines.
- July 20-August 1: target onboarding two controlled external-business pilots.

For the August 1 goal, a company counts as "working with Prometheus" only when all of these are true:

- A named decision-maker has approved the pilot in writing.
- The pilot has defined start and end dates.
- At least one representative is identified for onboarding.
- Baseline metrics and success measures are documented.
- Data handling and responsibilities are agreed.
- The company has begun onboarding or active testing.

An interested reply, social-media comment, discovery call, or verbal statement does not count as an active pilot.

## Pilot Pricing Rule

### Anthony

- Free.
- Anthony is a product-validation tester, not a paying customer.
- The purpose is to verify usability, data quality, repeatability, and independent rep adoption.

### First External Design Partner

If the secure cloud beta is not ready, offer a tightly limited free design-partner test only when the business signs a written pilot outline and agrees to:

- A defined 14-day test.
- One to three named representatives.
- Baseline and success measurements.
- Scheduled feedback.
- Clear data-handling boundaries.
- A decision meeting at the end.

Do not collect sensitive customer information, promise a sales increase, or perform substantial custom development for free.

### Paid Founding Pilot

Once secure accounts, cloud synchronization, organization separation, backups, and protected permissions are working, the initial pricing hypothesis is:

- $250 flat for 30 days.
- Up to three representatives.
- Onboarding and founder support included.
- No setup fee for the first founding pilots.
- Credit the $250 toward the first subscription invoice if the company converts.

Custom integrations or significant workflow changes require separate written scope and pricing.

This is a hypothesis to test, not permanent pricing. Before charging, use a written pilot agreement and obtain qualified legal and tax guidance for contracts, business structure, payments, and applicable taxes.

## External Validation Funnel

Use this sequence after Anthony's test:

1. Conduct discovery with the business owner or authorized decision-maker.
2. Document the business objective, terminology, baseline, rep workflow, and success measures.
3. Obtain written company approval for one named representative to run a free 14-day design-partner trial.
4. Onboard the representative only after secure organization separation and cloud backups are working.
5. Collect the complete trial record without changing success criteria after seeing the results.
6. Present all findings, including limitations, weak results, and workflow failures.
7. If the agreed success threshold is met and the business wants to continue, offer the 30-day paid founding pilot.

Suggested 14-day success measures:

- At least 10 active field days, when the representative's schedule permits.
- At least 90% of completed field stops logged.
- Median Quick Result completion time under 30 seconds.
- No lost or cross-company data.
- A documented comparison of visits, conversations, leads, outcomes, units per visit, units per hour, and units per mile where the business can provide those measures.
- A final representative usability interview and decision-maker review.

### Protection Package

An NDA alone is not the complete protection package. Before external testing, use attorney-reviewed documents and controls covering:

- Confidentiality obligations.
- Prometheus ownership of pre-existing software, scoring logic, documentation, and improvements.
- The customer's ownership of its underlying business and customer data.
- Permission for Prometheus to process pilot data only for agreed purposes.
- Organization-level access controls and separate tenant data.
- Backup, retention, deletion, and incident procedures.
- No reverse engineering or unauthorized sharing.
- No guarantee of increased sales.
- Pilot termination and end-of-test data handling.
- Separate written permission for any named testimonial or case study.

Backups protect data availability; they do not protect intellectual property by themselves. Trade-secret protection also depends on limiting disclosure and using reasonable secrecy controls. Do not expose the private scoring method during demos or onboarding.
