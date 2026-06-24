const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function transcribeWithElevenLabs({ audio, mimeType }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 409,
      error: "ElevenLabs speech-to-text is not configured."
    };
  }

  if (!audio?.length) {
    return {
      ok: false,
      status: 400,
      error: "No audio received."
    };
  }

  const modelId = process.env.ELEVENLABS_STT_MODEL_ID || "scribe_v2";
  const fileType = mimeType || "audio/webm";
  const extension = fileType.includes("mp4") ? "mp4" : fileType.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("model_id", modelId);
  form.append("file", new Blob([audio], { type: fileType }), `prometheus-command.${extension}`);
  form.append("language_code", process.env.ELEVENLABS_STT_LANGUAGE || "en");
  form.append("tag_audio_events", "false");
  form.append("timestamps_granularity", "none");

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: form
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: "ElevenLabs speech-to-text request failed."
    };
  }

  const body = await response.json();
  return {
    ok: true,
    provider: "elevenlabs",
    text: String(body.text || "").trim(),
    language: body.language_code || null
  };
}
