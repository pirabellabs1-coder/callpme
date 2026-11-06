import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { embeddingsAvailable, ensureIndexed, searchKnowledge } from "@/lib/knowledge";
import { isRateLimited } from "@/lib/security/rate-limit";
import { ok, badRequest, notFound, unauthorized, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ q: z.string().trim().min(2).max(500) });

/** POST /api/knowledge/:id/search — « ce que l'agent trouverait » pour une question. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (isRateLimited(`kbs:${session.org.id}`, 60, 60_000)) return tooMany("Trop de recherches, patientez une minute.");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Question trop courte.");
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: params.id, organizationId: session.org.id }, select: { id: true } });
    if (!kb) return notFound("Base introuvable");
    await ensureIndexed(kb.id);
    const hits = await searchKnowledge(kb.id, parsed.data.q, 4);
    return ok({ hits, semantic: embeddingsAvailable() });
  } catch {
    return serverError();
  }
}
