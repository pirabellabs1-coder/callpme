/**
 * Domaine personnalisé d'une agence : utilisé (marque, liens d'invitation)
 * seulement après preuve de propriété par un enregistrement DNS TXT.
 */
import { createHmac } from "crypto";
import { promises as dns } from "dns";
import { getAuthSecret } from "@/lib/auth/secret";

export function domainToken(orgId: string, domain: string): string {
  return "callpme-verify=" + createHmac("sha256", getAuthSecret()).update(`domain:${orgId}:${domain}`).digest("hex").slice(0, 32);
}

export function txtRecordName(domain: string): string {
  return `_callpme.${domain}`;
}

/** Le domaine appartient-il à la plateforme (interdit aux agences) ? */
export function isPlatformDomain(domain: string, platformHosts: string[]): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  const d = strip(domain);
  return platformHosts.some((h) => {
    const p = strip(h);
    return !!p && (d === p || d.endsWith(`.${p}`) || p.endsWith(`.${d}`));
  }) || d.endsWith(".vercel.app");
}

export async function checkDomainTxt(orgId: string, domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(txtRecordName(domain));
    const expected = domainToken(orgId, domain);
    return records.some((chunks) => chunks.join("") === expected);
  } catch {
    return false;
  }
}
