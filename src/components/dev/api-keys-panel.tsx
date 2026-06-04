"use client";

import { useState } from "react";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/dev/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setKeys((k) => [{ ...data.apiKey, lastUsedAt: null }, ...k]);
      setSecret(data.secret);
      setName("");
    } else {
      setError(data.error ?? "Une erreur est survenue.");
    }
    setCreating(false);
  }

  async function revoke(id: string) {
    if (
      !window.confirm(
        "Révoquer cette clé ? Les intégrations qui l'utilisent cesseront de fonctionner.",
      )
    )
      return;
    const res = await fetch(`/api/dev/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys((k) => k.filter((x) => x.id !== id));
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Clés API</h2>
        <p className="text-sm text-muted-foreground">
          Authentifiez vos appels à l'API Callpme avec une clé secrète.
        </p>
      </div>

      {/* Secret nouvellement créé */}
      {secret && (
        <div className="rounded-xl border border-brand/30 bg-brand-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Copiez votre clé maintenant
                </p>
                <p className="text-xs text-muted-foreground">
                  Pour des raisons de sécurité, elle ne sera plus jamais affichée.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <code className="flex-1 truncate font-mono text-sm text-foreground">
              {secret}
            </code>
            <Button size="sm" variant="outline" onClick={copySecret}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        </div>
      )}

      {/* Création */}
      <form onSubmit={create} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Nom de la clé
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Intégration n8n"
            maxLength={60}
          />
        </div>
        <Button type="submit" variant="default" disabled={creating || !name.trim()}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Créer une clé
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Liste */}
      {keys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune clé API. Créez-en une pour commencer.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border">
                <KeyRound className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {k.name}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {k.prefix}
                  {"•".repeat(8)}
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
                onClick={() => revoke(k.id)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                aria-label="Révoquer"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
