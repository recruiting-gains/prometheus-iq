# Sales Documentation Architecture

Purpose: define where Sales documents belong and prevent duplicate sales systems.

## Source Of Truth

The `sales/` folder is the reusable Sales operating-system foundation.

Existing industry-specific or current-pilot assets remain in their current locations:

- `docs/`: working strategy, pilot, pricing, and operating documents.
- `SENDABLE LEADERSHIP PACKET/`: approved sendable initial pilot packet.
- `PROMETHEUS EXECUTIVE PACKAGE/`: executive package structure.
- `PROMETHEUS OPERATING SYSTEM/`: company operating index.

## Document Classes

### Internal Strategy

Purpose:

- Sales process.
- Positioning.
- Industry playbooks.
- Enterprise pilot sales package.
- Vertical-specific discovery and pilot targeting.
- Multi-industry enterprise sales playbook.
- Qualification.
- ROI.
- Pricing strategy.
- Objection handling.

Location:

- `sales/`
- Existing broad strategy in `docs/` may be referenced.

Sendability:

- Internal unless explicitly reviewed.

### Sendable Customer Material

Purpose:

- Executive brief.
- Pilot approval packet.
- Cover sheet.
- Controlled customer overview.

Location:

- `SENDABLE LEADERSHIP PACKET/`
- Future customer-specific sendable folders only after approval.

Sendability:

- Send-ready only after founder review.

### Executive Package Material

Purpose:

- Structured company or customer presentation assets.
- Pilot metrics.
- product overview.
- security/risk overview.

Location:

- `PROMETHEUS EXECUTIVE PACKAGE/`

Sendability:

- Review before external use.

### Customer-Specific Working Notes

Purpose:

- Discovery notes.
- Industry language map.
- pilot hypothesis.
- stakeholder map.
- objections.

Location:

- Future `sales/accounts/<account-name>/` only when account-specific systems are approved.

Sendability:

- Internal by default.

## Naming Rules

Use lowercase hyphenated filenames for Sales foundation files:

- `enterprise-sales-methodology.md`
- `multi-industry-enterprise-sales-playbook.md`
- `enterprise-industry-playbooks.md`
- `enterprise-pilot-sales-package.md`
- `roofing-discovery-and-pilot-targeting.md`
- `discovery-and-qualification.md`
- `demo-pilot-onboarding.md`

Use customer-specific names only in approved account folders:

- `account-brief.md`
- `discovery-notes.md`
- `pilot-plan.md`
- `executive-business-case.md`
- `renewal-plan.md`

## Required Sales Artifacts By Stage

Discovery:

- Discovery notes.
- Qualification score.
- Buyer map.
- Tool-stack notes.
- Pilot risk notes.

Demo:

- Value hypothesis.
- Industry playbook section.
- Demo flow.
- Customer language map.
- Pilot ask.

Pilot approval:

- Enterprise pilot sales package.
- Pilot scope.
- User list.
- Success metrics.
- Review cadence.
- Risk controls.

Pilot active:

- Adoption tracker.
- Weekly review notes.
- Issue log.
- Success metric tracker.

Pilot close:

- Final pilot report.
- ROI estimate.
- Paid deployment recommendation.
- No-go reason if applicable.

Customer onboarding:

- Onboarding plan.
- Training checklist.
- Support process.
- Manager review cadence.
- Executive reporting structure.

Renewal:

- Usage summary.
- Outcome summary.
- Risk review.
- Expansion recommendation.
- Renewal proposal.

## Duplicate Prevention Rules

- Do not copy `docs/prometheus-pilot-execution-playbook.md`; link to it.
- Do not copy `docs/prometheus-pricing-strategy-playbook.md`; link to it.
- Do not copy sendable packets into `sales/`; link to them.
- Do not create a second customer-success folder inside Sales.
- Do not create CRM, Dashboard, Companion, Infrastructure, Integration, or Intelligence Engine requirements as if Sales owns implementation.
- Do not create customer-specific files until there is a real account, pilot, or founder-approved target.

## Future Sales Account Folder Template

When approved, use:

```text
sales/accounts/<account-name>/
  account-brief.md
  discovery-notes.md
  qualification-score.md
  stakeholder-map.md
  value-hypothesis.md
  demo-plan.md
  pilot-plan.md
  pilot-review.md
  paid-deployment-plan.md
  renewal-plan.md
```

## Maintenance Rule

If a Sales process becomes repeatable across at least two accounts or industries, promote it into the Sales foundation. If it is account-specific, keep it in the account folder.
