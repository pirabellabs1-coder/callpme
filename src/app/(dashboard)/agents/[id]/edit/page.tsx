import { notFound } from "next/navigation";
import { studioVoiceOption } from "@/lib/voices/provider-voice";
import { listPlatformVoices, platformVoiceOption } from "@/lib/voices/platform";
import { prisma } from "@/lib/db/client";
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
  // Un agent d'une autre organisation est traité comme inexistant.
  if (!agent || agent.organizationId !== org.id) notFound();

  const [agents, numbers, customTools, kbs, voices, catalog] = await Promise.all([
    listAgents(org.id),
    listPhoneNumbers(org.id),
    listCustomTools(org.id),
    listKnowledgeBases(org.id),
    listVoices(org.id),
    listPlatformVoices({ activeOnly: true }),
  ]);
  // La voix actuelle de l'agent reste proposée même si l'admin l'a désactivée :
  // modifier l'agent ne doit jamais changer sa voix en silence.
  const currentId = agent.config.voice.providerVoiceId;
  const current =
    currentId && !catalog.some((v) => v.externalId === currentId)
      ? await prisma.platformVoice.findUnique({ where: { externalId: currentId } })
      : null;
  const catalogWithCurrent = current ? [current, ...catalog] : catalog;
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
      studioVoices={[...catalogWithCurrent.map(platformVoiceOption), ...voices.map(studioVoiceOption)]}
      agent={agent}
    />
  );
}
