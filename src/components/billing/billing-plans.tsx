"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X, AlertCircle } from "lucide-react";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/billing/plans";
import {
  startCheckout,
  submitAgencyRequest,
  payAgencyRequest,
} from "@/app/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Agency = {
  id: string;
  status: string;
  quotedAmountEur: number | null;
  adminNote: string | null;
} | null;

export function BillingPlans({
  currentPlan,
  agency,
  xofRate,
}: {
  currentPlan: string;
  agency: Agency;
  xofRate: number;
}) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fcfa = (eur: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(eur * xofRate)) + " FCFA";

  function checkout(id: PlanId) {
    setError(null);
    setTarget(id);
    start(async () => {
      const r = await startCheckout(id);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setError(r.error ?? "Erreur.");
      setTarget(null);
    });
  }

  function payAgency() {
    if (!agency) return;
    setError(null);
    setTarget("agency-pay");
    start(async () => {
      const r = await payAgencyRequest(agency.id);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setError(r.error ?? "Erreur.");
      setTarget(null);
    });
  }

  return (
    <>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = currentPlan === id;
          const isAgency = id === "agency";
          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                isCurrent ? "border-brand/50 ring-2 ring-brand/15" : "border-border",
              )}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-brand">
                  Offre actuelle
                </span>
              )}
              <h3 className="font-semibold tracking-tight text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-display-sm font-semibold tracking-tight text-foreground">
                  {plan.priceLabel}
                </span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              {plan.priceMonthly != null && (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  ≈ {fcfa(plan.priceMonthly)} / mois
                </p>
              )}
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="outline" className="mt-6 w-full" disabled>
                  Offre actuelle
                </Button>
              ) : isAgency ? (
                agency && agency.status === "quoted" && agency.quotedAmountEur ? (
                  <Button
                    variant="brand"
                    className="mt-6 w-full"
                    disabled={pending}
                    onClick={payAgency}
                  >
                    {target === "agency-pay" && <Loader2 className="size-4 animate-spin" />}
                    Payer {agency.quotedAmountEur} €
                  </Button>
                ) : agency && agency.status === "paid" ? (
                  <Button variant="outline" className="mt-6 w-full" disabled>
                    Offre Agence active
                  </Button>
                ) : agency && agency.status === "pending" ? (
                  <Button variant="outline" className="mt-6 w-full" disabled>
                    Demande en cours d'examen…
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    className="mt-6 w-full"
                    onClick={() => setShowForm(true)}
                  >
                    {agency?.status === "rejected" ? "Refaire une demande" : "Faire une demande"}
                  </Button>
                )
              ) : (
                <Button
                  variant={plan.highlight ? "brand" : "default"}
                  className="mt-6 w-full"
                  disabled={pending}
                  onClick={() => checkout(id)}
                >
                  {target === id && <Loader2 className="size-4 animate-spin" />}
                  Choisir {plan.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {agency && agency.status === "quoted" && agency.adminNote && (
        <p className="mt-4 rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Message de l'équipe :</strong> {agency.adminNote}
        </p>
      )}

      {showForm && <AgencyModal onClose={() => setShowForm(false)} />}
    </>
  );
}

function AgencyModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await submitAgencyRequest(fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold tracking-tight text-foreground">
              Demande — Offre Agence
            </h3>
            <p className="text-xs text-muted-foreground">
              Décrivez vos objectifs et votre budget. Notre équipe vous propose un montant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-5 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
            Demande envoyée ! Notre équipe revient vers vous avec un montant. Vous
            pourrez régler depuis cette page.
            <div className="mt-3">
              <Button variant="brand" size="sm" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom du contact</Label>
                <Input id="name" name="name" placeholder="Votre nom" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="vous@agence.fr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget agence (€ / mois)</Label>
              <Input id="budget" name="budget" type="number" min={0} placeholder="Ex : 800" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="objectives">Vos objectifs</Label>
              <Textarea
                id="objectives"
                name="objectives"
                rows={4}
                placeholder="Nombre de clients, volume d'appels visé, fonctionnalités attendues…"
                required
              />
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" variant="brand" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Envoyer ma demande
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
