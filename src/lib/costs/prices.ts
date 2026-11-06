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
 * ElevenLabs, $ pour 1 000 caractères. Tarif API à l'usage du modèle Flash
 * (0,04 $). Avec un abonnement, le prix réel dépend de l'offre : ELEVENLABS_USD_PER_1K_CHARS.
 */
export function ttsUsdPer1kChars(): number {
  const v = Number(process.env.ELEVENLABS_USD_PER_1K_CHARS);
  return Number.isFinite(v) && v > 0 ? v : 0.04;
}

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
