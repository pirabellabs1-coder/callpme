"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Passe l'agent « En ligne » depuis le guide de mise en ligne. */
export function GoLiveButton({ agentId, disabled }: { agentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="brand"
        size="sm"
        disabled={busy || disabled}
        title={disabled ? "Terminez d'abord les étapes indispensables" : undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/agents/${agentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "active" }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setError(data.error ?? "Mise en ligne impossible.");
            } else router.refresh();
          } catch {
            setError("Connexion impossible. Réessayez.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Mettre en ligne
      </Button>
      {disabled && <span className="text-xs text-muted-foreground">Terminez d&apos;abord les étapes indispensables.</span>}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
