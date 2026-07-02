# Customer Intelligence Graph

Status: architecture only.

The Customer Intelligence Graph prepares a per-customer graph of outside-sales intelligence. It does not change production scoring, production recommendations, Dashboard runtime behavior, Mobile behavior, Companion behavior, CRM runtime behavior, Research runtime behavior, Sales runtime behavior, or Infrastructure.

## Mission

Every company using Prometheus should gradually build its own intelligence graph. The graph records relationships among customer-owned sales entities while preserving human review, explainability, operating-profile context, and customer isolation.

## Node Types

- Business
- Visit
- Lead
- Outcome
- Rep
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
- CompanionCustomerGraphContract
- ResearchCustomerGraphContract
- SalesCustomerGraphContract

No consumer implementation is active. Each future subsystem must accept a separate handoff before consuming graph outputs.

## Safety

The graph is architecture-only. It must preserve:

- no production scoring
- no production recommendation changes
- no Dashboard changes
- no Mobile changes
- no Companion work
- no consumer implementation
- no confidence propagation activation
- no cross-customer graph bleed
