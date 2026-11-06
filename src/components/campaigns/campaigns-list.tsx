"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Loader2,
  Check,
  ArrowRight,
  AlertCircle,
  Bot,
  Upload,
  Play,
  BarChart3,
} from "lucide-react";
import type { CampaignRecord } from "@/lib/db/campaigns";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignStatusBadge, ProgressBar } from "./campaign-ui";

const STEPS = [
  { icon: Bot, title: "Choisissez un agent", text: "idéalement de rôle « Vente sortante » ou « Enquête »." },
  { icon: Upload, title: "Importez vos contacts", text: "collez ou chargez un CSV nom, téléphone." },
  { icon: Play, title: "Lancez", text: "l'agent appelle chaque contact et note l'issue." },
  { icon: BarChart3, title: "Suivez les résultats", text: "intéressés, à rappeler, sans réponse…" },
];

export function CampaignsList({
  initial,
  agents,
}: {
  initial: CampaignRecord[];
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const ids = useId();
  const campaigns = initial;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", agentId: agents[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/campaigns/${data.campaign.id}`);
        return;
      }
      setError(data.error ?? "La création de la campagne a échoué.");
    } catch {
      setError("Erreur réseau : vérifiez votre connexion et réessayez.");
    }
    setBusy(false);
  }

  const noAgent = agents.length === 0;
  const running = campaigns.filter((c) => c.status === "running").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {campaigns.length > 0 && (
            <>
              <span className="tabular font-medium text-foreground">{campaigns.length}</span>{" "}
              campagne{campaigns.length > 1 ? "s" : ""}
              {running > 0 && <> · {running} en cours</>}
            </>
          )}
        </p>
        <Button
          variant="brand"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          disabled={noAgent}
          aria-expanded={open}
          aria-controls={`${ids}-form`}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle campagne
        </Button>
      </div>

      {noAgent && (
        <Card className="flex flex-col gap-3 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Une campagne a besoin d'un agent pour passer les appels. Créez-en un
            d'abord — idéalement de rôle « Vente sortante ».
          </p>
          <Link href="/agents/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Bot className="size-4" aria-hidden />
            Créer un agent
          </Link>
        </Card>
      )}

      {open && !noAgent && (
        <Card className="p-5" id={`${ids}-form`}>
          <form
            onSubmit={create}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
            aria-describedby={error ? `${ids}-error` : undefined}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-name`} className="text-xs text-muted-foreground">
                Nom de la campagne
              </Label>
              <Input
                id={`${ids}-name`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Relance clients janvier"
                maxLength={80}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-agent`} className="text-xs text-muted-foreground">
                Agent qui appelle
              </Label>
              <Select
                id={`${ids}-agent`}
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
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {busy ? "Création…" : "Créer"}
              </Button>
            </div>
          </form>
          {error && (
            <p
              id={`${ids}-error`}
              role="alert"
              className="mt-3 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </Card>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Aucune campagne pour l'instant"
          description="Une campagne, c'est une série d'appels sortants passés automatiquement par l'un de vos agents à une liste de contacts : relances, prises de rendez-vous, enquêtes de satisfaction…"
          action={
            <ol className="grid max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border">
                    <s.icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {i + 1}. {s.title}
                    </span>{" "}
                    — {s.text}
                  </p>
                </li>
              ))}
            </ol>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.total > 0 ? Math.round((c.called / c.total) * 100) : 0;
            const created = new Date(c.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris",
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <li key={c.id} className="flex">
                <Link
                  href={`/campaigns/${c.id}`}
                  className="group flex w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Card className="flex w-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                        <Megaphone className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                      {c.name}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.agentName} · créée le {created}
                    </p>
                    {c.total === 0 ? (
                      <p className="mt-3 flex-1 text-xs text-muted-foreground">
                        Aucun contact importé — ouvrez la campagne pour ajouter votre liste.
                      </p>
                    ) : (
                      <div className="mt-3 flex-1">
                        <ProgressBar value={pct} label={`Progression de ${c.name}`} />
                        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <dt className="text-muted-foreground">Contacts</dt>
                            <dd className="tabular font-medium text-foreground">{c.total}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Appelés</dt>
                            <dd className="tabular font-medium text-foreground">
                              {c.called} <span className="text-muted-foreground">({pct}%)</span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Joints</dt>
                            <dd className="tabular font-medium text-foreground">{c.completed}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand">
                      Ouvrir <ArrowRight className="size-3" aria-hidden />
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
