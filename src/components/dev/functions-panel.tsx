"use client";

import { useState } from "react";
import {
  FunctionSquare,
  Plus,
  Trash2,
  Send,
  Loader2,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

interface FieldDef {
  name: string;
  type: "string" | "number" | "boolean" | "integer";
  description?: string;
  required?: boolean;
}

export interface FunctionView {
  id: string;
  name: string;
  label: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
    additionalProperties?: boolean;
  };
  serverUrl: string | null;
  secret: string | null;
  method: string;
  async?: boolean;
  strict?: boolean;
  lockSchema?: boolean;
  createdAt: string;
}

/** Petit interrupteur réutilisable (style Vapi). */
function Toggle({
  checked,
  onChange,
  icon: Icon,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: typeof Zap;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
    >
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors",
          checked
            ? "bg-brand-50 text-brand-600 ring-brand-600/15"
            : "bg-secondary text-muted-foreground ring-border",
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

const TYPE_LABELS: Record<string, string> = {
  string: "Texte",
  number: "Nombre",
  integer: "Entier",
  boolean: "Booléen",
};

export function FunctionsPanel({
  initialFunctions,
}: {
  initialFunctions: FunctionView[];
}) {
  const [functions, setFunctions] = useState<FunctionView[]>(initialFunctions);
  const [open, setOpen] = useState(initialFunctions.length === 0);
  const [form, setForm] = useState({
    name: "",
    label: "",
    description: "",
    serverUrl: "",
    async: false,
    strict: false,
    lockSchema: false,
  });
  const [paramView, setParamView] = useState<"visual" | "json">("visual");
  const [fields, setFields] = useState<FieldDef[]>([
    { name: "nom", type: "string", description: "Nom de famille", required: true },
    { name: "prenom", type: "string", description: "Prénom", required: true },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function setField(i: number, patch: Partial<FieldDef>) {
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/dev/functions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fields: fields.filter((f) => f.name.trim()),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setFunctions((fs) => [data.function, ...fs]);
      setForm({
        name: "",
        label: "",
        description: "",
        serverUrl: "",
        async: false,
        strict: false,
        lockSchema: false,
      });
      setFields([{ name: "", type: "string", description: "", required: true }]);
      setOpen(false);
    } else {
      setError(data.error ?? "Une erreur est survenue.");
    }
    setCreating(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette fonction ?")) return;
    const res = await fetch(`/api/dev/functions/${id}`, { method: "DELETE" });
    if (res.ok) setFunctions((fs) => fs.filter((f) => f.id !== id));
  }

  async function test(id: string) {
    setTesting(id);
    setResults((r) => ({ ...r, [id]: "" }));
    const res = await fetch(`/api/dev/functions/${id}/test`, { method: "POST" });
    const data = await res.json();
    setResults((r) => ({
      ...r,
      [id]: res.ok
        ? data.delivered
          ? `Livré (HTTP ${data.status})`
          : data.status
            ? `Échec (HTTP ${data.status})`
            : "Endpoint injoignable"
        : data.error ?? "Erreur",
    }));
    setTesting(null);
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Fonctions personnalisées
          </h2>
          <p className="text-sm text-muted-foreground">
            Créez des fonctions que vos agents appellent pendant un appel pour
            collecter des données et les envoyer vers vos systèmes (CRM, API…).
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          Nouvelle fonction
        </Button>
      </div>

      {/* Formulaire de création */}
      {open && (
        <form
          onSubmit={create}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Identifiant (technique)
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="collectContact"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Libellé
              </label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Collecte de contact"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description (pour l'IA)
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Collecte le nom, le prénom et l'e-mail puis les envoie au CRM."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              URL de destination (où envoyer les données)
            </label>
            <Input
              type="url"
              value={form.serverUrl}
              onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
              placeholder="https://votre-systeme.fr/api/contact"
            />
          </div>

          {/* Réglages de l'outil */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Réglages de l'outil
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Toggle
                checked={form.async}
                onChange={(v) => setForm({ ...form, async: v })}
                icon={Zap}
                title="Asynchrone"
                hint="L'agent continue sans attendre la réponse."
              />
              <Toggle
                checked={form.strict}
                onChange={(v) => setForm({ ...form, strict: v })}
                icon={ShieldCheck}
                title="Mode strict"
                hint="Force le modèle à respecter le schéma."
              />
            </div>
          </div>

          {/* Constructeur de champs */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Paramètres
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.lockSchema}
                    onChange={(e) => setForm({ ...form, lockSchema: e.target.checked })}
                    className="size-3.5 accent-brand"
                  />
                  <Lock className="size-3" />
                  Verrouiller le schéma
                </label>
                <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-0.5">
                  {(["visual", "json"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setParamView(v)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        paramView === v
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v === "visual" ? "Visuel" : "JSON"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {paramView === "json" ? (
              <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-[hsl(24_12%_10%)] p-3 font-mono text-[0.72rem] leading-relaxed text-zinc-200">
                {JSON.stringify(
                  {
                    type: "object",
                    properties: Object.fromEntries(
                      fields
                        .filter((f) => f.name.trim())
                        .map((f) => [
                          f.name,
                          f.description
                            ? { type: f.type, description: f.description }
                            : { type: f.type },
                        ]),
                    ),
                    required: fields.filter((f) => f.required && f.name.trim()).map((f) => f.name),
                    ...(form.lockSchema ? { additionalProperties: false } : {}),
                  },
                  null,
                  2,
                )}
              </pre>
            ) : (
            <>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={f.name}
                    onChange={(e) => setField(i, { name: e.target.value })}
                    placeholder="nom"
                    className="w-32"
                  />
                  <Select
                    value={f.type}
                    onChange={(e) =>
                      setField(i, { type: e.target.value as FieldDef["type"] })
                    }
                    className="w-32"
                  >
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={f.description ?? ""}
                    onChange={(e) => setField(i, { description: e.target.value })}
                    placeholder="Description"
                    className="min-w-0 flex-1"
                  />
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={f.required ?? false}
                      onChange={(e) => setField(i, { required: e.target.checked })}
                      className="size-3.5 accent-brand"
                    />
                    Requis
                  </label>
                  <button
                    type="button"
                    onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Supprimer le champ"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFields((fs) => [...fs, { name: "", type: "string", required: false }])
              }
            >
              <Plus className="size-4" />
              Ajouter un champ
            </Button>
            </>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            variant="brand"
            disabled={creating || !form.name.trim() || !form.label.trim()}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Créer la fonction
          </Button>
        </form>
      )}

      {/* Liste */}
      {functions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune fonction. Créez-en une pour permettre à vos agents d'agir.
        </p>
      ) : (
        <div className="space-y-3">
          {functions.map((fn) => (
            <div key={fn.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
                  <FunctionSquare className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{fn.label}</p>
                    <code className="font-mono text-[0.7rem] text-muted-foreground">
                      {fn.name}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">{fn.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(fn.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {(fn.async || fn.strict || fn.lockSchema) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {fn.async && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[0.7rem] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/15">
                      <Zap className="size-3" strokeWidth={2} />
                      Asynchrone
                    </span>
                  )}
                  {fn.strict && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                      <ShieldCheck className="size-3" strokeWidth={2} />
                      Strict
                    </span>
                  )}
                  {fn.lockSchema && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                      <Lock className="size-3" strokeWidth={2} />
                      Schéma verrouillé
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(fn.parameters.properties ?? {}).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
                  >
                    {k}
                    <span className="text-muted-foreground/60">
                      :{TYPE_LABELS[v.type] ?? v.type}
                    </span>
                    {fn.parameters.required?.includes(k) && (
                      <span className="text-brand">*</span>
                    )}
                  </span>
                ))}
              </div>

              {fn.serverUrl && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                  <Send className="size-3.5 shrink-0 text-muted-foreground" />
                  <code className="flex-1 truncate font-mono text-xs text-foreground/70">
                    {fn.method} {fn.serverUrl}
                  </code>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {results[fn.id] ? (
                    <span className="font-medium text-foreground">
                      {results[fn.id]}
                    </span>
                  ) : (
                    "Endpoint signé HMAC-SHA256"
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  {fn.secret && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(fn.secret!, fn.id)}
                    >
                      {copied === fn.id ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      Secret
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => test(fn.id)}
                    disabled={testing === fn.id || !fn.serverUrl}
                  >
                    {testing === fn.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Tester
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
