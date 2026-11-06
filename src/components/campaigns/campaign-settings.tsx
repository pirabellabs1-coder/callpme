"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Save } from "lucide-react";
import type { CampaignSettings } from "@/lib/campaigns/settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mer"],
  [4, "Jeu"],
  [5, "Ven"],
  [6, "Sam"],
  [0, "Dim"],
] as const;

const TIMEZONES = [
  ["Europe/Paris", "France"],
  ["Europe/Brussels", "Belgique"],
  ["Europe/Zurich", "Suisse"],
  ["America/Toronto", "Québec"],
  ["Africa/Abidjan", "Côte d'Ivoire"],
  ["Africa/Dakar", "Sénégal"],
  ["Africa/Douala", "Cameroun"],
  ["Africa/Porto-Novo", "Bénin"],
  ["Africa/Lome", "Togo"],
  ["Africa/Bamako", "Mali"],
] as const;

const timeInput =
  "h-9 w-[7.25rem] rounded-md border border-input bg-card px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

/** Réglages d'envoi : quand appeler, combien à la fois, et les relances. */
export function CampaignSettingsCard({
  campaignId,
  initial,
  status,
  windowNote,
}: {
  campaignId: string;
  initial: CampaignSettings;
  status: string;
  windowNote: string | null;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<CampaignSettings>) => {
    setS((x) => ({ ...x, ...patch }));
    setState("idle");
  };
  const setWindow = (i: number, part: 0 | 1, v: string) =>
    set({ windows: s.windows.map((w, j) => (j === i ? ((part === 0 ? [v, w[1]] : [w[0], v]) as [string, string]) : w)) });

  async function save() {
    setState("saving");
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: s }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setState("saved");
      router.refresh();
    } else {
      setState("error");
      setError(body?.error ?? "Enregistrement impossible.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <Clock className="size-4 text-muted-foreground" aria-hidden /> Quand et comment appeler
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Les appels partent seulement dans ces plages, quelques-uns à la fois, avec relance automatique.
          </p>
        </div>
        {status === "running" && windowNote && (
          <p className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">{windowNote}</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="cs-tz">Fuseau des personnes appelées</Label>
          <Select id="cs-tz" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {TIMEZONES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-conc">Appels simultanés</Label>
          <Select id="cs-conc" value={s.maxConcurrent} onChange={(e) => set({ maxConcurrent: Number(e.target.value) })}>
            {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-att">Tentatives par contact</Label>
          <Select id="cs-att" value={s.maxAttempts} onChange={(e) => set({ maxAttempts: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 (pas de relance)" : `${n}`}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-delay">Délai avant relance</Label>
          <Select
            id="cs-delay"
            value={s.retryDelayMin}
            onChange={(e) => set({ retryDelayMin: Number(e.target.value) })}
            disabled={s.maxAttempts === 1}
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 heure</option>
            <option value={120}>2 heures</option>
            <option value={240}>4 heures</option>
            <option value={1440}>1 jour</option>
            <option value={2880}>2 jours</option>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Jours</legend>
          <div className="flex flex-wrap gap-1">
            {DAYS.map(([d, label]) => {
              const on = s.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ days: on ? s.days.filter((x) => x !== d) : [...s.days, d] })}
                  className={cn(
                    "h-8 w-11 rounded-md border text-xs font-medium transition-colors",
                    on ? "border-brand/50 bg-brand/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Plages horaires</legend>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {s.windows.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="px-1">et</span>}
                <input type="time" aria-label={`Plage ${i + 1}, début`} className={timeInput} value={w[0]} onChange={(e) => setWindow(i, 0, e.target.value)} />
                <span aria-hidden>–</span>
                <input type="time" aria-label={`Plage ${i + 1}, fin`} className={timeInput} value={w[1]} onChange={(e) => setWindow(i, 1, e.target.value)} />
              </span>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        En France, le démarchage téléphonique est autorisé en semaine de 10 h à 13 h et de 14 h à 20 h ; les numéros
        inscrits sur votre liste d&apos;opposition ne sont jamais appelés.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Enregistrer les réglages
        </Button>
        <span aria-live="polite" className={cn("text-xs", state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {state === "saved" ? "Réglages enregistrés." : state === "error" ? error : ""}
        </span>
      </div>
    </Card>
  );
}
