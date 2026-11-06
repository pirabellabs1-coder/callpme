/**
 * Fournisseurs de voix « par ID » (ElevenLabs, Cartesia, OpenAI).
 * Le catalogue de voix proposé aux clients est en base (PlatformVoice),
 * géré dans l'espace administrateur : voir lib/voices/platform.ts.
 */

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
