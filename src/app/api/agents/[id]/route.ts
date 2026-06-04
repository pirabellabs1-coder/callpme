import { NextRequest } from "next/server";
import {
  getAgentById,
  updateAgent,
  deleteAgent,
} from "@/lib/db/agents";
import { updateAgentSchema } from "@/lib/validation/agent";
import { dispatchEvent } from "@/lib/webhooks/dispatch";
import { ok, badRequest, notFound, serverError } from "@/lib/api/respond";
import type {
  AgentConfig,
  AgentRole,
  AgentStatus,
  UpdateAgentInput,
} from "@/lib/shared/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/agents/:id */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const agent = await getAgentById(params.id);
    return agent ? ok({ agent }) : notFound("Agent introuvable");
  } catch {
    return serverError();
  }
}

/** PATCH /api/agents/:id — modifie config, statut, rôle, nom… */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue
        ? `Champ invalide « ${issue.path.join(".")} » : ${issue.message}`
        : "Données invalides";
      return badRequest(msg, parsed.error.flatten());
    }
    const d = parsed.data;
    // FK vides -> null (sinon violation de contrainte sur PostgreSQL).
    const patch: UpdateAgentInput = {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.role !== undefined ? { role: d.role as AgentRole } : {}),
      ...(d.status !== undefined ? { status: d.status as AgentStatus } : {}),
      ...(d.config !== undefined ? { config: d.config as AgentConfig } : {}),
      ...(d.phoneNumber !== undefined ? { phoneNumber: d.phoneNumber || null } : {}),
      ...(d.clientId !== undefined ? { clientId: d.clientId || null } : {}),
      ...(d.knowledgeBaseId !== undefined
        ? { knowledgeBaseId: d.knowledgeBaseId || null }
        : {}),
    };
    const agent = await updateAgent(params.id, patch);
    if (agent) {
      await dispatchEvent(agent.organizationId, "agent.updated", {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      });
    }
    return agent ? ok({ agent }) : notFound("Agent introuvable");
  } catch {
    return serverError("Impossible de mettre à jour l'agent");
  }
}

/** DELETE /api/agents/:id */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const agent = await getAgentById(params.id);
    if (!agent) return notFound("Agent introuvable");
    await deleteAgent(params.id);
    await dispatchEvent(agent.organizationId, "agent.deleted", {
      id: agent.id,
      name: agent.name,
    });
    return ok({ success: true });
  } catch {
    return serverError("Impossible de supprimer l'agent");
  }
}
