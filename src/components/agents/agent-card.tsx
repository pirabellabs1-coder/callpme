import Link from "next/link";
import { Phone, PhoneOff } from "lucide-react";
import type { Agent } from "@/lib/shared/types";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { AgentStatusDot } from "@/components/status-badges";
import { cn, formatNumber } from "@/lib/utils";

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-base font-semibold text-foreground">
        {value}
      </span>
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
    </div>
  );
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn(
        "group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between">
        <RoleIcon role={agent.role} size="md" />
        <span className="flex items-center gap-2">
          <AgentStatusDot status={agent.status} />
          <span className="text-xs font-medium text-muted-foreground">
            {agent.status === "active"
              ? "En ligne"
              : agent.status === "paused"
                ? "En pause"
                : "Brouillon"}
          </span>
        </span>
      </div>

      <div className="mt-4">
        <h3 className="truncate font-semibold tracking-tight text-foreground">
          {agent.name}
        </h3>
        <div className="mt-2">
          <RoleBadge
            role={agent.role}
            label={
              agent.role === "custom"
                ? agent.config.customRole?.label || "Rôle personnalisé"
                : undefined
            }
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        {agent.phoneNumber ? (
          <>
            <Phone className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
            <span className="mono text-[0.8rem] text-foreground/80">
              {agent.phoneNumber}
            </span>
          </>
        ) : (
          <>
            <PhoneOff className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
            <span className="text-[0.8rem] text-muted-foreground">
              Aucun numéro assigné
            </span>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
        <Metric value={formatNumber(agent.callsToday ?? 0)} label="Aujourd'hui" />
        <Metric value={formatNumber(agent.callsTotal ?? 0)} label="Total" />
        <Metric value={`${agent.resolutionRate ?? 0}%`} label="Résolution" />
      </div>
    </Link>
  );
}
