export async function synthesizeWithElevenLabs({ text, preferredVoice }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = preferredVoice || process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return {
      ok: false,
      status: 409,
      error: "ElevenLabs premium voice is not configured."
    };
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.52,
        similarity_boost: 0.78,
        style: 0.18,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: "ElevenLabs TTS request failed."
    };
  }

  return {
    ok: true,
    provider: "elevenlabs",
    contentType: response.headers.get("content-type") || "audio/mpeg",
    audio: Buffer.from(await response.arrayBuffer())
  };
}
