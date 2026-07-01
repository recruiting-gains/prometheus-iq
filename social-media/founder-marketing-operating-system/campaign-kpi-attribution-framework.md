# Campaign, KPI, And Attribution Framework v1

Owner: Prometheus Social Media

## Campaign Types

Founder Build In Public:

- Goal: increase trust in Cruz and the company journey.
- Primary platforms: Instagram, LinkedIn, X.
- KPI focus: saves, comments, follows, profile visits.

Outside Sales Intelligence Education:

- Goal: teach the market why outside sales needs an intelligence layer.
- Primary platforms: LinkedIn, YouTube, X.
- KPI focus: shares, comments, watch time, inbound interest.

Beta Learning Without Exposure:

- Goal: explain learning from real field conditions without exposing Anthony beta details.
- Primary platforms: LinkedIn, Instagram, YouTube.
- KPI focus: qualitative replies, pilot interest, website visits.

Enterprise Trust:

- Goal: position Prometheus as serious enough for sales organizations.
- Primary platforms: LinkedIn, YouTube.
- KPI focus: decision-maker engagement, saves, qualified conversations.

## Campaign Planning Fields

Each campaign must define:

- Campaign ID.
- Campaign name.
- Owner.
- Audience.
- Platform mix.
- Content pillars.
- Start date.
- End date.
- Primary CTA.
- Attribution plan.
- KPI targets.
- Manual metric capture owner.

## KPI Framework

Awareness:

- Impressions.
- Reach.
- Video views.
- Follower growth.
- Profile visits.

Engagement:

- Likes.
- Comments.
- Saves.
- Shares.
- Replies.
- DMs, tracked manually only.

Intent:

- Website visits.
- CTA clicks.
- Pilot interest.
- Qualified conversations.
- Newsletter or beta interest, only if future Website/CRM systems create them.

Learning:

- Best hook.
- Best audience.
- Best platform.
- Best content pillar.
- Reusable objections.
- Content to retire.

## Website Attribution Planning

Website remains Website-owned. Social Media defines only the planned contract:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `landing_path`
- `referrer`
- `occurred_at`
- privacy-safe session identifier if approved by Infrastructure and Website

Do not modify Website in this task.

## CRM Attribution Planning

CRM remains CRM-owned. Social Media defines only the planned contract:

- `lead_id`
- `lead_source`
- `campaign_id`
- `campaign_platform`
- `first_touch_at`
- `last_touch_at`
- `qualified_status`
- `manual_notes`

Do not modify CRM in this task.

## Manual Metric Capture Rule

Until live provider integrations exist, metrics must be labeled:

- `manual`
- `mock_sample`
- `provider_api`

Do not mix manual metrics with live-provider metrics without a source label.
