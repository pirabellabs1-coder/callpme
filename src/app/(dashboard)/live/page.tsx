import { getCurrentOrg } from "@/lib/db/context";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { LiveMonitor } from "@/components/live/live-monitor";

export const metadata = { title: "En direct" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="En direct"
        description="Suivez les appels en cours. Les administrateurs peuvent écouter, souffler une consigne à l'agent ou prendre la main."
      />
      <LiveMonitor />
    </div>
  );
}
