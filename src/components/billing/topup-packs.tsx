"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, Smartphone } from "lucide-react";
import { startTopup } from "@/app/actions/billing";
import { MINUTE_PACKS } from "@/lib/billing/topups";
import { Button } from "@/components/ui/button";

export function TopupPacks({ xofRate, disabledReason }: { xofRate: number; disabledReason?: string }) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fcfa = (eur: number) => new Intl.NumberFormat("fr-FR").format(Math.round(eur * xofRate));

  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-3">
        {MINUTE_PACKS.map((p) => (
          <li key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">{p.label}</p>
            <p className="mt-1 tabular text-xl font-semibold">
              {fcfa(p.priceEur)} <span className="text-sm font-normal text-muted-foreground">FCFA</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ {p.priceEur} € · {fcfa(p.priceEur / p.minutes)} FCFA la minute
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={pending || Boolean(disabledReason)}
              onClick={() => {
                setError(null);
                setTarget(p.id);
                start(async () => {
                  const r = await startTopup(p.id);
                  if (r.url) {
                    window.location.href = r.url;
                    return;
                  }
                  setError(r.error ?? "Paiement impossible.");
                  setTarget(null);
                });
              }}
            >
              {target === p.id ? <Loader2 className="animate-spin" aria-hidden /> : <Smartphone aria-hidden />} Recharger
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {disabledReason ??
          "Paiement par Mobile Money (MTN, Moov, Orange, Wave…) ou carte. Les minutes rechargées servent une fois celles de votre offre épuisées, et restent acquises d'un mois sur l'autre."}
      </p>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
