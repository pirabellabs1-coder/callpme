"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Check, Trash2, RotateCcw } from "lucide-react";
import {
  purgeDemoData,
  reloadDemoData,
  type AdminResult,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function PurgeDemoButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<AdminResult>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await action();
      if (res.error) return setError(res.error);
      setInfo(res.info ?? "Fait.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            run(
              purgeDemoData,
              "Supprimer TOUTES les données de démonstration (agents, appels, campagnes, voix, numéros, clés API…) ? Cette action est irréversible.",
            )
          }
          disabled={pending}
          className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Purger les données de démonstration
        </Button>
        <Button variant="outline" onClick={() => run(reloadDemoData)} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Recharger des données de démo
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}
      {info && (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="size-4 shrink-0" />
          {info}
        </p>
      )}
    </div>
  );
}
