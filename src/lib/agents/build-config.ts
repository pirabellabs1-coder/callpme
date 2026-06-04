/**
 * Construit une `AgentConfig` complète à partir du minimum (rôle + nom),
 * avec des valeurs par défaut sensées et des surcharges optionnelles.
 * Utilisé par l'API publique pour créer un agent en une ligne.
 */
import { ROLE_META } from "./roles";
import { generateSystemPrompt } from "./role-templates";
import type {
  AgentConfig,
  AgentRole,
  FirstSpeaker,
} from "../shared/types";

export interface ConfigOverrides {
  voice?: Partial<AgentConfig["voice"]>;
  model?: Partial<AgentConfig["model"]>;
  firstMessage?: string;
  firstSpeaker?: FirstSpeaker;
  guardrails?: string[];
  tools?: string[];
  persona?: string;
  customRole?: { label: string; description: string };
  maxDurationSec?: number;
}

export function buildDefaultConfig(
  role: AgentRole,
  agentName: string,
  organizationName: string,
  overrides: ConfigOverrides = {},
): AgentConfig {
  const meta = ROLE_META[role];
  const tools = overrides.tools ?? meta.defaultTools;
  const guardrails = overrides.guardrails ?? [];
  const firstSpeaker = overrides.firstSpeaker ?? "agent";

  return {
    voice: {
      provider: "elevenlabs",
      voiceId: "Adélaïde",
      language: "fr-FR",
      speed: 1,
      ...overrides.voice,
    },
    model: {
      provider: "openai",
      modelId: "gpt-4o",
      temperature: 0.4,
      ...overrides.model,
    },
    firstMessage: overrides.firstMessage ?? meta.firstMessage,
    firstSpeaker,
    guardrails,
    tools,
    persona: overrides.persona,
    customRole: overrides.customRole,
    maxDurationSec: overrides.maxDurationSec,
    systemPrompt: generateSystemPrompt({
      role,
      agentName,
      organizationName,
      guardrails,
      persona: overrides.persona,
      enabledTools: tools,
      firstSpeaker,
      customRole: overrides.customRole,
    }),
  };
}
