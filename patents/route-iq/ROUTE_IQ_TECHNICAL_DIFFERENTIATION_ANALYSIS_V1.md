# Route IQ Technical Differentiation Analysis v1

Created: 2026-07-09

Subsystem: Prometheus Patents / Route IQ

Invention: IP-001 - Route IQ Adaptive Representative Intelligence System

Status: Engineering comparison for Overwatch and attorney review

Boundary: This document is not a legal opinion, not a patentability determination, not an infringement analysis, and not a legal comparison document. Scores are engineering comparison estimates only.

## 1. Purpose

This document compares Route IQ against each reference identified in `ROUTE_IQ_PATENT_LANDSCAPE_ANALYSIS_V1.md`.

The objective is to document technical overlap, technical differentiation, engineering risks, and attorney-review areas before future non-provisional planning.

## 2. Source Inputs

- `TECHNICAL_DISCLOSURE_V1.md`
- `ROUTE_IQ_SYSTEM_SPECIFICATION_V1.md`
- `ROUTE_IQ_TECHNICAL_COMPARISON_ANALYSIS_V1.md`
- `ROUTE_IQ_PATENT_LANDSCAPE_ANALYSIS_V1.md`

## 3. Route IQ Baseline

Route IQ is documented as a computer-implemented adaptive representative intelligence system.

Core loop:

Representative -> Evidence Collection -> Learning Engine -> Representative Profile -> Territory Intelligence -> Customer Intelligence -> Outcome Intelligence -> Probability Engine -> Recommendation Engine -> Representative

Primary technical differentiators used in this analysis:

- Representative-specific learning.
- Evidence collection and normalization.
- Separate representative, territory, customer, and outcome intelligence layers.
- Outcome-aware probability scoring.
- Recommendation generation for a specific representative in a specific field context.
- Continuous adaptation from representative feedback and outcomes.
- Routing and CRM as inputs/interfaces rather than the core technical function.

## 4. Scoring Method

Similarity score: 0 means little technical overlap; 100 means strong technical overlap with Route IQ's disclosed architecture.

Differentiation score: 0 means limited technical separation; 100 means strong technical separation from the reference.

Scores are relative engineering estimates based on public materials reviewed. They are not legal conclusions.

## 5. High-Relevance Patent References

### H-001 - US8032402B2 / US20080281858A1 - Itinerary search tool for territory management

Similarity score: 72

Differentiation score: 68

Technical overlap summary: The reference overlaps with Route IQ in field representative itinerary planning, territory management, customer selection, geography, scheduling, and representative visit planning.

Technical differentiation summary: Route IQ is differentiated by treating the representative as a learned intelligence object and by using evidence, representative learning, territory learning, customer learning, outcome learning, probability scoring, and adaptive recommendation generation. The reference appears more itinerary/calendar/customer-selection oriented.

Representative Intelligence Loop comparison: The reference supports representative itinerary construction. Route IQ loops representative actions and outcomes back into future representative-specific recommendations.

Learning architecture comparison: The reference appears to use territory/customer/calendar information for itinerary construction. Route IQ updates separate intelligence stores and uses the updated stores in future scoring.

Recommendation engine comparison: The reference appears to recommend or construct itinerary/customer visits. Route IQ recommends actions from scored representative-territory-customer-outcome intelligence.

Probability engine comparison: Public information does not show a Route IQ-style probability engine using representative, territory, customer, and outcome intelligence together.

Data flow comparison: The reference appears to flow from customer/geography/calendar data to itinerary generation. Route IQ flows from evidence capture through learning stores into probability and recommendation outputs, then back into evidence.

Computer implementation comparison: Both are computer-implemented representative-support systems. Route IQ's implementation is broader around evidence processing, intelligence stores, feedback, and adaptive decision logic.

Apparent technical novelty observations: Route IQ's strongest technical distinction is the continuous representative intelligence loop and outcome-aware learning architecture rather than itinerary search alone.

Apparent engineering risks: Attorney should review whether itinerary/customer-selection features, geographic indicators, and calendar population could be argued as overlapping with any Route IQ route or session workflow.

