import { requireSession } from "@/lib/auth/session";
import { listConnectedProviders } from "@/lib/db/integrations";
import { PageHeader } from "@/components/dashboard/page-header";
import { IntegrationsManager } from "@/components/integrations/integrations-manager";

export const metadata = { title: "Intégrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const connected = await listConnectedProviders(session.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intégrations"
        description="Connectez Callpme à vos outils — agenda, CRM, notifications."
      />
      <IntegrationsManager connected={connected} />
    </div>
  );
}
