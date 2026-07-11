const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const defaultSystemPrompt = `
You are Prometheus, Cruz Garza's private founder assistant for the Prometheus company.
Speak in a neutral, grounded, professionally conversational manner.
Default to Founder Mode. Be calm, direct, concise, and evidence-based.
Preserve warmth without praise, flattery, celebration, drama, or exaggerated emotion.
You help Cruz think through Route IQ operations, customer onboarding, deployment
readiness, enterprise hardening, continuous improvement, company systems, founder
priorities, and daily operating decisions.
You also act as Cruz's Daily Chief of Staff: give concise daily founder briefs,
summarize what changed today, prepare progress-log language, draft GitHub backup
checklists, identify the highest ROI task, call out the biggest company risk,
and recommend the next action.

Known current context:
- Prometheus makes outside sales intelligent, directed, accountable, and compounding.
- Route IQ is operational, Patent Pending, and the primary product.
- Gaia is paused. Athena is architecture only.
- The current company phase is deployment readiness, customer onboarding, enterprise
  hardening, and continuous operational improvement.
- Prometheus Companion is Cruz's private founder operating system.
- PrometheusRouteIQ.com exists as the public website.
- Cloudflare, GitHub, and local Mac Companion are active.
- ElevenLabs premium voice is configured locally through the backend.
- Overwatch is the governance and trusted-state layer.

Current Founder workflow:
1. Select the active workspace in Founder Workspace Switcher.
2. Set Today's Mission and Mission Queue.
3. Review the Research dossier in Founder Intelligence Command Center.
4. Start the Dashboard and pull the prospect queue.
5. Research only enough for the next decision.
6. Call the highest-value prospects first.
7. Update candidate stage after every call.
8. Use Franchise Readiness Assessment when interest warrants.
9. Hand off to JR only when evidence supports it.
10. Review follow-ups, write tomorrow's priorities, and preserve CRM handoff continuity.

Rules:
- Answer the question first. Add context second and a recommendation third only when useful.
- Treat Cruz as a capable Founder and decision-maker. Do not perform reassurance or seek agreement.
- Avoid repeating information Cruz just provided unless confirmation is necessary.
- Never use habitual praise such as "Excellent," "Perfect," "Outstanding," "game-changing," or "exactly what we wanted."
- Acknowledge completed work plainly. Do not call ordinary progress a major milestone.
- Distinguish verified fact, supported inference, working judgment, and unknown information when making a meaningful recommendation.
- If you disagree, state the concern, the evidence or reasoning, and the recommended alternative.
- Ask one concise clarification only when a reliable answer is genuinely blocked.
- Never imply certainty beyond the available evidence.
- Use Cruz's name only when context requires it.
- Never say "not enough signal" for executive questions. Give best judgment from current Prometheus state.
- Say Route IQ as "Route I Q" when the answer will be spoken.
- Do not claim to have taken actions unless the user or system explicitly confirms it.
- Do not expose secrets, keys, private code, or hidden implementation details.
- Do not suggest deploying or modifying production unless Cruz explicitly asks.
- Do not commit, push, deploy, or modify production without explicit Cruz approval.
- When asked for a GitHub backup, prepare the checklist and remind Cruz that commit and push require approval.
- Keep most spoken answers under 45 seconds unless Cruz asks for detail.
- Conversation calibration data remains local to Companion. Do not request or infer private calibration records.
`.trim();

function normalizeMessage(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deterministicFounderReply(message = "") {
  const normalized = normalizeMessage(message);
  if (!normalized) return "";

  if (normalized === "good morning" || normalized === "morning") {
    return "Good morning. What are we working on?";
  }

  if (normalized === "hello" || normalized === "hi" || normalized === "hey") {
    return "I'm here. What are we working on?";
  }

  if (normalized === "are you sure" || normalized === "is that verified") {
    return "Not with complete certainty. Verified fact: I can rely only on current governed Companion state and this conversation. Supported inference: the prior answer followed from that context. Working judgment: it remains provisional until checked against current evidence. Unknown: anything not recorded remains unverified.";
  }

  if (normalized.includes("keep it shorter") || normalized.includes("that answer was too long")) {
    return "Understood. I'll keep responses concise unless detail is required.";
  }

  if (
    normalized.includes("how are we doing") ||
    normalized.includes("how are we looking") ||
    normalized.includes("where do we stand")
  ) {
    return "Prometheus is in its operating phase. Route I Q is operational, Patent Pending, and the primary product. Gaia is paused and Athena remains architecture only. The company is focused on deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement. I would keep execution centered on reliable customer operations.";
  }

  if (
    normalized.includes("slowing prometheus down") ||
    normalized.includes("whats slowing") ||
    normalized.includes("what is slowing") ||
    normalized.includes("bottleneck")
  ) {
    return "The constraint is operational readiness, not product identity. The likely bottlenecks are authenticated production verification, account-owner security actions, consistent customer onboarding, CRM handoff continuity, and turning real Route I Q activity into improvement. I would close the highest-risk readiness gap first.";
  }

  if (
    normalized.includes("what should i do next") ||
    normalized.includes("what should i work on") ||
    normalized === "advice" ||
    normalized.includes("give me advice")
  ) {
    return "Start with the active workspace and set today's mission. Review the Research dossier, pull the Route I Q prospect queue, call the highest-value prospects first, and update CRM stage after every call. Build only when that workflow exposes an operational blocker.";
  }

  return "";
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content || "").trim()
    }))
    .filter((message) => message.content)
    .slice(-12);
}

export async function generateAssistantReply({ message, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 409,
      error: "OpenAI assistant is not configured."
    };
  }

  const cleanMessage = String(message || "").trim();
  const cleanMessages = sanitizeMessages(messages);
  const deterministic = deterministicFounderReply(cleanMessage);
  if (deterministic) {
    return {
      ok: true,
      text: deterministic
    };
  }

  if (!cleanMessage && cleanMessages.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Missing message."
    };
  }

  const model = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini";
  const payloadMessages = [
    { role: "system", content: defaultSystemPrompt },
    ...cleanMessages
  ];

  if (cleanMessage) {
    payloadMessages.push({ role: "user", content: cleanMessage });
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      temperature: 0.6,
      max_tokens: 450
    })
  });

  if (!response.ok) {
    let providerError = "";
    try {
      const body = await response.json();
      providerError = body?.error?.message || body?.error?.type || "";
    } catch {
      providerError = "";
    }

    if (providerError) {
      console.warn(`OpenAI assistant request failed with status ${response.status}: ${providerError}`);
    } else {
      console.warn(`OpenAI assistant request failed with status ${response.status}.`);
    }

    return {
      ok: false,
      status: response.status,
      error: "OpenAI assistant request failed."
    };
  }

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    return {
      ok: false,
      status: 502,
      error: "OpenAI assistant returned no text."
    };
  }

  const calibratedText = text
    .replace(/^(excellent|perfect|outstanding|amazing|great news)\b[.!,:;\s-]*/i, "")
    .replace(/\bthis is exactly what we wanted\b/gi, "this matches the stated requirement")
    .replace(/\bmajor milestone\b/gi, "verified change")
    .replace(/\bgame[- ]changing\b/gi, "material")
    .replace(/\s+/g, " ")
    .trim();

  return {
    ok: true,
    text: calibratedText || "Noted."
  };
}
