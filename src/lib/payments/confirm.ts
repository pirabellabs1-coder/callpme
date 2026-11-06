import { prisma } from "@/lib/db/client";
import { getGeniusPaymentStatus, isFailed, isPaid } from "@/lib/payments/geniuspay";
import { extendPaidUntil } from "@/lib/billing/subscription";
import { sendPaymentReceipt } from "@/lib/payments/notify";

/**
 * Confirme un paiement (revérifie le statut côté GeniusPay, authentifié) et,
 * s'il est payé, applique l'offre à l'organisation. Idempotent.
 * Utilisé par la page de retour ET par le webhook.
 */
/**
 * Numéro de facture séquentiel et unique (FAC-2026-000001), attribué une
 * seule fois à un paiement confirmé. La séquence Postgres garantit l'unicité
 * même avec des confirmations simultanées.
 */
export async function assignInvoiceNumber(paymentId: string): Promise<string | null> {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId }, select: { invoiceNumber: true, createdAt: true } });
  if (!existing) return null;
  if (existing.invoiceNumber) return existing.invoiceNumber;
  await prisma.$executeRawUnsafe('CREATE SEQUENCE IF NOT EXISTS invoice_seq');
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('invoice_seq') AS n`;
  const number = `FAC-${existing.createdAt.getFullYear()}-${String(rows[0].n).padStart(6, "0")}`;
  await prisma.payment.updateMany({ where: { id: paymentId, invoiceNumber: null }, data: { invoiceNumber: number } });
  return number;
}

/** Applique l'offre payée et prolonge la période de 30 jours. */
export async function activatePaidPlan(organizationId: string, plan: string | null) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true, paidUntil: true } });
  if (!org) return;
  const newPlan = plan ?? org.plan;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: newPlan, paidUntil: extendPaidUntil(org, newPlan) },
  });
}

export async function confirmAndActivatePayment(
  paymentId: string,
): Promise<"completed" | "pending" | "failed" | "notfound"> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return "notfound";
  if (payment.status === "completed") return "completed";

  const status = payment.reference
    ? await getGeniusPaymentStatus(payment.reference)
    : null;
  if (isFailed(status)) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "failed" } });
    return "failed";
  }
  if (!isPaid(status)) return "pending";

  // Crédit d'appels sortants : paiement marqué payé ET crédit ajouté dans la même transaction.
  if (payment.kind === "credit") {
    const done = await prisma.$transaction(async (tx) => {
      const c = await tx.payment.updateMany({ where: { id: payment.id, status: { not: "completed" } }, data: { status: "completed" } });
      if (c.count !== 1) return false;
      await tx.organization.update({
        where: { id: payment.organizationId },
        data: { callCreditCents: { increment: Math.max(0, Math.round(payment.amountEur * 100)) } },
      });
      return true;
    });
    if (done) {
      await assignInvoiceNumber(payment.id);
      await sendPaymentReceipt(payment.id);
    }
    return "completed";
  }

  // Passage à « completed » une seule fois (page de retour et webhook peuvent arriver ensemble).
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "completed" } },
    data: { status: "completed" },
  });
  if (claimed.count !== 1) return "completed";
  await assignInvoiceNumber(payment.id);
  if (payment.kind === "topup") {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: { extraMinutes: { increment: Math.max(0, payment.minutes ?? 0) } },
    });
    await sendPaymentReceipt(payment.id);
    return "completed";
  }
  await activatePaidPlan(payment.organizationId, payment.plan);
  if (payment.promoCode) {
    await prisma.promoCode.update({ where: { code: payment.promoCode }, data: { redeemedCount: { increment: 1 } } }).catch(() => {});
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

  // Reçu + facture par e-mail (après l'activation, pour indiquer la nouvelle échéance).
  await sendPaymentReceipt(payment.id);
  return "completed";
}
