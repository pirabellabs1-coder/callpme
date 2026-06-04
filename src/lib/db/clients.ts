/** Dépôt « Clients » (sous-comptes / espaces de l'agence). */
import { prisma } from "./client";

export interface ClientRecord {
  id: string;
  name: string;
  brandColor: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  agentCount: number;
  createdAt: string;
}

export async function listClients(orgId: string): Promise<ClientRecord[]> {
  const rows = await prisma.client.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { agents: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    brandColor: r.brandColor,
    logoUrl: r.logoUrl,
    contactEmail: r.contactEmail,
    agentCount: r._count.agents,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createClient(
  orgId: string,
  data: { name: string; brandColor?: string; contactEmail?: string },
): Promise<ClientRecord> {
  const r = await prisma.client.create({
    data: {
      organizationId: orgId,
      name: data.name,
      brandColor: data.brandColor || null,
      contactEmail: data.contactEmail || null,
    },
  });
  return {
    id: r.id,
    name: r.name,
    brandColor: r.brandColor,
    logoUrl: r.logoUrl,
    contactEmail: r.contactEmail,
    agentCount: 0,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function deleteClient(orgId: string, id: string) {
  const r = await prisma.client.findUnique({ where: { id } });
  if (!r || r.organizationId !== orgId) return false;
  await prisma.client.delete({ where: { id } });
  return true;
}
