"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { PLANS } from "@/lib/billing/plans";
import { applyPromo } from "@/lib/billing/subscription";
import { activatePaidPlan, assignInvoiceNumber } from "@/lib/payments/confirm";
import { getPack } from "@/lib/billing/topups";
import { orgSubscription } from "@/lib/billing/limits";
import { isRateLimited } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import {
  createGeniusPayment,
  eurToXof,
  MIN_XOF,
  geniusConfigured,
} from "@/lib/payments/geniuspay";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://callpme.com";

export interface BillingResult {
  ok?: boolean;
  error?: string;
}

export interface CheckoutResult {
  url?: string;
  error?: string;
  /** Activé sans paiement (code promo à 100 %). */
  activated?: boolean;
}

/** Code promo utilisable par cette organisation (actif, non expiré, places restantes, pas déjà utilisé). */
async function usablePromo(raw: string, orgId: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { error: "Code promo inconnu ou désactivé." } as const;
  if (promo.expiresAt && promo.expiresAt < new Date()) return { error: "Ce code promo a expiré." } as const;
  if (promo.maxRedemptions > 0 && promo.redeemedCount >= promo.maxRedemptions) return { error: "Ce code promo a déjà été entièrement utilisé." } as const;
  const already = await prisma.payment.findFirst({ where: { organizationId: orgId, promoCode: code, status: "completed" }, select: { id: true } });
  if (already) return { error: "Vous avez déjà utilisé ce code promo." } as const;
  return { promo } as const;
}

/** Réserve une utilisation du code, sans jamais dépasser le maximum (atomique). */
async function claimPromo(code: string, max: number): Promise<boolean> {
  const r = await prisma.promoCode.updateMany({
    where: max > 0 ? { code, redeemedCount: { lt: max } } : { code },
    data: { redeemedCount: { increment: 1 } },
  });
  return r.count === 1;
}

/** Activation sans paiement (code promo couvrant tout le prix, déjà réservé). */
async function activateFree(orgId: string, plan: string, code: string) {
  const p = await prisma.payment.create({
    data: { organizationId: orgId, kind: "promo", plan, amountEur: 0, amountXof: 0, status: "completed", promoCode: code },
  });
  await assignInvoiceNumber(p.id);
  await activatePaidPlan(orgId, plan);
  revalidatePath("/billing");
  revalidatePath("/", "layout");
}

/**
 * Démarre un paiement GeniusPay pour Starter/Pro : nouvelle offre ou
 * renouvellement de l'offre actuelle (+30 jours). Code promo facultatif.
 */
export async function startCheckout(planId: string, promoCode = ""): Promise<CheckoutResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Seul un administrateur peut gérer l'abonnement." };
  if (planId !== "starter" && planId !== "pro") {
    return { error: "Cette offre n'est pas payable directement." };
  }
  const plan = PLANS[planId];
  let amountEur = plan.priceMonthly ?? 0;
  let code: string | null = null;
  const found = await usablePromo(promoCode, session.org.id);
  if (found && "error" in found) return { error: found.error };
  if (found) {
    if (found.promo.discountType === "plan") return { error: "Ce code offre une offre : utilisez le bouton « Utiliser le code »." };
    amountEur = applyPromo(amountEur, found.promo);
    code = found.promo.code;
    if (amountEur <= 0) {
      if (!(await claimPromo(code, found.promo.maxRedemptions))) return { error: "Ce code promo a déjà été entièrement utilisé." };
      await activateFree(session.org.id, planId, code);
      return { activated: true };
    }
  }
  if (!geniusConfigured()) return { error: "Paiement momentanément indisponible." };
  if (eurToXof(amountEur) < MIN_XOF) return { error: "Montant trop faible pour un paiement en ligne." };
  const payment = await prisma.payment.create({
    data: {
      organizationId: session.org.id,
      kind: "subscription",
      plan: planId,
      amountEur,
      amountXof: eurToXof(amountEur),
      status: "pending",
      promoCode: code,
    },
  });
  const result = await createGeniusPayment({
    amountEur,
    description: `Abonnement Callpme — ${plan.name} (30 jours)`,
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

/** Code promo qui offre une offre (30 jours) sans paiement. */
export async function redeemPromo(promoCode: string): Promise<BillingResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Seul un administrateur peut gérer l'abonnement." };
  if (isRateLimited(`promo:${session.org.id}`, 10, 60 * 60_000)) return { error: "Trop de tentatives. Réessayez plus tard." };
  const found = await usablePromo(promoCode, session.org.id);
  if (!found) return { error: "Saisissez un code promo." };
  if ("error" in found) return { error: found.error };
  if (found.promo.discountType !== "plan" || !found.promo.grantPlan) {
    return { error: "Ce code donne une réduction : choisissez une offre puis payez avec le code." };
  }
  if (!(await claimPromo(found.promo.code, found.promo.maxRedemptions))) {
    return { error: "Ce code promo a déjà été entièrement utilisé." };
  }
  await activateFree(session.org.id, found.promo.grantPlan, found.promo.code);
  return { ok: true };
}

/** Le client envoie une demande pour l'offre Agence (objectifs + budget). */
/** Échappe un texte saisi avant insertion dans un e-mail HTML. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
      `<p><b>Organisation :</b> ${esc(session.org.name)}<br/>` +
      `<b>Contact :</b> ${esc(name)} (${esc(email)})<br/>` +
      `<b>Budget annoncé :</b> ${budget} €</p>` +
      `<p><b>Objectifs :</b><br/>${esc(objectives).replace(/\n/g, "<br/>")}</p>` +
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

/** Recharge de minutes en Mobile Money (s'ajoutent à l'offre, restent acquises). */
export async function startTopup(packId: string): Promise<CheckoutResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Seul un administrateur peut acheter des minutes." };
  const pack = getPack(packId);
  if (!pack) return { error: "Recharge inconnue." };
  const sub = await orgSubscription(session.org.id);
  if (sub.status === "expired") return { error: "Renouvelez d'abord votre offre : les minutes rechargées s'utilisent avec une offre active." };
  if (!geniusConfigured()) return { error: "Paiement momentanément indisponible." };
  const payment = await prisma.payment.create({
    data: {
      organizationId: session.org.id,
      kind: "topup",
      minutes: pack.minutes,
      amountEur: pack.priceEur,
      amountXof: eurToXof(pack.priceEur),
      status: "pending",
    },
  });
  const result = await createGeniusPayment({
    amountEur: pack.priceEur,
    description: `Recharge Callpme — ${pack.label}`,
    customer: { name: session.user.name ?? session.user.email, email: session.user.email },
    metadata: { paymentId: payment.id, orgId: session.org.id, kind: "topup", minutes: String(pack.minutes) },
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
