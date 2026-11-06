/**
 * Synthèse vocale en streaming (TTS) — ElevenLabs ou Cartesia.
 *
 * Les deux fournisseurs renvoient directement de l'audio µ-law 8 kHz
 * (format téléphonique) au fil de l'eau : l'agent commence à parler avant
 * que la phrase entière soit générée. Un AbortSignal coupe la synthèse
 * quand l'appelant interrompt l'agent.
 */
import type { Agent } from "../shared/types";

export type StreamingTtsProvider = "elevenlabs" | "cartesia";

export interface TtsVoice {
  provider: StreamingTtsProvider;
  voiceId: string;
  language: string;
}

/** Fournisseur TTS du moteur : VOICE_TTS_PROVIDER, sinon le premier dont la clé existe. */
export function ttsProvider(): StreamingTtsProvider | null {
  const wanted = process.env.VOICE_TTS_PROVIDER as StreamingTtsProvider | undefined;
  if (wanted === "elevenlabs" && process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (wanted === "cartesia" && process.env.CARTESIA_API_KEY) return "cartesia";
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.CARTESIA_API_KEY) return "cartesia";
  return null;
}

export function ttsConfigured(): boolean {
  return ttsProvider() !== null;
}

/**
 * Voix utilisée pour un agent :
 * - la vraie voix choisie (catalogue ou voix propre), chez le fournisseur du moteur ;
 * - sinon `fallbackVoiceId` (première voix du catalogue), puis VOICE_DEFAULT_FEMALE_ID.
 */
export function resolveVoice(agent: Agent, fallbackVoiceId?: string | null): TtsVoice | null {
  const provider = ttsProvider();
  if (!provider) return null;
  const v = agent.config.voice;
  const language = v.language || "fr-FR";
  // Voix Studio clonée (ou ajoutée par ID) chez le fournisseur du moteur vocal.
  if (v.kind === "provider" && v.providerVoiceId && v.provider === provider) {
    return { provider, voiceId: v.providerVoiceId, language };
  }
  const voiceId = (provider === "elevenlabs" ? fallbackVoiceId : null) || process.env.VOICE_DEFAULT_FEMALE_ID;
  if (!voiceId) return null;
  return { provider, voiceId, language };
}

/** Génère `text` et renvoie l'audio µ-law 8 kHz au fil de l'eau. */
export async function* streamSpeech(text: string, voice: TtsVoice, signal: AbortSignal): AsyncGenerator<Buffer> {
  const res = voice.provider === "elevenlabs" ? await elevenlabs(text, voice, signal) : await cartesia(text, voice, signal);
  if (!res.ok || !res.body) {
    throw new Error(`Synthèse vocale refusée (${voice.provider}, HTTP ${res.status}).`);
  }
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value?.byteLength) yield Buffer.from(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function elevenlabs(text: string, voice: TtsVoice, signal: AbortSignal) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}/stream`);
  url.searchParams.set("output_format", "ulaw_8000");
  url.searchParams.set("optimize_streaming_latency", "3");
  return fetch(url, {
    method: "POST",
    signal,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
      language_code: voice.language.slice(0, 2),
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
}

function cartesia(text: string, voice: TtsVoice, signal: AbortSignal) {
  return fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    signal,
    headers: {
      "X-API-Key": process.env.CARTESIA_API_KEY ?? "",
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: process.env.CARTESIA_MODEL || "sonic-2",
      transcript: text,
      voice: { mode: "id", id: voice.voiceId },
      language: voice.language.slice(0, 2),
      output_format: { container: "raw", encoding: "pcm_mulaw", sample_rate: 8000 },
    }),
  });
}
