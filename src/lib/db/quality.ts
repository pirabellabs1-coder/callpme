/**
 * Qualité technique des appels d'une organisation sur une période :
 * temps de réponse moyen, part d'appels lents, appels à problème.
 */
import { prisma } from "./client";
import { parseQuality, SLOW_RESPONSE_MS } from "@/lib/voice-engine/quality";

export interface QualityOverview {
  /** Appels mesurés (ceux d'avant la mesure n'ont pas de données). */
  measured: number;
  responseAvgMs: number | null;
  /** Part des appels dont la réponse moyenne dépasse le seuil (0..100). */
  slowRate: number | null;
  withIssues: number;
  /** Appels à revoir en priorité (les plus lents ou en panne). */
  worst: { id: string; agentName: string; createdAt: Date; responseAvgMs: number | null; issue: string }[];
}

/** Plafond de lecture : la vue reste rapide même sur une grosse période. */
const MAX_ROWS = 2000;

export async function qualityOverview(orgId: string, since: Date): Promise<QualityOverview> {
  const rows = await prisma.call.findMany({
    where: { agent: { organizationId: orgId }, createdAt: { gte: since }, quality: { not: null } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { id: true, createdAt: true, quality: true, agent: { select: { name: true } } },
  });

  let measured = 0;
  let weighted = 0;
  let turns = 0;
  let slow = 0;
  let withIssues = 0;
  const flagged: QualityOverview["worst"] = [];
  for (const r of rows) {
    const q = parseQuality(r.quality);
    if (!q || q.turns === 0) continue;
    measured++;
    if (q.responseAvgMs !== null) {
      weighted += q.responseAvgMs * q.turns;
      turns += q.turns;
      if (q.responseAvgMs > SLOW_RESPONSE_MS) slow++;
    }
    if (q.issues.length) {
      withIssues++;
      flagged.push({ id: r.id, agentName: r.agent.name, createdAt: r.createdAt, responseAvgMs: q.responseAvgMs, issue: q.issues[0] });
    }
  }
  flagged.sort((a, b) => (b.responseAvgMs ?? 0) - (a.responseAvgMs ?? 0));
  return {
    measured,
    responseAvgMs: turns ? Math.round(weighted / turns) : null,
    slowRate: measured ? Math.round((slow / measured) * 100) : null,
    withIssues,
    worst: flagged.slice(0, 5),
  };
}
