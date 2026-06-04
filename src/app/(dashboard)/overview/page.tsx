import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PhoneCall,
  CircleCheck,
  Timer,
  PhoneForwarded,
  ArrowRight,
} from "lucide-react";
import { getCurrentOrg } from "@/lib/db/context";
import { getAnalytics } from "@/lib/db/analytics";
import { listAgents } from "@/lib/db/agents";
import { listCalls } from "@/lib/db/calls";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { StatCard } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { RoleIcon } from "@/components/role-badge";
import { AgentStatusDot, CallStatusBadge } from "@/components/status-badges";
import { formatDuration, formatNumber } from "@/lib/utils";

export const metadata = { title: "Vue d'ensemble" };

export default async function OverviewPage() {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const [analytics, agents, recentCalls] = await Promise.all([
    getAnalytics(org.id, 14),
    listAgents(org.id),
    listCalls(org.id, { limit: 6 }),
  ]);

  const maxVolume = Math.max(1, ...analytics.series.map((d) => d.total));
  const topAgents = [...agents]
    .sort((a, b) => (b.callsTotal ?? 0) - (a.callsTotal ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Vue d'ensemble"
        description={`Activité des 14 derniers jours · ${org.name}`}
      />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Appels traités"
          value={formatNumber(analytics.totalCalls)}
          icon={PhoneCall}
          hint={`${analytics.activeAgents} agent${analytics.activeAgents > 1 ? "s" : ""} en ligne`}
        />
        <StatCard
          label="Taux de résolution"
          value={`${analytics.resolutionRate}%`}
          icon={CircleCheck}
          delta={{ value: "vs. transferts", positive: true }}
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(analytics.avgDurationSec)}
          icon={Timer}
        />
        <StatCard
          label="Transferts humains"
          value={`${analytics.transferRate}%`}
          icon={PhoneForwarded}
          hint="Part des appels escaladés"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Activité */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-0">
            <div>
              <h2 className="text-[0.95rem] font-semibold tracking-tight">
                Volume d'appels
              </h2>
              <p className="text-sm text-muted-foreground">14 derniers jours</p>
            </div>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-700"
            >
              Statistiques
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="px-5 pb-5 pt-6">
            <div className="flex h-44 items-end gap-1.5">
              {analytics.series.map((d) => (
                <div
                  key={d.date}
                  className="group/bar flex flex-1 flex-col items-center justify-end gap-2"
                >
                  <div className="relative flex w-full justify-center">
                    <div
                      className="w-full max-w-7 rounded-t-md bg-brand/15 transition-colors group-hover/bar:bg-brand/25"
                      style={{ height: `${(d.total / maxVolume) * 150}px` }}
                    >
                      <div
                        className="w-full rounded-t-md bg-brand transition-all"
                        style={{
                          height: `${d.total ? (d.resolved / Math.max(d.total, 1)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[0.65rem] tabular text-muted-foreground/70">
                    {d.label.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand" /> Résolus
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand/15" /> Total
              </span>
            </div>
          </div>
        </Card>

        {/* Agents */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Vos agents
            </h2>
            <Link
              href="/agents"
              className="text-sm font-medium text-brand hover:text-brand-700"
            >
              Tous
            </Link>
          </div>
          <div className="flex-1 divide-y divide-border">
            {topAgents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
              >
                <RoleIcon role={agent.role} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {agent.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatNumber(agent.callsTotal ?? 0)} appels
                  </p>
                </div>
                <AgentStatusDot status={agent.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Appels récents */}
      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Appels récents
          </h2>
          <Link
            href="/calls"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-700"
          >
            Tous les appels
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentCalls.map((call) => (
            <Link
              key={call.id}
              href={`/calls/${call.id}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40"
            >
              {call.agentRole && <RoleIcon role={call.agentRole} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {call.outcome ?? "Appel"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {call.agentName} · {call.fromNumber}
                </p>
              </div>
              <span className="hidden text-xs tabular text-muted-foreground sm:block">
                {formatDuration(call.durationSec)}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                {formatDistanceToNow(new Date(call.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
              <CallStatusBadge status={call.status} />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
