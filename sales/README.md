# Prometheus Sales

Purpose: own the reusable go-to-market operating system for Prometheus Route IQ.

Prometheus Route IQ is an AI operating system for organizations that rely on outside sales representatives. Gym sales is the first production validation environment, not the market boundary.

Sales owns strategy, messaging, discovery, qualification, pilots, demos, onboarding, expansion, renewal, enablement, and customer-facing sales documentation. Sales does not own Dashboard, Companion, CRM implementation, Infrastructure, Integrations, or the Intelligence Engine.

## Operating Rule

Every Sales artifact must answer four questions:

1. What customer problem does Prometheus solve?
2. What evidence proves the problem matters?
3. What operating change does Prometheus create?
4. What business outcome justifies adoption, renewal, or expansion?

## Current Foundation

- `sales/enterprise-sales-methodology.md`
- `sales/multi-industry-enterprise-sales-playbook.md`
- `sales/enterprise-industry-playbooks.md`
- `sales/enterprise-pilot-sales-package.md`
- `sales/roofing-discovery-and-pilot-targeting.md`
- `sales/discovery-and-qualification.md`
- `sales/demo-pilot-onboarding.md`
- `sales/customer-success-lifecycle.md`
- `sales/objection-library.md`
- `sales/roi-calculator-framework.md`
- `sales/industry-positioning.md`
- `sales/founder-pitch-and-executive-presentation.md`
- `sales/documentation-architecture.md`

## Existing Assets To Reuse

- `PRODUCT_VISION.md`: canonical company identity, product vision, product promise, positioning, and long-term category.
- `README.md`: current technical and operating context.
- `docs/business-pilot-discovery-and-demo-dashboard-process.md`: current customer discovery and demo-dashboard process.
- `docs/prometheus-pilot-execution-playbook.md`: current controlled pilot operations.
- `docs/prometheus-iq-pilot-success-metrics-framework.md`: current pilot measurement.
- `docs/prometheus-pricing-strategy-playbook.md`: current founding-partner pricing strategy.
- `SENDABLE LEADERSHIP PACKET/`: sendable Fitness Connection pilot packet.
- `PROMETHEUS EXECUTIVE PACKAGE/`: executive package structure.

## Industry Scope

Prometheus Sales should develop repeatable systems for:

- Healthcare
- Medical Devices
- Solar
- Roofing
- Security
- Payroll
- Telecom
- Commercial Cleaning
- HVAC
- Industrial Equipment
- Manufacturing
- Logistics
- Insurance
- B2B SaaS
- Any organization using outside sales

## Stage Model

Prometheus Sales should prepare the company for this customer progression:

1. Small business: founder-led sale, fast discovery, narrow pilot.
2. Regional company: manager-led evaluation, multi-rep pilot, operating review.
3. National company: cross-market pilot, implementation plan, executive sponsor.
4. Enterprise deployment: procurement, security review, legal review, renewal and expansion governance.

## Duplicate Prevention

Do not create separate Sales versions of product code, CRM workflow, Dashboard logic, Companion logic, Infrastructure plans, or Intelligence Engine scoring. Sales documents may describe the customer-facing value of those systems, but implementation ownership remains with the proper subsystem.

When creating customer-specific material, start from this folder and link back to existing approved pilot, pricing, and executive assets instead of copying them into new uncontrolled documents.
