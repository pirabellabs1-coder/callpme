/**
 * Limiteur de débit simple (fenêtre glissante, en mémoire du processus).
 *
 * Suffisant pour une instance unique ou pour ralentir le bourrage
 * d'identifiants. Avec plusieurs instances (serverless), remplacer le
 * stockage par Redis (ex. Upstash) en gardant la même interface.
 */
import { headers } from "next/headers";

const buckets = new Map<string, number[]>();

/** true si la clé a dépassé `max` actions sur la fenêtre (et enregistre l'essai sinon). */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  // Nettoyage opportuniste pour éviter une croissance illimitée.
  if (buckets.size > 10_000) {
    buckets.forEach((v, k) => {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    });
  }
  return false;
}

/** Adresse IP du client (derrière le proxy de l'hébergeur). */
export function clientIp(): string {
  const h = headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
