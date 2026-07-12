# Discovery Mode Intelligence v2

## Scope

Discovery Mode Intelligence v2 is an Intelligence-owned, advisory planning layer. It validates how a future Discovery Mode queue can broaden category learning without lowering existing route quality or changing production recommendations.

This phase does not modify Dashboard, Data, CRM, Companion, Website, Active Pool governance, Route IQ scoring weights, or the continuous route queue. No runtime consumer imports the v2 composer.

## Field Evidence Basis

The 2026-07-11 Founder stress test verified that Discovery Mode concentrated field activity in Automotive businesses while qualified Restaurants, Retail, Healthcare, Professional Services, and Commercial Services were passed. The canonical read-only learning snapshot independently confirms four verified visits, all in Auto, with one session and insufficient category confidence.

The Founder finding is a design requirement, not a learned recommendation signal. Stress-test observations are not promoted into archived evidence, and the v2 plan cannot change recommendations.

## Discovery Queue Architecture

The composer sits after existing candidate governance and eligibility:

```text
Active Pool + existing route eligibility + immutable quality score
                              |
                              v
Governed category taxonomy and category supply
                              |
                              v
Authorized read-only evidence maturity
                              |
                              v
Deterministic constrained composition
                              |
                              v
Advisory queue plan, explanations, and validation metrics
```

The composer is not a second runtime queue. A future activation must adapt its category-composition decision into `continuous-adaptive-route-replenishment.mjs` through a separate explicit handoff.

## Category Balancing Strategy

There is no fixed category rotation. At each bounded selection step, the composer:

1. Keeps only candidates that already passed workspace, operating-profile, route-eligibility, Active Pool, identity, and quality requirements.
2. Prioritizes enough distinct governed industry categories to reach the configured coverage target when qualified supply exists.
3. Selects from the category with the lowest current queue concentration.
4. Uses evidence maturity and verified territory gaps to break category-allocation ties.
5. Selects the highest existing-quality candidate in that category, then uses existing route order and stable identity as deterministic tie-breakers.
6. Enforces configured category share, count, and consecutive limits.
7. Reports any configured relaxation. Quality, workspace, eligibility, and duplicate protections are never relaxed.

This changes composition only in the advisory artifact. Existing candidate scores are copied unchanged and are never recalculated.

Related source labels share a broad concentration family. For example, Auto, Tire, Oil Change, and Car Wash count as Automotive; Barber, Salon, and Spa count as Salons and Personal Care. This prevents cosmetic diversity from hiding real industry concentration.

## Evidence Thresholds

Discovery v2 inherits the governed category thresholds from `read-only-field-session-learning-policy-v1.json`. It does not duplicate threshold values.

Category maturity is:

- `unobserved`: no authorized verified category visits.
- `emerging`: some verified evidence exists, but the inherited threshold is not fully met.
- `threshold_qualified`: all configured category evidence and confidence requirements are met.

One field session cannot create a preferred category. Missing evidence means an exploration gap, not negative performance. Evidence decay and recency policy remain owned by the read-only learning policy.

## Learning Impact

Balanced discovery is designed to improve future measurement of representative strengths and weaknesses, category and territory performance, time-of-day effectiveness, conversation and lead quality, membership conversion, and objection patterns.

The current artifact can measure prospective category coverage. It cannot claim territory variation because the July 11 canonical session has no territory identity, and it cannot claim membership performance because canonical memberships are unavailable. Those limits remain visible in the output.

## Explainability Model

Every planned category exposure answers:

- Why was this category included?
- What verified evidence exists?
- What is the current evidence confidence?
- What changed since the prior evidence state?
- What should the representative capture next?

Explanations disclose quality and learning rationale in natural language. They do not expose internal formulas or proprietary weights.

## Configuration Model

`config/discovery-mode-intelligence-v2.json` governs category aliases, queue size, category concentration, quality floors, evidence-policy inheritance, learning objectives, territory overrides, and explicit relaxation rules. New industries or territory policies are configuration additions; they do not require a fixed code rotation.

Unknown categories are excluded and reported. Unknown workspaces and operating-profile mismatches fail closed. If qualified supply cannot satisfy the target within configured guardrails, the advisory queue is shortened and reports the unmet target instead of inventing a recommendation.

## Activation Boundary

The v2 output is `advisory_only`. Production influence requires a future Intelligence runtime handoff, integration into the existing continuous queue, regression approval against the Golden Route Quality Gate, and explicit human authorization.
