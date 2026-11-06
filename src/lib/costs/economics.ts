/**
 * Rentabilité de Callpme : coût réel d'une minute d'appel, marge par offre et
 * projection selon le nombre d'abonnés. Module pur (testable).
 */
import { PLANS } from "../billing/plans";
import {
  geniusPayFeeEur,
  outboundUsdPerMinute,
  sttUsdPerMinute,
  TWILIO_INBOUND_FR,
  TWILIO_MEDIA_STREAMS,
  TWILIO_NUMBER_FR_MONTHLY,
  usdToEur,
} from "./prices";

/**
 * Mesure de référence (6 novembre 2026, script scripts/mesure-couts.ts) :
 * conversation de service client de 4 min rejouée avec les vraies API.
 * Claude Haiku 5.5 : 0,00112 $ / min de tokens (prompt en cache) ;
 * voix : 679 caractères envoyés à ElevenLabs par minute d'appel.
 */
export const REFERENCE = { llmUsdPerMin: 0.00112, ttsCharsPerMin: 679 };

/**
 * Prix ElevenLabs retenu, $ / 1 000 caractères. Les offres mensuelles reviennent
 * à ≈ 0,083 $ (ex. Business : 990 $ pour 6 M de crédits, 0,5 crédit par caractère
 * en Flash) ; le tarif API affiché est 0,04 $. On retient le plus prudent.
 */
export const TTS_USD_PER_1K_PRUDENT = 0.083;

export interface MinuteCost {
  llm: number;
  tts: number;
  stt: number;
  telephony: number;
  total: number;
}

/** Coût d'une minute en euros, par poste. */
export function minuteCostEur(
  opts: { channel?: "inboundFR" | "web" | "outbound"; to?: string; llmUsdPerMin?: number; ttsCharsPerMin?: number; ttsUsdPer1k?: number } = {},
): MinuteCost {
  const rate = usdToEur();
  const llm = (opts.llmUsdPerMin ?? REFERENCE.llmUsdPerMin) * rate;
  const tts = (((opts.ttsCharsPerMin ?? REFERENCE.ttsCharsPerMin) / 1000) * (opts.ttsUsdPer1k ?? TTS_USD_PER_1K_PRUDENT)) * rate;
  const stt = sttUsdPerMinute() * rate;
  const channel = opts.channel ?? "inboundFR";
  const telephony =
    channel === "web" ? 0 : ((channel === "outbound" ? outboundUsdPerMinute(opts.to ?? "") : TWILIO_INBOUND_FR) + TWILIO_MEDIA_STREAMS) * rate;
  return { llm, tts, stt, telephony, total: llm + tts + stt + telephony };
}

export interface PlanMargin {
  plan: "essentiel" | "starter" | "pro";
  price: number;
  minutesUsed: number;
  minutesCost: number;
  numbersCost: number;
  paymentFee: number;
  margin: number;
}

/** Marge mensuelle d'un abonné, selon la part des minutes incluses réellement utilisée (0 – 1). */
export function planMargin(plan: "essentiel" | "starter" | "pro", usage: number, perMinuteEur: number): PlanMargin {
  const p = PLANS[plan];
  const price = p.priceMonthly ?? 0;
  const minutesUsed = Math.round(p.minutes * Math.min(1, Math.max(0, usage)));
  const minutesCost = minutesUsed * perMinuteEur;
  const numbersCost = p.maxNumbers * TWILIO_NUMBER_FR_MONTHLY * usdToEur();
  const paymentFee = geniusPayFeeEur(price);
  return { plan, price, minutesUsed, minutesCost, numbersCost, paymentFee, margin: price - minutesCost - numbersCost - paymentFee };
}

/** Frais fixes mensuels de la plateforme (en euros) selon le nombre d'abonnés. */
export function fixedCostsEur(subscribers: number) {
  const rate = usdToEur();
  const voiceMachines = Math.max(1, Math.ceil(subscribers / 50)); // serveur vocal Fly : 6,70 $ / machine
  const items = [
    { label: "Vercel Pro (site)", usd: 20 },
    { label: "Supabase Pro (base de données)", usd: subscribers > 150 ? 40 : 25 },
    { label: `Fly.io (serveur vocal, ${voiceMachines} machine${voiceMachines > 1 ? "s" : ""})`, usd: 6.7 * voiceMachines },
    { label: "Resend (e-mails)", usd: subscribers > 30 ? 20 : 0 },
  ];
  return { items: items.map((i) => ({ label: i.label, eur: i.usd * rate })), total: items.reduce((s, i) => s + i.usd, 0) * rate };
}

export interface Projection {
  subscribers: number;
  revenue: number;
  variableCosts: number;
  fixedCosts: number;
  profit: number;
}

/** Bénéfice mensuel pour `subscribers` abonnés, répartis entre Starter et Pro (`proShare`). */
export function project(subscribers: number, opts: { proShare: number; usage: number; perMinuteEur: number }): Projection {
  const pro = Math.round(subscribers * opts.proShare);
  const starter = subscribers - pro;
  const s = planMargin("starter", opts.usage, opts.perMinuteEur);
  const p = planMargin("pro", opts.usage, opts.perMinuteEur);
  const revenue = starter * s.price + pro * p.price;
  const variableCosts = starter * (s.price - s.margin) + pro * (p.price - p.margin);
  const fixedCosts = fixedCostsEur(subscribers).total;
  return { subscribers, revenue, variableCosts, fixedCosts, profit: revenue - variableCosts - fixedCosts };
}
