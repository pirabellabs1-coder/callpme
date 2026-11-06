"use client";

import Link from "next/link";
import { LANGUAGES } from "@/lib/agents/catalog";
import {
  PRESET_VOICES,
  getPresetVoice,
  presetsByCategory,
} from "@/lib/voices/catalog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { VoicePreview } from "./voice-preview";
import { FieldError, fieldId, invalidProps } from "./controls";
import type {
  SetWizardState,
  StepErrors,
  StudioVoiceOption,
  WizardState,
} from "./state";

const GENDER_LABEL: Record<string, string> = {
  feminine: "Féminine",
  masculine: "Masculine",
  neutral: "Neutre",
};

const FALLBACK_TEXT =
  "Bonjour, je suis votre agent vocal. Comment puis-je vous aider ?";

export function StepVoice({
  s,
  set,
  errors,
  studioVoices,
}: {
  s: WizardState;
  set: SetWizardState;
  errors: StepErrors;
  studioVoices: StudioVoiceOption[];
}) {
  const selectedStudio = studioVoices.find((v) => v.id === s.voiceId);
  const isStudioVoice = Boolean(selectedStudio);
  const selectedPreset = getPresetVoice(s.voiceId);

  return (
    <>
      {studioVoices.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="studioVoice">Voix entraînée (Studio Voix)</Label>
          <Select
            id="studioVoice"
            value={isStudioVoice ? s.voiceId : ""}
            onChange={(e) => {
              const val = e.target.value;
              set({ voiceId: val || PRESET_VOICES[0]?.id || "" });
            }}
          >
            <option value="">
              — Aucune (utiliser une voix de la plateforme) —
            </option>
            {studioVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.gender ? ` — ${GENDER_LABEL[v.gender] ?? v.gender}` : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Vos voix produites au{" "}
            <Link href="/voices" className="text-brand-700 hover:underline">
              Studio Voix
            </Link>{" "}
            — leurs réglages (hauteur, débit, voix) s&apos;appliquent pendant
            les appels.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fieldId("voice")}>Voix de la plateforme</Label>
          <Select
            id={fieldId("voice")}
            value={isStudioVoice ? "" : s.voiceId}
            disabled={isStudioVoice}
            onChange={(e) => {
              const pv = getPresetVoice(e.target.value);
              set({
                voiceId: e.target.value,
                ...(pv ? { language: pv.language, speed: pv.rate } : {}),
              });
            }}
            {...invalidProps("voice", errors.voice)}
          >
            {isStudioVoice && (
              <option value="">Voix Studio sélectionnée</option>
            )}
            {presetsByCategory().map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <FieldError name="voice" message={errors.voice} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("language")}>Langue</Label>
          <Select
            id={fieldId("language")}
            value={s.language}
            disabled={isStudioVoice}
            onChange={(e) => set({ language: e.target.value })}
            {...invalidProps("language", errors.language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
          <FieldError name="language" message={errors.language} />
        </div>
      </div>

      {/* Écoute d'un échantillon */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {selectedStudio
              ? `Aperçu — ${selectedStudio.name}`
              : selectedPreset
                ? `Aperçu — ${selectedPreset.label}`
                : "Aperçu de la voix"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedStudio
              ? selectedStudio.sampleUrl
                ? "Votre voix enregistrée au Studio — écoute du vrai enregistrement."
                : "Voix Studio (réglages synthèse)."
              : (selectedPreset?.description ??
                (s.firstMessage || FALLBACK_TEXT))}
          </p>
        </div>
        <VoicePreview
          text={s.firstMessage || FALLBACK_TEXT}
          language={s.language}
          speed={s.speed}
          pitch={selectedPreset?.pitch ?? 0}
          gender={selectedStudio?.gender ?? selectedPreset?.gender}
          sampleUrl={selectedStudio?.sampleUrl}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="speed">Débit de parole</Label>
          <span className="mono text-xs text-muted-foreground" aria-hidden>
            {s.speed.toFixed(2)}×
          </span>
        </div>
        <Slider
          id="speed"
          min={0.8}
          max={1.2}
          step={0.05}
          value={s.speed}
          onValueChange={(v) => set({ speed: v })}
        />
        <div
          className="flex justify-between text-[0.7rem] text-muted-foreground"
          aria-hidden
        >
          <span>Lent</span>
          <span>Naturel</span>
          <span>Rapide</span>
        </div>
      </div>
    </>
  );
}
