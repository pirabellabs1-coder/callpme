import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";
import { resolveTools } from "@/lib/tools/registry";
import { personaAvailable } from "@/lib/simulation/run";
import { parseExpectations, type CheckResult } from "@/lib/simulation/checks";
import { ScenarioManager, type ScenarioView } from "@/components/agents/scenario-manager";
import type { TranscriptTurn } from "@/lib/shared/types";

export const metadata = { title: "Tests de l'agent" };
export const dynamic = "force-dynamic";

export default async function AgentTestsPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();

  const scenarios = await prisma.testScenario.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "asc" },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const parse = <T,>(raw: string, fallback: T): T => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };
  const views: ScenarioView[] = scenarios.map((s) => {
    const run = s.runs[0];
    return {
      id: s.id,
      name: s.name,
      mode: s.mode as "script" | "persona",
      callerPrompt: s.callerPrompt,
      expectations: parseExpectations(s.expectations),
      lastRun: run
        ? {
            passed: run.passed,
            score: run.score,
            createdAt: run.createdAt.toISOString(),
            transcript: parse<TranscriptTurn[]>(run.transcript, []),
            checks: parse<CheckResult[]>(run.checks, []),
          }
        : null,
    };
  });

  return (
    <ScenarioManager
      agentId={agent.id}
      scenarios={views}
      tools={resolveTools(agent.config.tools).map((t) => ({ name: t.name, label: t.label }))}
      personaAvailable={personaAvailable()}
    />
  );
}
