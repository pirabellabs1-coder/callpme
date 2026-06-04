"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { Call } from "@/lib/shared/types";
import { RoleIcon } from "@/components/role-badge";
import { CallStatusBadge, DirectionBadge } from "@/components/status-badges";
import { formatDuration } from "@/lib/utils";

export function CallRow({ call }: { call: Call }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Supprimer cet appel ? Cette action est définitive.")) return;
    setDeleting(true);
    const res = await fetch(`/api/calls/${call.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setDeleting(false);
  }

  return (
    <div className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-5">
      <Link
        href={`/calls/${call.id}`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        aria-label={`Voir l'appel de ${call.agentName ?? "l'agent"}`}
      />

      {call.agentRole ? (
        <RoleIcon role={call.agentRole} size="sm" />
      ) : (
        <span className="size-8 rounded-lg bg-secondary" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {call.agentName ?? "Agent"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {call.outcome ?? "—"}
        </p>
      </div>

      <div className="hidden w-28 sm:block">
        <DirectionBadge direction={call.direction} />
      </div>

      <span className="mono hidden w-36 text-xs text-muted-foreground md:block">
        {call.direction === "inbound" ? call.fromNumber : call.toNumber}
      </span>

      <span className="hidden w-16 text-right text-xs tabular text-muted-foreground sm:block">
        {formatDuration(call.durationSec)}
      </span>

      <span className="hidden w-28 text-right text-xs text-muted-foreground lg:block">
        {formatDistanceToNow(new Date(call.createdAt), {
          addSuffix: true,
          locale: fr,
        })}
      </span>

      <div className="w-24 text-right">
        <CallStatusBadge status={call.status} />
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        aria-label="Supprimer l'appel"
        className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        {deleting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
    </div>
  );
}