Areas requiring attorney attention: Field itinerary generation, customer candidate selection, calendar integration, representative route/session planning, and any future Route IQ claims involving itinerary construction.

### H-002 - US20130054294A1 / WO2013033587A2 - Sales productivity system

Similarity score: 70

Differentiation score: 70

Technical overlap summary: The reference overlaps in distributed sales force support, mobile client use, server/data store, sales zones, customer association, calendar/sales-cycle planning, and representative activity scheduling.

Technical differentiation summary: Route IQ is differentiated by continuous evidence intake, representative-specific learning, outcome learning, and probability-driven recommendation generation. The reference appears organized around territory zones, calendar days, sales cycles, and activities.

Representative Intelligence Loop comparison: The reference supports sales force productivity across zones and calendar cycles. Route IQ updates a dynamic representative profile from observed behavior and outcomes.

Learning architecture comparison: The reference appears to structure sales territory and activity data. Route IQ uses a learning engine to update representative, territory, customer, and outcome intelligence after evidence capture.

Recommendation engine comparison: The reference may support activity planning or scheduling. Route IQ produces adaptive recommendations after scoring candidate actions using updated intelligence.

Probability engine comparison: Route IQ expressly includes probability scoring and confidence-style outputs. The public reference summary does not show the same probability engine tied to representative-specific outcome learning.

Data flow comparison: The reference appears to connect mobile client data, zones, customers, activities, and server storage. Route IQ adds normalized evidence, feedback capture, intelligence-layer updates, and recurring probability recalculation.

Computer implementation comparison: Both include mobile/client-server implementations. Route IQ's disclosed implementation includes modular evidence processing, data persistence, learning engine, probability engine, and recommendation engine services.

Apparent technical novelty observations: Route IQ's distinctive engineering point is adaptive representative intelligence rather than sales-cycle zone planning.

Apparent engineering risks: Zone/customer/calendar planning is close enough to Route IQ territory-session workflows that any future non-provisional drafting should separate adaptive intelligence from static sales-cycle planning.

Areas requiring attorney attention: Mobile sales force embodiments, territory zones, calendar cycles, customer association, and activity scheduling language.

### H-003 - US20130024273A1 - Sales & marketing recommendation system

Similarity score: 66

Differentiation score: 63

Technical overlap summary: The reference overlaps in sales recommendations, recommendation engine behavior, customer targeting, data-driven suggestions, and improvement from user overrides.

Technical differentiation summary: Route IQ is differentiated by field-representative context, territory intelligence, visit/action outcomes, representative profile learning, and field evidence. The reference appears campaign/message/customer-targeting oriented.

Representative Intelligence Loop comparison: The reference uses user overrides as feedback. Route IQ expands feedback into representative behavior, territory state, customer state, outcome learning, and future probability recommendations.

Learning architecture comparison: The reference appears to use analytical modeling and closed-loop marketing data. Route IQ uses evidence normalization and separate intelligence stores for field execution.

Recommendation engine comparison: Both include recommendation engines. Route IQ's recommendation engine ranks candidate field actions with representative-specific context and operational constraints.

Probability engine comparison: The reference may include analytical models, but public material does not show Route IQ's disclosed probability engine using four intelligence layers for field recommendations.

Data flow comparison: The reference appears to flow sales/marketing data into recommendations and override feedback. Route IQ flows field activity evidence through learning and outcome comparison before future recommendations.

Computer implementation comparison: Both are software recommendation systems. Route IQ's system is operationalized around representative sessions, field evidence, and customer/territory/outcome stores.

Apparent technical novelty observations: The main Route IQ distinction is combining sales recommendation behavior with field-specific representative learning and territory/customer/outcome feedback.

Apparent engineering risks: User feedback improving recommendations is a close technical theme. Future drafting should emphasize Route IQ's field evidence, representative model, outcome model, and territory learning rather than generic recommendation improvement.

Areas requiring attorney attention: Recommendation engine scope, user override feedback, customer targeting, analytical modeling, and closed-loop recommendation language.

