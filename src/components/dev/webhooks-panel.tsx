"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Send,
  Loader2,
  Check,
  Copy,
} from "lucide-react";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface WebhookView {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
  createdAt: string;
}

export function WebhooksPanel({
  initialWebhooks,
}: {
  initialWebhooks: WebhookView[];
}) {
  const [hooks, setHooks] = useState<WebhookView[]>(initialWebhooks);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["agent.created"]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function toggleEvent(id: string) {
    setEvents((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/dev/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), events }),
    });
    const data = await res.json();
    if (res.ok) {
      setHooks((h) => [data.webhook, ...h]);
      setUrl("");
      setEvents(["agent.created"]);
    } else {
      setError(data.error ?? "Une erreur est survenue.");
    }
    setCreating(false);
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    setHooks((h) => h.map((w) => (w.id === id ? { ...w, enabled } : w)));
    await fetch(`/api/dev/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce webhook ?")) return;
    const res = await fetch(`/api/dev/webhooks/${id}`, { method: "DELETE" });
    if (res.ok) setHooks((h) => h.filter((w) => w.id !== id));
  }

  async function test(id: string) {
    setTesting(id);
    setResults((r) => ({ ...r, [id]: "" }));
    const res = await fetch(`/api/dev/webhooks/${id}/test`, { method: "POST" });
    const data = await res.json();
    setResults((r) => ({
      ...r,
      [id]: data.delivered
        ? `Livré (HTTP ${data.status})`
        : data.status
          ? `Échec (HTTP ${data.status})`
          : "Échec (injoignable)",
    }));
    setHooks((h) =>
      h.map((w) =>
        w.id === id
          ? { ...w, lastStatus: data.status, lastDeliveryAt: new Date().toISOString() }
          : w,
      ),
    );
    setTesting(null);
  }

  function copySecret(secret: string) {
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(secret);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Recevez les événements de la plateforme sur vos endpoints (n8n, Make,
          votre backend…). Chaque livraison est signée HMAC-SHA256.
        </p>
      </div>

      {/* Création */}
      <form onSubmit={create} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            URL de l'endpoint
          </label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://votre-domaine.fr/webhooks/callpme"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Événements
          </label>
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENTS.map((ev) => {
              const on = events.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => toggleEvent(ev.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-brand bg-brand-50/50 text-brand-700"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                  <code className="font-mono">{ev.id}</code>
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          variant="default"
          disabled={creating || !url.trim() || events.length === 0}
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Ajouter le webhook
        </Button>
      </form>

      {/* Liste */}
      {hooks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun webhook configuré.
        </p>
      ) : (
        <div className="space-y-3">
          {hooks.map((w) => (
            <div key={w.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border">
                  <WebhookIcon className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-foreground">
                    {w.url}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.events.map((e) => (
                      <span
                        key={e}
                        className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <Switch
                  checked={w.enabled}
                  onCheckedChange={(v) => toggleEnabled(w.id, v)}
                  aria-label="Activer le webhook"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Secret
                </span>
                <code className="flex-1 truncate font-mono text-xs text-foreground/70">
                  {w.secret}
                </code>
                <button
                  type="button"
                  onClick={() => copySecret(w.secret)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copier le secret"
                >
                  {copied === w.secret ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusPill status={w.lastStatus} />
                  {w.lastDeliveryAt && (
                    <span>
                      ·{" "}
                      {formatDistanceToNow(new Date(w.lastDeliveryAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  )}
                  {results[w.id] && (
                    <span className="font-medium text-foreground">
                      · {results[w.id]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => test(w.id)}
                    disabled={testing === w.id}
                  >
                    {testing === w.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Tester
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(w.id)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="text-muted-foreground">Jamais déclenché</span>;
  }
  const okStatus = status >= 200 && status < 300;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        okStatus ? "text-emerald-600" : "text-destructive",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          okStatus ? "bg-emerald-500" : "bg-destructive",
        )}
      />
      {status === 0 ? "Injoignable" : `HTTP ${status}`}
    </span>
  );
}
