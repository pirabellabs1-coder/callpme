import { cn } from "@/lib/utils";
import type { AgentStatus, CallStatus, CallDirection } from "@/lib/shared/types";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";

/* ----------------------------- Statut agent ----------------------------- */

const AGENT_STATUS: Record<
  AgentStatus,
  { label: string; dot: string; badge: string; live?: boolean }
> = {
  active: {
    label: "En ligne",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
    live: true,
  },
  paused: {
    label: "En pause",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
  },
  draft: {
    label: "Brouillon",
    dot: "bg-stone-400",
    badge: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  },
};

export function AgentStatusDot({
  status,
  className,
}: {
  status: AgentStatus;
  className?: string;
}) {
  const s = AGENT_STATUS[status];
  return (
    <span className={cn("relative flex size-2.5", className)}>
      {s.live && (
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full opacity-75",
            s.dot,
            "animate-ping",
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", s.dot)} />
    </span>
  );
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const s = AGENT_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        s.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/* ----------------------------- Statut appel ----------------------------- */

const CALL_STATUS: Record<CallStatus, { label: string; badge: string }> = {
  completed: {
    label: "Résolu",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
  },
  transferred: {
    label: "Transféré",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15",
  },
  missed: {
    label: "Manqué",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
  },
  failed: {
    label: "Échec",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15",
  },
  in_progress: {
    label: "En cours",
    badge: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const s = CALL_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        s.badge,
      )}
    >
      {s.label}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: CallDirection }) {
  const inbound = direction === "inbound";
  const Icon = inbound ? PhoneIncoming : PhoneOutgoing;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon
        className={cn("size-3.5", inbound ? "text-sky-500" : "text-brand")}
        strokeWidth={1.75}
      />
      {inbound ? "Entrant" : "Sortant"}
    </span>
  );
}