### H-004 - US20200226506A1 - Methods and systems for automated salesbeat optimization

Similarity score: 74

Differentiation score: 66

Technical overlap summary: The reference overlaps in field sales personnel, who-to-visit and when-to-visit planning, customer/outlet data, sales executive assignment, day-level route plans, and route optimization.

Technical differentiation summary: Route IQ is differentiated by not being limited to salesbeat or route optimization and by learning the representative from evidence, recommendation response, and outcomes.

Representative Intelligence Loop comparison: The reference plans salesbeats. Route IQ continuously updates the representative profile and recommendation logic after field actions and outcomes.

Learning architecture comparison: The reference appears to optimize periodic journeys from outlet/customer-level data. Route IQ updates representative, territory, customer, and outcome intelligence stores from observed evidence.

Recommendation engine comparison: The reference produces optimized journey or route plans. Route IQ produces recommendations based on field intelligence and can use routing as only one interface.

Probability engine comparison: The reference includes optimization logic. Route IQ includes probability scoring for candidate representative actions from current intelligence layers.

Data flow comparison: The reference appears to flow outlet/customer data into salesbeat and route optimization. Route IQ flows evidence and outcomes into intelligence updates and future recommendations.

Computer implementation comparison: Both can be implemented as server-side planning systems for field sales. Route IQ's implementation adds persistent representative profiles, outcome intelligence, feedback capture, and adaptive probability scoring.

Apparent technical novelty observations: Route IQ's strongest distinction is adaptive representative intelligence rather than optimized salesbeat generation.

Apparent engineering risks: This is one of the closest route-planning references. Future drafting should avoid characterizing Route IQ as only route optimization and should anchor on representative learning and outcome feedback.

Areas requiring attorney attention: Who-to-visit planning, route-plan generation, customer-level data, sales executive identity, and day-level sales planning.

### H-005 - US8175802B2 - Adaptive route guidance based on preferences

Similarity score: 48

Differentiation score: 82

Technical overlap summary: The reference overlaps in adaptive route guidance, user preferences, and user-specific behavior in navigation.

Technical differentiation summary: Route IQ is differentiated by field-sales representative intelligence, sales/customer outcomes, territory/customer/outcome learning, and business-action recommendations rather than navigational path guidance.

Representative Intelligence Loop comparison: The reference adapts navigation to preferences. Route IQ learns representative performance and sales outcomes.

Learning architecture comparison: The reference appears preference/navigation oriented. Route IQ maintains business intelligence stores and feedback-weighted outcome learning.

Recommendation engine comparison: The reference recommends route guidance. Route IQ recommends representative field actions, visit objectives, follow-ups, and customer priorities.

Probability engine comparison: The reference does not appear to score business action probability from representative/territory/customer/outcome layers.

Data flow comparison: The reference appears to use navigation preference data to guide route choices. Route IQ uses field evidence, customer state, territory state, representative state, and outcomes.

Computer implementation comparison: Both are computer-implemented adaptive systems. Route IQ is business-process and intelligence-store oriented rather than map-route guidance oriented.

Apparent technical novelty observations: Route IQ's route-independent intelligence loop provides strong technical separation from navigation preference adaptation.

Apparent engineering risks: If Route IQ includes navigation personalization, counsel should distinguish navigation route preference from representative performance learning.

Areas requiring attorney attention: Navigation-interface embodiments, preference learning language, and any adaptive routing terminology.

### H-006 - US11593728B2 / US20200210931A1 - Systems and methods for scheduling tasks

Similarity score: 69

Differentiation score: 64

Technical overlap summary: The reference overlaps in field professionals, location-associated tasks, scheduling, skills/availability data, historical information, predicted demand, and likelihood evaluation.

Technical differentiation summary: Route IQ is differentiated by outside-sales representative intelligence, customer/territory/outcome learning, recommendation feedback, and sales action probability scoring rather than service task scheduling.

Representative Intelligence Loop comparison: The reference schedules field professionals to service tasks. Route IQ learns representative behavior and sales outcomes from a recurring evidence loop.

