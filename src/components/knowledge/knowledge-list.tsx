"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Loader2,
  Check,
  FileText,
  Bot,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { KbRecord } from "@/lib/db/knowledge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

export function KnowledgeList({ initial }: { initial: KbRecord[] }) {
  const router = useRouter();
  const ids = useId();
  const [open, setOpen] = useState(initial.length === 0);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/knowledge/${data.kb.id}`);
        return;
      }
      setError(data.error ?? "La création de la base a échoué.");
    } catch {
      setError("Erreur réseau : vérifiez votre connexion et réessayez.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {initial.length > 0 && (
            <>
              <span className="tabular font-medium text-foreground">{initial.length}</span>{" "}
              base{initial.length > 1 ? "s" : ""}
            </>
          )}
        </p>
        <Button
          variant="brand"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${ids}-form`}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle base
        </Button>
      </div>

      {open && (
        <Card className="p-5" id={`${ids}-form`}>
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-name`} className="text-xs text-muted-foreground">
                Nom
              </Label>
              <Input
                id={`${ids}-name`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="FAQ produit"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-desc`} className="text-xs text-muted-foreground">
                Description <span className="font-normal">(facultatif)</span>
              </Label>
              <Input
                id={`${ids}-desc`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Questions fréquentes, tarifs, conditions…"
                maxLength={300}
              />
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
            <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </Card>
      )}

      {initial.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune base de connaissances"
          description="Une base regroupe les documents (FAQ, tarifs, conditions, pages de votre site) que vos agents consultent pendant l'appel pour répondre avec précision. Créez-en une, ajoutez du contenu, puis rattachez-la à un agent."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {initial.map((kb) => (
            <li key={kb.id} className="flex">
              <Link
                href={`/knowledge/${kb.id}`}
                className="group flex w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="flex w-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                    <BookOpen className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                    {kb.name}
                  </h3>
                  <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">
                    {kb.description || "Sans description"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5" aria-hidden /> {kb.docCount} document
                      {kb.docCount > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Bot className="size-3.5" aria-hidden />
                      {kb.agentCount === 0
                        ? "Aucun agent rattaché"
                        : `${kb.agentCount} agent${kb.agentCount > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {kb.docCount === 0 && (
                    <p className="mt-2 text-xs text-amber-600">Vide — ajoutez un premier document.</p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand">
                    Ouvrir <ArrowRight className="size-3" aria-hidden />
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
