/**
 * Application réelle des limites d'offre.
 */
import { getPlan } from "./plans";
import { countAgents } from "@/lib/db/agents";

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
