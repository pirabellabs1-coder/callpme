import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/auth/api-key";
import { listAgents, createAgent } from "@/lib/db/agents";
import { buildDefaultConfig } from "@/lib/agents/build-config";
import { canCreateAgent } from "@/lib/billing/limits";
import { dispatchEvent } from "@/lib/webhooks/dispatch";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/api/respond";
import {
  AGENT_ROLES,
  type AgentRole,
  type AgentStatus,
  type CreateAgentInput,
} from "@/lib/shared/types";

export const dynamic = "force-dynamic";

/** GET /api/v1/agents — liste les agents (auth par clé API). */
export async function GET(req: NextRequest) {
  const org = await authenticateApiKey(req);
  if (!org) return unauthorized("Clé API invalide ou manquante");

  const sp = req.nextUrl.searchParams;
  const role = sp.get("role");
  const status = sp.get("status");
  const agents = await listAgents(org.id, {
    role:
      role && (AGENT_ROLES as readonly string[]).includes(role)
        ? (role as AgentRole)
        : undefined,
    status:
      status && ["active", "paused", "draft"].includes(status)
        ? (status as AgentStatus)
        : undefined,
    search: sp.get("search")?.trim() || undefined,
  });
  return ok({ data: agents });
}

/**
 * POST /api/v1/agents — crée un agent depuis le minimum (nom + rôle).
 * La config (prompt, voix, modèle, outils) est générée par défaut depuis le
 * rôle, avec surcharges optionnelles.
 */
const v1CreateSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.enum([
    "support",
    "appointment",
    "lead_qualification",
    "outbound_sales",
    "receptionist",
    "survey",
    "custom",
  ]),
  status: z.enum(["active", "paused", "draft"]).optional(),
  phoneNumber: z.string().max(40).nullable().optional(),
  firstMessage: z.string().max(2000).optional(),
  firstSpeaker: z.enum(["agent", "caller"]).optional(),
  guardrails: z.array(z.string().max(500)).max(30).optional(),
  persona: z.string().max(1000).optional(),
  customRole: z
    .object({ label: z.string().max(80), description: z.string().max(2000) })
    .optional(),
  tools: z.array(z.string().max(80)).max(60).optional(),
  voice: z
    .object({
      provider: z.enum(["elevenlabs", "azure", "playht"]).optional(),
      voiceId: z.string().max(120).optional(),
      language: z.string().max(12).optional(),
      speed: z.number().min(0.5).max(2).optional(),
    })
    .optional(),
  model: z
    .object({
      provider: z.enum(["openai", "anthropic", "mistral"]).optional(),
      modelId: z.string().max(80).optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const org = await authenticateApiKey(req);
    if (!org) return unauthorized("Clé API invalide ou manquante");

    const body = await req.json().catch(() => null);
    const parsed = v1CreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }
    const limit = await canCreateAgent(org.id, org.plan);
    if (!limit.ok) return forbidden(limit.message);

    const d = parsed.data;
    const config = buildDefaultConfig(d.role as AgentRole, d.name, org.name, {
      firstMessage: d.firstMessage,
      firstSpeaker: d.firstSpeaker,
      guardrails: d.guardrails,
      persona: d.persona,
      voice: d.voice,
      model: d.model,
      tools: d.tools,
      customRole: d.customRole,
    });
    const input: CreateAgentInput = {
      name: d.name,
      role: d.role as AgentRole,
      status: (d.status as AgentStatus) ?? "draft",
      config,
      phoneNumber: d.phoneNumber ?? null,
    };
    const agent = await createAgent(org.id, input);
    await dispatchEvent(org.id, "agent.created", {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    });
    return created({ data: agent });
  } catch {
    return serverError("Impossible de créer l'agent");
  }
}
