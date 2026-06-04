import Link from "next/link";
import { listAllAgents } from "@/lib/db/admin";
import { AGENT_ROLES, type AgentRole } from "@/lib/shared/types";
import { RoleIcon } from "@/components/role-badge";
import { AgentStatusDot } from "@/components/status-badges";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

function isRole(r: string): r is AgentRole {
  return (AGENT_ROLES as readonly string[]).includes(r) || r === "custom";
}

export default async function AdminAgentsPage() {
  const agents = await listAllAgents();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description={`${agents.length} agent${agents.length > 1 ? "s" : ""} sur la plateforme.`}
      />
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
            >
              <RoleIcon role={isRole(a.role) ? a.role : "support"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.orgName}</p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">{a.role}</span>
              <span className="flex w-24 items-center justify-end gap-1.5">
                <AgentStatusDot status={a.status as "active" | "paused" | "draft"} />
                <span className="text-xs text-muted-foreground">
                  {a.status === "active" ? "En ligne" : a.status === "paused" ? "En pause" : "Brouillon"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
