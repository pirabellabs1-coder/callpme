import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, PhoneCall } from "lucide-react";
import { getCurrentOrg } from "@/lib/db/context";
import { countFilteredCalls, listCalls } from "@/lib/db/calls";
import { listAgents } from "@/lib/db/agents";
import { cn, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { CallsFilterBar } from "@/components/calls/calls-filter-bar";
import { CallRow } from "@/components/calls/call-row";
import { filtersToQuery, parseCallFilters } from "@/components/calls/call-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Appels" };

const PAGE_SIZE = 50;

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const filters = parseCallFilters(searchParams);
  const query = filtersToQuery(filters);
  const hasFilters = query.length > 0;
  const rawPage = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [agents, total] = await Promise.all([
    listAgents(org.id),
    countFilteredCalls(org.id, filters),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const calls =
    total > 0
      ? await listCalls(org.id, {
          ...filters,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        })
      : [];

  const pageHref = (p: number) => {
    const sp = new URLSearchParams(query);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/calls?${s}` : "/calls";
  };
  const firstIndex = (page - 1) * PAGE_SIZE + 1;
  const lastIndex = firstIndex + calls.length - 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appels"
        description="Historique complet des appels traités par vos agents."
      >
        {total > 0 && (
          <a
            href={`/api/calls/export${query ? `?${query}` : ""}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download aria-hidden="true" />
            Exporter en CSV
            <span className="sr-only">
              {` (${formatNumber(total)} appel${total > 1 ? "s" : ""}${hasFilters ? " filtrés" : ""})`}
            </span>
          </a>
        )}
      </PageHeader>

      <Suspense fallback={<div className="h-[92px]" />}>
        <CallsFilterBar agents={agents.map((a) => ({ id: a.id, name: a.name }))} />
      </Suspense>

      <p role="status" className="text-sm text-muted-foreground tabular">
        {total === 0
          ? "Aucun appel"
          : total <= PAGE_SIZE
            ? `${formatNumber(total)} appel${total > 1 ? "s" : ""}`
            : `${formatNumber(firstIndex)}–${formatNumber(lastIndex)} sur ${formatNumber(total)} appels`}
      </p>

      {total === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={hasFilters ? "Aucun appel ne correspond" : "Aucun appel pour l'instant"}
          description={
            hasFilters
              ? "Élargissez la période ou retirez un filtre pour voir plus de résultats."
              : "Les appels traités par vos agents apparaîtront ici, avec leur transcript et leur résumé."
          }
          action={
            hasFilters ? (
              <Link href="/calls" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Réinitialiser les filtres
              </Link>
            ) : (
              <Link href="/agents" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Voir mes agents
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div
            aria-hidden="true"
            className="hidden items-center gap-4 border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground sm:flex"
          >
            <span className="size-8" />
            <span className="flex-1">Agent / Issue</span>
            <span className="w-28">Direction</span>
            <span className="hidden w-36 md:block">Numéro</span>
            <span className="w-16 text-right">Durée</span>
            <span className="hidden w-28 text-right lg:block">Date</span>
            <span className="w-24 text-right">Statut</span>
            <span className="w-8" />
          </div>
          <ul className="divide-y divide-border" aria-label="Liste des appels">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </ul>
        </Card>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination des appels"
          className="flex items-center justify-between gap-3"
        >
          <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
            <ChevronLeft aria-hidden="true" />
            Précédent
          </PageLink>
          <span className="text-sm tabular text-muted-foreground" aria-current="page">
            Page {page} sur {pageCount}
          </span>
          <PageLink href={pageHref(page + 1)} disabled={page >= pageCount}>
            Suivant
            <ChevronRight aria-hidden="true" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls = buttonVariants({ variant: "outline", size: "sm" });
  return disabled ? (
    <span aria-disabled="true" className={cn(cls, "pointer-events-none opacity-40")}>
      {children}
    </span>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
