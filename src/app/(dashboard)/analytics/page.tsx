import Link from "next/link";
import {
  PhoneCall,
  CircleCheck,
  Timer,
  PhoneForwarded,
  Star,
  PhoneIncoming,
  PhoneOutgoing,
  BarChart3,
} from "lucide-react";
import type { CallStatus } from "@/lib/shared/types";
import { getCurrentOrg } from "@/lib/db/context";
import { formatYmd, getAnalytics } from "@/lib/db/analytics";
import { ROLE_META } from "@/lib/agents/roles";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { StatCard } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RoleIcon } from "@/components/role-badge";
import { AreaChart } from "@/components/charts/area-chart";
import { Donut, type DonutSegment } from "@/components/charts/donut";
import { BarList } from "@/components/charts/bar-list";
import { Heatmap } from "@/components/charts/heatmap";

export const metadata = { title: "Statistiques" };

const PERIODS = [7, 14, 30] as const;
type Period = (typeof PERIODS)[number];

/** Couleurs des statuts : classes du thème (adaptées au sombre), via currentColor. */
const STATUS_COLOR_CLASS: Record<CallStatus, string> = {
  completed: "text-emerald-600",
  transferred: "text-sky-600",
  missed: "text-amber-600",
  failed: "text-rose-600",
  in_progress: "text-muted-foreground",
};
const STATUS_LABELS: Record<CallStatus, string> = {
  completed: "Résolus",
  transferred: "Transférés",
  missed: "Manqués",
  failed: "Échecs",
  in_progress: "En cours",
};

function CardTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function PeriodSelector({ current }: { current: Period }) {
  return (
    <nav aria-label="Période analysée">
      <ul className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {PERIODS.map((p) => {
          const active = p === current;
          return (
            <li key={p}>
              <Link
                href={p === 14 ? "/analytics" : `/analytics?days=${p}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium tabular transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-secondary text-foreground ring-1 ring-inset ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p} jours
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const requested = Number(searchParams.days);
  const days: Period = (PERIODS as readonly number[]).includes(requested)
    ? (requested as Period)
    : 14;

  const a = await getAnalytics(org.id, days);

  const range = `du ${formatYmd(a.fromDate, { day: "numeric", month: "long" })} au ${formatYmd(a.toDate, { day: "numeric", month: "long", year: "numeric" })}`;
  const header = (
    <PageHeader
      title="Statistiques"
      description={`Performance de vos agents ${range}${a.anchoredOnLastCall ? " (fenêtre calée sur le dernier appel enregistré)" : ""}.`}
    >
      <PeriodSelector current={days} />
    </PageHeader>
  );

  if (a.totalCalls === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={BarChart3}
          title="Pas encore de données sur cette période"
          description="Les statistiques apparaîtront dès les premiers appels traités par vos agents."
          action={
            <Link href="/agents" className="text-sm font-medium text-brand-700 hover:underline">
              Voir mes agents
            </Link>
          }
        />
      </div>
    );
  }

  const donutSegments: DonutSegment[] = a.statusBreakdown.map((s) => ({
    label: STATUS_LABELS[s.status],
    value: s.count,
    colorClass: STATUS_COLOR_CLASS[s.status],
  }));

  const outcomeItems = a.outcomeBreakdown.map((o) => ({
    label: o.outcome,
    value: o.count,
    secondary: `${Math.round((o.count / a.totalCalls) * 100)}%`,
  }));

  const dirTotal = Math.max(1, a.directionSplit.inbound + a.directionSplit.outbound);
  const resolvedCount = a.statusBreakdown.find((s) => s.status === "completed")?.count ?? 0;
  const transferredCount = a.statusBreakdown.find((s) => s.status === "transferred")?.count ?? 0;

  return (
    <div className="space-y-7">
      {header}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Appels traités"
          value={formatNumber(a.totalCalls)}
          hint={`${a.activeAgents} agent${a.activeAgents > 1 ? "s" : ""} actif${a.activeAgents > 1 ? "s" : ""} sur ${a.totalAgents}`}
          icon={PhoneCall}
        />
        <StatCard
          label="Taux de résolution"
          value={`${a.resolutionRate} %`}
          hint={`${formatNumber(resolvedCount)} appels résolus`}
          icon={CircleCheck}
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(a.avgDurationSec)}
          hint="Appels décrochés uniquement"
          icon={Timer}
        />
        <StatCard
          label="Transferts humains"
          value={`${a.transferRate} %`}
          hint={`${formatNumber(transferredCount)} appels transférés`}
          icon={PhoneForwarded}
        />
      </div>

      {/* Volume */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-tight">Volume d&apos;appels</h2>
            <p className="text-sm text-muted-foreground">Total et appels résolus par jour</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-brand" /> Total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-b-2 border-dashed border-emerald-600" />
              Résolus
            </span>
          </div>
        </div>
        <AreaChart
          data={a.series}
          ariaLabel={`Volume d'appels par jour, ${range}`}
          seriesLabels={{ total: "Appels", resolved: "Résolus" }}
        />
      </Card>

      {/* Statuts + issues métier */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle title="Statut des appels" />
          <Donut
            segments={donutSegments}
            centerLabel="appels"
            ariaLabel="Répartition des appels par statut"
          />
        </Card>

        <Card className="p-5">
          <CardTitle
            title="Issues les plus fréquentes"
            description="Résultat métier constaté en fin d'appel"
          />
          {outcomeItems.length > 0 ? (
            <BarList items={outcomeItems} formatValue={formatNumber} />
          ) : (
            <p className="text-sm text-muted-foreground">Aucune issue renseignée sur la période.</p>
          )}
        </Card>
      </div>

      {/* Par agent */}
      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <CardTitle title="Performance par agent" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Performance par agent, {range}</caption>
            <thead>
              <tr className="border-y border-border bg-secondary/40 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-5 py-2.5">Agent</th>
                <th scope="col" className="px-3 py-2.5 text-right">Appels</th>
                <th scope="col" className="px-3 py-2.5 text-right">Résolution</th>
                <th scope="col" className="px-3 py-2.5 text-right">Transferts</th>
                <th scope="col" className="px-3 py-2.5 text-right">Durée moy.</th>
                <th scope="col" className="px-5 py-2.5 text-right">Satisfaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {a.agentBreakdown.map((ag) => (
                <tr key={ag.agentId} className="transition-colors hover:bg-accent/40">
                  <th scope="row" className="px-5 py-3 text-left font-medium">
                    <span className="flex min-w-0 items-center gap-3">
                      <RoleIcon role={ag.role} size="sm" />
                      <span className="min-w-0">
                        <Link
                          href={`/calls?agentId=${ag.agentId}`}
                          className="block truncate text-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          {ag.name}
                          <span className="sr-only"> — voir ses appels</span>
                        </Link>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {ROLE_META[ag.role]?.label ?? ag.role}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-3 text-right tabular">{formatNumber(ag.calls)}</td>
                  <td className="px-3 py-3 text-right tabular">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span aria-hidden="true" className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-secondary sm:block">
                        <span
                          className="block h-full rounded-full bg-emerald-600"
                          style={{ width: `${ag.resolutionRate}%` }}
                        />
                      </span>
                      {ag.resolutionRate} %
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular text-muted-foreground">
                    {ag.transferRate} %
                  </td>
                  <td className="px-3 py-3 text-right tabular text-muted-foreground">
                    {ag.avgDurationSec > 0 ? formatDuration(ag.avgDurationSec) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular text-muted-foreground">
                    {ag.avgSatisfaction != null ? (
                      <>
                        {ag.avgSatisfaction.toFixed(1).replace(".", ",")}
                        <span aria-hidden="true"> / 5</span>
                        <span className="sr-only"> sur 5</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Heures de pointe */}
      <Card className="p-5">
        <CardTitle
          title="Heures d'affluence"
          description="Nombre d'appels par jour de la semaine et par heure (heure de Paris)"
        />
        <Heatmap
          data={a.heatmap}
          caption={`Appels par jour de la semaine et par heure, ${range}`}
        />
      </Card>

      {/* Satisfaction + direction */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Satisfaction moyenne</h2>
          {a.avgSatisfaction != null ? (
            <div className="mt-4 flex items-center gap-4">
              <span className="tabular text-display-md font-semibold tracking-tight">
                {a.avgSatisfaction.toFixed(1).replace(".", ",")}
                <span className="sr-only"> sur 5</span>
              </span>
              <div>
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-5",
                        i < Math.round(a.avgSatisfaction!)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  sur 5 · {formatNumber(a.ratedCalls)} appel{a.ratedCalls > 1 ? "s" : ""} noté
                  {a.ratedCalls > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune note de satisfaction sur la période.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Direction des appels</h2>
          <ul className="mt-4 space-y-3.5">
            {(
              [
                { key: "inbound", label: "Entrants", Icon: PhoneIncoming, iconCls: "text-sky-600", barCls: "bg-sky-600" },
                { key: "outbound", label: "Sortants", Icon: PhoneOutgoing, iconCls: "text-brand", barCls: "bg-brand" },
              ] as const
            ).map(({ key, label, Icon, iconCls, barCls }) => {
              const value = a.directionSplit[key];
              const share = Math.round((value / dirTotal) * 100);
              return (
                <li key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <Icon className={cn("size-4", iconCls)} strokeWidth={1.75} aria-hidden="true" />
                      {label}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {formatNumber(value)} · {share} %
                    </span>
                  </div>
                  <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className={cn("h-full rounded-full", barCls)} style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
