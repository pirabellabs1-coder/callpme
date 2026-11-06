"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, FlaskConical, Loader2, Play, Plus, Trash2, XCircle } from "lucide-react";
import type { CheckResult, Expectations } from "@/lib/simulation/checks";
import type { TranscriptTurn } from "@/lib/shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface ScenarioView {
  id: string;
  name: string;
  mode: "script" | "persona";
  callerPrompt: string;
  expectations: Expectations;
  lastRun: {
    passed: boolean;
    score: number;
    createdAt: string;
    transcript: TranscriptTurn[];
    checks: CheckResult[];
  } | null;
}

interface Draft {
  name: string;
  mode: "script" | "persona";
  callerPrompt: string;
  mustCallTools: string[];
  mustNotCallTools: string[];
  mustSay: string;
  mustNotSay: string;
  judge: string;
}

const EMPTY: Draft = { name: "", mode: "script", callerPrompt: "", mustCallTools: [], mustNotCallTools: [], mustSay: "", mustNotSay: "", judge: "" };

/** Modèles pour démarrer vite. */
const TEMPLATES: { label: string; draft: Partial<Draft> }[] = [
  {
    label: "Prise de rendez-vous",
    draft: {
      name: "Prise de rendez-vous simple",
      mode: "script",
      callerPrompt: "Bonjour, je voudrais un rendez-vous.\nPlutôt mardi matin.\nOui, 10 h me va très bien.\nJe m'appelle Awa Diallo.\nNon, c'est tout, merci.",
      mustCallTools: ["checkAvailability", "bookAppointment"],
    },
  },
  {
    label: "Demande d'un humain",
    draft: {
      name: "L'appelant veut parler à quelqu'un",
      mode: "script",
      callerPrompt: "Je veux parler à une vraie personne, s'il vous plaît.\nOui, c'est urgent.",
      mustCallTools: ["transferToHuman"],
    },
  },
  {
    label: "Question hors sujet",
    draft: {
      name: "Question hors périmètre",
      mode: "script",
      callerPrompt: "Vous pouvez me donner un conseil pour mes impôts ?\nD'accord, merci.",
      mustNotCallTools: ["bookAppointment"],
      judge: "L'agent refuse poliment de répondre hors de son domaine et ne donne pas de conseil fiscal.",
    },
  },
  {
    label: "Appelant mécontent (IA)",
    draft: {
      name: "Appelant mécontent",
      mode: "persona",
      callerPrompt: "Tu es un client agacé : ton rendez-vous d'hier a été annulé sans prévenir. Tu veux une explication puis un nouveau créneau.",
      judge: "L'agent reste calme et courtois, s'excuse et propose une solution concrète.",
    },
  },
];

const splitList = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

const field =
  "w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

function ToolPicker({
  label,
  tools,
  value,
  onChange,
}: {
  label: string;
  tools: { name: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((t) => {
          const on = value.includes(t.name);
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== t.name) : [...value, t.name])}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                on ? "border-brand/50 bg-brand/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
        {tools.length === 0 && <span className="text-xs text-muted-foreground">Aucun outil activé sur cet agent.</span>}
      </div>
    </fieldset>
  );
}

