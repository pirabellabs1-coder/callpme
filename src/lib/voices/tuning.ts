/**
 * Réglages Studio d'une voix : les vrais paramètres ElevenLabs (stabilité,
 * ressemblance, style, vitesse, amplification) et un dictionnaire de
 * prononciation (mot écrit → façon de le dire). Module pur, utilisable côté
 * client comme côté serveur et moteur vocal.
 */
import { z } from "zod";

export interface VoiceTuning {
  /** 0 = expressive et variable, 1 = très régulière. */
  stability: number;
  /** Fidélité au timbre d'origine (0 – 1). */
  similarity: number;
  /** Exagération du style / de l'émotion (0 – 1). Coûte un peu de latence. */
  style: number;
  /** Vitesse de parole (0.7 – 1.2). */
  speed: number;
  /** Renforce la ressemblance au timbre d'origine. */
  speakerBoost: boolean;
}

export interface Pronunciation {
  /** Mot tel qu'il est écrit (ex. « Cotonou », « MTN »). */
  word: string;
  /** Façon de le prononcer (ex. « Ko-to-nou », « èm-té-ène »). */
  say: string;
}

export const DEFAULT_TUNING: VoiceTuning = { stability: 0.5, similarity: 0.75, style: 0, speed: 1, speakerBoost: true };

/** Points de départ proposés dans le Studio. */
export const TUNING_PRESETS: { key: string; label: string; hint: string; tuning: VoiceTuning }[] = [
  { key: "natural", label: "Naturelle", hint: "Équilibrée, convient à tout.", tuning: DEFAULT_TUNING },
  { key: "calm", label: "Posée", hint: "Régulière et rassurante (support, santé).", tuning: { stability: 0.75, similarity: 0.8, style: 0, speed: 0.92, speakerBoost: true } },
  { key: "warm", label: "Chaleureuse", hint: "Plus d'expression, accueil souriant.", tuning: { stability: 0.4, similarity: 0.75, style: 0.25, speed: 1, speakerBoost: true } },
  { key: "dynamic", label: "Dynamique", hint: "Vive et énergique (vente, relance).", tuning: { stability: 0.3, similarity: 0.7, style: 0.4, speed: 1.08, speakerBoost: true } },
];

const unit = z.number().min(0).max(1);
export const tuningSchema = z.object({
  stability: unit,
  similarity: unit,
  style: unit,
  speed: z.number().min(0.7).max(1.2),
  speakerBoost: z.boolean(),
});

export const MAX_PRONUNCIATIONS = 50;
export const pronunciationsSchema = z
  .array(
    z.object({
      word: z.string().trim().min(1).max(40),
      say: z.string().trim().min(1).max(80),
    }),
  )
  .max(MAX_PRONUNCIATIONS);

const clamp = (n: unknown, min: number, max: number, dflt: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;

/** Réglages lus depuis du JSON non fiable : toujours dans les bornes. */
export function normalizeTuning(raw: unknown, speedFallback?: number): VoiceTuning {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VoiceTuning, unknown>>;
  return {
    stability: clamp(t.stability, 0, 1, DEFAULT_TUNING.stability),
    similarity: clamp(t.similarity, 0, 1, DEFAULT_TUNING.similarity),
    style: clamp(t.style, 0, 1, DEFAULT_TUNING.style),
    speed: clamp(t.speed ?? speedFallback, 0.7, 1.2, DEFAULT_TUNING.speed),
    speakerBoost: typeof t.speakerBoost === "boolean" ? t.speakerBoost : DEFAULT_TUNING.speakerBoost,
  };
}

export function normalizePronunciations(raw: unknown): Pronunciation[] {
  const parsed = pronunciationsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Paramètres `voice_settings` de l'API ElevenLabs. */
export function elevenLabsSettings(t: VoiceTuning) {
  return {
    stability: t.stability,
    similarity_boost: t.similarity,
    style: t.style,
    use_speaker_boost: t.speakerBoost,
    speed: t.speed,
  };
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remplace chaque mot du dictionnaire par sa prononciation, mot entier et sans
 * tenir compte de la casse (« cotonou » comme « Cotonou »). Les entrées les
 * plus longues passent d'abord (« MTN Bénin » avant « MTN »).
 */
export function applyPronunciations(text: string, list: Pronunciation[] | undefined): string {
  if (!list?.length || !text) return text;
  const sorted = [...list].filter((p) => p.word.trim()).sort((a, b) => b.word.length - a.word.length);
  if (!sorted.length) return text;
  const map = new Map(sorted.map((p) => [p.word.trim().toLocaleLowerCase("fr"), p.say]));
  const rx = new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map((p) => escapeRx(p.word.trim())).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return text.replace(rx, (m) => map.get(m.toLocaleLowerCase("fr")) ?? m);
}

/** Réglages enregistrés dans `Voice.settings` (JSON) pour une voix du Studio. */
export interface StudioVoiceSettings {
  externalVoiceId?: string;
  /** Voix du catalogue Callpme à l'origine de cette voix. */
  baseVoiceId?: string;
  tuning: VoiceTuning;
  /** Des réglages ont été enregistrés (sinon : réglages par défaut). */
  customTuning: boolean;
  pronunciations: Pronunciation[];
}

export function parseStudioSettings(settings: string | null | undefined): StudioVoiceSettings {
  let raw: Record<string, unknown> = {};
  try {
    raw = settings ? (JSON.parse(settings) as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const ext = typeof raw.externalVoiceId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(raw.externalVoiceId) ? raw.externalVoiceId : undefined;
  return {
    externalVoiceId: ext,
    baseVoiceId: typeof raw.baseVoiceId === "string" ? raw.baseVoiceId : undefined,
    tuning: normalizeTuning(raw.tuning),
    customTuning: Boolean(raw.tuning && typeof raw.tuning === "object"),
    pronunciations: normalizePronunciations(raw.pronunciations),
  };
}
