/**
 * Passerelle SIP de Callpme (Asterisk) — téléphonie sans Twilio ni Telnyx.
 *
 * Un opérateur ou fournisseur SIP (Orange, MTN, Moov, opérateur VoIP local…)
 * se raccorde à l'Asterisk de la plateforme. Asterisk :
 *  - à l'arrivée d'un appel, demande une session à l'application
 *    (GET /api/telephony/sip/inbound) puis ouvre le flux audio (AudioSocket)
 *    vers le serveur vocal avec l'identifiant reçu ;
 *  - pour un appel sortant, est piloté par l'application via son interface
 *    ARI (création du canal, transfert).
 *
 * Variables : TELEPHONY_PROVIDER=sip, ASTERISK_ARI_URL, ASTERISK_ARI_USER,
 * ASTERISK_ARI_PASSWORD, SIP_GATEWAY_SECRET (secret partagé avec le plan de
 * numérotation), SIP_FROM_NUMBER (numéro présenté sur les appels sortants).
 */
import { randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "../db/client";
import type { VoiceTokenPayload } from "../voice-engine/token";

/** Durée de validité d'une session préparée (sonnerie comprise). */
const INBOUND_TTL_MS = 2 * 60_000;
const OUTBOUND_TTL_MS = 3 * 60_000;

export function sipConfigured(): boolean {
  return Boolean(
    process.env.TELEPHONY_PROVIDER === "sip" &&
      process.env.ASTERISK_ARI_URL &&
      process.env.ASTERISK_ARI_USER &&
      process.env.ASTERISK_ARI_PASSWORD &&
      (process.env.SIP_GATEWAY_SECRET ?? "").length >= 24,
  );
}

/** Le secret transmis par le plan de numérotation Asterisk est-il le bon ? */
export function checkGatewayKey(given: string | null | undefined): boolean {
  const secret = process.env.SIP_GATEWAY_SECRET ?? "";
  if (secret.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Requête de l'Asterisk de la plateforme : secret dans l'en-tête
 * « X-Callpme-Key » (ou, à défaut, le paramètre « key »), et adresse IP dans
 * SIP_GATEWAY_ALLOW si cette liste est renseignée.
 */
export function gatewayAuthorized(headers: Headers, query: URLSearchParams): boolean {
  const allow = (process.env.SIP_GATEWAY_ALLOW ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (allow.length) {
    const ip = (headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
    if (!allow.includes(ip)) return false;
  }
  return checkGatewayKey(headers.get("x-callpme-key") ?? query.get("key"));
}

export interface SipSessionInput {
  organizationId: string;
  agentId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  metadata?: Record<string, string>;
  channelId?: string | null;
}

/** Prépare une session ; renvoie l'identifiant à passer à AudioSocket. */
export async function createSipSession(input: SipSessionInput): Promise<string> {
  const id = randomUUID();
  await prisma.sipSession.create({
    data: {
      id,
      organizationId: input.organizationId,
      agentId: input.agentId,
      direction: input.direction,
      fromNumber: input.from,
      toNumber: input.to,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      channelId: input.channelId ?? null,
      expiresAt: new Date(Date.now() + (input.direction === "inbound" ? INBOUND_TTL_MS : OUTBOUND_TTL_MS)),
    },
  });
  // Ménage léger : sessions expirées depuis plus d'une heure.
  void prisma.sipSession.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } } }).catch(() => {});
  return id;
}

/**
 * Consomme une session (une seule fois, avant expiration) et renvoie le
 * contexte d'appel attendu par le moteur vocal.
 */
export async function consumeSipSession(id: string): Promise<(VoiceTokenPayload & { channelId: string | null }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const now = new Date();
  const claimed = await prisma.sipSession.updateMany({
    where: { id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  const s = await prisma.sipSession.findUnique({ where: { id } });
  if (!s) return null;
  let metadata: Record<string, string> | undefined;
  try {
    metadata = s.metadata ? JSON.parse(s.metadata) : undefined;
  } catch {
    metadata = undefined;
  }
  return {
    callId: `sip_${id}`,
    agentId: s.agentId,
    organizationId: s.organizationId,
    direction: s.direction === "outbound" ? "outbound" : "inbound",
    from: s.fromNumber,
    to: s.toNumber,
    metadata,
    providerCallId: s.channelId ?? undefined,
    jti: id,
    exp: s.expiresAt.getTime(),
    channelId: s.channelId,
  };
}

/* ----------------------------------- ARI ----------------------------------- */

async function ari(path: string, init: RequestInit = {}): Promise<Response> {
  const base = (process.env.ASTERISK_ARI_URL ?? "").replace(/\/$/, "");
  const auth = Buffer.from(`${process.env.ASTERISK_ARI_USER}:${process.env.ASTERISK_ARI_PASSWORD}`).toString("base64");
  return fetch(`${base}/ari${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  });
}

/**
 * Appel sortant par la liaison de l'opérateur. Un canal « Local » sépare les
 * deux moitiés de l'appel : l'une compose le numéro (et signale l'échec
 * éventuel), l'autre ouvre le flux audio une fois l'appel décroché.
 */
export async function originateSipCall(input: {
  sessionId: string;
  to: string;
  from: string;
}): Promise<{ ok: boolean; channelId?: string; error?: string }> {
  const digits = input.to.replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(digits)) return { ok: false, error: "Numéro invalide." };
  const q = new URLSearchParams({
    endpoint: `Local/${digits}@callpme-dial/n`,
    context: "callpme-outbound",
    extension: "s",
    priority: "1",
    callerId: input.from,
    timeout: "45",
  });
  try {
    const res = await ari(`/channels?${q}`, {
      method: "POST",
      body: JSON.stringify({ variables: { __CALLPME_UUID: input.sessionId } }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      console.error("[sip] appel sortant refusé par Asterisk :", res.status, data.message);
      return { ok: false, error: "La passerelle SIP a refusé l'appel." };
    }
    await prisma.sipSession.update({ where: { id: input.sessionId }, data: { channelId: data.id } }).catch(() => {});
    return { ok: true, channelId: data.id };
  } catch {
    return { ok: false, error: "Passerelle SIP injoignable." };
  }
}

/**
 * Transfert vers un humain : on indique la destination au canal ; à la
 * fermeture du flux audio, le plan de numérotation compose ce numéro.
 */
export async function setSipTransfer(channelId: string, to: string): Promise<boolean> {
  const digits = to.replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(digits)) return false;
  try {
    const q = new URLSearchParams({ variable: "TRANSFER_TO", value: digits });
    const res = await ari(`/channels/${encodeURIComponent(channelId)}/variable?${q}`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
