import { requireSession } from "@/lib/auth/session";
import { listCampaigns } from "@/lib/db/campaigns";
import { listAgents } from "@/lib/db/agents";
import { PageHeader } from "@/components/dashboard/page-header";
import { CampaignsList } from "@/components/campaigns/campaigns-list";

export const metadata = { title: "Campagnes" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await requireSession();
  const [campaigns, agents] = await Promise.all([
    listCampaigns(session.org.id),
    listAgents(session.org.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campagnes"
        description="Lancez des appels sortants sur une liste de contacts."
      />
      <CampaignsList
        initial={campaigns}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
