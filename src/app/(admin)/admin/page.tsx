import {
  Building2,
  Users,
  PhoneCall,
  Euro,
  TrendingUp,
  AudioLines,
} from "lucide-react";
import { getPlatformAnalytics } from "@/lib/db/admin";
import { getPlan } from "@/lib/billing/plans";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { AreaChart } from "@/components/charts/area-chart";
import { Donut } from "@/components/charts/donut";
import { BarList } from "@/components/charts/bar-list";
import { PurgeDemoButton } from "@/components/admin/purge-demo";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  completed: "Résolus",
  transferred: "Transférés",
  missed: "Manqués",
  failed: "Échecs",
  in_progress: "En cours",
};
const STATUS_COLOR: Record<string, string> = {
  completed: "hsl(142 46% 38%)",
  transferred: "hsl(210 80% 55%)",
  missed: "hsl(38 92% 50%)",
  failed: "hsl(4 70% 50%)",
  in_progress: "hsl(28 8% 60%)",
};
const PLAN_COLOR: Record<string, string> = {
  starter: "hsl(142 46% 38%)",
  pro: "hsl(var(--brand))",
  agency: "hsl(210 80% 55%)",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const a = await getPlatformAnalytics();

  const mrrSeries = a.months.map((m) => ({
    label: m.label,
    total: m.mrr,
    resolved: m.mrr,
  }));
  const orgSeries = a.months.map((m) => ({
    label: m.label,
    total: m.orgs,
    resolved: m.orgs,
  }));
  const userSeries = a.months.map((m) => ({
    label: m.label,
    total: m.users,
    resolved: m.users,
  }));
  const callSeries = a.months.map((m) => ({
    label: m.label,
    total: m.calls,
    resolved: m.calls,
  }));

  const planSegments = a.byPlan
    .filter((p) => p.count > 0)
    .map((p) => ({
      label: getPlan(p.plan).name,
      value: p.count,
      color: PLAN_COLOR[p.plan] ?? "hsl(var(--brand))",
    }));
  const statusSegments = a.statusBreakdown.map((s) => ({
    label: STATUS_LABEL[s.status] ?? s.status,
    value: s.count,
    color: STATUS_COLOR[s.status] ?? "hsl(28 8% 60%)",
  }));
  const topOrgItems = a.topOrgs.map((o) => ({
    label: o.name,
    value: o.calls,
    secondary: getPlan(o.plan).name,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        title="Revenus & métriques"
        description="Pilotage global de la plateforme Callpme — revenus, croissance et activité."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="MRR estimé" value={`${formatNumber(a.mrr)} €`} icon={Euro} />
        <StatCard label="ARR estimé" value={`${formatNumber(a.arr)} €`} icon={TrendingUp} />
        <StatCard label="Organisations" value={formatNumber(a.orgs)} icon={Building2} />
        <StatCard label="Utilisateurs" value={formatNumber(a.users)} icon={Users} />
        <StatCard label="Appels" value={formatNumber(a.calls)} icon={PhoneCall} />
        <StatCard label="Voix" value={formatNumber(a.voices)} icon={AudioLines} />
      </div>

      {/* Graphe 1 — MRR */}
      <ChartCard
        title="Revenu mensuel récurrent (MRR)"
        subtitle="Estimation sur les 6 derniers mois, en euros."
      >
        <AreaChart data={mrrSeries} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Graphe 2 — Organisations */}
        <ChartCard title="Croissance des organisations" subtitle="Nouvelles organisations par mois.">
          <AreaChart data={orgSeries} />
        </ChartCard>
        {/* Graphe 3 — Utilisateurs */}
        <ChartCard title="Nouveaux utilisateurs" subtitle="Inscriptions par mois.">
          <AreaChart data={userSeries} />
        </ChartCard>
      </div>

      {/* Graphe 4 — Volume d'appels */}
      <ChartCard title="Volume d'appels" subtitle="Appels traités par mois sur la plateforme.">
        <AreaChart data={callSeries} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Graphe 5 — Répartition par offre */}
        <ChartCard title="Répartition par offre" subtitle="Organisations par plan.">
          {planSegments.length > 0 ? (
            <Donut segments={planSegments} centerLabel="organisations" />
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          )}
        </ChartCard>
        {/* Graphe 6 — Statut des appels */}
        <ChartCard title="Statut des appels" subtitle="Issues de tous les appels.">
          {statusSegments.length > 0 ? (
            <Donut segments={statusSegments} centerLabel="appels" />
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          )}
        </ChartCard>
      </div>

      {/* Graphe 7 — Top organisations */}
      <ChartCard title="Top organisations" subtitle="Par volume d'appels.">
        {topOrgItems.length > 0 ? (
          <BarList items={topOrgItems} formatValue={(v) => `${formatNumber(v)} appels`} />
        ) : (
          <p className="text-sm text-muted-foreground">Aucune donnée.</p>
        )}
      </ChartCard>

      {/* Zone de danger — préparation à la mise en production */}
      <Card className="border-destructive/30 bg-destructive/[0.03] p-5">
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-foreground">
          Données de démonstration
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          <strong>Purger</strong> supprime toutes les données de démo (agents, appels,
          campagnes, voix, numéros, clés API…) pour repartir d'une base 100 % réelle
          avant le déploiement — les comptes et l'organisation sont conservés.
          <strong> Recharger</strong> recrée un jeu de démo (agents + appels + voix)
          pour continuer à tester. Le MRR de l'offre Agence est à 0 € (sur devis), donc
          les revenus reviennent bien à zéro après une purge.
        </p>
        <div className="mt-4">
          <PurgeDemoButton />
        </div>
      </Card>
    </div>
  );
}
