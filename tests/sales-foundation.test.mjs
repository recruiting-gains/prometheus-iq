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
    read("sales/enterprise-pilot-sales-package.md"),
    read("sales/roofing-discovery-and-pilot-targeting.md"),
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
    "Enterprise Pilot Sales Package",
    "Roofing Discovery And Pilot Targeting",
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

test("Roofing discovery and pilot targeting package covers required sales assets", () => {
  const roofingPackage = read("sales/roofing-discovery-and-pilot-targeting.md");

  for (const phrase of [
    "Target Customer Profile",
    "Roofing Discovery Questions",
    "Roofing Pilot Qualification Criteria",
    "Roofing Buyer Personas",
    "Roofing Value Proposition",
    "Feature-To-Outcome Map",
    "Objection Handling",
    "Pilot Success Metrics",
    "First-Call Script",
    "Follow-Up Email",
    "Pilot Targeting Checklist",
  ]) {
    assert.match(roofingPackage, new RegExp(phrase));
  }

  for (const persona of [
    "Owner",
    "Sales Manager",
    "Canvassing Manager",
    "Operations Manager",
  ]) {
    assert.match(roofingPackage, new RegExp(`### ${persona}`));
  }

  for (const outcome of [
    "inspections",
    "estimates",
    "signed contracts",
    "territory coverage",
    "canvasser accountability",
  ]) {
    assert.match(roofingPackage.toLowerCase(), new RegExp(outcome));
  }
});

test("Enterprise pilot sales package covers required buyer and founder material", () => {
  const pilotPackage = read("sales/enterprise-pilot-sales-package.md");

  for (const phrase of [
    "Enterprise Pilot Positioning",
    "Pilot Qualification Criteria",
    "Discovery Call Script",
    "Fitness Connection-Style Enterprise Pilot Motion",
    "Operating Profile Explanation",
    "ROI And Value Framework",
    "Objection Handling",
    "Pricing Guidance",
    "Pilot Success Criteria",
    "Post-Pilot Expansion Path",
    "Buyer-Facing Package",
    "Founder-Facing Operating Guide",
  ]) {
    assert.match(pilotPackage, new RegExp(phrase));
  }

  for (const profile of [
    "Fitness",
    "Roofing",
    "Security",
    "Medical",
    "Insurance",
    "General Outside Sales",
  ]) {
    assert.match(pilotPackage, new RegExp(`### ${profile}`));
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
