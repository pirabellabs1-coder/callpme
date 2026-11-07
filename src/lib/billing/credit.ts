/**
 * Crédit prépayé des appels sortants (centimes d'euro).
 *
 * Garantie « jamais à perte » :
 *  1. Avant de composer, le crédit nécessaire est RÉSERVÉ (prélevé d'un coup,
 *     de façon atomique) : deux appels simultanés ne peuvent pas dépenser le
 *     même crédit.
 *  2. La durée de l'appel est plafonnée par cette réservation (marge comprise
 *     pour la détection de répondeur et l'arrondi à la minute).
 *  3. À la fin, l'appel est réglé sur la durée FACTURÉE PAR L'OPÉRATEUR
 *     (rappel de statut) — ou par le moteur vocal sur la passerelle SIP — et
 *     le reste de la réservation est rendu.
 */
import { prisma } from "../db/client";
import { outboundDestinationOpen, outboundRateCents } from "./outbound-rates";

/** Réservation maximale par appel (au-delà, l'appel est coupé). */
export const OUTBOUND_HOLD_MAX_SEC = 1800;
/** Temps réservé mais non parlé : détection de répondeur, mise en relation, arrondi. */
export const OUTBOUND_SAFETY_SEC = 45;
/** Minutes de crédit minimales pour composer (dont la marge de sécurité). */
export const OUTBOUND_MIN_MINUTES = 2;
/** Durée maximale d'un transfert (voir telephony/provider), prépayée. */
export const TRANSFER_PREPAID_SEC = 600;

export async function creditBalanceCents(organizationId: string): Promise<number> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { callCreditCents: true } });
  return Math.max(0, org?.callCreditCents ?? 0);
}

/** Prélève `cents` seulement si le crédit les couvre (atomique). */
async function takeCredit(organizationId: string, cents: number): Promise<boolean> {
  if (cents <= 0) return true;
  const n = await prisma.$executeRaw`UPDATE "Organization" SET "callCreditCents" = "callCreditCents" - ${cents} WHERE id = ${organizationId} AND "callCreditCents" >= ${cents}`;
  return n === 1;
}

/** Rend un prélèvement immédiat (ex. transfert payé d'avance qui n'a pas eu lieu). */
export async function refundCharge(organizationId: string, cents: number) {
  await giveBack(organizationId, cents);
}

async function giveBack(organizationId: string, cents: number) {
  if (cents <= 0) return;
  await prisma.organization.update({ where: { id: organizationId }, data: { callCreditCents: { increment: cents } } });
}

export type OutboundRefusal = "destination" | "insufficient_credit";

export interface HoldResult {
  ok: boolean;
  code?: OutboundRefusal;
  error?: string;
  holdId?: string;
}

const NO_CREDIT = "Crédit d'appels sortants insuffisant. Rechargez-le dans Facturation (Mobile Money ou carte).";

/** Réserve le crédit d'un appel sortant vers `to` (au plus `capSec` de conversation). */
export async function reserveOutbound(organizationId: string, to: string, capSec = OUTBOUND_HOLD_MAX_SEC): Promise<HoldResult> {
  if (!outboundDestinationOpen(to)) {
    return { ok: false, code: "destination", error: "Cette destination n'est pas encore ouverte aux appels sortants (France, Bénin et Côte d'Ivoire pour l'instant)." };
  }
  const rate = outboundRateCents(to);
  const wantedMinutes = Math.ceil((Math.min(capSec, OUTBOUND_HOLD_MAX_SEC) + OUTBOUND_SAFETY_SEC) / 60);
  // Deux essais : le solde a pu changer entre la lecture et le prélèvement.
  for (let attempt = 0; attempt < 2; attempt++) {
    const credit = await creditBalanceCents(organizationId);
    const minutes = Math.min(wantedMinutes, Math.floor(credit / rate));
    if (minutes < OUTBOUND_MIN_MINUTES) return { ok: false, code: "insufficient_credit", error: NO_CREDIT };
    const holdCents = minutes * rate;
    if (await takeCredit(organizationId, holdCents)) {
      const hold = await prisma.outboundHold.create({ data: { organizationId, to, rateCents: rate, holdCents } });
      return { ok: true, holdId: hold.id };
    }
  }
  return { ok: false, code: "insufficient_credit", error: NO_CREDIT };
}

/** Durée de conversation permise par une réservation (secondes). */
export function talkSecondsForHold(hold: { holdCents: number; rateCents: number }): number {
  if (hold.rateCents <= 0) return 0;
  return Math.max(0, Math.floor(hold.holdCents / hold.rateCents) * 60 - OUTBOUND_SAFETY_SEC);
}

export async function getHold(holdId: string | undefined, organizationId: string) {
  if (!holdId) return null;
  const hold = await prisma.outboundHold.findUnique({ where: { id: holdId } });
  return hold && hold.organizationId === organizationId && !hold.settled ? hold : null;
}

export async function attachProviderCall(holdId: string, providerCallId: string | undefined) {
  if (!providerCallId) return;
  await prisma.outboundHold.update({ where: { id: holdId }, data: { providerCallId } }).catch(() => {});
}

export async function recordSessionSeconds(holdId: string, seconds: number) {
  await prisma.outboundHold.updateMany({ where: { id: holdId, settled: false }, data: { sessionSec: Math.ceil(Math.max(0, seconds)) } });
}

/**
 * Règle une réservation : facture `billedSec` (minute entamée due, jamais plus
 * que la réservation) et rend le reste. Idempotent : un seul règlement par appel.
 */
export async function settleHold(where: { id: string } | { providerCallId: string }, billedSec: number): Promise<number | null> {
  const hold = await prisma.outboundHold.findUnique({ where });
  if (!hold || hold.settled) return null;
  const charge = Math.min(hold.holdCents, billedSec > 0 ? Math.ceil(billedSec / 60) * hold.rateCents : 0);
  const claimed = await prisma.outboundHold.updateMany({ where: { id: hold.id, settled: false }, data: { settled: true, chargedCents: charge } });
  if (claimed.count !== 1) return null;
  await giveBack(hold.organizationId, hold.holdCents - charge);
  return charge;
}

/** Ajoute du crédit à une réservation en cours (ex. transfert). */
export async function extendHold(holdId: string, organizationId: string, extraCents: number): Promise<boolean> {
  if (!(await takeCredit(organizationId, extraCents))) return false;
  const n = await prisma.outboundHold.updateMany({ where: { id: holdId, settled: false }, data: { holdCents: { increment: extraCents } } });
  if (n.count !== 1) {
    await giveBack(organizationId, extraCents);
    return false;
  }
  return true;
}

/** Prélève un montant ferme (ex. jambe de transfert vers un autre numéro). */
export async function chargeNow(organizationId: string, cents: number): Promise<boolean> {
  return takeCredit(organizationId, cents);
}

/** Rend une réservation dont l'appel n'est jamais parti. */
export async function releaseHold(holdId: string) {
  await settleHold({ id: holdId }, 0);
}

/**
 * Filet de sécurité : réservations restées ouvertes (rappel de l'opérateur
 * perdu). Réglées sur la durée vue par le moteur + la marge, ou rendues.
 */
export async function sweepStaleHolds(olderThanMs = 2 * 3600_000) {
  const stale = await prisma.outboundHold.findMany({
    where: { settled: false, createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    select: { id: true, sessionSec: true },
    take: 50,
  });
  for (const h of stale) {
    await settleHold({ id: h.id }, h.sessionSec != null ? h.sessionSec + OUTBOUND_SAFETY_SEC : 0).catch(() => {});
  }
}
