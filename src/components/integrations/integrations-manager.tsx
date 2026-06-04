"use client";

import { useState } from "react";
import { Check, Loader2, Plug, ExternalLink, X } from "lucide-react";
import {
  INTEGRATION_CATALOG,
  getIntegration,
  type IntegrationInfo,
} from "@/lib/integrations/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DynamicIcon } from "@/components/icon";

type Connected = { provider: string; accountName: string | null };

export function IntegrationsManager({ connected }: { connected: Connected[] }) {
  const [active, setActive] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(connected.map((c) => [c.provider, c.accountName])),
  );
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connecting: IntegrationInfo | undefined = connectingId
    ? getIntegration(connectingId)
    : undefined;

  function openConnect(info: IntegrationInfo) {
    setConnectingId(info.id);
    setAccountName("");
    setCreds({});
    setError(null);
  }

  function closeConnect() {
    setConnectingId(null);
    setBusy(false);
    setError(null);
  }

  async function submitConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connecting) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: connecting.id,
        accountName: accountName.trim() || undefined,
        credentials: creds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setActive((a) => ({
        ...a,
        [connecting.id]: accountName.trim() || data.accountName || connecting.accountLabel,
      }));
      closeConnect();
    } else {
      setError(data.error || "Connexion impossible. Vérifiez vos identifiants.");
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    setBusy(true);
    const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setActive((a) => {
        const next = { ...a };
        delete next[id];
        return next;
      });
    }
    setBusy(false);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_CATALOG.map((integ) => {
          const on = integ.id in active;
          const account = active[integ.id];
          return (
            <Card key={integ.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground/60 ring-1 ring-inset ring-border [&_svg]:size-5">
                  <DynamicIcon name={integ.icon} />
                </span>
                {on ? (
                  <Badge variant="success">Connectée</Badge>
                ) : (
                  <Badge variant="muted">{integ.category}</Badge>
                )}
              </div>
              <h3 className="mt-3 font-semibold tracking-tight text-foreground">
                {integ.name}
              </h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground text-pretty">
                {integ.description}
              </p>
              {on && account && (
                <p className="mt-2 truncate text-xs font-medium text-emerald-600">
                  Connecté · {account}
                </p>
              )}
              <Button
                variant={on ? "outline" : "default"}
                size="sm"
                className="mt-4"
                onClick={() => (on ? disconnect(integ.id) : openConnect(integ))}
                disabled={busy && (connectingId === integ.id || on)}
              >
                {on ? <Check className="size-4" /> : <Plug className="size-4" />}
                {on ? "Déconnecter" : "Connecter"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Fenêtre de connexion réelle (identifiants du provider) */}
      {connecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={closeConnect}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground/70 ring-1 ring-inset ring-border [&_svg]:size-5">
                  <DynamicIcon name={connecting.icon} />
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight text-foreground">
                    Connecter {connecting.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{connecting.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeConnect}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={submitConnect} className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="acct">{connecting.accountLabel}</Label>
                <Input
                  id="acct"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={`Mon ${connecting.accountLabel.toLowerCase()}`}
                />
              </div>
              {connecting.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    id={f.key}
                    type={f.type ?? "password"}
                    value={creds[f.key] ?? ""}
                    onChange={(e) =>
                      setCreds((c) => ({ ...c, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder ?? (f.type === "text" ? "" : "••••••••")}
                    autoComplete="off"
                  />
                </div>
              ))}

              <a
                href={connecting.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <ExternalLink className="size-3.5" /> Où trouver mes identifiants ?
              </a>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="brand" size="sm" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plug className="size-4" />
                  )}
                  Connecter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeConnect}
                  disabled={busy}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
