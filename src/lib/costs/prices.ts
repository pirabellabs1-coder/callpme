/**
 * Prix publics des fournisseurs (relevés le 6 novembre 2026 sur leurs pages
 * officielles), en dollars US hors taxes. Utilisés pour calculer le coût réel
 * de chaque appel à partir de ce qu'il a vraiment consommé.
 *
 * Sources : deepgram.com/pricing · elevenlabs.io/pricing/api · claude.com/pricing ·
 * twilio.com/en-us/voice/pricing/{fr,bj,ci} · geniuspay.ci/pricing.
 */

/** Taux de conversion dollar → euro (à ajuster : COST_USD_TO_EUR). */
export function usdToEur(): number {
  const v = Number(process.env.COST_USD_TO_EUR);
  return Number.isFinite(v) && v > 0 ? v : 0.86;
}

/** Claude, $ par million de tokens. */
export const LLM_PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  haiku: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  sonnet: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  opus: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  fable: { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
};

export function llmPrice(model: string) {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return LLM_PRICES.haiku;
  if (m.includes("opus")) return LLM_PRICES.opus;
  if (m.includes("fable")) return LLM_PRICES.fable;
  return LLM_PRICES.sonnet;
}

/** Deepgram, transcription en direct, $ par minute (nova-2 : 0,35 $ / heure). */
export function sttUsdPerMinute(model = process.env.DEEPGRAM_MODEL || "nova-2"): number {
  return /nova-3/.test(model) ? 0.0077 : 0.35 / 60;
}

/**
 * Transcription des langues locales, $ par minute d'appel. Compté sur toute la
 * durée de l'appel (estimation haute : en réalité seules les phrases de
 * l'appelant sont envoyées). Sources (6 nov. 2026) :
 * - Google Chirp 3 : tarif V2 « Standard » 0,016 $ / min (cloud.google.com/speech-to-text/pricing ;
 *   chirp_3 n'y est pas nommé, à confirmer sur la facture) ;
 * - ElevenLabs Scribe v2 par fichier : 0,22 $ / heure (elevenlabs.io/pricing/api) ;
 * - Spitch : 0,00042 $ / seconde (docs.spitch.app/concepts/pricing).
 */
export const LOCAL_STT_USD_PER_MIN: Record<"google" | "elevenlabs" | "spitch", number> = {
  google: 0.016,
  elevenlabs: 0.22 / 60,
  spitch: 0.00042 * 60,
};

/** Prix de la transcription selon le fournisseur ($ / min). */
export function sttUsdPerMinuteFor(provider: string | undefined): number {
  if (provider === "google" || provider === "elevenlabs" || provider === "spitch") return LOCAL_STT_USD_PER_MIN[provider];
  return sttUsdPerMinute();
}

/**
 * ElevenLabs, $ pour 1 000 caractères. Tarif API à l'usage : Flash, v3 Conversational
 * et v4 Turbo à 0,04 $ ; Eleven v3 et v4 à 0,08 $ (elevenlabs.io/pricing/api).
 * Avec un abonnement, le prix réel dépend de l'offre : ELEVENLABS_USD_PER_1K_CHARS.
 */
export function ttsUsdPer1kChars(model?: string): number {
  const v = Number(process.env.ELEVENLABS_USD_PER_1K_CHARS);
  if (Number.isFinite(v) && v > 0) return v;
  return model && /^eleven_v[34]$/.test(model) ? 0.08 : 0.04;
}

/** Spitch, voix : 0,0014 $ par seconde d'audio produit (docs.spitch.app/concepts/pricing). */
export const SPITCH_TTS_USD_PER_SEC = 0.0014;

/** Twilio : recevoir un appel sur un numéro français + flux audio (Media Streams), $ / minute. */
export const TWILIO_INBOUND_FR = 0.01;
export const TWILIO_MEDIA_STREAMS = 0.0044;
/** Numéro français, $ / mois. */
export const TWILIO_NUMBER_FR_MONTHLY = 1.35;

/** Appels sortants Twilio, $ / minute, selon l'indicatif appelé. */
export function outboundUsdPerMinute(to: string): number {
  const n = to.replace(/[^\d+]/g, "");
  if (n.startsWith("+229")) return 0.6064; // Bénin, mobile
  if (n.startsWith("+225")) return 0.726; // Côte d'Ivoire, mobile
  if (/^\+33[67]/.test(n)) return 0.0404; // France, mobile (depuis l'EEE)
  if (n.startsWith("+33")) return 0.0187; // France, fixe
  return 0.1; // autre destination : valeur prudente
}

/**
 * GeniusPay : 1 % + 100 XOF de commission, plus les frais de l'opérateur
 * (Wave 1,5 %, MTN / Moov via PawaPay ≈ 3,5 %, carte 5 %). Par défaut : MTN / Moov (Bénin).
 */
export function geniusPayFeeEur(amountEur: number, operatorPercent = 3.5): number {
  return amountEur * ((1 + operatorPercent) / 100) + 100 / 655.957;
}
