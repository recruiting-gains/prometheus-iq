const STORAGE_PREFIX = "prometheus-companion-conversation-calibration-v1";
const DEFAULT_SCOPE = "founder-companion-local";
const MAX_SIGNALS = 200;
const MAX_REVIEWS = 45;

const allowedSignalCategories = new Set([
  "explicit_founder_correction",
  "explicit_tone_or_length_preference",
  "repeated_clarification_request",
  "evidence_or_certainty_complaint",
  "accepted_recommendation",
  "rejected_recommendation",
  "avoidable_repetition_or_confusion"
]);

const allowedPreferences = Object.freeze({
  responseLength: new Set(["standard", "concise"]),
  tone: new Set(["neutral", "warmer"]),
  responseStructure: new Set(["answer-first", "standard"]),
  clarificationStyle: new Set(["single-concise-question", "standard"]),
  evidenceFraming: new Set(["explicit", "adaptive"]),
  repetition: new Set(["avoid", "standard"]),
  recommendationFraming: new Set(["concern-evidence-alternative", "standard"])
});

const inferredAdjustments = Object.freeze({
  repeated_clarification_request: ["clarificationStyle", "single-concise-question"],
  evidence_or_certainty_complaint: ["evidenceFraming", "explicit"],
  rejected_recommendation: ["recommendationFraming", "concern-evidence-alternative"],
  avoidable_repetition_or_confusion: ["responseStructure", "answer-first"]
});

const memoryValues = new Map();

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘']/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDateKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function cleanScope(value = DEFAULT_SCOPE) {
  const scope = String(value || DEFAULT_SCOPE).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return scope.slice(0, 80) || DEFAULT_SCOPE;
}

function defaultState(scope) {
  return {
    schemaVersion: 1,
    scope,
    preferences: {},
    signals: [],
    reviews: [],
    currentAdjustment: null,
    lastReviewDate: "",
    lastResetAt: null
  };
}

function safePreference(key, entry) {
  if (!allowedPreferences[key] || !entry || !allowedPreferences[key].has(entry.value)) return null;
  return {
    value: entry.value,
    source: entry.source === "explicit" ? "explicit" : "daily-review",
    confidence: Math.max(0, Math.min(1, Number(entry.confidence) || 0)),
    updatedAt: String(entry.updatedAt || "").slice(0, 40)
  };
}

function safeSignal(signal) {
  if (!signal || !allowedSignalCategories.has(signal.category)) return null;
  const preferenceKey = allowedPreferences[signal.preferenceKey] ? signal.preferenceKey : null;
  const preferenceValue = preferenceKey && allowedPreferences[preferenceKey].has(signal.preferenceValue)
    ? signal.preferenceValue
    : null;
  return {
    id: String(signal.id || "").slice(0, 100),
    interactionId: String(signal.interactionId || "").slice(0, 100),
    date: String(signal.date || "").slice(0, 10),
    timestamp: String(signal.timestamp || "").slice(0, 40),
    category: signal.category,
    explicit: signal.explicit === true,
    preferenceKey,
    preferenceValue,
    confidence: Math.max(0, Math.min(1, Number(signal.confidence) || 0))
  };
}

function safeAdjustment(adjustment) {
  if (!adjustment || !allowedPreferences[adjustment.key]?.has(adjustment.value)) return null;
  return {
    key: adjustment.key,
    value: adjustment.value,
    reason: String(adjustment.reason || "").slice(0, 240),
    supportingSignalIds: Array.isArray(adjustment.supportingSignalIds)
      ? adjustment.supportingSignalIds.map((id) => String(id).slice(0, 100)).slice(0, 12)
      : [],
    confidence: Math.max(0, Math.min(1, Number(adjustment.confidence) || 0)),
    date: String(adjustment.date || "").slice(0, 10)
  };
}

function safeReview(review) {
  if (!review) return null;
  const counts = {};
  for (const category of allowedSignalCategories) {
    const count = Number(review.signalCounts?.[category] || 0);
    if (count > 0) counts[category] = Math.min(200, Math.floor(count));
  }
  return {
    date: String(review.date || "").slice(0, 10),
    reviewedDate: String(review.reviewedDate || "").slice(0, 10),
    whatWorked: Array.isArray(review.whatWorked)
      ? review.whatWorked.map((item) => String(item).slice(0, 160)).slice(0, 3)
      : [],
    friction: Array.isArray(review.friction)
      ? review.friction.map((item) => String(item).slice(0, 160)).slice(0, 3)
      : [],
    signalCounts: counts,
    adjustment: safeAdjustment(review.adjustment)
  };
}

