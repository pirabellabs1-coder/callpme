/**
 * État, valeurs initiales, validation par étape et construction du payload
 * de l'assistant agent. Le payload envoyé à l'API est strictement identique
 * à celui de l'ancienne version monolithique.
 */
import type {
  Agent,
  AgentConfig,
  BookingConfig,
  AgentRole,
  AgentStatus,
  FirstSpeaker,
  ModelProvider,
  VoiceProvider,
} from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import type { AgentTemplate } from "@/lib/agents/templates";
import type { PromptParams } from "@/lib/agents/role-templates";

export const STEPS = [
  { n: 1, label: "Rôle", title: "Identité & rôle" },
  { n: 2, label: "Voix", title: "Voix" },
  { n: 3, label: "Conversation", title: "Conversation" },
  { n: 4, label: "Outils", title: "Outils & garde-fous" },
  { n: 5, label: "Mise en ligne", title: "Téléphonie & mise en ligne" },
] as const;

export const LAST_STEP = STEPS.length;

export interface WizardState {
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
  /** Numéro de transfert vers un humain (E.164), vide = aucun. */
  transferNumber: string;
  /** Prise de rendez-vous (horaires, durée, SMS) ; null = réglages par défaut. */
  booking: BookingConfig | null;
  guardrails: string[];
  persona: string;
  tools: string[];
  phoneNumber: string | null;
  knowledgeBaseId: string;
}

export type SetWizardState = (patch: Partial<WizardState>) => void;

export interface StudioVoiceOption {
  id: string;
  name: string;
  gender: string | null;
  sampleUrl: string | null;
  provider?: string;
}

export function initialState(
  agent?: Agent,
  template?: AgentTemplate,
): WizardState {
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
      transferNumber: agent.config.transferNumber ?? "",
      booking: agent.config.booking ?? null,
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
    transferNumber: "",
    booking: null,
    knowledgeBaseId: "",
  };
}

export function promptParams(st: WizardState, orgName: string): PromptParams {
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

/* ------------------------------- Validation ------------------------------- */

/** Clé de champ -> message d'erreur. La clé sert aussi d'id DOM (`field-<clé>`). */
export type StepErrors = Partial<Record<string, string>>;

/** Limites alignées sur le schéma Zod de l'API (src/lib/validation/agent.ts). */
export function validateStep(step: number, s: WizardState): StepErrors {
  const e: StepErrors = {};
  if (step === 1) {
    if (!s.name.trim()) e.name = "Donnez un nom à votre agent.";
    if (!s.role) e.role = "Choisissez un rôle.";
    if (s.role === "custom" && !s.customRoleLabel.trim())
      e.customRoleLabel = "Nommez votre rôle personnalisé.";
  }
  if (step === 2) {
    if (!s.voiceId) e.voice = "Choisissez une voix.";
    if (!s.language) e.language = "Choisissez une langue.";
  }
  if (step === 3) {
    if (s.firstMessage.length > 2000)
      e.firstMessage =
        "Le message d'accueil ne doit pas dépasser 2 000 caractères.";
    if (!s.modelId) e.modelId = "Choisissez une version du modèle.";
    if (!s.systemPrompt.trim())
      e.systemPrompt =
        "Les instructions sont vides. Cliquez sur « Régénérer depuis le rôle » pour les recréer.";
    else if (s.systemPrompt.length > 20000)
      e.systemPrompt =
        "Les instructions ne doivent pas dépasser 20 000 caractères.";
  }
  if (step === 4) {
    if (s.guardrails.length > 30) e.guardrails = "30 garde-fous maximum.";
    else if (s.guardrails.some((g) => g.length > 500))
      e.guardrails = "Chaque garde-fou doit faire 500 caractères maximum.";
  }
  return e;
}

/** Première étape (dans [from, to]) contenant une erreur, ou null. */
export function firstInvalidStep(
  s: WizardState,
  from = 1,
  to: number = LAST_STEP,
): { step: number; errors: StepErrors } | null {
  for (let n = from; n <= to; n++) {
    const errors = validateStep(n, s);
    if (Object.keys(errors).length > 0) return { step: n, errors };
  }
  return null;
}

/* --------------------------------- Payload -------------------------------- */

export function buildPayload(
  s: WizardState & { role: AgentRole },
  opts: {
    asDraft: boolean;
    studio?: StudioVoiceOption;
    presetLabel?: string;
  },
) {
  const { studio } = opts;
  const config: AgentConfig = {
    voice: {
      provider: s.voiceProvider,
      voiceId: s.voiceId,
      language: s.language,
      speed: s.speed,
      kind: studio
        ? studio.provider && studio.provider !== "custom"
          ? "provider"
          : "custom"
        : "preset",
      // On embarque l'enregistrement réel pour qu'il soit rejoué tel quel.
      sampleUrl: studio?.sampleUrl ?? null,
      voiceLabel: studio?.name ?? opts.presetLabel,
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
    ...(s.transferNumber.trim() ? { transferNumber: s.transferNumber.trim() } : {}),
    ...(s.booking ? { booking: s.booking } : {}),
  };
  return {
    name: s.name.trim() || "Agent sans nom",
    role: s.role,
    status: opts.asDraft ? ("draft" as AgentStatus) : s.status,
    config,
    phoneNumber: s.phoneNumber,
    knowledgeBaseId: s.knowledgeBaseId || null,
  };
}
