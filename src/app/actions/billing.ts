"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { isPlanId, getPlan, PLANS } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/resend";
import { subscriptionEmail } from "@/lib/email/templates";
import {
  createGeniusPayment,
  eurToXof,
  geniusConfigured,
} from "@/lib/payments/geniuspay";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.callpme.com";

export interface BillingResult {
  ok?: boolean;
  error?: string;
}

export interface CheckoutResult {
  url?: string;
  error?: string;
}

/** Change l'offre de l'organisation courante. Persisté et appliqué aussitôt. */
export async function switchPlan(planId: string): Promise<BillingResult> {
  const session = await requireSession();
  if (!isPlanId(planId)) return { error: "Offre inconnue." };

  await prisma.organization.update({
    where: { id: session.org.id },
    data: { plan: planId },
  });

  // Confirmation par e-mail (best-effort)
  const mail = subscriptionEmail(session.user.name ?? "", getPlan(planId).name);
  void sendEmail({
    to: session.user.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  }).catch(() => {});

  revalidatePath("/billing");
  return { ok: true };
}

/** Démarre un paiement GeniusPay pour Starter/Pro. Renvoie l'URL de checkout. */
export async function startCheckout(planId: string): Promise<CheckoutResult> {
  const session = await requireSession();
  if (planId !== "starter" && planId !== "pro") {
    return { error: "Cette offre n'est pas payable directement." };
  }
  if (!geniusConfigured()) return { error: "Paiement momentanément indisponible." };
  const plan = PLANS[planId];
  const amountEur = plan.priceMonthly ?? 0;
  const payment = await prisma.payment.create({
    data: {
      organizationId: session.org.id,
      kind: "subscription",
      plan: planId,
      amountEur,
      amountXof: eurToXof(amountEur),
      status: "pending",
    },
  });
  const result = await createGeniusPayment({
    amountEur,
    description: `Abonnement Callpme — ${plan.name}`,
    customer: { name: session.user.name ?? session.user.email, email: session.user.email },
    metadata: { paymentId: payment.id, orgId: session.org.id, plan: planId, kind: "subscription" },
    successUrl: `${PUBLIC_URL}/billing/retour?pid=${payment.id}`,
    errorUrl: `${PUBLIC_URL}/billing/retour?pid=${payment.id}&e=1`,
  });
  if (!result) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    return { error: "Le paiement n'a pas pu être initié. Réessayez." };
  }
  await prisma.payment.update({ where: { id: payment.id }, data: { reference: result.reference } });
  return { url: result.checkoutUrl };
}

/** Le client envoie une demande pour l'offre Agence (objectifs + budget). */
export async function submitAgencyRequest(formData: FormData): Promise<BillingResult> {
  const session = await requireSession();
  const objectives = String(formData.get("objectives") || "").trim();
  const budget = Math.max(0, parseInt(String(formData.get("budget") || "0"), 10) || 0);
  const name = String(formData.get("name") || session.user.name || "").trim();
  const email = String(formData.get("email") || session.user.email).trim();
  if (objectives.length < 5) return { error: "Décrivez vos objectifs (quelques mots)." };

  await prisma.agencyRequest.create({
    data: {
      organizationId: session.org.id,
      contactName: name || email,
      contactEmail: email,
      objectives,
      budgetEur: budget,
      status: "pending",
    },
  });

  void sendEmail({
    to: "contact@pirabellabs.com",
    subject: "Nouvelle demande — Offre Agence Callpme",
    html:
      `<p>Nouvelle demande d'offre <b>Agence</b>.</p>` +
      `<p><b>Organisation :</b> ${session.org.name}<br/>` +
      `<b>Contact :</b> ${name} (${email})<br/>` +
      `<b>Budget annoncé :</b> ${budget} €</p>` +
      `<p><b>Objectifs :</b><br/>${objectives.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>` +
      `<p>Validez et fixez le montant dans l'admin : ${PUBLIC_URL}/admin/demandes</p>`,
    text: `Demande Agence de ${session.org.name} — budget ${budget} €\n\n${objectives}`,
  }).catch(() => {});

  revalidatePath("/billing");
  return { ok: true };
}

/** Le client paie le montant fixé par l'admin pour sa demande Agence. */
export async function payAgencyRequest(requestId: string): Promise<CheckoutResult> {
  const session = await requireSession();
  const reqRow = await prisma.agencyRequest.findUnique({ where: { id: requestId } });
  if (!reqRow || reqRow.organizationId !== session.org.id) {
    return { error: "Demande introuvable." };
  }
  if (reqRow.status !== "quoted" || !reqRow.quotedAmountEur) {
    return { error: "Le montant n'a pas encore été fixé par l'équipe." };
  }
  if (!geniusConfigured()) return { error: "Paiement momentanément indisponible." };
  const amountEur = reqRow.quotedAmountEur;
  const payment = await prisma.payment.create({
    data: {
      organizationId: session.org.id,
      kind: "agency",
      plan: "agency",
      amountEur,
      amountXof: eurToXof(amountEur),
      status: "pending",
    },
  });
  const result = await createGeniusPayment({
    amountEur,
    description: "Offre Agence Callpme",
    customer: { name: reqRow.contactName, email: reqRow.contactEmail },
    metadata: {
      paymentId: payment.id,
      orgId: session.org.id,
      plan: "agency",
      kind: "agency",
      agencyRequestId: requestId,
    },
    successUrl: `${PUBLIC_URL}/billing/retour?pid=${payment.id}`,
    errorUrl: `${PUBLIC_URL}/billing/retour?pid=${payment.id}&e=1`,
  });
  if (!result) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    return { error: "Le paiement n'a pas pu être initié. Réessayez." };
  }
  await prisma.payment.update({ where: { id: payment.id }, data: { reference: result.reference } });
  return { url: result.checkoutUrl };
}
