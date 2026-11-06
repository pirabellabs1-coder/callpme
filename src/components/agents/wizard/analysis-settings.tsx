"use client";

import { Plus, Trash2 } from "lucide-react";
import { fieldKey, MAX_FIELDS, type ExtractField, type ExtractFieldType } from "@/lib/analysis/fields";
import { Button } from "@/components/ui/button";

const TYPES: { value: ExtractFieldType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "boolean", label: "Oui / non" },
  { value: "choice", label: "Choix" },
  { value: "date", label: "Date" },
];

/** Suggestions courantes pour démarrer vite. */
const PRESETS: ExtractField[] = [
  { key: "motif", label: "Motif de l'appel", type: "text", description: "La raison principale de l'appel, en quelques mots." },
  { key: "budget", label: "Budget", type: "number", description: "Budget annoncé, en euros ou FCFA." },
  { key: "rappel_souhaite", label: "Rappel souhaité", type: "boolean", description: "L'appelant demande à être rappelé." },
  { key: "urgence", label: "Urgence", type: "choice", options: ["faible", "moyenne", "haute"] },
];

const input =
  "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

/** Ce que l'agent doit relever dans chaque appel, et ce qui fait un appel réussi. */
export function AnalysisSettings({
  fields,
  successCriteria,
  onChange,
}: {
  fields: ExtractField[];
  successCriteria: string;
  onChange: (patch: { analysisFields?: ExtractField[]; successCriteria?: string }) => void;
}) {
  const setFields = (next: ExtractField[]) => onChange({ analysisFields: next });
  const uniqueKey = (label: string, except: number) => {
    const base = fieldKey(label);
    let key = base;
    let n = 2;
    while (fields.some((f, i) => i !== except && f.key === key)) key = `${base}_${n++}`;
    return key;
  };
  const update = (i: number, patch: Partial<ExtractField>) =>
    setFields(
      fields.map((f, j) => {
        if (j !== i) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined) next.key = uniqueKey(patch.label, i);
        if (next.type !== "choice") delete next.options;
        return next;
      }),
    );
  const unused = PRESETS.filter((p) => !fields.some((f) => f.key === p.key));

  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">Analyse de fin d&apos;appel</legend>
      <p className="text-xs text-muted-foreground">
        Après chaque appel, Callpme résume l&apos;échange, note sa réussite et relève les informations ci-dessous. Elles
        apparaissent dans la fiche de l&apos;appel, l&apos;export CSV, l&apos;API et les webhooks.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="an-criteria" className="text-sm font-medium">
          Un appel est réussi quand…
        </label>
        <textarea
          id="an-criteria"
          rows={2}
          maxLength={600}
          value={successCriteria}
          onChange={(e) => onChange({ successCriteria: e.target.value })}
          placeholder="Ex. : un rendez-vous est pris, ou le client a obtenu la réponse à sa question."
          className="flex w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Informations à relever</p>
        {fields.length === 0 && <p className="text-xs text-muted-foreground">Aucune pour l&apos;instant.</p>}
        <ul className="space-y-2">
          {fields.map((f, i) => (
            <li key={i} className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1.2fr_0.8fr_1.6fr_auto]">
              <div>
                <label htmlFor={`an-l-${i}`} className="sr-only">
                  Nom de l&apos;information {i + 1}
                </label>
                <input id={`an-l-${i}`} className={input} value={f.label} maxLength={80} placeholder="Nom" onChange={(e) => update(i, { label: e.target.value })} />
                <code className="mt-1 block text-[0.7rem] text-muted-foreground">{f.key}</code>
              </div>
              <div>
                <label htmlFor={`an-t-${i}`} className="sr-only">
                  Type
                </label>
                <select id={`an-t-${i}`} className={input} value={f.type} onChange={(e) => update(i, { type: e.target.value as ExtractFieldType, ...(e.target.value === "choice" && !f.options ? { options: ["oui", "non"] } : {}) })}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`an-d-${i}`} className="sr-only">
                  Description
                </label>
                <input
                  id={`an-d-${i}`}
                  className={input}
                  value={f.description ?? ""}
                  maxLength={300}
                  placeholder="Précision pour l'IA (facultatif)"
                  onChange={(e) => update(i, { description: e.target.value || undefined })}
                />
                {f.type === "choice" && (
                  <>
                    <label htmlFor={`an-o-${i}`} className="sr-only">
                      Valeurs possibles
                    </label>
                    <input
                      id={`an-o-${i}`}
                      className={input}
                      value={(f.options ?? []).join(", ")}
                      placeholder="Valeurs séparées par des virgules"
                      onChange={(e) =>
                        update(i, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean)
                            .slice(0, 20),
                        })
                      }
                    />
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer « ${f.label || "information"} »`}
                onClick={() => setFields(fields.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={fields.length >= MAX_FIELDS}
            onClick={() => setFields([...fields, { key: uniqueKey("information", -1), label: "", type: "text" }])}
          >
            <Plus aria-hidden /> Ajouter
          </Button>
          {unused.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={fields.length >= MAX_FIELDS}
              onClick={() => setFields([...fields, p])}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-50"
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
