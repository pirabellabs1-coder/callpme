/**
 * Versions d'un agent : chaque changement de comportement enregistre la
 * configuration (historique, restauration, test A/B). Les réglages de canal
 * (bouton du site, test A/B lui-même) ne font pas partie d'une version.
 */
import type { AgentConfig } from "../shared/types";

/** Clés qui décrivent le comportement de l'agent (ce qu'une version capture et restaure). */
export const BEHAVIOR_KEYS = [
  "systemPrompt",
  "firstMessage",
  "firstSpeaker",
  "guardrails",
  "tools",
  "persona",
  "customRole",
  "voice",
  "model",
  "flow",
  "analysis",
  "voicemail",
  "callback",
  "maxDurationSec",
  "transferNumber",
  "booking",
] as const satisfies readonly (keyof AgentConfig)[];

const LABELS: Record<(typeof BEHAVIOR_KEYS)[number], string> = {
  systemPrompt: "consignes",
  firstMessage: "message d'accueil",
  firstSpeaker: "premier à parler",
  guardrails: "garde-fous",
  tools: "outils",
  persona: "personnalité",
  customRole: "rôle",
  voice: "voix",
  model: "modèle",
  flow: "parcours",
  analysis: "analyse",
  voicemail: "répondeur",
  callback: "rappel des appels manqués",
  maxDurationSec: "durée maximale",
  transferNumber: "numéro de transfert",
  booking: "agenda",
};

export function behaviorOf(config: AgentConfig): Partial<AgentConfig> {
  const out: Partial<AgentConfig> = {};
  for (const k of BEHAVIOR_KEYS) if (config[k] !== undefined) (out as Record<string, unknown>)[k] = config[k];
  return out;
}

/** Libellés des parties du comportement qui ont changé. */
export function behaviorChanges(before: AgentConfig, after: AgentConfig): string[] {
  return BEHAVIOR_KEYS.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)).map((k) => LABELS[k]);
}

/** Applique le comportement d'une version sur la config actuelle (canaux et test A/B conservés). */
export function applyBehavior(current: AgentConfig, version: AgentConfig): AgentConfig {
  const next: AgentConfig = { ...current };
  for (const k of BEHAVIOR_KEYS) (next as unknown as Record<string, unknown>)[k] = version[k];
  return next;
}

/** Variante d'un appel : B avec la probabilité `share` (en %), A sinon. */
export function pickVariant(share: number, rand = Math.random()): "A" | "B" {
  return rand * 100 < Math.min(50, Math.max(0, share)) ? "B" : "A";
}
