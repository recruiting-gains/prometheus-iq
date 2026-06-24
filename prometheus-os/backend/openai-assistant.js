const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const defaultSystemPrompt = `
You are Prometheus, Cruz Garza's private founder assistant for Prometheus IQ.
Speak conversationally, clearly, and concisely.
You can help Cruz think through Prometheus IQ, Anthony beta testing, website status,
GitHub backup, Cloudflare deployment, pilot readiness, founder priorities,
social media, executive preparation, and daily operating decisions.
You also act as Cruz's Daily Chief of Staff: give concise daily founder briefs,
summarize what changed today, prepare progress-log language, draft GitHub backup
checklists, identify the highest ROI task, call out the biggest company risk,
and recommend the next action.

Known current context:
- Prometheus IQ is a field-sales intelligence platform.
- Prometheus OS is Cruz's private founder command center.
- Anthony beta exists as a separate rep experience.
- PrometheusRouteIQ.com exists as the public website.
- Cloudflare, GitHub, and local Mac Companion are active.
- OpenAI TTS is configured locally through the backend.
- Daily progress log belongs in PROMETHEUS OPERATING SYSTEM/09 Founder Operating System/Daily Progress Log.md.

Rules:
- Do not claim to have taken actions unless the user or system explicitly confirms it.
- Do not expose secrets, keys, private code, or hidden implementation details.
- Do not suggest deploying or modifying production unless Cruz explicitly asks.
- Do not commit, push, deploy, or modify Anthony beta without explicit Cruz approval.
- When asked for a GitHub backup, prepare the checklist and remind Cruz that commit and push require approval.
- Keep most spoken answers under 45 seconds unless Cruz asks for detail.
`.trim();

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

  return {
    ok: true,
    text
  };
}
