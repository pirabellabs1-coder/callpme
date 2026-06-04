"use client";

import { useState } from "react";
import { Building2, Plus, Trash2, Loader2, Check, Bot, Mail } from "lucide-react";
import type { ClientRecord } from "@/lib/db/clients";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";

export function ClientsManager({ initial }: { initial: ClientRecord[] }) {
  const [clients, setClients] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [form, setForm] = useState({ name: "", brandColor: "#E8572A", contactEmail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setClients((c) => [...c, data.client]);
      setForm({ name: "", brandColor: "#E8572A", contactEmail: "" });
      setOpen(false);
    } else setError(data.error ?? "Erreur");
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce client ? Ses agents seront détachés.")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) setClients((c) => c.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="brand" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          Nouveau client
        </Button>
      </div>

      {open && (
        <Card className="p-5">
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom du client</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cabinet Dupont"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">E-mail de contact</label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="contact@client.fr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Couleur (marque blanche)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-card"
                />
                <Button type="submit" variant="brand" className="flex-1" disabled={busy || !form.name.trim()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Créer
                </Button>
              </div>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </Card>
      )}

      {clients.length === 0 ? (
        <Card className="p-10 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Aucun client</p>
          <p className="text-sm text-muted-foreground">
            Créez un sous-compte par client de votre agence.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <span
                  className="inline-flex size-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
                  style={{ background: c.brandColor || "#0A0A0A" }}
                >
                  {initials(c.name)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                {c.name}
              </h3>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="inline-flex items-center gap-1.5">
                  <Bot className="size-3.5" /> {c.agentCount} agent{c.agentCount > 1 ? "s" : ""}
                </p>
                {c.contactEmail && (
                  <p className="inline-flex items-center gap-1.5 truncate">
                    <Mail className="size-3.5" /> {c.contactEmail}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
