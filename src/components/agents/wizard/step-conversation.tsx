"use client";

import {
  ChevronDown,
  Clock,
  Ear,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { ModelProvider } from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { MODEL_PROVIDERS, MODELS } from "@/lib/agents/catalog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCard, FieldError, fieldId, invalidProps } from "./controls";
import type { SetWizardState, StepErrors, WizardState } from "./state";

export function StepConversation({
  s,
  set,
  errors,
  advancedOpen,
  onAdvancedOpenChange,
  onFirstMessageEdit,
  onPromptEdit,
  onRegeneratePrompt,
}: {
  s: WizardState;
  set: SetWizardState;
  errors: StepErrors;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onFirstMessageEdit: (value: string) => void;
  onPromptEdit: (value: string) => void;
  onRegeneratePrompt: () => void;
}) {
  return (
    <>
      {/* Qui parle en premier */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">
          Qui parle en premier ?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ChoiceCard
            selected={s.firstSpeaker === "agent"}
            onClick={() => set({ firstSpeaker: "agent" })}
            icon={Megaphone}
            title="L'agent"
            note="Décroche et lance le message d'accueil"
          />
          <ChoiceCard
            selected={s.firstSpeaker === "caller"}
            onClick={() => set({ firstSpeaker: "caller" })}
            icon={Ear}
            title="L'appelant"
            note="L'agent écoute d'abord, puis répond"
          />
        </div>
      </fieldset>

      {s.firstSpeaker === "agent" && (
        <div className="space-y-2">
          <Label htmlFor={fieldId("firstMessage")}>
            Message d&apos;accueil
          </Label>
          <Textarea
            id={fieldId("firstMessage")}
            value={s.firstMessage}
            onChange={(e) => onFirstMessageEdit(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={s.role ? ROLE_META[s.role].firstMessage : ""}
            aria-describedby={
              errors.firstMessage ? "error-firstMessage" : "first-msg-hint"
            }
            aria-invalid={errors.firstMessage ? true : undefined}
          />
          <p id="first-msg-hint" className="text-xs text-muted-foreground">
            La première phrase entendue par l&apos;appelant. Laissez vide pour
            utiliser le message proposé par le rôle.
          </p>
          <FieldError name="firstMessage" message={errors.firstMessage} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="persona">Personnalité (optionnel)</Label>
        <Input
          id="persona"
          value={s.persona}
          onChange={(e) => set({ persona: e.target.value })}
          placeholder="Ex : chaleureuse, directe, sans jargon"
          maxLength={200}
        />
      </div>

      {/* Réglages avancés (modèle, prompt, durée) */}
      <details
        open={advancedOpen}
        onToggle={(e) => onAdvancedOpenChange(e.currentTarget.open)}
        className="group rounded-xl border border-border"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-foreground/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Réglages avancés
            </span>
            <span className="block text-xs text-muted-foreground">
              Modèle d&apos;IA, instructions détaillées, durée maximale
            </span>
          </span>
          {(errors.modelId || errors.systemPrompt) && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[0.7rem] font-medium text-destructive">
              À corriger
            </span>
          )}
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>

        <div className="space-y-5 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model-provider">Fournisseur du modèle</Label>
              <Select
                id="model-provider"
                value={s.modelProvider}
                onChange={(e) => {
                  const p = e.target.value as ModelProvider;
                  set({ modelProvider: p, modelId: MODELS[p]?.[0]?.id ?? "" });
                }}
              >
                {MODEL_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("modelId")}>Version</Label>
              <Select
                id={fieldId("modelId")}
                value={s.modelId}
                onChange={(e) => set({ modelId: e.target.value })}
                {...invalidProps("modelId", errors.modelId)}
              >
                {(MODELS[s.modelProvider] ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.note}
                  </option>
                ))}
              </Select>
              <FieldError name="modelId" message={errors.modelId} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temp">Température</Label>
              <span className="mono text-xs text-muted-foreground" aria-hidden>
                {s.temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              id="temp"
              min={0}
              max={1}
              step={0.1}
              value={s.temperature}
              onValueChange={(v) => set({ temperature: v })}
            />
            <div
              className="flex justify-between text-[0.7rem] text-muted-foreground"
              aria-hidden
            >
              <span>Précis &amp; constant</span>
              <span>Créatif &amp; varié</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={fieldId("systemPrompt")}>
                Instructions (prompt système)
              </Label>
              <button
                type="button"
                onClick={onRegeneratePrompt}
                disabled={!s.role}
                className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-brand-700 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Régénérer depuis le rôle
              </button>
            </div>
            <Textarea
              id={fieldId("systemPrompt")}
              value={s.systemPrompt}
              onChange={(e) => onPromptEdit(e.target.value)}
              rows={12}
              className="font-mono text-[0.8rem] leading-relaxed"
              {...invalidProps("systemPrompt", errors.systemPrompt)}
            />
            <FieldError name="systemPrompt" message={errors.systemPrompt} />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-brand" aria-hidden />
              Généré automatiquement depuis le rôle. Modifiable librement.
            </p>
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="maxdur" className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" aria-hidden />
              Durée max d&apos;un appel (minutes)
            </Label>
            <Input
              id="maxdur"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={s.maxDurationMin}
              aria-describedby="maxdur-hint"
              onChange={(e) =>
                set({
                  maxDurationMin: Math.min(
                    120,
                    Math.max(0, Number(e.target.value) || 0),
                  ),
                })
              }
            />
            <p id="maxdur-hint" className="text-xs text-muted-foreground">
              0 = sans limite. 120 minutes maximum.
            </p>
          </div>
        </div>
      </details>
    </>
  );
}
