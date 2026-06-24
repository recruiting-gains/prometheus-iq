import { rankDecisionTasks } from "./decision-engine.js";
import { normalizeText } from "./memory-ranking.js";

function sentenceList(items, limit = 5) {
  return items.slice(0, limit).map((item) => {
    const date = item.date ? `${item.date}: ` : "";
    const impact = item.impact ? ` Impact: ${item.impact}` : "";
    return `${date}${item.title}. ${item.summary}${impact}`;
  }).join(" ");
}

function findEvidence(evidence, predicate) {
  return evidence.filter(predicate);
}

function response(title, body, metadata = {}) {
  return {
    title,
    body,
    permission: "Level 0 - Read Only",
    tone: "chief-of-staff",
    metadata: {
      orchestrator: true,
      cognitive: true,
      cardFallbackUsed: false,
      ...metadata
    }
  };
}

function recapPeriod(question, evidence) {
  const normalized = normalizeText(question);
  const timeline = findEvidence(evidence, (item) => item.type === "timeline-event");
  if (!timeline.length) {
    return response(
      "Prometheus company recap",
      "Boss, I do not have a verified timeline event for that period yet. I can only answer from the local Prometheus memory that has been recorded, and I will not invent progress that is not in the record.",
      { intent: "recap", truth: "unknown" }
    );
  }

  if (normalized.includes("yesterday")) {
    return response(
      "Yesterday in Prometheus",
      `Boss, yesterday was mainly about making Prometheus feel real as a company system, not just an app. ${sentenceList(timeline, 4)} The practical takeaway is that the public presence and Companion foundation moved forward, but the next proof still has to come from real beta usage, not more polish.`,
      { intent: "yesterday_recap", entities: ["Prometheus Companion", "Website"] }
    );
  }

  if (normalized.includes("week")) {
    return response(
      "This week in Prometheus",
      `Boss, this week Prometheus moved across four fronts: product readiness, executive readiness, public presence, and founder operating systems. ${sentenceList(timeline, 7)} The pattern is clear: the build is becoming more serious, but validation is now the lever that matters most.`,
      { intent: "weekly_recap", entities: ["Prometheus IQ", "Pilot", "Prometheus Companion"] }
    );
  }

  if (normalized.includes("last month") || normalized.includes("over the last month")) {
    return response(
      "Prometheus over the last month",
      `Boss, over the recorded company history Prometheus changed from a founder-built field-sales tool into a broader operating system: protected app, Route Intelligence, GPS verification, executive pilot materials, public website, Companion voice, memory, and now cognitive reasoning. ${sentenceList(timeline, 8)} The biggest shift is maturity: Prometheus is no longer only a product idea; it has product, pitch, beta, website, security, and operating systems forming around it.`,
      { intent: "month_recap", entities: ["Prometheus IQ", "Prometheus Companion", "Pilot"] }
    );
  }

  return response(
    "Prometheus timeline",
    `Boss, here is the verified timeline signal I have: ${sentenceList(timeline, 6)}`,
    { intent: "timeline" }
  );
}

function majorSystems(evidence) {
  const systems = [
    "Prometheus IQ field-sales app with Route Intelligence, GPS verification, visit logging, rep and owner modes.",
    "Cloudflare deployment and protection for the live app and public web presence.",
    "GitHub source-control and backup workflow.",
    "Executive pilot system: briefing packet, approval package, success metrics, risk controls, data ownership, and pilot execution playbook.",
    "Cinematic public website at PrometheusRouteIQ.com.",
    "Prometheus Companion: local Mac assistant, premium voice path, daily Chief of Staff modules, memory system, and reasoning layer.",
    "Route Intelligence evolution: qualified prospect filtering, rep-specific profiles, Anthony separation, freshness, discovery, and category diversity."
  ];
  return response(
    "Major Prometheus systems built",
    `Boss, the major systems built so far are: ${systems.join(" ")} The most important one for company value is still Route Intelligence plus verified field activity, because that is what can become pilot proof. The most important one for founder leverage is Companion, because it preserves context and helps you operate the company.`,
    { intent: "major_systems", entities: ["Prometheus IQ", "Prometheus Companion", "Route Intelligence", "Pilot"], evidenceCount: evidence.length }
  );
}

function anthonyAnswer(question, evidence) {
  const normalized = normalizeText(question);
  const anthony = evidence.find((item) => normalizeText(item.title).includes("anthony") || (item.entities || []).includes("Anthony"));
  if (normalized.includes("how many") && normalized.includes("visit")) {
    return response(
      "Anthony visit data",
      "Boss, I do not have verified visit data for Anthony today. That means I cannot honestly say how many businesses he visited. To answer that correctly, Anthony needs to log visits in the beta flow or send feedback that gets recorded into Prometheus memory.",
      { intent: "anthony_visit_count", entities: ["Anthony"], truth: "unknown" }
    );
  }
  if (normalized.includes("why")) {
    return response(
      "Why Anthony matters",
      "Anthony matters because he is the first real separation between founder usage and outside-user validation. If Anthony can open his own rep experience, understand where to go, log visits, and give feedback without seeing Cruz's history, Prometheus starts proving it can work beyond the founder. That is the bridge from a built product to credible pilot evidence.",
      { intent: "anthony_importance", entities: ["Anthony", "Pilot", "Route Intelligence"] }
    );
  }
  return response(
    "Anthony in Prometheus",
    `Anthony is the controlled beta tester for Prometheus IQ. ${anthony?.summary || "His role is to validate a private rep-mode experience separate from Cruz founder data."} The key things to watch are route clarity, walk-in readiness, GPS verification, visit logging, and honest feedback.`,
    { intent: "anthony", entities: ["Anthony"] }
  );
}

