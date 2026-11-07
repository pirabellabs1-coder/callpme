"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Plus,
  Trash2,
  Check,
  Loader2,
  Plug,
  X,
  AlertCircle,
  PhoneForwarded,
  Bot,
} from "lucide-react";
import type {
  PhoneNumberRecord,
  ProviderConnectionRecord,
  TelephonyProvider,
} from "@/lib/shared/types";
import { TELEPHONY_PROVIDERS, providerLabel } from "@/lib/telephony/providers";
import { UNLIMITED } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { OperatorAccounts } from "./operator-accounts";
import { NumberDiagnosticButton } from "./number-diagnostic";

export function NumbersManager({
  initialNumbers,
  initialProviders,
  maxNumbers,
}: {
  initialNumbers: PhoneNumberRecord[];
  initialProviders: ProviderConnectionRecord[];
  maxNumbers: number;
}) {
  const [numbers, setNumbers] = useState(initialNumbers);
  const [providers, setProviders] = useState(initialProviders);
  const [showNumber, setShowNumber] = useState(false);
  const [numError, setNumError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Number form
  const [num, setNum] = useState({
    provider: "twilio" as TelephonyProvider,
    number: "",
    label: "",
    monthlyPrice: "3",
  });
  const [addingNum, setAddingNum] = useState(false);

  const unlimited = maxNumbers >= UNLIMITED;
  const limitReached = !unlimited && numbers.length >= maxNumbers;

  async function addNumber(e: React.FormEvent) {
    e.preventDefault();
    setAddingNum(true);
    setNumError(null);
    const res = await fetch("/api/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: num.provider,
        number: num.number.trim(),
        label: num.label.trim(),
        monthlyPrice: Number(num.monthlyPrice) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNumbers((n) => [...n, data.number]);
      setNum({ provider: "twilio", number: "", label: "", monthlyPrice: "3" });
      setShowNumber(false);
    } else {
      setNumError(data.error ?? "Ajout impossible. Vérifiez le numéro.");
    }
    setAddingNum(false);
  }

  async function removeNumber(n: PhoneNumberRecord) {
    const msg = n.assignedAgentName
      ? `Supprimer le numéro ${n.number} ? Il est relié à l'agent « ${n.assignedAgentName} ».`
      : `Supprimer le numéro ${n.number} ?`;
    if (!window.confirm(msg)) return;
    setNumError(null);
    setRemoving(n.id);
    const res = await fetch(`/api/numbers/${n.id}`, { method: "DELETE" });
    if (res.ok) setNumbers((list) => list.filter((x) => x.id !== n.id));
    else setNumError("Suppression impossible. Réessayez.");
    setRemoving(null);
  }

  return (
    <div className="space-y-6">
      {/* How it works */}
      <section
        aria-labelledby="numbers-howto"
        className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-secondary/30 p-5 md:grid-cols-3"
      >
        <h2 id="numbers-howto" className="sr-only">
          Comment relier un numéro à un agent
        </h2>
        <Step n={1} icon={Phone} title="Numéro">
          Achetez un numéro dans notre catalogue, ou connectez votre compte Twilio ci-dessous et
          importez vos numéros : ils sont configurés automatiquement et actifs tout de suite.
        </Step>
        <Step n={2} icon={Plug} title="Agent">
          Reliez le numéro à un agent à l&apos;étape « Téléphonie » de sa configuration : les
          appels reçus arrivent sur cet agent.
        </Step>
        <Step n={3} icon={PhoneForwarded} title="Renvoi d'appel">
          Pour garder votre numéro habituel, activez chez votre opérateur un renvoi
          d&apos;appel vers le numéro relié à l&apos;agent (renvoi permanent, ou seulement si
          occupé / sans réponse).
        </Step>
      </section>

      <OperatorAccounts
        providers={providers}
        onProvidersChange={setProviders}
        onImported={(n) => setNumbers((list) => [...list.filter((x) => x.number !== n.number), n])}
      />

      {/* Numbers */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
              Numéros
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {unlimited
                ? `${numbers.length} numéro${numbers.length > 1 ? "s" : ""} · illimité avec votre offre`
                : `${numbers.length} sur ${maxNumbers} inclus dans votre offre`}
            </p>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => setShowNumber((v) => !v)}
            disabled={limitReached && !showNumber}
            aria-expanded={showNumber}
            aria-controls="number-form"
          >
            {showNumber ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {showNumber ? "Fermer" : "Ajouter un numéro"}
          </Button>
        </div>

        {limitReached && (
          <p className="mx-5 mb-4 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Limite de numéros atteinte pour votre offre.{" "}
            <Link href="/billing" className="font-medium underline underline-offset-2">
              Voir les offres
            </Link>
          </p>
        )}

        {showNumber && (
          <form
            id="number-form"
            onSubmit={addNumber}
            className="mx-5 mb-4 space-y-4 rounded-xl border border-border bg-background/60 p-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="num-provider">Opérateur</Label>
                <Select
                  id="num-provider"
                  value={num.provider}
                  onChange={(e) =>
                    setNum({ ...num, provider: e.target.value as TelephonyProvider })
                  }
                >
                  {TELEPHONY_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-number">
                  Numéro <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="num-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={num.number}
                  onChange={(e) => setNum({ ...num, number: e.target.value })}
                  placeholder="+33 1 84 80 00 00"
                  required
                  aria-describedby="num-number-hint"
                />
                <p id="num-number-hint" className="text-xs text-muted-foreground">
                  Format international, avec l&apos;indicatif pays.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-label">
                  Libellé <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="num-label"
                  value={num.label}
                  onChange={(e) => setNum({ ...num, label: e.target.value })}
                  placeholder="Paris · Accueil"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-price">Coût mensuel chez l&apos;opérateur (€)</Label>
                <Input
                  id="num-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={num.monthlyPrice}
                  onChange={(e) => setNum({ ...num, monthlyPrice: e.target.value })}
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="brand"
              size="sm"
              disabled={addingNum || !num.number.trim() || !num.label.trim()}
            >
              {addingNum ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Ajouter le numéro
            </Button>
          </form>
        )}

        {numError && <ErrorLine message={numError} className="mx-5 mb-4" />}

        {numbers.length === 0 ? (
          <div className="border-t border-border p-5">
            <EmptyState
              icon={Phone}
              title="Aucun numéro"
              description="Ajoutez un numéro de votre opérateur, puis reliez-le à un agent pour qu'il réponde aux appels."
              className="py-10"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {numbers.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:flex-nowrap"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border"
                >
                  <Phone className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="mono truncate text-sm font-medium text-foreground">{n.number}</span>
                    {n.status === "pending" && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-400">
                        En attente de vérification
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {n.label} · {providerLabel(n.provider)} · {n.monthlyPrice} €/mois
                  </p>
                </div>
                <div className="order-last w-full pl-[3.25rem] sm:order-none sm:w-48 sm:shrink-0 sm:pl-0">
                  {n.assignedAgentId ? (
                    <Link
                      href={`/agents/${n.assignedAgentId}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded text-sm font-medium text-foreground hover:text-brand-400"
                    >
                      <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Relié à l&apos;agent </span>
                      <span className="truncate">{n.assignedAgentName}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-600" />
                      Non relié à un agent
                    </span>
                  )}
                </div>
                <NumberDiagnosticButton numberId={n.id} />
                <button
                  type="button"
                  onClick={() => removeNumber(n)}
                  disabled={removing === n.id}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label={`Supprimer le numéro ${n.number}`}
                >
                  {removing === n.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: typeof Phone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-foreground/70 ring-1 ring-inset ring-border"
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">
          <span className="mono mr-1.5 text-muted-foreground">{n}.</span>
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{children}</p>
      </div>
    </div>
  );
}

function ErrorLine({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={`flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className ?? ""}`}
    >
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
