/**
 * Appels sortants : payés à la minute, sur un crédit prépayé en euros.
 * Le prix de chaque destination est fixé à partir de son coût réel (IA, voix,
 * transcription, opérateur) pour garder au moins 50 % de marge, frais de
 * paiement compris. Module pur.
 */
import { minuteCostEur } from "../costs/economics";

/** Marge visée sur chaque minute sortante. */
export const OUTBOUND_MARGIN = 0.5;
/** Part prélevée par le paiement (GeniusPay + opérateur Mobile Money ≈ 4,5 % + frais fixes). */
export const PAYMENT_FEE_SHARE = 0.05;

/** Prix d'une minute sortante vers `to`, en euros (arrondi au centime supérieur). */
export function outboundRateEur(to: string): number {
  const cost = minuteCostEur({ channel: "outbound", to }).total;
  return Math.ceil((cost / (1 - OUTBOUND_MARGIN - PAYMENT_FEE_SHARE)) * 100) / 100;
}

export function outboundRateCents(to: string): number {
  return Math.round(outboundRateEur(to) * 100);
}

/** Destinations affichées dans Facturation. */
export const OUTBOUND_DESTINATIONS: { label: string; sample: string }[] = [
  { label: "France — fixe", sample: "+33100000000" },
  { label: "France — mobile", sample: "+33600000000" },
  { label: "Bénin — mobile", sample: "+22997000000" },
  { label: "Côte d'Ivoire — mobile", sample: "+2250700000000" },
];

/**
 * Destinations ouvertes aux appels sortants : seulement celles dont le coût
 * opérateur est connu (sinon on risquerait de vendre à perte).
 */
export function outboundDestinationOpen(to: string): boolean {
  const n = to.replace(/[^\d+]/g, "");
  return n.startsWith("+33") || n.startsWith("+229") || n.startsWith("+225");
}

/** Recharges de crédit d'appels sortants (euros). */
export const CREDIT_PACKS = [10, 25, 50, 100] as const;

/** Durée maximale (secondes) qu'un crédit permet d'appeler vers `to` (minutes entamées facturées). */
export function maxSecondsForCredit(creditCents: number, to: string): number {
  const rate = outboundRateCents(to);
  if (rate <= 0) return 0;
  return Math.floor(creditCents / rate) * 60;
}

/** Montant débité pour un appel sortant (minute entamée due). */
export function outboundChargeCents(durationSec: number, to: string): number {
  if (durationSec <= 0) return 0;
  return Math.ceil(durationSec / 60) * outboundRateCents(to);
}
