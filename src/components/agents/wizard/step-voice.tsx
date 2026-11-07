"use client";

import Link from "next/link";
import { LANGUAGES } from "@/lib/agents/catalog";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SamplePlayButton } from "@/components/voices/sample-play-button";
import { VoicePreview } from "./voice-preview";
import { LanguageOptions } from "./language-options";
import { FieldError, fieldId, invalidProps } from "./controls";
import type { SetWizardState, StepErrors, StudioVoiceOption, WizardState } from "./state";

export const GENDER_LABEL: Record<string, string> = {
  feminine: "Femme",
  masculine: "Homme",
  neutral: "Neutre",
};

const FALLBACK_TEXT = "Bonjour, je suis votre agent vocal. Comment puis-je vous aider ?";

function VoiceList({
  title,
  voices,
  selectedId,
  onSelect,
}: {
  title: string;
  voices: StudioVoiceOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (voices.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{title}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {voices.map((v) => {
          const selected = v.id === selectedId;
          return (
            <label
              key={v.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring/55",
                selected ? "border-brand bg-brand/5" : "border-border hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="voice"
                value={v.id}
                checked={selected}
                onChange={() => onSelect(v.id)}
                className="mt-1 accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{v.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[v.gender ? GENDER_LABEL[v.gender] : null, v.accent].filter(Boolean).join(" · ") || "Voix"}
                </span>
                {v.description && (
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{v.description}</span>
                )}
              </span>
              {v.sampleUrl && <SamplePlayButton src={v.sampleUrl} label={`Écouter ${v.name}`} />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function StepVoice({
  s,
  set,
  errors,
  studioVoices,
  onLanguageChange,
}: {
  s: WizardState;
  set: SetWizardState;
  errors: StepErrors;
  studioVoices: StudioVoiceOption[];
  /** Langue ou mode bilingue changés (l'accueil proposé suit la langue). */
  onLanguageChange: (patch: Partial<Pick<WizardState, "language" | "bilingual">>) => void;
}) {
  const catalog = studioVoices.filter((v) => v.catalog);
  const own = studioVoices.filter((v) => !v.catalog);
  const selected = studioVoices.find((v) => v.id === s.voiceId);
  const choose = (id: string) => set({ voiceId: id });
  const language = LANGUAGES.find((l) => l.id === s.language);

  return (
    <>
      {studioVoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucune voix n&apos;est encore disponible. Les voix sont ajoutées au catalogue par l&apos;équipe Callpme.
        </p>
      ) : (
        <div className="space-y-5" id={fieldId("voice")}>
          <VoiceList title="Voix Callpme" voices={catalog} selectedId={s.voiceId} onSelect={choose} />
          <VoiceList title="Vos voix" voices={own} selectedId={s.voiceId} onSelect={choose} />
          <FieldError name="voice" message={errors.voice} />
          <p className="text-xs text-muted-foreground">
            Toutes les voix sont de vraies voix : celle que vous écoutez ici est celle qu&apos;entendront vos appelants.
            Retrouvez-les toutes dans{" "}
            <Link href="/voices" className="text-brand-700 hover:underline">
              Voix
            </Link>
            .
          </p>
        </div>
      )}

      {/* Écoute de la voix choisie avec le message d'accueil de l'agent */}
      {selected?.providerVoiceId && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Aperçu — {selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">{s.firstMessage || FALLBACK_TEXT}</p>
          </div>
          <VoicePreview
            text={s.firstMessage || FALLBACK_TEXT}
            language={s.language}
            bilingual={Boolean(language?.local && (s.bilingual || language.bilingualOnly))}
            speed={s.speed}
            gender={selected.gender}
            {...(selected.provider === "callpme"
              ? // Voix maison : l'échantillon généré à la publication (pas de GPU à chaque écoute).
                { sampleUrl: selected.sampleUrl }
              : {
                  provider: selected.provider,
                  externalVoiceId: selected.providerVoiceId,
                  studioVoiceId: selected.catalog ? undefined : selected.id,
                })}
            label={selected.provider === "callpme" ? "Écouter un échantillon" : "Écouter avec votre accueil"}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={fieldId("language")}>Langue</Label>
        <Select
          id={fieldId("language")}
          value={s.language}
          onChange={(e) => onLanguageChange({ language: e.target.value })}
          {...invalidProps("language", errors.language)}
        >
          <LanguageOptions current={s.language} />
        </Select>
        <FieldError name="language" message={errors.language} />
        {language?.local && (
          <div className="mt-3 space-y-2 rounded-md border border-border p-3">
            {language.note && <p className="text-xs text-muted-foreground">{language.note}</p>}
            <div className="flex items-start gap-3">
              <Switch
                id="voice-bilingual"
                checked={s.bilingual || language.bilingualOnly}
                disabled={language.bilingualOnly}
                onCheckedChange={(v) => onLanguageChange({ bilingual: v })}
                aria-label="Mode bilingue français et langue locale"
              />
              <div>
                <Label htmlFor="voice-bilingual">Mode bilingue (français + {language.label.toLowerCase()})</Label>
                <p className="text-xs text-muted-foreground">
                  {language.bilingualOnly
                    ? "Toujours actif pour cette langue : l'agent comprend le mélange et répond surtout en français."
                    : "L'appelant peut mélanger les deux langues ; l'agent lui répond dans la langue qu'il utilise."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && !selected.catalog ? (
        <p className="text-xs text-muted-foreground">
          Le débit, le ton et la prononciation de « {selected.name} » se règlent au{" "}
          <Link href={`/voices/studio/${selected.id}`} className="text-brand-700 hover:underline">
            Studio
          </Link>
          .
        </p>
      ) : (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="speed">Débit de parole</Label>
          <span className="mono text-xs text-muted-foreground" aria-hidden>
            {s.speed.toFixed(2)}×
          </span>
        </div>
        <Slider id="speed" min={0.8} max={1.2} step={0.05} value={s.speed} onValueChange={(v) => set({ speed: v })} />
        <div className="flex justify-between text-[0.7rem] text-muted-foreground" aria-hidden>
          <span>Lent</span>
          <span>Naturel</span>
          <span>Rapide</span>
        </div>
      </div>
      )}
    </>
  );
}
