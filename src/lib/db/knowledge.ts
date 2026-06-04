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
  data: { title: string; source: string; content: string },
) {
  const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
  if (!kb || kb.organizationId !== orgId) return null;
  return prisma.document.create({
    data: {
      knowledgeBaseId: kbId,
      title: data.title,
      source: data.source,
      content: data.content.slice(0, 50000),
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

/**
 * Récupération simple (RAG) : score chaque document par recouvrement de
 * mots-clés avec la requête, renvoie les meilleurs extraits à injecter dans
 * le prompt. (Sera remplacé par une recherche vectorielle en production.)
 */
export async function retrieveContext(
  kbId: string,
  query: string,
  limit = 3,
): Promise<string> {
  const docs = await prisma.document.findMany({
    where: { knowledgeBaseId: kbId },
    select: { title: true, content: true },
  });
  if (docs.length === 0) return "";
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  const scored = docs
    .map((d) => {
      const text = d.content.toLowerCase();
      const score = words.reduce(
        (s, w) => s + (text.includes(w) ? 1 : 0),
        0,
      );
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return "";
  return scored
    .map((x) => `### ${x.d.title}\n${x.d.content.slice(0, 1200)}`)
    .join("\n\n");
}
