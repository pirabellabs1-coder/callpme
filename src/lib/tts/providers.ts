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
import { applyPronunciations, DEFAULT_TUNING, elevenLabsSettings, type Pronunciation, type VoiceTuning } from "@/lib/voices/tuning";
import { effectiveBilingual, providerLanguageCode, voiceLanguage } from "@/lib/voice-engine/languages";
import { elevenLabsModel, spitchVoice, ttsProviderFor } from "@/lib/voice-engine/tts";

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
  /** Réglages Studio (ElevenLabs). */
  tuning?: VoiceTuning;
  pronunciations?: Pronunciation[];
  /** Mode bilingue (langue locale) : la langue n'est pas imposée à la voix. */
  bilingual?: boolean;
}

/** Renvoie une data URL audio, ou null si aucune clé / échec. */
export async function synthesizeSpeech(
  input: SynthInput,
): Promise<{ dataUrl: string } | null> {
  input = { ...input, text: applyPronunciations(input.text, input.pronunciations) };
  try {
    // Langue locale : même fournisseur et même modèle qu'au téléphone.
    if (voiceLanguage(input.language)?.local) return await localPreview(input);
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

/**
 * Aperçu dans une langue locale, routé comme l'appel (voir resolveVoice) :
 * Spitch avec la voix de la langue, ou ElevenLabs v3 / v4 avec la voix choisie.
 * Aucun fournisseur configuré, ou voix non ElevenLabs : null (repli navigateur).
 */
async function localPreview(i: SynthInput) {
  const language = i.language ?? "";
  const bilingual = effectiveBilingual(language, i.bilingual);
  const routed = ttsProviderFor(language, bilingual);
  if (routed === "spitch") return await spitch({ ...i, voiceId: spitchVoice(language) });
  if (routed === "elevenlabs" && i.provider === "elevenlabs") {
    return await elevenlabs(i, elevenLabsModel(language), bilingual);
  }
  return null;
}

async function elevenlabs(i: SynthInput, model?: string, autoLanguage = false) {
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
        // Même modèle qu'au téléphone : l'aperçu ressemble à ce qu'entendront les appelants.
        model_id: model ?? (process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5"),
        ...(i.language && !autoLanguage ? { language_code: providerLanguageCode(i.language, "elevenlabs") } : {}),
        voice_settings: elevenLabsSettings(i.tuning ?? DEFAULT_TUNING),
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) return null;
  return toDataUrl(await res.arrayBuffer(), "audio/mpeg");
}

/** Spitch (docs.spitch.app/features/speech) : WAV, lisible tel quel par le navigateur. */
async function spitch(i: SynthInput) {
  if (!process.env.SPITCH_API_KEY) return null;
  const speed = Math.min(1.2, Math.max(0.7, i.tuning?.speed ?? 1));
  const res = await fetch("https://api.spitch.app/v1/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SPITCH_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: i.text,
      language: providerLanguageCode(i.language ?? "", "spitch"),
      voice: i.voiceId,
      speed,
      format: "wav",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  return toDataUrl(await res.arrayBuffer(), "audio/wav");
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
