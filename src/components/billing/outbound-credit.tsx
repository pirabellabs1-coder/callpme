"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, PhoneOutgoing } from "lucide-react";
import { startCreditTopup } from "@/app/actions/billing";
import { formatEur } from "@/lib/billing/money";
import { Button } from "@/components/ui/button";

/** Crédit prépayé des appels sortants : solde, prix par destination, recharge. */
export function OutboundCredit({
  balanceCents,
  rates,
  packs,
  disabledReason,
}: {
  balanceCents: number;
  rates: { label: string; eur: number }[];
  packs: readonly number[];
  disabledReason?: string;
}) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Solde disponible : <span className="tabular text-lg font-semibold text-foreground">{formatEur(balanceCents / 100)}</span>
        </p>
        {balanceCents === 0 && (
          <p className="text-xs text-muted-foreground">
            Facultatif : utile seulement pour que vos agents appellent eux-mêmes. Les appels reçus utilisent les minutes de votre offre.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 font-medium">Destination</th>
              <th scope="col" className="py-2 text-right font-medium">Prix par minute</th>
              {balanceCents > 0 && <th scope="col" className="py-2 text-right font-medium">Avec le solde actuel</th>}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.label} className="border-b border-border last:border-0">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{formatEur(r.eur)}</td>
                {balanceCents > 0 && (
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {Math.floor(balanceCents / Math.round(r.eur * 100))} min
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {packs.map((amount) => (
          <Button
            key={amount}
            variant="outline"
            size="sm"
            disabled={pending || Boolean(disabledReason)}
            onClick={() => {
              setError(null);
              setTarget(amount);
              start(async () => {
                const r = await startCreditTopup(amount);
                if (r.url) {
                  window.location.href = r.url;
                  return;
                }
                setError(r.error ?? "Paiement impossible.");
                setTarget(null);
              });
            }}
          >
            {target === amount ? <Loader2 className="animate-spin" aria-hidden /> : <PhoneOutgoing aria-hidden />} Recharger {formatEur(amount)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {disabledReason ??
          "Les appels sortants (campagnes, rappels, API) se paient sur ce crédit, à la minute entamée. Un appel ne part que si le crédit couvre au moins une minute, et il s'arrête quand le crédit est épuisé. Les minutes de votre offre servent aux appels reçus et à votre site."}
      </p>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