Learning architecture comparison: The reference may use historical service/schedule data. Route IQ uses structured field evidence to update multiple intelligence layers.

Recommendation engine comparison: The reference assigns or schedules field professionals. Route IQ recommends representative actions using current intelligence and feedback.

Probability engine comparison: The reference includes likelihood of completing service in one on-site visit. Route IQ's probability engine evaluates future sales or field actions using representative, territory, customer, and outcome intelligence.

Data flow comparison: The reference appears to flow availability, skills, demand, task location, and schedule data into task assignment. Route IQ flows representative session evidence and outcomes into future recommendation state.

Computer implementation comparison: Both can involve real-time scheduling and field-work computer systems. Route IQ is more directed to sales/customer intelligence and recommendation adaptation.

Apparent technical novelty observations: Route IQ's distinction is sales-representative learning and customer/territory/outcome intelligence rather than field-service scheduling likelihood.

Apparent engineering risks: Likelihood-based assignment and historical field-professional data are close technical themes. Counsel should review probability and assignment wording carefully.

Areas requiring attorney attention: Field professional assignment, likelihood scoring, task scheduling, historical information, and real-time schedule updates.

## 6. Medium-Relevance Patent References

### M-001 - US9420100B2 - Method and system for providing a next best action to a user

Similarity score: 58

Differentiation score: 62

Technical overlap summary: The reference overlaps in next-best-action recommendations, decisioning logic, and user-facing action selection.

Technical differentiation summary: Route IQ is differentiated by field-sales representative evidence, territory learning, customer learning, outcome learning, and representative-specific probability scoring.

Representative Intelligence Loop comparison: The reference appears general next-best-action oriented. Route IQ loops representative actions and outcomes back into the intelligence model.

Learning architecture comparison: Route IQ's architecture is specifically separated into representative, territory, customer, and outcome stores.

Recommendation engine comparison: Both use recommendation-style decisioning. Route IQ's recommendation engine is tied to field context and operational evidence.

Probability engine comparison: Route IQ's probability engine uses current intelligence layers; the reference appears broader decisioning.

Data flow comparison: Route IQ captures field evidence and outcome feedback as first-class data. The reference is not field-sales-specific in the landscape summary.

Computer implementation comparison: Both are software decisioning systems, but Route IQ is specialized for adaptive representative intelligence.

Apparent technical novelty observations: Route IQ's technical distinction is the domain-specific field representative intelligence loop.

Apparent engineering risks: Generic next-best-action language may overlap. Future drafting should define the field evidence pipeline and intelligence-layer data structures.

Areas requiring attorney attention: Next-best-action terminology, recommendation rules, decisioning logic, and user-facing action outputs.

### M-002 - US9665875B2 - Automated software tools and methods for improving sales and marketing outcomes

Similarity score: 54

Differentiation score: 66

Technical overlap summary: The reference overlaps in automated sales tools, sales/marketing outcome improvement, and data-driven sales workflows.

Technical differentiation summary: Route IQ is differentiated by outside-sales route/session context, representative learning, territory/customer/outcome stores, and probability recommendations.

Representative Intelligence Loop comparison: Route IQ specifically learns the representative from behavior and field outcomes; the reference appears broader sales/marketing automation.

Learning architecture comparison: Route IQ's learning architecture is explicit and layered. The reference is not summarized as having Route IQ's four-layer field intelligence model.

Recommendation engine comparison: Route IQ generates adaptive field recommendations. The reference appears broader outcome-improvement tooling.

Probability engine comparison: Route IQ uses probability scoring for candidate actions. The reference may use predictive methods but not the Route IQ field architecture in the reviewed summary.

Data flow comparison: Route IQ emphasizes evidence normalization and feedback capture from field events.

Computer implementation comparison: Both are automated sales software systems. Route IQ is narrower and more operationally defined around representative field action.

Apparent technical novelty observations: Route IQ's representative-territory-customer-outcome feedback architecture is the primary technical distinction.

