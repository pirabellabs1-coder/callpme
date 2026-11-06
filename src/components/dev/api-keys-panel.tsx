"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  TriangleAlert,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKeyView[] }) {
  const [keys, setKeys] = useState<ApiKeyView[]>(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const copyRef = useRef<HTMLButtonElement>(null);

  // Move focus to the copy button when a new secret is revealed.
  useEffect(() => {
    if (secret) copyRef.current?.focus();
  }, [secret]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    setCopied(false);
    const res = await fetch("/api/dev/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setKeys((k) => [{ ...data.apiKey, lastUsedAt: null }, ...k]);
      setSecret(data.secret);
      setName("");
    } else {
      setError(data.error ?? "Une erreur est survenue.");
    }
    setCreating(false);
  }

  async function revoke(k: ApiKeyView) {
    if (
      !window.confirm(
        `Révoquer la clé « ${k.name} » ? Les intégrations qui l'utilisent cesseront de fonctionner immédiatement.`,
      )
    )
      return;
    setError(null);
    setRevoking(k.id);
    const res = await fetch(`/api/dev/api-keys/${k.id}`, { method: "DELETE" });
    if (res.ok) setKeys((list) => list.filter((x) => x.id !== k.id));
    else setError("Révocation impossible. Réessayez.");
    setRevoking(null);
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Clés API</h2>
        <p className="text-sm text-muted-foreground">
          Authentifiez vos appels à l&apos;API Callpme avec l&apos;en-tête{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-foreground">
            Authorization: Bearer &lt;clé&gt;
          </code>
          . Chaque clé donne accès aux données de votre organisation : gardez-la côté
          serveur.
        </p>
      </div>

      {/* Newly created secret — shown once */}
      {secret && (
        <div
          role="status"
          className="rounded-xl border border-brand/40 bg-brand-50 p-4"
        >
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Copiez votre clé maintenant
              </p>
              <p className="text-xs text-muted-foreground">
                Elle ne sera plus jamais affichée. En cas de perte, révoquez-la et créez-en
                une nouvelle.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code
              className="min-w-0 flex-1 break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              aria-label="Clé API secrète"
            >
              {secret}
            </code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copySecret} ref={copyRef}>
                {copied ? (
                  <Check className="size-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? "Copiée" : "Copier"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
                J&apos;ai copié ma clé
              </Button>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {copied ? "Clé copiée dans le presse-papiers" : ""}
          </span>
        </div>
      )}

      {/* Creation */}
      <form
        onSubmit={create}
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="api-key-name">Nom de la clé</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Intégration n8n"
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="default" disabled={creating || !name.trim()}>
          {creating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Créer une clé
        </Button>
      </form>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* List */}
      {keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucune clé API"
          description="Créez une clé pour appeler l'API Callpme depuis votre backend, n8n ou Make."
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border"
              >
                <KeyRound className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{k.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  <span className="sr-only">Clé masquée, se termine par </span>
                  <span aria-hidden="true">
                    {k.prefix}
                    {"•".repeat(8)}
                  </span>
                  {k.lastFour}
                </p>
              </div>
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <p>
                  Créée{" "}
                  {formatDistanceToNow(new Date(k.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </p>
                <p>
                  {k.lastUsedAt
                    ? `Utilisée ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: fr })}`
                    : "Jamais utilisée"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(k)}
                disabled={revoking === k.id}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Révoquer la clé ${k.name}`}
              >
                {revoking === k.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
