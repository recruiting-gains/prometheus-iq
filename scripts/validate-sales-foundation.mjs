import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "sales/README.md",
  "sales/enterprise-sales-methodology.md",
  "sales/multi-industry-enterprise-sales-playbook.md",
  "sales/enterprise-industry-playbooks.md",
  "sales/enterprise-pilot-sales-package.md",
  "sales/roofing-discovery-and-pilot-targeting.md",
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
  ["sales/multi-industry-enterprise-sales-playbook.md", ["Universal Sales Framework", "Repeatable Founder Sales Motion", "Operating Profiles Covered", "Remaining Industries Requiring Research"]],
  ["sales/enterprise-industry-playbooks.md", ["Healthcare", "Medical Devices", "B2B SaaS", "Cross-Industry Qualification Rule"]],
  ["sales/enterprise-pilot-sales-package.md", ["Enterprise Pilot Positioning", "Discovery Call Script", "Operating Profile Explanation", "Post-Pilot Expansion Path"]],
  ["sales/roofing-discovery-and-pilot-targeting.md", ["Roofing Discovery Questions", "Roofing Pilot Qualification Criteria", "First-Call Script", "Follow-Up Email"]],
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

const requiredIndustries = [
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

const requiredIndustrySections = [
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

const requiredPilotPackageSections = [
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
];

const requiredPilotProfiles = [
  "Fitness",
  "Roofing",
  "Security",
  "Medical",
  "Insurance",
  "General Outside Sales",
];

const requiredRoofingSections = [
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
];

const requiredRoofingPersonas = [
  "Owner",
  "Sales Manager",
  "Canvassing Manager",
  "Operations Manager",
];

const requiredRoofingOutcomes = [
  "Inspections",
  "Estimates",
  "Signed contracts",
  "Territory coverage",
  "Canvasser accountability",
];

const requiredOperatingProfiles = [
  "Fitness",
  "Roofing",
  "Security",
  "Medical",
  "Insurance",
  "Solar",
  "Home Services",
  "General Outside Sales",
];

const requiredOperatingProfileSections = [
  "Buyer Personas",
  "Discovery Questions",
  "Business Pain Points",
  "ROI Framework",
  "Success Metrics",
  "Pilot Structure",
  "Objection Handling",
  "Closing Strategy",
  "Expansion Strategy",
];

const requiredUniversalSalesElements = [
  "Territory Intelligence",
  "Field Accountability",
  "Route Optimization",
  "Activity Verification",
  "AI Recommendations",
  "Manager Visibility",
  "CRM Integration",
];

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

const playbookPath = join(root, "sales/enterprise-industry-playbooks.md");
if (existsSync(playbookPath)) {
  const playbook = readFileSync(playbookPath, "utf8");

  for (const industry of requiredIndustries) {
    if (!playbook.includes(`## ${industry}`)) {
      failures.push(`Missing industry playbook: ${industry}`);
      continue;
    }

    const industryStart = playbook.indexOf(`## ${industry}`);
    const nextIndustryStart = playbook.indexOf("\n## ", industryStart + 1);
    const section = playbook.slice(
      industryStart,
      nextIndustryStart === -1 ? playbook.length : nextIndustryStart,
    );

    for (const requiredSection of requiredIndustrySections) {
      if (!section.includes(`### ${requiredSection}`)) {
        failures.push(`Missing ${requiredSection} in ${industry} playbook`);
      }
    }
  }
}

const multiIndustryPlaybookPath = join(root, "sales/multi-industry-enterprise-sales-playbook.md");
if (existsSync(multiIndustryPlaybookPath)) {
  const playbook = readFileSync(multiIndustryPlaybookPath, "utf8");

  for (const element of requiredUniversalSalesElements) {
    if (!playbook.includes(`### ${element}`)) {
      failures.push(`Missing universal sales framework element: ${element}`);
    }
  }

  for (const profile of requiredOperatingProfiles) {
    if (!playbook.includes(`## ${profile}`)) {
      failures.push(`Missing Operating Profile playbook: ${profile}`);
      continue;
    }

    const profileStart = playbook.indexOf(`## ${profile}`);
    const nextProfileStart = playbook.indexOf("\n## ", profileStart + 1);
    const profileSection = playbook.slice(
      profileStart,
      nextProfileStart === -1 ? playbook.length : nextProfileStart,
    );

    for (const section of requiredOperatingProfileSections) {
      if (!profileSection.includes(`### ${section}`)) {
        failures.push(`Missing ${section} in ${profile} Operating Profile playbook`);
      }
    }
  }
}

const pilotPackagePath = join(root, "sales/enterprise-pilot-sales-package.md");
if (existsSync(pilotPackagePath)) {
  const pilotPackage = readFileSync(pilotPackagePath, "utf8");

  for (const section of requiredPilotPackageSections) {
    if (!pilotPackage.includes(`### ${section}`)) {
      failures.push(`Missing enterprise pilot package section: ${section}`);
    }
  }

  for (const profile of requiredPilotProfiles) {
    if (!pilotPackage.includes(`### ${profile}`)) {
      failures.push(`Missing enterprise pilot operating profile card: ${profile}`);
    }
  }

  for (const forbiddenSurface of ["Companion", "Website", "CRM runtime", "Mobile", "Dashboard", "Infrastructure"]) {
    if (!pilotPackage.includes(forbiddenSurface)) {
      failures.push(`Missing protected surface boundary in enterprise pilot package: ${forbiddenSurface}`);
    }
  }
}

const roofingPackagePath = join(root, "sales/roofing-discovery-and-pilot-targeting.md");
if (existsSync(roofingPackagePath)) {
  const roofingPackage = readFileSync(roofingPackagePath, "utf8");

  for (const section of requiredRoofingSections) {
    if (!roofingPackage.includes(`## ${section}`)) {
      failures.push(`Missing roofing package section: ${section}`);
    }
  }

  for (const persona of requiredRoofingPersonas) {
    if (!roofingPackage.includes(`### ${persona}`)) {
      failures.push(`Missing roofing buyer persona: ${persona}`);
    }
  }

  for (const outcome of requiredRoofingOutcomes) {
    if (!roofingPackage.toLowerCase().includes(outcome.toLowerCase())) {
      failures.push(`Missing roofing outcome mapping: ${outcome}`);
    }
  }

  for (const protectedSubsystem of ["Companion", "Website", "CRM runtime", "Mobile", "Dashboard", "Infrastructure", "Intelligence Engine"]) {
    if (!roofingPackage.includes(protectedSubsystem)) {
      failures.push(`Missing protected subsystem boundary in roofing package: ${protectedSubsystem}`);
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
