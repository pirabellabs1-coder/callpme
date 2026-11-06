import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { prisma } from "@/lib/db/client";
import { created, badRequest, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const MAX_SCENARIOS = 30;
const list = z.array(z.string().trim().min(1).max(120)).max(20).optional();

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  mode: z.enum(["script", "persona"]),
  callerPrompt: z.string().trim().min(3, "Décrivez l'appelant ou ses répliques").max(4000),
  maxTurns: z.number().int().min(1).max(12).optional(),
  expectations: z.object({
    mustCallTools: list,
    mustNotCallTools: list,
    mustSay: list,
    mustNotSay: list,
    judge: z.string().trim().max(600).optional(),
  }),
});

/** POST /api/agents/:id/scenarios — crée un scénario de test pour l'agent. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Scénario invalide");
    const count = await prisma.testScenario.count({ where: { agentId: access.agent.id } });
    if (count >= MAX_SCENARIOS) return badRequest(`${MAX_SCENARIOS} scénarios maximum par agent.`);
    const d = parsed.data;
    const sc = await prisma.testScenario.create({
      data: {
        organizationId: access.session.org.id,
        agentId: access.agent.id,
        name: d.name,
        mode: d.mode,
        callerPrompt: d.callerPrompt,
        maxTurns: d.maxTurns ?? 8,
        expectations: JSON.stringify(d.expectations),
      },
    });
    return created({ scenario: { id: sc.id } });
  } catch {
    return serverError();
  }
}
