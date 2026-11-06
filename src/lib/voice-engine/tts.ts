/**
 * Synthèse vocale en streaming (TTS) — ElevenLabs ou Cartesia.
 *
 * Les deux fournisseurs renvoient directement de l'audio µ-law 8 kHz
 * (format téléphonique) au fil de l'eau : l'agent commence à parler avant
 * que la phrase entière soit générée. Un AbortSignal coupe la synthèse
 * quand l'appelant interrompt l'agent.
 */
import type { Agent } from "../shared/types";
import { applyPronunciations, DEFAULT_TUNING, elevenLabsSettings, normalizeTuning, type Pronunciation, type VoiceTuning } from "../voices/tuning";

export type StreamingTtsProvider = "elevenlabs" | "cartesia";

export interface TtsVoice {
  provider: StreamingTtsProvider;
  voiceId: string;
  language: string;
  /** Réglages Studio (ElevenLabs). Par défaut : réglages équilibrés. */
  tuning?: VoiceTuning;
  /** Dictionnaire de prononciation appliqué au texte avant la synthèse. */
  pronunciations?: Pronunciation[];
}

/** Réglages Studio d'une voix enregistrée par le client. */
export interface StudioExtras {
  voiceId?: string;
  /** Fournisseur de la voix Studio (peut différer de celui figé dans l'agent). */
  provider?: string;
  tuning?: VoiceTuning;
  pronunciations?: Pronunciation[];
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
export function resolveVoice(agent: Agent, fallbackVoiceId?: string | null, studio?: StudioExtras | null): TtsVoice | null {
  const provider = ttsProvider();
  if (!provider) return null;
  const v = agent.config.voice;
  const language = v.language || "fr-FR";
  const extras = {
    // Sans réglages Studio : réglages équilibrés, à la vitesse choisie pour l'agent.
    tuning: studio?.tuning ?? normalizeTuning({}, v.speed),
    ...(studio?.pronunciations?.length ? { pronunciations: studio.pronunciations } : {}),
  };
  // Voix Studio (réglée par le client) : son identifiant fournisseur à jour prime.
  const chosen = studio?.voiceId || (v.kind === "provider" ? v.providerVoiceId : undefined);
  const chosenProvider = studio?.voiceId ? (studio.provider ?? v.provider) : v.provider;
  if (chosen && chosenProvider === provider) {
    return { provider, voiceId: chosen, language, ...extras };
  }
  const voiceId = (provider === "elevenlabs" ? fallbackVoiceId : null) || process.env.VOICE_DEFAULT_FEMALE_ID;
  if (!voiceId) return null;
  return { provider, voiceId, language, ...extras };
}

/** Génère `text` et renvoie l'audio µ-law 8 kHz au fil de l'eau. */
export async function* streamSpeech(text: string, voice: TtsVoice, signal: AbortSignal): AsyncGenerator<Buffer> {
  const spoken = applyPronunciations(text, voice.pronunciations);
  const res = voice.provider === "elevenlabs" ? await elevenlabs(spoken, voice, signal) : await cartesia(spoken, voice, signal);
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
      voice_settings: elevenLabsSettings(voice.tuning ?? DEFAULT_TUNING),
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
