"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Square, Trash2, Volume2 } from "lucide-react";
import { saveStudioVoice } from "@/app/actions/studio-voices";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SamplePlayButton } from "./sample-play-button";
import { LanguageOptions } from "@/components/agents/wizard/language-options";
import { effectiveBilingual } from "@/lib/voice-engine/languages";
import {
  DEFAULT_TUNING,
  MAX_PRONUNCIATIONS,
  TUNING_PRESETS,
  type Pronunciation,
  type VoiceTuning,
} from "@/lib/voices/tuning";

export interface StudioBaseVoice {
  id: string;
  name: string;
  gender: string | null;
  accent: string | null;
  provider: string;
  externalId: string;
  previewUrl: string | null;
}

export interface VoiceStudioInitial {
  id?: string;
  name: string;
  description: string;
  baseVoiceId: string;
  tuning: VoiceTuning;
  pronunciations: Pronunciation[];
}

const GENDER: Record<string, string> = { feminine: "Femme", masculine: "Homme", neutral: "Neutre" };
const DEFAULT_TEXT =
  "Bonjour et bienvenue chez nous. Je suis votre assistante. Notre agence de Cotonou est ouverte du lundi au samedi. Comment puis-je vous aider ?";

type Row = Pronunciation & { key: number };

function Setting({
  id,
  label,
  hint,
  left,
  right,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  left: string;
  right: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="mono text-xs tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider id={id} min={min} max={max} step={step} value={value} onValueChange={onChange} aria-describedby={`${id}-hint`} />
      <div className="flex justify-between text-[0.7rem] text-muted-foreground" aria-hidden>
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** Studio de réglage d'une voix : vrais paramètres ElevenLabs + dictionnaire de prononciation. */
export function VoiceStudio({
  baseVoices,
  initial,
  canEdit,
  clone,
}: {
  baseVoices: StudioBaseVoice[];
  initial: VoiceStudioInitial;
  canEdit: boolean;
  /** Voix clonée : son propre timbre est conservé, pas de voix de départ. */
  clone?: { provider: string; externalId: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [baseId, setBaseId] = useState(clone ? "" : initial.baseVoiceId || baseVoices[0]?.id || "");
  const [tuning, setTuning] = useState<VoiceTuning>(initial.tuning);
  const nextKey = useRef(initial.pronunciations.length);
  const [rows, setRows] = useState<Row[]>(initial.pronunciations.map((p, i) => ({ ...p, key: i })));
  const [text, setText] = useState(DEFAULT_TEXT);
  // Langue de l'écoute : la voix est la même, la synthèse suit la langue (comme au téléphone).
  const [language, setLanguage] = useState("fr-FR");
  const [listen, setListen] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);

  const base = baseVoices.find((v) => v.id === baseId);
  // Voix réellement jouée : le clone, ou la voix du catalogue choisie.
  const source = clone ?? (base ? { provider: base.provider, externalId: base.externalId } : null);
  const preset = TUNING_PRESETS.find((p) => JSON.stringify(p.tuning) === JSON.stringify(tuning))?.key;
  const pronunciations = rows.map(({ word, say }) => ({ word: word.trim(), say: say.trim() })).filter((p) => p.word && p.say);

  useEffect(() => () => audio.current?.pause(), []);
  const tune = (patch: Partial<VoiceTuning>) => {
    setTuning((t) => ({ ...t, ...patch }));
    setSaved(false);
  };

  function stop() {
    audio.current?.pause();
    audio.current = null;
    setListen("idle");
  }

  async function play() {
    if (!source) return;
    stop();
    setError(null);
    setListen("loading");
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: source.provider,
          voiceId: source.externalId,
          text: text.trim() || DEFAULT_TEXT,
          language,
          // Wolof : bilingue imposé, la voix n'est pas forcée dans la langue (comme à l'appel).
          ...(effectiveBilingual(language, false) ? { bilingual: true } : {}),
          tuning,
          pronunciations,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { audio?: string | null; error?: string };
      if (!data.audio) {
        setError(data.error || "Écoute indisponible pour le moment. Réessayez dans un instant.");
        setListen("idle");
        return;
      }
      const a = new Audio(data.audio);
      audio.current = a;
      a.onended = () => setListen("idle");
      a.onerror = () => setListen("idle");
      setListen("playing");
      await a.play();
    } catch {
      setError("Écoute indisponible pour le moment. Réessayez dans un instant.");
      setListen("idle");
    }
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveStudioVoice({
        id: initial.id,
        name,
        description: description || undefined,
        baseVoiceId: baseId,
        tuning,
        pronunciations,
      });
      if (r.error) return setError(r.error);
      setSaved(true);
      if (!initial.id && r.id) router.replace(`/voices/studio/${r.id}`);
      router.refresh();
    });
  }

  const updateRow = (key: number, patch: Partial<Pronunciation>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Identité</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="studio-name">Nom de la voix</Label>
              <Input
                id="studio-name"
                value={name}
                maxLength={60}
                placeholder="Ex. Accueil Cotonou"
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
            {clone ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Voix de départ</p>
                <p className="text-sm text-muted-foreground">Votre voix clonée : son timbre est conservé, seuls les réglages changent.</p>
              </div>
            ) : (
            <div className="space-y-2">
              <Label htmlFor="studio-base">Voix de départ</Label>
              <div className="flex items-center gap-2">
                <Select
                  id="studio-base"
                  value={baseId}
                  onChange={(e) => {
                    setBaseId(e.target.value);
                    setSaved(false);
                  }}
                >
                  {baseVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {[v.gender ? GENDER[v.gender] : null, v.accent].filter(Boolean).length
                        ? ` — ${[v.gender ? GENDER[v.gender] : null, v.accent].filter(Boolean).join(", ")}`
                        : ""}
                    </option>
                  ))}
                </Select>
                {base?.previewUrl && <SamplePlayButton key={base.id} src={base.previewUrl} label={`Écouter ${base.name} d'origine`} />}
              </div>
            </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="studio-desc">Description (facultatif)</Label>
            <Input
              id="studio-desc"
              value={description}
              maxLength={300}
              placeholder="Ex. Voix posée pour le service client"
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
            />
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Réglages</h2>
            <div role="radiogroup" aria-label="Point de départ" className="flex flex-wrap gap-2">
              {TUNING_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={preset === p.key}
                  title={p.hint}
                  onClick={() => tune(p.tuning)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
                    preset === p.key ? "border-brand bg-brand/5 text-foreground" : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Setting
              id="t-stability"
              label="Stabilité"
              hint="Basse : plus d'expression et de variations. Haute : ton régulier, très prévisible."
              left="Expressive"
              right="Régulière"
              value={tuning.stability}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => tune({ stability: v })}
            />
            <Setting
              id="t-speed"
              label="Vitesse"
              hint="Un débit un peu plus lent aide au téléphone, surtout sur les réseaux mobiles."
              left="Lente"
              right="Rapide"
              value={tuning.speed}
              min={0.7}
              max={1.2}
              step={0.02}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => tune({ speed: v })}
            />
            <Setting
              id="t-similarity"
              label="Fidélité au timbre"
              hint="Plus haut : plus proche de la voix d'origine. Trop haut peut reproduire des défauts."
              left="Libre"
              right="Fidèle"
              value={tuning.similarity}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => tune({ similarity: v })}
            />
            <Setting
              id="t-style"
              label="Émotion"
              hint="Accentue le style et l'émotion de la voix. Laissez bas pour un service client sobre."
              left="Sobre"
              right="Marquée"
              value={tuning.style}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => tune({ style: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p id="t-boost-label" className="text-sm font-medium">
                Netteté renforcée
              </p>
              <p className="text-xs text-muted-foreground">Rend la voix plus nette et plus présente, au prix d&apos;une latence un peu plus élevée.</p>
            </div>
            <Switch checked={tuning.speakerBoost} onCheckedChange={(v) => tune({ speakerBoost: v })} aria-label="Netteté renforcée" />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => tune(DEFAULT_TUNING)}>
            Revenir aux réglages d&apos;origine
          </Button>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Prononciation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Apprenez à la voix les noms propres, sigles et mots locaux : écrivez le mot, puis la façon de le dire. Par exemple
              « MTN » → « èm-té-ène », « Abomey-Calavi » → « Abomé Calavi ».
            </p>
          </div>
          {rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <Input
                    aria-label={`Mot ${i + 1}`}
                    value={r.word}
                    maxLength={40}
                    placeholder="Mot écrit"
                    onChange={(e) => updateRow(r.key, { word: e.target.value })}
                  />
                  <Input
                    aria-label={`Prononciation du mot ${i + 1}`}
                    value={r.say}
                    maxLength={80}
                    placeholder="Se dit…"
                    onChange={(e) => updateRow(r.key, { say: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer ${r.word || `le mot ${i + 1}`}`}
                    onClick={() => {
                      setRows((rs) => rs.filter((x) => x.key !== r.key));
                      setSaved(false);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length >= MAX_PRONUNCIATIONS}
            onClick={() => setRows((rs) => [...rs, { word: "", say: "", key: nextKey.current++ }])}
          >
            <Plus aria-hidden /> Ajouter un mot
          </Button>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Écouter</h2>
          <div className="space-y-2">
            <Label htmlFor="studio-text">Texte d&apos;essai</Label>
            <Textarea id="studio-text" rows={5} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-xs text-muted-foreground">Ajoutez-y vos mots du dictionnaire pour entendre leur prononciation.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="studio-language">Langue de l&apos;écoute</Label>
            <Select id="studio-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <LanguageOptions current={language} />
            </Select>
            <p className="text-xs text-muted-foreground">Écrivez le texte d&apos;essai dans cette langue.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={listen === "idle" ? play : stop}
            disabled={listen === "loading" || !source}
          >
            {listen === "loading" ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Génération…
              </>
            ) : listen === "playing" ? (
              <>
                <Square aria-hidden /> Arrêter
              </>
            ) : (
              <>
                <Volume2 aria-hidden /> Écouter avec ces réglages
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">C&apos;est exactement ce qu&apos;entendront vos appelants au téléphone.</p>
        </Card>

        <Card className="space-y-3 p-5">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="text-sm text-success">
              Voix enregistrée. Les agents qui l&apos;utilisent la prennent dès leur prochain appel.
            </p>
          )}
          <Button type="button" variant="brand" className="w-full" onClick={save} disabled={pending || !canEdit || !source}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {initial.id ? "Enregistrer les modifications" : "Enregistrer ma voix"}
          </Button>
          {!canEdit && <p className="text-xs text-muted-foreground">Seuls les administrateurs de l&apos;organisation peuvent enregistrer une voix.</p>}
        </Card>
      </aside>
    </div>
  );
}
