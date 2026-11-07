/**
 * Encaissement pendant l'appel — SERVEUR uniquement.
 *
 * L'agent crée un lien de paiement GeniusPay sur le compte MARCHAND de
 * l'entreprise cliente (ses propres clés, chiffrées en base) : l'argent va à
 * l'entreprise, jamais à Callpme. Le lien est envoyé par SMS (ou WhatsApp) au
 * numéro de l'appelant ; le paiement se fait sur la page GeniusPay : aucune
 * donnée de carte ni de compte Mobile Money ne transite par Callpme.
 *
 * Le statut n'est jamais cru sur parole : il est relu auprès de GeniusPay
 * (appel authentifié) avant d'être enregistré. Transitions idempotentes.
 */
import { prisma } from "../db/client";
import { decryptSecret } from "../crypto/secrets";
import { createNotification } from "../db/notifications";
import { sendSms } from "../telephony/sms";
import { sendWhatsAppText } from "../whatsapp/cloud";
import { createGeniusPayment, getGeniusPaymentStatus, verifyGeniusWebhook, type GeniusCredentials } from "./geniuspay";
import {
  asCurrency,
  formatAmount,
  MAX_REQUESTS_PER_CALL,
  parseItems,
  paymentIdempotencyKey,
  paymentStatusFrom,
  resolvePaymentAmount,
  type PaymentRules,
} from "./merchant-rules";
import type { ToolContext, ToolResult } from "../shared/types";

const PUBLIC_URL = (process.env.PUBLIC_URL || "https://callpme.com").replace(/\/$/, "");

export interface MerchantAccount {
  organizationId: string;
  enabled: boolean;
  rules: PaymentRules;
  delivery: "sms" | "whatsapp";
  creds: GeniusCredentials;
}

/** Compte marchand de l'organisation (clés déchiffrées), ou null s'il n'existe pas. */
export async function merchantAccount(organizationId: string): Promise<MerchantAccount | null> {
  const s = await prisma.paymentSettings.findUnique({ where: { organizationId } });
  if (!s) return null;
  const apiKey = decryptSecret(s.apiKey);
  const apiSecret = decryptSecret(s.apiSecret);
  if (!apiKey || !apiSecret) return null;
  return {
    organizationId,
    enabled: s.enabled,
    rules: {
      currency: asCurrency(s.currency),
      maxAmount: s.maxAmount,
      allowCustomAmount: s.allowCustomAmount,
      items: parseItems(s.items),
    },
    delivery: s.delivery === "whatsapp" ? "whatsapp" : "sms",
    creds: { apiKey, apiSecret },
  };
}

