import { notFound } from "next/navigation";
import { getCurrentOrg } from "@/lib/db/context";
import { getAgentById, listAgents } from "@/lib/db/agents";
import { listPhoneNumbers } from "@/lib/db/numbers";
import { listCustomTools } from "@/lib/db/custom-tools";
import { listKnowledgeBases } from "@/lib/db/knowledge";
import { listVoices } from "@/lib/db/voices";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { AgentWizard } from "@/components/agents/agent-wizard";

export const metadata = { title: "Modifier l'agent" };

export default async function EditAgentPage({
  params,
}: {
  params: { id: string };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const agent = await getAgentById(params.id);
  if (!agent) notFound();

  const [agents, numbers, customTools, kbs, voices] = await Promise.all([
    listAgents(org.id),
    listPhoneNumbers(org.id),
    listCustomTools(org.id),
    listKnowledgeBases(org.id),
    listVoices(org.id),
  ]);
  const usedNumbers = agents
    .map((a) => a.phoneNumber)
    .filter((n): n is string => Boolean(n));

  return (
    <AgentWizard
      organizationName={org.name}
      usedNumbers={usedNumbers}
      availableNumbers={numbers}
      customTools={customTools}
      knowledgeBases={kbs.map((k) => ({ id: k.id, name: k.name }))}
      studioVoices={voices.map((v) => ({ id: v.id, name: v.name, gender: v.gender, sampleUrl: v.sampleUrl, provider: v.provider }))}
      agent={agent}
    />
  );
}
