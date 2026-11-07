/**
 * État, valeurs initiales, validation par étape et construction du payload
 * de l'assistant agent. Le payload envoyé à l'API est strictement identique
 * à celui de l'ancienne version monolithique.
 */
import type {
  Agent,
  AgentConfig,
  BookingConfig,
  CallbackConfig,
  WhatsAppReplyMode,
  AgentRole,
  AgentStatus,
  FirstSpeaker,
  ModelProvider,
  VoiceProvider,
} from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { callbackSettings, DEFAULT_CALLBACK } from "@/lib/callbacks/settings";
import { bilingualRequired, defaultGreeting, effectiveBilingual, isRejectedLanguage, voiceLanguage } from "@/lib/voice-engine/languages";
import { DEFAULT_REPLY_MODE } from "@/lib/whatsapp/reply-mode";
import type { ExtractField } from "@/lib/analysis/fields";
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
  /** Langue locale : l'appelant peut mélanger le français et la langue locale. */
  bilingual: boolean;
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
  /** Répondeur sur appel sortant. */
  voicemailAction: "message" | "hangup" | "off";
  voicemailMessage: string;
  /** Rappel automatique des bips et appels manqués. */
  callback: CallbackConfig;
  /** Réponses WhatsApp : en note vocale, par écrit, ou comme la personne. */
  whatsappReplyMode: WhatsAppReplyMode;
  /** Analyse de fin d'appel. */
  analysisFields: ExtractField[];
  successCriteria: string;
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
  /** Voix clonée ou ajoutée par ID : utilisée telle quelle au téléphone. */
  providerVoiceId?: string;
  description?: string | null;
  accent?: string | null;
  /** Voix du catalogue de la plateforme (sinon voix propre à l'organisation). */
  catalog?: boolean;
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
      bilingual: agent.config.voice.bilingual ?? false,
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
      voicemailAction: agent.config.voicemail?.action ?? "message",
      voicemailMessage: agent.config.voicemail?.message ?? "",
      callback: callbackSettings(agent.config.callback),
      whatsappReplyMode: agent.config.whatsapp?.replyMode ?? DEFAULT_REPLY_MODE,
      analysisFields: agent.config.analysis?.fields ?? [],
      successCriteria: agent.config.analysis?.successCriteria ?? "",
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
    // Choisie à l'étape « Voix » (première voix du catalogue par défaut).
    voiceId: "",
    language: "fr-FR",
    bilingual: false,
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
    voicemailAction: "message",
    voicemailMessage: "",
    callback: { ...DEFAULT_CALLBACK },
    whatsappReplyMode: DEFAULT_REPLY_MODE,
    analysisFields: [],
    successCriteria: "",
    knowledgeBaseId: "",
  };
}

/**
 * Accueil proposé pour un rôle dans une langue : en français, celui du rôle
 * (ou du modèle choisi) ; dans une autre langue, un accueil court dans la langue.
 */
export function greetingFor(
  role: AgentRole | null,
  language: string,
  names: { agentName?: string; organizationName?: string },
  opts: { bilingual?: boolean; frenchDefault?: string } = {},
): string {
  const local = defaultGreeting(language, names, effectiveBilingual(language, opts.bilingual));
  if (local) return local;
  return opts.frenchDefault || (role ? ROLE_META[role].firstMessage : "");
}

/** Ce qui sert à proposer l'accueil : l'entreprise et le modèle de départ éventuel. */
export interface GreetingContext {
  organizationName?: string;
  template?: { role: AgentRole; firstMessage: string };
}

/** Accueil proposé pour l'état courant de l'assistant (langue, rôle, noms). */
export function suggestedGreeting(st: WizardState, ctx: GreetingContext = {}, role: AgentRole | null = st.role): string {
  return greetingFor(role, st.language, { agentName: st.name.trim(), organizationName: ctx.organizationName }, {
    bilingual: st.bilingual,
    frenchDefault: ctx.template && role === ctx.template.role ? ctx.template.firstMessage : undefined,
  });
}

/**
 * Applique un changement (rôle, langue, mode bilingue, nom) et fait suivre
 * l'accueil, sauf s'il a été réécrit à la main (`dirty`) ou sans rôle choisi.
 */
export function followGreeting(
  prev: WizardState,
  patch: Partial<WizardState>,
  dirty: boolean,
  ctx: GreetingContext = {},
): WizardState {
  const next = { ...prev, ...patch };
  if (dirty || !next.role) return next;
  return { ...next, firstMessage: suggestedGreeting(next, ctx) };
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
    else if (isRejectedLanguage(s.language))
      e.language = "Cette langue n'est pas encore disponible au téléphone. Choisissez-en une autre.";
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

type VoiceConfigProvider = AgentConfig["voice"]["provider"];

export function buildPayload(
  s: WizardState & { role: AgentRole },
  opts: {
    asDraft: boolean;
    studio?: StudioVoiceOption;
    /** Pour l'accueil de repli : le même que celui proposé à l'écran. */
    greeting?: GreetingContext;
  },
) {
  const { studio } = opts;
  const config: AgentConfig = {
    voice: {
      provider: studio?.providerVoiceId ? (studio.provider as VoiceConfigProvider) : s.voiceProvider,
      voiceId: s.voiceId,
      ...(studio?.providerVoiceId ? { providerVoiceId: studio.providerVoiceId } : {}),
      language: s.language,
      ...(voiceLanguage(s.language)?.local ? { bilingual: s.bilingual || bilingualRequired(s.language) } : {}),
      speed: s.speed,
      kind: studio ? (studio.providerVoiceId ? "provider" : "custom") : "preset",
      // Voix enregistrée au Studio : on embarque l'enregistrement réel pour qu'il soit rejoué tel quel.
      sampleUrl: studio && !studio.catalog ? (studio.sampleUrl ?? null) : null,
      voiceLabel: studio?.name,
    },
    model: {
      provider: s.modelProvider,
      modelId: s.modelId,
      temperature: s.temperature,
    },
    systemPrompt: s.systemPrompt,
    firstMessage: s.firstMessage || suggestedGreeting(s, opts.greeting),
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
    analysis: {
      // Lignes sans nom ignorées ; valeurs de choix dédoublonnées.
      fields: s.analysisFields
        .filter((f) => f.label.trim())
        .map((f) => ({
          ...f,
          label: f.label.trim(),
          ...(f.type === "choice" ? { options: Array.from(new Set(f.options ?? [])).filter(Boolean) } : {}),
        })),
      ...(s.successCriteria.trim() ? { successCriteria: s.successCriteria.trim() } : {}),
    },
    voicemail: {
      action: s.voicemailAction,
      ...(s.voicemailMessage.trim() ? { message: s.voicemailMessage.trim().slice(0, 600) } : {}),
    },
    callback: callbackSettings(s.callback),
    whatsapp: { replyMode: s.whatsappReplyMode },
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