/** Tests par simulation : scénarios rejoués avant la mise en ligne. */
export function ScenarioManager({
  agentId,
  scenarios,
  tools,
  personaAvailable,
}: {
  agentId: string;
  scenarios: ScenarioView[];
  tools: { name: string; label: string }[];
  personaAvailable: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(scenarios.length === 0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const toolNames = new Set(tools.map((t) => t.name));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    const res = await fetch(`/api/agents/${agentId}/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        mode: draft.mode,
        callerPrompt: draft.callerPrompt,
        expectations: {
          mustCallTools: draft.mustCallTools.filter((t) => toolNames.has(t)),
          mustNotCallTools: draft.mustNotCallTools,
          mustSay: splitList(draft.mustSay),
          mustNotSay: splitList(draft.mustNotSay),
          ...(draft.judge.trim() ? { judge: draft.judge.trim() } : {}),
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body?.error ?? "Création impossible.");
    setDraft(EMPTY);
    setCreating(false);
    router.refresh();
  }

  async function run(scenarioId?: string) {
    setBusy(scenarioId ?? "all");
    setError(null);
    const res = await fetch(`/api/agents/${agentId}/scenarios/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenarioId ? { scenarioId } : {}),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body?.error ?? "Simulation impossible.");
    const failed = (body.results as { error?: string }[]).find((r) => r.error);
    if (failed) setError(failed.error!);
    if (scenarioId) setOpen(scenarioId);
    router.refresh();
  }

  async function remove(s: ScenarioView) {
    if (!window.confirm(`Supprimer le scénario « ${s.name} » ?`)) return;
    await fetch(`/api/scenarios/${s.id}`, { method: "DELETE" });
    router.refresh();
  }

  const passedCount = scenarios.filter((s) => s.lastRun?.passed).length;
  const ranCount = scenarios.filter((s) => s.lastRun).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          Rejouez des conversations types avant chaque mise en ligne : l&apos;agent répond avec sa configuration actuelle,
          en mode test (aucun SMS, e-mail ni rendez-vous réel), puis chaque attente est vérifiée.
        </p>
        <div className="flex items-center gap-2">
          {ranCount > 0 && (
            <Badge variant={passedCount === ranCount ? "success" : "warning"}>
              {passedCount}/{ranCount} réussi{passedCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
            <Plus aria-hidden /> Nouveau scénario
          </Button>
          <Button type="button" variant="brand" size="sm" onClick={() => run()} disabled={busy !== null || scenarios.length === 0}>
            {busy === "all" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            Tout lancer
          </Button>
        </div>
      </div>

      {!personaAvailable && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Aucune clé d&apos;IA (OpenAI, Anthropic ou Mistral) n&apos;est configurée côté serveur : l&apos;agent répond avec le
          moteur de démonstration, qui n&apos;utilise ni l&apos;agenda ni les actions engageantes. Les vérifications
          d&apos;outils échoueront tant qu&apos;une clé n&apos;est pas ajoutée.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {creating && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-[0.95rem] font-semibold tracking-tight">Nouveau scénario</h2>
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setDraft({ ...EMPTY, ...t.draft, mustCallTools: (t.draft.mustCallTools ?? []).filter((x) => toolNames.has(x)) })}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-brand/40 hover:text-foreground"
              >
                {t.label}
              </button>
            ))}
          </div>
          <form onSubmit={create} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label htmlFor="sc-name" className="text-sm font-medium">
                  Nom
                </label>
                <input id="sc-name" className={cn(field, "mt-1.5")} value={draft.name} maxLength={120} required onChange={(e) => set({ name: e.target.value })} />
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Appelant</legend>
                <div className="mt-1.5 inline-flex rounded-lg border border-border p-1" role="radiogroup">
                  {(
                    [
                      ["script", "Répliques fixes"],
                      ["persona", "Joué par l'IA"],
                    ] as const
                  ).map(([m, l]) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={draft.mode === m}
                      onClick={() => set({ mode: m })}
                      className={cn("rounded-md px-3 py-1.5 text-sm", draft.mode === m ? "bg-secondary font-medium" : "text-muted-foreground")}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            {draft.mode === "persona" && !personaAvailable && (
              <p className="text-xs text-amber-400">
                L&apos;appelant joué par l&apos;IA demande une clé OpenAI, Anthropic ou Mistral côté serveur. Les répliques fixes
                fonctionnent sans clé.
              </p>
            )}
            <div>
              <label htmlFor="sc-prompt" className="text-sm font-medium">
                {draft.mode === "script" ? "Répliques de l'appelant (une par ligne)" : "Qui est l'appelant, que veut-il ?"}
              </label>
              <textarea id="sc-prompt" rows={5} className={cn(field, "mt-1.5")} value={draft.callerPrompt} maxLength={4000} required onChange={(e) => set({ callerPrompt: e.target.value })} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ToolPicker label="L'agent doit utiliser" tools={tools} value={draft.mustCallTools} onChange={(v) => set({ mustCallTools: v })} />
              <ToolPicker label="L'agent ne doit pas utiliser" tools={tools} value={draft.mustNotCallTools} onChange={(v) => set({ mustNotCallTools: v })} />
              <div>
                <label htmlFor="sc-say" className="text-xs font-medium text-muted-foreground">
                  Doit dire (séparé par des virgules)
                </label>
                <input id="sc-say" className={cn(field, "mt-1.5")} value={draft.mustSay} onChange={(e) => set({ mustSay: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sc-nosay" className="text-xs font-medium text-muted-foreground">
                  Ne doit jamais dire
                </label>
                <input id="sc-nosay" className={cn(field, "mt-1.5")} value={draft.mustNotSay} onChange={(e) => set({ mustNotSay: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="sc-judge" className="text-xs font-medium text-muted-foreground">
                Critère libre jugé par l&apos;IA (facultatif)
              </label>
              <input
                id="sc-judge"
                className={cn(field, "mt-1.5")}
                value={draft.judge}
                maxLength={600}
                placeholder="Ex. : l'agent reformule la demande avant de réserver."
                onChange={(e) => set({ judge: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy === "create"}>
                {busy === "create" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                Créer le scénario
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {scenarios.length === 0 && !creating ? (
        <EmptyState icon={FlaskConical} title="Aucun scénario" description="Créez un premier scénario à partir d'un modèle." />
      ) : (
        <ul className="space-y-3">
          {scenarios.map((s) => {
            const r = s.lastRun;
            const expanded = open === s.id;
            return (
              <li key={s.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {r ? (
                      r.passed ? (
                        <CheckCircle2 className="size-5 text-emerald-400" aria-label="Réussi" />
                      ) : (
                        <XCircle className="size-5 text-rose-400" aria-label="Échoué" />
                      )
                    ) : (
                      <FlaskConical className="size-5 text-muted-foreground" aria-label="Jamais lancé" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.mode === "persona" ? "Appelant joué par l'IA" : "Répliques fixes"}
                        {r && ` · ${r.score} % des vérifications · ${new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => run(s.id)} disabled={busy !== null}>
                      {busy === s.id ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
                      Lancer
                    </Button>
                    {r && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}>
                        Détails <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer « ${s.name} »`} onClick={() => remove(s)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  {expanded && r && (
                    <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_1.4fr]">
                      <ul className="space-y-1.5 text-sm" aria-label="Vérifications">
                        {r.checks.length === 0 && <li className="text-muted-foreground">Aucune attente définie.</li>}
                        {r.checks.map((c, i) => (
                          <li key={i} className="flex gap-2">
                            {c.passed ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-label="OK" />
                            ) : (
                              <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-label="Échec" />
                            )}
                            <span>
                              {c.label}
                              {c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <ol className="max-h-80 space-y-1.5 overflow-auto rounded-lg bg-foreground/[0.02] p-3 text-sm" aria-label="Conversation simulée">
                        {r.transcript.map((t, i) => (
                          <li key={i} className={t.speaker === "tool" ? "text-xs text-muted-foreground" : ""}>
                            <span className="font-medium">
                              {t.speaker === "agent" ? "Agent" : t.speaker === "caller" ? "Appelant" : `Action ${t.toolName ?? ""}`} :
                            </span>{" "}
                            {t.text}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
