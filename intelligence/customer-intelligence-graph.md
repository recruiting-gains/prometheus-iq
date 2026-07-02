# Customer Intelligence Graph

Status: architecture and read-only activation foundation.

The Customer Intelligence Graph prepares a per-customer graph of outside-sales intelligence. Its activation foundation produces read-only, customer-scoped `CustomerGraphSnapshot` payloads. It does not change production scoring, production recommendations, Dashboard runtime behavior, Website behavior, Mobile behavior, Companion behavior, CRM runtime behavior, Research runtime behavior, Sales runtime behavior, Active Pool behavior, automatic learning, or Infrastructure.

## Mission

Every company using Prometheus should gradually build its own intelligence graph. The graph records relationships among customer-owned sales entities while preserving human review, explainability, operating-profile context, and customer isolation.

## Node Types

- Business
- Visit
- Lead
- Outcome
- Opportunity
- Rep
- Manager
- Territory
- Operating Profile
- Customer
- Learning Signal

## Relationship Types

- Visited
- Recommended
- Converted
- Follow-up
- Nearby
- Similar
- Repeated
- Successful
- Inactive

## Graph Objectives

The graph prepares for:

- opportunity relationships
- territory relationships
- customer relationships
- rep performance trends
- cross-industry learning
- confidence propagation

Confidence propagation is not active in this foundation. Relationships can carry reviewable confidence seeds only.

## CustomerGraphSnapshots

CustomerGraphSnapshots are:

- customer scoped
- read only
- versioned
- explainable
- queryable

Snapshot content includes:

- businesses
- visits
- outcomes
- leads
- opportunities
- rep activity
- manager activity
- territories
- opportunity relationships
- evidence history
- confidence
- operating profile
- learning provenance

Each snapshot carries `readOnly: true`, `snapshotVersion`, `generatedAt`, `queryIndex`, `provenance`, `explainability`, `confidence`, and no-production-change safety flags.

## Provenance

Every graph element must answer:

- Where did this come from?
- When was it learned?
- Who generated it?
- How confident are we?

Nodes and relationships carry source references, source evidence IDs where available, learned timestamp, generator, confidence metadata, and human override state. Human override is preserved and never bypassed by graph activation.

## Query Contracts

Prepared read-only query contracts:

- DashboardCustomerGraphQueryContract
- CRMCustomerGraphQueryContract
- MobileCustomerGraphQueryContract
- WebsiteCustomerGraphQueryContract
- CompanionCustomerGraphQueryContract
- ResearchCustomerGraphQueryContract
- SalesCustomerGraphQueryContract

Supported query types:

- snapshot summary
- by node type
- by relationship type
- by business
- by territory
- by rep
- by opportunity
- by evidence
- by confidence
- by operating profile

Queries are safe local contract operations only. No consumer implementation is active.

## Customer Isolation

Every node and relationship belongs to one `customerId`. Cross-customer graph bleed is prohibited. Cross-industry learning must be aggregated through approved future governance, never by mixing one customer's private graph into another customer's graph.

## Source Layers Reused

The graph references existing architecture outputs:

- Operating Profile Engine for profile context.
- Field Evidence Foundation for visit and outcome evidence.
- Recommendation Explainability Engine for human-readable reasoning.
- Field Learning Loop contracts for reviewable learning signals.
- Core `KnowledgeGraphFact` contract for durable fact boundaries.

## Future Consumer Contracts

Prepared contracts:

- DashboardCustomerGraphContract
- CRMCustomerGraphContract
- MobileCustomerGraphContract
- WebsiteCustomerGraphContract
- CompanionCustomerGraphContract
- ResearchCustomerGraphContract
- SalesCustomerGraphContract

No consumer implementation is active. Each future subsystem must accept a separate handoff before consuming graph outputs.

## Safety

The graph is architecture-only. It must preserve:

- no production scoring
- no production recommendation changes
- no Dashboard changes
- no Website changes
- no Mobile changes
- no Companion work
- no CRM runtime changes
- no Active Pool changes
- no automatic learning
- no automatic scoring
- no consumer implementation
- no confidence propagation activation
- no cross-customer graph bleed

## Future Capabilities

This foundation prepares future relationship intelligence, opportunity clustering, territory evolution, historical replay, recommendation explanations, and learning visualization. These capabilities are not active.
