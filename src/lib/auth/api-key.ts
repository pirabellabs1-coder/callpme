/**
 * Clés API — génération et vérification. La clé complète n'est montrée qu'une
 * fois à la création ; seul son hachage SHA-256 est stocké.
 *   Format : cpk_live_<random base64url>
 */
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db/client";

export interface GeneratedKey {
  full: string;
  hash: string;
  prefix: string;
  lastFour: string;
}

export function generateApiKey(): GeneratedKey {
  const raw = randomBytes(24).toString("base64url");
  const full = `cpk_live_${raw}`;
  return {
    full,
    hash: hashApiKey(full),
    prefix: full.slice(0, 13),
    lastFour: full.slice(-4),
  };
}

export function hashApiKey(full: string): string {
  return createHash("sha256").update(full).digest("hex");
}

/** Extrait le token « Bearer » d'une requête. */
export function bearerFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Résout une clé en organisation (ou null si invalide/révoquée). */
export async function resolveApiKey(full: string) {
  const key = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(full) },
    include: { organization: true },
  });
  if (!key || key.revokedAt) return null;
  // Mise à jour « dernière utilisation » sans bloquer la requête.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return key.organization;
}

/** Authentifie une requête d'API publique via l'en-tête Authorization. */
export async function authenticateApiKey(req: Request) {
  const token = bearerFromRequest(req);
  if (!token) return null;
  return resolveApiKey(token);
}
