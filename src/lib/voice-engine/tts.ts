/**
 * Synthèse vocale en streaming (TTS) — ElevenLabs, Cartesia, Spitch, ou nos voix
 * maison (fournisseur « callpme », actif seulement si CALLPME_TTS_URL existe).
 *
 * Le fournisseur dépend de la langue de l'agent (voir ./languages) :
 * le français reste sur ElevenLabs Flash ou Cartesia ; le yoruba, le haoussa
 * et le wolof passent par Spitch ou par les modèles ElevenLabs v3 / v4 qui
 * les parlent. Chaque fournisseur reste éteint tant que sa clé n'est pas posée.
 *
 * ElevenLabs et Cartesia renvoient directement de l'audio µ-law 8 kHz au fil
 * de l'eau ; Spitch renvoie un WAV en flux, transcodé ici en µ-law 8 kHz.
 * Un AbortSignal coupe la synthèse quand l'appelant interrompt l'agent.
 */
import type { Agent } from "../shared/types";
import { callpmeSpeech, callpmeTtsConfigured, usesInhouseVoice } from "./callpme-tts";

export { usesInhouseVoice };
import { applyPronunciations, DEFAULT_TUNING, elevenLabsSettings, normalizeTuning, type Pronunciation, type VoiceTuning } from "../voices/tuning";
import { encodeMulaw, pcm16FromBytes } from "./audio";
import { effectiveBilingual, providerLanguageCode, ttsCandidates, voiceLanguage, type TtsProviderId } from "./languages";

export type StreamingTtsProvider = TtsProviderId;

