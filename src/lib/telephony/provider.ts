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
import { toE164 } from "./e164";
import { checkDestination } from "./destinations";

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
  const telnyxMode = telephonyProvider() === "telnyx";
  // Telnyx : jeton dans l'URL (vérifié dès la connexion). Twilio n'accepte pas
  // de paramètres dans l'URL du flux : jeton transmis via <Parameter>.
  const url = telnyxMode ? `${base}/ws/telephony?t=${encodeURIComponent(token)}` : `${base}/ws/telephony`;
  // Le jeton est aussi passé en paramètre personnalisé (lu dans « start »).
  // Telnyx : audio retour en RTP µ-law (PCMU), comme celui que produit le moteur.
  const telnyx = telnyxMode ? ` bidirectionalMode="rtp" bidirectionalCodec="PCMU"` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response><Connect>` +
    `<Stream url="${escapeXml(url)}"${telnyx}><Parameter name="t" value="${escapeXml(token)}"/></Stream>` +
    `</Connect><Hangup/></Response>`
  );
}

export function sayAndHangup(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">${escapeXml(message)}</Say><Hangup/></Response>`;
}

export { toE164 } from "./e164";

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
        body: new URLSearchParams({
          To: to,
          From: from,
          Twiml: streamInstructions(token),
          // Sans réponse / occupé / échec : aucun flux ne s'ouvre, ce rappel met le contact à jour.
          StatusCallback: `${publicUrl()}/api/telephony/status`,
          StatusCallbackEvent: "completed",
          StatusCallbackMethod: "POST",
        }),
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
        StatusCallback: `${publicUrl()}/api/telephony/status`,
        StatusCallbackEvent: "completed",
        StatusCallbackMethod: "POST",
      }),
      signal: AbortSignal.timeout(15000),
    });
    type TelnyxCall = { call_sid?: string; status?: string };
    const data = (await res.json().catch(() => ({}))) as TelnyxCall & {
      data?: TelnyxCall;
      errors?: { detail?: string }[];
    };
    if (!res.ok) return { ok: false, error: data.errors?.[0]?.detail || `Telnyx a refusé l'appel (HTTP ${res.status}).` };
    // Réponse à plat ou enveloppée dans `data` selon la version de l'API.
    const call = data.data ?? data;
    return { ok: true, callId: call.call_sid, status: call.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Appel impossible." };
  }
}

/** Durée maximale d'une communication transférée (payée par la plateforme). */
const TRANSFER_TIME_LIMIT_SEC = 600;

/**
 * Transfère un appel en cours vers un numéro (humain).
 * `expected` = numéros connus de l'appel (jeton signé) : l'appel visé doit les
 * porter, sinon un flux pourrait annoncer l'identifiant d'un autre appel.
 */
export async function transferCall(
  providerCallId: string,
  toNumber: string,
  expected?: { from: string; to: string },
): Promise<boolean> {
  const provider = telephonyProvider();
  const to = toE164(toNumber);
  if (!provider || !to || !providerCallId) return false;
  if (!checkDestination(to).ok) return false;
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
      const callUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(providerCallId)}.json`;
      if (expected) {
        const check = await fetch(callUrl, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
        const call = (await check.json().catch(() => ({}))) as { from?: string; to?: string; status?: string };
        const same = (a?: string, b?: string) => Boolean(a && b && toE164(a) === toE164(b));
        if (!check.ok || !same(call.to, expected.to) || !same(call.from, expected.from)) return false;
      }
      const callerId = fromNumber();
      const twiml =
        `<?xml version="1.0" encoding="UTF-8"?><Response>` +
        `<Dial timeLimit="${TRANSFER_TIME_LIMIT_SEC}"${callerId ? ` callerId="${escapeXml(callerId)}"` : ""}>${escapeXml(to)}</Dial>` +
        `</Response>`;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(providerCallId)}.json`, {
        method: "POST",
        headers: {
          Authorization: auth,
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
      body: JSON.stringify({ to, time_limit_secs: TRANSFER_TIME_LIMIT_SEC }),
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
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
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

/**
 * Lit et authentifie un webhook de l'opérateur (formulaire Twilio ou TeXML
 * Telnyx). Renvoie les paramètres, ou null si la signature est invalide.
 * L'URL signée est reconstruite depuis PUBLIC_URL (jamais depuis l'en-tête Host).
 */
export async function readSignedWebhook(
  req: Request,
  path: string,
): Promise<Record<string, string> | null> {
  const provider = telephonyProvider();
  if (!provider) return null;
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const valid =
    provider === "twilio"
      ? verifyTwilioSignature(`${publicUrl()}${path}`, params, req.headers.get("x-twilio-signature"))
      : verifyTelnyxSignature(raw, req.headers.get("telnyx-signature-ed25519"), req.headers.get("telnyx-timestamp"));
  return valid ? params : null;
}
