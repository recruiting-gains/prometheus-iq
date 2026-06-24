const categories = [
  {
    id: "bug",
    label: "Bug",
    keywords: ["crash", "broken", "error", "failed", "doesnt work", "not working", "blank", "stuck"],
    nextAction: "Reproduce the issue, capture the exact screen, record the steps, and fix only if it blocks the beta."
  },
  {
    id: "ux_issue",
    label: "UX Issue",
    keywords: ["confusing", "hard to use", "too many clicks", "unclear", "slow", "cant find", "lost"],
    nextAction: "Mark the friction point, simplify the wording or flow, and retest with the rep before adding features."
  },
  {
    id: "route_quality_issue",
    label: "Route Quality Issue",
    keywords: ["bad route", "same place", "wrong place", "plaza", "walmart", "not walk in", "not actionable", "route"],
    nextAction: "Check whether the stop is walk-in ready, permission required, repeated, too generic, or outside the right category mix."
  },
  {
    id: "data_issue",
    label: "Data Issue",
    keywords: ["missing data", "wrong address", "duplicate", "old", "stale", "wrong phone", "bad address"],
    nextAction: "Verify the record, correct the source data, and keep the route engine from rewarding stale or duplicate prospects."
  },
  {
    id: "feature_request",
    label: "Feature Request",
    keywords: ["can it", "add", "feature", "would be nice", "i wish", "should have"],
    nextAction: "Do not build immediately. Put it in the post-beta backlog unless it blocks adoption or reporting."
  },
  {
    id: "training_issue",
    label: "Training Issue",
    keywords: ["how do i", "what do i do", "dont know", "training", "explain", "instructions"],
    nextAction: "Improve onboarding, add clearer first-day guidance, and test whether the rep can complete the workflow without help."
  }
];

export function categorizeBetaFeedback(feedback = "") {
  const normalized = String(feedback || "").toLowerCase().replace(/[’‘']/g, "");
  if (!normalized.trim()) {
    return {
      id: "intake_needed",
      label: "Feedback Intake Needed",
      confidence: 0,
      nextAction: "Ask Anthony what happened, where it happened, what he expected, what actually happened, and whether it blocked the visit."
    };
  }

  let best = null;
  for (const category of categories) {
    const matches = category.keywords.filter((keyword) => normalized.includes(keyword));
    const score = matches.length / Math.max(category.keywords.length, 1);
    if (!best || score > best.confidence) {
      best = {
        ...category,
        confidence: Number(score.toFixed(2)),
        matchedKeywords: matches
      };
    }
  }

  if (!best || best.confidence === 0) {
    return {
      id: "general_feedback",
      label: "General Beta Feedback",
      confidence: 0.25,
      matchedKeywords: [],
      nextAction: "Clarify whether this is a bug, route quality issue, UX issue, data issue, feature request, or training issue."
    };
  }

  return best;
}

export function createBetaFeedbackReport(command = "") {
  const cleaned = String(command || "")
    .replace(/^(hey\s+prometheus|good\s+morning\s+prometheus|prometheus)[,\s]+/i, "")
    .replace(/^(capture|prepare|create|review)?\s*(anthony\s+)?beta\s+feedback\s*/i, "")
    .trim();
  const category = categorizeBetaFeedback(cleaned);

  if (category.id === "intake_needed") {
    return {
      title: "Beta Feedback Intake",
      body: "Ask Anthony five things: what happened, where it happened, what he expected, what actually happened, and whether it blocked the visit. Then Prometheus can classify it as bug, UX, route quality, data, feature request, or training."
    };
  }

  return {
    title: `Beta Feedback: ${category.label}`,
    body: `Category: ${category.label}. Confidence: ${category.confidence}. ${category.nextAction}`
  };
}
