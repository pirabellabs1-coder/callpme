import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { prisma } from "@/lib/db/client";
import { runScenario, SimulationUnavailable } from "@/lib/simulation/run";
import { isRateLimited } from "@/lib/security/rate-limit";
import { ok, badRequest, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ scenarioId: z.string().max(60).optional() });

/**
 * POST /api/agents/:id/scenarios/run — rejoue un scénario (scenarioId) ou
 * tous les scénarios de l'agent. Les simulations consomment de l'IA : limitées.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    if (isRateLimited(`sim:${access.session.org.id}`, 20, 10 * 60_000)) {
      return tooMany("Trop de simulations en peu de temps. Réessayez dans quelques minutes.");
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return badRequest("Requête invalide");
    const ids = parsed.data.scenarioId
      ? [parsed.data.scenarioId]
      : (await prisma.testScenario.findMany({ where: { agentId: access.agent.id }, select: { id: true }, take: 10 })).map((s) => s.id);
    if (ids.length === 0) return badRequest("Aucun scénario à lancer.");

    const results = [];
    const started = Date.now();
    for (const id of ids) {
      if (Date.now() - started > 45_000) break; // le reste au prochain lancement
      try {
        const r = await runScenario(access.agent, id);
        results.push({ scenarioId: id, passed: r.passed, score: r.score });
      } catch (e) {
        if (e instanceof SimulationUnavailable) results.push({ scenarioId: id, error: e.message });
        else throw e;
      }
    }
    return ok({ results, partial: results.length < ids.length });
  } catch (e) {
    console.error("[simulation]", e instanceof Error ? e.message : e);
    return serverError("Simulation impossible");
  }
}
