import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "sales/README.md",
  "sales/enterprise-sales-methodology.md",
  "sales/discovery-and-qualification.md",
  "sales/demo-pilot-onboarding.md",
  "sales/customer-success-lifecycle.md",
  "sales/objection-library.md",
  "sales/roi-calculator-framework.md",
  "sales/industry-positioning.md",
  "sales/founder-pitch-and-executive-presentation.md",
  "sales/documentation-architecture.md",
];

const requiredPhrases = new Map([
  ["sales/README.md", ["Prometheus IQ is an AI operating system", "Sales does not own Dashboard"]],
  ["sales/enterprise-sales-methodology.md", ["Do not sell Prometheus as a CRM replacement", "Enterprise"]],
  ["sales/discovery-and-qualification.md", ["Qualification Framework", "Field motion"]],
  ["sales/demo-pilot-onboarding.md", ["Standard Demo Flow", "Pilot Structure", "Customer Onboarding"]],
  ["sales/customer-success-lifecycle.md", ["Expansion Strategy", "Renewal Strategy", "Success Metrics"]],
  ["sales/objection-library.md", ["Is this just a CRM?", "What is the ROI?"]],
  ["sales/roi-calculator-framework.md", ["ROI Equation", "Required Inputs"]],
  ["sales/industry-positioning.md", ["Healthcare", "Medical devices", "Solar", "B2B SaaS"]],
  ["sales/founder-pitch-and-executive-presentation.md", ["Founder Pitch", "Executive Presentation Structure"]],
  ["sales/documentation-architecture.md", ["Duplicate Prevention Rules", "Required Sales Artifacts By Stage"]],
]);

const failures = [];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) {
    failures.push(`Missing required file: ${file}`);
    continue;
  }

  const content = readFileSync(path, "utf8");
  const phrases = requiredPhrases.get(file) ?? [];

  for (const phrase of phrases) {
    if (!content.includes(phrase)) {
      failures.push(`Missing phrase in ${file}: ${phrase}`);
    }
  }
}

const forbiddenOwnership = [
  "Sales owns Dashboard",
  "Sales owns Companion",
  "Sales owns CRM implementation",
  "Sales owns Infrastructure",
  "Sales owns Integrations",
  "Sales owns Intelligence Engine",
];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");

  for (const phrase of forbiddenOwnership) {
    if (content.includes(phrase)) {
      failures.push(`Forbidden ownership claim in ${file}: ${phrase}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Sales foundation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Sales foundation validation passed.");
