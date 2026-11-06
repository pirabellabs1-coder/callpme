/**
 * Crédit prépayé des appels sortants (centimes d'euro). Un appel sortant ne
 * part que si le crédit couvre au moins une minute vers la destination, sa
 * durée est plafonnée par le crédit, et il est débité à la fin. Ainsi un appel
 * sortant est toujours payé d'avance : jamais à perte.
 */
import { prisma } from "../db/client";
import { maxSecondsForCredit, outboundChargeCents, outboundDestinationOpen, outboundRateCents } from "./outbound-rates";

export async function creditBalanceCents(organizationId: string): Promise<number> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { callCreditCents: true } });
  return Math.max(0, org?.callCreditCents ?? 0);
}

export interface OutboundCheck {
  ok: boolean;
  error?: string;
  /** Durée maximale permise par le crédit. */
  maxSeconds?: number;
}

/** Le crédit permet-il d'appeler `to` (au moins une minute) ? */
export async function checkOutboundCredit(organizationId: string, to: string): Promise<OutboundCheck> {
  if (!outboundDestinationOpen(to)) {
    return { ok: false, error: "Cette destination n'est pas encore ouverte aux appels sortants (France, Bénin et Côte d'Ivoire pour l'instant)." };
  }
  const credit = await creditBalanceCents(organizationId);
  if (credit < outboundRateCents(to)) {
    return { ok: false, error: "Crédit d'appels sortants insuffisant. Rechargez-le dans Facturation (Mobile Money ou carte)." };
  }
  return { ok: true, maxSeconds: maxSecondsForCredit(credit, to) };
}

/** Débite un appel sortant terminé (minute entamée due). Jamais en dessous de zéro. */
export async function chargeOutboundCall(organizationId: string, to: string, durationSec: number): Promise<number> {
  const cents = outboundChargeCents(durationSec, to);
  if (cents <= 0) return 0;
  await prisma.$executeRaw`UPDATE "Organization" SET "callCreditCents" = GREATEST(0, "callCreditCents" - ${cents}) WHERE id = ${organizationId}`;
  return cents;
}
