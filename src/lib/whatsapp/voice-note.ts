/**
 * Notes vocales WhatsApp : règles pures (testées) et synthèse de la réponse.
 *
 * WhatsApp n'affiche une réponse comme « note vocale » (et non comme fichier
 * audio) que si elle est en OGG/Opus mono. ElevenLabs sait produire ce format
 * directement (`opus_48000_64`) : aucun encodage local n'est nécessaire.
 */
import type { Agent, WhatsAppReplyMode } from "@/lib/shared/types";
import type { TtsVoice } from "@/lib/voice-engine/tts";
import { applyPronunciations, DEFAULT_TUNING, elevenLabsSettings } from "@/lib/voices/tuning";
import { CostMeter, type CallCosts } from "@/lib/costs/meter";
import type { LlmUsage } from "@/lib/llm/usage";
import { DEFAULT_REPLY_MODE } from "./reply-mode";

/** Durée maximale d'une note vocale entrante : au-delà, pas de transcription. */
export const MAX_VOICE_NOTE_SEC = 180;
/** Réponse vocale : au-delà, le texte part par écrit (une note de plus d'une minute est pénible à écouter). */
export const MAX_VOICE_REPLY_CHARS = 900;
export { DEFAULT_REPLY_MODE };

/** Formats audio que Deepgram sait lire et que WhatsApp envoie pour les notes vocales et les audios. */
const AUDIO_MIMES = new Set(["audio/ogg", "audio/opus", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/aac", "audio/amr", "audio/wav", "audio/webm", "audio/x-m4a"]);

export function isSupportedAudioMime(mime: string | undefined | null): boolean {
  return Boolean(mime && AUDIO_MIMES.has(mime.split(";")[0].trim().toLowerCase()));
}

export function replyMode(agent: Pick<Agent, "config">): WhatsAppReplyMode {
  const m = agent.config.whatsapp?.replyMode;
  return m === "voice" || m === "text" || m === "mirror" ? m : DEFAULT_REPLY_MODE;
}

/** Faut-il répondre en vocal ? « mirror » : vocal seulement si la personne a envoyé une note vocale. */
export function wantsVoiceReply(mode: WhatsAppReplyMode, inbound: "voice" | "text"): boolean {
  return mode === "voice" || (mode === "mirror" && inbound === "voice");
}

/** Un texte se prête-t-il à la lecture à voix haute ? Les liens et adresses e-mail restent par écrit. */
export function speakable(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > MAX_VOICE_REPLY_CHARS) return false;
  return !/(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w.]+)/i.test(t);
}

/** Langues que Deepgram (nova-2/3) transcrit ; sinon détection automatique. */
const DEEPGRAM_LANGS = new Set(["fr", "en", "es", "de", "it", "nl", "pt", "hi", "ja", "ko", "zh", "ru", "tr", "pl", "sv", "da", "no", "id"]);

/** Paramètres de langue Deepgram pour la langue de l'agent (« fr-FR » → language=fr). */
export function deepgramLanguageParams(language: string | undefined | null): Record<string, string> {
  const code = (language || "fr").slice(0, 2).toLowerCase();
  return DEEPGRAM_LANGS.has(code) ? { language: code } : { detect_language: "true" };
}

/**
 * Durée d'un fichier OGG/Opus, lue dans l'en-tête des pages (sans décoder) :
 * position du dernier échantillon (granule) moins le « pre-skip », à 48 kHz.
 * null si ce n'est pas de l'OGG/Opus lisible.
 */
export function oggOpusDurationSec(buf: Buffer): number | null {
  if (buf.length < 47 || buf.toString("latin1", 0, 4) !== "OggS" || buf[4] !== 0) return null;
  // Premier paquet : « OpusHead » (pre-skip sur 2 octets à l'offset 10 du paquet).
  const segs = buf[26];
  const headStart = 27 + segs;
  if (buf.length < headStart + 19 || buf.toString("latin1", headStart, headStart + 8) !== "OpusHead") return null;
  const preSkip = buf.readUInt16LE(headStart + 10);
  // On remonte depuis la fin jusqu'à la dernière vraie page (version 0) dont la granule est connue
  // (-1 : page sans fin de paquet, ex. fichier tronqué).
  let from = buf.length - 27;
  while (from > 0) {
    const at = buf.lastIndexOf("OggS", from, "latin1");
    if (at <= 0) return null;
    if (buf[at + 4] === 0) {
      const granule = buf.readBigInt64LE(at + 6);
      if (granule > BigInt(0)) return Math.max(0, Number(granule) - preSkip) / 48_000;
    }
    from = at - 1;
  }
  return null;
}

/** Le contenu est-il de l'OGG/Opus (vérifié sur les octets, pas sur le type annoncé) ? */
export function isOggOpus(buf: Buffer): boolean {
  return oggOpusDurationSec(buf) !== null;
}

/** Consigne de style quand la réponse sera lue à voix haute. */
export const WHATSAPP_VOICE_STYLE = `## Canal : WhatsApp (note vocale)
Ta réponse sera envoyée en note vocale, lue avec ta voix. Parle comme à l'oral : 1 à 4 phrases courtes et naturelles, sans emoji, sans liste, sans titre, sans lien ni adresse e-mail.
Écris les nombres, prix et horaires comme on les prononce. Tu ne peux ni raccrocher ni transférer d'appel : si la personne veut parler à quelqu'un, propose qu'un conseiller la rappelle (prends un message).`;

/**
 * Synthèse de la note vocale (OGG/Opus 48 kHz). Uniquement ElevenLabs : les
 * autres fournisseurs ne produisent pas ce format, la réponse part alors par écrit.
 */
export async function synthesizeVoiceNote(text: string, voice: TtsVoice, timeoutMs = 15_000): Promise<Buffer | null> {
  if (voice.provider !== "elevenlabs" || !process.env.ELEVENLABS_API_KEY) return null;
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}`);
  url.searchParams.set("output_format", "opus_48000_64");
  const model = process.env.ELEVENLABS_NOTE_MODEL || process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/ogg" },
    body: JSON.stringify({
      text: applyPronunciations(text, voice.pronunciations),
      model_id: model,
      // Seuls les modèles Flash / Turbo v2.5 acceptent une langue imposée ; les autres la refusent.
      ...(/(flash|turbo)_v2_5/.test(model) ? { language_code: voice.language.slice(0, 2) } : {}),
      voice_settings: elevenLabsSettings(voice.tuning ?? DEFAULT_TUNING),
    }),
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  }).catch(() => null);
  if (!res?.ok) {
    if (res) console.error(`[whatsapp] synthèse de note vocale refusée (ElevenLabs, HTTP ${res.status}, modèle ${model}).`);
    return null;
  }
  // Le délai couvre aussi la lecture du corps : une coupure ne doit pas lever d'exception.
  const buf = await res
    .arrayBuffer()
    .then((b) => Buffer.from(b))
    .catch(() => null);
  // WhatsApp refuse une note vocale qui n'est pas de l'OGG/Opus : on vérifie les octets.
  return buf && isOggOpus(buf) ? buf : null;
}

/** Coût réel d'un échange (transcription, modèle, voix), avec le compteur des appels. */
export function exchangeCost(opts: { sttSec: number; llm: LlmUsage[]; ttsText?: string }): CallCosts {
  const meter = new CostMeter();
  for (const u of opts.llm) meter.addLlm(u);
  if (opts.ttsText) meter.addTts(opts.ttsText);
  // « web » : pas de téléphonie ; la durée sert au coût de la transcription.
  return meter.summary({ durationSec: opts.sttSec, direction: "web", to: "" });
}
