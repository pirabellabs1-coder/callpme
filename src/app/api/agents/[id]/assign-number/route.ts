import { NextRequest } from "next/server";
import { assignNumber, ForeignReferenceError } from "@/lib/db/agents";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { assignNumberSchema } from "@/lib/validation/agent";
import { ok, badRequest, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/agents/:id/assign-number — assigne (ou retire) un numéro. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => null);
    const parsed = assignNumberSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Numéro invalide", parsed.error.flatten());
    }
    const agent = await assignNumber(params.id, parsed.data.phoneNumber);
    return ok({ agent });
  } catch (e) {
    if (e instanceof ForeignReferenceError) return badRequest(e.message);
    return serverError("Impossible d'assigner le numéro");
  }
}
