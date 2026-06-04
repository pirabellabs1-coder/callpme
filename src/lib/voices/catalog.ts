/**
 * Catalogue de voix de la plateforme.
 *
 * 17 voix prêtes à l'emploi couvrant toutes les catégories (femme / homme /
 * neutre × enfant / jeune / adulte / senior, plus accents et styles). Chaque
 * voix porte une signature audio distincte (hauteur + débit) pour sonner
 * réellement différemment lors des tests, même via la synthèse du navigateur.
 *
 * Quand une clé provider (ElevenLabs / Cartesia / OpenAI) est configurée, les
 * voix « par ID » utilisent l'audio réel du provider (voir lib/tts/providers).
 */

export type VoiceGender = "feminine" | "masculine" | "neutral";
export type VoiceAge = "child" | "young" | "adult" | "senior";

export interface PresetVoice {
  id: string;
  label: string;
  gender: VoiceGender;
  age: VoiceAge;
  language: string;
  category: string;
  description: string;
  /** Hauteur en demi-tons (-12..12) pour différencier le timbre en synthèse. */
  pitch: number;
  /** Débit de base. */
  rate: number;
}

export const VOICE_CATEGORIES = [
  "Femmes",
  "Hommes",
  "Enfants",
  "Voix neutres",
  "Accents & styles",
] as const;

export const PRESET_VOICES: PresetVoice[] = [
  // ---- Femmes ----
  { id: "lea", label: "Léa", gender: "feminine", age: "young", language: "fr-FR", category: "Femmes", description: "Commerciale, enthousiaste et rapide", pitch: 6, rate: 1.2 },
  { id: "claire", label: "Claire", gender: "feminine", age: "young", language: "fr-FR", category: "Femmes", description: "Jeune femme, claire et dynamique", pitch: 5, rate: 1.1 },
  { id: "amelie", label: "Amélie", gender: "feminine", age: "adult", language: "fr-FR", category: "Femmes", description: "Femme, chaleureuse et posée", pitch: 3, rate: 1.0 },
  { id: "garance", label: "Garance", gender: "feminine", age: "adult", language: "fr-FR", category: "Femmes", description: "Narratrice, lente et posée", pitch: 1, rate: 0.8 },
  { id: "ines", label: "Inès", gender: "feminine", age: "adult", language: "fr-FR", category: "Femmes", description: "Femme, voix grave et feutrée", pitch: -1, rate: 0.9 },
  { id: "sylvie", label: "Sylvie", gender: "feminine", age: "senior", language: "fr-FR", category: "Femmes", description: "Femme senior, douce et rassurante", pitch: -2, rate: 0.84 },

  // ---- Hommes ----
  { id: "lucas", label: "Lucas", gender: "masculine", age: "young", language: "fr-FR", category: "Hommes", description: "Jeune homme, énergique", pitch: -3, rate: 1.12 },
  { id: "marc", label: "Marc", gender: "masculine", age: "adult", language: "fr-FR", category: "Hommes", description: "Speaker radio, punchy et rapide", pitch: -4, rate: 1.18 },
  { id: "adam", label: "Adam", gender: "masculine", age: "adult", language: "fr-FR", category: "Hommes", description: "Support, calme et posé", pitch: -5, rate: 0.92 },
  { id: "thomas", label: "Thomas", gender: "masculine", age: "adult", language: "fr-FR", category: "Hommes", description: "Homme, assuré et professionnel", pitch: -6, rate: 0.96 },
  { id: "henri", label: "Henri", gender: "masculine", age: "senior", language: "fr-FR", category: "Hommes", description: "Homme senior, grave et lent", pitch: -8, rate: 0.82 },

  // ---- Enfants ----
  { id: "lina", label: "Lina", gender: "feminine", age: "child", language: "fr-FR", category: "Enfants", description: "Enfant, voix de fille", pitch: 9, rate: 1.06 },
  { id: "noah", label: "Noah", gender: "masculine", age: "child", language: "fr-FR", category: "Enfants", description: "Enfant, voix de garçon", pitch: 7, rate: 1.04 },

  // ---- Voix neutres ----
  { id: "nova", label: "Nova", gender: "neutral", age: "adult", language: "fr-FR", category: "Voix neutres", description: "Assistant, neutre et précis", pitch: 2, rate: 0.94 },
  { id: "alex", label: "Alex", gender: "neutral", age: "adult", language: "fr-FR", category: "Voix neutres", description: "Voix neutre, androgyne", pitch: 0, rate: 1.0 },

  // ---- Accents & styles ----
  { id: "beatrice", label: "Béatrice", gender: "feminine", age: "adult", language: "fr-CA", category: "Accents & styles", description: "Femme, accent québécois", pitch: 4, rate: 1.02 },
  { id: "julien", label: "Julien", gender: "masculine", age: "adult", language: "fr-BE", category: "Accents & styles", description: "Homme, accent belge", pitch: -7, rate: 0.98 },
];

export function getPresetVoice(id: string): PresetVoice | undefined {
  return PRESET_VOICES.find((v) => v.id === id);
}

export function presetsByCategory(): { category: string; voices: PresetVoice[] }[] {
  return VOICE_CATEGORIES.map((category) => ({
    category,
    voices: PRESET_VOICES.filter((v) => v.category === category),
  }));
}

export const GENDER_LABELS: Record<VoiceGender, string> = {
  feminine: "Féminine",
  masculine: "Masculine",
  neutral: "Neutre",
};

export const AGE_LABELS: Record<VoiceAge, string> = {
  child: "Enfant",
  young: "Jeune",
  adult: "Adulte",
  senior: "Senior",
};

/* ------------------------------------------------------------------ */
/*  Providers de voix « par ID » (clonage / voix premium)              */
/* ------------------------------------------------------------------ */

export type TtsProvider = "elevenlabs" | "cartesia" | "openai";

export const TTS_PROVIDERS: {
  id: TtsProvider;
  label: string;
  idLabel: string;
  idPlaceholder: string;
  note: string;
  envKey: string;
}[] = [
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    idLabel: "Voice ID ElevenLabs",
    idPlaceholder: "21m00Tcm4TlvDq8ikWAM",
    note: "Collez l'ID de la voix depuis votre tableau de bord ElevenLabs.",
    envKey: "ELEVENLABS_API_KEY",
  },
  {
    id: "cartesia",
    label: "Cartesia",
    idLabel: "Voice ID Cartesia",
    idPlaceholder: "a0e99841-438c-4a64-b679-ae501e7d6091",
    note: "Collez l'ID de la voix depuis Cartesia (Sonic).",
    envKey: "CARTESIA_API_KEY",
  },
  {
    id: "openai",
    label: "OpenAI",
    idLabel: "Voix OpenAI",
    idPlaceholder: "alloy",
    note: "Choisissez l'une des voix OpenAI (modèle tts-1).",
    envKey: "OPENAI_API_KEY",
  },
];

/** Voix nommées du provider OpenAI (modèle tts-1 / tts-1-hd). */
export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
] as const;

export function ttsProvider(id: string) {
  return TTS_PROVIDERS.find((p) => p.id === id);
}
