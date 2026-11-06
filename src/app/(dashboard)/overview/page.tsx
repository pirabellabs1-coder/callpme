import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PhoneCall,
  CircleCheck,
  ArrowRight,
  Bot,
  Megaphone,
  Check,
  Plus,
  CalendarCheck2,
  UserPlus,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getOnboardingSteps } from "@/lib/db/onboarding";
import { cn } from "@/lib/utils";
import { getCurrentOrg } from "@/lib/db/context";
import { getAnalytics } from "@/lib/db/analytics";
import { prisma } from "@/lib/db/client";
import { TodayPanel } from "@/components/dashboard/today-panel";
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

  const since = new Date(Date.now() - 14 * 86_400_000);
  const [analytics, agents, recentCalls, steps, session, booked14, leads14] = await Promise.all([
    getAnalytics(org.id, 14),
    listAgents(org.id),
    listCalls(org.id, { limit: 6 }),
    getOnboardingSteps(org.id),
    getSession(),
    prisma.appointment.count({ where: { organizationId: org.id, isTest: false, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: org.id, isTest: false, kind: "lead", createdAt: { gte: since } } }),
  ]);
  const doneCount = steps.filter((s) => s.done).length;
  const firstName = session?.user.name?.split(" ")[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Paris" }).format(new Date()),
  );
  const greeting = hour < 5 || hour >= 18 ? "Bonsoir" : "Bonjour";

  const maxVolume = Math.max(1, ...analytics.series.map((d) => d.total));
  const topAgents = [...agents]
    .sort((a, b) => (b.callsTotal ?? 0) - (a.callsTotal ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <PageHeader
        title={firstName ? `${greeting}, ${firstName}` : "Vue d'ensemble"}
        description={`Activité des 14 derniers jours · ${org.name}`}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/calls"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <PhoneCall className="size-4" aria-hidden />
            Appels
          </Link>
          <Link
            href="/campaigns"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Megaphone className="size-4" aria-hidden />
            Nouvelle campagne
          </Link>
          <Link
            href="/agents/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <Plus className="size-4" aria-hidden />
            Nouvel agent
          </Link>
        </div>
      </PageHeader>

      {/* Bien démarrer — masqué une fois toutes les étapes faites */}
      {doneCount < steps.length && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[0.95rem] font-semibold tracking-tight">Bien démarrer</h2>
              <p className="text-sm text-muted-foreground">
                {doneCount} étape{doneCount > 1 ? "s" : ""} sur {steps.length} terminée{doneCount > 1 ? "s" : ""}
              </p>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10 sm:w-48"
              role="progressbar"
              aria-label="Progression de la mise en route"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
            >
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
          <ol className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <li key={step.key} className="border-b border-border last:border-b-0 sm:border-r lg:border-b-0">
                <Link
                  href={step.href}
                  className={cn(
                    "flex h-full gap-3 p-4 transition-colors hover:bg-accent/40",
                    step.done && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      step.done ? "bg-success/15 text-success" : "border border-border text-muted-foreground",
                    )}
                  >
                    {step.done ? <Check className="size-3.5" aria-label="Terminé" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium text-foreground", step.done && "line-through decoration-foreground/30")}>
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* À traiter aujourd'hui */}
      <TodayPanel orgId={org.id} />

      {/* Résultats : ce que les agents ont produit, pas seulement des appels */}
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
          label="Rendez-vous pris"
          value={formatNumber(booked14)}
          icon={CalendarCheck2}
          hint="Réservés par vos agents en 14 jours"
        />
        <StatCard
          label="Prospects collectés"
          value={formatNumber(leads14)}
          icon={UserPlus}
          hint={`Durée moyenne d'appel ${formatDuration(analytics.avgDurationSec)} · ${analytics.transferRate}% transférés`}
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
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
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
              className="text-sm font-medium text-brand hover:underline"
            >
              Tous
            </Link>
          </div>
          <div className="flex-1 divide-y divide-border">
            {topAgents.length === 0 && (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <Bot className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">Aucun agent pour l'instant.</p>
                <Link href="/agents/new" className="mt-3 text-sm font-medium text-brand hover:underline">Créer un agent</Link>
              </div>
            )}
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
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Tous les appels
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentCalls.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Aucun appel pour l'instant. Testez un agent pour voir apparaître vos premiers appels ici.
            </p>
          )}
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
