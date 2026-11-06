import { companyComplete, getCompany } from "@/lib/billing/company";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { CompanyForm } from "@/components/admin/company-form";

export const metadata = { title: "Société et factures" };
export const dynamic = "force-dynamic";

export default async function AdminCompanyPage() {
  const company = await getCompany();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Société et factures"
        description="Les informations légales qui figurent sur chaque facture émise par Callpme. Une facture déjà émise ne change jamais : ces informations s'appliquent aux suivantes."
      />
      {!companyComplete(company) && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
          Pour des factures conformes, renseignez au minimum la raison sociale, l&apos;adresse, l&apos;IFU et le RCCM.
        </Card>
      )}
      <CompanyForm initial={company} />
    </div>
  );
}
