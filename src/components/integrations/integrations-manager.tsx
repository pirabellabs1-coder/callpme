"use client";

import { useId, useState } from "react";
import {
  KeyRound,
  Loader2,
  Plug,
  ExternalLink,
  Info,
  AlertCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
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
import { Dialog } from "@/components/settings/dialog";

type Connected = { provider: string; accountName: string | null };

export function IntegrationsManager({ connected }: { connected: Connected[] }) {
  const [active, setActive] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(connected.map((c) => [c.provider, c.accountName])),
  );
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const connecting: IntegrationInfo | undefined = connectingId
    ? getIntegration(connectingId)
    : undefined;

  async function disconnect(info: IntegrationInfo) {
    if (
      !window.confirm(
        `Retirer les identifiants ${info.name} enregistrés ? Ils seront supprimés de Callpme.`,
      )
    )
      return;
    setListError(null);
    setRemovingId(info.id);
    const res = await fetch(`/api/integrations/${info.id}`, { method: "DELETE" });
    if (res.ok) {
      setActive((a) => {
        const next = { ...a };
        delete next[info.id];
        return next;
      });
    } else {
      setListError(`Impossible de retirer ${info.name}. Réessayez.`);
    }
    setRemovingId(null);
  }

  const savedCount = Object.keys(active).length;

  return (
    <div className="space-y-5">
      {/* Honest scope: credentials are stored, not verified nor synced yet. */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="text-sm text-muted-foreground text-pretty">
          <p className="font-medium text-foreground">Ce que fait cette page</p>
          <p className="mt-0.5">
            Vous enregistrez ici les identifiants de vos outils pour votre organisation.
            Callpme ne teste pas encore la connexion auprès du service et aucune
            synchronisation automatique n&apos;est active pour l&apos;instant : vérifiez
            vos identifiants chez le fournisseur.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-foreground">
          Catalogue
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {savedCount} sur {INTEGRATION_CATALOG.length} avec identifiants
        </p>
      </div>

      {listError && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {listError}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_CATALOG.map((integ) => {
          const on = integ.id in active;
          const account = active[integ.id];
          const removing = removingId === integ.id;
          return (
            <li key={integ.id}>
              <Card
                className={
                  on
                    ? "flex h-full flex-col border-emerald-600/25 p-5"
                    : "flex h-full flex-col p-5"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground/70 ring-1 ring-inset ring-border [&_svg]:size-5"
                  >
                    <DynamicIcon name={integ.icon} />
                  </span>
                  <Badge variant="muted">{integ.category}</Badge>
                </div>
                <h3 className="mt-3 font-semibold tracking-tight text-foreground">
                  {integ.name}
                </h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground text-pretty">
                  {integ.description}
                </p>

                <div className="mt-3 min-h-[1.5rem]">
                  {on ? (
                    <p className="flex min-w-0 items-center gap-2 text-xs">
                      <Badge variant="success">
                        <KeyRound aria-hidden="true" />
                        Identifiants enregistrés
                      </Badge>
                      {account && (
                        <span className="truncate text-muted-foreground" title={account}>
                          {account}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Non configurée</p>
                  )}
                </div>

                {on ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setConnectingId(integ.id)}
                      disabled={removing}
                      aria-label={`Mettre à jour les identifiants ${integ.name}`}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Mettre à jour
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnect(integ)}
                      disabled={removing}
                      aria-label={`Retirer les identifiants ${integ.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {removing ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Unplug className="size-4" aria-hidden="true" />
                      )}
                      Retirer
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-4"
                    onClick={() => setConnectingId(integ.id)}
                    aria-label={`Configurer ${integ.name}`}
                  >
                    <Plug className="size-4" aria-hidden="true" />
                    Configurer
                  </Button>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {connecting && (
        <ConnectDialog
          info={connecting}
          isUpdate={connecting.id in active}
          onClose={() => setConnectingId(null)}
          onSaved={(accountName) => {
            setActive((a) => ({ ...a, [connecting.id]: accountName }));
            setConnectingId(null);
          }}
        />
      )}
    </div>
  );
}

function ConnectDialog({
  info,
  isUpdate,
  onClose,
  onSaved,
}: {
  info: IntegrationInfo;
  isUpdate: boolean;
  onClose: () => void;
  onSaved: (accountName: string | null) => void;
}) {
  const [accountName, setAccountName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();
  const errId = useId();

  const missingRequired = info.fields.some((f) => f.required && !creds[f.key]?.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: info.id,
        accountName: accountName.trim() || undefined,
        credentials: creds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      onSaved(accountName.trim() || data.accountName || null);
    } else {
      setError(data.error || "Enregistrement impossible. Vérifiez les champs requis.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={`${isUpdate ? "Mettre à jour" : "Configurer"} ${info.name}`}
      description="Les identifiants sont enregistrés pour votre organisation ; ils ne sont pas vérifiés auprès du service."
      icon={<DynamicIcon name={info.icon} />}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="brand"
            size="sm"
            disabled={busy || missingRequired}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            Enregistrer les identifiants
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-acct`}>
            {info.accountLabel}{" "}
            <span className="font-normal text-muted-foreground">(libellé, optionnel)</span>
          </Label>
          <Input
            id={`${formId}-acct`}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={`Mon ${info.accountLabel.toLowerCase()}`}
            maxLength={120}
            autoComplete="off"
          />
        </div>
        {info.fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${formId}-${f.key}`}>
              {f.label}
              {f.required && (
                <>
                  <span aria-hidden="true" className="text-destructive">
                    {" "}
                    *
                  </span>
                  <span className="sr-only"> (requis)</span>
                </>
              )}
            </Label>
            <Input
              id={`${formId}-${f.key}`}
              type={f.type ?? "password"}
              value={creds[f.key] ?? ""}
              onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder ?? (f.type === "text" ? "" : "••••••••")}
              autoComplete="off"
              spellCheck={false}
              required={f.required}
              aria-describedby={error ? errId : undefined}
            />
          </div>
        ))}

        {isUpdate && (
          <p className="text-xs text-muted-foreground">
            Les identifiants déjà enregistrés ne sont jamais réaffichés ; saisissez-les à
            nouveau pour les remplacer.
          </p>
        )}

        <a
          href={info.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-400 hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Où trouver mes identifiants ?
          <span className="sr-only"> (nouvel onglet)</span>
        </a>

        {error && (
          <p
            id={errId}
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