Apparent engineering risks: Broad automated sales outcome-improvement language may be adjacent to Route IQ's outcome learning.

Areas requiring attorney attention: Predictive sales improvement, sales activity data, outcome modeling, and automation scope.

### M-003 - US10380609B2 - System and method for web crawling, lead generation, and customer engagement

Similarity score: 38

Differentiation score: 78

Technical overlap summary: The reference overlaps in lead generation, customer engagement, and automated sales workflow support.

Technical differentiation summary: Route IQ is differentiated by field representative actions, territory intelligence, customer visit outcomes, and adaptive recommendations tied to representative behavior.

Representative Intelligence Loop comparison: The reference appears engagement/lead-generation oriented. Route IQ learns from representative field actions and outcomes.

Learning architecture comparison: Route IQ's learning architecture is field evidence based. The reference appears to emphasize web crawling and engagement workflows.

Recommendation engine comparison: Route IQ recommends field actions; the reference supports engagement automation.

Probability engine comparison: No Route IQ-style field probability engine is identified in the landscape summary.

Data flow comparison: Web/lead/customer engagement data differs from Route IQ's field evidence and outcome data flow.

Computer implementation comparison: Both are software systems for sales-related operations, but their execution environments and data pipelines differ substantially.

Apparent technical novelty observations: Route IQ's physical field-action feedback loop is distinct from lead-generation/customer-engagement automation.

Apparent engineering risks: If Route IQ later uses automated lead generation or enrichment, counsel should separate that input from the core adaptive representative intelligence.

Areas requiring attorney attention: Lead-generation inputs, external enrichment, customer engagement automation, and future Apollo/provider embodiments.

### M-004 - US8775234B2 - Sales force automation system and method with focused account calling tool

Similarity score: 46

Differentiation score: 72

Technical overlap summary: The reference overlaps in sales force automation, focused account activity, and customer/account workflow support.

Technical differentiation summary: Route IQ is differentiated by field visit recommendations, territory intelligence, outcome learning, representative-specific probability scoring, and continuous adaptation.

Representative Intelligence Loop comparison: Focused account calling is not the same as a representative intelligence loop. Route IQ records recommendation response, action outcome, and evidence quality.

Learning architecture comparison: Route IQ's learning architecture is explicit; the reference appears account-calling/workflow oriented.

Recommendation engine comparison: Route IQ recommends field actions and objectives; the reference appears to support account-calling focus.

Probability engine comparison: Route IQ's probability engine evaluates candidate actions from multiple intelligence stores.

Data flow comparison: The reference appears account/workflow oriented; Route IQ includes field evidence normalization and outcome comparison.

Computer implementation comparison: Both are sales-force software systems, but Route IQ is a field intelligence architecture rather than a calling tool.

Apparent technical novelty observations: Route IQ's technical distinction is field evidence and adaptive representative learning.

Apparent engineering risks: Sales-force automation language can be broad. Future drafting should avoid collapsing Route IQ into generic CRM automation.

Areas requiring attorney attention: Account focus, CRM integration, sales automation, and recommendation-to-account workflows.

### M-005 - US7708202B2 - Customer relationship management technology for a mobile sales force

Similarity score: 50

Differentiation score: 70

Technical overlap summary: The reference overlaps in mobile sales force CRM, field user interaction, and customer information access.

Technical differentiation summary: Route IQ is differentiated by learning from field outcomes, maintaining a dynamic representative profile, and generating adaptive recommendations through probability scoring.

Representative Intelligence Loop comparison: Mobile CRM can support field reps, but Route IQ continuously adapts recommendations based on representative-specific outcomes.

Learning architecture comparison: Route IQ includes learning engine responsibilities and separate intelligence stores. The reference appears mobile CRM oriented.

Recommendation engine comparison: Route IQ includes recommendation generation; mobile CRM may provide data access and workflow support.

Probability engine comparison: No Route IQ-style probability engine is identified in the landscape summary.

Data flow comparison: Mobile CRM data flow is typically record access/update. Route IQ adds evidence normalization, learning, scoring, and feedback.

