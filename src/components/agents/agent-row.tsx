import Link from "next/link";
import { MoreVertical, PlayCircle, Settings2 } from "lucide-react";
import type { Agent } from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { RoleIcon } from "@/components/role-badge";
import { AgentStatusBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ligne d'agent (liste façon console) avec actions rapides. */
export function AgentRow({ agent }: { agent: Agent }) {
  const roleLabel =
    agent.role === "custom"
      ? agent.config.customRole?.label ?? "Personnalisé"
      : ROLE_META[agent.role].label;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30 sm:gap-4 sm:px-5">
      <RoleIcon role={agent.role} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/agents/${agent.id}`}
            className="truncate text-sm font-semibold text-foreground transition-colors hover:text-brand"
          >
            {agent.name}
          </Link>
          <AgentStatusBadge status={agent.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {roleLabel} · {agent.phoneNumber ?? "Sans numéro"}
        </p>
      </div>

      <Link
        href={`/agents/${agent.id}/test`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "hidden gap-1.5 sm:inline-flex",
        )}
      >
        <PlayCircle className="size-4" />
        Tester
      </Link>
      <Link
        href={`/agents/${agent.id}/edit`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Settings2 className="size-4" />
        <span className="hidden sm:inline">Configurer</span>
      </Link>
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Détails de l'agent"
      >
        <MoreVertical className="size-4" />
      </Link>
    </div>
  );
}
