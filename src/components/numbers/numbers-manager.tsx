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
  PlugZap,
} from "lucide-react";
import type {
  PhoneNumberRecord,
  ProviderConnectionRecord,
  TelephonyProvider,
} from "@/lib/shared/types";
import {
  TELEPHONY_PROVIDERS,
  providerLabel,
} from "@/lib/telephony/providers";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RoleIcon } from "@/components/role-badge";

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
  const [error, setError] = useState<string | null>(null);

  // Formulaire numéro
  const [num, setNum] = useState({
    provider: "twilio" as TelephonyProvider,
    number: "",
    label: "",
    monthlyPrice: "3",
  });
  const [addingNum, setAddingNum] = useState(false);

  // Formulaire opérateur
  const [prov, setProv] = useState<{
    provider: TelephonyProvider;
    label: string;
    creds: Record<string, string>;
  }>({ provider: "twilio", label: "", creds: {} });
  const [addingProv, setAddingProv] = useState(false);

  const providerInfo = TELEPHONY_PROVIDERS.find((p) => p.id === prov.provider);

  async function addNumber(e: React.FormEvent) {
    e.preventDefault();
    setAddingNum(true);
    setError(null);
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
    const data = await res.json();
    if (res.ok) {
      setNumbers((n) => [...n, data.number]);
      setNum({ provider: "twilio", number: "", label: "", monthlyPrice: "3" });
      setShowNumber(false);
    } else {
      setError(data.error ?? "Erreur");
    }
    setAddingNum(false);
  }

  async function connectProvider(e: React.FormEvent) {
    e.preventDefault();
    setAddingProv(true);
    setError(null);
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: prov.provider,
        label: prov.label.trim() || providerLabel(prov.provider),
        ...prov.creds,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProviders((p) => [...p, data.provider]);
      setProv({ provider: "twilio", label: "", creds: {} });
      setShowProvider(false);
    } else {
      setError(data.error ?? "Erreur");
    }
    setAddingProv(false);
  }

  async function removeNumber(id: string) {
    if (!window.confirm("Supprimer ce numéro ?")) return;
    const res = await fetch(`/api/numbers/${id}`, { method: "DELETE" });
    if (res.ok) setNumbers((n) => n.filter((x) => x.id !== id));
  }

  async function removeProvider(id: string) {
    if (!window.confirm("Déconnecter cet opérateur ?")) return;
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
    if (res.ok) setProviders((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Opérateurs */}
      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-muted-foreground" />
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Opérateurs connectés
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowProvider((v) => !v)}>
            <Plus className="size-4" />
            Connecter un opérateur
          </Button>
        </div>

        {showProvider && (
          <form
            onSubmit={connectProvider}
            className="mx-5 mb-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Opérateur</label>
                <Select
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
                <label className="text-xs font-medium text-muted-foreground">Nom de la connexion</label>
                <Input
                  value={prov.label}
                  onChange={(e) => setProv({ ...prov, label: e.target.value })}
                  placeholder={`Compte ${providerLabel(prov.provider)}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {providerInfo?.credentials.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{c.label}</label>
                  <Input
                    type="password"
                    value={prov.creds[c.key] ?? ""}
                    onChange={(e) =>
                      setProv({
                        ...prov,
                        creds: { ...prov.creds, [c.key]: e.target.value },
                      })
                    }
                    placeholder="••••••••"
                  />
                </div>
              ))}
            </div>
            <Button type="submit" variant="brand" size="sm" disabled={addingProv}>
              {addingProv ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Connecter
            </Button>
          </form>
        )}

        {providers.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            Aucun opérateur connecté. Connectez Twilio, Zadarma, OVH… pour
            provisionner des numéros.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border">
                  <Plug className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{providerLabel(p.provider)}</p>
                </div>
                {p.hasCredentials ? (
                  <Badge variant="success">Connecté</Badge>
                ) : (
                  <Badge variant="muted">Sans clé</Badge>
                )}
                <button
                  type="button"
                  onClick={() => removeProvider(p.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Déconnecter"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Numéros */}
      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Numéros ({numbers.length})
          </h2>
          <Button size="sm" variant="default" onClick={() => setShowNumber((v) => !v)}>
            <Plus className="size-4" />
            Ajouter un numéro
          </Button>
        </div>

        {showNumber && (
          <form
            onSubmit={addNumber}
            className="mx-5 mb-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Opérateur</label>
                <Select
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
                <label className="text-xs font-medium text-muted-foreground">Numéro</label>
                <Input
                  value={num.number}
                  onChange={(e) => setNum({ ...num, number: e.target.value })}
                  placeholder="+33 1 84 80 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Libellé</label>
                <Input
                  value={num.label}
                  onChange={(e) => setNum({ ...num, label: e.target.value })}
                  placeholder="Paris · Accueil"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prix mensuel (€)</label>
                <Input
                  type="number"
                  min={0}
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
              {addingNum ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Ajouter le numéro
            </Button>
            <p className="text-xs text-muted-foreground">
              Vous pouvez ajouter jusqu'à {maxNumbers} numéro
              {maxNumbers > 1 ? "s" : ""} avec votre offre.
            </p>
          </form>
        )}

        {numbers.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            Aucun numéro. Ajoutez-en un pour le relier à un agent.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {numbers.map((n) => (
              <div key={n.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border">
                  <Phone className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mono truncate text-sm font-medium text-foreground">
                    {n.number}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {n.label} · {providerLabel(n.provider)} · {n.monthlyPrice} €/mois
                  </p>
                </div>
                <div className="w-44 shrink-0">
                  {n.assignedAgentId ? (
                    <Link
                      href={`/agents/${n.assignedAgentId}`}
                      className="inline-flex items-center gap-1.5 truncate text-sm font-medium text-foreground hover:text-brand"
                    >
                      {n.assignedAgentName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                      <Check className="size-4" />
                      Disponible
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeNumber(n.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