Computer implementation comparison: Both can use mobile clients and backend storage. Route IQ adds modular intelligence services.

Apparent technical novelty observations: Route IQ's distinction is adaptive intelligence on top of mobile/CRM data.

Apparent engineering risks: Mobile CRM embodiments should be framed as input/interface surfaces, not the sole invention.

Areas requiring attorney attention: Mobile sales force workflows, CRM record synchronization, customer data access, and field update features.

### M-006 - US20170308858A1 - Systems and methods for sales lead assignment

Similarity score: 43

Differentiation score: 74

Technical overlap summary: The reference overlaps in sales lead assignment, salesperson/team assignment, and CRM-style routing of sales opportunities.

Technical differentiation summary: Route IQ is differentiated by post-assignment field action learning, representative profile updates, territory/customer/outcome intelligence, and adaptive recommendations.

Representative Intelligence Loop comparison: Lead assignment may select a salesperson. Route IQ learns from what the representative does after assignment and uses outcomes to refine future actions.

Learning architecture comparison: Route IQ learns across multiple intelligence stores; lead assignment appears narrower.

Recommendation engine comparison: Lead assignment differs from Route IQ's candidate action recommendation engine.

Probability engine comparison: Route IQ scores candidate actions in context; lead assignment may score fit but not the same field loop.

Data flow comparison: Lead data to assignment differs from field evidence to learning to recommendation.

Computer implementation comparison: Both can operate within CRM systems. Route IQ is a field decision intelligence layer rather than only an assignment layer.

Apparent technical novelty observations: Route IQ's distinction is continuous adaptive recommendation after field evidence capture.

Apparent engineering risks: Representative matching or lead assignment embodiments may overlap if Route IQ later assigns representatives to prospects.

Areas requiring attorney attention: Salesperson assignment, lead routing, fit scoring, and CRM integration.

## 7. Low-Relevance Patent References

### L-001 - US20020029161A1 - Assignment manager

Similarity score: 30

Differentiation score: 82

Technical overlap summary: The reference overlaps in assignment of business objects such as opportunities, accounts, or service requests.

Technical differentiation summary: Route IQ is differentiated by field representative learning, territory/customer/outcome intelligence, and adaptive recommendations after evidence capture.

Representative Intelligence Loop comparison: Assignment management does not appear to provide Route IQ's recurring field intelligence loop.

Learning architecture comparison: Route IQ uses learning stores and evidence normalization; assignment manager technology appears broader CRM assignment infrastructure.

Recommendation engine comparison: Assignment logic differs from representative action recommendation.

Probability engine comparison: No Route IQ-style probability engine is identified in the landscape summary.

Data flow comparison: Business object assignment differs from field evidence and outcome feedback flow.

Computer implementation comparison: Both may be enterprise CRM components. Route IQ is a specialized field intelligence subsystem.

Apparent technical novelty observations: Route IQ's technical separation is strong when framed as adaptive field recommendation rather than generic assignment.

Apparent engineering risks: Low risk except for any future Route IQ embodiments that assign records or representatives.

Areas requiring attorney attention: Assignment rules, business-object ownership, and CRM object routing.

### L-002 - US5802492A - Routing, mapping, and relative position information

Similarity score: 28

Differentiation score: 86

Technical overlap summary: The reference overlaps in routing, mapping, relative position information, and possible prospect/customer context.

Technical differentiation summary: Route IQ is differentiated by sales representative learning, business outcome intelligence, probability scoring, and recommendation feedback.

Representative Intelligence Loop comparison: Mapping/routing does not appear to include Route IQ's sales representative intelligence loop.

Learning architecture comparison: Route IQ learns from representative actions and outcomes; the reference appears location-information oriented.

Recommendation engine comparison: Route IQ recommends business actions; the reference provides mapping/routing information.

Probability engine comparison: No Route IQ-style business probability engine is identified.

Data flow comparison: Location and route information differs from evidence-intelligence-recommendation feedback data flow.

