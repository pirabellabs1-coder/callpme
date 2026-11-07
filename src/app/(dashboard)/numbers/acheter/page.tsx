import { requireSession, isOrgAdmin } from "@/lib/auth/session";
import { orgCountry } from "@/lib/geo/org-country";
import { PageHeader } from "@/components/dashboard/page-header";
import { NumberMarket } from "@/components/numbers/number-market";
import { listOrgNumberRequests, stockAvailability } from "@/lib/numbers/market-db";
import { marketCountry } from "@/lib/numbers/market";

export const metadata = { title: "Acheter un numéro" };
export const dynamic = "force-dynamic";

export default async function BuyNumberPage() {
  const session = await requireSession();
  const [availability, requests, country] = await Promise.all([
    stockAvailability(),
    listOrgNumberRequests(session.org.id),
    orgCountry(session.org.id).catch(() => null),
  ]);
  const defaultCountry = country && marketCountry(country) ? country : "BJ";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acheter un numéro"
        description="Choisissez un numéro local fourni par nos opérateurs partenaires. Notre équipe vérifie votre demande et active le numéro."
        breadcrumb={[{ label: "Numéros", href: "/numbers" }, { label: "Acheter un numéro" }]}
      />
      <NumberMarket
        availability={availability}
        defaultCountry={defaultCountry}
        canRequest={isOrgAdmin(session)}
        defaultContact={{ companyName: session.org.name, contactName: session.user.name ?? "", contactEmail: session.user.email }}
        requests={requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
