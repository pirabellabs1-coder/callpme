"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import type { AgentStatus } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const OPTIONS: { value: AgentStatus; label: string }[] = [
  { value: "active", label: "En ligne" },
  { value: "paused", label: "En pause" },
  { value: "draft", label: "Brouillon" },
];

export function AgentStatusControl({
  agentId,
  status,
}: {
  agentId: string;
  status: AgentStatus;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<AgentStatus>(status);
  const [pending, setPending] = useState<AgentStatus | null>(null);

  async function change(next: AgentStatus) {
    if (next === current || pending) return;
    setPending(next);
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setCurrent(next);
      router.refresh();
    }
    setPending(null);
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => change(o.value)}
          disabled={pending !== null}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
            current === o.value
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {pending === o.value && <Loader2 className="size-3.5 animate-spin" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DeleteAgentButton({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (
      !window.confirm(
        `Supprimer définitivement « ${agentName} » et tous ses appels ? Cette action est irréversible.`,
      )
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/agents");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={del}
      disabled={deleting}
      aria-label="Supprimer l'agent"
      className="text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
    >
      {deleting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}
