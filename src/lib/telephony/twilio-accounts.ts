/**
 * Comptes Twilio des clients (« apportez votre numéro »).
 *
 * Un client connecte SON compte Twilio dans « Numéros » : ses identifiants sont
 * vérifiés auprès de Twilio puis chiffrés en base (ProviderConnection). Ses
 * numéros sont importés depuis son compte et configurés automatiquement vers
 * Callpme. Les appels de ces numéros (entrants, sortants, transferts) se font
 * avec SES identifiants ; les webhooks sont authentifiés avec SON jeton.
 *
 * Le compte Twilio de la plateforme (variables d'environnement), s'il existe,
 * reste utilisé pour les numéros qui n'appartiennent à aucun client.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../db/client";
import { decryptSecret } from "../crypto/secrets";

export interface TwilioCreds {
  sid: string;
  token: string;
  /** ProviderConnection du client (absent : compte de la plateforme). */
  connectionId?: string;
}

const API = "https://api.twilio.com/2010-04-01";

export function twilioAuthHeader(c: TwilioCreds): string {
  return `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString("base64")}`;
}

/** Empreinte stable d'un identifiant de compte (indexée, sans stocker l'identifiant en clair). */
export function accountKey(sid: string): string {
  return createHash("sha256").update(`twilio:${sid.trim()}`).digest("hex");
}

export function platformTwilio(): TwilioCreds | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return sid && token ? { sid, token } : null;
}

function credsOf(row: { id: string; accountSid: string | null; authToken: string | null } | null): TwilioCreds | null {
  if (!row) return null;
  try {
    const sid = decryptSecret(row.accountSid);
    const token = decryptSecret(row.authToken);
    return sid && token ? { sid, token, connectionId: row.id } : null;
  } catch {
    return null; // clé de chiffrement changée : identifiants illisibles
  }
}

/** Identifiants d'un compte client (vérifie qu'il appartient bien à l'organisation si fournie). */
export async function connectionCreds(connectionId: string, organizationId?: string): Promise<TwilioCreds | null> {
  const row = await prisma.providerConnection.findFirst({
    where: { id: connectionId, provider: "twilio", enabled: true, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, accountSid: true, authToken: true },
  });
  return credsOf(row);
}

/** Identifiants Twilio à utiliser pour un numéro : celui du client s'il le porte, sinon la plateforme. */
export async function credsForNumber(number: string): Promise<TwilioCreds | null> {
  const row = await prisma.phoneNumber.findUnique({
    where: { number },
    select: { connectionId: true, organizationId: true, provider: true },
  });
  if (row?.connectionId) return connectionCreds(row.connectionId, row.organizationId);
  return platformTwilio();
}

