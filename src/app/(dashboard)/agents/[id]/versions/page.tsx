import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { VersionsManager, type AbStats } from "@/components/agents/versions-manager";

export const metadata = { title: "Versions" };
export const dynamic = "force-dynamic";

/** Résultats du test A/B par variante depuis son lancement. */
async function abStats(agentId: string, since: Date): Promise<AbStats[]> {
  const calls = await prisma.call.findMany({
    where: { agentId, variant: { in: ["A", "B"] }, createdAt: { gte: since } },
    select: { variant: true, durationSec: true, status: true, evaluation: { select: { successScore: true, goalAchieved: true } } },
  });
  return (["A", "B"] as const).map((v) => {
    const list = calls.filter((c) => c.variant === v);
    const evaluated = list.filter((c) => c.evaluation);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      variant: v,
      calls: list.length,
      avgDurationSec: avg(list.map((c) => c.durationSec)),
      avgScore: avg(evaluated.map((c) => c.evaluation!.successScore)),
      goalRate: evaluated.length ? Math.round((evaluated.filter((c) => c.evaluation!.goalAchieved).length / evaluated.length) * 100) : null,
      transferRate: list.length ? Math.round((list.filter((c) => c.status === "transferred").length / list.length) * 100) : null,
    };
  });
}

export default async function AgentVersionsPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();
  const versions = await prisma.agentVersion.findMany({
    where: { agentId: agent.id },
    orderBy: { number: "desc" },
    select: { id: true, number: true, note: true, createdAt: true },
  });
  const ab = agent.config.abTest;
  const stats = ab?.enabled ? await abStats(agent.id, new Date(ab.startedAt)) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Versions et tests A/B</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Chaque modification du comportement de l&apos;agent (consignes, voix, parcours, outils…) est enregistrée. Revenez à une
          version en un clic, ou testez-en une sur une partie des appels avant de l&apos;adopter.
        </p>
      </div>
      {versions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Aucune version pour l&apos;instant : la première sera enregistrée à la prochaine modification de l&apos;agent.
        </Card>
      ) : (
        <VersionsManager
          agentId={agent.id}
          versions={versions.map((v) => ({ id: v.id, number: v.number, note: v.note, createdAt: v.createdAt.toISOString() }))}
          ab={ab?.enabled ? { versionId: ab.versionId, share: ab.share, startedAt: ab.startedAt } : null}
          stats={stats}
        />
      )}
    </div>
  );
}
