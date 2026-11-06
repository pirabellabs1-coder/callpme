/**
 * État de paiement d'une organisation. Une offre affichée ne suffit pas : les
 * actions qui coûtent de l'argent à la plateforme (achat de numéros…)
 * exigent un paiement réellement confirmé récemment.
 */
import { prisma } from "../db/client";

/** Durée couverte par un paiement d'abonnement (mensuel + marge). */
const PAID_PERIOD_DAYS = 35;

export async function hasPaidSubscription(organizationId: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - PAID_PERIOD_DAYS * 86_400_000);
  const paid = await prisma.payment.findFirst({
    where: { organizationId, status: "completed", createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(paid);
}
