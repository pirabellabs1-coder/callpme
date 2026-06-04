/** Dépôt « Intégrations » — connexions réelles par identifiants. */
import { prisma } from "./client";

export interface ConnectedIntegration {
  provider: string;
  /** Nom de compte/espace lisible (affiché « Connecté · … »). */
  accountName: string | null;
  connectedAt: string | null;
}

/** Liste détaillée des intégrations connectées (avec le compte). */
export async function listConnectedIntegrations(
  orgId: string,
): Promise<ConnectedIntegration[]> {
  const rows = await prisma.integration.findMany({
    where: { organizationId: orgId, status: "connected" },
    select: { provider: true, config: true, createdAt: true },
  });
  return rows.map((r) => {
    let accountName: string | null = null;
    try {
      accountName = (JSON.parse(r.config ?? "{}").accountName as string) || null;
    } catch {
      /* config illisible */
    }
    return {
      provider: r.provider,
      accountName,
      connectedAt: r.createdAt.toISOString(),
    };
  });
}

/** Conservé pour compat : ne renvoie que les identifiants de provider. */
export async function listConnectedProviders(orgId: string): Promise<string[]> {
  const rows = await prisma.integration.findMany({
    where: { organizationId: orgId, status: "connected" },
    select: { provider: true },
  });
  return rows.map((r) => r.provider);
}

/** Établit/actualise une connexion réelle : stocke compte + identifiants. */
export async function connectIntegration(
  orgId: string,
  provider: string,
  data: { accountName?: string | null; credentials?: Record<string, string> } = {},
) {
  const config = JSON.stringify({
    accountName: data.accountName?.trim() || null,
    credentials: data.credentials ?? {},
    connectedAt: new Date().toISOString(),
  });
  return prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: orgId, provider } },
    create: { organizationId: orgId, provider, status: "connected", config },
    update: { status: "connected", config },
  });
}

export async function disconnectIntegration(orgId: string, provider: string) {
  await prisma.integration.deleteMany({
    where: { organizationId: orgId, provider },
  });
}
