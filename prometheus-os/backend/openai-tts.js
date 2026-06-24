const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

export async function synthesizeWithOpenAI({ text, preferredVoice }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 409,
      error: "OpenAI premium voice is not configured."
    };
  }

  const voice = preferredVoice || process.env.OPENAI_TTS_VOICE || "onyx";
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      format: "mp3"
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
      console.warn(`OpenAI TTS request failed with status ${response.status}: ${providerError}`);
    } else {
      console.warn(`OpenAI TTS request failed with status ${response.status}.`);
    }

    return {
      ok: false,
      status: response.status,
      error: "OpenAI TTS request failed."
    };
  }

  return {
    ok: true,
    provider: "openai",
    contentType: response.headers.get("content-type") || "audio/mpeg",
    audio: Buffer.from(await response.arrayBuffer())
  };
}
