import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("Sales foundation defines reusable enterprise scope", () => {
  const readme = read("sales/README.md");

  assert.match(readme, /not the market boundary/);
  assert.match(readme, /Healthcare/);
  assert.match(readme, /Medical Devices/);
  assert.match(readme, /B2B SaaS/);
  assert.match(readme, /Any organization using outside sales/);
});

test("Sales foundation keeps implementation ownership out of Sales", () => {
  const readme = read("sales/README.md");
  const demo = read("sales/demo-pilot-onboarding.md");

  assert.match(readme, /Sales does not own Dashboard/);
  assert.match(demo, /Sales may not directly modify:/);
  assert.match(demo, /Dashboard code/);
  assert.match(demo, /CRM implementation/);
  assert.match(demo, /Infrastructure/);
});

test("Sales foundation covers required operating-system artifacts", () => {
  const files = [
    read("sales/enterprise-sales-methodology.md"),
    read("sales/enterprise-industry-playbooks.md"),
    read("sales/discovery-and-qualification.md"),
    read("sales/demo-pilot-onboarding.md"),
    read("sales/customer-success-lifecycle.md"),
    read("sales/objection-library.md"),
    read("sales/roi-calculator-framework.md"),
    read("sales/industry-positioning.md"),
    read("sales/founder-pitch-and-executive-presentation.md"),
    read("sales/documentation-architecture.md"),
  ].join("\n");

  for (const phrase of [
    "Sales Process",
    "Enterprise Industry Playbooks",
    "Discovery Framework",
    "Qualification Framework",
    "Standard Demo Flow",
    "Pilot Structure",
    "Customer Onboarding",
    "Success Metrics",
    "Expansion Strategy",
    "Renewal Strategy",
    "Objection Library",
    "ROI Calculator Framework",
    "Industry Positioning Matrix",
    "Founder Pitch",
    "Executive Presentation Structure",
    "Sales Documentation Architecture",
  ]) {
    assert.match(files, new RegExp(phrase));
  }
});

test("Enterprise industry playbooks cover required industries and sales sections", () => {
  const playbooks = read("sales/enterprise-industry-playbooks.md");
  const industries = [
    "Healthcare",
    "Medical Devices",
    "Solar",
    "Roofing",
    "Security",
    "Telecom",
    "Payroll",
    "Commercial Cleaning",
    "HVAC",
    "Insurance",
    "Industrial Equipment",
    "Manufacturing",
    "Logistics",
    "B2B SaaS",
  ];
  const requiredSections = [
    "Customer Profile",
    "Pain Points",
    "Sales Process",
    "Decision Makers",
    "Buying Triggers",
    "Prometheus IQ Value Proposition",
    "Pilot Strategy",
    "Enterprise Rollout Strategy",
    "ROI Discussion",
    "Objection Handling",
    "Success Metrics",
  ];

  for (const industry of industries) {
    const start = playbooks.indexOf(`## ${industry}`);
    assert.notEqual(start, -1, `${industry} playbook is missing`);

    const next = playbooks.indexOf("\n## ", start + 1);
    const section = playbooks.slice(start, next === -1 ? playbooks.length : next);

    for (const requiredSection of requiredSections) {
      assert.match(section, new RegExp(`### ${requiredSection}`));
    }
  }
});
