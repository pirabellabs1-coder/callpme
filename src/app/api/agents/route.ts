import { NextRequest } from "next/server";
import { requireOrgId } from "@/lib/db/context";
import { getSession } from "@/lib/auth/session";
import { getActiveClientId } from "@/lib/db/active-client";
import { listAgents, createAgent } from "@/lib/db/agents";
import { createAgentSchema } from "@/lib/validation/agent";
import { canCreateAgent } from "@/lib/billing/limits";
import { dispatchEvent } from "@/lib/webhooks/dispatch";
import {
  ok,
  created,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from "@/lib/api/respond";
import {
  AGENT_ROLES,
  type AgentConfig,
  type AgentRole,
  type AgentStatus,
  type CreateAgentInput,
} from "@/lib/shared/types";

export const dynamic = "force-dynamic";

/** GET /api/agents — liste les agents de l'organisation (filtres optionnels). */
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireOrgId();
    const sp = req.nextUrl.searchParams;
    const roleParam = sp.get("role");
    const statusParam = sp.get("status");

    const agents = await listAgents(orgId, {
      role:
        roleParam && (AGENT_ROLES as readonly string[]).includes(roleParam)
          ? (roleParam as AgentRole)
          : undefined,
      status:
        statusParam &&
        ["active", "paused", "draft"].includes(statusParam)
          ? (statusParam as AgentStatus)
          : undefined,
      search: sp.get("search")?.trim() || undefined,
    });
    return ok({ agents });
  } catch {
    return serverError();
  }
}

/** POST /api/agents — crée un agent (avec rôle). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const orgId = session.org.id;

    const body = await req.json().catch(() => null);
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }

    const limit = await canCreateAgent(orgId, session.org.plan);
    if (!limit.ok) return forbidden(limit.message);

    const d = parsed.data;
    const input: CreateAgentInput = {
      name: d.name,
      role: d.role as AgentRole,
      status: d.status as AgentStatus | undefined,
      config: d.config as AgentConfig,
      phoneNumber: d.phoneNumber ?? null,
      clientId: d.clientId ?? (await getActiveClientId(orgId)),
      knowledgeBaseId: d.knowledgeBaseId ?? null,
    };
    const agent = await createAgent(orgId, input);
    await dispatchEvent(orgId, "agent.created", {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    });
    return created({ agent });
  } catch {
    return serverError("Impossible de créer l'agent");
  }
}
