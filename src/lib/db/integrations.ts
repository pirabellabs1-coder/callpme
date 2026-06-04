/** Dépôt « Intégrations ». */
import { prisma } from "./client";

export async function listConnectedProviders(orgId: string): Promise<string[]> {
  const rows = await prisma.integration.findMany({
    where: { organizationId: orgId, status: "connected" },
    select: { provider: true },
  });
  return rows.map((r) => r.provider);
}

export async function connectIntegration(orgId: string, provider: string) {
  return prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: orgId, provider } },
    create: { organizationId: orgId, provider, status: "connected" },
    update: { status: "connected" },
  });
}

export async function disconnectIntegration(orgId: string, provider: string) {
  await prisma.integration.deleteMany({
    where: { organizationId: orgId, provider },
  });
}
