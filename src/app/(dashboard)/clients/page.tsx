import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientsManager } from "@/components/clients/clients-manager";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireSession();
  const clients = await listClients(session.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Gérez les sous-comptes de votre agence — chaque client a ses propres agents."
      />
      <ClientsManager initial={clients} />
    </div>
  );
}
