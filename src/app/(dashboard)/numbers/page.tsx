import { requireSession, isOrgAdmin } from "@/lib/auth/session";
import { listPhoneNumbers, listProviders } from "@/lib/db/numbers";
import { getPlan, limitLabel } from "@/lib/billing/plans";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { NumbersManager } from "@/components/numbers/numbers-manager";
import { BuyNumber } from "@/components/numbers/buy-number";
import { telephonyProvider } from "@/lib/telephony/provider";

export const metadata = { title: "Numéros" };
export const dynamic = "force-dynamic";

export default async function NumbersPage() {
  const session = await requireSession();
  const plan = getPlan(session.org.plan);

  const [numbers, providers] = await Promise.all([
    listPhoneNumbers(session.org.id),
    listProviders(session.org.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Numéros"
        description="Vos opérateurs téléphoniques, vos numéros et leur lien avec vos agents."
      >
        <Badge variant="muted">
          {numbers.length}/{limitLabel(plan.maxNumbers)} numéros
        </Badge>
      </PageHeader>

      <BuyNumber
        available={telephonyProvider() !== null}
        isAdmin={isOrgAdmin(session)}
        remaining={plan.maxNumbers - numbers.length}
      />

      <NumbersManager
        initialNumbers={numbers}
        initialProviders={providers}
        maxNumbers={plan.maxNumbers}
      />
    </div>
  );
}
