/**
 * Téléchargement d'une URL fournie par un utilisateur, protégé contre le SSRF.
 *
 * - Seuls http et https sont acceptés, sur les ports 80/443 (ou par défaut).
 * - Le nom d'hôte est résolu ; toute adresse privée, locale, de lien local,
 *   réservée ou de métadonnées cloud est refusée (IPv4 et IPv6).
 * - Les redirections sont suivies à la main (3 au plus) et chaque étape est
 *   revalidée.
 * - La taille de la réponse est plafonnée.
 *
 * Limite connue : entre la résolution DNS et la connexion, un DNS malveillant
 * pourrait changer de réponse (rebinding). Le risque est fortement réduit
 * par la vérification à chaque saut ; une isolation réseau reste conseillée
 * en production.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inRange(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return BLOCKED_V4.some((c) => inRange(ip, c));
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    // IPv4 mappée (::ffff:a.b.c.d)
    const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return (
      low.startsWith("fc") || // fc00::/7 (privé)
      low.startsWith("fd") ||
      low.startsWith("fe8") || // fe80::/10 (lien local)
      low.startsWith("fe9") ||
      low.startsWith("fea") ||
      low.startsWith("feb") ||
      low.startsWith("ff") // multicast
    );
  }
  return true;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Seules les adresses http et https sont acceptées.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Port non autorisé.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Les identifiants dans l'URL ne sont pas autorisés.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true }).catch(() => {
        throw new UnsafeUrlError("Nom de domaine introuvable.");
      });
  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new UnsafeUrlError("Cette adresse n'est pas accessible publiquement.");
  }
  return url;
}

/**
 * Vérifie qu'une URL appartient à l'Internet public avant un appel sortant
 * (webhooks, fonctions personnalisées). En développement uniquement,
 * ALLOW_PRIVATE_URLS=1 autorise localhost pour tester ses propres serveurs.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_URLS === "1") {
    return new URL(raw);
  }
  return assertSafeUrl(raw);
}

/** Récupère le texte d'une URL publique, avec les protections ci-dessus. */
export async function fetchPublicText(
  raw: string,
  { timeoutMs = 10000, maxBytes = DEFAULT_MAX_BYTES }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ text: string; finalUrl: URL }> {
  let current = await assertSafeUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Callpme-KB/1.0" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new UnsafeUrlError("Redirection invalide.");
      current = await assertSafeUrl(new URL(loc, current).toString());
      continue;
    }
    if (!res.ok || !res.body) throw new UnsafeUrlError(`La page a répondu ${res.status}.`);

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { text, finalUrl: current };
  }
  throw new UnsafeUrlError("Trop de redirections.");
}
