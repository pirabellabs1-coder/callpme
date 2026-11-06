import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { addDocument } from "@/lib/db/knowledge";
import { ensureIndexed, indexDocumentSafe } from "@/lib/knowledge";
import { crawlSite, extractFileText, fetchPage, MAX_FILE_BYTES, SourceError } from "@/lib/knowledge/sources";
import { isRateLimited } from "@/lib/security/rate-limit";
import { created, badRequest, unauthorized, notFound, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
// Exploration d'un site et lecture de PDF : plus long qu'une requête classique.
export const maxDuration = 60;

const MAX_DOCS_PER_BASE = 300;

const schema = z.object({
  source: z.enum(["text", "url", "site"]),
  title: z.string().max(160).optional(),
  content: z.string().max(400_000).optional(),
  url: z.string().url().max(500).optional(),
});

interface NewDoc {
  title: string;
  source: string;
  content: string;
  origin?: string;
}

function summary(doc: { id: string; title: string; source: string; content: string; createdAt: Date }, chunks: number) {
  return {
    id: doc.id,
    title: doc.title,
    source: doc.source,
    content: doc.content.slice(0, 600),
    createdAt: doc.createdAt.toISOString(),
    chunkCount: chunks,
    status: chunks > 0 ? "ready" : "error",
  };
}

/**
 * POST /api/knowledge/:id/documents — ajoute du contenu à une base :
 *  - JSON { source: "text", title, content }
 *  - JSON { source: "url", url }         une page web
 *  - JSON { source: "site", url }        un site (jusqu'à 25 pages du même domaine)
 *  - multipart « file »                  PDF, TXT, MD, CSV (10 Mo max)
 * Chaque document est découpé en passages et indexé pour la recherche.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: params.id, organizationId: session.org.id },
      select: { id: true, _count: { select: { documents: true } } },
    });
    if (!kb) return notFound("Base introuvable");
    if (isRateLimited(`kb:${session.org.id}`, 30, 10 * 60_000)) {
      return tooMany("Trop d'imports en peu de temps. Réessayez dans quelques minutes.");
    }

    const docs: NewDoc[] = [];
    const type = req.headers.get("content-type") ?? "";
    try {
      if (type.startsWith("multipart/form-data")) {
        // Refus avant lecture du corps : pas de gros envoi chargé en mémoire.
        const declared = Number(req.headers.get("content-length") ?? 0);
        if (!declared || declared > MAX_FILE_BYTES + 64 * 1024) return badRequest("Fichier trop volumineux (4 Mo maximum).");
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return badRequest("Fichier manquant.");
        if (file.size > MAX_FILE_BYTES) return badRequest("Fichier trop volumineux (4 Mo maximum).");
        const text = await extractFileText(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
        const title = String(form.get("title") || "").trim().slice(0, 160) || file.name.replace(/\.[^.]+$/, "").slice(0, 160);
        docs.push({ title, source: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "file", content: text, origin: file.name.slice(0, 200) });
      } else {
        if (!type.startsWith("application/json")) return badRequest("Format de requête invalide.");
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return badRequest("Données invalides");
        const d = parsed.data;
        if (d.source === "text") {
          if (!d.content?.trim()) return badRequest("Le contenu est requis.");
          docs.push({ title: d.title?.trim() || "Document", source: "text", content: d.content.trim() });
        } else if (d.source === "url") {
          if (!d.url) return badRequest("URL manquante");
          const page = await fetchPage(d.url);
          if (!page.text) return badRequest("Aucun texte extrait de cette page.");
          docs.push({ title: d.title?.trim() || page.title, source: "url", content: page.text, origin: page.url });
        } else {
          if (!d.url) return badRequest("URL manquante");
          const room = Math.max(0, MAX_DOCS_PER_BASE - kb._count.documents);
          if (room === 0) return badRequest(`Cette base contient déjà ${MAX_DOCS_PER_BASE} documents.`);
          const pages = await crawlSite(d.url, Math.min(25, room));
          for (const p of pages) docs.push({ title: p.title, source: "site", content: p.text, origin: p.url });
        }
      }
    } catch (e) {
      if (e instanceof SourceError) return badRequest(e.message);
      throw e;
    }

    if (kb._count.documents + docs.length > MAX_DOCS_PER_BASE) {
      return badRequest(`Une base peut contenir au plus ${MAX_DOCS_PER_BASE} documents.`);
    }

    const out = [];
    for (const d of docs) {
      const doc = await addDocument(session.org.id, kb.id, d);
      if (!doc) continue;
      const chunks = await indexDocumentSafe(doc.id);
      out.push(summary(doc, chunks));
    }
    // Documents plus anciens éventuellement non indexés : rattrapés ici, pas pendant un appel.
    void ensureIndexed(kb.id).catch(() => {});
    return created({ document: out[0], documents: out });
  } catch (e) {
    console.error("[knowledge] import :", e instanceof Error ? e.message : e);
    return serverError();
  }
}
