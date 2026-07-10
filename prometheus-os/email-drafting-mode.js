function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function createEmailDraft(command = "") {
  const normalized = String(command || "").toLowerCase().replace(/[’‘']/g, "");

  if (!normalized.trim() || normalized === "email") {
    return {
      title: "Email Assistant",
      body: "Do you want a customer follow-up, Route IQ onboarding note, enterprise update, operating-feedback request, or social caption? I will draft only and will not send."
    };
  }

  if (containsAny(normalized, ["customer follow", "onboarding", "route iq customer"])) {
    return {
      title: "Customer Follow-Up Draft",
      body: "Quick Route IQ update: I want to keep the next step simple and operational. Please confirm the current owner, the decision we need to close, and any onboarding blocker on your side. I will keep proprietary intelligence logic out of the discussion and focus on the outcome your team needs."
    };
  }

  if (containsAny(normalized, ["executive", "enterprise", "leadership", "security", "hardening"])) {
    return {
      title: "Enterprise Update Draft",
      body: "Route IQ is operational and Patent Pending. Our current work is deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement. I can provide the verified operating controls and next-step ownership without exposing protected product mechanics."
    };
  }

  if (containsAny(normalized, ["feedback", "workflow", "route quality"])) {
    return {
      title: "Operating Feedback Request Draft",
      body: "Please share what happened, where it happened, what you expected, what actually happened, and the operational impact. That gives us enough evidence to classify the issue and choose the smallest reliable correction."
    };
  }

  if (containsAny(normalized, ["new business", "business owner", "outside sales", "prospect"])) {
    return {
      title: "Route IQ Outreach Draft",
      body: "Prometheus built Route IQ to make outside sales intelligent, directed, accountable, and compounding. It helps teams direct field activity, preserve verified outcomes, and improve the next decision. Would you be open to a short conversation about your current outside-sales workflow?"
    };
  }

  if (containsAny(normalized, ["instagram", "social", "caption", "post"])) {
    return {
      title: "Social Caption Draft",
      body: "Route IQ is built for a simple operating truth: outside sales creates more value when every decision, visit, and outcome improves what happens next. Prometheus makes that work intelligent, directed, accountable, and compounding."
    };
  }

  return {
    title: "Email Drafting Mode",
    body: "I can draft the message, but I need the audience and the decision you want from them. I will draft only and will not send."
  };
}
