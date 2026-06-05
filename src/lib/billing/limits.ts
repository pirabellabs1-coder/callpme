/**
 * Application réelle des limites d'offre.
 */
import { getPlan } from "./plans";
import { countAgents } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";

export interface LimitCheck {
  ok: boolean;
  message?: string;
}

export async function canCreateAgent(
  orgId: string,
  plan: string,
): Promise<LimitCheck> {
  const p = getPlan(plan);
  const count = await countAgents(orgId);
  if (count >= p.maxAgents) {
    return {
      ok: false,
      message: `Limite de l'offre ${p.name} atteinte (${p.maxAgents} agent${
        p.maxAgents > 1 ? "s" : ""
      } maximum). Passez à une offre supérieure pour en créer davantage.`,
    };
  }
  return { ok: true };
}

/** Début du mois courant (00:00, jour 1). */
function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Minutes d'appel consommées par l'organisation depuis le début du mois. */
export async function monthlyMinutesUsed(orgId: string): Promise<number> {
  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const ids = agents.map((a) => a.id);
  if (ids.length === 0) return 0;
  const agg = await prisma.call.aggregate({
    where: { agentId: { in: ids }, createdAt: { gte: startOfMonth() } },
    _sum: { durationSec: true },
  });
  return Math.round((agg._sum.durationSec ?? 0) / 60);
}

/** Vérifie qu'il reste des minutes sur l'offre (quota mensuel). */
export async function canUseMinutes(
  orgId: string,
  plan: string,
): Promise<LimitCheck> {
  const p = getPlan(plan);
  const used = await monthlyMinutesUsed(orgId);
  if (used >= p.minutes) {
    return {
      ok: false,
      message: `Quota mensuel de l'offre ${p.name} atteint (${p.minutes} minutes). Passez à une offre supérieure pour continuer.`,
    };
  }
  return { ok: true };
}
