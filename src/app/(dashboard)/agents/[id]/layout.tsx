import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, PhoneOff } from "lucide-react";
import { getCurrentOrg } from "@/lib/db/context";
import { getAgentById } from "@/lib/db/agents";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { AgentStatusBadge } from "@/components/status-badges";
import { AgentStatusControl, DeleteAgentButton } from "@/components/agents/agent-actions";
import { AgentTabs } from "@/components/agents/agent-tabs";
import { SeedNotice } from "@/components/dashboard/seed-notice";

/**
 * Espace de travail d'un agent : un seul en-tête (identité, statut, numéro)
 * et des onglets Aperçu · Configuration · Tester, au lieu de trois pages
 * séparées.
 */
export default async function AgentWorkspaceLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;
  const agent = await getAgentById(params.id);
  // Un agent d'une autre organisation est traité comme inexistant.
  if (!agent || agent.organizationId !== org.id) notFound();
  const roleLabel = agent.role === "custom" ? agent.config.customRole?.label || "Rôle personnalisé" : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-border">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Agents
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <RoleIcon role={agent.role} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-display-sm font-semibold tracking-tight">{agent.name}</h1>
                <AgentStatusBadge status={agent.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <RoleBadge role={agent.role} label={roleLabel} withIcon />
                {agent.phoneNumber ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" strokeWidth={1.75} aria-hidden />
                    <span className="mono text-foreground/85">{agent.phoneNumber}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <PhoneOff className="size-3.5" strokeWidth={1.75} aria-hidden />
                    Aucun numéro
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusControl agentId={agent.id} status={agent.status} />
            <DeleteAgentButton agentId={agent.id} agentName={agent.name} />
          </div>
        </div>

        <AgentTabs agentId={agent.id} />
      </div>

      {children}
    </div>
  );
}
