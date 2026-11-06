"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { saveCompanyAction } from "@/app/actions/admin-company";
import type { Company } from "@/lib/billing/company";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Field = { key: keyof Company; label: string; hint?: string; placeholder?: string; multiline?: boolean; required?: boolean };

const IDENTITY: Field[] = [
  { key: "legalName", label: "Raison sociale", placeholder: "Ex. Pirabel Labs SARL", required: true },
  { key: "legalForm", label: "Forme juridique", placeholder: "SARL, SAS, Entreprise individuelle…" },
  { key: "capital", label: "Capital social", placeholder: "Ex. 1 000 000 FCFA" },
  { key: "address", label: "Adresse du siège", placeholder: "Rue, quartier, ville", multiline: true, required: true },
  { key: "country", label: "Pays", placeholder: "Bénin" },
  { key: "taxId", label: "IFU (identifiant fiscal unique)", required: true },
  { key: "rccm", label: "RCCM", placeholder: "RB/COT/…", required: true },
  { key: "phone", label: "Téléphone" },
  { key: "email", label: "E-mail de facturation" },
];

export function CompanyForm({ initial }: { initial: Company }) {
  const [c, setC] = useState<Company>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<Company>) => {
    setC((x) => ({ ...x, ...patch }));
    setMsg(null);
  };

  function input(f: Field) {
    const id = `co-${f.key}`;
    const value = String(c[f.key] ?? "");
    return (
      <div key={f.key} className={f.multiline ? "space-y-2 sm:col-span-2" : "space-y-2"}>
        <Label htmlFor={id}>
          {f.label}
          {f.required && <span className="text-destructive"> *</span>}
        </Label>
        {f.multiline ? (
          <Textarea id={id} rows={2} value={value} placeholder={f.placeholder} onChange={(e) => set({ [f.key]: e.target.value } as Partial<Company>)} />
        ) : (
          <Input id={id} value={value} placeholder={f.placeholder} onChange={(e) => set({ [f.key]: e.target.value } as Partial<Company>)} />
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCompanyAction(c);
          setMsg(r.ok ? { ok: true, text: "Enregistré. Les prochaines factures porteront ces informations." } : { ok: false, text: r.error ?? "Erreur." });
        });
      }}
    >
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Identité légale</h2>
        <div className="grid gap-4 sm:grid-cols-2">{IDENTITY.map(input)}</div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">TVA</h2>
        <fieldset className="space-y-2">
          <legend className="sr-only">Régime de TVA</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="radio" name="vat" className="mt-1 accent-brand" checked={c.vatRegime === "none"} onChange={() => set({ vatRegime: "none" })} />
            <span>
              <span className="font-medium">Pas de TVA facturée</span>
              <span className="block text-muted-foreground">Le prix payé est celui affiché. La mention ci-dessous figure sur la facture.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="radio" name="vat" className="mt-1 accent-brand" checked={c.vatRegime === "vat"} onChange={() => set({ vatRegime: "vat" })} />
            <span>
              <span className="font-medium">TVA ajoutée au prix HT</span>
              <span className="block text-muted-foreground">Le client paie le prix affiché + la TVA ; la facture détaille HT, TVA et TTC.</span>
            </span>
          </label>
        </fieldset>
        {c.vatRegime === "vat" ? (
          <div className="max-w-40 space-y-2">
            <Label htmlFor="co-rate">Taux de TVA (%)</Label>
            <Input id="co-rate" type="number" min={0} max={30} step={0.5} value={c.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) })} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="co-note">Mention sur la facture</Label>
            <Input id="co-note" value={c.vatNote} onChange={(e) => set({ vatNote: e.target.value })} />
          </div>
        )}
      </Card>

      <Card className="space-y-2 p-5">
        <Label htmlFor="co-footer">Pied de facture (facultatif)</Label>
        <Textarea id="co-footer" rows={2} value={c.footer} placeholder="Ex. coordonnées bancaires, conditions de paiement" onChange={(e) => set({ footer: e.target.value })} />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
