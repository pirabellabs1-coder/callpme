import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { addDocument } from "@/lib/db/knowledge";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  source: z.enum(["text", "url"]),
  title: z.string().max(160).optional(),
  content: z.string().max(50000).optional(),
  url: z.string().url().max(500).optional(),
});

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");

    let title = parsed.data.title?.trim() || "Document";
    let content = "";

    if (parsed.data.source === "url") {
      if (!parsed.data.url) return badRequest("URL manquante");
      try {
        const res = await fetch(parsed.data.url, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "Callpme-KB/1.0" },
        });
        const html = await res.text();
        content = htmlToText(html).slice(0, 50000);
        if (!parsed.data.title) {
          const m = html.match(/<title>([^<]+)<\/title>/i);
          title = m?.[1]?.trim() || new URL(parsed.data.url).hostname;
        }
      } catch {
        return badRequest("Impossible de récupérer l'URL.");
      }
      if (!content) return badRequest("Aucun texte extrait de l'URL.");
    } else {
      if (!parsed.data.content?.trim())
        return badRequest("Le contenu est requis.");
      content = parsed.data.content.trim();
    }

    const doc = await addDocument(session.org.id, params.id, {
      title,
      source: parsed.data.source,
      content,
    });
    if (!doc) return badRequest("Base introuvable");
    return created({
      document: {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        content: doc.content.slice(0, 600),
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch {
    return serverError();
  }
}
