const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function transcribeWithOpenAI({ audio, mimeType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 409,
      error: "OpenAI speech-to-text is not configured."
    };
  }

  if (!audio?.length) {
    return {
      ok: false,
      status: 400,
      error: "No audio received."
    };
  }

  const model = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
  const fileType = mimeType || "audio/webm";
  const extension = fileType.includes("mpeg") ? "mp3" : fileType.includes("mp4") ? "mp4" : fileType.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([audio], { type: fileType }), `prometheus-command.${extension}`);
  form.append("language", process.env.OPENAI_STT_LANGUAGE || "en");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: "OpenAI speech-to-text request failed."
    };
  }

  const body = await response.json();
  return {
    ok: true,
    provider: "openai",
    text: String(body.text || "").trim(),
    language: body.language || process.env.OPENAI_STT_LANGUAGE || null
  };
}
