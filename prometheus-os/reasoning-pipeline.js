import { rankDecisionTasks } from "./decision-engine.js";
import { createDailyBrief } from "./daily-brief.js";
import { addDaysToIsoDate, getPrometheusToday, normalizeText } from "./memory-ranking.js";

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

function periodTimeline(question, evidence) {
  const normalized = normalizeText(question);
  const timeline = findEvidence(evidence, (item) => item.type === "timeline-event");
  const today = getPrometheusToday();
  const yesterday = addDaysToIsoDate(today, -1);
  const weekStart = addDaysToIsoDate(today, -7);

  if (normalized.includes("yesterday")) return timeline.filter((item) => item.date === yesterday);
  if (normalized.includes("today")) return timeline.filter((item) => item.date === today);
  if (normalized.includes("this week") || normalized.includes("week")) {
    return timeline.filter((item) => item.date >= weekStart && item.date <= today);
  }
  return timeline;
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
  const timeline = periodTimeline(question, evidence);
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
      `Boss, yesterday was mainly about making Prometheus feel real as a company system, not just an app. ${sentenceList(timeline, 4)} The practical takeaway is that the public presence and Companion foundation moved forward, but validation is still the next proof point. Real beta usage matters more now than more polish.`,
      { intent: "yesterday_recap", entities: ["Prometheus Companion", "Website"] }
    );
  }

  if (normalized.includes("today")) {
    return response(
      "Today in Prometheus",
      `Boss, today the verified record points to Companion intelligence work, memory, and operating-system reliability. ${sentenceList(timeline, 6)} The important theme today is turning Prometheus from a command tool into a Chief of Staff: memory, context, safer routing, and better founder prioritization. The next useful move is to preserve the daily log and keep validation work ahead of new features.`,
      { intent: "today_recap", entities: ["Prometheus Companion", "Memory System", "Founder Operating System"] }
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
  const anthony = evidence.find((item) => {
    const title = normalizeText(item.title);
    return item.type === "knowledge-graph-entity" && title.includes("anthony");
  }) || evidence.find((item) => normalizeText(item.title).includes("anthony"));
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
    `Anthony is the controlled beta tester for Prometheus IQ. ${anthony?.summary || "His role is to validate a private rep-mode experience separate from Cruz founder data."} The key things to watch are route clarity, walk-in readiness, GPS verification, visit logging, route quality, and honest feedback.`,
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

function evidenceSummaryFor(evidence = [], label) {
  const normalizedLabel = normalizeText(label);
  return evidence.find((item) => {
    const haystack = normalizeText([item.title, item.summary, item.entities?.join(" ")].filter(Boolean).join(" "));
    return haystack.includes(normalizedLabel);
  });
}

function executiveReadinessAnswer(question, evidence = []) {
  const normalized = normalizeText(question);
  const pilotState = evidenceSummaryFor(evidence, "pilot readiness") || evidenceSummaryFor(evidence, "pilot");
  const executiveState = evidenceSummaryFor(evidence, "executive readiness") || evidenceSummaryFor(evidence, "leadership");
  const anthonyState = evidenceSummaryFor(evidence, "anthony");
  const llcState = evidenceSummaryFor(evidence, "llc");

  const audience = normalized.includes("larry") || normalized.includes("phil") || normalized.includes("dallas")
    ? "Larry, Phil, and Dallas leadership"
    : normalized.includes("chris")
      ? "Chris"
      : "leadership";

  const readinessEvidence = [
    executiveState ? `Executive materials: ${executiveState.summary}` : "Executive materials are recorded as prepared in Prometheus memory.",
    pilotState ? `Pilot package: ${pilotState.summary}` : "Pilot package readiness is recorded as high preparation, pending external proof.",
    anthonyState ? `Beta signal: ${anthonyState.summary}` : "Anthony beta remains the key proof source.",
    llcState ? `Company setup: ${llcState.summary}` : ""
  ].filter(Boolean).join(" ");

  return response(
    "Executive readiness",
    `Boss, Prometheus is ready for a serious ${audience} discussion, but not for an overcomplicated pitch. ${readinessEvidence} My read: preparation is strong, proof is still developing. The best executive wording is: Prometheus is requesting a controlled 14-day pilot with limited users, clear safeguards, weekly review, and a final results report. The part I would not oversell yet is guaranteed performance improvement, because Anthony's external beta data still needs to be captured. The next action is to keep the leadership ask simple and use real beta feedback as the proof layer.`,
    { intent: "executive_readiness", entities: ["Chris", "Larry", "Phil", "Dallas Leadership", "Pilot", "Anthony"], truth: "verified" }
  );
}

function googlePlacesVsMeta() {
  return response(
    "Google Places versus Meta",
    "Boss, Google Places is more important than Meta right now because it strengthens the core product: Route Intelligence. Better business discovery directly improves what reps see, where they go, and whether Anthony's route feels useful. Meta can help attention and social growth, but it does not prove the product works in the field. If I were ranking them as COO, Google Places supports validation; Meta supports distribution. Validation comes first.",
    { intent: "strategic_comparison", entities: ["Google Places", "Social Media", "Route Intelligence"] }
  );
}

function websiteAnswer() {
  return response(
    "Website context",
    "Boss, the website is PrometheusRouteIQ.com, and its job is credibility plus conversion: make Prometheus look serious, explain field-sales outcomes, and move interested people toward Request Pilot or View Demo. The important discipline is to keep it focused on outcomes, not internal mechanics. Website polish helps, but it should not outrank Anthony beta proof or leadership follow-up.",
    { intent: "website", entities: ["Website", "Pilot", "Social Media"], truth: "verified" }
  );
}

function githubAnswer() {
  return response(
    "GitHub context",
    "Boss, GitHub is the recovery path and company memory trail for Prometheus. The useful habit is simple: review changed files, keep secrets and generated clutter out, commit only clean milestones, and push after approval. GitHub does not create customer value by itself, but it protects every valuable thing Prometheus has built.",
    { intent: "github", entities: ["GitHub", "Disaster Recovery", "Founder Continuity"], truth: "verified" }
  );
}

function cloudflareAnswer() {
  return response(
    "Cloudflare context",
    "Boss, Cloudflare is the public deployment and protection layer for the website and protected app. The operating rule is stability first: do not change deployment behavior unless the build is tested and the correct production folder is clear. Cloudflare matters because leadership and beta users judge Prometheus through what is actually live, not what works locally.",
    { intent: "cloudflare", entities: ["Cloudflare", "Website", "Prometheus IQ"], truth: "verified" }
  );
}

function routeIntelligenceAnswer() {
  return response(
    "Route Intelligence context",
    "Boss, Route Intelligence is the core product value: helping reps know where to go next, why that stop matters, and how activity turns into learning. Google Places now gives better raw discovery, but Prometheus still has to judge quality. The next standard is not more locations; it is Anthony trusting the recommendations because every stop feels specific, walk-in ready, and worth the time.",
    { intent: "route_intelligence", entities: ["Route Intelligence", "Google Places", "Anthony"], truth: "verified" }
  );
}

function companionAnswer() {
  return response(
    "Companion context",
    "Boss, Prometheus Companion is the private Founder Operating System. Its value is not the visuals; it is preserving context, ranking what matters, and helping you make better decisions without rebuilding the same thinking every session. The next improvement should keep making it more accurate, more contextual, and less likely to over-answer.",
    { intent: "companion", entities: ["Prometheus Companion", "Founder Operating System"], truth: "verified" }
  );
}

function hasGoogleDiscoveryEvidence(evidence = []) {
  return evidence.some((item) => {
    const haystack = normalizeText([item.id, item.title, item.summary, ...(item.tags || [])].filter(Boolean).join(" "));
    return haystack.includes("google places") && (haystack.includes("discovery") || haystack.includes("249") || haystack.includes("202"));
  });
}

function googlePlacesStatus(evidence = []) {
  if (hasGoogleDiscoveryEvidence(evidence)) {
    return response(
      "Google Places status",
      "Boss, Google Places is no longer blocked at the basic local setup layer. The current verified company memory says Places and Geocoding are configured locally, discovery returned 249 businesses, and 202 were Anthony-ready after filtering. The remaining work is quality and release discipline: rank the best stops, explain why they matter, avoid restricted targets, and do not modify Anthony's production beta until the route quality passes review.",
      { intent: "google_places_status", entities: ["Google Places", "Route Intelligence", "Anthony"], truth: "verified" }
    );
  }

  return response(
    "Google Places status",
    "Boss, I do not have verified local discovery evidence in memory for Google Places yet. The safe architecture requires backend-only key storage, Places and Geocoding enabled, a local discovery run, and a security check before the data should influence Anthony's route. I will not pretend live Google business data exists until that evidence is recorded.",
    { intent: "google_places_status", entities: ["Google Places", "Route Intelligence"], truth: "unknown" }
  );
}

function riskAnswer(evidence) {
  return response(
    "Biggest Prometheus risk",
    "The biggest risk today is confusing internal progress with external validation. A better Companion, a better website, and cleaner documents all help, but they do not prove reps will use Prometheus or that leadership will approve a pilot. The thing slowing Prometheus down is the same gap: real beta evidence. The next move is to capture Anthony feedback, route quality notes, objections, and verified usage before building more.",
    { intent: "risk", entities: ["Pilot", "Anthony", "Prometheus IQ"] }
  );
}

function pilotReadinessAnswer() {
  return response(
    "Pilot readiness",
    "Boss, pilot readiness is high on preparation but not complete on proof. The approval packet, executive materials, risk controls, success metrics, and pilot structure are ready. The missing piece is external proof: Anthony feedback, verified visits, route-quality evidence, and leadership confirmation. That is why the next move is validation, not adding more internal features.",
    { intent: "pilot_readiness", entities: ["Pilot", "Anthony", "Chris"], truth: "verified" }
  );
}

function unknownOperationalMetricAnswer(question) {
  const normalized = normalizeText(question);
  if ((normalized.includes("cost") || normalized.includes("spend") || normalized.includes("spending") || normalized.includes("billing") || normalized.includes("usage")) &&
      (normalized.includes("google") || normalized.includes("maps") || normalized.includes("places") || normalized.includes("api"))) {
    return response(
      "Google cost data unavailable",
      "Boss, I do not have verified Google Cloud billing or API usage data in Prometheus memory right now. I can confirm Google Places discovery was configured locally, but I cannot honestly say what it cost today unless billing or usage data is connected or manually recorded. The safe next move is to check Google Cloud Billing directly and then record the verified number in the daily log.",
      { intent: "unknown_google_billing", entities: ["Google Places", "Google Cloud"], truth: "unknown" }
    );
  }

  if ((normalized.includes("instagram") || normalized.includes("social") || normalized.includes("meta")) &&
      (normalized.includes("views") || normalized.includes("reach") || normalized.includes("impressions") || normalized.includes("followers") || normalized.includes("comments") || normalized.includes("likes"))) {
    return response(
      "Social media metrics unavailable",
      "Boss, I do not have verified Instagram performance data connected yet. The Meta setup was paused, so I cannot truthfully report views, reach, followers, comments, or likes from live data. I can still help plan the post or create a manual tracker, but I should not pretend the metrics are connected.",
      { intent: "unknown_social_metrics", entities: ["Instagram", "Meta", "Social Media"], truth: "unknown" }
    );
  }

  return null;
}

function priorityAnswer(question) {
  const ranked = rankDecisionTasks();
  const top = ranked.slice(0, 3);
  const normalized = normalizeText(question);
  const tomorrow = normalized.includes("tomorrow") || normalized.includes("coo");
  const intro = tomorrow
    ? "If I were your COO, I would tell you tomorrow is not a feature-building day. It is a validation day."
    : "I would not work on another feature first. The highest ROI move is validation.";
  return response(
    tomorrow ? "COO recommendation for tomorrow" : "Highest ROI next move",
    `${intro} First: ${top[0].title}. ${top[0].reason} Second: ${top[1].title}. ${top[1].reason} Third: ${top[2].title}. ${top[2].reason} The recommendation is clear: protect focus, collect proof, and avoid new features unless they directly improve Anthony's beta evidence or leadership approval odds.`,
    { intent: "priority", entities: ["Cruz", "Pilot", "Anthony"] }
  );
}

function dailyBriefAnswer() {
  return response(
    "Daily Founder Brief",
    createDailyBrief().body,
    { intent: "founder_brief", entities: ["Cruz", "Prometheus Companion", "Pilot", "Anthony"], truth: "verified" }
  );
}

function previousAnswerText(context = {}) {
  return normalizeText([context.lastTitle, context.lastBody, context.lastCognitiveIntent, ...(context.focusEntities || [])].filter(Boolean).join(" "));
}

function whyPreviousAnswerMatters(context = {}, evidence = []) {
  const previous = previousAnswerText(context);
  const title = context.lastTitle || "the last answer";
  const previousIntent = context.lastCognitiveIntent || "";

  if (previousIntent === "priority" || previous.includes("highest roi") || previous.includes("next move") || previous.includes("priority") || previous.includes("coo")) {
    return response(
      "Why that is the highest ROI move",
      "Boss, it is the highest ROI move because it converts the work already completed into validation evidence. Prometheus has product, website, Companion, documents, route intelligence, and deployment progress. The bottleneck is not effort. The bottleneck is proof. Anthony beta feedback, verified route-quality evidence, and leadership clarity compound more than another isolated improvement.",
      { intent: "follow_up_reasoning", entities: ["Pilot", "Validation", "Founder Leverage"], follows: previousIntent || title }
    );
  }

  if (previous.includes("google places")) {
    return response(
      "Why Google Places matters now",
      "Boss, Google Places matters because it is tied directly to route quality, and route quality is what Anthony will judge first. The API setup itself is useful, but it is not the win. The win is turning verified business discovery into stops that feel obvious, walk-in ready, and worth his time. That is why quality control beats adding another feature right now.",
      { intent: "follow_up_reasoning", entities: ["Google Places", "Route Intelligence", "Anthony"], follows: previousIntent || title }
    );
  }

  if (previous.includes("anthony")) {
    return response(
      "Why Anthony matters",
      "Boss, Anthony matters because he is the first meaningful validation test of whether Prometheus works outside your own head and habits. If his route feels useful, his visits are easy to log, and his feedback is specific, Prometheus starts collecting proof instead of opinions. That proof is what strengthens the Chris and Dallas leadership conversation.",
      { intent: "follow_up_reasoning", entities: ["Anthony", "Pilot", "Route Intelligence"], follows: previousIntent || title }
    );
  }

  if (previous.includes("chris") || previous.includes("leadership")) {
    return response(
      "Why leadership context matters",
      "Boss, Chris matters because he is the bridge between founder excitement and executive permission. The leadership conversation has to stay simple: controlled pilot, limited users, clear safeguards, measurable outcome, and no proprietary mechanics exposed. If that message stays clean, Prometheus feels lower risk and easier to approve.",
      { intent: "follow_up_reasoning", entities: ["Chris", "Pilot", "Leadership"], follows: previousIntent || title }
    );
  }

  if (previous.includes("risk") || previous.includes("blocker")) {
    return response(
      "Why that risk matters",
      "Boss, that risk matters because Prometheus can keep getting more polished without getting more proven. The company does not need more internal evidence that you can build. It needs external evidence that someone else can use it, trust it, and get value from it. That is why real beta feedback outranks cosmetic polish.",
      { intent: "follow_up_reasoning", entities: ["Pilot", "Anthony", "Validation"], follows: previousIntent || title }
    );
  }

  if (previous.includes("yesterday") || previous.includes("today") || previous.includes("week") || previous.includes("recap")) {
    return response(
      "Why that progress matters",
      `Boss, ${title} matters because it shows Prometheus is moving from scattered building into an operating company rhythm: memory, route quality, validation, backup discipline, and founder continuity. The value is not any one artifact. The value is that Prometheus is becoming easier to run, easier to explain, and easier to test with real users.`,
      { intent: "follow_up_reasoning", entities: context.focusEntities || ["Prometheus Companion", "Founder Operating System"], follows: previousIntent || title }
    );
  }

  return response(
    "Why that matters",
    `Boss, ${title} matters because it connects back to the central company test: can Prometheus create verified field-sales value outside the founder's own usage? If the answer produces usage, feedback, visits, objections, or leadership clarity, it moves the company forward. If it only makes the system feel more polished, it is lower priority right now.`,
    { intent: "follow_up_reasoning", entities: context.focusEntities || [], follows: previousIntent || title }
  );
}

function focusedFollowUpAnswer(question, context, evidence) {
  const normalized = normalizeText(question);
  const previous = previousAnswerText(context);

  if (normalized.includes("anthony") || (normalized === "what about anthony" && !previous.includes("anthony"))) {
    return anthonyAnswer(question, evidence);
  }

  if (normalized.includes("chris") || normalized.includes("leadership")) {
    return chrisAnswer(evidence);
  }

  if (normalized.includes("google places")) {
    return googlePlacesStatus(evidence);
  }

  if (normalized.includes("website")) return websiteAnswer();
  if (normalized.includes("github") || normalized.includes("git hub")) return githubAnswer();
  if (normalized.includes("cloudflare")) return cloudflareAnswer();
  if (normalized.includes("route intelligence")) return routeIntelligenceAnswer();
  if (normalized.includes("companion")) return companionAnswer();

  return response(
    "Follow-up context",
    `Boss, staying with the same thread: ${sentenceList(evidence, 3)} The practical move is to keep the conversation tied to validation and avoid turning it into another isolated dashboard check.`,
    { intent: "follow_up", entities: context.focusEntities || [] }
  );
}

function followUpAnswer(question, context, evidence) {
  const normalized = normalizeText(question);
  if (normalized === "why" || normalized.startsWith("why")) {
    return whyPreviousAnswerMatters(context, evidence);
  }
  return focusedFollowUpAnswer(question, context, evidence);
}

function generalAnswer(question, evidence) {
  const normalized = normalizeText(question);
  if (normalized.includes("rundown") || normalized.includes("where are we") || normalized.includes("where we at") || normalized.includes("how are we doing") || normalized.includes("how are we looking") || normalized.includes("where do we stand")) {
    return response(
      "Prometheus rundown",
      `We are in a strong build position, but not yet a strong proof position. The product foundation exists, the website is live, Companion has memory and reasoning, and Route Intelligence is moving from setup into quality control. The important question is no longer whether Prometheus can look impressive. It is whether Anthony and leadership can see proof that it improves field-sales activity. Recommendation: protect focus, test route quality, collect beta feedback, and keep every decision tied to validation.`,
      { intent: "company_rundown", entities: ["Prometheus IQ", "Prometheus Companion", "Anthony", "Route Intelligence"] }
    );
  }

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
  const unknownMetricResponse = unknownOperationalMetricAnswer(question);
  if (unknownMetricResponse) return unknownMetricResponse;

  if (normalized.includes("anthony")) return anthonyAnswer(question, rankedEvidence);
  if (
    normalized.includes("executive") ||
    normalized.includes("leadership") ||
    normalized.includes("larry") ||
    normalized.includes("phil") ||
    normalized.includes("dallas") ||
    normalized.includes("pilot approval") ||
    (normalized.includes("chris") && (normalized.includes("ready") || normalized.includes("readiness") || normalized.includes("status") || normalized.includes("tell") || normalized.includes("ask")))
  ) return executiveReadinessAnswer(question, rankedEvidence);
  if (normalized.includes("chris")) return chrisAnswer(rankedEvidence);
  if (normalized.includes("google places") && (normalized.includes("meta") || normalized.includes("more important"))) return googlePlacesVsMeta();
  if (normalized.includes("google places")) return googlePlacesStatus(rankedEvidence);
  if (normalized.includes("website")) return websiteAnswer();
  if (normalized.includes("github") || normalized.includes("git hub")) return githubAnswer();
  if (normalized.includes("cloudflare")) return cloudflareAnswer();
  if (normalized.includes("route intelligence")) return routeIntelligenceAnswer();
  if (normalized.includes("companion")) return companionAnswer();
  if (normalized.includes("pilot readiness")) return pilotReadinessAnswer();
  if (normalized.includes("risk") || normalized.includes("blocker") || normalized.includes("slowing") || normalized.includes("bottleneck")) return riskAnswer(rankedEvidence);
  if (normalized.includes("daily brief") || normalized.includes("founder brief") || normalized === "brief" || normalized.includes("give me the brief")) return dailyBriefAnswer();
  if (normalized.includes("what should") || normalized.includes("highest roi") || normalized.includes("what matters") || normalized.includes("focus on") || normalized.includes("coo") || normalized.includes("tomorrow")) return priorityAnswer(question);
  if (context.isFollowUp) return followUpAnswer(question, context, rankedEvidence);
  if (normalized.includes("what happened") || normalized.includes("what changed") || normalized.includes("this week") || normalized.includes("yesterday") || normalized.includes("today") || normalized.includes("last month")) return recapPeriod(question, rankedEvidence);
  if (normalized.includes("major systems") || normalized.includes("systems have been built")) return majorSystems(rankedEvidence);

  return generalAnswer(question, rankedEvidence, llmContext);
}
