"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Upload,
  Loader2,
  Megaphone,
  Trash2,
  AlertCircle,
} from "lucide-react";
import type { ContactRecord } from "@/lib/db/campaigns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const CONTACT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "text-muted-foreground" },
  calling: { label: "En cours", cls: "text-brand" },
  completed: { label: "Appelé", cls: "text-emerald-600" },
  no_answer: { label: "Sans réponse", cls: "text-amber-600" },
  failed: { label: "Échec", cls: "text-destructive" },
  opted_out: { label: "Opposition", cls: "text-destructive" },
};

const CAMPAIGN_STATUS: Record<
  string,
  { label: string; variant: "muted" | "brand" | "warning" | "success" }
> = {
  draft: { label: "Brouillon", variant: "muted" },
  running: { label: "En cours", variant: "brand" },
  paused: { label: "En pause", variant: "warning" },
  completed: { label: "Terminée", variant: "success" },
};

export function CampaignDetail({
  campaign,
}: {
  campaign: {
    id: string;
    name: string;
    status: string;
    agentName: string;
    contacts: ContactRecord[];
  };
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(campaign.contacts.length === 0);

  const total = campaign.contacts.length;
  const called = campaign.contacts.filter((c) => c.status !== "pending").length;
  const pct = total > 0 ? Math.round((called / total) * 100) : 0;
  const st = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  const paused = campaign.status === "paused";
  const done = campaign.status === "completed";

  async function importContacts() {
    const contacts = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        if (parts.length >= 2) return { name: parts[0], phone: parts[1] };
        return { name: "Contact", phone: parts[0] };
      })
      .filter((c) => /\d/.test(c.phone))
      .filter((c) => !/nom|name|t[ée]l|phone/i.test(c.phone));
    if (contacts.length === 0) {
      setError("Aucun contact valide détecté (format : nom, téléphone).");
      return;
    }
    setImporting(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaign.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    });
    if (res.ok) {
      setCsv("");
      setShowImport(false);
      router.refresh();
    } else {
      setError("Échec de l'import des contacts.");
    }
    setImporting(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function run() {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaign.id}/run`, { method: "POST" });
    if (!res.ok) setError("Le lancement de la campagne a échoué.");
    router.refresh();
    setRunning(false);
  }

  async function setStatus(status: string) {
    setWorking(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
    else setError("Action impossible.");
    setWorking(false);
  }

  async function remove() {
    if (!window.confirm("Supprimer cette campagne et tous ses contacts ?")) return;
    setWorking(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/campaigns");
      router.refresh();
    } else {
      setError("Suppression impossible.");
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Campagnes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
            <Megaphone className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-display-sm font-semibold tracking-tight">{campaign.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Agent : {campaign.agentName}</span>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
            <Upload className="size-4" />
            Importer
          </Button>
          {!done &&
            (paused ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("draft")}
                disabled={working}
              >
                <Play className="size-4" />
                Reprendre
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("paused")}
                disabled={working || total === 0}
              >
                <Pause className="size-4" />
                Mettre en pause
              </Button>
            ))}
          <Button
            variant="outline"
            size="sm"
            onClick={remove}
            disabled={working}
            className="text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
          <Button
            variant="brand"
            onClick={run}
            disabled={running || total === 0 || called === total || paused}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {called > 0 && called < total ? "Continuer" : "Lancer la campagne"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Progression */}
      <Card className="p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progression</span>
          <span className="tabular text-muted-foreground">
            {called}/{total} contacts · {pct}%
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Import */}
      {showImport && (
        <Card className="p-5">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Importer des contacts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Collez vos contacts au format{" "}
            <code className="font-mono text-xs">nom, téléphone</code> (une ligne par
            contact), ou importez un fichier CSV.
          </p>
          <div className="mt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60">
              <Upload className="size-3.5" />
              Choisir un fichier CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={onFile}
                className="hidden"
              />
            </label>
          </div>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className="mt-3 font-mono text-xs"
            placeholder={"Marie Durand, +33 6 12 34 56 78\nPaul Martin, +33 6 98 76 54 32"}
          />
          <Button
            variant="default"
            className="mt-3"
            onClick={importContacts}
            disabled={importing || !csv.trim()}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Importer les contacts
          </Button>
        </Card>
      )}

      {/* Contacts */}
      {total > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {total} contacts
          </div>
          <div className="divide-y divide-border">
            {campaign.contacts.map((c) => {
              const cs = CONTACT_STATUS[c.status] ?? CONTACT_STATUS.pending;
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="mono truncate text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  {c.outcome && (
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {c.outcome}
                    </span>
                  )}
                  <span className={cn("text-xs font-medium", cs.cls)}>{cs.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
