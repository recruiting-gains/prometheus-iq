function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function createEmailDraft(command = "") {
  const normalized = String(command || "").toLowerCase().replace(/[’‘']/g, "");

  if (!normalized.trim() || normalized === "email") {
    return {
      title: "Email Assistant",
      body: "Do you want to draft an email, prepare a Chris follow-up, write a Larry and Phil executive note, create beta tester instructions, write pilot outreach, or draft a social caption?"
    };
  }

  if (containsAny(normalized, ["chris", "hardeman", "leadership follow"])) {
    return {
      title: "Chris Follow-Up Draft",
      body: "Chris, thank you again for being willing to share Prometheus IQ with the team while you are in Dallas. When you return, I would appreciate the chance to walk you through the controlled pilot structure, the safeguards, and the business outcomes we would measure. My goal is to keep this simple, low-risk, and focused on whether Prometheus IQ can improve field activity visibility and LSM execution."
    };
  }

  if (containsAny(normalized, ["larry", "phil", "president", "coo", "executive"])) {
    return {
      title: "Executive Note Draft",
      body: "Prometheus IQ is a field-sales intelligence tool designed to help teams know where to go, verify activity, and measure what happened in the field. The request is a controlled 14-day pilot with approved users, weekly review, and a final report. The goal is not to replace existing systems, but to test whether field activity becomes more visible, accountable, and productive."
    };
  }

  if (containsAny(normalized, ["beta tester", "anthony", "instructions"])) {
    return {
      title: "Beta Tester Instructions Draft",
      body: "Your role in the beta is simple: use Prometheus IQ during field activity, follow the route, verify visits, log outcomes, and send end-of-day feedback. Focus on what felt useful, what felt confusing, what locations were actionable, and whether the workflow helped you move faster."
    };
  }

  if (containsAny(normalized, ["pilot outreach", "new business", "business owner", "outside sales"])) {
    return {
      title: "Pilot Outreach Draft",
      body: "I am building Prometheus IQ, a field-sales intelligence platform for teams that rely on outside sales, visits, events, or local outreach. I am currently looking for a small number of private pilot partners to test whether better routing, verified activity, and clearer reporting can improve field performance. Would you be open to a short conversation?"
    };
  }

  if (containsAny(normalized, ["instagram", "social", "caption", "post"])) {
    return {
      title: "Social Caption Draft",
      body: "Building Prometheus IQ from the field up. The goal is simple: help outside sales teams know where to go, verify the work, and turn every visit into better intelligence for the next one. Private pilot work continues."
    };
  }

  return {
    title: "Email Drafting Mode",
    body: "I can draft the message, but I need the audience first: Chris, Larry and Phil, beta tester, pilot prospect, or social media. I will draft only. I will not send."
  };
}
