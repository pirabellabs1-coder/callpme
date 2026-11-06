/**
 * Téléphonie Callpme (remplace Vapi) — Twilio ou Telnyx.
 *
 * L'opérateur ne fait que transporter l'audio : il connecte l'appel au
 * serveur vocal Callpme via un flux WebSocket (<Connect><Stream>), et c'est
 * notre moteur qui écoute, réfléchit et parle. Telnyx accepte le même langage
 * (TeXML, compatible TwiML) : un seul format d'instructions pour les deux.
 *
 * Variables : TELEPHONY_PROVIDER (twilio | telnyx), VOICE_SERVER_URL (wss://…),
 * PUBLIC_URL, et selon l'opérateur :
 *  - Twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *  - Telnyx : TELNYX_API_KEY, TELNYX_TEXML_APP_ID, TELNYX_FROM_NUMBER, TELNYX_PUBLIC_KEY
 */
import { createHmac, createPublicKey, timingSafeEqual, verify as edVerify } from "crypto";
import type { Agent } from "../shared/types";
import { createVoiceToken } from "../voice-engine/token";
import { sttConfigured } from "../voice-engine/stt";
import { ttsConfigured } from "../voice-engine/tts";

export type TelephonyProvider = "twilio" | "telnyx";

export function telephonyProvider(): TelephonyProvider | null {
  const wanted = process.env.TELEPHONY_PROVIDER;
  if (wanted === "telnyx" && process.env.TELNYX_API_KEY) return "telnyx";
  if (wanted === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return "twilio";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return "twilio";
  if (process.env.TELNYX_API_KEY) return "telnyx";
  return null;
}

/** Ce qui manque pour passer de vrais appels (liste vide = prêt). */
export function voiceEngineMissing(): string[] {
  const missing: string[] = [];
  if (!process.env.VOICE_SERVER_URL) missing.push("VOICE_SERVER_URL (serveur vocal)");
  if (!sttConfigured()) missing.push("DEEPGRAM_API_KEY (transcription)");
  if (!ttsConfigured()) missing.push("ELEVENLABS_API_KEY ou CARTESIA_API_KEY (voix)");
  return missing;
}

/** Vrais appels téléphoniques possibles (opérateur + moteur vocal configurés). */
export function telephonyConfigured(): boolean {
  return telephonyProvider() !== null && voiceEngineMissing().length === 0 && Boolean(fromNumber());
}

function fromNumber(): string | null {
  const p = telephonyProvider();
  if (p === "twilio") return process.env.TWILIO_FROM_NUMBER || null;
  if (p === "telnyx") return process.env.TELNYX_FROM_NUMBER || null;
  return null;
}

function publicUrl(): string {
  return (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Instructions (TwiML/TeXML) qui relient l'appel au serveur vocal. */
export function streamInstructions(token: string): string {
  const base = (process.env.VOICE_SERVER_URL || "").replace(/\/$/, "");
  const url = `${base}/ws/telephony?t=${encodeURIComponent(token)}`;
  // Le jeton est passé en paramètre personnalisé (Twilio) ET dans l'URL (Telnyx).
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response><Connect>` +
    `<Stream url="${escapeXml(url)}"><Parameter name="t" value="${escapeXml(token)}"/></Stream>` +
    `</Connect><Hangup/></Response>`
  );
}

export function sayAndHangup(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">${escapeXml(message)}</Say><Hangup/></Response>`;
}

/** Normalise un numéro au format E.164 (best-effort, défaut France). */
export function toE164(raw: string): string | null {
  let s = (raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0") && s.length === 10) s = "+33" + s.slice(1);
    else s = "+" + s;
  }
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

export interface PlaceCallResult {
  ok: boolean;
  callId?: string;
  status?: string;
  error?: string;
}

/** Déclenche un vrai appel sortant : l'agent appelle `toNumber`. */
export async function placeOutboundCall(opts: {
  agent: Agent;
  toNumber: string;
  metadata?: Record<string, string>;
}): Promise<PlaceCallResult> {
  const provider = telephonyProvider();
  if (!provider || !telephonyConfigured()) return { ok: false, error: "Téléphonie non configurée." };
  const to = toE164(opts.toNumber);
  if (!to) return { ok: false, error: "Numéro invalide (format attendu : +33…)." };
  const from = fromNumber()!;
  const token = createVoiceToken({
    callId: `out_${Date.now().toString(36)}`,
    agentId: opts.agent.id,
    organizationId: opts.agent.organizationId,
    direction: "outbound",
    from,
    to,
    metadata: opts.metadata,
  });

  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Twiml: streamInstructions(token) }),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string };
      if (!res.ok) return { ok: false, error: data.message || `Twilio a refusé l'appel (HTTP ${res.status}).` };
      return { ok: true, callId: data.sid, status: data.status };
    }

    const res = await fetch(`https://api.telnyx.com/v2/texml/calls/${process.env.TELNYX_TEXML_APP_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        To: to,
        From: from,
        Url: `${publicUrl()}/api/telephony/texml?t=${encodeURIComponent(token)}`,
        UrlMethod: "GET",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      call_sid?: string;
      status?: string;
      errors?: { detail?: string }[];
    };
    if (!res.ok) return { ok: false, error: data.errors?.[0]?.detail || `Telnyx a refusé l'appel (HTTP ${res.status}).` };
    return { ok: true, callId: data.call_sid, status: data.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Appel impossible." };
  }
}

/** Transfère un appel en cours vers un numéro (humain). */
export async function transferCall(providerCallId: string, toNumber: string): Promise<boolean> {
  const provider = telephonyProvider();
  const to = toE164(toNumber);
  if (!provider || !to || !providerCallId) return false;
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escapeXml(to)}</Dial></Response>`;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(providerCallId)}.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Twiml: twiml }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    }
    // Telnyx : providerCallId = call_control_id (fourni par l'événement de flux).
    const res = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(providerCallId)}/actions/transfer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ----------------------- Vérification des webhooks ----------------------- */

/** Signature Twilio (X-Twilio-Signature) : HMAC-SHA1 de l'URL + paramètres triés. */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = Buffer.from(createHmac("sha1", token).update(data).digest("base64"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Signature Telnyx (ed25519 sur « horodatage|corps brut »). */
export function verifyTelnyxSignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const pub = process.env.TELNYX_PUBLIC_KEY;
  if (!pub || !signature || !timestamp) return false;
  // Refuse les requêtes rejouées (plus de 5 minutes).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub, "base64")]),
      format: "der",
      type: "spki",
    });
    return edVerify(null, Buffer.from(`${timestamp}|${rawBody}`), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
