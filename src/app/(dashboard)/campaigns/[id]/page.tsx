import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCampaign } from "@/lib/db/campaigns";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

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

  return <CampaignDetail campaign={campaign} />;
}
