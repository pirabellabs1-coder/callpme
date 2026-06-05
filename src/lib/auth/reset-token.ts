/**
 * Jeton de réinitialisation de mot de passe SANS état (signé HMAC).
 * Évite une table dédiée : le jeton encode userId + expiration + signature.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "callpme-reset-secret-fallback";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 40);
}

/** Crée un jeton valable `ttlMs` (1h par défaut). */
export function makeResetToken(userId: string, ttlMs = 3_600_000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

/** Vérifie le jeton et renvoie le userId, ou null si invalide/expiré. */
export function verifyResetToken(token: string): string | null {
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
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}
