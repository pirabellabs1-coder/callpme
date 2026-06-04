import { NextRequest } from "next/server";
import { assignNumber, getAgentById } from "@/lib/db/agents";
import { assignNumberSchema } from "@/lib/validation/agent";
import { ok, badRequest, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/agents/:id/assign-number — assigne (ou retire) un numéro. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = assignNumberSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Numéro invalide", parsed.error.flatten());
    }
    const existing = await getAgentById(params.id);
    if (!existing) return notFound("Agent introuvable");
    const agent = await assignNumber(params.id, parsed.data.phoneNumber);
    return ok({ agent });
  } catch {
    return serverError("Impossible d'assigner le numéro");
  }
}
