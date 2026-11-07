/**
 * Liaison interne signée serveur vocal → application web.
 *
 * Certaines opérations exigent des secrets qui ne vivent que dans l'application
 * web (ex. identifiants OAuth Google). Le serveur vocal les demande à l'app
 * par une requête signée HMAC-SHA256 (secret d'authentification partagé),
 * horodatée et valable 2 minutes.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "../auth/secret";

const WINDOW_MS = 120_000;

function sign(ts: string, body: string): string {
  return createHmac("sha256", `internal-bridge:${getAuthSecret()}`).update(`${ts}.${body}`).digest("hex");
}

/** Vérifie une requête interne (en-têtes x-callpme-ts / x-callpme-sig). */
export function verifyInternal(ts: string | null, sig: string | null, body: string, now = Date.now()): boolean {
  if (!ts || !sig || !/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  if (Math.abs(now - Number(ts)) > WINDOW_MS) return false;
  const expected = Buffer.from(sign(ts, body), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Appelle l'application web (null si injoignable ou refus). */
export async function callInternal<T>(path: string, payload: unknown, timeoutMs = 8000): Promise<T | null> {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const body = JSON.stringify(payload);
  const ts = String(Date.now());
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-callpme-ts": ts, "x-callpme-sig": sign(ts, body) },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error(`[liaison interne] ${path} : HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[liaison interne] ${path} injoignable :`, e instanceof Error ? e.message : e);
    return null;
  }
}
