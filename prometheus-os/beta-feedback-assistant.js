const categories = [
  {
    id: "bug",
    label: "Bug",
    keywords: ["crash", "broken", "error", "failed", "doesnt work", "not working", "blank", "stuck"],
    nextAction: "Reproduce the issue, capture the exact workflow, and fix it according to operational impact."
  },
  {
    id: "ux_issue",
    label: "UX Issue",
    keywords: ["confusing", "hard to use", "too many clicks", "unclear", "slow", "cant find", "lost"],
    nextAction: "Mark the friction point, simplify the workflow, and verify the change with the customer onboarding path."
  },
  {
    id: "route_quality_issue",
    label: "Route Quality Issue",
    keywords: ["bad route", "same place", "wrong place", "not actionable", "route", "prospect quality"],
    nextAction: "Review Route IQ evidence, prospect quality, route freshness, and the decision that produced the stop."
  },
  {
    id: "data_issue",
    label: "Data Issue",
    keywords: ["missing data", "wrong address", "duplicate", "old", "stale", "wrong phone", "bad address"],
    nextAction: "Verify the record, correct the authoritative source, and preserve the audit trail."
  },
  {
    id: "capability_request",
    label: "Capability Request",
    keywords: ["can it", "add", "feature", "would be nice", "i wish", "should have"],
    nextAction: "Record the request, compare it with Route IQ's primary-product mission, and prioritize only if it improves onboarding or operations."
  },
  {
    id: "onboarding_issue",
    label: "Onboarding Issue",
    keywords: ["how do i", "what do i do", "dont know", "training", "explain", "instructions", "onboarding"],
    nextAction: "Improve the onboarding path and confirm the customer can complete the workflow without intervention."
  }
];

export function categorizeOperatingFeedback(feedback = "") {
  const normalized = String(feedback || "").toLowerCase().replace(/[’‘']/g, "");
  if (!normalized.trim()) {
    return {
      id: "intake_needed",
      label: "Feedback Intake Needed",
      confidence: 0,
      nextAction: "Capture what happened, where it happened, the expected result, the actual result, and the operational impact."
    };
  }

  let best = null;
  for (const category of categories) {
    const matches = category.keywords.filter((keyword) => normalized.includes(keyword));
    const score = matches.length / Math.max(category.keywords.length, 1);
    if (!best || score > best.confidence) {
      best = { ...category, confidence: Number(score.toFixed(2)), matchedKeywords: matches };
    }
  }

  if (!best || best.confidence === 0) {
    return {
      id: "general_feedback",
      label: "General Operating Feedback",
      confidence: 0.25,
      matchedKeywords: [],
      nextAction: "Clarify whether this is a bug, route quality issue, UX issue, data issue, capability request, or onboarding issue."
    };
  }

  return best;
}

export function createOperatingFeedbackReport(command = "") {
  const cleaned = String(command || "")
    .replace(/^(hey\s+prometheus|good\s+morning\s+prometheus|prometheus)[,\s]+/i, "")
    .replace(/^(capture|prepare|create|review)?\s*(customer\s+|operating\s+)?feedback\s*/i, "")
    .trim();
  const category = categorizeOperatingFeedback(cleaned);

  if (category.id === "intake_needed") {
    return {
      title: "Operating Feedback Intake",
      body: "Capture five facts: what happened, where it happened, what was expected, what actually happened, and the operational impact. Prometheus can then classify it without inventing context."
    };
  }

  return {
    title: `Operating Feedback: ${category.label}`,
    body: `Category: ${category.label}. Confidence: ${category.confidence}. ${category.nextAction}`
  };
}
