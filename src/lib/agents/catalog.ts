/**
 * Catalogues de configuration présentés dans l'assistant de création :
 * providers et voix, langues, modèles LLM. Données statiques découplées du
 * code pour pouvoir évoluer sans toucher à l'UI.
 */

export const VOICE_PROVIDERS = [
  { id: "elevenlabs", label: "ElevenLabs", note: "Voix françaises très naturelles" },
  { id: "azure", label: "Azure Neural", note: "Large couverture linguistique" },
  { id: "playht", label: "PlayHT", note: "Latence très faible" },
] as const;

export interface VoiceOption {
  id: string;
  label: string;
  tone: string;
}

export const VOICES: Record<string, VoiceOption[]> = {
  elevenlabs: [
    { id: "Adélaïde", label: "Adélaïde", tone: "Chaleureuse" },
    { id: "Léon", label: "Léon", tone: "Posé" },
    { id: "Margaux", label: "Margaux", tone: "Dynamique" },
    { id: "Antoine", label: "Antoine", tone: "Professionnel" },
    { id: "Clémence", label: "Clémence", tone: "Souriante" },
  ],
  azure: [
    { id: "DeniseNeural", label: "Denise", tone: "Claire" },
    { id: "HenriNeural", label: "Henri", tone: "Grave" },
    { id: "BrigitteNeural", label: "Brigitte", tone: "Rassurante" },
  ],
  playht: [
    { id: "fr-amelie", label: "Amélie", tone: "Douce" },
    { id: "fr-lucas", label: "Lucas", tone: "Assuré" },
  ],
};

export const LANGUAGES = [
  { id: "fr-FR", label: "Français (France)" },
  { id: "fr-BE", label: "Français (Belgique)" },
  { id: "fr-CA", label: "Français (Canada)" },
] as const;

export const MODEL_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "mistral", label: "Mistral AI" },
] as const;

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export const MODELS: Record<string, ModelOption[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o", note: "Équilibré, multimodal" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", note: "Rapide et économique" },
  ],
  anthropic: [
    { id: "claude-sonnet-4", label: "Claude Sonnet 4", note: "Raisonnement solide" },
    { id: "claude-haiku-4", label: "Claude Haiku 4", note: "Très faible latence" },
  ],
  mistral: [
    { id: "mistral-large", label: "Mistral Large", note: "Souverain et performant" },
    { id: "mistral-small", label: "Mistral Small", note: "Léger et rapide" },
  ],
};

export function languageLabel(id: string): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}
