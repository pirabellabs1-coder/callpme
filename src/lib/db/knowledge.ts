/** Dépôt « Base de connaissances » (RAG). */
import { prisma } from "./client";

export interface KbRecord {
  id: string;
  name: string;
  description: string | null;
  docCount: number;
  agentCount: number;
  createdAt: string;
}

export interface DocRecord {
  id: string;
  title: string;
  source: string;
  content: string;
  createdAt: string;
  origin?: string | null;
  status?: string;
  chunkCount?: number;
}

export async function listKnowledgeBases(orgId: string): Promise<KbRecord[]> {
  const rows = await prisma.knowledgeBase.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true, agents: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    docCount: r._count.documents,
    agentCount: r._count.agents,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getKnowledgeBase(orgId: string, id: string) {
  const r = await prisma.knowledgeBase.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!r || r.organizationId !== orgId) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    documents: r.documents.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      content: d.content.slice(0, 600),
      createdAt: d.createdAt.toISOString(),
      origin: d.origin,
      status: d.status,
      chunkCount: d.chunkCount,
    })) as DocRecord[],
  };
}

export async function createKnowledgeBase(
  orgId: string,
  data: { name: string; description?: string },
) {
  return prisma.knowledgeBase.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description || null,
    },
  });
}

export async function deleteKnowledgeBase(orgId: string, id: string) {
  const r = await prisma.knowledgeBase.findUnique({ where: { id } });
  if (!r || r.organizationId !== orgId) return false;
  await prisma.knowledgeBase.delete({ where: { id } });
  return true;
}

export async function addDocument(
  orgId: string,
  kbId: string,
  data: { title: string; source: string; content: string; origin?: string },
) {
  const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
  if (!kb || kb.organizationId !== orgId) return null;
  return prisma.document.create({
    data: {
      knowledgeBaseId: kbId,
      title: data.title,
      source: data.source,
      origin: data.origin ?? null,
      content: data.content.slice(0, 400_000),
      status: "processing",
    },
  });
}

export async function deleteDocument(orgId: string, docId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { knowledgeBase: { select: { organizationId: true } } },
  });
  if (!doc || doc.knowledgeBase.organizationId !== orgId) return false;
  await prisma.document.delete({ where: { id: docId } });
  return true;
}

/** Contexte RAG pour une question (recherche hybride par passages). */
export async function retrieveContext(kbId: string, query: string): Promise<string> {
  const { knowledgeContext } = await import("../knowledge");
  return knowledgeContext(kbId, query);
}
