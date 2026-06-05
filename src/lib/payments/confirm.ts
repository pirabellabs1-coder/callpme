import { prisma } from "@/lib/db/client";
import { getGeniusPaymentStatus, isPaid } from "@/lib/payments/geniuspay";

/**
 * Confirme un paiement (revérifie le statut côté GeniusPay, authentifié) et,
 * s'il est payé, applique l'offre à l'organisation. Idempotent.
 * Utilisé par la page de retour ET par le webhook.
 */
export async function confirmAndActivatePayment(
  paymentId: string,
): Promise<"completed" | "pending" | "failed" | "notfound"> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return "notfound";
  if (payment.status === "completed") return "completed";

  const status = payment.reference
    ? await getGeniusPaymentStatus(payment.reference)
    : null;
  if (!isPaid(status)) return "pending";

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "completed" },
  });

  if (payment.plan) {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: { plan: payment.plan },
    });
  }

  // Offre Agence : marque la demande devisée comme payée.
  if (payment.kind === "agency") {
    const quoted = await prisma.agencyRequest.findFirst({
      where: { organizationId: payment.organizationId, status: "quoted" },
      orderBy: { createdAt: "desc" },
    });
    if (quoted) {
      await prisma.agencyRequest.update({
        where: { id: quoted.id },
        data: { status: "paid" },
      });
    }
  }

  return "completed";
}