export interface TtsVoice {
  /** "callpme" : voix maison servie par notre serveur d'inférence. */
  provider: StreamingTtsProvider | "callpme";
  voiceId: string;
  language: string;
  /** Modèle du fournisseur (ElevenLabs : Flash pour le français, v3 / v4 pour les langues locales). */
  model?: string;
  /** Mode bilingue : la langue n'est pas imposée, le modèle la déduit du texte (français ou langue locale). */
  autoLanguage?: boolean;
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

/** Fournisseur TTS du moteur pour le français : VOICE_TTS_PROVIDER, sinon le premier dont la clé existe. */
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

/** Clé présente pour ce fournisseur ? */
export function ttsProviderConfigured(p: StreamingTtsProvider): boolean {
  if (p === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY);
  if (p === "cartesia") return Boolean(process.env.CARTESIA_API_KEY);
  return Boolean(process.env.SPITCH_API_KEY);
}

/**
 * Fournisseur de voix pour une langue : le premier candidat dont la clé existe.
 * Français (et langue inconnue) : règle historique (VOICE_TTS_PROVIDER).
 * Mode bilingue : seule une voix qui parle AUSSI le français convient (ElevenLabs).
 */
export function ttsProviderFor(language: string, bilingual = false): StreamingTtsProvider | null {
  const lang = voiceLanguage(language);
  if (!lang?.local) return ttsProvider();
  const candidates = ttsCandidates(language).filter((p) => !bilingual || p === "elevenlabs");
  return candidates.find(ttsProviderConfigured) ?? null;
}

/**
 * Modèle ElevenLabs selon la langue. Flash v2.5 ne parle aucune langue locale :
 * yoruba et haoussa → Eleven v3, wolof → Eleven v4 Turbo (seul modèle qui le parle).
 * Surcharge possible : ELEVENLABS_MODEL_YO, ELEVENLABS_MODEL_HA, ELEVENLABS_MODEL_WO.
 */
export function elevenLabsModel(language: string): string {
  const lang = voiceLanguage(language);
  if (!lang?.local) return process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
  const code = providerLanguageCode(language, "elevenlabs");
  const override = process.env[`ELEVENLABS_MODEL_${code.toUpperCase()}`];
  if (override) return override;
  return code === "wo" ? "eleven_v4_turbo" : "eleven_v3";
}

/** Voix Spitch par langue (SPITCH_VOICE_YO, SPITCH_VOICE_HA), sinon une voix documentée. */
export function spitchVoice(language: string): string {
  const code = providerLanguageCode(language, "spitch");
  const fallback: Record<string, string> = { yo: "sade", ha: "amina" };
  return process.env[`SPITCH_VOICE_${code.toUpperCase()}`] || fallback[code] || "sade";
}

/**
 * Voix utilisée pour un agent :
 * - une voix maison publiée, si notre serveur d'inférence est configuré ;
 * - la vraie voix choisie (catalogue ou voix propre), chez le fournisseur du moteur ;
 * - sinon `fallbackVoiceId` (première voix du catalogue), puis VOICE_DEFAULT_FEMALE_ID.
 * Langue locale servie par Spitch : voix Spitch de la langue.
 */
export function resolveVoice(
  agent: Agent,
  fallbackVoiceId?: string | null,
  studio?: StudioExtras | null,
  /** Voix maison encore publiée au catalogue (vérifié en base par l'appelant). */
  inhouseAvailable = false,
): TtsVoice | null {
  const v = agent.config.voice;
  const language = v.language || "fr-FR";
  const bilingual = effectiveBilingual(language, v.bilingual);
  const pronunciations = studio?.pronunciations?.length ? { pronunciations: studio.pronunciations } : {};
  // Voix maison : servie par notre serveur si configuré ; sinon voix du fournisseur de la langue.
  const inhouseId = studio?.voiceId || (v.kind === "provider" ? v.providerVoiceId : undefined);
  if (usesInhouseVoice(agent) && inhouseId && inhouseAvailable && callpmeTtsConfigured()) {
    return { provider: "callpme", voiceId: inhouseId, language, tuning: studio?.tuning ?? normalizeTuning({}, v.speed), ...pronunciations };
  }
  const provider = ttsProviderFor(language, bilingual);
  if (!provider) return null;
  // Spitch : voix propres à chaque langue, indépendantes du catalogue ElevenLabs.
  if (provider === "spitch") {
    return { provider, voiceId: spitchVoice(language), language, tuning: normalizeTuning({}, v.speed), ...pronunciations };
  }
  const model = provider === "elevenlabs" ? elevenLabsModel(language) : undefined;
  const extras = {
    ...(model ? { model } : {}),
    ...(bilingual ? { autoLanguage: true } : {}),
    // Sans réglages Studio : réglages équilibrés, à la vitesse choisie pour l'agent.
    tuning: studio?.tuning ?? normalizeTuning({}, v.speed),
    ...pronunciations,
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
  const res =
    voice.provider === "callpme"
      ? await callpmeSpeech({ text: spoken, modelRef: voice.voiceId, language: voice.language, speed: voice.tuning?.speed }, signal)
      : voice.provider === "elevenlabs"
        ? await elevenlabs(spoken, voice, signal)
        : voice.provider === "spitch"
          ? await spitch(spoken, voice, signal)
        : await cartesia(spoken, voice, signal);
  if (!res.ok || !res.body) {
    throw new Error(`Synthèse vocale refusée (${voice.provider}, HTTP ${res.status}).`);
  }
  const reader = res.body.getReader();
  // Spitch : WAV en flux, converti en µ-law 8 kHz au fil de l'eau.
  const wav = voice.provider === "spitch" ? new WavToMulaw() : null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        if (wav && !wav.started) throw new Error("Synthèse vocale illisible (spitch : WAV attendu).");
        return;
      }
      if (!value?.byteLength) continue;
      if (!wav) yield Buffer.from(value);
      else {
        const out = wav.push(value);
        if (out.length) yield out;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Convertit au fil de l'eau un WAV PCM 16 bits mono (toute fréquence) en µ-law
 * 8 kHz. L'en-tête est lu dès qu'il est complet ; le son suit, morceau par morceau.
 */
export class WavToMulaw {
  private head = Buffer.alloc(0);
  /** Rapport fréquence source / 8 kHz. */
  private ratio = 1;
  /** Octet impair en attente (un échantillon coupé entre deux morceaux). */
  private odd: Buffer = Buffer.alloc(0);
  /** Échantillons source pas encore consommés, et position (fractionnaire) du prochain échantillon à 8 kHz. */
  private pending = new Int16Array(0);
  private pos = 0;
  /** Octets de son restant dans le bloc `data` (null : taille inconnue, on lit jusqu'au bout). */
  private remaining: number | null = null;
  started = false;

  push(chunk: Uint8Array): Buffer {
    let data: Buffer;
    if (!this.started) {
      this.head = Buffer.concat([this.head, Buffer.from(chunk)]);
      const found = findWavData(this.head);
      if (!found) {
        if (this.head.length > 64 * 1024) throw new Error("En-tête WAV introuvable.");
        return Buffer.alloc(0);
      }
      this.started = true;
      this.ratio = found.sampleRate / 8000;
      this.remaining = found.size;
      data = this.head.subarray(found.offset);
      this.head = Buffer.alloc(0);
    } else {
      data = Buffer.from(chunk);
    }
    // Ce qui suit le bloc audio (métadonnées) n'est pas du son.
    if (this.remaining !== null) {
      data = data.subarray(0, Math.max(0, this.remaining));
      this.remaining -= data.length;
    }
    const bytes = this.odd.length ? Buffer.concat([this.odd, data]) : data;
    const even = bytes.length - (bytes.length % 2);
    this.odd = Buffer.from(bytes.subarray(even));
    if (!even) return Buffer.alloc(0);
    const fresh = pcm16FromBytes(bytes.subarray(0, even));
    if (this.ratio === 1) return encodeMulaw(fresh);

    const src = new Int16Array(this.pending.length + fresh.length);
    src.set(this.pending);
    src.set(fresh, this.pending.length);
    // Décimation avec moyenne sur une fenêtre d'environ un pas (limite le repliement).
    // La position fractionnaire est gardée d'un morceau à l'autre : pas de dérive.
    const width = Math.max(1, Math.round(this.ratio));
    const out: number[] = [];
    while (Math.floor(this.pos) + width <= src.length) {
      const i0 = Math.floor(this.pos);
      let sum = 0;
      for (let k = 0; k < width; k++) sum += src[i0 + k];
      out.push(Math.round(sum / width));
      this.pos += this.ratio;
    }
    const used = Math.min(src.length, Math.floor(this.pos));
    this.pending = src.slice(used);
    this.pos -= used;
    return encodeMulaw(Int16Array.from(out));
  }
}

/** Position, taille et fréquence des données d'un WAV PCM 16 bits mono, si l'en-tête est complet. */
function findWavData(buf: Buffer): { offset: number; sampleRate: number; size: number | null } | null {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Réponse non WAV.");
  let off = 12;
  let rate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      if (off + 8 + 16 > buf.length) return null;
      const channels = buf.readUInt16LE(off + 10);
      const bits = buf.readUInt16LE(off + 22);
      rate = buf.readUInt32LE(off + 12);
      if (channels !== 1 || bits !== 16 || rate < 8000) throw new Error("WAV non pris en charge (mono 16 bits, 8 kHz ou plus).");
    } else if (id === "data") {
      // En flux, certains serveurs écrivent une taille 0 ou 0xFFFFFFFF (inconnue).
      const known = size > 0 && size !== 0xffffffff;
      return rate ? { offset: off + 8, sampleRate: rate, size: known ? size : null } : null;
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

function elevenlabs(text: string, voice: TtsVoice, signal: AbortSignal) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}/stream`);
  url.searchParams.set("output_format", "ulaw_8000");
  const model = voice.model || process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
  // Réglage historique de Flash ; déprécié, il n'est pas envoyé aux modèles v3 / v4.
  if (!/^eleven_v[34]/.test(model)) url.searchParams.set("optimize_streaming_latency", "3");
  return fetch(url, {
    method: "POST",
    signal,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      ...(voice.autoLanguage ? {} : { language_code: providerLanguageCode(voice.language, "elevenlabs") }),
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
      language: providerLanguageCode(voice.language, "cartesia"),
      output_format: { container: "raw", encoding: "pcm_mulaw", sample_rate: 8000 },
    }),
  });
}

/** Spitch (docs.spitch.app/features/speech) : WAV renvoyé en flux, fréquence lue dans l'en-tête. */
function spitch(text: string, voice: TtsVoice, signal: AbortSignal) {
  const speed = Math.min(1.2, Math.max(0.7, voice.tuning?.speed ?? 1));
  return fetch("https://api.spitch.app/v1/speech", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${process.env.SPITCH_API_KEY ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: providerLanguageCode(voice.language, "spitch"),
      voice: voice.voiceId,
      speed,
      format: "wav",
    }),
  });
}
