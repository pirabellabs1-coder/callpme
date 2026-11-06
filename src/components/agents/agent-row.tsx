import Link from "next/link";
import { Phone, PhoneOff, PlayCircle, Settings2 } from "lucide-react";
import type { Agent } from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { RoleIcon } from "@/components/role-badge";
import { AgentStatusBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";
import { AgentRowMenu } from "./agent-row-menu";

/** Grille partagée entre l'en-tête de colonnes et les lignes (desktop). */
export const AGENT_ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_10.5rem_7.5rem_16rem] lg:items-center";

/** Ligne d'agent (liste façon console) avec actions rapides. */
export function AgentRow({ agent }: { agent: Agent }) {
  const roleLabel =
    agent.role === "custom"
      ? agent.config.customRole?.label || "Personnalisé"
      : ROLE_META[agent.role].label;
  const total = agent.callsTotal ?? 0;
  const today = agent.callsToday ?? 0;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.02] sm:gap-4 sm:px-5 lg:gap-6",
        AGENT_ROW_GRID,
      )}
    >
      {/* Identité */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <RoleIcon role={agent.role} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/agents/${agent.id}`}
              className="truncate rounded-sm text-sm font-semibold text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
            >
              {agent.name}
            </Link>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {roleLabel}
            <span className="lg:hidden">
              {" · "}
              {agent.phoneNumber ?? "Sans numéro"}
              {" · "}
              {formatNumber(total)} appel{total > 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>

      {/* Numéro (desktop) */}
      <div className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
        {agent.phoneNumber ? (
          <>
            <Phone
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="mono truncate text-[0.8rem] text-foreground/85">
              {agent.phoneNumber}
            </span>
          </>
        ) : (
          <>
            <PhoneOff
              className="size-3.5 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
            <span className="text-[0.8rem] text-muted-foreground">
              Sans numéro
            </span>
          </>
        )}
      </div>

      {/* Appels (desktop) */}
      <div className="hidden lg:block">
        <p className="tabular text-sm font-semibold text-foreground">
          {formatNumber(total)}
          <span className="sr-only"> appels au total</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(today)} aujourd&apos;hui
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:justify-end">
        <Link
          href={`/agents/${agent.id}/test`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden gap-1.5 sm:inline-flex",
          )}
          aria-label={`Tester ${agent.name}`}
        >
          <PlayCircle className="size-4" aria-hidden />
          Tester
        </Link>
        <Link
          href={`/agents/${agent.id}/edit`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5",
          )}
          aria-label={`Configurer ${agent.name}`}
        >
          <Settings2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Configurer</span>
        </Link>
        <AgentRowMenu agent={agent} />
      </div>
    </li>
  );
}
