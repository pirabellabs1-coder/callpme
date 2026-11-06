"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/billing/plans";
import {
  startCheckout,
  submitAgencyRequest,
  payAgencyRequest,
  redeemPromo,
} from "@/app/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/settings/dialog";

type Agency = {
  id: string;
  status: string;
  quotedAmountEur: number | null;
  adminNote: string | null;
} | null;

export function BillingPlans({
  currentPlan,
  status,
  agency,
}: {
  currentPlan: string;
  /** État de l'abonnement : l'offre en cours se renouvelle, la démo se transforme. */
  status: "trial" | "active" | "expired";
  agency: Agency;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [promo, setPromo] = useState("");
  const [promoDone, setPromoDone] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function checkout(id: PlanId) {
    setError(null);
    setTarget(id);
    start(async () => {
      const r = await startCheckout(id, promo);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.activated) {
        setTarget(null);
        setPromoDone("Code appliqué : votre offre est active pour 30 jours.");
        router.refresh();
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

  function usePromo() {
    setError(null);
    setPromoDone(null);
    setTarget("promo");
    start(async () => {
      const r = await redeemPromo(promo);
      setTarget(null);
      if (r.error) setError(r.error);
      else {
        setPromoDone("Code appliqué : votre offre est active pour 30 jours.");
        setPromo("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="promo-code">Code promo</Label>
          <Input
            id="promo-code"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="EX. LANCEMENT"
            maxLength={40}
            className="w-48 font-mono uppercase"
            aria-describedby="promo-help"
          />
        </div>
        <Button variant="outline" onClick={usePromo} disabled={pending || !promo.trim()}>
          {target === "promo" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Utiliser le code
        </Button>
        <p id="promo-help" className="w-full text-xs text-muted-foreground">
          Un code de réduction s&apos;applique au paiement de l&apos;offre choisie ci-dessous ; un code d&apos;offre gratuite s&apos;active avec « Utiliser le code ».
        </p>
        {promoDone && (
          <p role="status" className="flex w-full items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" aria-hidden="true" /> {promoDone}
          </p>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = currentPlan === id;
          const isAgency = id === "agency";
          return (
            <li
              key={id}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                isCurrent ? "border-brand/50 ring-2 ring-brand/15" : "border-border",
              )}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground shadow-brand">
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
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden="true" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent && !isAgency ? (
                <Button
                  variant={status === "active" ? "outline" : "brand"}
                  className="mt-6 w-full"
                  disabled={pending}
                  onClick={() => checkout(id)}
                >
                  {target === id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {status === "active" ? "Renouveler (+30 jours)" : "Payer cette offre"}
                </Button>
              ) : isCurrent && isAgency && status === "active" ? (
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
                    {target === "agency-pay" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
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
                  {target === id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Choisir {plan.name}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

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

  const formId = useId();

  return (
    <Dialog
      title="Demande — Offre Agence"
      description="Décrivez vos objectifs et votre budget. Notre équipe vous propose un montant, puis vous réglez depuis cette page."
      icon={<Building2 />}
      size="lg"
      onClose={onClose}
      dismissible={!pending}
      footer={
        sent ? (
          <Button variant="brand" size="sm" onClick={onClose} data-autofocus>
            Fermer
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" form={formId} variant="brand" size="sm" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Envoyer ma demande
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-600/25 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Demande envoyée. Notre équipe revient vers vous avec un montant ; vous
            pourrez régler depuis la page Facturation.
          </p>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-name`}>Nom du contact</Label>
              <Input id={`${formId}-name`} name="name" autoComplete="name" placeholder="Votre nom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-email`}>E-mail</Label>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="vous@agence.fr"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-budget`}>Budget agence (€ / mois)</Label>
            <Input
              id={`${formId}-budget`}
              name="budget"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Ex : 800"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-objectives`}>
              Vos objectifs <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`${formId}-objectives`}
              name="objectives"
              rows={4}
              placeholder="Nombre de clients, volume d'appels visé, fonctionnalités attendues…"
              required
            />
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
