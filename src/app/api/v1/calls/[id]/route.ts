import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-key";
import { prisma } from "@/lib/db/client";
import { getCallById } from "@/lib/db/calls";
import { ok, unauthorized, notFound } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/v1/calls/:id — transcript complet (auth par clé API). */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const org = await authenticateApiKey(req);
  if (!org) return unauthorized("Clé API invalide ou manquante");

  const call = await getCallById(params.id);
  if (!call) return notFound("Appel introuvable");

  const agent = await prisma.agent.findUnique({
    where: { id: call.agentId },
    select: { organizationId: true },
  });
  if (!agent || agent.organizationId !== org.id) {
    return notFound("Appel introuvable");
  }
  return ok({ data: call });
}
