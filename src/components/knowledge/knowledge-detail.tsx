"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Link2,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import type { DocRecord } from "@/lib/db/knowledge";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function KnowledgeDetail({
  kb,
}: {
  kb: { id: string; name: string; description: string | null; documents: DocRecord[] };
}) {
  const [docs, setDocs] = useState(kb.documents);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/knowledge/${kb.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "url"
          ? { source: "url", url, title: title || undefined }
          : { source: "text", title: title || "Document", content },
      ),
    });
    const data = await res.json();
    if (res.ok) {
      setDocs((d) => [data.document, ...d]);
      setTitle("");
      setContent("");
      setUrl("");
    } else setError(data.error ?? "Erreur");
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Bases de connaissances
      </Link>

      <div className="flex items-center gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
          <BookOpen className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-display-sm font-semibold tracking-tight">{kb.name}</h1>
          {kb.description && (
            <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p>
          )}
        </div>
      </div>

      {/* Ajout */}
      <Card className="p-5">
        <div className="mb-3 inline-flex rounded-lg border border-border bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "text" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
            )}
          >
            <FileText className="size-4" /> Texte
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "url" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
            )}
          >
            <Link2 className="size-4" /> URL
          </button>
        </div>
        <form onSubmit={add} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du document (optionnel)"
          />
          {mode === "text" ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Collez ici le contenu (FAQ, conditions, fiche produit…)"
            />
          ) : (
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://votre-site.fr/faq"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            variant="brand"
            disabled={busy || (mode === "text" ? !content.trim() : !url.trim())}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {mode === "url" ? "Importer l'URL" : "Ajouter le document"}
          </Button>
        </form>
      </Card>

      {/* Documents */}
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document pour l'instant.</p>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border">
                  {d.source === "url" ? (
                    <Link2 className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{d.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
