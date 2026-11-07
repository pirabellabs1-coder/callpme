/**
 * Jeton de supervision : autorise un navigateur à suivre les appels en direct
 * d'UNE organisation sur le serveur vocal. Signé HMAC avec une clé dérivée
 * distincte de celle des jetons d'appel (un jeton ne peut pas servir à l'autre),
 * à usage unique et valable 60 secondes (le temps d'ouvrir la connexion).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAuthSecret } from "../auth/secret";
import type { MonitorGrant } from "./protocol";

interface MonitorTokenPayload extends MonitorGrant {
  jti: string;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", `monitor:${getAuthSecret()}`).update(data).digest("base64url");
}

export function createMonitorToken(grant: MonitorGrant, ttlMs = 60_000): string {
  const body = Buffer.from(
    JSON.stringify({ ...grant, jti: randomBytes(12).toString("base64url"), exp: Date.now() + ttlMs }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

const used = new Map<string, number>();

/** Vérifie et consomme le jeton (une seule connexion par jeton). */
export function acceptMonitorToken(token: string | null | undefined, now = Date.now()): MonitorGrant | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let p: MonitorTokenPayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MonitorTokenPayload;
  } catch {
    return null;
  }
  if (typeof p.exp !== "number" || p.exp < now || typeof p.jti !== "string" || !p.jti) return null;
  if (typeof p.organizationId !== "string" || !p.organizationId || typeof p.userId !== "string") return null;
  if (used.size > 5000) used.forEach((exp, id) => exp < now && used.delete(id));
  if (used.has(p.jti)) return null;
  used.set(p.jti, p.exp);
  return {
    organizationId: p.organizationId,
    userId: p.userId,
    userName: typeof p.userName === "string" ? p.userName.slice(0, 80) : "",
    canControl: p.canControl === true,
  };
}
