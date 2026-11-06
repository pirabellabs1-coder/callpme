/**
 * État de paiement d'une organisation. Une offre affichée ne suffit pas : les
 * actions qui coûtent de l'argent à la plateforme (achat de numéros…)
 * exigent une période payée en cours.
 */
import { prisma } from "../db/client";

export async function hasPaidSubscription(organizationId: string, now = new Date()): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { paidUntil: true } });
  return Boolean(org?.paidUntil && org.paidUntil > now);
}
