# Field Evidence Activation Foundation

Status: architecture only.

This foundation connects Operating Profiles to future field evidence without activating production learning, production scoring, Dashboard runtime behavior, CRM runtime behavior, Companion behavior, Website behavior, Mobile beta behavior, Active Pool behavior, or Infrastructure.

## Operating Profile Engine

The Operating Profile Engine lets Prometheus adapt to outside-sales industries through configuration. The Intelligence Engine stays the same. Only profile vocabulary, labels, KPI language, CRM stage language, Companion wording, and reporting language change.

Initial profiles:

- General Outside Sales
- Fitness
- Roofing
- Security
- Medical
- Insurance
- Solar
- Home Services

Future profiles are added by extending `intelligence/profiles/operating-profiles.json` and validating the same contracts. They do not require rebuilding Route Intelligence, changing recommendation scoring, or creating a separate learning engine.

## Field Evidence Admission

Every future completed visit may become field evidence after admission checks. Examples include:

- Visited
- Decision maker reached
- Conversation
- Sale
- Lead
- Inspection
- Estimate
- Referral
- Contract
- No decision maker
- Closed business
- Duplicate
- Wrong business
- Competitor
- Follow-up

Evidence admission remains reviewable and inactive for production recommendations until a future activation handoff is approved.

## Normalized Outcome Model

All industry-specific outcomes become the same deterministic chain:

Visit -> Outcome -> Evidence -> Learning Signal -> Confidence -> Recommendation

The engine does not care whether an operating profile calls the success event a membership, lead, policy, contract, inspection, referral, appointment, booked job, or site survey. Each outcome maps into normalized evidence before any future learning signal can exist.

## Learning Safety

This foundation prepares:

- evidence admission
- confidence generation
- explanation seed generation
- human override state
- regression gates

It does not activate automatic recommendation changes. Every generated normalized outcome carries `productionLearningActive: false`, `scoringChanged: false`, and `productionRecommendationChanged: false`.

## Explainability

Profile-specific outcomes must still answer the same explanation questions:

- Why?
- What evidence?
- How confident?
- What changed?
- What should happen next?

The Recommendation Explainability Engine remains the explanation layer. Operating Profiles provide vocabulary and context, not scoring formulas or proprietary weights.

## Subsystem Contracts

Contracts are prepared for:

- Dashboard
- CRM
- Companion
- Mobile
- Website
- Research
- Sales
- Social Media

These contracts let future subsystem owners adopt the selected operating profile after explicit handoff. No subsystem is authorized to consume them as production behavior from this foundation.

## Regression Gate

The profile registry and engine must pass `scripts/verify-operating-profile-engine.mjs` and `tests/operating-profile-engine.test.mjs`. The gate verifies profile completeness, normalized outcome mapping, consumer contracts, profile-agnostic explainability, human review state, and no-production-change flags.
