/**
 * Synthèse vocale via providers premium (ElevenLabs / Cartesia / OpenAI).
 *
 * Si la clé d'API du provider est présente dans l'environnement, on génère le
 * vrai audio et on le renvoie en data URL. Sinon on renvoie `null` : l'appelant
 * se rabat alors sur la synthèse du navigateur (avec la signature de la voix).
 *
 * Aucune dépendance SDK : appels REST + base64.
 */
import type { TtsProvider } from "@/lib/voices/catalog";

export function hasTtsKey(provider: TtsProvider): boolean {
  if (provider === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY);
  if (provider === "cartesia") return Boolean(process.env.CARTESIA_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

interface SynthInput {
  provider: TtsProvider;
  voiceId: string;
  text: string;
  language?: string;
}

/** Renvoie une data URL audio, ou null si aucune clé / échec. */
export async function synthesizeSpeech(
  input: SynthInput,
): Promise<{ dataUrl: string } | null> {
  try {
    if (input.provider === "elevenlabs" && process.env.ELEVENLABS_API_KEY)
      return await elevenlabs(input);
    if (input.provider === "cartesia" && process.env.CARTESIA_API_KEY)
      return await cartesia(input);
    if (input.provider === "openai" && process.env.OPENAI_API_KEY)
      return await openai(input);
  } catch {
    /* repli navigateur */
  }
  return null;
}

function toDataUrl(buf: ArrayBuffer, mime: string): { dataUrl: string } {
  const b64 = Buffer.from(buf).toString("base64");
  return { dataUrl: `data:${mime};base64,${b64}` };
}

async function elevenlabs(i: SynthInput) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(i.voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: i.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) return null;
  return toDataUrl(await res.arrayBuffer(), "audio/mpeg");
}

async function openai(i: SynthInput) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", voice: i.voiceId, input: i.text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  return toDataUrl(await res.arrayBuffer(), "audio/mpeg");
}

async function cartesia(i: SynthInput) {
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": process.env.CARTESIA_API_KEY ?? "",
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: i.text,
      voice: { mode: "id", id: i.voiceId },
      language: (i.language ?? "fr").slice(0, 2),
      output_format: {
        container: "mp3",
        sample_rate: 44100,
        bit_rate: 128000,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  return toDataUrl(await res.arrayBuffer(), "audio/mpeg");
}
