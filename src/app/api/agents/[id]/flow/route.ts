import { NextRequest } from "next/server";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { updateAgent } from "@/lib/db/agents";
import { listCustomTools } from "@/lib/db/custom-tools";
import { ALL_TOOLS } from "@/lib/tools/registry";
import { checkFlow, flowSchema } from "@/lib/flow/flow";
import { badRequest, ok, serverError } from "@/lib/api/respond";
import { dispatchEvent } from "@/lib/webhooks/dispatch";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * PUT /api/agents/:id/flow — enregistre le parcours de conversation dessiné
 * dans le constructeur visuel. Refusé si le parcours est incohérent
 * (bloc introuvable, action sans outil connu…).
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => null);
    const parsed = flowSchema.safeParse(body?.flow);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return badRequest(issue ? `Parcours invalide : ${issue.message}` : "Parcours invalide.");
    }
    const flow = parsed.data;
    const customs = await listCustomTools(access.agent.organizationId);
    const known = [...ALL_TOOLS.map((t) => t.name), ...customs.map((c) => c.name)];
    const { errors, warnings } = checkFlow(flow, known, { hasTransferNumber: Boolean(access.agent.config.transferNumber) });
    if (errors.length) return badRequest(errors[0].message, { errors });

    // Seule la clé « flow » est envoyée : une modification concurrente du reste de la config est conservée.
    const agent = await updateAgent(access.agent.id, { config: { flow } });
    if (agent) await dispatchEvent(agent.organizationId, "agent.updated", { id: agent.id, name: agent.name, status: agent.status });
    return ok({ flow: agent?.config.flow ?? flow, warnings });
  } catch {
    return serverError("Impossible d'enregistrer le parcours.");
  }
}
