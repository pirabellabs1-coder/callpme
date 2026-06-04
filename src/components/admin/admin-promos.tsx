"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Ticket,
  Power,
} from "lucide-react";
import {
  createPromo,
  togglePromo,
  deletePromo,
  type AdminResult,
} from "@/app/actions/admin";
import type { PromoRecord } from "@/lib/db/promo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function describe(p: PromoRecord): string {
  if (p.discountType === "plan") return `Offre ${p.grantPlan ?? "—"} offerte`;
  if (p.discountType === "amount") return `−${p.discountValue} €`;
  return `−${p.discountValue} %`;
}

export function AdminPromos({ initial }: { initial: PromoRecord[] }) {
  const [promos, setPromos] = useState(initial);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percent",
    discountValue: "20",
    grantPlan: "pro",
    maxRedemptions: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    start(async () => {
      const res: AdminResult = await createPromo(fd);
      if (res.error) return setError(res.error);
      setForm((f) => ({ ...f, code: "", description: "" }));
      // Rafraîchit la liste depuis le rendu serveur via reload léger
      window.location.reload();
    });
  }

  async function toggle(id: string) {
    setPromos((list) =>
      list.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    );
    await togglePromo(id);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce code promo ?")) return;
    setPromos((list) => list.filter((p) => p.id !== id));
    await deletePromo(id);
  }

  return (
    <div className="space-y-5">
      {/* Création */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <Plus className="size-4 text-muted-foreground" />
          Nouveau code promo
        </h2>
        <form onSubmit={create} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="BIENVENUE20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              >
                <option value="percent">Pourcentage (%)</option>
                <option value="amount">Montant (€)</option>
                <option value="plan">Offre offerte</option>
              </Select>
            </div>
            {form.discountType === "plan" ? (
              <div className="space-y-1.5">
                <Label htmlFor="grantPlan">Offre</Label>
                <Select
                  id="grantPlan"
                  value={form.grantPlan}
                  onChange={(e) => setForm({ ...form, grantPlan: e.target.value })}
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agence</option>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="value">Valeur</Label>
                <Input
                  id="value"
                  type="number"
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm({ ...form, discountValue: e.target.value })
                  }
                  placeholder="20"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description (optionnel)</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Offre de lancement"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">Utilisations max (0 = illimité)</Label>
              <Input
                id="max"
                type="number"
                value={form.maxRedemptions}
                onChange={(e) =>
                  setForm({ ...form, maxRedemptions: e.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" disabled={pending || !form.code.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer le code
          </Button>
        </form>
      </Card>

      {/* Liste */}
      {promos.length === 0 ? (
        <Card className="p-8 text-center">
          <Ticket className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">Aucun code promo.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                  <Ticket className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm font-semibold text-foreground">
                      {p.code}
                    </code>
                    {p.active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="muted">Inactif</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {describe(p)} ·{" "}
                    {p.maxRedemptions > 0
                      ? `${p.redeemedCount}/${p.maxRedemptions} utilisations`
                      : `${p.redeemedCount} utilisations`}
                    {p.description ? ` · ${p.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={p.active ? "Désactiver" : "Activer"}
                  title={p.active ? "Désactiver" : "Activer"}
                >
                  <Power className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
