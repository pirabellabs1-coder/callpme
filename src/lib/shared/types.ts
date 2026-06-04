/**
 * Types partagés Callpme — contrat unique entre l'UI, l'API et le futur
 * serveur vocal. (Équivalent du package `packages/shared` de la spec.)
 *
 * Tout est typé strictement pour permettre l'échange de providers
 * (LLM / STT / TTS) sans casser le reste de la plateforme.
 */

/* ------------------------------------------------------------------ */
/*  Rôles d'agent                                                      */
/* ------------------------------------------------------------------ */

/** Rôles prédéfinis (vitrine, filtres, analytics). */
export const AGENT_ROLES = [
  "support",
  "appointment",
  "lead_qualification",
  "outbound_sales",
  "receptionist",
  "survey",
] as const;

export type PredefinedRole = (typeof AGENT_ROLES)[number];

/** Un agent peut aussi avoir un rôle entièrement personnalisé. */
export type AgentRole = PredefinedRole | "custom";

export type AgentStatus = "active" | "paused" | "draft";

/** Qui parle en premier au décroché. */
export type FirstSpeaker = "agent" | "caller";

/* ------------------------------------------------------------------ */
/*  Configuration des providers                                        */
/* ------------------------------------------------------------------ */

export type VoiceProvider = "elevenlabs" | "azure" | "playht";
export type ModelProvider = "openai" | "anthropic" | "mistral";

export type SupportedLanguage =
  | "fr-FR"
  | "fr-BE"
  | "fr-CA"
  | "en-US"
  | "en-GB"
  | "es-ES"
  | "de-DE"
  | "it-IT"
  | "nl-NL";

export interface VoiceConfig {
  provider: VoiceProvider;
  voiceId: string;
  /** ex: "fr-FR" */
  language: SupportedLanguage | string;
  /** 0.8 – 1.2 */
  speed: number;
}

export interface ModelConfig {
  provider: ModelProvider;
  /** ex: gpt-4o, claude-sonnet-4, mistral-large */
  modelId: string;
  /** 0 – 1 */
  temperature: number;
}

/* ------------------------------------------------------------------ */
/*  Outils (function calling)                                          */
/* ------------------------------------------------------------------ */

export type JSONSchema = {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface JSONSchemaProperty {
  type: "string" | "number" | "boolean" | "integer";
  description?: string;
  enum?: string[];
}

/** Définition d'un outil exposé au LLM. */
export interface AgentToolDef {
  name: string;
  /** Libellé humain en français (UI). */
  label: string;
  /** Description orientée LLM (pour le function calling). */
  description: string;
  /** Catégorie pour le regroupement dans l'UI. */
  category: ToolCategory;
  parameters: JSONSchema;
  /** Icône Lucide associée (nom). */
  icon: string;
  /** Cet outil peut interrompre/terminer l'appel. */
  terminal?: boolean;
}

export type ToolCategory =
  | "telephonie"
  | "agenda"
  | "crm"
  | "commerce"
  | "communication"
  | "systeme";

export interface ToolResult {
  ok: boolean;
  /** Données structurées rendues au LLM. */
  data?: Record<string, unknown>;
  /** Message lisible (loggé dans le transcript). */
  message?: string;
}

/** Contexte passé au handler d'un outil pendant un appel. */
export interface ToolContext {
  agentId: string;
  organizationId: string;
  callId: string;
  callerNumber: string;
}

/* ------------------------------------------------------------------ */
/*  Configuration complète d'un agent                                  */
/* ------------------------------------------------------------------ */

/**
 * Stockée en base dans la colonne `config` (Json). Regroupe tout le
 * comportement de l'agent indépendamment de son identité (id, nom…).
 */
export interface AgentConfig {
  voice: VoiceConfig;
  model: ModelConfig;
  /** Généré depuis le rôle puis personnalisable. */
  systemPrompt: string;
  /** Ce que l'agent dit en décrochant (si l'agent parle en premier). */
  firstMessage: string;
  /** Qui prend la parole en premier au décroché. Défaut : l'agent. */
  firstSpeaker: FirstSpeaker;
  /** Garde-fous, ex : « ne jamais donner de conseil médical ». */
  guardrails: string[];
  /** Noms des outils activés (built-in + fonctions personnalisées). */
  tools: string[];
  /** Personnalité optionnelle injectée dans le prompt. */
  persona?: string;
  /** Définition du rôle personnalisé (uniquement si role === "custom"). */
  customRole?: { label: string; description: string };
  /** Durée maximale d'un appel en secondes (0 = illimité). */
  maxDurationSec?: number;
}

export interface Agent {
  id: string;
  organizationId: string;
  clientId?: string | null;
  knowledgeBaseId?: string | null;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  config: AgentConfig;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;

  /* Champs dérivés (joints à la lecture, non persistés tels quels) */
  callsToday?: number;
  callsTotal?: number;
  avgDurationSec?: number;
  resolutionRate?: number;
}

/* ------------------------------------------------------------------ */
/*  Appels                                                             */
/* ------------------------------------------------------------------ */

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "completed"
  | "transferred"
  | "failed"
  | "missed"
  | "in_progress";

export type TranscriptSpeaker = "agent" | "caller" | "system" | "tool";

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
  /** Décalage en secondes depuis le début de l'appel. */
  at: number;
  /** Renseigné pour les tours `tool`. */
  toolName?: string;
}

export interface Call {
  id: string;
  agentId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  status: CallStatus;
  durationSec: number;
  transcript: TranscriptTurn[];
  summary?: string | null;
  /** Issue métier : « RDV pris », « Commande retrouvée », « Transfert »… */
  outcome?: string | null;
  /** Satisfaction 1–5 si mesurée. */
  satisfaction?: number | null;
  createdAt: string;

  /* Champs joints */
  agentName?: string;
  agentRole?: AgentRole;
}

/* ------------------------------------------------------------------ */
/*  Organisation & utilisateurs (multi-tenant)                         */
/* ------------------------------------------------------------------ */

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  organizationId: string;
  role: OrgRole;
}

/* ------------------------------------------------------------------ */
/*  Numéros de téléphone & opérateurs                                  */
/* ------------------------------------------------------------------ */

export type TelephonyProvider =
  | "twilio"
  | "zadarma"
  | "vonage"
  | "ovh"
  | "telnyx"
  | "manual";

export interface PhoneNumberRecord {
  id: string;
  number: string;
  label: string;
  provider: TelephonyProvider;
  monthlyPrice: number;
  status: string;
  createdAt: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
}

export interface ProviderConnectionRecord {
  id: string;
  provider: TelephonyProvider;
  label: string;
  enabled: boolean;
  hasCredentials: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Fonctions personnalisées (function calling sur-mesure)             */
/* ------------------------------------------------------------------ */

export interface CustomToolRecord {
  id: string;
  name: string;
  label: string;
  description: string;
  parameters: JSONSchema;
  serverUrl: string | null;
  method: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  DTO de création / mise à jour d'agent (API)                        */
/* ------------------------------------------------------------------ */

export interface CreateAgentInput {
  name: string;
  role: AgentRole;
  status?: AgentStatus;
  config: AgentConfig;
  phoneNumber?: string | null;
  clientId?: string | null;
  knowledgeBaseId?: string | null;
}

export type UpdateAgentInput = Partial<CreateAgentInput>;
