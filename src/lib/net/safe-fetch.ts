/**
 * Appels HTTP vers des URL fournies par un utilisateur, protégés contre le SSRF.
 *
 * - Seuls http et https sont acceptés, sur les ports 80/443 (ou par défaut),
 *   sans identifiants dans l'URL.
 * - L'adresse IP est vérifiée AU MOMENT DE LA CONNEXION (option `lookup` de
 *   node:http/https) : l'adresse validée est celle utilisée, ce qui bloque le
 *   « DNS rebinding » (réponse DNS publique puis interne).
 * - Adresses refusées : privées, locales, lien local, réservées, multicast,
 *   métadonnées cloud, et toutes les formes IPv6 qui embarquent une IPv4
 *   (::ffff:0:0/96, ::/96, 64:ff9b::/96, 2002::/16) quand celle-ci est interne.
 * - Redirections suivies à la main (GET uniquement, 3 au plus), revalidées.
 * - Taille de réponse plafonnée, délai maximal.
 */
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

/* ------------------------------- IPv4 ------------------------------- */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inRange4(ip: string, cidr: string): boolean {
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
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/* ------------------------------- IPv6 ------------------------------- */

/** Développe une adresse IPv6 en 8 groupes de 16 bits (null si invalide). */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  // Partie IPv4 finale (ex. ::ffff:1.2.3.4) -> deux groupes hexadécimaux.
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function v4FromGroups(hi: number, lo: number): string {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return BLOCKED_V4.some((c) => inRange4(ip, c));
  if (v !== 6) return true;
  const g = expandV6(ip);
  if (!g) return true;
  const first96Zero = g.slice(0, 6).every((x) => x === 0);
  // ::/96 (inclut :: et ::1) et IPv4 « compatible » : on teste l'IPv4 embarquée.
  if (first96Zero) return g[6] === 0 && g[7] <= 1 ? true : isBlockedIp(v4FromGroups(g[6], g[7]));
  // ::ffff:0:0/96 (IPv4 mappée)
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIp(v4FromGroups(g[6], g[7]));
  // 64:ff9b::/96 (NAT64)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedIp(v4FromGroups(g[6], g[7]));
  // 2002::/16 (6to4) : IPv4 dans les bits 16-47
  if (g[0] === 0x2002) return isBlockedIp(v4FromGroups(g[1], g[2]));
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 lien local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 discard
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g[0] === 0x2001 && g[1] < 0x0200) return true; // 2001::/23 IETF (Teredo inclus)
  return false;
}

/* --------------------------- Validation URL --------------------------- */

function parseUrl(raw: string): URL {
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
  if (isIP(host) && isBlockedIp(host)) {
    throw new UnsafeUrlError("Cette adresse n'est pas accessible publiquement.");
  }
  return url;
}

const allowPrivate = () => process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_URLS === "1";

/**
 * Résolution DNS qui refuse les adresses internes. Passée à node:http, elle
 * s'exécute au moment de la connexion : l'IP vérifiée est l'IP utilisée.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    const bad = !allowPrivate() && (list.length === 0 || list.some((a) => isBlockedIp(a.address)));
    if (bad) return callback(new UnsafeUrlError("Cette adresse n'est pas accessible publiquement."), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

/* ------------------------------ Requête ------------------------------ */

export interface PublicResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  finalUrl: URL;
}

function requestOnce(
  url: URL,
  opts: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number; maxBytes: number },
): Promise<PublicResponse> {
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: opts.method,
        headers: opts.body ? { ...opts.headers, "Content-Length": Buffer.byteLength(opts.body).toString() } : opts.headers,
        lookup: allowPrivate() ? undefined : guardedLookup,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString("utf8"), finalUrl: url });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new UnsafeUrlError("Délai dépassé.")));
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * Requête vers une URL publique. Les redirections ne sont suivies que pour GET
 * (revalidées à chaque saut) ; pour POST, une redirection est renvoyée telle quelle.
 */
export async function publicRequest(
  raw: string,
  {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 10000,
    maxBytes = DEFAULT_MAX_BYTES,
  }: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<PublicResponse> {
  let url = allowPrivate() ? new URL(raw) : parseUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestOnce(url, { method, headers, body, timeoutMs, maxBytes });
    if (method === "GET" && res.status >= 300 && res.status < 400 && res.headers.location) {
      url = parseUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Trop de redirections.");
}

/** Récupère le texte d'une page publique (GET, réponse 2xx exigée). */
export async function fetchPublicText(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ text: string; finalUrl: URL }> {
  const res = await publicRequest(raw, { ...opts, headers: { "User-Agent": "Callpme-KB/1.0" } });
  if (res.status < 200 || res.status >= 300) throw new UnsafeUrlError(`La page a répondu ${res.status}.`);
  return { text: res.text, finalUrl: res.finalUrl };
}
