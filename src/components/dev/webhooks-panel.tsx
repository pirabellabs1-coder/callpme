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
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { CodeBlock } from "./code-block";

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

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  WEBHOOK_EVENTS.map((e) => [e.id, e.label]),
);

// Mirrors src/lib/webhooks/dispatch.ts (signPayload + headers).
const VERIFY_SNIPPET = `import crypto from "node:crypto";

// rawBody : le corps HTTP brut (chaîne), AVANT tout JSON.parse
function isValid(rawBody, header, secret) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// isValid(rawBody, req.headers["x-callpme-signature"], process.env.CALLPME_WEBHOOK_SECRET)`;

function maskSecret(secret: string) {
  return secret.length > 8 ? `${secret.slice(0, 4)}${"•".repeat(16)}${secret.slice(-4)}` : "•".repeat(12);
}

export function WebhooksPanel({
  initialWebhooks,
}: {
  initialWebhooks: WebhookView[];
}) {
  const [hooks, setHooks] = useState<WebhookView[]>(initialWebhooks);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["call.completed"]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

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
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setHooks((h) => [data.webhook, ...h]);
      setUrl("");
      setEvents(["call.completed"]);
    } else {
      setError(data.error ?? "Une erreur est survenue.");
    }
    setCreating(false);
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    setListError(null);
    setHooks((h) => h.map((w) => (w.id === id ? { ...w, enabled } : w)));
    const res = await fetch(`/api/dev/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    if (!res?.ok) {
      // Roll back the optimistic update.
      setHooks((h) => h.map((w) => (w.id === id ? { ...w, enabled: !enabled } : w)));
      setListError("Impossible de modifier l'état du webhook. Réessayez.");
    }
  }

  async function remove(w: WebhookView) {
    if (!window.confirm(`Supprimer le webhook vers ${w.url} ?`)) return;
    setListError(null);
    const res = await fetch(`/api/dev/webhooks/${w.id}`, { method: "DELETE" });
    if (res.ok) setHooks((h) => h.filter((x) => x.id !== w.id));
    else setListError("Suppression impossible. Réessayez.");
  }

  async function test(id: string) {
    setTesting(id);
    setResults((r) => ({ ...r, [id]: "" }));
    const res = await fetch(`/api/dev/webhooks/${id}/test`, { method: "POST" }).catch(
      () => null,
    );
    const data = res ? await res.json().catch(() => ({})) : {};
    setResults((r) => ({
      ...r,
      [id]: data.delivered
        ? `Événement de test livré (HTTP ${data.status})`
        : data.status
          ? `Échec de livraison (HTTP ${data.status})`
          : "Échec : endpoint injoignable",
    }));
    if (res?.ok && typeof data.status === "number") {
      setHooks((h) =>
        h.map((w) =>
          w.id === id
            ? { ...w, lastStatus: data.status, lastDeliveryAt: new Date().toISOString() }
            : w,
        ),
      );
    }
    setTesting(null);
  }

  function copySecret(id: string, secret: string) {
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Recevez les événements de la plateforme sur vos endpoints (n8n, Make, votre
          backend…). Chaque livraison est une requête <code className="font-mono text-xs">POST</code>{" "}
          JSON signée HMAC-SHA256, avec un délai d&apos;attente de 5 secondes.
        </p>
      </div>

      {/* Creation */}
      <form onSubmit={create} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="webhook-url">URL de l&apos;endpoint</Label>
          <Input
            id="webhook-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://votre-domaine.fr/webhooks/callpme"
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground/90">
            Événements à recevoir
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WEBHOOK_EVENTS.map((ev) => {
              const on = events.includes(ev.id);
              return (
                <label
                  key={ev.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/55",
                    on
                      ? "border-brand/50 bg-brand-50"
                      : "border-border bg-card hover:bg-accent/50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleEvent(ev.id)}
                    className="size-4 shrink-0 accent-[hsl(var(--brand))]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{ev.label}</span>
                    <code className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                      {ev.id}
                    </code>
                  </span>
                </label>
              );
            })}
          </div>
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">Sélectionnez au moins un événement.</p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="default"
          disabled={creating || !url.trim() || events.length === 0}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Ajouter le webhook
        </Button>
      </form>

      {listError && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {listError}
        </p>
      )}

      {/* List */}
      {hooks.length === 0 ? (
        <EmptyState
          icon={WebhookIcon}
          title="Aucun webhook configuré"
          description="Ajoutez une URL ci-dessus pour recevoir les événements choisis."
          className="py-10"
        />
      ) : (
        <ul className="space-y-3">
          {hooks.map((w) => {
            const show = revealed[w.id];
            return (
              <li key={w.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border"
                  >
                    <WebhookIcon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-mono text-sm text-foreground">{w.url}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Événements abonnés">
                      {w.events.map((e) => (
                        <li
                          key={e}
                          title={EVENT_LABELS[e]}
                          className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground sm:inline" aria-hidden="true">
                      {w.enabled ? "Actif" : "En pause"}
                    </span>
                    <Switch
                      checked={w.enabled}
                      onCheckedChange={(v) => toggleEnabled(w.id, v)}
                      aria-label={`Activer le webhook ${w.url}`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
                  <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Secret de signature
                  </span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
                    {show ? w.secret : maskSecret(w.secret)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => ({ ...r, [w.id]: !r[w.id] }))}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={show ? "Masquer le secret" : "Afficher le secret"}
                    aria-pressed={show ?? false}
                  >
                    {show ? (
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copySecret(w.id, w.secret)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Copier le secret de signature"
                  >
                    {copied === w.id ? (
                      <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <span className="sr-only" aria-live="polite">
                    {copied === w.id ? "Secret copié dans le presse-papiers" : ""}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div
                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                    aria-live="polite"
                  >
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
                      <span className="font-medium text-foreground">· {results[w.id]}</span>
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
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="size-4" aria-hidden="true" />
                      )}
                      Envoyer un test
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(w)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Supprimer le webhook ${w.url}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Signature verification */}
      <section
        aria-labelledby="webhook-signing-title"
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 id="webhook-signing-title" className="text-sm font-semibold text-foreground">
              Vérifier la signature
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
              Chaque requête porte l&apos;en-tête{" "}
              <code className="font-mono text-xs text-foreground">X-Callpme-Signature</code>{" "}
              (<code className="font-mono text-xs">sha256=</code> suivi du HMAC-SHA256
              hexadécimal du corps brut, calculé avec le secret du webhook) et{" "}
              <code className="font-mono text-xs text-foreground">X-Callpme-Event</code>.
              Le corps contient <code className="font-mono text-xs">event</code>,{" "}
              <code className="font-mono text-xs">data</code> et{" "}
              <code className="font-mono text-xs">timestamp</code>. Rejetez toute requête
              dont la signature ne correspond pas.
            </p>
          </div>
        </div>
        <CodeBlock code={VERIFY_SNIPPET} language="javascript" />
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="text-muted-foreground">Aucune livraison pour l&apos;instant</span>;
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
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", okStatus ? "bg-emerald-600" : "bg-destructive")}
      />
      Dernière livraison : {status === 0 ? "injoignable" : `HTTP ${status}`}
    </span>
  );
}
