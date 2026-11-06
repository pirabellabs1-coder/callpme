import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { listCustomTools } from "@/lib/db/custom-tools";
import { ALL_TOOLS } from "@/lib/tools/registry";
import { FlowBuilder } from "@/components/agents/flow-builder";

export const metadata = { title: "Parcours de l'agent" };
export const dynamic = "force-dynamic";

/** Outils réservés aux blocs dédiés (transfert, fin) : pas proposés dans « Action ». */
const DEDICATED = new Set(["transferToHuman", "endCall"]);

export default async function AgentFlowPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();

  const customs = await listCustomTools(session.org.id);
  const tools = [
    ...ALL_TOOLS.filter((t) => !DEDICATED.has(t.name)).map((t) => ({ name: t.name, label: t.label })),
    ...customs.map((c) => ({ name: c.name, label: c.label })),
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Parcours de conversation</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Le déroulé que l&apos;agent suit pendant ses appels. Il garde une conversation naturelle et répond aux questions
          hors parcours avant d&apos;y revenir. Vérifiez le résultat dans « Tester » ou « Scénarios de test ».
        </p>
      </div>
      <FlowBuilder
        agentId={agent.id}
        role={agent.role}
        initialFlow={agent.config.flow ?? null}
        tools={tools}
        hasTransferNumber={Boolean(agent.config.transferNumber)}
      />
    </div>
  );
}