/** Numéro de l'appelant exploitable (pas « navigateur » / « test »). */
function callerPhone(ctx: ToolContext): string | undefined {
  return /\d{6,}/.test(ctx.callerNumber) ? ctx.callerNumber : undefined;
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : undefined;

/** Envoie le lien : WhatsApp si choisi et connecté (repli SMS), sinon SMS. */
async function deliverLink(
  ctx: ToolContext,
  to: string,
  text: string,
  delivery: "sms" | "whatsapp",
): Promise<"sms" | "whatsapp" | null> {
  if (delivery === "whatsapp") {
    const wa = await prisma.whatsAppChannel.findUnique({ where: { organizationId: ctx.organizationId } });
    const token = wa?.enabled ? decryptSecret(wa.accessToken) : null;
    if (wa && token && (await sendWhatsAppText(wa.phoneNumberId, token, to, text))) return "whatsapp";
  }
  const r = await sendSms(to, text, { callId: ctx.callId, organizationId: ctx.organizationId });
  return r.ok ? "sms" : null;
}

/** Outil `requestPayment` : crée le lien GeniusPay et l'envoie à l'appelant. */
export async function requestPaymentTool(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (ctx.test) {
    return {
      ok: false,
      message: "Conversation de test : aucun lien de paiement n'est créé ni envoyé. Dis à l'utilisateur que l'encaissement ne fonctionne que pendant un vrai appel.",
      data: { test: true },
    };
  }
  const account = await merchantAccount(ctx.organizationId);
  if (!account?.enabled) {
    return { ok: false, message: "L'encaissement n'est pas activé pour cette entreprise : propose de prendre un message pour l'équipe." };
  }
  const to = callerPhone(ctx);
  if (!to) return { ok: false, message: "Numéro de l'appelant inconnu : impossible d'envoyer le lien de paiement." };
  const reason = str(args.reason, 120);
  if (!reason) return { ok: false, message: "Motif du paiement manquant." };

  const amount = resolvePaymentAmount({ amount: args.amount, item: args.item }, account.rules);
  if (!amount.ok) return { ok: false, message: amount.message };
  const label = formatAmount(amount.amount, account.rules.currency);

  const key = paymentIdempotencyKey(ctx.organizationId, ctx.callId, amount.amountXof, reason);
  const existing = await prisma.paymentRequest.findUnique({ where: { idempotencyKey: key } });
  if (existing?.status === "completed") {
    return { ok: true, message: `Ce paiement (${label}) est déjà reçu.`, data: { status: "completed", requestId: existing.id } };
  }
  // Demande restée « en cours » sans lien envoyé (interruption pendant la création) : abandonnée.
  const stale = existing?.status === "pending" && !existing.channel && Date.now() - existing.createdAt.getTime() > 60_000;
  if (existing?.status === "pending" && !stale) {
    return {
      ok: true,
      message: existing.channel
        ? `Le lien de paiement de ${label} a déjà été envoyé${existing.channel === "whatsapp" ? " sur WhatsApp" : " par SMS"} : ne le renvoie pas, invite l'appelant à l'ouvrir.`
        : `Le lien de paiement de ${label} est en cours d'envoi : ne le redemande pas.`,
      data: { status: "pending", requestId: existing.id, alreadySent: true },
    };
  }
  // Une demande échouée (ou abandonnée) peut être retentée : on repart d'une ligne neuve.
  if (existing) {
    await prisma.paymentRequest.deleteMany({
      where: { id: existing.id, OR: [{ status: "failed" }, { status: "pending", channel: null }] },
    });
  }

  const perCall = await prisma.paymentRequest.count({ where: { organizationId: ctx.organizationId, callRef: ctx.callId } });
  if (perCall >= MAX_REQUESTS_PER_CALL) {
    return { ok: false, message: "Nombre maximal de demandes de paiement atteint pour cet appel : propose de prendre un message." };
  }

  let request;
  try {
    request = await prisma.paymentRequest.create({
      data: {
        organizationId: ctx.organizationId,
        agentId: ctx.agentId,
        callRef: ctx.callId,
        amount: amount.amount,
        currency: account.rules.currency,
        amountXof: amount.amountXof,
        reason,
        customerPhone: to,
        idempotencyKey: key,
      },
    });
  } catch (e) {
    // Double appel simultané : l'autre requête crée le lien.
    if ((e as { code?: string }).code === "P2002") {
      return { ok: true, message: `Le lien de paiement de ${label} est en cours d'envoi : ne le redemande pas.`, data: { status: "pending" } };
    }
    throw e;
  }

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } });
  const orgName = org?.name ?? "Votre interlocuteur";
  const created = await createGeniusPayment({
    amountEur: 0,
    amountXof: amount.amountXof,
    description: `${orgName} — ${reason}`.slice(0, 200),
    customer: { name: `Client ${orgName}`.slice(0, 80), phone: to },
    metadata: { paymentRequestId: request.id, organizationId: ctx.organizationId, kind: "call_payment" },
    successUrl: `${PUBLIC_URL}/paiement/${request.id}`,
    errorUrl: `${PUBLIC_URL}/paiement/${request.id}?e=1`,
    creds: account.creds,
  });
  if (!created) {
    await prisma.paymentRequest.update({ where: { id: request.id }, data: { status: "failed" } });
    return { ok: false, message: "Le lien de paiement n'a pas pu être créé (service de paiement indisponible). Propose de prendre un message." };
  }
  await prisma.paymentRequest.update({
    where: { id: request.id },
    data: { reference: created.reference, checkoutUrl: created.checkoutUrl },
  });

  const text = `${orgName} : paiement de ${label} (${reason}). Payez par Mobile Money ou carte sur la page sécurisée : ${created.checkoutUrl}`;
  const channel = await deliverLink(ctx, to, text, account.delivery);
  if (!channel) {
    await prisma.paymentRequest.update({ where: { id: request.id }, data: { status: "failed" } });
    return { ok: false, message: "Le lien de paiement n'a pas pu être envoyé à l'appelant. Propose de prendre un message." };
  }
  await prisma.paymentRequest.update({ where: { id: request.id }, data: { channel } });
  return {
    ok: true,
    message: `Lien de paiement de ${label} envoyé ${channel === "whatsapp" ? "sur WhatsApp" : "par SMS"}. Invite l'appelant à l'ouvrir et à valider sur son téléphone ; tu peux vérifier la réception avec checkPayment.`,
    data: { status: "pending", requestId: request.id, amount: label, channel },
  };
}

