export const ROUTE_IQ_REPRESENTATIVE_STYLE_PREVIEW_VERSION = "route-iq-representative-style-preview.v1";

export const routeIqRepresentativeStyleQuestions = Object.freeze([
  Object.freeze({
    id: "languages",
    mode: "multiple",
    legend: "Which languages can you confidently use in a sales conversation?",
    options: Object.freeze([
      Object.freeze({ value: "english", label: "English" }),
      Object.freeze({ value: "spanish", label: "Spanish" }),
      Object.freeze({ value: "multilingual", label: "More than two languages" }),
      Object.freeze({ value: "prefer_not_to_say", label: "Prefer not to say" })
    ])
  }),
  Object.freeze({
    id: "conversationStyle",
    mode: "single",
    legend: "Where do you naturally build the strongest rapport?",
    options: Object.freeze([
      Object.freeze({ value: "one_to_one", label: "One person at a time" }),
      Object.freeze({ value: "small_group", label: "A small group" }),
      Object.freeze({ value: "large_group", label: "A crowd or event" })
    ])
  }),
  Object.freeze({
    id: "fieldEnvironment",
    mode: "single",
    legend: "Which field environment brings out your best work?",
    options: Object.freeze([
      Object.freeze({ value: "business_visits", label: "Business visits" }),
      Object.freeze({ value: "door_to_door", label: "Door-to-door" }),
      Object.freeze({ value: "community_events", label: "Community events" }),
      Object.freeze({ value: "scheduled_appointments", label: "Scheduled appointments" })
    ])
  }),
  Object.freeze({
    id: "energyWindow",
    mode: "single",
    legend: "When do you usually feel most effective in the field?",
    options: Object.freeze([
      Object.freeze({ value: "morning", label: "Morning" }),
      Object.freeze({ value: "before_lunch", label: "Before lunch" }),
      Object.freeze({ value: "after_lunch", label: "After lunch" }),
      Object.freeze({ value: "evening", label: "Evening" })
    ])
  }),
  Object.freeze({
    id: "interests",
    mode: "multiple",
    legend: "What do you genuinely enjoy outside work?",
    options: Object.freeze([
      Object.freeze({ value: "fitness_wellness", label: "Fitness and wellness" }),
      Object.freeze({ value: "food_hospitality", label: "Food and hospitality" }),
      Object.freeze({ value: "community_events", label: "Community and events" }),
      Object.freeze({ value: "home_projects", label: "Home projects" }),
      Object.freeze({ value: "business_technology", label: "Business and technology" }),
      Object.freeze({ value: "prefer_not_to_say", label: "Prefer not to say" })
    ])
  }),
  Object.freeze({
    id: "conversationPace",
    mode: "single",
    legend: "Which conversation pace feels most natural?",
    options: Object.freeze([
      Object.freeze({ value: "deeper", label: "Fewer, deeper conversations" }),
      Object.freeze({ value: "balanced", label: "A balanced mix" }),
      Object.freeze({ value: "faster", label: "More, faster conversations" })
    ])
  })
]);

const questionsById = new Map(routeIqRepresentativeStyleQuestions.map(question => [question.id, question]));

function allowedValues(question) {
  return new Set(question.options.map(option => option.value));
}

function normalizeMultiple(question, value) {
  if (!Array.isArray(value)) return [];
  const allowed = allowedValues(question);
  const accepted = [...new Set(value.filter(item => typeof item === "string" && allowed.has(item)))];
  if (accepted.includes("prefer_not_to_say")) return ["prefer_not_to_say"];
  return accepted.slice(0, question.options.length);
}

function normalizeSingle(question, value) {
  return typeof value === "string" && allowedValues(question).has(value) ? value : "";
}

function optionLabel(questionId, value) {
  return questionsById.get(questionId)?.options.find(option => option.value === value)?.label || "";
}

function multipleLabels(questionId, values) {
  return values
    .filter(value => value !== "prefer_not_to_say")
    .map(value => optionLabel(questionId, value))
    .filter(Boolean);
}

export function buildRouteIqRepresentativeStylePreview(input = {}) {
  const profile = {};
  for (const question of routeIqRepresentativeStyleQuestions) {
    profile[question.id] = question.mode === "multiple"
      ? normalizeMultiple(question, input[question.id])
      : normalizeSingle(question, input[question.id]);
  }

  const answeredCount = routeIqRepresentativeStyleQuestions.reduce((count, question) => {
    const value = profile[question.id];
    return count + (Array.isArray(value) ? Number(value.length > 0) : Number(Boolean(value)));
  }, 0);

  const languageLabels = multipleLabels("languages", profile.languages);
  const interestLabels = multipleLabels("interests", profile.interests);
  const signals = [
    {
      label: "Conversation context",
      value: optionLabel("conversationStyle", profile.conversationStyle) || "Not selected"
    },
    {
      label: "Field environment",
      value: optionLabel("fieldEnvironment", profile.fieldEnvironment) || "Not selected"
    },
    {
      label: "Timing hypothesis",
      value: optionLabel("energyWindow", profile.energyWindow) || "Not selected"
    },
    {
      label: "Language context",
      value: languageLabels.join(", ") || (profile.languages.includes("prefer_not_to_say") ? "Not used" : "Not selected")
    },
    {
      label: "Affinity context",
      value: interestLabels.join(", ") || (profile.interests.includes("prefer_not_to_say") ? "Not used" : "Not selected")
    },
    {
      label: "Conversation pace",
      value: optionLabel("conversationPace", profile.conversationPace) || "Not selected"
    }
  ];

  return Object.freeze({
    version: ROUTE_IQ_REPRESENTATIVE_STYLE_PREVIEW_VERSION,
    answeredCount,
    totalQuestions: routeIqRepresentativeStyleQuestions.length,
    complete: answeredCount === routeIqRepresentativeStyleQuestions.length,
    profile: Object.freeze(profile),
    signals: Object.freeze(signals.map(signal => Object.freeze(signal))),
    boundary: "Declared preferences start a hypothesis. Only authorized field evidence can confirm, challenge, or strengthen it before it may influence a recommendation."
  });
}
