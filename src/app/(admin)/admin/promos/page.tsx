import { listPromoCodes } from "@/lib/db/promo";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminPromos } from "@/components/admin/admin-promos";

export const metadata = { title: "Codes promo" };
export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const promos = await listPromoCodes();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Codes promo"
        description="Créez et gérez les codes de réduction et offres offertes."
      />
      <AdminPromos initial={promos} />
    </div>
  );
}
