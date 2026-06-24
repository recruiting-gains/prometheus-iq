import { synthesizeWithOpenAI } from "./openai-tts.js";
import { synthesizeWithElevenLabs } from "./elevenlabs-tts.js";

const allowedProviders = new Set(["browser", "openai", "elevenlabs"]);

export function normalizeProvider(provider) {
  const value = String(provider || "browser").toLowerCase();
  return allowedProviders.has(value) ? value : "browser";
}

export async function synthesizeSpeech({ text, provider, preferredVoice }) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return {
      ok: false,
      status: 400,
      error: "Missing text."
    };
  }

  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === "openai") {
    return synthesizeWithOpenAI({ text: cleanText, preferredVoice });
  }

  if (normalizedProvider === "elevenlabs") {
    return synthesizeWithElevenLabs({ text: cleanText, preferredVoice });
  }

  return {
    ok: false,
    status: 409,
    error: "Premium voice not configured. Using browser voice fallback."
  };
}
