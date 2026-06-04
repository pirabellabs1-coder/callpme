import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createKnowledgeBase } from "@/lib/db/knowledge";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const kb = await createKnowledgeBase(session.org.id, parsed.data);
    return created({ kb: { id: kb.id } });
  } catch {
    return serverError();
  }
}