function sanitizeState(value, scope) {
  const state = defaultState(scope);
  if (!value || value.schemaVersion !== 1 || value.scope !== scope) return state;

  for (const [key, entry] of Object.entries(value.preferences || {})) {
    const safe = safePreference(key, entry);
    if (safe) state.preferences[key] = safe;
  }

  state.signals = Array.isArray(value.signals)
    ? value.signals.map(safeSignal).filter(Boolean).slice(-MAX_SIGNALS)
    : [];
  state.reviews = Array.isArray(value.reviews)
    ? value.reviews.map(safeReview).filter(Boolean).slice(0, MAX_REVIEWS)
    : [];
  state.currentAdjustment = safeAdjustment(value.currentAdjustment);
  state.lastReviewDate = String(value.lastReviewDate || "").slice(0, 10);
  state.lastResetAt = value.lastResetAt ? String(value.lastResetAt).slice(0, 40) : null;
  return state;
}

function browserStorage() {
  if (
    typeof window !== "undefined" &&
    window.localStorage &&
    typeof window.localStorage.getItem === "function"
  ) {
    return window.localStorage;
  }
  return {
    getItem(key) {
      return memoryValues.get(key) || null;
    },
    setItem(key, value) {
      memoryValues.set(key, String(value));
    },
    removeItem(key) {
      memoryValues.delete(key);
    }
  };
}

export function createMemoryCalibrationStorage(seed = null) {
  const values = new Map();
  if (seed && typeof seed === "object") {
    for (const [key, value] of Object.entries(seed)) values.set(key, String(value));
  }
  return {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values.entries());
    }
  };
}

function calibrationResponse(title, body, intent) {
  return {
    title,
    body,
    permission: "Level 0 - Read Only",
    tone: "founder-neutral",
    metadata: {
      founderAssistant: true,
      conversationCalibration: true,
      routeSelected: "conversation_calibration",
      intent,
      cardFallbackUsed: false,
      showCard: false,
      spokenText: body
    }
  };
}

function neutralizePraise(value = "") {
  let text = String(value || "").trim();
  text = text.replace(/^(excellent|perfect|outstanding|amazing|great news)\b[.!,:;\s-]*/i, "");
  text = text.replace(/\bthis is exactly what we wanted\b/gi, "this matches the stated requirement");
  text = text.replace(/\bmajor milestone\b/gi, "verified change");
  text = text.replace(/\bgame[- ]changing\b/gi, "material");
  text = text.replace(/\s+/g, " ").trim();
  return text || "Noted.";
}

function requestsDetail(input = "") {
  const normalized = normalizeText(input);
  return /\b(detail|detailed|explain|analysis|full|complete|walk me through|why)\b/.test(normalized);
}

function conciseText(value = "") {
  const text = String(value || "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 70) return text;
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const selected = [];
  let count = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean).length;
    if (selected.length >= 3 || (selected.length > 0 && count + sentenceWords > 70)) break;
    selected.push(sentence.trim());
    count += sentenceWords;
  }
  return selected.join(" ").trim() || words.slice(0, 70).join(" ");
}

