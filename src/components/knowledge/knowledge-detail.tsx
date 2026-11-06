"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  FileUp,
  Link2,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Globe,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { DocRecord } from "@/lib/db/knowledge";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** Limites côté API (POST /api/knowledge/:id/documents). */
const MAX_CHARS = 400_000;
const MAX_FILE_MB = 10;

type Mode = "text" | "file" | "url" | "site";

const MODES: { key: Mode; label: string; icon: LucideIcon }[] = [
  { key: "file", label: "Fichier (PDF…)", icon: FileUp },
  { key: "site", label: "Site entier", icon: Globe },
  { key: "url", label: "Une page web", icon: Link2 },
  { key: "text", label: "Texte", icon: FileText },
];

const SOURCE_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
  text: { label: "Texte", icon: FileText },
  url: { label: "Page web", icon: Link2 },
  site: { label: "Site", icon: Globe },
  pdf: { label: "PDF", icon: FileText },
  file: { label: "Fichier", icon: FileUp },
};

interface Hit {
  documentId: string;
  title: string;
  content: string;
}

export function KnowledgeDetail({
  kb,
}: {
  kb: {
    id: string;
    name: string;
    description: string | null;
    createdAt?: string;
    documents: DocRecord[];
  };
}) {
  const router = useRouter();
  const ids = useId();
  const [docs, setDocs] = useState(kb.documents);
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [semantic, setSemantic] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const usesContent = mode === "text";
  const tooLong = usesContent && content.length > MAX_CHARS;
  const canSubmit =
    !busy &&
    !tooLong &&
    (mode === "text" ? content.trim().length > 0 : mode === "file" ? file !== null : url.trim().length > 0);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (${MAX_FILE_MB} Mo maximum).`);
      return;
    }
    setError(null);
    setFile(picked);
    setFileName(picked.name);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let res: Response;
      if (mode === "file" && file) {
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        res = await fetch(`/api/knowledge/${kb.id}/documents`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/knowledge/${kb.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "text"
              ? { source: "text", title: title.trim() || "Document", content }
              : { source: mode, url: url.trim(), title: title.trim() || undefined },
          ),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const added: DocRecord[] = data.documents ?? [data.document];
        setDocs((d) => [...added, ...d]);
        const passages = added.reduce((n, x) => n + (x.chunkCount ?? 0), 0);
        setNotice(
          added.length > 1
            ? `${added.length} pages importées (${passages} passages indexés).`
            : `« ${added[0].title} » a été ajouté (${passages} passage${passages > 1 ? "s" : ""} indexé${passages > 1 ? "s" : ""}).`,
        );
        setTitle("");
        setContent("");
        setUrl("");
        setFile(null);
        setFileName(null);
        router.refresh();
      } else {
        setError(
          data.error === "Données invalides" && (mode === "url" || mode === "site")
            ? "Adresse invalide : saisissez une URL complète (https://…)."
            : (data.error ?? "L'ajout du document a échoué."),
        );
      }
    } catch {
      setError("Erreur réseau : vérifiez votre connexion et réessayez.");
    }
    setBusy(false);
  }

  async function remove(doc: DocRecord) {
    if (!window.confirm(`Supprimer le document « ${doc.title} » ?`)) return;
    setDeleting(doc.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((d) => d.filter((x) => x.id !== doc.id));
        setNotice(`« ${doc.title} » a été supprimé.`);
        router.refresh();
      } else setError("Suppression du document impossible.");
    } catch {
      setError("Erreur réseau pendant la suppression.");
    }
    setDeleting(null);
  }

  async function removeBase() {
    if (
      !window.confirm(
        `Supprimer la base « ${kb.name} » et ses ${docs.length} document(s) ? Les agents qui l'utilisent n'y auront plus accès.`,
      )
    )
      return;
    setDeleting("kb");
    setError(null);
    try {
      const res = await fetch(`/api/knowledge/${kb.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/knowledge");
        router.refresh();
        return;
      }
      setError("Suppression de la base impossible.");
    } catch {
      setError("Erreur réseau pendant la suppression.");
    }
    setDeleting(null);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/${kb.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setHits(res.ok ? (data.hits ?? []) : []);
      setSemantic(res.ok ? Boolean(data.semantic) : null);
    } catch {
      setHits([]);
    }
    setSearching(false);
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

  return (
    <div className="space-y-6">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Bases de connaissances
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
            <BookOpen className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-display-sm font-semibold tracking-tight">{kb.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {kb.description || "Sans description"}
              {" · "}
              {docs.length} document{docs.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={removeBase}
          disabled={deleting !== null}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {deleting === "kb" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          Supprimer la base
        </Button>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {!error && notice && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-600/25 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </p>
        )}
      </div>

      {/* Ajout */}
      <Card className="p-5">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Ajouter du contenu</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          L'agent s'appuie sur ces contenus pour répondre pendant l'appel.
        </p>
        <div
          role="group"
          aria-label="Type de contenu"
          className="mt-3 inline-flex flex-wrap rounded-lg border border-border bg-muted/60 p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => switchMode(m.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
                mode === m.key
                  ? "bg-card text-foreground shadow-xs ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <m.icon className="size-4" aria-hidden /> {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={add} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-title`} className="text-xs text-muted-foreground">
              Titre <span className="font-normal">(facultatif)</span>
            </Label>
            <Input
              id={`${ids}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "url" ? "Repris de la page si vide" : "Ex. : Tarifs 2026"}
              maxLength={160}
            />
          </div>

          {mode === "url" || mode === "site" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-url`} className="text-xs text-muted-foreground">
                Adresse de la page
              </Label>
              <Input
                id={`${ids}-url`}
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={mode === "site" ? "https://votre-site.fr" : "https://votre-site.fr/faq"}
                maxLength={500}
                required
                aria-describedby={`${ids}-url-help`}
              />
              <p id={`${ids}-url-help`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                {mode === "site"
                  ? "Callpme parcourt jusqu'à 25 pages publiques du même site (2 niveaux de liens) et importe leur texte. Comptez jusqu'à une minute."
                  : "Seul le texte de cette page est extrait (pas les sous-pages). La page doit être publique et répondre en moins de 10 secondes."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {mode === "file" ? (
                <div className="flex flex-wrap items-center gap-3 pb-1">
                  <label
                    htmlFor={`${ids}-file`}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/55"
                  >
                    <FileUp className="size-3.5" aria-hidden />
                    Choisir un fichier (PDF, TXT, MD, CSV)
                    <input
                      id={`${ids}-file`}
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv"
                      onChange={onFile}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {fileName ?? `${MAX_FILE_MB} Mo maximum. PDF avec du texte sélectionnable (pas un scan).`}
                  </span>
                </div>
              ) : (
              <>
              <Label htmlFor={`${ids}-content`} className="text-xs text-muted-foreground">
                Contenu
              </Label>
              <Textarea
                id={`${ids}-content`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder="Collez ici le contenu (FAQ, conditions, fiche produit, horaires…)"
                aria-describedby={`${ids}-count`}
                aria-invalid={tooLong || undefined}
              />
              <p
                id={`${ids}-count`}
                className={cn("text-right text-xs tabular", tooLong ? "text-destructive" : "text-muted-foreground")}
              >
                {content.length.toLocaleString("fr-FR")} / {MAX_CHARS.toLocaleString("fr-FR")} caractères
                {tooLong && " — raccourcissez ou découpez en plusieurs documents"}
              </p>
              </>
              )}
            </div>
          )}

          <Button type="submit" variant="brand" disabled={!canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {busy
              ? mode === "site"
                ? "Exploration du site…"
                : mode === "url"
                  ? "Récupération de la page…"
                  : mode === "file"
                    ? "Lecture du fichier…"
                    : "Ajout…"
              : mode === "site"
                ? "Importer le site"
                : mode === "url"
                  ? "Importer la page"
                  : "Ajouter le document"}
          </Button>
        </form>
      </Card>

      {/* Tester une question */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <Search className="size-4 text-muted-foreground" aria-hidden /> Tester une question
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Voyez quels passages l&apos;agent retrouverait pour répondre à un appelant.
        </p>
        <form onSubmit={ask} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Label htmlFor={`${ids}-q`} className="sr-only">
            Question d&apos;un appelant
          </Label>
          <Input
            id={`${ids}-q`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. : Quels sont vos horaires le samedi ?"
            maxLength={500}
          />
          <Button type="submit" variant="outline" disabled={searching || question.trim().length < 2}>
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Chercher
          </Button>
        </form>
        <div aria-live="polite">
          {hits && hits.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun passage trouvé. L&apos;agent dira qu&apos;il n&apos;a pas l&apos;information et proposera de prendre un message.
            </p>
          )}
          {hits && hits.length > 0 && (
            <ol className="mt-3 space-y-2">
              {hits.map((h, i) => (
                <li key={`${h.documentId}-${i}`} className="rounded-lg border border-border bg-foreground/[0.02] p-3">
                  <p className="text-xs font-medium text-foreground">
                    {i + 1}. {h.title}
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-muted-foreground">{h.content}</p>
                </li>
              ))}
            </ol>
          )}
          {semantic === false && hits !== null && (
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Recherche par mots (français). Ajoutez une clé OpenAI côté serveur pour la recherche par le sens.
            </p>
          )}
        </div>
      </Card>

      {/* Documents */}
      <section aria-labelledby={`${ids}-docs`} className="space-y-3">
        <h2 id={`${ids}-docs`} className="text-[0.95rem] font-semibold tracking-tight">
          Documents
        </h2>
        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun document pour l'instant"
            description="Ajoutez une FAQ, vos tarifs ou l'URL d'une page de votre site : l'agent pourra s'en servir dès l'ajout."
            className="py-10"
          />
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => {
              const src = SOURCE_LABEL[d.source] ?? SOURCE_LABEL.text;
              return (
                <li key={d.id}>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border">
                        <src.icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                          <Badge variant="muted">{src.label}</Badge>
                          {d.status === "error" || d.chunkCount === 0 ? (
                            <Badge variant="warning">Aucun texte indexé</Badge>
                          ) : (
                            <Badge variant="success">
                              <CheckCircle2 aria-hidden />
                              {d.chunkCount ? `${d.chunkCount} passage${d.chunkCount > 1 ? "s" : ""}` : "Disponible"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.content}</p>
                        <p className="mt-1.5 truncate text-[0.7rem] text-muted-foreground/80">
                          Ajouté le {fmtDate(d.createdAt)}
                          {d.origin ? ` · ${d.origin}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(d)}
                        disabled={deleting !== null}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Supprimer le document « ${d.title} »`}
                      >
                        {deleting === d.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
