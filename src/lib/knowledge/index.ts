/**
 * Base de connaissances : indexation et recherche (RAG).
 *
 * - Indexation : chaque document est découpé en passages ; si une clé
 *   d'embeddings est configurée (OPENAI_API_KEY), chaque passage reçoit un
 *   vecteur (pgvector).
 * - Recherche hybride : plein texte PostgreSQL (configuration française,
 *   toujours disponible) + similarité vectorielle quand elle existe, fusionnés
 *   par rang réciproque. Le passage le plus utile remonte même si la question
 *   n'emploie pas les mêmes mots que le document.
 */
import { prisma } from "../db/client";
import { chunkText } from "./chunk";

/**
 * Recherche insensible aux accents (« detartrage » = « détartrage ») : le
 * texte et la question sont ramenés aux mêmes lettres sans accent, côté
 * PostgreSQL par translate() (pas d'extension requise).
 */
const ACCENTED = "àâäáãåéèêëíìîïóòôöõúùûüçñÿ";
const PLAIN = "aaaaaaeeeeiiiiooooouuuucny";

export function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

/** En dessous de ce nombre de passages, la base entière sert de repli. */
const SMALL_BASE_CHUNKS = 8;

const EMBED_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Vecteurs pour une liste de textes (null si indisponible ou en erreur). */
async function embed(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsAvailable() || texts.length === 0) return null;
  try {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 96) {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: texts.slice(i, i + 96), dimensions: 1536 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      out.push(...data.data.map((d) => d.embedding));
    }
    return out;
  } catch {
    return null;
  }
}

const vectorLiteral = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;

/** (Ré)indexe un document : passages + vecteurs. */
export async function indexDocument(documentId: string): Promise<{ chunks: number; vectors: boolean }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { chunks: 0, vectors: false };
  const parts = chunkText(`${doc.title}\n\n${doc.content}`);
  const vectors = await embed(parts);

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: { documentId } });
    for (let i = 0; i < parts.length; i++) {
      const id = `${documentId}_${i}`;
      if (vectors?.[i]) {
        await tx.$executeRaw`INSERT INTO "KnowledgeChunk" ("id","documentId","knowledgeBaseId","position","content","embedding")
          VALUES (${id}, ${documentId}, ${doc.knowledgeBaseId}, ${i}, ${parts[i]}, ${vectorLiteral(vectors[i])}::vector)`;
      } else {
        await tx.knowledgeChunk.create({
          data: { id, documentId, knowledgeBaseId: doc.knowledgeBaseId, position: i, content: parts[i] },
        });
      }
    }
    await tx.document.update({
      where: { id: documentId },
      data: { chunkCount: parts.length, status: parts.length ? "ready" : "error", error: parts.length ? null : "Aucun texte exploitable." },
    });
  }, { timeout: 60000 });
  return { chunks: parts.length, vectors: Boolean(vectors) };
}

/** Indexe les documents antérieurs à la découpe en passages (migration douce). */
export async function ensureIndexed(knowledgeBaseId: string): Promise<void> {
  const pending = await prisma.document.findMany({
    where: { knowledgeBaseId, chunkCount: 0, status: { not: "error" } },
    select: { id: true },
    take: 20,
  });
  for (const d of pending) await indexDocument(d.id).catch(() => {});
}

export interface KnowledgeHit {
  documentId: string;
  title: string;
  content: string;
  score: number;
}

/** Recherche hybride dans une base ; renvoie les meilleurs passages. */
export async function searchKnowledge(knowledgeBaseId: string, query: string, limit = 4): Promise<KnowledgeHit[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];
  await ensureIndexed(knowledgeBaseId);

  // 1. Plein texte (français) : websearch_to_tsquery tolère la syntaxe libre.
  //    On élargit en OU pour ne pas exiger tous les mots de la question.
  const words = stripAccents(q.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  const orQuery = words.join(" or ");
  const text = orQuery
    ? await prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT c."id", ts_rank_cd(to_tsvector('french', translate(lower(c."content"), ${ACCENTED}, ${PLAIN})), websearch_to_tsquery('french', ${orQuery})) AS rank
        FROM "KnowledgeChunk" c
        WHERE c."knowledgeBaseId" = ${knowledgeBaseId}
          AND to_tsvector('french', translate(lower(c."content"), ${ACCENTED}, ${PLAIN})) @@ websearch_to_tsquery('french', ${orQuery})
        ORDER BY rank DESC
        LIMIT 20`
    : [];

  // 2. Similarité vectorielle (si des vecteurs existent pour cette base).
  let semantic: { id: string; distance: number }[] = [];
  const qv = await embed([q]);
  if (qv?.[0]) {
    semantic = await prisma.$queryRaw<{ id: string; distance: number }[]>`
      SELECT c."id", (c."embedding" <=> ${vectorLiteral(qv[0])}::vector) AS distance
      FROM "KnowledgeChunk" c
      WHERE c."knowledgeBaseId" = ${knowledgeBaseId} AND c."embedding" IS NOT NULL
      ORDER BY distance ASC
      LIMIT 20`;
  }

  // 3. Fusion par rang réciproque (RRF).
  const scores = new Map<string, number>();
  text.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (60 + i)));
  semantic
    .filter((r) => r.distance < 0.75)
    .forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (60 + i)));
  const top = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (top.length === 0) return [];

  const rows = await prisma.knowledgeChunk.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, documentId: true, content: true, document: { select: { title: true } } },
  });
  return top
    .map(([id, score]) => {
      const r = rows.find((x) => x.id === id);
      return r ? { documentId: r.documentId, title: r.document.title, content: r.content, score } : null;
    })
    .filter((x): x is KnowledgeHit => x !== null);
}

/** Contexte prêt à injecter dans le prompt (borné pour la latence vocale). */
export async function knowledgeContext(knowledgeBaseId: string, query: string, maxChars = 3200): Promise<string> {
  let hits = await searchKnowledge(knowledgeBaseId, query).catch(() => [] as KnowledgeHit[]);
  if (hits.length === 0) {
    // Aucun mot commun (« se garer » / « parking ») : une petite base tient
    // entière dans le contexte, le modèle fait lui-même le rapprochement.
    const all = await prisma.knowledgeChunk.findMany({
      where: { knowledgeBaseId },
      orderBy: [{ documentId: "asc" }, { position: "asc" }],
      take: SMALL_BASE_CHUNKS + 1,
      select: { documentId: true, content: true, document: { select: { title: true } } },
    });
    if (all.length <= SMALL_BASE_CHUNKS) {
      hits = all.map((c) => ({ documentId: c.documentId, title: c.document.title, content: c.content, score: 0 }));
    }
  }
  let out = "";
  for (const h of hits) {
    // Le titre est déjà en tête du premier passage : pas de doublon.
    const body = h.content.startsWith(h.title) ? h.content.slice(h.title.length).trim() : h.content;
    const block = `### ${h.title}\n${body}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}

