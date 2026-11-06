/**
 * Google Agenda — connexion OAuth (jeton de rafraîchissement chiffré en base),
 * lecture des créneaux occupés et création / suppression d'événements.
 *
 * Variables : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (les mêmes que la
 * connexion Google), PUBLIC_URL. Redirection autorisée à déclarer dans la
 * console Google : ${PUBLIC_URL}/api/integrations/google/callback
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAuthSecret } from "../auth/secret";
import { integrationCredentials } from "./credentials";
import type { BusyInterval } from "../agenda/slots";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export function googleCalendarAvailable(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${(process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "")}/api/integrations/google/callback`;
}

/* ------------------------- État OAuth signé ------------------------- */

/** État = orgId.nonce.exp.signature : lie le retour de Google à l'organisation. */
export function createOAuthState(orgId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const exp = Date.now() + 10 * 60_000;
  const body = `${orgId}.${nonce}.${exp}`;
  const sig = createHmac("sha256", `gcal:${getAuthSecret()}`).update(body).digest("base64url");
  return { state: `${body}.${sig}`, nonce };
}

export function verifyOAuthState(state: string | null, nonce: string | undefined): string | null {
  if (!state || !nonce) return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [orgId, n, exp, sig] = parts;
  const expected = Buffer.from(createHmac("sha256", `gcal:${getAuthSecret()}`).update(`${orgId}.${n}.${exp}`).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (n !== nonce || Number(exp) < Date.now()) return null;
  return orgId;
}

/* ------------------------------ Jetons ------------------------------ */

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email: string | null } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string };
  if (!res.ok || !data.refresh_token) return null;
  let email: string | null = null;
  try {
    // Jeton reçu directement de Google (TLS) : lecture simple de l'e-mail affiché.
    const payload = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8"));
    email = typeof payload.email === "string" ? payload.email : null;
  } catch {
    /* pas d'e-mail : sans importance */
  }
  return { refreshToken: data.refresh_token, email };
}

const accessCache = new Map<string, { token: string; exp: number }>();

async function accessToken(orgId: string): Promise<{ token: string; calendarId: string } | null> {
  const creds = await integrationCredentials(orgId, "google_calendar");
  if (!creds?.refresh_token || !googleCalendarAvailable()) return null;
  const calendarId = creds.calendar_id || "primary";
  const cached = accessCache.get(orgId);
  if (cached && cached.exp > Date.now() + 60_000) return { token: cached.token, calendarId };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) return null;
  accessCache.set(orgId, { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3000) * 1000 });
  return { token: data.access_token, calendarId };
}

/* ------------------------------ Agenda ------------------------------ */

/** Créneaux occupés dans Google Agenda (vide si non connecté ou en erreur). */
export async function googleBusy(orgId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const auth = await accessToken(orgId).catch(() => null);
  if (!auth) return [];
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: auth.calendarId }] }),
      signal: AbortSignal.timeout(6000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const busy = data.calendars?.[auth.calendarId]?.busy ?? [];
    return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch {
    return [];
  }
}

export async function createGoogleEvent(
  orgId: string,
  ev: { summary: string; description: string; start: Date; end: Date; timezone: string },
): Promise<string | null> {
  const auth = await accessToken(orgId).catch(() => null);
  if (!auth) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: ev.summary,
        description: ev.description,
        start: { dateTime: ev.start.toISOString(), timeZone: ev.timezone },
        end: { dateTime: ev.end.toISOString(), timeZone: ev.timezone },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return res.ok ? (data.id ?? null) : null;
  } catch {
    return null;
  }
}

export async function deleteGoogleEvent(orgId: string, eventId: string): Promise<void> {
  const auth = await accessToken(orgId).catch(() => null);
  if (!auth) return;
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` }, signal: AbortSignal.timeout(8000) },
  ).catch(() => {});
}
