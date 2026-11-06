import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCampaign } from "@/lib/db/campaigns";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { CampaignSettingsCard } from "@/components/campaigns/campaign-settings";
import { inCallingWindow, nextWindowStart } from "@/lib/campaigns/settings";

export const metadata = { title: "Campagne" };
export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const campaign = await getCampaign(session.org.id, params.id);
  if (!campaign) notFound();

  const now = new Date();
  const next = inCallingWindow(now, campaign.settings) ? null : nextWindowStart(now, campaign.settings);
  const windowNote = next
    ? `Hors plage : reprise ${new Intl.DateTimeFormat("fr-FR", {
        timeZone: campaign.settings.timezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(next)}`
    : null;

  return (
    <div className="space-y-6">
      <CampaignDetail campaign={campaign} />
      <CampaignSettingsCard
        campaignId={campaign.id}
        initial={campaign.settings}
        status={campaign.status}
        windowNote={windowNote}
      />
    </div>
  );
}
