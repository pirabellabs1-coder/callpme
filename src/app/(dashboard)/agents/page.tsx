import { Suspense } from "react";
import Link from "next/link";
import { Plus, Bot, LayoutTemplate, SearchX } from "lucide-react";
import {
  AGENT_ROLES,
  type AgentRole,
  type AgentStatus,
} from "@/lib/shared/types";
import { getCurrentOrg } from "@/lib/db/context";
import { getActiveClientId } from "@/lib/db/active-client";
import { listAgents } from "@/lib/db/agents";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { AgentsFilterBar } from "@/components/agents/agents-filter-bar";
import { AgentRow, AGENT_ROW_GRID } from "@/components/agents/agent-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Agents" };

const STATUSES: AgentStatus[] = ["active", "paused", "draft"];

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: { role?: string; status?: string; search?: string };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const role =
    searchParams.role &&
    (AGENT_ROLES as readonly string[]).includes(searchParams.role)
      ? (searchParams.role as AgentRole)
      : undefined;
  const status =
    searchParams.status && STATUSES.includes(searchParams.status as AgentStatus)
      ? (searchParams.status as AgentStatus)
      : undefined;
  const search = searchParams.search?.trim() || undefined;
  const clientId = await getActiveClientId(org.id);

  const agents = await listAgents(org.id, { role, status, search, clientId });
  const hasFilters = Boolean(role || status || search);
  const counts = {
    active: agents.filter((a) => a.status === "active").length,
    paused: agents.filter((a) => a.status === "paused").length,
    draft: agents.filter((a) => a.status === "draft").length,
  };
  const isFirstRun = agents.length === 0 && !hasFilters;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Créez, testez et pilotez vos agents vocaux."
        breadcrumb={[{ label: "Agents" }]}
      >
        <Link
          href="/templates"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <LayoutTemplate className="size-4" aria-hidden />
          Modèles
        </Link>
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}
        >
          <Plus className="size-4" aria-hidden />
          Nouvel agent
        </Link>
      </PageHeader>

      {isFirstRun ? (
        <EmptyState
          icon={Bot}
          title="Aucun agent pour l'instant"
          description="Un agent répond au téléphone à votre place : accueil, prise de rendez-vous, qualification… Partez d'un modèle prêt à l'emploi ou configurez-le pas à pas."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Link
                href="/templates"
                className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}
              >
                <LayoutTemplate className="size-4" aria-hidden />
                Partir d&apos;un modèle
              </Link>
              <Link
                href="/agents/new"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-1.5",
                )}
              >
                <Plus className="size-4" aria-hidden />
                Créer de zéro
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <Card className="p-3 sm:p-4">
            <Suspense fallback={<div className="h-10" />}>
              <AgentsFilterBar />
            </Suspense>
          </Card>

          {agents.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun agent ne correspond"
              description="Aucun agent ne correspond à ces filtres. Modifiez la recherche ou réinitialisez les filtres."
              action={
                <Link
                  href="/agents"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "gap-1.5",
                  )}
                >
                  Réinitialiser les filtres
                </Link>
              }
            />
          ) : (
            <Card className="overflow-visible">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {agents.length} agent{agents.length > 1 ? "s" : ""}
                  {hasFilters ? " correspondant aux filtres" : ""}
                </h2>
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  <StatusCount
                    dot="bg-emerald-500"
                    n={counts.active}
                    label="en ligne"
                  />
                  <StatusCount
                    dot="bg-amber-500"
                    n={counts.paused}
                    label="en pause"
                  />
                  <StatusCount
                    dot="bg-stone-400"
                    n={counts.draft}
                    label={counts.draft > 1 ? "brouillons" : "brouillon"}
                  />
                </p>
              </div>

              {/* En-têtes de colonnes (desktop) */}
              <div
                aria-hidden
                className={cn(
                  "hidden gap-6 border-b border-border px-5 py-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
                  AGENT_ROW_GRID,
                )}
              >
                <span>Agent</span>
                <span>Numéro</span>
                <span>Appels</span>
                <span className="sr-only">Actions</span>
              </div>

              <ul
                className="divide-y divide-border"
                aria-label="Liste des agents"
              >
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatusCount({
  dot,
  n,
  label,
}: {
  dot: string;
  n: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      <span className="tabular font-medium text-foreground/85">{n}</span>{" "}
      {label}
    </span>
  );
}