/** Signature X-Twilio-Signature : HMAC-SHA1 de l'URL + paramètres triés. */
export function twilioSignatureValid(token: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = Buffer.from(createHmac("sha1", token).update(data).digest("base64"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Authentifie un webhook Twilio : jeton de la plateforme, ou jeton du compte
 * client désigné par AccountSid (retrouvé par son empreinte). Renvoie le
 * compte qui a signé, ou null si personne.
 */
export async function verifyTwilioWebhook(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): Promise<TwilioCreds | null> {
  if (!signature) return null;
  const platform = platformTwilio();
  if (platform && twilioSignatureValid(platform.token, url, params, signature)) return platform;
  const sid = params.AccountSid;
  if (!sid || !/^AC[0-9a-fA-F]{32}$/.test(sid)) return null;
  const rows = await prisma.providerConnection.findMany({
    where: { provider: "twilio", enabled: true, accountKey: accountKey(sid) },
    select: { id: true, accountSid: true, authToken: true },
    take: 10,
  });
  for (const row of rows) {
    const c = credsOf(row);
    if (c && c.sid === sid && twilioSignatureValid(c.token, url, params, signature)) return c;
  }
  return null;
}

/**
 * Le webhook Twilio vient-il du compte qui porte ce numéro ? Un numéro sans
 * compte client (plateforme, marketplace) n'accepte que le compte de la
 * plateforme ; un numéro d'un client, que SON compte.
 */
export async function signerOwnsNumber(number: string | null, signerConnection: string | undefined): Promise<boolean> {
  if (!number) return !signerConnection;
  const row = await prisma.phoneNumber.findUnique({ where: { number }, select: { connectionId: true } });
  return (row?.connectionId ?? null) === (signerConnection ?? null);
}

export interface TwilioCallInfo {
  status: string;
  duration: number;
  direction: string;
  to: string;
  from: string;
}

/**
 * Relit un appel chez Twilio avec les identifiants du compte : prouve que
 * l'appel appartient à ce compte et donne la durée FACTURÉE par Twilio (les
 * valeurs envoyées dans le corps d'un webhook client ne sont pas crues).
 */
export async function fetchTwilioCall(c: TwilioCreds, callSid: string): Promise<TwilioCallInfo | null> {
  if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) return null;
  try {
    const res = await fetch(`${API}/Accounts/${encodeURIComponent(c.sid)}/Calls/${callSid}.json`, {
      headers: { Authorization: twilioAuthHeader(c) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json().catch(() => ({}))) as { status?: string; duration?: string; direction?: string; to?: string; from?: string };
    return {
      status: d.status ?? "",
      duration: Number(d.duration ?? 0) || 0,
      direction: d.direction ?? "",
      to: d.to ?? "",
      from: d.from ?? "",
    };
  } catch {
    return null;
  }
}

/** Préfixe de Call.audioUrl pour un enregistrement Twilio (lu via /api/calls/:id/audio). */
export const TWILIO_RECORDING_PREFIX = "twilio-recording:";

/**
 * Démarre l'enregistrement d'un appel en cours chez Twilio : deux canaux
 * (appelant et agent), conservé sur le compte qui porte l'appel.
 */
export async function startTwilioRecording(c: TwilioCreds, callSid: string): Promise<string | null> {
  if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) return null;
  try {
    const res = await fetch(`${API}/Accounts/${encodeURIComponent(c.sid)}/Calls/${callSid}/Recordings.json`, {
      method: "POST",
      headers: { Authorization: twilioAuthHeader(c), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ RecordingChannels: "dual", RecordingTrack: "both" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json().catch(() => ({}))) as { sid?: string };
    return d.sid && /^RE[0-9a-fA-F]{32}$/.test(d.sid) ? d.sid : null;
  } catch {
    return null;
  }
}

/** Fichier MP3 d'un enregistrement (404 tant que Twilio le prépare). */
export async function fetchTwilioRecording(c: TwilioCreds, recordingSid: string): Promise<Response | null> {
  if (!/^RE[0-9a-fA-F]{32}$/.test(recordingSid)) return null;
  return fetch(`${API}/Accounts/${encodeURIComponent(c.sid)}/Recordings/${recordingSid}.mp3`, {
    headers: { Authorization: twilioAuthHeader(c) },
    signal: AbortSignal.timeout(20000),
  });
}

/* --------------------------- API Twilio du client -------------------------- */

export class TwilioAccountError extends Error {}

/** Vérifie des identifiants auprès de Twilio (compte actif). */
export async function checkTwilioCredentials(sid: string, token: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!/^AC[0-9a-fA-F]{32}$/.test(sid.trim())) return { ok: false, error: "Account SID invalide : il commence par « AC » suivi de 32 caractères." };
  if (!/^[0-9a-zA-Z]{32}$/.test(token.trim())) return { ok: false, error: "Auth Token invalide : 32 caractères attendus." };
  try {
    const res = await fetch(`${API}/Accounts/${encodeURIComponent(sid.trim())}.json`, {
      headers: { Authorization: twilioAuthHeader({ sid: sid.trim(), token: token.trim() }) },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401) return { ok: false, error: "Twilio refuse ces identifiants : vérifiez l'Account SID et l'Auth Token." };
    if (!res.ok) return { ok: false, error: `Twilio ne répond pas correctement (HTTP ${res.status}). Réessayez.` };
    const data = (await res.json().catch(() => ({}))) as { friendly_name?: string; status?: string };
    if (data.status && data.status !== "active") return { ok: false, error: `Ce compte Twilio n'est pas actif (${data.status}).` };
    return { ok: true, name: data.friendly_name ?? "Compte Twilio" };
  } catch {
    return { ok: false, error: "Twilio est injoignable pour le moment. Réessayez." };
  }
}

export interface TwilioOwnedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voice: boolean;
  /** Déjà relié à Callpme (URL d'appel entrant pointant vers la plateforme). */
  linked: boolean;
}

function publicUrl(): string {
  return (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Numéros du compte Twilio du client (50 au plus). */
export async function listTwilioNumbers(c: TwilioCreds): Promise<TwilioOwnedNumber[]> {
  const res = await fetch(`${API}/Accounts/${encodeURIComponent(c.sid)}/IncomingPhoneNumbers.json?PageSize=50`, {
    headers: { Authorization: twilioAuthHeader(c) },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new TwilioAccountError(`Twilio a refusé la liste des numéros (HTTP ${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as {
    incoming_phone_numbers?: { sid: string; phone_number: string; friendly_name?: string; capabilities?: { voice?: boolean }; voice_url?: string }[];
  };
  const inbound = `${publicUrl()}/api/telephony/inbound`;
  return (data.incoming_phone_numbers ?? []).map((n) => ({
    sid: n.sid,
    phoneNumber: n.phone_number,
    friendlyName: n.friendly_name ?? n.phone_number,
    voice: n.capabilities?.voice !== false,
    linked: n.voice_url === inbound,
  }));
}

/** Configure un numéro du client vers Callpme (appels entrants + fin d'appel). */
export async function linkTwilioNumber(c: TwilioCreds, numberSid: string): Promise<void> {
  if (!/^PN[0-9a-fA-F]{32}$/.test(numberSid)) throw new TwilioAccountError("Numéro Twilio invalide.");
  const res = await fetch(`${API}/Accounts/${encodeURIComponent(c.sid)}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST",
    headers: { Authorization: twilioAuthHeader(c), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      VoiceUrl: `${publicUrl()}/api/telephony/inbound`,
      VoiceMethod: "POST",
      StatusCallback: `${publicUrl()}/api/telephony/status`,
      StatusCallbackMethod: "POST",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new TwilioAccountError(data.message || `Twilio a refusé la configuration du numéro (HTTP ${res.status}).`);
  }
}
