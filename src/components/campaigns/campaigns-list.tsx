"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, Loader2, Check, ArrowRight } from "lucide-react";
import type { CampaignRecord } from "@/lib/db/campaigns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: "muted" | "brand" | "success" }> = {
  draft: { label: "Brouillon", variant: "muted" },
  running: { label: "En cours", variant: "brand" },
  paused: { label: "En pause", variant: "muted" },
  completed: { label: "Terminée", variant: "success" },
};

export function CampaignsList({
  initial,
  agents,
}: {
  initial: CampaignRecord[];
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [campaigns] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", agentId: agents[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) router.push(`/campaigns/${data.campaign.id}`);
    else {
      setError(data.error ?? "Erreur");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          variant="brand"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          disabled={agents.length === 0}
        >
          <Plus className="size-4" />
          Nouvelle campagne
        </Button>
      </div>

      {agents.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">
          Créez d'abord un agent (idéalement de rôle « Vente sortante ») pour
          lancer une campagne.
        </Card>
      )}

      {open && (
        <Card className="p-5">
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom de la campagne</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Relance clients janvier"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Agent</label>
              <Select
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="brand" disabled={busy || !form.name.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Créer
              </Button>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </Card>
      )}

      {campaigns.length === 0 ? (
        <Card className="p-10 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Aucune campagne</p>
          <p className="text-sm text-muted-foreground">
            Importez une liste de contacts et laissez l'agent les appeler.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.total > 0 ? Math.round((c.called / c.total) * 100) : 0;
            const st = STATUS[c.status] ?? STATUS.draft;
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                      <Megaphone className="size-5" strokeWidth={1.75} />
                    </span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                    {c.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{c.agentName}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular">
                      {c.called}/{c.total} appelés
                    </span>
                    <span className="inline-flex items-center gap-1 text-brand">
                      Ouvrir <ArrowRight className="size-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
