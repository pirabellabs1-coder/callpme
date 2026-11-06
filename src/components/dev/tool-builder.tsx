"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  Zap,
  ShieldCheck,
  Lock,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { CustomToolRecord } from "@/lib/shared/types";
import { Dialog } from "@/components/settings/dialog";

interface FieldDef {
  name: string;
  type: "string" | "number" | "boolean" | "integer";
  description?: string;
  required?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  string: "Texte",
  number: "Nombre",
  integer: "Entier",
  boolean: "Booléen",
};

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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/40",
        checked ? "border-brand/40" : "border-border",
      )}
    >
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors",
          checked
            ? "bg-brand-50 text-brand-600 ring-brand-600/15"
            : "bg-secondary text-muted-foreground ring-border",
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full ring-1 ring-inset transition-colors",
          checked ? "bg-brand ring-transparent" : "bg-input ring-foreground/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full shadow-sm transition-transform",
            checked ? "bg-brand-foreground" : "bg-foreground/70",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/**
 * Constructeur de fonction (style Vapi), présenté en modale.
 * Réutilisable depuis l'assistant de création d'agent et le hub Développeurs.
 */
export function ToolBuilder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (tool: CustomToolRecord) => void;
}) {
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
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(i: number, patch: Partial<FieldDef>) {
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function create() {
    if (creating) return;
    if (!form.name.trim() || !form.label.trim()) {
      setError("L'identifiant et le libellé sont requis.");
      return;
    }
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
      onCreated(data.function as CustomToolRecord);
    } else {
      setError(data.error ?? "Une erreur est survenue.");
      setCreating(false);
    }
  }

  const schemaPreview = JSON.stringify(
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
  );

  return (
    <Dialog
      title="Nouvelle fonction"
      description="Une action que l'agent déclenche pendant un appel."
      icon={<Wrench />}
      size="2xl"
      onClose={onClose}
      dismissible={!creating}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={creating}>
            Annuler
          </Button>
          <Button
            variant="brand"
            type="button"
            onClick={create}
            disabled={creating || !form.name.trim() || !form.label.trim()}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Créer la fonction
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Réglages de l'outil */}
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Réglages de l'outil
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tb-name" className="text-xs font-medium text-muted-foreground">
                Identifiant (technique)
              </label>
              <Input
                id="tb-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="collectContact"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tb-label" className="text-xs font-medium text-muted-foreground">
                Libellé
              </label>
              <Input
                id="tb-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Collecte de contact"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="tb-desc" className="text-xs font-medium text-muted-foreground">
                Description (pour l'IA)
              </label>
              <span className="font-mono text-[0.7rem] text-muted-foreground">
                {form.description.length}/1000
              </span>
            </div>
            <Textarea
              id="tb-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value.slice(0, 1000) })
              }
              rows={2}
              placeholder="Décrit l'action en quelques phrases pour que l'IA sache quand l'appeler."
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <label htmlFor="tb-url" className="text-xs font-medium text-muted-foreground">
              URL de destination (où envoyer les données)
            </label>
            <Input
              id="tb-url"
              type="url"
              value={form.serverUrl}
              onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
              placeholder="https://votre-systeme.fr/api/contact"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Toggle
              checked={form.async}
              onChange={(v) => setForm({ ...form, async: v })}
              icon={Zap}
              title="Asynchrone"
              hint="L'agent continue sans attendre."
            />
            <Toggle
              checked={form.strict}
              onChange={(v) => setForm({ ...form, strict: v })}
              icon={ShieldCheck}
              title="Mode strict"
              hint="Force le respect du schéma."
            />
          </div>
        </div>

        {/* Paramètres */}
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Paramètres</p>
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
                    aria-pressed={paramView === v}
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
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[0.72rem] leading-relaxed text-foreground/90">
              {schemaPreview}
            </pre>
          ) : fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Aucun paramètre. Ajoutez une propriété à collecter.
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={f.name}
                    onChange={(e) => setField(i, { name: e.target.value })}
                    placeholder="nom"
                    aria-label={`Nom du paramètre ${i + 1}`}
                    className="w-32"
                  />
                  <Select
                    value={f.type}
                    onChange={(e) =>
                      setField(i, { type: e.target.value as FieldDef["type"] })
                    }
                    className="w-32"
                    aria-label={`Type du paramètre ${i + 1}`}
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
                    aria-label={`Description du paramètre ${i + 1}`}
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
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Supprimer le paramètre ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              setFields((fs) => [...fs, { name: "", type: "string", required: false }])
            }
          >
            <Plus className="size-4" />
            Ajouter une propriété
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
