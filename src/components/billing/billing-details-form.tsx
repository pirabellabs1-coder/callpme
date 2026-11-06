"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateBillingDetails } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Coordonnées qui figurent sur les factures du client. */
export function BillingDetailsForm({
  initial,
  orgName,
  canEdit,
}: {
  initial: { name: string; address: string; taxId: string };
  orgName: string;
  canEdit: boolean;
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<typeof v>) => {
    setV((x) => ({ ...x, ...patch }));
    setMsg(null);
  };

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateBillingDetails(v);
          setMsg(r.ok ? { ok: true, text: "Enregistré : vos prochaines factures porteront ces informations." } : { ok: false, text: r.error ?? "Erreur." });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bill-name">Nom ou raison sociale</Label>
          <Input id="bill-name" value={v.name} maxLength={120} placeholder={orgName} disabled={!canEdit} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-tax">IFU / n° fiscal (facultatif)</Label>
          <Input id="bill-tax" value={v.taxId} maxLength={60} disabled={!canEdit} onChange={(e) => set({ taxId: e.target.value })} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bill-address">Adresse (facultatif)</Label>
          <Textarea id="bill-address" rows={2} value={v.address} maxLength={400} placeholder="Rue, quartier, ville" disabled={!canEdit} onChange={(e) => set({ address: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={pending || !canEdit}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {msg.text}
          </p>
        )}
        {!canEdit && <p className="text-xs text-muted-foreground">Seuls les administrateurs peuvent modifier ces informations.</p>}
      </div>
    </form>
  );
}
