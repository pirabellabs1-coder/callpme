import { listAllOrganizations } from "@/lib/db/admin";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { OrgPlanSelect } from "@/components/admin/org-plan-select";

export const metadata = { title: "Organisations" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function AdminOrganizationsPage() {
  const orgs = await listAllOrganizations();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisations"
        description={`${orgs.length} organisation${orgs.length > 1 ? "s" : ""} sur la plateforme.`}
      />
      <Card className="overflow-hidden">
        <div className="hidden items-center gap-4 border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
          <span className="flex-1">Organisation</span>
          <span className="w-36">Offre (abonnement)</span>
          <span className="w-20 text-right">Agents</span>
          <span className="w-20 text-right">Membres</span>
          <span className="w-20 text-right">Appels</span>
          <span className="hidden w-28 text-right md:block">Créée</span>
        </div>
        <div className="divide-y divide-border">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-foreground/70">
                  {o.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-sm font-medium text-foreground">{o.name}</span>
              </div>
              <span className="w-36">
                <OrgPlanSelect orgId={o.id} plan={o.plan} />
              </span>
              <span className="w-20 text-right text-sm tabular text-muted-foreground">{formatNumber(o.agents)}</span>
              <span className="w-20 text-right text-sm tabular text-muted-foreground">{formatNumber(o.users)}</span>
              <span className="w-20 text-right text-sm tabular text-muted-foreground">{formatNumber(o.calls)}</span>
              <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                {fmt.format(new Date(o.createdAt))}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
