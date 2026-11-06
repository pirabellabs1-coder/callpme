/** Lecture serveur des identifiants d'intégration (déchiffrés à la volée). */
import { prisma } from "../db/client";
import { decryptSecret } from "../crypto/secrets";

export async function integrationCredentials(
  orgId: string,
  provider: string,
): Promise<Record<string, string> | null> {
  const row = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId: orgId, provider } },
    select: { status: true, config: true },
  });
  if (!row || row.status !== "connected") return null;
  try {
    const cfg = JSON.parse(row.config ?? "{}") as { credentials?: Record<string, string> };
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg.credentials ?? {})) {
      const plain = decryptSecret(v);
      if (plain) out[k] = plain;
    }
    return out;
  } catch {
    return null;
  }
}