Computer implementation comparison: Both are computer/network implemented, but Route IQ's architecture is business intelligence oriented.

Apparent technical novelty observations: Route IQ is strongest when routing is framed as an input/output surface rather than the core system.

Apparent engineering risks: Low risk except for language that overemphasizes mapping or route display.

Areas requiring attorney attention: Mapping, routing, prospect-location data, and navigation integration.

### L-003 - US20220245541A1 - Multiple AI engines to determine next best action for employee professional development

Similarity score: 42

Differentiation score: 76

Technical overlap summary: The reference overlaps in AI-based next-best-action recommendations, employee-specific activity data, performance metrics, prediction, and future performance improvement.

Technical differentiation summary: Route IQ is differentiated by field sales/customer/territory/outcome intelligence and representative visit/action recommendations rather than employee coaching or professional development.

Representative Intelligence Loop comparison: The reference uses employee performance data for professional-development actions. Route IQ learns from field actions and customer outcomes for operational recommendations.

Learning architecture comparison: Route IQ's learning architecture is tied to representative, territory, customer, and outcome intelligence stores.

Recommendation engine comparison: The reference recommends professional-development actions. Route IQ recommends field actions, visit objectives, evidence prompts, customer priorities, and follow-up actions.

Probability engine comparison: Both may use prediction, but Route IQ's probability engine is tied to sales/customer/territory outcomes.

Data flow comparison: Employee activity/performance metrics differ from Route IQ's field evidence, territory, customer, and outcome data flow.

Computer implementation comparison: Both are AI recommendation software systems. Route IQ is operational field-intelligence software.

Apparent technical novelty observations: Route IQ is distinct when the recommendation target is representative field execution rather than employee coaching.

Apparent engineering risks: AI next-best-action and employee performance terminology may be adjacent to representative learning.

Areas requiring attorney attention: AI recommendation terminology, employee-performance modeling, and performance-improvement outputs.

## 8. Commercial System Technical Differentiation Appendix

### C-001 - Salesforce Maps / Salesforce field route planning

Similarity score: 64

Differentiation score: 62

Overlap: Field sales routing, CRM data, territory planning, travel-time reduction, and customer visit planning.

Differentiation: Route IQ focuses on representative learning and outcome-aware recommendations rather than CRM-connected route planning alone.

Attorney attention: Salesforce Maps and any Salesforce route-planning or field-sales AI features should be reviewed before non-provisional drafting.

### C-002 - Salesforce Einstein Next Best Action

Similarity score: 55

Differentiation score: 65

Overlap: Next-best-action delivery in CRM workflows.

Differentiation: Route IQ's recommendations are driven by representative, territory, customer, and outcome intelligence from field evidence.

Attorney attention: Next-best-action terminology and CRM recommendation delivery.

### C-003 - Badger Maps

Similarity score: 61

Differentiation score: 66

Overlap: Field sales mapping, route optimization, customer mapping, and territory productivity.

Differentiation: Route IQ is not limited to route optimization and includes representative-specific evidence learning.

Attorney attention: Field sales route planning, lead/customer maps, and territory productivity features.

### C-004 - RepMove

Similarity score: 58

Differentiation score: 68

Overlap: Outside sales route planning and field sales workflow support.

Differentiation: Route IQ adds representative-specific learning, outcome intelligence, probability scoring, and adaptive recommendations.

Attorney attention: Outside sales route-planning workflows and mobile rep productivity features.

### C-005 - eSpatial

Similarity score: 54

Differentiation score: 70

Overlap: Mapping, route planning, territory management, and sales visualization.

Differentiation: Route IQ focuses on adaptive representative intelligence rather than territory visualization and route planning.

Attorney attention: Territory management and route-planning features.

### C-006 - MyRouteOnline

Similarity score: 36

Differentiation score: 84

Overlap: Multi-stop route planning and route optimization.

Differentiation: Route IQ uses route planning only as an input/interface and centers on adaptive representative intelligence.

Attorney attention: Route optimization language.

### C-007 - Skedulo

Similarity score: 50

Differentiation score: 72

