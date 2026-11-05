import { NextRequest } from "next/server";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { ok, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/:id/test
 * Point d'entrée du test d'appel navigateur (WebRTC). L'établissement réel du
 * media stream arrive en Phase 3 ; on renvoie déjà le premier message et la
 * config pour alimenter l'aperçu côté client.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const agent = access.agent;
    return ok({
    ready: false,
    message:
      "Le test d'appel en direct (micro via WebRTC) sera activé en Phase 3.",
    firstMessage: agent.config.firstMessage,
    voice: agent.config.voice,
    });
  } catch {
    return serverError();
  }
}
