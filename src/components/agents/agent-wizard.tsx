"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Phone,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  Megaphone,
  Ear,
  Clock,
  FileText,
} from "lucide-react";
import type {
  Agent,
  AgentConfig,
  AgentRole,
  AgentStatus,
  CustomToolRecord,
  FirstSpeaker,
  ModelProvider,
  PhoneNumberRecord,
  VoiceProvider,
} from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import type { AgentTemplate } from "@/lib/agents/templates";
import { generateSystemPrompt, type PromptParams } from "@/lib/agents/role-templates";
import {
  LANGUAGES,
  MODEL_PROVIDERS,
  MODELS,
} from "@/lib/agents/catalog";
import {
  PRESET_VOICES,
  getPresetVoice,
  presetsByCategory,
} from "@/lib/voices/catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RolePicker } from "./wizard/role-picker";
import { ToolsPicker } from "./wizard/tools-picker";
import { CallPreview } from "./wizard/call-preview";
import { VoicePreview } from "./wizard/voice-preview";

const STEPS = [
  { n: 1, label: "Rôle" },
  { n: 2, label: "Voix" },
  { n: 3, label: "Cerveau" },
  { n: 4, label: "Outils" },
  { n: 5, label: "Téléphonie" },
];

interface State {
  name: string;
  role: AgentRole | null;
  status: AgentStatus;
  customRoleLabel: string;
  customRoleDescription: string;
  voiceProvider: VoiceProvider;
  voiceId: string;
  language: string;
  speed: number;
  modelProvider: ModelProvider;
  modelId: string;
  temperature: number;
  systemPrompt: string;
  firstMessage: string;
  firstSpeaker: FirstSpeaker;
  maxDurationMin: number;
  guardrails: string[];
  persona: string;
  tools: string[];
  phoneNumber: string | null;
  knowledgeBaseId: string;
}

function initialState(agent?: Agent, template?: AgentTemplate): State {
  if (agent) {
    return {
      name: agent.name,
      role: agent.role,
      status: agent.status,
      customRoleLabel: agent.config.customRole?.label ?? "",
      customRoleDescription: agent.config.customRole?.description ?? "",
      voiceProvider: agent.config.voice.provider,
      voiceId: agent.config.voice.voiceId,
      language: agent.config.voice.language,
      speed: agent.config.voice.speed,
      modelProvider: agent.config.model.provider,
      modelId: agent.config.model.modelId,
      temperature: agent.config.model.temperature,
      systemPrompt: agent.config.systemPrompt,
      firstMessage: agent.config.firstMessage,
      firstSpeaker: agent.config.firstSpeaker ?? "agent",
      maxDurationMin: agent.config.maxDurationSec
        ? Math.round(agent.config.maxDurationSec / 60)
        : 0,
      guardrails: agent.config.guardrails,
      persona: agent.config.persona ?? "",
      tools: agent.config.tools,
      phoneNumber: agent.phoneNumber ?? null,
      knowledgeBaseId: agent.knowledgeBaseId ?? "",
    };
  }
  return {
    name: template?.name ?? "",
    role: template?.role ?? null,
    status: "draft",
    customRoleLabel: "",
    customRoleDescription: "",
    voiceProvider: "elevenlabs",
    voiceId: "amelie",
    language: "fr-FR",
    speed: 1,
    modelProvider: "openai",
    modelId: "gpt-4o",
    temperature: 0.4,
    systemPrompt: "",
    firstMessage: template?.firstMessage ?? "",
    firstSpeaker: "agent",
    maxDurationMin: 0,
    guardrails: [],
    persona: template?.persona ?? "",
    tools: template ? ROLE_META[template.role].defaultTools : [],
    phoneNumber: null,
    knowledgeBaseId: "",
  };
}

