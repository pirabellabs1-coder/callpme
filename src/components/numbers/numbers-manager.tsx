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
  KeyRound,
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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
  const [showProvider, setShowProvider] = useState(false);
  const [provError, setProvError] = useState<string | null>(null);
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

  // Provider form
  const [prov, setProv] = useState<{
    provider: TelephonyProvider;
    label: string;
    creds: Record<string, string>;
  }>({ provider: "twilio", label: "", creds: {} });
  const [addingProv, setAddingProv] = useState(false);

  const providerInfo = TELEPHONY_PROVIDERS.find((p) => p.id === prov.provider);
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

  async function connectProvider(e: React.FormEvent) {
    e.preventDefault();
    setAddingProv(true);
    setProvError(null);
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: prov.provider,
        label: prov.label.trim() || providerLabel(prov.provider),
        ...prov.creds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProviders((p) => [...p, data.provider]);
      setProv({ provider: "twilio", label: "", creds: {} });
      setShowProvider(false);
    } else {
      setProvError(data.error ?? "Enregistrement impossible.");
    }
    setAddingProv(false);
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

  async function removeProvider(p: ProviderConnectionRecord) {
    if (!window.confirm(`Retirer l'opérateur « ${p.label} » et ses identifiants ?`)) return;
    setProvError(null);
    setRemoving(p.id);
    const res = await fetch(`/api/providers/${p.id}`, { method: "DELETE" });
    if (res.ok) setProviders((list) => list.filter((x) => x.id !== p.id));
    else setProvError("Suppression impossible. Réessayez.");
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
        <Step n={1} icon={Plug} title="Opérateur">
          Enregistrez les identifiants de votre compte (Twilio, Zadarma, OVH…). Ils ne sont
          pas vérifiés automatiquement.
        </Step>
        <Step n={2} icon={Phone} title="Numéro">
          Ajoutez le numéro acheté chez cet opérateur, puis reliez-le à un agent à l&apos;étape
          « Téléphonie » de sa configuration.
        </Step>
        <Step n={3} icon={PhoneForwarded} title="Renvoi d'appel">
          Pour garder votre numéro habituel, activez chez votre opérateur un renvoi
          d&apos;appel vers le numéro relié à l&apos;agent (renvoi permanent, ou seulement si
          occupé / sans réponse).
        </Step>
      </section>

      {/* Providers */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Plug className="size-4 text-muted-foreground" aria-hidden="true" />
              Opérateurs
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Comptes téléphoniques dont vous utilisez les numéros.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowProvider((v) => !v)}
            aria-expanded={showProvider}
            aria-controls="provider-form"
          >
            {showProvider ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {showProvider ? "Fermer" : "Ajouter un opérateur"}
          </Button>
        </div>

        {showProvider && (
          <form
            id="provider-form"
            onSubmit={connectProvider}
            className="mx-5 mb-4 space-y-4 rounded-xl border border-border bg-background/60 p-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prov-provider">Opérateur</Label>
                <Select
                  id="prov-provider"
                  value={prov.provider}
                  onChange={(e) =>
                    setProv({
                      provider: e.target.value as TelephonyProvider,
                      label: "",
                      creds: {},
                    })
                  }
                >
                  {TELEPHONY_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.note}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prov-label">Nom de la connexion</Label>
                <Input
                  id="prov-label"
                  value={prov.label}
                  onChange={(e) => setProv({ ...prov, label: e.target.value })}
                  placeholder={`Compte ${providerLabel(prov.provider)}`}
                  maxLength={80}
                />
              </div>
              {providerInfo?.credentials.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label htmlFor={`prov-${c.key}`}>{c.label}</Label>
                  <Input
                    id={`prov-${c.key}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={prov.creds[c.key] ?? ""}
                    onChange={(e) =>
                      setProv({
                        ...prov,
                        creds: { ...prov.creds, [c.key]: e.target.value },
                      })
                    }
                    placeholder="••••••••"
                    maxLength={200}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="brand" size="sm" disabled={addingProv}>
                {addingProv ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                Enregistrer l&apos;opérateur
              </Button>
              <p className="text-xs text-muted-foreground">
                Les identifiants sont enregistrés tels quels, sans test de connexion.
              </p>
            </div>
          </form>
        )}

        {provError && <ErrorLine message={provError} className="mx-5 mb-4" />}

        {providers.length === 0 ? (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
            Aucun opérateur enregistré. Ajoutez celui chez qui vous avez (ou achèterez) vos
            numéros.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border"
                >
                  <Plug className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{providerLabel(p.provider)}</p>
                </div>
                {p.hasCredentials ? (
                  <Badge variant="success">
                    <KeyRound aria-hidden="true" />
                    <span className="hidden sm:inline">Identifiants enregistrés</span>
                    <span className="sm:hidden">Identifiants</span>
                  </Badge>
                ) : (
                  <Badge variant="muted">Sans identifiants</Badge>
                )}
                <button
                  type="button"
                  onClick={() => removeProvider(p)}
                  disabled={removing === p.id}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label={`Retirer l'opérateur ${p.label}`}
                >
                  {removing === p.id ? (
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
                  <p className="mono truncate text-sm font-medium text-foreground">{n.number}</p>
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
