/**
 * Porte d'accès admin « secrète » — défense en profondeur au-dessus de isAdmin.
 *
 * L'accès à l'espace d'administration n'est PAS disponible via /admin tant que
 * l'administrateur n'est pas passé par l'URL secrète (ADMIN_GATE_SLUG) et n'a
 * pas saisi la phrase secrète (ADMIN_PASSPHRASE). En cas de succès, on pose un
 * cookie élevé signé (HMAC) à courte durée de vie ; sans ce cookie, /admin
 * renvoie 404 (l'espace est invisible).
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getAuthSecret } from "./secret";

export const ADMIN_COOKIE = "cpme_admin";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 h

/**
 * Segment d'URL secret menant à la connexion admin. Obligatoire en production :
 * sans ADMIN_GATE_SLUG, la porte est fermée (null) au lieu d'utiliser une
 * valeur par défaut devinable.
 */
export function adminGateSlug(): string | null {
  const slug = process.env.ADMIN_GATE_SLUG?.trim();
  if (slug) return slug;
  return process.env.NODE_ENV === "production" ? null : "acces-secret-callpme";
}

/** Phrase secrète exigée en plus des identifiants admin (facultative). */
export function adminPassphrase(): string | null {
  const p = process.env.ADMIN_PASSPHRASE;
  return p && p.length > 0 ? p : null;
}

/**
 * Comparaison à temps constant de deux chaînes. On compare des condensats
 * SHA-256 (taille fixe) pour ne pas révéler la longueur du secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update("admin:" + payload).digest("hex").slice(0, 40);
}

export function makeAdminToken(userId: string, ttlMs = TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifyAdminToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(".");
    if (idx < 0) return null;
    const payload = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const [userId, exp] = payload.split(".");
    if (!userId || !exp) return null;
    if (Date.now() > Number(exp)) return null;
    const expected = sign(payload);
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}

export function setAdminCookie(token: string) {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export function clearAdminCookie() {
  cookies().delete(ADMIN_COOKIE);
}

/** Vrai si la requête courante possède un cookie élevé valide pour cet utilisateur. */
export function hasAdminUnlock(userId: string): boolean {
  const tok = cookies().get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(tok) === userId;
}
