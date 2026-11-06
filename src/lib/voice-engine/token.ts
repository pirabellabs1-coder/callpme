/**
 * Jeton d'accès au serveur vocal.
 *
 * Signé HMAC-SHA256 (secret d'authentification de l'application), il porte
 * tout le contexte d'un appel : agent, organisation, direction, numéros et
 * métadonnées (campagne, contact). Le serveur vocal ne fait confiance qu'à ce
 * jeton : sans lui, aucune session n'est ouverte. Durée de vie courte.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "../auth/secret";

export interface VoiceTokenPayload {
  /** Identifiant de l'appel Callpme (créé à la fin, ou pré-alloué). */
  callId: string;
  agentId: string;
  organizationId: string;
  direction: "inbound" | "outbound" | "web";
  from: string;
  to: string;
  metadata?: Record<string, string>;
  /** Expiration (ms depuis l'epoch). */
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", `voice:${getAuthSecret()}`).update(data).digest("base64url");
}

export function createVoiceToken(payload: Omit<VoiceTokenPayload, "exp">, ttlMs = 10 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyVoiceToken(token: string | null | undefined): VoiceTokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as VoiceTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
