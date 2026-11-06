import { getCurrentOrg } from "@/lib/db/context";
import { studioVoiceOption } from "@/lib/voices/provider-voice";
import { listPlatformVoices, platformVoiceOption } from "@/lib/voices/platform";
import { listAgents } from "@/lib/db/agents";
import { listPhoneNumbers } from "@/lib/db/numbers";
import { listCustomTools } from "@/lib/db/custom-tools";
import { listKnowledgeBases } from "@/lib/db/knowledge";
import { listVoices } from "@/lib/db/voices";
import { getTemplate } from "@/lib/agents/templates";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { AgentWizard } from "@/components/agents/agent-wizard";

export const metadata = { title: "Créer un agent" };

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;
  const template = searchParams.template
    ? getTemplate(searchParams.template)
    : undefined;

  const [agents, numbers, customTools, kbs, voices, catalog] = await Promise.all([
    listAgents(org.id),
    listPhoneNumbers(org.id),
    listCustomTools(org.id),
    listKnowledgeBases(org.id),
    listVoices(org.id),
    listPlatformVoices({ activeOnly: true }),
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
      studioVoices={[...catalog.map(platformVoiceOption), ...voices.map(studioVoiceOption)]}
      template={template}
    />
  );
}