function chrisAnswer(evidence) {
  return response(
    "Chris and leadership context",
    "Chris is the Houston leadership contact who may help Prometheus reach Dallas leadership. The right move with Chris is not to overwhelm him with technology. Keep the ask simple: a controlled 14-day pilot, three approved users, risk controls, weekly review, final report, and no proprietary mechanics disclosed unless an NDA and approval path are in place.",
    { intent: "chris", entities: ["Chris", "Pilot"] }
  );
}

function googlePlacesVsMeta() {
  return response(
    "Google Places versus Meta",
    "Boss, Google Places is more important than Meta right now because it strengthens the core product: Route Intelligence. Better business discovery directly improves what reps see, where they go, and whether Anthony's route feels useful. Meta can help attention and social growth, but it does not prove the product works in the field. If I were ranking them as COO, Google Places supports validation; Meta supports distribution. Validation comes first.",
    { intent: "strategic_comparison", entities: ["Google Places", "Social Media", "Route Intelligence"] }
  );
}

function googlePlacesBlocked() {
  return response(
    "Google Places blocker",
    "Boss, Google Places is blocked only at the live-integration layer. The safe architecture is prepared, but real discovery requires valid local Google API credentials, backend-only storage, and explicit approval before touching production or Anthony's live beta. Until that is configured and verified, Prometheus should not pretend it has live Google business data.",
    { intent: "google_places_blocked", entities: ["Google Places", "Route Intelligence"], truth: "verified" }
  );
}

function riskAnswer(evidence) {
  return response(
    "Biggest Prometheus risk",
    "Boss, the biggest risk today is confusing internal progress with external validation. A better Companion, a better website, and cleaner documents all help, but they do not prove reps will use Prometheus or that leadership will approve a pilot. The risk-reduction move is simple: capture real beta feedback, verified visits, route quality notes, and any objections from Anthony or leadership.",
    { intent: "risk", entities: ["Pilot", "Anthony", "Prometheus IQ"] }
  );
}

function priorityAnswer(question) {
  const ranked = rankDecisionTasks();
  const top = ranked.slice(0, 3);
  const normalized = normalizeText(question);
  const tomorrow = normalized.includes("tomorrow") || normalized.includes("coo");
  const intro = tomorrow
    ? "If I were your COO, I would tell you tomorrow is not a feature-building day. It is a validation day."
    : "Boss, the highest ROI move is validation, not another feature.";
  return response(
    tomorrow ? "COO recommendation for tomorrow" : "Highest ROI next move",
    `${intro} Top three: ${top.map((task, index) => `${index + 1}. ${task.title}: ${task.description} Why: ${task.reason}`).join(" ")} The first move is ${top[0].title}, because it turns Prometheus from something impressive into something proven.`,
    { intent: "priority", entities: ["Cruz", "Pilot", "Anthony"] }
  );
}

function followUpAnswer(question, context, evidence) {
  const normalized = normalizeText(question);
  if (normalized === "why" || normalized.startsWith("why")) {
    return response(
      "Why that matters",
      `Boss, the reason is that ${context.lastTitle || "the last answer"} connects directly to pilot proof. Prometheus has built a lot of infrastructure, but the company only gets stronger when the next action produces evidence: usage, feedback, visits, objections, or leadership clarity.`,
      { intent: "follow_up", entities: context.focusEntities || [] }
    );
  }
  return response(
    "Follow-up context",
    `Boss, staying with the same thread: ${sentenceList(evidence, 3)} The practical move is to keep the conversation tied to validation and avoid turning it into another isolated dashboard check.`,
    { intent: "follow_up", entities: context.focusEntities || [] }
  );
}

function generalAnswer(question, evidence) {
  if (!evidence.length) {
    return response(
      "Prometheus answer",
      "Boss, I do not have enough verified Prometheus memory to answer that cleanly yet. I can reason from company context, but I will not invent facts. Ask me what changed, what matters, what is blocked, or what to do next.",
      { intent: "general", truth: "unknown" }
    );
  }
  return response(
    "Prometheus intelligence brief",
    `Boss, here is the strongest signal I found: ${sentenceList(evidence, 4)} My read is that the next answer should be grounded in validation, pilot readiness, and preserving clean company memory.`,
    { intent: "general" }
  );
}

export function runReasoningPipeline({ question = "", context = {}, rankedEvidence = [], llmContext = {} } = {}) {
  const normalized = normalizeText(question);

  if (context.isFollowUp) return followUpAnswer(question, context, rankedEvidence);
  if (normalized.includes("what happened") || normalized.includes("what changed") || normalized.includes("this week") || normalized.includes("yesterday") || normalized.includes("last month")) return recapPeriod(question, rankedEvidence);
  if (normalized.includes("major systems") || normalized.includes("systems have been built")) return majorSystems(rankedEvidence);
  if (normalized.includes("anthony")) return anthonyAnswer(question, rankedEvidence);
  if (normalized.includes("chris")) return chrisAnswer(rankedEvidence);
  if (normalized.includes("google places") && (normalized.includes("meta") || normalized.includes("more important"))) return googlePlacesVsMeta();
  if (normalized.includes("google places") && (normalized.includes("blocked") || normalized.includes("blocker") || normalized.includes("why"))) return googlePlacesBlocked();
  if (normalized.includes("risk") || normalized.includes("blocker")) return riskAnswer(rankedEvidence);
  if (normalized.includes("what should") || normalized.includes("highest roi") || normalized.includes("what matters") || normalized.includes("coo") || normalized.includes("tomorrow")) return priorityAnswer(question);

  return generalAnswer(question, rankedEvidence, llmContext);
}
