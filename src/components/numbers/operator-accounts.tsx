"use client";

import { useState } from "react";
import { Check, Download, KeyRound, Loader2, Plug, Plus, Trash2, X } from "lucide-react";
import type { PhoneNumberRecord, ProviderConnectionRecord } from "@/lib/shared/types";
import { providerLabel } from "@/lib/telephony/providers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TwilioNumberRow {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voice: boolean;
  /** Appels entrants dirigés vers Callpme chez Twilio. */
  linked: boolean;
  imported: boolean;
  usedElsewhere: boolean;
}

/** Opérateurs pris en charge de bout en bout (connexion, import, appels). */
const SUPPORTED = ["twilio"];

/**
 * Comptes opérateurs du client : il connecte SON compte (identifiants vérifiés
 * chez l'opérateur, puis chiffrés), puis importe ses numéros en un clic. Le
 * numéro importé est configuré automatiquement vers Callpme et devient actif.
 */
export function OperatorAccounts({
  providers,
  onProvidersChange,
  onImported,
}: {
  providers: ProviderConnectionRecord[];
  onProvidersChange: (next: ProviderConnectionRecord[]) => void;
  onImported: (n: PhoneNumberRecord) => void;
}) {
  const [showForm, setShowForm] = useState(providers.length === 0);
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "twilio", label: label.trim() || "Twilio", accountSid: sid.trim(), authToken: token.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Connexion impossible.");
    onProvidersChange([...providers, data.provider]);
    setSid("");
    setToken("");
    setLabel("");
    setShowForm(false);
  }

  async function remove(p: ProviderConnectionRecord) {
    if (!window.confirm(`Déconnecter « ${p.label} » ? Ses numéros ne recevront plus d'appels jusqu'à une nouvelle connexion.`)) return;
    setRemoving(p.id);
    const res = await fetch(`/api/providers/${p.id}`, { method: "DELETE" });
    setRemoving(null);
    if (res.ok) onProvidersChange(providers.filter((x) => x.id !== p.id));
    else setError("Déconnexion impossible. Réessayez.");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <Plug className="size-4 text-muted-foreground" aria-hidden="true" />
            Mon compte opérateur
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connectez votre compte Twilio : vos numéros s&apos;importent et se configurent automatiquement.
          </p>
        </div>
        <Button size="sm" variant="default" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          {showForm ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {showForm ? "Fermer" : "Connecter un compte"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={connect} className="mx-5 mb-4 space-y-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="brand">Twilio</Badge>
            {["Telnyx", "Zadarma", "Vonage", "OVHcloud"].map((x) => (
              <Badge key={x} variant="muted">
                {x} · bientôt
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tw-sid">
                Account SID <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="tw-sid"
                value={sid}
                onChange={(e) => setSid(e.target.value)}
                placeholder="AC…"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tw-token">
                Auth Token <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="tw-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tw-label">Nom du compte (facultatif)</Label>
              <Input id="tw-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Twilio · Agence Paris" />
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Vous les trouvez sur la page d&apos;accueil de votre console Twilio. Ils sont vérifiés auprès de Twilio, puis
            enregistrés chiffrés ; ils ne sont jamais réaffichés.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" size="sm" disabled={busy || !sid.trim() || !token.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            Connecter Twilio
          </Button>
        </form>
      )}

      {!showForm && error && (
        <p role="alert" className="mx-5 mb-4 text-sm text-rose-300">
          {error}
        </p>
      )}

      {providers.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {providers.map((p) => (
            <li key={p.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{providerLabel(p.provider)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={removing === p.id}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label={`Déconnecter ${p.label}`}
                >
                  {removing === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                </button>
              </div>
              {SUPPORTED.includes(p.provider) ? (
                <>
                  <ImportNumbers connectionId={p.id} onImported={onImported} />
                  <SmsSender connectionId={p.id} initial={p.smsSender ?? ""} />
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  L&apos;import automatique n&apos;est pas encore disponible pour cet opérateur.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Expéditeur des SMS (confirmations de rendez-vous, références) envoyés avec ce compte. */
function SmsSender({ connectionId, initial }: { connectionId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/providers/${connectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsSender: value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? "Expéditeur enregistré." : (data.error ?? "Enregistrement impossible.") });
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-1.5 rounded-lg border border-border p-3">
      <Label htmlFor={`sms-${connectionId}`}>Expéditeur des SMS (confirmations, références)</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`sms-${connectionId}`}
          value={value}
          maxLength={16}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ex. CABINET, ou +33 6 12 34 56 78"
          className="max-w-xs"
          aria-describedby={`sms-hint-${connectionId}`}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Enregistrer
        </Button>
      </div>
      <p id={`sms-hint-${connectionId}`} className="text-xs text-muted-foreground">
        Un numéro mobile de votre compte Twilio, ou un nom de 3 à 11 caractères (sans accents). Vide : le numéro de l&apos;agent
        (un numéro fixe ne peut pas envoyer de SMS).
      </p>
      {msg && (
        <p role="status" className={`text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

function ImportNumbers({ connectionId, onImported }: { connectionId: string; onImported: (n: PhoneNumberRecord) => void }) {
  const [rows, setRows] = useState<TwilioNumberRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/providers/${connectionId}/numbers`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Lecture des numéros impossible.");
    setRows(data.numbers ?? []);
  }

  async function importOne(r: TwilioNumberRow) {
    setBusy(r.sid);
    setError(null);
    const res = await fetch(`/api/providers/${connectionId}/numbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numberSid: r.sid }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Import impossible.");
    setRows((list) => list?.map((x) => (x.sid === r.sid ? { ...x, imported: true, linked: true } : x)) ?? null);
    onImported({
      id: data.number.id,
      number: data.number.number,
      label: data.number.label,
      provider: "twilio",
      monthlyPrice: 0,
      status: data.number.status,
      createdAt: new Date().toISOString(),
      assignedAgentId: null,
      assignedAgentName: null,
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {rows === null ? (
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          Importer mes numéros
        </Button>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun numéro sur ce compte Twilio. Achetez-en un dans votre console Twilio.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.sid} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="mono font-medium">{r.phoneNumber}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.friendlyName}</span>
              {r.imported && r.linked ? (
                <Badge variant="success">Importé</Badge>
              ) : r.imported ? (
                <Button size="sm" variant="brand" disabled={busy === r.sid} onClick={() => importOne(r)} title="Les appels de ce numéro ne vont plus vers Callpme chez Twilio">
                  {busy === r.sid && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Reconfigurer
                </Button>
              ) : r.usedElsewhere ? (
                <Badge variant="muted">Déjà utilisé</Badge>
              ) : !r.voice ? (
                <Badge variant="muted">Sans appels vocaux</Badge>
              ) : (
                <Button size="sm" variant="brand" disabled={busy === r.sid} onClick={() => importOne(r)}>
                  {busy === r.sid && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Ajouter à Callpme
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