Overlap: Field workforce scheduling, dispatch, routing, and mobile execution.

Differentiation: Route IQ is sales/customer intelligence and representative learning rather than workforce dispatch scheduling.

Attorney attention: Field workforce scheduling, dispatch, and assignment logic.

### C-008 - Route4Me

Similarity score: 35

Differentiation score: 84

Overlap: Route optimization and routing logistics.

Differentiation: Route IQ is not logistics routing; it generates adaptive representative recommendations from sales intelligence layers.

Attorney attention: Route-optimization terminology.

### C-009 - SimplyDepo

Similarity score: 50

Differentiation score: 72

Overlap: Field sales route planning and sales execution tooling.

Differentiation: Route IQ's technical center is representative-specific learning and outcome-aware probability recommendations.

Attorney attention: Field-sales route planning and execution workflow features.

## 9. Technical Literature Differentiation Appendix

### T-001 - Sales route optimization methods

Similarity score: 44

Differentiation score: 78

Overlap: Visit planning, time windows, route sequencing, and optimization.

Differentiation: Route IQ learns the representative and outcomes rather than only optimizing route sequence.

Attorney attention: Any future route-optimization claims or examples.

### T-002 - Orienteering/customer visit routing

Similarity score: 48

Differentiation score: 76

Overlap: Selecting valuable customer locations under time, distance, capacity, or reward constraints.

Differentiation: Route IQ's recommendation basis includes representative-specific learning, evidence quality, customer intelligence, and outcome feedback.

Attorney attention: Stop/customer selection algorithms and candidate-action ranking.

### T-003 - Sales territory alignment

Similarity score: 42

Differentiation score: 78

Overlap: Territory design, account/geography assignment, workload balancing, and sales performance constraints.

Differentiation: Route IQ updates territory intelligence during representative operation and feeds that state into recommendations.

Attorney attention: Territory boundaries, territory assignment, and workload-balancing embodiments.

### T-004 - Vehicle routing problem literature

Similarity score: 32

Differentiation score: 88

Overlap: Route optimization, travel cost, capacity, constraints, and service windows.

Differentiation: Route IQ is an adaptive representative intelligence architecture, not vehicle-routing optimization.

Attorney attention: Avoid overcharacterizing Route IQ as VRP or logistics routing.

## 10. Final Summary

Where Route IQ appears strongest technically:

- Representative-specific learning is the clearest engineering distinction.
- The four-layer intelligence architecture provides a concrete structure that differs from route planners, CRM systems, lead assignment, and general next-best-action systems.
- Evidence normalization and outcome feedback give Route IQ a repeatable technical loop rather than a one-time route or task plan.
- Probability scoring is tied to representative, territory, customer, and outcome intelligence rather than only distance, time, lead fit, or general preference.

Where Route IQ appears closest to existing systems:

- Field itinerary and territory management references, especially H-001.
- Sales productivity/zone/calendar planning references, especially H-002.
- Automated salesbeat and who-to-visit planning, especially H-004.
- General recommendation/next-best-action systems, especially H-003 and M-001.
- Field-professional scheduling with likelihood evaluation, especially H-006.

Areas that deserve attorney review before a non-provisional application:

- How to frame Route IQ as adaptive representative intelligence rather than route optimization.
- How to distinguish itinerary planning, salesbeat optimization, and territory scheduling from representative-outcome learning.
- How to describe probability scoring without collapsing into generic next-best-action or generic predictive sales software.
- Whether high-relevance references should receive attorney-led comparison review against the filed disclosure.
- Whether future claims should focus on the Representative Intelligence Loop, evidence normalization, intelligence-store updates, or recommendation/prediction outputs.
- Whether additional technical implementation artifacts should be preserved for representative profile updates, outcome learning, probability calculation, and recommendation generation.

## 11. Legal Boundary Confirmation

- No legal opinion is made.
- No patentability determination is made.
- No infringement analysis is made.
- No legal conclusion about any reference is made.
- No statutory conclusion is made.
- This document is an engineering differentiation analysis only.
