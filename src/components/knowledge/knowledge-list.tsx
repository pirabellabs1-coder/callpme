"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, Loader2, Check, FileText, Bot } from "lucide-react";
import type { KbRecord } from "@/lib/db/knowledge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function KnowledgeList({ initial }: { initial: KbRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(initial.length === 0);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) router.push(`/knowledge/${data.kb.id}`);
    else setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="brand" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          Nouvelle base
        </Button>
      </div>

      {open && (
        <Card className="p-5">
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="FAQ produit"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Questions fréquentes, tarifs, conditions…"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="brand" disabled={busy || !form.name.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Créer
              </Button>
            </div>
          </form>
        </Card>
      )}

      {initial.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Aucune base de connaissances</p>
          <p className="text-sm text-muted-foreground">
            Donnez à vos agents des documents pour répondre avec précision.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {initial.map((kb) => (
            <Link key={kb.id} href={`/knowledge/${kb.id}`}>
              <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                  <BookOpen className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                  {kb.name}
                </h3>
                {kb.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">{kb.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3.5" /> {kb.docCount} doc{kb.docCount > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="size-3.5" /> {kb.agentCount} agent{kb.agentCount > 1 ? "s" : ""}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
