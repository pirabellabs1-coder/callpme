import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { outcomesByAgent, startOfMonth, usageByClient } from "@/lib/db/outcomes";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientsManager } from "@/components/clients/clients-manager";
import { AgencyBrandForm, ClientAccessManager } from "@/components/clients/agency-access";
import { prisma } from "@/lib/db/client";
import { domainToken, txtRecordName } from "@/lib/agency/domain";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireSession();

  // Le multi-clients (espaces agence) est réservé à l'offre Agence.
  if (session.org.plan !== "agency") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          description="Gérez les sous-comptes de votre agence — chaque client a ses propres agents."
        />
        <Card className="mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Building2 className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
            Réservé à l&apos;offre Agence
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            La gestion multi-clients (sous-comptes, marque blanche par client,
            espaces dédiés) est disponible avec l&apos;offre Agence. Passez à
            l&apos;offre Agence pour créer et piloter les espaces de vos clients.
          </p>
          <Link
            href="/billing"
            className={cn(buttonVariants({ variant: "brand" }), "mt-5 gap-1.5")}
          >
            Découvrir l&apos;offre Agence
            <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    );
  }

  const [clients, outcomes] = await Promise.all([
    listClients(session.org.id),
    outcomesByAgent(session.org.id, startOfMonth()),
  ]);
  const usage = usageByClient(outcomes);
  const [org, accessUsers, accessInvites] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.org.id },
      select: { brandName: true, brandLogoUrl: true, customDomain: true, customDomainVerifiedAt: true },
    }),
    prisma.user.findMany({ where: { organizationId: session.org.id, clientId: { not: null } }, select: { id: true, email: true, name: true, clientId: true } }),
    prisma.invitation.findMany({
      where: { organizationId: session.org.id, clientId: { not: null }, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, clientId: true },
    }),
  ]);
  const accessRows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    users: accessUsers.filter((u) => u.clientId === c.id).map((u) => ({ id: u.id, email: u.email, name: u.name })),
    pending: accessInvites.filter((i) => i.clientId === c.id).map((i) => ({ id: i.id, email: i.email })),
  }));
  const nameOf = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Client supprimé" : "Agence (sans client)");
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Gérez les sous-comptes de votre agence — chaque client a ses propres agents."
      />
      {usage.some((u) => u.calls > 0) && (
        <Card className="overflow-x-auto">
          <div className="p-5 pb-3">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">Consommation de {month}</h2>
            <p className="text-sm text-muted-foreground">Minutes et résultats par client, pour piloter et refacturer.</p>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Consommation par client ce mois-ci</caption>
            <thead>
              <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Client</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Agents</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Appels</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Minutes</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Rendez-vous</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Prospects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {usage.map((u) => (
                <tr key={u.clientId ?? "none"}>
                  <th scope="row" className="px-5 py-3 text-left font-medium">{nameOf(u.clientId)}</th>
                  <td className="px-3 py-3 text-right text-muted-foreground">{u.agents}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(u.calls)}</td>
                  <td className="px-3 py-3 text-right font-medium text-foreground">{formatNumber(u.minutes)}</td>
                  <td className="px-3 py-3 text-right">{u.appointments || "—"}</td>
                  <td className="px-5 py-3 text-right">{u.leads || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ClientsManager initial={clients} />
      <ClientAccessManager rows={accessRows} />
      <AgencyBrandForm
        initial={{ brandName: org?.brandName ?? "", brandLogoUrl: org?.brandLogoUrl ?? "", customDomain: org?.customDomain ?? "" }}
        domain={
          org?.customDomain
            ? {
                verified: Boolean(org.customDomainVerifiedAt),
                txtName: txtRecordName(org.customDomain),
                txtValue: domainToken(session.org.id, org.customDomain),
              }
            : null
        }
      />
    </div>
  );
}
