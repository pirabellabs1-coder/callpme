import { Suspense } from "react";
import Link from "next/link";
import { Plus, Bot, LayoutTemplate } from "lucide-react";
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
import { AgentRow } from "@/components/agents/agent-row";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Créez, configurez et pilotez vos agents vocaux par rôle."
        breadcrumb={[{ label: "Agents" }]}
      >
        <Link
          href="/templates"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <LayoutTemplate className="size-4" />
          Modèles
        </Link>
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}
        >
          <Plus className="size-4" />
          Créer un agent
        </Link>
      </PageHeader>

      {/* Carte de recherche / filtres */}
      <Card className="p-3 sm:p-4">
        <Suspense fallback={<div className="h-10" />}>
          <AgentsFilterBar />
        </Suspense>
      </Card>

      {agents.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Bot}
            title="Aucun agent ne correspond"
            description="Ajustez vos filtres ou réinitialisez la recherche."
          />
        ) : (
          <EmptyState
            icon={Bot}
            title="Aucun agent pour l'instant"
            description="Créez votre premier agent vocal et assignez-lui un rôle pour démarrer."
            action={
              <Link
                href="/agents/new"
                className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}
              >
                <Plus className="size-4" />
                Créer un agent
              </Link>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          {/* En-tête de section */}
          <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/30 px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Vos agents
              </p>
              <p className="text-xs text-muted-foreground">
                {agents.length} agent{agents.length > 1 ? "s" : ""}
                {hasFilters ? " correspondant aux filtres" : ""}
              </p>
            </div>
            <Link
              href="/agents/new"
              className={cn(buttonVariants({ variant: "brand", size: "sm" }), "gap-1.5")}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nouvel agent</span>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
