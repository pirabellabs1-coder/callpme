/** Pays de l'organisation (pays par défaut des numéros saisis sans indicatif). */
import { prisma } from "@/lib/db/client";
import { DEFAULT_COUNTRY } from "./countries";

const cache = new Map<string, { code: string; at: number }>();
const TTL_MS = 60_000;

export async function orgCountry(organizationId: string): Promise<string> {
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.code;
  let org: { country: string } | null = null;
  try {
    org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { country: true } });
  } catch {
    org = null;
  }
  const code = org?.country ?? DEFAULT_COUNTRY;
  cache.set(organizationId, { code, at: Date.now() });
  return code;
}

/** À appeler quand le pays change (réglages). */
export function forgetOrgCountry(organizationId: string) {
  cache.delete(organizationId);
}
