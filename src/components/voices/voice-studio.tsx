"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Plus,
  Trash2,
  Loader2,
  Check,
  Mic,
  Square,
  Play,
  Pause,
  Save,
  RotateCcw,
  Volume2,
  Music2,
  Music4,
  Waves,
  Gauge,
  Radio,
  SlidersHorizontal,
  Pencil,
  X,
  Link2,
  KeyRound,
} from "lucide-react";
import type { VoiceRecord } from "@/lib/db/voices";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VoicePreview } from "@/components/agents/wizard/voice-preview";
import {
  TTS_PROVIDERS,
  OPENAI_TTS_VOICES,
  PRESET_VOICES,
  presetsByCategory,
  type TtsProvider,
} from "@/lib/voices/catalog";
import {
  StudioEngine,
  DEFAULT_SETTINGS,
  type VoiceSettings,
} from "@/lib/audio/studio-engine";

const TTS_PROVIDER_IDS = ["elevenlabs", "cartesia", "openai"];

/** Lit l'ID de voix externe stocké dans les réglages, le cas échéant. */
function externalVoiceId(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw).externalVoiceId as string | undefined;
  } catch {
    return undefined;
  }
}

const GENDER_LABELS: Record<string, string> = {
  feminine: "Féminine",
  masculine: "Masculine",
  neutral: "Neutre",
};

const DEFAULT_SAMPLE =
  "Bonjour, je suis votre nouvel agent vocal. Ravi de vous accompagner aujourd'hui.";

function parseSettings(raw: string | null): VoiceSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------------------- Waveform -------------------------------- */

function Waveform({
  engine,
  active,
  className,
}: {
  engine: StudioEngine;
  active: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const drawFlat = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(120,110,105,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };

    const draw = () => {
      const analyser = engine.analyser;
      const w = canvas.width;
      const h = canvas.height;
      if (!analyser) {
        drawFlat();
        raf = requestAnimationFrame(draw);
        return;
      }
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#E8572A";
      ctx.beginPath();
      const slice = w / buf.length;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] / 128;
        const y = (v * h) / 2;
        const x = i * slice;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };

    if (active) raf = requestAnimationFrame(draw);
    else drawFlat();
    return () => cancelAnimationFrame(raf);
  }, [active, engine]);

  return (
    <canvas
      ref={ref}
      width={640}
      height={96}
      className={cn("h-24 w-full rounded-lg bg-secondary/40", className)}
    />
  );
}

/* --------------------------------- Fader --------------------------------- */

function Fader({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  icon: typeof Volume2;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          {label}
        </span>
        <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
    </div>
  );
}

/* ------------------------------ Voice library ----------------------------- */