/** Dernière vérification auprès de GeniusPay, par demande (limite les appels). */
const lastCheck = new Map<string, number>();
const CHECK_INTERVAL_MS = 4000;

/**
 * Relit le statut d'une demande auprès de GeniusPay et l'enregistre.
 * Idempotent : seul le premier passage « payé » notifie l'entreprise.
 * `organizationId` (webhook) : la demande doit appartenir à cette organisation.
 */
export async function confirmPaymentRequest(
  requestId: string,
  opts: { organizationId?: string; force?: boolean } = {},
): Promise<"pending" | "completed" | "failed" | null> {
  const req = await prisma.paymentRequest.findUnique({ where: { id: requestId } });
  if (!req || (opts.organizationId && req.organizationId !== opts.organizationId)) return null;
  if (req.status !== "pending") return req.status as "completed" | "failed";
  if (!req.reference) return "pending";

  const now = Date.now();
  if (!opts.force && now - (lastCheck.get(req.id) ?? 0) < CHECK_INTERVAL_MS) return "pending";
  lastCheck.set(req.id, now);
  if (lastCheck.size > 5000) lastCheck.clear();

  const account = await merchantAccount(req.organizationId);
  if (!account) return "pending";
  const status = paymentStatusFrom(await getGeniusPaymentStatus(req.reference, account.creds));
  if (status === "pending") return "pending";

  const changed = await prisma.paymentRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: status === "completed" ? { status, paidAt: new Date() } : { status },
  });
  if (changed.count === 1 && status === "completed") {
    await createNotification(req.organizationId, {
      type: "info",
      title: "Paiement reçu pendant un appel",
      body: `${formatAmount(req.amount, asCurrency(req.currency))} — ${req.reason}`,
      href: "/payments",
    }).catch(() => {});
  }
  return status;
}

/** Outil `checkPayment` : l'agent vérifie si l'appelant a payé. */
export async function checkPaymentTool(_args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (ctx.test) return { ok: false, message: "Conversation de test : aucun paiement réel à vérifier.", data: { test: true } };
  const req = await prisma.paymentRequest.findFirst({
    where: { organizationId: ctx.organizationId, callRef: ctx.callId },
    orderBy: { createdAt: "desc" },
  });
  if (!req) return { ok: false, message: "Aucune demande de paiement pendant cet appel." };
  const status = (await confirmPaymentRequest(req.id)) ?? "pending";
  const label = `${formatAmount(req.amount, asCurrency(req.currency))} (${req.reason})`;
  if (status === "completed") return { ok: true, message: `Paiement reçu : ${label}. Remercie l'appelant.`, data: { status } };
  if (status === "failed") {
    return { ok: true, message: `Le paiement de ${label} a échoué ou a été annulé. Propose de réessayer ou de prendre un message.`, data: { status } };
  }
  return {
    ok: true,
    message: `Paiement de ${label} pas encore reçu. Invite l'appelant à ouvrir le lien et à valider sur son téléphone, puis revérifie dans quelques secondes.`,
    data: { status },
  };
}

/**
 * Webhook GeniusPay d'un compte marchand. L'URL porte un jeton aléatoire
 * propre à l'organisation ; la signature HMAC (secret du webhook de
 * l'entreprise) est obligatoire, puis le statut est revérifié auprès de
 * GeniusPay avant tout enregistrement.
 */
export async function handleMerchantWebhook(input: {
  token: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}): Promise<"ok" | "unauthorized"> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(input.token)) return "unauthorized";
  const s = await prisma.paymentSettings.findUnique({
    where: { webhookToken: input.token },
    select: { organizationId: true, webhookSecret: true },
  });
  const secret = s ? decryptSecret(s.webhookSecret) : null;
  if (!s || !secret || !verifyGeniusWebhook(input.rawBody, input.signature, input.timestamp, secret)) return "unauthorized";
  let body: { data?: { metadata?: Record<string, unknown> }; metadata?: Record<string, unknown> } | null = null;
  try {
    body = JSON.parse(input.rawBody);
  } catch {
    body = null;
  }
  const id = (body?.data?.metadata ?? body?.metadata ?? {}).paymentRequestId;
  if (typeof id === "string" && id.length <= 40) {
    await confirmPaymentRequest(id, { organizationId: s.organizationId, force: true });
  }
  return "ok";
}
