"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { isRateLimited } from "@/lib/security/rate-limit";
import { asCurrency, formatAmount, HARD_MAX_XOF, maxXof, parseItemLines } from "@/lib/payments/merchant-rules";
import { MIN_XOF } from "@/lib/payments/geniuspay";
import { EXPIRY_MS } from "@/lib/payments/merchant";

export interface PaymentSettingsResult {
  ok?: boolean;
  error?: string;
}

const keyField = z.string().trim().max(300).regex(/^[\x21-\x7e]*$/, "Clé invalide (espaces ou caractères spéciaux).");

const schema = z.object({
  apiKey: keyField,
  apiSecret: keyField,
  webhookSecret: keyField,
  currency: z.enum(["XOF", "EUR"]),
  maxAmount: z.coerce.number().int("Plafond : nombre entier.").positive("Plafond : montant positif."),
  allowCustomAmount: z.enum(["on", "off"]).default("off"),
  delivery: z.enum(["sms", "whatsapp"]),
  items: z.string().max(5000).default(""),
});

async function hasRecentPending(organizationId: string): Promise<boolean> {
  const n = await prisma.paymentRequest.count({
    where: { organizationId, status: "pending", reference: { not: null }, createdAt: { gt: new Date(Date.now() - EXPIRY_MS) } },
  });
  return n > 0;
}

/** Enregistre le compte GeniusPay marchand de l'organisation (clés chiffrées). */
export async function savePaymentSettings(formData: FormData): Promise<PaymentSettingsResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  if (isRateLimited(`pay-settings:${session.org.id}`, 20, 60 * 60_000)) return { error: "Trop de tentatives. Réessayez plus tard." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;
  const currency = asCurrency(d.currency);

  if (maxXof({ currency, maxAmount: d.maxAmount }) < MIN_XOF) return { error: `Plafond trop bas (minimum ${formatAmount(MIN_XOF, "XOF")}).` };
  if (currency === "XOF" && d.maxAmount > HARD_MAX_XOF) return { error: "Plafond maximal : 2 000 000 FCFA par demande." };
  if (currency === "EUR" && d.maxAmount > 3000) return { error: "Plafond maximal : 3 000 € par demande." };
  const items = parseItemLines(d.items, currency);
  if ("error" in items) return { error: items.error };
  if (d.allowCustomAmount !== "on" && items.items.length === 0) {
    return { error: "Ajoutez au moins un tarif, ou autorisez les montants libres." };
  }

  const existing = await prisma.paymentSettings.findUnique({ where: { organizationId: session.org.id }, select: { id: true } });
  // Clés : obligatoires à la première configuration, conservées si laissées vides ensuite.
  if (!existing && (!d.apiKey || !d.apiSecret || !d.webhookSecret)) {
    return { error: "La clé publique, la clé secrète et le secret du webhook GeniusPay sont requis." };
  }
  if (d.apiKey && !/^pk_/.test(d.apiKey)) return { error: "Clé publique GeniusPay attendue (commence par pk_)." };
  if (d.apiSecret && !/^sk_/.test(d.apiSecret)) return { error: "Clé secrète GeniusPay attendue (commence par sk_)." };
  if (d.webhookSecret && d.webhookSecret.length < 16) return { error: "Secret du webhook trop court." };

  // Changer de compte orphelinerait les liens déjà envoyés (statut illisible avec d'autres clés).
  if (existing && (d.apiKey || d.apiSecret) && (await hasRecentPending(session.org.id))) {
    return { error: "Des paiements sont en attente : changez de clés quand ils seront réglés ou expirés (48 h au plus)." };
  }

  const data = {
    currency,
    maxAmount: d.maxAmount,
    allowCustomAmount: d.allowCustomAmount === "on",
    delivery: d.delivery,
    items: JSON.stringify(items.items),
    ...(d.apiKey ? { apiKey: encryptSecret(d.apiKey)! } : {}),
    ...(d.apiSecret ? { apiSecret: encryptSecret(d.apiSecret)! } : {}),
    ...(d.webhookSecret ? { webhookSecret: encryptSecret(d.webhookSecret)! } : {}),
  };
  if (existing) {
    await prisma.paymentSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.paymentSettings.create({
      data: {
        ...data,
        apiKey: encryptSecret(d.apiKey)!,
        apiSecret: encryptSecret(d.apiSecret)!,
        webhookSecret: encryptSecret(d.webhookSecret)!,
        organizationId: session.org.id,
        webhookToken: randomBytes(24).toString("base64url"),
        enabled: true,
      },
    });
  }
  revalidatePath("/payments");
  return { ok: true };
}

/** Active ou suspend l'encaissement par les agents. */
export async function setPaymentsEnabled(enabled: boolean): Promise<PaymentSettingsResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  const r = await prisma.paymentSettings.updateMany({ where: { organizationId: session.org.id }, data: { enabled: Boolean(enabled) } });
  if (r.count === 0) return { error: "Configurez d'abord votre compte GeniusPay." };
  revalidatePath("/payments");
  return { ok: true };
}

/** Supprime les clés marchandes (l'historique des demandes est conservé). */
export async function removePaymentSettings(): Promise<PaymentSettingsResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  if (await hasRecentPending(session.org.id)) {
    return { error: "Des paiements sont en attente : suspendez plutôt l'encaissement, puis supprimez les clés quand ils seront réglés ou expirés (48 h au plus)." };
  }
  await prisma.paymentSettings.deleteMany({ where: { organizationId: session.org.id } });
  revalidatePath("/payments");
  return { ok: true };
}