function VoiceCard({
  voice,
  engine,
  onDelete,
  onEdit,
}: {
  voice: VoiceRecord;
  engine: StudioEngine;
  onDelete: (id: string) => void;
  onEdit: (v: VoiceRecord) => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const settings = parseSettings(voice.settings);
  const ext = externalVoiceId(voice.settings);
  const isProvider = TTS_PROVIDER_IDS.includes(voice.provider) && !!ext;

  async function preview() {
    if (speaking) {
      engine.stop();
      engine.stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    // Voix enregistrée au Studio : on rejoue le VRAI enregistrement (réglages appliqués).
    if (voice.sampleUrl) {
      try {
        const buffer = await engine.decode(voice.sampleUrl);
        engine.play(buffer, settings, () => setSpeaking(false));
        return;
      } catch {
        /* échantillon illisible : repli sur la synthèse */
      }
    }
    engine.speak(voice.sampleText || DEFAULT_SAMPLE, settings, "fr-FR", () =>
      setSpeaking(false),
    );
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
          <AudioLines className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex items-center gap-1.5">
          {voice.status === "ready" ? (
            <Badge variant="success">Prête</Badge>
          ) : (
            <Badge variant="muted">{voice.status}</Badge>
          )}
          <button
            type="button"
            onClick={() => onEdit(voice)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Éditer"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(voice.id)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            aria-label="Supprimer"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <h3 className="mt-3 truncate font-semibold tracking-tight text-foreground">
        {voice.name}
      </h3>
      <p className="text-xs text-muted-foreground">
        {[voice.gender ? GENDER_LABELS[voice.gender] : null, voice.accent]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {voice.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {voice.description}
        </p>
      )}

      {/* Empreinte des réglages */}
      <div className="mt-3 flex flex-wrap gap-1">
        {settings.pitch !== 0 && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            ton {settings.pitch > 0 ? "+" : ""}
            {settings.pitch}
          </span>
        )}
        {settings.rate !== 1 && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            débit {settings.rate.toFixed(2)}×
          </span>
        )}
        {settings.reverb > 0 && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            réverb {Math.round(settings.reverb * 100)}%
          </span>
        )}
        {voice.sampleUrl && (
          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[0.65rem] text-brand-700">
            échantillon
          </span>
        )}
        {isProvider && (
          <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[0.65rem] text-background">
            {voice.provider}
          </span>
        )}
      </div>

      <div className="mt-4 pt-0">
        {isProvider ? (
          <div className="[&>button]:w-full">
            <VoicePreview
              text={voice.sampleText || DEFAULT_SAMPLE}
              language="fr-FR"
              speed={settings.rate ?? 1}
              pitch={settings.pitch ?? 0}
              gender={voice.gender}
              provider={voice.provider}
              externalVoiceId={ext}
              label="Écouter"
            />
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={preview} className="w-full">
            {speaking ? (
              <>
                <Pause className="size-4" /> Arrêter
              </>
            ) : (
              <>
                <Play className="size-4" /> Écouter
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------- Studio --------------------------------- */

export function VoiceStudio({
  initial,
  showCatalog = true,
}: {
  initial: VoiceRecord[];
  showCatalog?: boolean;
}) {
  const [voices, setVoices] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [byId, setById] = useState(false);
  const engineRef = useRef<StudioEngine | null>(null);
  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new StudioEngine();
    return engineRef.current;
  }, []);

  useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Enregistrez, sculptez et synthétisez la voix de vos agents : micro réel,
          égaliseur, réverb et compression — comme une vraie console de studio.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setById((b) => !b)}>
            {byId ? <X className="size-4" /> : <Link2 className="size-4" />}
            {byId ? "Fermer" : "Ajouter par ID"}
          </Button>
          <Button variant="brand" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-4" /> : <Plus className="size-4" />}
            {open ? "Fermer" : "Nouvelle voix"}
          </Button>
        </div>
      </div>

      {byId && (
        <AddByIdForm
          onSaved={(v) => {
            setVoices((list) => [v, ...list]);
            setById(false);
          }}
        />
      )}

      {open && (
        <StudioConsole
          getEngine={getEngine}
          onSaved={(v, isEdit) => {
            setVoices((list) =>
              isEdit ? list.map((x) => (x.id === v.id ? v : x)) : [v, ...list],
            );
          }}
        />
      )}

      {voices.length === 0 ? (
        <Card className="p-10 text-center">
          <AudioLines className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Aucune voix</p>
          <p className="text-sm text-muted-foreground">
            Ouvrez le studio pour produire une voix sur-mesure.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {voices.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              engine={getEngine()}
              onDelete={async (id) => {
                if (!window.confirm("Supprimer cette voix ?")) return;
                const res = await fetch(`/api/voices/${id}`, { method: "DELETE" });
                if (res.ok) setVoices((list) => list.filter((x) => x.id !== id));
              }}
              onEdit={(voice) => {
                setOpen(true);
                // Le panneau lit l'édition via un événement personnalisé
                window.dispatchEvent(
                  new CustomEvent("studio:edit", { detail: voice }),
                );
              }}
            />
          ))}
        </div>
      )}

      {/* Bibliothèque de voix de la plateforme */}
      {showCatalog && (
      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight text-foreground">
            Voix de la plateforme · {PRESET_VOICES.length}
          </h2>
          <p className="text-sm text-muted-foreground">
            Des voix prêtes à l'emploi, toutes catégories — écoutez-les puis
            sélectionnez-les à la création d'un agent.
          </p>
        </div>
        {presetsByCategory().map((group) => (
          <div key={group.category} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.category}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.voices.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {v.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.description}
                    </p>
                  </div>
                  <VoicePreview
                    text={`Bonjour, je suis ${v.label}. Je serai ravi de vous accompagner aujourd'hui.`}
                    language={v.language}
                    speed={v.rate}
                    pitch={v.pitch}
                    gender={v.gender}
                    label="Écouter"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

/* --------------------------- Ajouter par ID ------------------------------- */

function AddByIdForm({ onSaved }: { onSaved: (v: VoiceRecord) => void }) {
  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voiceId, setVoiceId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("feminine");
  const [language, setLanguage] = useState("fr-FR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = TTS_PROVIDERS.find((p) => p.id === provider)!;

  async function save() {
    if (!name.trim() || !voiceId.trim()) {
      setError("Un nom et un ID de voix sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        provider,
        gender,
        accent: meta.label,
        description: `Voix ${meta.label} · ID ${voiceId}`,
        settings: JSON.stringify({ externalVoiceId: voiceId, rate: 1, pitch: 0 }),
      }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data.voice);
    else setError(data.error ?? "Erreur lors de l'ajout.");
    setSaving(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-4">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
          <Link2 className="size-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Ajouter une voix par ID
          </p>
          <p className="text-xs text-muted-foreground">
            ElevenLabs · Cartesia · OpenAI
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fournisseur</label>
            <Select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as TtsProvider);
                setVoiceId("");
              }}
            >
              {TTS_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              {meta.idLabel}
            </label>
            {provider === "openai" ? (
              <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                <option value="">— Choisir une voix —</option>
                {OPENAI_TTS_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder={meta.idPlaceholder}
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nom</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voix ElevenLabs Pro"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Genre</label>
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="feminine">Féminine</option>
              <option value="masculine">Masculine</option>
              <option value="neutral">Neutre</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Langue</label>
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="fr-FR"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {meta.note} Définissez{" "}
            <code className="font-mono text-foreground">{meta.envKey}</code> côté
            serveur pour l'audio réel ; sinon l'écoute utilise une voix du
            navigateur.
          </span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="brand"
            onClick={save}
            disabled={saving || !name.trim() || !voiceId.trim()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Ajouter à la bibliothèque
          </Button>
          {voiceId.trim() && (
            <VoicePreview
              text="Bonjour, ceci est un essai de la voix sélectionnée."
              language={language}
              speed={1}
              gender={gender}
              provider={provider}
              externalVoiceId={voiceId}
              label="Tester la voix"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Studio console ----------------------------- */

type RecState = "idle" | "recording" | "recorded";

function StudioConsole({
  getEngine,
  onSaved,
}: {
  getEngine: () => StudioEngine;
  onSaved: (v: VoiceRecord, isEdit: boolean) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    name: "",
    gender: "feminine",
    accent: "Français standard",
    description: "",
    sampleText: DEFAULT_SAMPLE,
  });
  const [settings, setSettings] = useState<VoiceSettings>({ ...DEFAULT_SETTINGS });
  const [tab, setTab] = useState("record");

  // Enregistrement
  const [rec, setRec] = useState<RecState>("idle");
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recSupported = StudioEngine.isRecordingSupported();

  // Lecture / synthèse
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<VoiceSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  // Charge la liste des voix système (synthèse)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const list = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang?.toLowerCase().startsWith("fr"));
      setTtsVoices(list.length ? list : window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Édition d'une voix existante (déclenchée depuis une carte)
  useEffect(() => {
    const handler = (e: Event) => {
      const v = (e as CustomEvent<VoiceRecord>).detail;
      setEditId(v.id);
      setMeta({
        name: v.name,
        gender: v.gender ?? "feminine",
        accent: v.accent ?? "Français standard",
        description: v.description ?? "",
        sampleText: v.sampleText ?? DEFAULT_SAMPLE,
      });
      setSettings(parseSettings(v.settings));
      if (v.sampleUrl) {
        setRecUrl(v.sampleUrl);
        setRec("recorded");
        bufferRef.current = null;
      } else {
        setRecUrl(null);
        setRec("idle");
      }
      setTab("mix");
    };
    window.addEventListener("studio:edit", handler);
    return () => window.removeEventListener("studio:edit", handler);
  }, []);

  // Minuteur d'enregistrement
  useEffect(() => {
    if (rec !== "recording") return;
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      100,
    );
    return () => window.clearInterval(id);
  }, [rec]);

  async function startRec() {
    setError(null);
    try {
      await getEngine().startRecording();
      setRec("recording");
    } catch {
      setError("Micro indisponible. Autorisez l'accès au microphone, ou utilisez l'onglet Synthèse.");
    }
  }

  async function stopRec() {
    try {
      const { dataUrl } = await getEngine().stopRecording();
      setRecUrl(dataUrl);
      bufferRef.current = await getEngine().decode(dataUrl);
      setRec("recorded");
      setTab("mix");
    } catch {
      setError("Échec de l'enregistrement.");
      setRec("idle");
    }
  }

  async function playProcessed() {
    const engine = getEngine();
    if (playing) {
      engine.stop();
      setPlaying(false);
      return;
    }
    if (!bufferRef.current && recUrl) {
      bufferRef.current = await engine.decode(recUrl);
    }
    if (!bufferRef.current) return;
    setPlaying(true);
    engine.play(bufferRef.current, settings, () => setPlaying(false));
  }

  function speak() {
    const engine = getEngine();
    if (speaking) {
      engine.stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    engine.speak(meta.sampleText, settings, "fr-FR", () => setSpeaking(false));
  }

  function reset() {
    setSettings({ ...DEFAULT_SETTINGS });
  }

  async function save() {
    if (!meta.name.trim()) {
      setError("Donnez un nom à la voix.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      ...meta,
      settings: JSON.stringify(settings),
      sampleUrl: recUrl ?? undefined,
    };
    const res = await fetch(
      editId ? `/api/voices/${editId}` : "/api/voices",
      {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (res.ok) {
      onSaved(data.voice, !!editId);
      // réinitialise la console
      setEditId(null);
      setMeta({
        name: "",
        gender: "feminine",
        accent: "Français standard",
        description: "",
        sampleText: DEFAULT_SAMPLE,
      });
      setSettings({ ...DEFAULT_SETTINGS });
      setRec("idle");
      setRecUrl(null);
      bufferRef.current = null;
      setTab("record");
    } else {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  }

  const engine = getEngine();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      {/* En-tête console */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-4">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
          <SlidersHorizontal className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            {editId ? "Édition de la voix" : "Console de studio"}
          </p>
          <p className="text-xs text-muted-foreground">
            Enregistrez · Mixez · Synthétisez
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="record">
              <Mic className="mr-1.5 inline size-3.5" /> Enregistrer
            </TabsTrigger>
            <TabsTrigger value="mix">
              <SlidersHorizontal className="mr-1.5 inline size-3.5" /> Mixage
            </TabsTrigger>
            <TabsTrigger value="synth">
              <Radio className="mr-1.5 inline size-3.5" /> Synthèse
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5">
        <Tabs value={tab} onValueChange={setTab}>
          {/* ----- Enregistrer ----- */}
          <TabsContent value="record" className="space-y-4">
            <Waveform engine={engine} active={rec === "recording"} />
            <div className="flex items-center justify-center gap-4">
              {rec !== "recording" ? (
                <Button
                  variant="brand"
                  onClick={startRec}
                  disabled={!recSupported}
                >
                  <Mic className="size-4" />
                  {rec === "recorded" ? "Réenregistrer" : "Enregistrer"}
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRec}>
                  <Square className="size-4 fill-current" />
                  Arrêter
                </Button>
              )}
              {rec === "recording" && (
                <span className="flex items-center gap-2 font-mono text-sm tabular-nums text-foreground">
                  <span className="inline-block size-2 animate-pulse rounded-full bg-destructive" />
                  {fmtTime(elapsed)}
                </span>
              )}
              {rec === "recorded" && (
                <Button variant="outline" onClick={playProcessed}>
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                  Écouter le clip
                </Button>
              )}
            </div>
            {!recSupported && (
              <p className="text-center text-xs text-muted-foreground">
                L'enregistrement micro n'est pas disponible ici. Vous pouvez tout de
                même régler et écouter la voix dans l'onglet Synthèse.
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Astuce : enregistrez 3 à 8 secondes de parole claire, puis passez au
              Mixage pour la sculpter.
            </p>
          </TabsContent>

          {/* ----- Mixage ----- */}
          <TabsContent value="mix" className="space-y-5">
            <Waveform engine={engine} active={playing} />
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <Fader
                label="Hauteur (ton)"
                icon={Music4}
                value={settings.pitch}
                min={-12}
                max={12}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} demi-tons`}
                onChange={(v) => set({ pitch: v })}
              />
              <Fader
                label="Débit"
                icon={Gauge}
                value={settings.rate}
                min={0.5}
                max={1.5}
                step={0.05}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(v) => set({ rate: v })}
              />
              <Fader
                label="Volume"
                icon={Volume2}
                value={settings.gain}
                min={0}
                max={2}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => set({ gain: v })}
              />
              <Fader
                label="Compression"
                icon={Gauge}
                value={settings.compression}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => set({ compression: v })}
              />
              <Fader
                label="Graves"
                icon={Waves}
                value={settings.eqLow}
                min={-18}
                max={18}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
                onChange={(v) => set({ eqLow: v })}
              />
              <Fader
                label="Médiums"
                icon={Music2}
                value={settings.eqMid}
                min={-18}
                max={18}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
                onChange={(v) => set({ eqMid: v })}
              />
              <Fader
                label="Aigus"
                icon={Music4}
                value={settings.eqHigh}
                min={-18}
                max={18}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
                onChange={(v) => set({ eqHigh: v })}
              />
              <Fader
                label="Réverbération"
                icon={Radio}
                value={settings.reverb}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => set({ reverb: v })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="default"
                onClick={playProcessed}
                disabled={rec !== "recorded"}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                Écouter le rendu
              </Button>
              <Button variant="outline" onClick={speak}>
                {speaking ? <Pause className="size-4" /> : <Radio className="size-4" />}
                Tester en synthèse
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="size-4" />
                Réinitialiser
              </Button>
              {rec !== "recorded" && (
                <span className="text-xs text-muted-foreground">
                  « Écouter le rendu » nécessite un enregistrement — sinon utilisez la
                  synthèse.
                </span>
              )}
            </div>
          </TabsContent>

          {/* ----- Synthèse ----- */}
          <TabsContent value="synth" className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Voix de synthèse (système)
              </label>
              <Select
                value={settings.voiceURI ?? ""}
                onChange={(e) => set({ voiceURI: e.target.value || undefined })}
              >
                <option value="">Automatique (selon la langue)</option>
                {ttsVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Texte d'essai
              </label>
              <Input
                value={meta.sampleText}
                onChange={(e) => setMeta({ ...meta, sampleText: e.target.value })}
              />
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">
                La synthèse applique <strong className="text-foreground">hauteur</strong>,{" "}
                <strong className="text-foreground">débit</strong> et{" "}
                <strong className="text-foreground">volume</strong> — exactement les
                réglages que vos agents utiliseront pendant un appel.
              </p>
            </div>
            <Button variant="brand" onClick={speak}>
              {speaking ? <Pause className="size-4" /> : <Play className="size-4" />}
              {speaking ? "Arrêter" : "Écouter la synthèse"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pied : métadonnées + sauvegarde */}
      <div className="space-y-4 border-t border-border bg-secondary/30 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Nom de la voix
            </label>
            <Input
              value={meta.name}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              placeholder="Voix Accueil Premium"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Genre</label>
            <Select
              value={meta.gender}
              onChange={(e) => setMeta({ ...meta, gender: e.target.value })}
            >
              <option value="feminine">Féminine</option>
              <option value="masculine">Masculine</option>
              <option value="neutral">Neutre</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Accent</label>
            <Input
              value={meta.accent}
              onChange={(e) => setMeta({ ...meta, accent: e.target.value })}
              placeholder="Français standard"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Description du timbre (optionnel)
          </label>
          <Input
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            placeholder="Chaleureuse, posée, légèrement grave"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button variant="brand" onClick={save} disabled={saving || !meta.name.trim()}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editId ? (
              <Check className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {editId ? "Mettre à jour la voix" : "Enregistrer dans la bibliothèque"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {recUrl ? "Échantillon capturé · " : ""}
            Réglages prêts à être utilisés par vos agents.
          </span>
        </div>
      </div>
    </div>
  );
}