function recommendationDisagreement(normalized = "") {
  const mentionsPausedProduct = /\b(gaia|athena)\b/.test(normalized);
  const proposesExpansion = /\b(build|resume|restart|expand|prioritize|focus on|ship|launch)\b/.test(normalized);
  const proposal = /\b(i think|i want|we should|i should|let's|lets|let us)\b/.test(normalized);
  return mentionsPausedProduct && proposesExpansion && proposal;
}

function completedResult(normalized = "") {
  return /^(the |that |it |verification |build |change )?.*\b(passed|completed|finished|succeeded|is done)\b/.test(normalized) &&
    !/\b(did|has|was|is it|are you|whether)\b/.test(normalized.slice(0, 24));
}

export class ConversationCalibration {
  constructor({
    storage = browserStorage(),
    now = () => new Date(),
    scope = DEFAULT_SCOPE
  } = {}) {
    this.storage = storage;
    this.now = now;
    this.scope = cleanScope(scope);
    this.storageKey = `${STORAGE_PREFIX}:${this.scope}`;
    this.sequence = 0;
    this.state = this.readState();
    this.runDailyReviewIfNeeded();
  }

  readState() {
    try {
      const raw = this.storage.getItem(this.storageKey);
      return sanitizeState(raw ? JSON.parse(raw) : null, this.scope);
    } catch {
      return defaultState(this.scope);
    }
  }

  persist() {
    this.state = sanitizeState(this.state, this.scope);
    this.storage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  timestamp() {
    return this.now().toISOString();
  }

  interactionId() {
    this.sequence += 1;
    return `${this.timestamp()}:${this.sequence}`;
  }

  recordSignal({
    category,
    explicit = false,
    preferenceKey = null,
    preferenceValue = null,
    confidence = 0.7,
    interactionId
  }) {
    if (!allowedSignalCategories.has(category)) return null;
    const timestamp = this.timestamp();
    const signal = safeSignal({
      id: `${timestamp}:${this.state.signals.length + 1}`,
      interactionId,
      date: localDateKey(this.now()),
      timestamp,
      category,
      explicit,
      preferenceKey,
      preferenceValue,
      confidence
    });
    if (!signal) return null;
    this.state.signals = [...this.state.signals, signal].slice(-MAX_SIGNALS);
    return signal;
  }

  setPreference(key, value, { source = "explicit", confidence = 1 } = {}) {
    if (!allowedPreferences[key]?.has(value)) return false;
    this.state.preferences[key] = {
      value,
      source: source === "explicit" ? "explicit" : "daily-review",
      confidence,
      updatedAt: this.timestamp()
    };
    return true;
  }

  reset() {
    const resetAt = this.timestamp();
    this.storage.removeItem(this.storageKey);
    this.state = defaultState(this.scope);
    this.state.lastResetAt = resetAt;
    this.state.lastReviewDate = localDateKey(this.now());
    this.persist();
  }

  rejectCurrentAdjustment() {
    const adjustment = this.state.currentAdjustment;
    if (!adjustment) return false;
    const preference = this.state.preferences[adjustment.key];
    if (preference?.source === "daily-review" && preference.value === adjustment.value) {
      delete this.state.preferences[adjustment.key];
    }
    this.state.currentAdjustment = null;
    this.persist();
    return true;
  }

  runDailyReviewIfNeeded({ force = false } = {}) {
    const today = localDateKey(this.now());
    if (!force && this.state.lastReviewDate === today) {
      return this.state.reviews.find((review) => review.date === today) || null;
    }

    const reviewedDate = previousDateKey(this.now());
    const signals = this.state.signals.filter((signal) => signal.date === reviewedDate);
    const signalCounts = {};
    for (const signal of signals) {
      signalCounts[signal.category] = (signalCounts[signal.category] || 0) + 1;
    }

    const whatWorked = signalCounts.accepted_recommendation
      ? [`${signalCounts.accepted_recommendation} recommendation response(s) were explicitly accepted.`]
      : [];
    const friction = Object.entries(signalCounts)
      .filter(([category]) => category !== "accepted_recommendation")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => `${count} ${category.replace(/_/g, " ")} signal(s).`);

    const candidateGroups = new Map();
    for (const signal of signals) {
      if (signal.explicit || !signal.preferenceKey || !signal.preferenceValue) continue;
      const key = `${signal.preferenceKey}:${signal.preferenceValue}`;
      const group = candidateGroups.get(key) || {
        key: signal.preferenceKey,
        value: signal.preferenceValue,
        signals: [],
        interactions: new Set()
      };
      group.signals.push(signal);
      group.interactions.add(signal.interactionId);
      candidateGroups.set(key, group);
    }

    const candidate = [...candidateGroups.values()]
      .filter((group) => group.interactions.size >= 3)
      .sort((a, b) => b.interactions.size - a.interactions.size)[0];
    let adjustment = null;
    if (candidate) {
      adjustment = {
        key: candidate.key,
        value: candidate.value,
        reason: `${candidate.interactions.size} separate calibration interactions supported this communication adjustment.`,
        supportingSignalIds: candidate.signals.map((signal) => signal.id).slice(0, 12),
        confidence: Math.min(0.95, 0.55 + candidate.interactions.size * 0.1),
        date: today
      };
      this.setPreference(adjustment.key, adjustment.value, {
        source: "daily-review",
        confidence: adjustment.confidence
      });
    }

    const review = {
      date: today,
      reviewedDate,
      whatWorked,
      friction,
      signalCounts,
      adjustment
    };
    this.state.reviews = [
      review,
      ...this.state.reviews.filter((item) => item.date !== today)
    ].slice(0, MAX_REVIEWS);
    this.state.currentAdjustment = adjustment;
    this.state.lastReviewDate = today;
    this.persist();
    return review;
  }

  learnedYesterdayResponse() {
    const yesterday = previousDateKey(this.now());
    const review = this.state.reviews.find((item) => item.reviewedDate === yesterday);
    if (!review?.adjustment) {
      return calibrationResponse(
        "Conversation Calibration",
        "Yesterday's review found no repeated communication pattern strong enough to change the default. No company, customer, workspace, product, or engineering facts were learned.",
        "calibration_learning_report"
      );
    }
    return calibrationResponse(
      "Conversation Calibration",
      `Yesterday's review made one communication adjustment: ${review.adjustment.key} is now ${review.adjustment.value}. Reason: ${review.adjustment.reason} Confidence: ${Math.round(review.adjustment.confidence * 100)} percent. No company, customer, workspace, product, or engineering facts were learned.`,
      "calibration_learning_report"
    );
  }

  inspectionResponse() {
    const preferences = Object.entries(this.state.preferences);
    const preferenceText = preferences.length
      ? preferences.map(([key, entry]) => `${key}: ${entry.value} (${entry.source})`).join("; ")
      : "No learned communication preference is active.";
    const adjustment = this.state.currentAdjustment
      ? ` Current daily adjustment: ${this.state.currentAdjustment.key} to ${this.state.currentAdjustment.value}.`
      : " No inferred daily adjustment is active.";
    return calibrationResponse(
      "Conversation Calibration",
      `${preferenceText}${adjustment} Stored data is limited to abstract communication signals and explicit preferences.`,
      "calibration_inspection"
    );
  }

  observeFounderInput(input = "", { history = [] } = {}) {
    const normalized = normalizeText(input);
    if (!normalized) return null;

    if (/\breset conversation calibration\b/.test(normalized)) {
      this.reset();
      return calibrationResponse(
        "Conversation Calibration Reset",
        "Conversation calibration was reset. Learned preferences and abstract calibration signals were cleared. Company and operating memory were not changed.",
        "calibration_reset"
      );
    }

    if (/\bwhat did you learn yesterday\b/.test(normalized)) {
      return this.learnedYesterdayResponse();
    }

    if (/\b(show|inspect) conversation calibration\b/.test(normalized)) {
      return this.inspectionResponse();
    }

    if (/\b(reject|undo) (the )?(last |current )?calibration adjustment\b/.test(normalized)) {
      const rejected = this.rejectCurrentAdjustment();
      return calibrationResponse(
        "Conversation Calibration",
        rejected ? "The inferred calibration adjustment was rejected and removed." : "There is no inferred calibration adjustment to reject.",
        "calibration_rejection"
      );
    }

    if (/\b(review|run) conversation calibration\b/.test(normalized)) {
      const review = this.runDailyReviewIfNeeded({ force: true });
      return calibrationResponse(
        "Conversation Calibration Review",
        review?.adjustment
          ? `Review complete. One adjustment was selected: ${review.adjustment.key} is now ${review.adjustment.value}. Confidence: ${Math.round(review.adjustment.confidence * 100)} percent.`
          : "Review complete. No repeated pattern met the three-interaction threshold, so no default changed.",
        "calibration_review"
      );
    }

    const interactionId = this.interactionId();
    let directPreference = null;

    if (/\b(keep it shorter|be more concise|keep responses shorter|shorter answers|that answer was too long|too wordy)\b/.test(normalized)) {
      directPreference = ["responseLength", "concise"];
      this.recordSignal({
        category: "explicit_tone_or_length_preference",
        explicit: true,
        preferenceKey: directPreference[0],
        preferenceValue: directPreference[1],
        confidence: 1,
        interactionId
      });
    }

    if (/\b(be more neutral|less praise|stop praising|be more direct|keep it professional)\b/.test(normalized)) {
      directPreference = ["tone", "neutral"];
      this.recordSignal({
        category: "explicit_tone_or_length_preference",
        explicit: true,
        preferenceKey: directPreference[0],
        preferenceValue: directPreference[1],
        confidence: 1,
        interactionId
      });
    }

    if (/\b(don't repeat|do not repeat|stop repeating|you already said that)\b/.test(normalized)) {
      directPreference = ["repetition", "avoid"];
      this.recordSignal({
        category: "avoidable_repetition_or_confusion",
        explicit: true,
        preferenceKey: directPreference[0],
        preferenceValue: directPreference[1],
        confidence: 1,
        interactionId
      });
    }

    if (/\b(that's wrong|that is wrong|not what i asked|i said|you misunderstood|correct that)\b/.test(normalized)) {
      this.recordSignal({
        category: "explicit_founder_correction",
        explicit: true,
        confidence: 1,
        interactionId
      });
    }

    if (/\b(are you sure|what is the evidence|what's the evidence|you sound too certain|you made that up|is that verified)\b/.test(normalized)) {
      this.recordSignal({
        category: "evidence_or_certainty_complaint",
        preferenceKey: "evidenceFraming",
        preferenceValue: "explicit",
        confidence: 0.85,
        interactionId
      });
    }

    if (/\b(that was confusing|i'm confused|i am confused|you repeated yourself|that repeated)\b/.test(normalized)) {
      this.recordSignal({
        category: "avoidable_repetition_or_confusion",
        preferenceKey: "responseStructure",
        preferenceValue: "answer-first",
        confidence: 0.8,
        interactionId
      });
    }

    if (/\b(i'll do that|i will do that|that makes sense|accepted|good recommendation)\b/.test(normalized)) {
      this.recordSignal({
        category: "accepted_recommendation",
        confidence: 0.8,
        interactionId
      });
    }

    if (/\b(i disagree|i won't do that|i will not do that|bad recommendation|reject that recommendation)\b/.test(normalized)) {
      this.recordSignal({
        category: "rejected_recommendation",
        preferenceKey: "recommendationFraming",
        preferenceValue: "concern-evidence-alternative",
        confidence: 0.8,
        interactionId
      });
    }

    const repeated = history.slice(0, 4).some((turn) => normalizeText(turn?.input) === normalized);
    if (repeated) {
      this.recordSignal({
        category: "repeated_clarification_request",
        preferenceKey: "clarificationStyle",
        preferenceValue: "single-concise-question",
        confidence: 0.75,
        interactionId
      });
    }

    if (directPreference) {
      this.setPreference(directPreference[0], directPreference[1], {
        source: "explicit",
        confidence: 1
      });
    }
    this.persist();

    if (directPreference?.[0] === "responseLength") {
      return calibrationResponse(
        "Preference Updated",
        "Understood. I'll keep responses concise unless detail is required.",
        "explicit_length_preference"
      );
    }
    if (directPreference?.[0] === "tone") {
      return calibrationResponse(
        "Preference Updated",
        "Understood. I'll keep the tone neutral, direct, and professional.",
        "explicit_tone_preference"
      );
    }
    if (directPreference?.[0] === "repetition") {
      return calibrationResponse(
        "Preference Updated",
        "Understood. I will avoid repeating information unless confirmation is necessary.",
        "explicit_repetition_preference"
      );
    }

    if (/\b(are you sure|is that verified)\b/.test(normalized)) {
      return calibrationResponse(
        "Evidence Check",
        "Not with complete certainty. Verified fact: I can rely only on current governed Companion state and this conversation. Supported inference: the previous answer followed from that context. Working judgment: it remains provisional until checked against current evidence. Unknown: anything not present in governed evidence is unverified.",
        "evidence_check"
      );
    }

    if (recommendationDisagreement(normalized)) {
      return calibrationResponse(
        "Founder Recommendation",
        "I disagree with that priority. Concern: it would expand product scope during the current Route IQ operating phase. Verified fact: Route IQ is operational and primary, Gaia is paused, and Athena is architecture only. Supported inference: reopening either now would dilute readiness and onboarding work. Working judgment: the current operating phase has higher expected value. Recommended alternative: keep execution on Route IQ until governed evidence supports a phase change.",
        "evidence_based_disagreement"
      );
    }

    if (completedResult(normalized)) {
      return calibrationResponse(
        "Result Noted",
        "Recorded. I will treat the result as Founder-reported until it appears in governed verification.",
        "plain_result_acknowledgment"
      );
    }

    return null;
  }

  calibrateResponse(input = "", response = {}) {
    if (!response || typeof response !== "object") return response;
    let body = neutralizePraise(response.body);
    const concise = this.state.preferences.responseLength?.value === "concise";
    if (concise && !requestsDetail(input)) body = conciseText(body);

    const metadata = {
      ...(response.metadata || {}),
      calibrationApplied: true,
      calibrationScope: this.scope
    };
    if (metadata.spokenText) metadata.spokenText = body;

    return {
      ...response,
      body,
      tone: response.tone === "blocked" ? response.tone : "founder-neutral",
      metadata
    };
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
}

export const conversationCalibration = new ConversationCalibration();
