import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { placeOutboundCall, vapiConfigured } from "@/lib/telephony/vapi";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ toNumber: z.string().min(5).max(25) });

/** POST /api/agents/:id/call-real — déclenche un VRAI appel sortant via Vapi. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!vapiConfigured()) {
      return forbidden("La téléphonie réelle n'est pas encore connectée.");
    }
    const agent = await getAgentById(params.id);
    if (!agent || agent.organizationId !== session.org.id) {
      return notFound("Agent introuvable");
    }
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Numéro invalide");

    const result = await placeOutboundCall({
      agent,
      organizationName: session.org.name,
      toNumber: parsed.data.toNumber,
    });
    if (!result.ok) return badRequest(result.error ?? "Appel impossible");
    return ok({ callId: result.callId, status: result.status });
  } catch {
    return serverError("Appel impossible");
  }
}