function promptParams(st: State, orgName: string): PromptParams {
  return {
    role: st.role!,
    agentName: st.name || "l'agent",
    organizationName: orgName,
    guardrails: st.guardrails,
    persona: st.persona,
    enabledTools: st.tools,
    firstSpeaker: st.firstSpeaker,
    customRole:
      st.role === "custom"
        ? { label: st.customRoleLabel, description: st.customRoleDescription }
        : undefined,
  };
}

export function AgentWizard({
  organizationName,
  usedNumbers,
  availableNumbers,
  customTools,
  knowledgeBases,
  studioVoices,
  template,
  agent,
}: {
  organizationName: string;
  usedNumbers: string[];
  availableNumbers: PhoneNumberRecord[];
  customTools: CustomToolRecord[];
  knowledgeBases: { id: string; name: string }[];
  studioVoices: { id: string; name: string; gender: string | null }[];
  template?: AgentTemplate;
  agent?: Agent;
}) {
  const router = useRouter();
  const isEdit = Boolean(agent);
  const [step, setStep] = useState(1);
  const [s, setS] = useState<State>(() => initialState(agent, template));
  const [promptDirty, setPromptDirty] = useState(isEdit);
  const [firstMsgDirty, setFirstMsgDirty] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customToolsState, setCustomToolsState] = useState(customTools);

  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  const isStudioVoice = studioVoices.some((v) => v.id === s.voiceId);
  const selectedPreset = getPresetVoice(s.voiceId);
  const GENDER_LABEL: Record<string, string> = {
    feminine: "Féminine",
    masculine: "Masculine",
    neutral: "Neutre",
  };

  // Régénération du system prompt depuis le rôle (tant que non édité manuellement)
  useEffect(() => {
    if (s.role && !promptDirty) {
      setS((prev) => ({
        ...prev,
        systemPrompt: generateSystemPrompt(promptParams(prev, organizationName)),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s.role,
    s.name,
    s.guardrails,
    s.persona,
    s.tools,
    s.firstSpeaker,
    s.customRoleLabel,
    s.customRoleDescription,
    promptDirty,
  ]);

  function selectRole(role: AgentRole) {
    setS((prev) => ({
      ...prev,
      role,
      tools: ROLE_META[role].defaultTools,
      firstMessage: firstMsgDirty ? prev.firstMessage : ROLE_META[role].firstMessage,
    }));
  }

  function changeModelProvider(p: ModelProvider) {
    set({ modelProvider: p, modelId: MODELS[p]?.[0]?.id ?? "" });
  }

  function toggleTool(name: string) {
    setS((prev) => ({
      ...prev,
      tools: prev.tools.includes(name)
        ? prev.tools.filter((t) => t !== name)
        : [...prev.tools, name],
    }));
  }

  function regeneratePrompt() {
    if (!s.role) return;
    setPromptDirty(false);
    set({ systemPrompt: generateSystemPrompt(promptParams(s, organizationName)) });
  }

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!s.name.trim() || !s.role) return false;
      if (s.role === "custom") return s.customRoleLabel.trim().length > 0;
      return true;
    }
    if (step === 2) return Boolean(s.voiceId && s.language);
    if (step === 3) return Boolean(s.modelId);
    return true;
  }, [step, s]);

  async function submit(asDraft = false) {
    if (!s.role) {
      setError("Choisissez d'abord un rôle.");
      setStep(1);
      return;
    }
    if (asDraft && !s.name.trim()) {
      setError("Donnez un nom à l'agent pour l'enregistrer en brouillon.");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    const config: AgentConfig = {
      voice: {
        provider: s.voiceProvider,
        voiceId: s.voiceId,
        language: s.language,
        speed: s.speed,
      },
      model: {
        provider: s.modelProvider,
        modelId: s.modelId,
        temperature: s.temperature,
      },
      systemPrompt: s.systemPrompt,
      firstMessage: s.firstMessage || ROLE_META[s.role].firstMessage,
      firstSpeaker: s.firstSpeaker,
      guardrails: s.guardrails.map((g) => g.trim()).filter(Boolean),
      tools: s.tools,
      persona: s.persona.trim() || undefined,
      customRole:
        s.role === "custom"
          ? {
              label: s.customRoleLabel.trim(),
              description: s.customRoleDescription.trim(),
            }
          : undefined,
      maxDurationSec: s.maxDurationMin > 0 ? s.maxDurationMin * 60 : undefined,
    };
    const payload = {
      name: s.name.trim() || "Agent sans nom",
      role: s.role,
      status: asDraft ? ("draft" as AgentStatus) : s.status,
      config,
      phoneNumber: s.phoneNumber,
      knowledgeBaseId: s.knowledgeBaseId || null,
    };
    try {
      const res = await fetch(
        isEdit ? `/api/agents/${agent!.id}` : "/api/agents",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        setSubmitting(false);
        return;
      }
      router.push(`/agents/${data.agent.id}`);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
      setSubmitting(false);
    }
  }

  const voiceLabel = getPresetVoice(s.voiceId)?.label ?? s.voiceId;
  const modelLabel =
    MODELS[s.modelProvider]?.find((m) => m.id === s.modelId)?.label ?? s.modelId;
  const previewRole = s.role ?? "support";
  const previewRoleLabel =
    s.role === "custom" ? s.customRoleLabel || "Rôle personnalisé" : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={isEdit ? `/agents/${agent!.id}` : "/agents"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {isEdit ? "Retour à l'agent" : "Retour aux agents"}
        </Link>
        <h1 className="mt-3 text-display-sm font-semibold tracking-tight">
          {isEdit ? `Modifier ${agent!.name}` : "Créer un agent"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez le rôle, la voix et le comportement de votre agent vocal.
        </p>
      </div>

      <Stepper step={step} onStepClick={(n) => n < step && setStep(n)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            {step === 1 && (
              <StepShell
                title="Identité & rôle"
                description="Nommez votre agent et choisissez sa spécialité."
              >
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Nom de l'agent</Label>
                  <Input
                    id="agent-name"
                    value={s.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Ex : Camille — Support client"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <RolePicker value={s.role} onChange={selectRole} />
                </div>

                {s.role === "custom" && (
                  <div className="space-y-4 rounded-xl border border-brand/20 bg-brand-50/20 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-brand" />
                      <p className="text-sm font-medium text-foreground">
                        Définissez votre rôle
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crole-label">Nom du rôle</Label>
                      <Input
                        id="crole-label"
                        value={s.customRoleLabel}
                        onChange={(e) => set({ customRoleLabel: e.target.value })}
                        placeholder="Ex : Conciergerie, Recouvrement, Hotline technique…"
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crole-desc">Mission de l'agent</Label>
                      <Textarea
                        id="crole-desc"
                        value={s.customRoleDescription}
                        onChange={(e) =>
                          set({ customRoleDescription: e.target.value })
                        }
                        rows={3}
                        placeholder="Décrivez ce que l'agent doit accomplir, son périmètre et ses règles clés."
                      />
                    </div>
                  </div>
                )}
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                title="Voix"
                description="Choisissez une voix entraînée au Studio, ou un préréglage."
              >
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
                      <option value="">— Aucune (utiliser un préréglage) —</option>
                      {studioVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.gender ? ` — ${GENDER_LABEL[v.gender] ?? v.gender}` : ""}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Vos voix produites au{" "}
                      <Link href="/voices" className="text-brand hover:underline">
                        Studio Voix
                      </Link>{" "}
                      — leurs réglages (hauteur, débit, voix) s'appliquent pendant les appels.
                    </p>
                  </div>
                )}
                <div
                  className={cn(
                    "space-y-4 transition-opacity",
                    isStudioVoice && "pointer-events-none opacity-50",
                  )}
                  aria-disabled={isStudioVoice}
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="voice">Voix de la plateforme</Label>
                      <Select
                        id="voice"
                        value={isStudioVoice ? "" : s.voiceId}
                        onChange={(e) => {
                          const pv = getPresetVoice(e.target.value);
                          set({
                            voiceId: e.target.value,
                            ...(pv ? { language: pv.language, speed: pv.rate } : {}),
                          });
                        }}
                      >
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lang">Langue</Label>
                      <Select
                        id="lang"
                        value={s.language}
                        onChange={(e) => set({ language: e.target.value })}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
                {/* Écoute d'un échantillon */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {selectedPreset
                        ? `Aperçu — ${selectedPreset.label}`
                        : "Aperçu de la voix"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedPreset?.description ??
                        s.firstMessage ??
                        "Bonjour, comment puis-je vous aider ?"}
                    </p>
                  </div>
                  <VoicePreview
                    text={s.firstMessage || "Bonjour, je suis votre agent vocal. Comment puis-je vous aider ?"}
                    language={s.language}
                    speed={s.speed}
                    pitch={selectedPreset?.pitch ?? 0}
                    gender={selectedPreset?.gender}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="speed">Débit de parole</Label>
                    <span className="mono text-xs text-muted-foreground">
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
                  <div className="flex justify-between text-[0.7rem] text-muted-foreground">
                    <span>Lent</span>
                    <span>Naturel</span>
                    <span>Rapide</span>
                  </div>
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="Cerveau"
                description="Le modèle, l'ouverture de l'appel et les instructions."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Modèle</Label>
                    <Select
                      value={s.modelProvider}
                      onChange={(e) =>
                        changeModelProvider(e.target.value as ModelProvider)
                      }
                    >
                      {MODEL_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Select
                      value={s.modelId}
                      onChange={(e) => set({ modelId: e.target.value })}
                    >
                      {(MODELS[s.modelProvider] ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} — {m.note}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temp">Température</Label>
                    <span className="mono text-xs text-muted-foreground">
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
                  <div className="flex justify-between text-[0.7rem] text-muted-foreground">
                    <span>Précis & constant</span>
                    <span>Créatif & varié</span>
                  </div>
                </div>

                {/* Qui parle en premier */}
                <div className="space-y-2">
                  <Label>Qui parle en premier ?</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SpeakerCard
                      selected={s.firstSpeaker === "agent"}
                      onClick={() => set({ firstSpeaker: "agent" })}
                      icon={Megaphone}
                      title="L'agent"
                      note="Décroche et lance le message d'accueil"
                    />
                    <SpeakerCard
                      selected={s.firstSpeaker === "caller"}
                      onClick={() => set({ firstSpeaker: "caller" })}
                      icon={Ear}
                      title="L'appelant"
                      note="L'agent écoute d'abord, puis répond"
                    />
                  </div>
                </div>

                {s.firstSpeaker === "agent" && (
                  <div className="space-y-2">
                    <Label htmlFor="first-msg">Message d'accueil</Label>
                    <Textarea
                      id="first-msg"
                      value={s.firstMessage}
                      onChange={(e) => {
                        setFirstMsgDirty(true);
                        set({ firstMessage: e.target.value });
                      }}
                      rows={2}
                      placeholder={s.role ? ROLE_META[s.role].firstMessage : ""}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prompt">System prompt</Label>
                    <button
                      type="button"
                      onClick={regeneratePrompt}
                      disabled={!s.role}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand transition-colors hover:text-brand-700 disabled:opacity-50"
                    >
                      <RefreshCw className="size-3.5" />
                      Régénérer depuis le rôle
                    </button>
                  </div>
                  <Textarea
                    id="prompt"
                    value={s.systemPrompt}
                    onChange={(e) => {
                      setPromptDirty(true);
                      set({ systemPrompt: e.target.value });
                    }}
                    rows={12}
                    className="font-mono text-[0.8rem] leading-relaxed"
                  />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 text-brand" />
                    Généré automatiquement depuis le rôle. Modifiable librement.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="maxdur" className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground" />
                      Durée max (min, 0 = illimité)
                    </Label>
                    <Input
                      id="maxdur"
                      type="number"
                      min={0}
                      max={120}
                      value={s.maxDurationMin}
                      onChange={(e) =>
                        set({
                          maxDurationMin: Math.min(
                            120,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell
                title="Outils & garde-fous"
                description="Activez les actions de l'agent et fixez ses limites."
              >
                <div className="space-y-2">
                  <Label>Outils & fonctions (function calling)</Label>
                  <ToolsPicker
                    selected={s.tools}
                    onToggle={toggleTool}
                    roleDefaults={s.role ? ROLE_META[s.role].defaultTools : []}
                    customTools={customToolsState}
                    onCreated={(tool) => {
                      setCustomToolsState((list) => [tool, ...list]);
                      setS((prev) => ({
                        ...prev,
                        tools: prev.tools.includes(tool.name)
                          ? prev.tools
                          : [...prev.tools, tool.name],
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb">Base de connaissances (optionnel)</Label>
                  <Select
                    id="kb"
                    value={s.knowledgeBaseId}
                    onChange={(e) => set({ knowledgeBaseId: e.target.value })}
                  >
                    <option value="">Aucune</option>
                    {knowledgeBases.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    L'agent s'appuiera sur les documents de cette base pour
                    répondre (RAG).
                  </p>
                </div>
                <GuardrailsEditor
                  guardrails={s.guardrails}
                  onChange={(g) => set({ guardrails: g })}
                />
              </StepShell>
            )}

            {step === 5 && (
              <StepShell
                title="Téléphonie & mise en ligne"
                description="Assignez un numéro et choisissez l'état de l'agent."
              >
                <NumberPicker
                  value={s.phoneNumber}
                  ownNumber={agent?.phoneNumber ?? null}
                  usedNumbers={usedNumbers}
                  numbers={availableNumbers}
                  onChange={(n) => set({ phoneNumber: n })}
                />
                <div className="space-y-2">
                  <Label>État à l'enregistrement</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <OptionCard
                      selected={s.status === "active"}
                      onClick={() => set({ status: "active" })}
                      title="En ligne"
                      note="Décroche les appels"
                    />
                    <OptionCard
                      selected={s.status === "paused"}
                      onClick={() => set({ status: "paused" })}
                      title="En pause"
                      note="Configuré, inactif"
                    />
                    <OptionCard
                      selected={s.status === "draft"}
                      onClick={() => set({ status: "draft" })}
                      title="Brouillon"
                      note="Non déployé"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-50/40 p-3.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">
                    {isEdit ? (
                      <>
                        Vous pouvez{" "}
                        <Link
                          href={`/agents/${agent!.id}/test`}
                          className="font-medium text-brand hover:underline"
                        >
                          tester cet agent en direct
                        </Link>{" "}
                        (micro du navigateur) à tout moment.
                      </>
                    ) : (
                      <>
                        Une fois créé, vous pourrez{" "}
                        <strong>tester l'agent en direct</strong> dans le
                        navigateur (micro) avant de le déployer sur un vrai
                        numéro.
                      </>
                    )}
                  </p>
                </div>
              </StepShell>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                variant="ghost"
                onClick={() => setStep((n) => Math.max(1, n - 1))}
                disabled={step === 1}
              >
                <ArrowLeft className="size-4" />
                Précédent
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => submit(true)}
                  disabled={submitting || !s.name.trim() || !s.role}
                  title="Sauvegarder l'état actuel sans déployer"
                >
                  <FileText className="size-4" />
                  <span className="hidden sm:inline">Enregistrer le brouillon</span>
                  <span className="sm:hidden">Brouillon</span>
                </Button>
                {step < 5 ? (
                  <Button
                    variant="default"
                    onClick={() => setStep((n) => Math.min(5, n + 1))}
                    disabled={!canNext}
                  >
                    Continuer
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button variant="brand" onClick={() => submit(false)} disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {isEdit ? "Enregistrer" : "Créer l'agent"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aperçu en direct
            </p>
            <CallPreview
              name={s.name}
              role={previewRole}
              roleLabel={previewRoleLabel}
              firstMessage={s.firstMessage}
              firstSpeaker={s.firstSpeaker}
              voiceLabel={voiceLabel}
              language={s.language}
              modelLabel={modelLabel}
              temperature={s.temperature}
              toolsCount={s.tools.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Sous-éléments ----------------------------- */

function Stepper({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {STEPS.map((st, i) => {
        const done = st.n < step;
        const active = st.n === step;
        return (
          <div key={st.n} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStepClick(st.n)}
              disabled={st.n >= step}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "text-foreground hover:bg-accent"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[0.7rem] tabular",
                  active
                    ? "bg-background/20 text-background"
                    : done
                      ? "bg-brand text-white"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : st.n}
              </span>
              <span className="hidden sm:inline">{st.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-px w-3 bg-border sm:w-5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-brand bg-brand-50/40 ring-2 ring-brand/20"
          : "border-border bg-card hover:border-foreground/20",
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </button>
  );
}

function SpeakerCard({
  selected,
  onClick,
  icon: Icon,
  title,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Megaphone;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-brand bg-brand-50/40 ring-2 ring-brand/20"
          : "border-border bg-card hover:border-foreground/20",
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
          selected ? "bg-brand text-white" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}

function GuardrailsEditor({
  guardrails,
  onChange,
}: {
  guardrails: string[];
  onChange: (g: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Garde-fous</Label>
      <div className="space-y-2">
        {guardrails.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={g}
              onChange={(e) => {
                const next = [...guardrails];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder="Ex : ne jamais donner de conseil médical"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(guardrails.filter((_, j) => j !== i))}
              aria-label="Supprimer"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...guardrails, ""])}
      >
        <Plus className="size-4" />
        Ajouter un garde-fou
      </Button>
    </div>
  );
}

function NumberPicker({
  value,
  ownNumber,
  usedNumbers,
  numbers,
  onChange,
}: {
  value: string | null;
  ownNumber: string | null;
  usedNumbers: string[];
  numbers: PhoneNumberRecord[];
  onChange: (n: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Numéro de téléphone</Label>
        <Link
          href="/numbers"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-700"
        >
          <Plus className="size-3" />
          Ajouter un numéro
        </Link>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
            value === null
              ? "border-brand bg-brand-50/40 ring-2 ring-brand/20"
              : "border-border bg-card hover:border-foreground/20",
          )}
        >
          <PhoneOff className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Aucun numéro pour l'instant
          </span>
        </button>
        {numbers.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-3 text-xs text-muted-foreground">
            Aucun numéro disponible. Ajoutez-en un depuis la page Numéros
            (Twilio, Zadarma…).
          </p>
        )}
        {numbers.map((num) => {
          const taken =
            usedNumbers.includes(num.number) && num.number !== ownNumber;
          const selected = value === num.number;
          return (
            <button
              key={num.number}
              type="button"
              disabled={taken}
              onClick={() => onChange(num.number)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                selected
                  ? "border-brand bg-brand-50/40 ring-2 ring-brand/20"
                  : "border-border bg-card hover:border-foreground/20",
                taken && "cursor-not-allowed opacity-50 hover:border-border",
              )}
            >
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="mono block text-sm font-medium text-foreground">
                  {num.number}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {num.label} · {num.provider}
                </span>
              </span>
              {taken ? (
                <span className="text-xs text-muted-foreground">Occupé</span>
              ) : (
                <span className="mono text-xs text-muted-foreground">
                  {num.monthlyPrice} €/mois
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
