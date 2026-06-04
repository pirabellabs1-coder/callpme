import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/auth/api-key";
import { getAgentById, updateAgent, deleteAgent } from "@/lib/db/agents";
import { dispatchEvent } from "@/lib/webhooks/dispatch";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";
import type { AgentStatus, UpdateAgentInput } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  status: z.enum(["active", "paused", "draft"]).optional(),
  phoneNumber: z.string().max(40).nullable().optional(),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  const org = await authenticateApiKey(req);
  if (!org) return unauthorized("Clé API invalide ou manquante");
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== org.id) {
    return notFound("Agent introuvable");
  }
  return ok({ data: agent });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const org = await authenticateApiKey(req);
    if (!org) return unauthorized("Clé API invalide ou manquante");
    const existing = await getAgentById(params.id);
    if (!existing || existing.organizationId !== org.id) {
      return notFound("Agent introuvable");
    }
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }
    const patch: UpdateAgentInput = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.status !== undefined
        ? { status: parsed.data.status as AgentStatus }
        : {}),
      ...(parsed.data.phoneNumber !== undefined
        ? { phoneNumber: parsed.data.phoneNumber }
        : {}),
    };
    const agent = await updateAgent(params.id, patch);
    if (agent) {
      await dispatchEvent(org.id, "agent.updated", {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      });
    }
    return ok({ data: agent });
  } catch {
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const org = await authenticateApiKey(req);
    if (!org) return unauthorized("Clé API invalide ou manquante");
    const existing = await getAgentById(params.id);
    if (!existing || existing.organizationId !== org.id) {
      return notFound("Agent introuvable");
    }
    await deleteAgent(params.id);
    await dispatchEvent(org.id, "agent.deleted", {
      id: existing.id,
      name: existing.name,
    });
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
