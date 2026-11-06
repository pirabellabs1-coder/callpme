/**
 * E-mails liés aux paiements : reçu avec facture après chaque paiement
 * confirmé. Toujours « au mieux » : un e-mail qui échoue ne bloque jamais
 * l'activation d'une offre.
 */
import { prisma } from "@/lib/db/client";
import { getPlan } from "@/lib/billing/plans";
import { hasResend, sendEmail } from "@/lib/email/resend";
import { paymentReceiptEmail } from "@/lib/email/templates";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://callpme.com";

/** Destinataires de la facturation : propriétaire et administrateurs de l'organisation. */
export async function billingRecipients(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId, role: { in: ["owner", "admin"] }, clientId: null },
    select: { email: true, name: true },
  });
}

export function paymentLabel(p: { kind: string; plan: string | null; minutes: number | null; amountEur: number }): string {
  if (p.kind === "topup") return `Recharge de ${new Intl.NumberFormat("fr-FR").format(p.minutes ?? 0)} minutes d'appel`;
  if (p.kind === "credit") return "Crédit d'appels sortants";
  if (p.kind === "agency") return "Offre Agence";
  return `Offre ${getPlan(p.plan).name} · 30 jours`;
}

export async function sendPaymentReceipt(paymentId: string): Promise<void> {
  if (!hasResend()) return;
  try {
    const p = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { organization: { select: { name: true, paidUntil: true } } },
    });
    if (!p || p.status !== "completed") return;
    const to = await billingRecipients(p.organizationId);
    const isPlan = p.kind === "subscription" || p.kind === "agency" || p.kind === "promo";
    await Promise.allSettled(
      to.map((u) => {
        const mail = paymentReceiptEmail({
          name: u.name ?? "",
          orgName: p.organization.name,
          label: paymentLabel(p),
          amountEur: p.amountEur,
          invoiceNumber: p.invoiceNumber,
          invoiceUrl: `${PUBLIC_URL}/facture/${p.id}`,
          paidAt: p.createdAt,
          activeUntil: isPlan ? p.organization.paidUntil : null,
        });
        return sendEmail({ to: u.email, subject: mail.subject, html: mail.html, text: mail.text });
      }),
    );
  } catch (e) {
    console.error("[e-mail] reçu de paiement :", paymentId, e instanceof Error ? e.message : e);
  }
}
