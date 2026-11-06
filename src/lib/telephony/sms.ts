/**
 * Envoi de SMS (confirmations, rappels) via l'opérateur de la plateforme.
 *
 * Twilio : TWILIO_SMS_FROM (ou TWILIO_FROM_NUMBER). Telnyx : TELNYX_SMS_FROM
 * (ou TELNYX_FROM_NUMBER) et TELNYX_MESSAGING_PROFILE_ID facultatif.
 * Les SMS sont payés par la plateforme : mêmes destinations autorisées que les
 * appels, et au plus quelques SMS par appel.
 */
import { checkDestination } from "./destinations";
import { toE164 } from "./e164";
import { telephonyProvider } from "./provider";

const MAX_PER_CALL = 3;
const sentPerCall = new Map<string, number>();

export function smsConfigured(): boolean {
  const p = telephonyProvider();
  if (p === "twilio") return Boolean(process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM_NUMBER);
  if (p === "telnyx") return Boolean(process.env.TELNYX_SMS_FROM || process.env.TELNYX_FROM_NUMBER);
  return false;
}

export interface SmsResult {
  ok: boolean;
  error?: string;
}

export async function sendSms(rawTo: string, text: string, opts: { callId?: string } = {}): Promise<SmsResult> {
  const provider = telephonyProvider();
  if (!provider || !smsConfigured()) return { ok: false, error: "SMS non configurés." };
  const to = toE164(rawTo);
  if (!to) return { ok: false, error: "Numéro invalide." };
  const dest = checkDestination(to);
  if (!dest.ok) return { ok: false, error: dest.reason };
  if (opts.callId) {
    const n = sentPerCall.get(opts.callId) ?? 0;
    if (n >= MAX_PER_CALL) return { ok: false, error: "Limite de SMS atteinte pour cet appel." };
    sentPerCall.set(opts.callId, n + 1);
    if (sentPerCall.size > 5000) sentPerCall.clear();
  }
  const body = text.slice(0, 480);

  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: (process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM_NUMBER)!,
          Body: body,
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok ? { ok: true } : { ok: false, error: `SMS refusé (HTTP ${res.status}).` };
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
