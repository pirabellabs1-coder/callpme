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
import { getAnalytics } from "@/lib/db/analytics";
import { ROLE_META } from "@/lib/agents/roles";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { StatCard } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChart } from "@/components/charts/area-chart";
import { Donut, type DonutSegment } from "@/components/charts/donut";
import { BarList } from "@/components/charts/bar-list";

export const metadata = { title: "Statistiques" };

const STATUS_COLORS: Record<CallStatus, string> = {
  completed: "hsl(142 46% 40%)",
  transferred: "hsl(202 70% 48%)",
  missed: "hsl(34 84% 50%)",
  failed: "hsl(4 70% 53%)",
  in_progress: "hsl(28 8% 62%)",
};
const STATUS_LABELS: Record<CallStatus, string> = {
  completed: "Résolus",
  transferred: "Transférés",
  missed: "Manqués",
  failed: "Échecs",
  in_progress: "En cours",
};

export default async function AnalyticsPage() {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const a = await getAnalytics(org.id, 14);

  if (a.totalCalls === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Statistiques" description="Performance de vos agents." />
        <EmptyState
          icon={BarChart3}
          title="Pas encore de données"
          description="Les statistiques apparaîtront dès les premiers appels."
        />
      </div>
    );
  }

  const donutSegments: DonutSegment[] = a.statusBreakdown.map((s) => ({
    label: STATUS_LABELS[s.status],
    value: s.count,
    color: STATUS_COLORS[s.status],
  }));

  const roleItems = a.roleBreakdown.map((r) => ({
    label: ROLE_META[r.role].label,
    value: r.calls,
    secondary: `${r.resolutionRate}% résolus`,
    dotClass: ROLE_META[r.role].dotClass,
  }));

  const dirMax = Math.max(1, a.directionSplit.inbound, a.directionSplit.outbound);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Statistiques"
        description="Performance de vos agents sur les 14 derniers jours."
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Appels traités"
          value={formatNumber(a.totalCalls)}
          icon={PhoneCall}
        />
        <StatCard
          label="Taux de résolution"
          value={`${a.resolutionRate}%`}
          icon={CircleCheck}
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(a.avgDurationSec)}
          icon={Timer}
        />
        <StatCard
          label="Transferts humains"
          value={`${a.transferRate}%`}
          icon={PhoneForwarded}
        />
      </div>

      {/* Volume */}
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Volume d'appels
            </h2>
            <p className="text-sm text-muted-foreground">
              Total et appels résolus par jour
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-brand" /> Total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full border-b-2 border-dashed border-brand/40" />
              Résolus
            </span>
          </div>
        </div>
        <AreaChart data={a.series} />
      </Card>

      {/* Issues + rôles */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-[0.95rem] font-semibold tracking-tight">
            Issues des appels
          </h2>
          <Donut segments={donutSegments} centerLabel="appels" />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-[0.95rem] font-semibold tracking-tight">
            Appels par rôle
          </h2>
          <BarList items={roleItems} formatValue={formatNumber} />
        </Card>
      </div>

      {/* Satisfaction + direction */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Satisfaction moyenne
          </h2>
          {a.avgSatisfaction != null ? (
            <div className="mt-4 flex items-center gap-4">
              <span className="tabular text-display-md font-semibold tracking-tight">
                {a.avgSatisfaction.toFixed(1).replace(".", ",")}
              </span>
              <div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-5",
                        i < Math.round(a.avgSatisfaction!)
                          ? "fill-amber-400 text-amber-400"
                          : "text-border",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  sur 5 · appels notés
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
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Direction des appels
          </h2>
          <div className="mt-4 space-y-3.5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <PhoneIncoming className="size-4 text-sky-500" strokeWidth={1.75} />
                  Entrants
                </span>
                <span className="tabular text-muted-foreground">
                  {formatNumber(a.directionSplit.inbound)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{
                    width: `${(a.directionSplit.inbound / dirMax) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <PhoneOutgoing className="size-4 text-brand" strokeWidth={1.75} />
                  Sortants
                </span>
                <span className="tabular text-muted-foreground">
                  {formatNumber(a.directionSplit.outbound)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${(a.directionSplit.outbound / dirMax) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
