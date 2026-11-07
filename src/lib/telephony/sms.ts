/**
 * Envoi de SMS (confirmations, rappels) via l'opérateur de la plateforme.
 *
 * Twilio : TWILIO_SMS_FROM (ou TWILIO_FROM_NUMBER). Telnyx : TELNYX_SMS_FROM
 * (ou TELNYX_FROM_NUMBER) et TELNYX_MESSAGING_PROFILE_ID facultatif.
 * Les SMS sont payés par la plateforme : mêmes destinations autorisées que les
 * appels, et au plus quelques SMS par appel.
 */
import { orgCountry } from "../geo/org-country";
import { checkDestination } from "./destinations";
import { toE164 } from "./e164";
import { telephonyProvider } from "./provider";
import { takeDailyQuota } from "../security/daily-quota";
import { prisma } from "../db/client";
import { connectionCreds, twilioAuthHeader, twilioErrorFr, type TwilioCreds } from "./twilio-accounts";

/** Expéditeur valide : numéro E.164, ou nom de 3 à 11 caractères avec au moins une lettre. */
export function validSmsSender(v: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(v) || (/^[A-Za-z0-9 ]{3,11}$/.test(v) && /[A-Za-z]/.test(v));
}

/**
 * Compte Twilio du client pour les SMS : celui qui porte le numéro de l'agent,
 * sinon le premier compte Twilio de l'organisation. Expéditeur : celui réglé
 * sur le compte, sinon le numéro de l'agent.
 */
async function clientSmsRoute(organizationId: string, agentNumber?: string | null): Promise<{ creds: TwilioCreds; from: string } | null> {
  let connectionId: string | null = null;
  if (agentNumber) {
    const n = await prisma.phoneNumber.findUnique({ where: { number: agentNumber }, select: { connectionId: true, organizationId: true } });
    if (n?.organizationId === organizationId) connectionId = n.connectionId;
  }
  const conn = connectionId
    ? await prisma.providerConnection.findFirst({ where: { id: connectionId, organizationId }, select: { id: true, smsSender: true } })
    : await prisma.providerConnection.findFirst({
        where: { organizationId, provider: "twilio", enabled: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, smsSender: true },
      });
  if (!conn) return null;
  const creds = await connectionCreds(conn.id, organizationId);
  const from = conn.smsSender || agentNumber || null;
  return creds && from ? { creds, from } : null;
}

const MAX_PER_CALL = 3;
const sentPerCall = new Map<string, number>();

export function smsConfigured(): boolean {
  const p = telephonyProvider();
  if (p === "twilio") return Boolean(process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM_NUMBER);
  if (p === "telnyx") return Boolean(process.env.TELNYX_SMS_FROM || process.env.TELNYX_FROM_NUMBER);
  // Passerelle SIP : la voix seulement (les SMS passent par l'opérateur local).
  return false;
}

export interface SmsResult {
  ok: boolean;
  error?: string;
}

export async function sendSms(
  rawTo: string,
  text: string,
  opts: { callId?: string; organizationId?: string; agentNumber?: string | null } = {},
): Promise<SmsResult> {
  const own = opts.organizationId ? await clientSmsRoute(opts.organizationId, opts.agentNumber).catch(() => null) : null;
  const provider = own ? "twilio" : telephonyProvider();
  if (!provider || (!own && !smsConfigured())) return { ok: false, error: "SMS non configurés." };
  const to = toE164(rawTo, opts.organizationId ? await orgCountry(opts.organizationId) : undefined);
  if (!to) return { ok: false, error: "Numéro invalide." };
  const dest = checkDestination(to);
  if (!dest.ok) return { ok: false, error: dest.reason };
  if (opts.callId) {
    const n = sentPerCall.get(opts.callId) ?? 0;
    if (n >= MAX_PER_CALL) return { ok: false, error: "Limite de SMS atteinte pour cet appel." };
    sentPerCall.set(opts.callId, n + 1);
    if (sentPerCall.size > 5000) sentPerCall.clear();
  }
  if (opts.organizationId && !(await takeDailyQuota(opts.organizationId, "sms"))) {
    return { ok: false, error: "Plafond quotidien de SMS atteint." };
  }
  const body = text.slice(0, 480);

  try {
    if (provider === "twilio") {
      const creds: TwilioCreds = own?.creds ?? { sid: process.env.TWILIO_ACCOUNT_SID!, token: process.env.TWILIO_AUTH_TOKEN! };
      const from = own?.from ?? (process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM_NUMBER)!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: twilioAuthHeader(creds), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
      const error = twilioErrorFr(data.code, data.message || `HTTP ${res.status}`);
      console.error(`[sms] refusé par Twilio (${from}) : ${error}`);
      return { ok: false, error };
    }
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.TELNYX_SMS_FROM || process.env.TELNYX_FROM_NUMBER,
        to,
        text: body,
        ...(process.env.TELNYX_MESSAGING_PROFILE_ID
          ? { messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID }
          : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `SMS refusé (HTTP ${res.status}).` };
  } catch {
    return { ok: false, error: "SMS impossible." };
  }
}
