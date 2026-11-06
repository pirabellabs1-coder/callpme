/**
 * Jeton d'accès Google Cloud à partir d'un compte de service, sans SDK.
 *
 * GOOGLE_STT_CREDENTIALS contient le fichier JSON du compte de service
 * (tel quel ou encodé en base64). Le jeton (1 h) est mis en cache et
 * renouvelé 5 minutes avant son expiration.
 */
import { createSign } from "node:crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
}

let cache: { token: string; exp: number } | null = null;

export function googleServiceAccount(raw = process.env.GOOGLE_STT_CREDENTIALS): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const sa = JSON.parse(text) as ServiceAccount;
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export async function googleAccessToken(signal?: AbortSignal, scope = "https://www.googleapis.com/auth/cloud-platform"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cache && cache.exp - 300 > now) return cache.token;
  const sa = googleServiceAccount();
  if (!sa) throw new Error("GOOGLE_STT_CREDENTIALS manquant ou illisible.");
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetch(aud, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Authentification Google refusée (HTTP ${res.status}).`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Authentification Google : pas de jeton.");
  cache = { token: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return cache.token;
}

/** Vide le cache (tests). */
export function resetGoogleTokenCache() {
  cache = null;
}
