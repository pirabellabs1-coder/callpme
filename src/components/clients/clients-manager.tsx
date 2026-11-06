"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Trash2,
  Loader2,
  Check,
  Bot,
  Mail,
  LogIn,
  Pencil,
  X,
  AlertCircle,
} from "lucide-react";
import type { ClientRecord } from "@/lib/db/clients";
import { setActiveClient } from "@/app/actions/clients";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/settings/dialog";
import { initials } from "@/lib/utils";

const DEFAULT_COLOR = "#E8572A";

/** Black or white text, whichever reads better on the given hex background. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L =
    0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast vs white = 1.05 / (L + 0.05); vs black = (L + 0.05) / 0.05
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#fff" : "#0b0b0c";
}

function ClientMark({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={
        size === "sm"
          ? "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ring-1 ring-inset ring-white/10"
          : "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-inset ring-white/10"
      }
      style={{ background: color, color: readableOn(color) }}
    >
      {initials(name || "?")}
    </span>
  );
}

/** Color picker + hex value, with a proper label. */
function BrandColorField({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Couleur de marque</Label>
      <div className="flex items-center gap-2.5">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
        />
        <ClientMark name={name} color={value} size="sm" />
        <span className="font-mono text-xs uppercase text-muted-foreground">{value}</span>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        Appliquée à l&apos;espace du client (marque blanche).
      </p>
    </div>
  );
}

export function ClientsManager({ initial }: { initial: ClientRecord[] }) {
  const router = useRouter();
  const [entering, startTransition] = useTransition();
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [clients, setClients] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(c: ClientRecord) {
    if (
      !window.confirm(
        `Supprimer le client « ${c.name} » ? Ses agents seront détachés (pas supprimés).`,
      )
    )
      return;
    setListError(null);
    setRemovingId(c.id);
    const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    if (res.ok) setClients((list) => list.filter((x) => x.id !== c.id));
    else setListError("Suppression impossible. Réessayez.");
    setRemovingId(null);
  }

  function enter(id: string) {
    setEnteringId(id);
    startTransition(async () => {
      await setActiveClient(id);
      router.push("/agents");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {clients.length} espace{clients.length > 1 ? "s" : ""} client
          {clients.length > 1 ? "s" : ""}
        </p>
        <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouveau client
        </Button>
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

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun espace client"
          description="Créez un espace par client de votre agence : ses agents, ses numéros et sa couleur de marque restent séparés."
          action={
            <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Créer le premier client
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const color = c.brandColor || DEFAULT_COLOR;
            return (
              <li key={c.id}>
                <Card className="relative flex h-full flex-col overflow-hidden p-5">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ background: color }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <ClientMark name={c.name} color={color} />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={`Modifier ${c.name}`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={removingId === c.id}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        aria-label={`Supprimer ${c.name}`}
                      >
                        {removingId === c.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
                    {c.name}
                  </h3>
                  <div className="mt-2 flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-1.5">
                      <Bot className="size-3.5 shrink-0" aria-hidden="true" />
                      {c.agentCount} agent{c.agentCount > 1 ? "s" : ""}
                    </p>
                    {c.contactEmail ? (
                      <p className="inline-flex min-w-0 items-center gap-1.5">
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{c.contactEmail}</span>
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1.5 text-muted-foreground/70">
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        Pas d&apos;e-mail de contact
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => enter(c.id)}
                    disabled={entering}
                  >
                    {entering && enteringId === c.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <LogIn className="size-4" aria-hidden="true" />
                    )}
                    Entrer dans l&apos;espace
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <ClientDialog
          onClose={() => setCreating(false)}
          onSaved={(client) => {
            setClients((list) => [...list, client]);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <ClientDialog
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={(client) => {
            setClients((list) => list.map((x) => (x.id === client.id ? client : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** Create (no `client`) or edit (with `client`) an agency workspace. */
function ClientDialog({
  client,
  onClose,
  onSaved,
}: {
  client?: ClientRecord;
  onClose: () => void;
  onSaved: (client: ClientRecord) => void;
}) {
  const isEdit = Boolean(client);
  const [name, setName] = useState(client?.name ?? "");
  const [brandColor, setBrandColor] = useState(client?.brandColor || DEFAULT_COLOR);
  const [email, setEmail] = useState(client?.contactEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();
  const errId = useId();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      brandColor,
      contactEmail: email.trim() || (isEdit ? null : ""),
    };
    const res = await fetch(isEdit ? `/api/clients/${client!.id}` : "/api/clients", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      onSaved(
        isEdit
          ? { ...client!, name: body.name, brandColor, contactEmail: email.trim() || null }
          : data.client,
      );
    } else {
      setError(data.error ?? "Enregistrement impossible. Vérifiez les champs.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={isEdit ? "Modifier le client" : "Nouveau client"}
      description={
        isEdit
          ? "Nom, contact et couleur de marque de cet espace."
          : "Un espace isolé pour un client de votre agence."
      }
      icon={<Building2 />}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            <X className="size-4" aria-hidden="true" />
            Annuler
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="brand"
            size="sm"
            disabled={busy || !name.trim()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {isEdit ? "Enregistrer" : "Créer le client"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={save} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-name`}>
            Nom du client <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cabinet Dupont"
            required
            maxLength={80}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errId : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-email`}>E-mail de contact</Label>
          <Input
            id={`${formId}-email`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@client.fr"
          />
        </div>
        <BrandColorField value={brandColor} onChange={setBrandColor} name={name} />
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
