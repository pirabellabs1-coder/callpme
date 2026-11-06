/**
 * Règles métier des voix maison — module pur (aucun accès base ni réseau).
 *
 * Principe : pas de voix sans consentement. Un consentement absent ou révoqué
 * bloque l'ajout de clips, l'entraînement et la publication.
 */

/** Version du formulaire de consentement (modèle dans docs/voix-maison.md, annexe A). */
export const CONSENT_FORM_VERSION = "2026-11-v1";

/** Limites d'un clip (le corps d'une requête Vercel est limité à ~4,5 Mo). */
export const CLIP_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  minMs: 1_000,
  maxMs: 30_000,
  transcriptMin: 2,
  transcriptMax: 500,
} as const;

export type ClipCheck =
  | { error: string }
  | { transcript: string; mime: string; durationMs: number };

/**
 * Valide un clip avant enregistrement. `mime` et `wav` viennent de l'analyse
 * des octets réels. Seul le WAV est accepté : sa durée est relue dans l'en-tête
 * côté serveur (aucune valeur fournie par le navigateur n'est crue).
 */
export function checkClip(input: {
  attested: boolean;
  transcript: string;
  mime: string | null;
  wav: { channels: number; sampleRate: number; durationMs: number } | null;
}): ClipCheck {
  if (!input.attested) return { error: "Attestation de consentement requise pour chaque clip." };
  const transcript = input.transcript.trim().replace(/\s+/g, " ");
  if (transcript.length < CLIP_LIMITS.transcriptMin || transcript.length > CLIP_LIMITS.transcriptMax) {
    return { error: `Transcription exacte requise (${CLIP_LIMITS.transcriptMin} à ${CLIP_LIMITS.transcriptMax} caractères).` };
  }
  if (input.mime !== "audio/wav" || !input.wav) {
    return { error: "Format refusé : WAV non compressé uniquement (ou enregistrez depuis la page)." };
  }
  if (input.wav.channels !== 1 || input.wav.sampleRate < 16_000) {
    return { error: "WAV attendu en mono, 16 kHz minimum (idéalement 24 ou 48 kHz)." };
  }
  const { durationMs } = input.wav;
  if (durationMs < CLIP_LIMITS.minMs || durationMs > CLIP_LIMITS.maxMs) {
    return { error: `Un clip doit durer entre ${CLIP_LIMITS.minMs / 1000} et ${CLIP_LIMITS.maxMs / 1000} secondes.` };
  }
  return { transcript, mime: input.mime, durationMs };
}

/** Plafond de clips par voix (≈ 3 h à 5 s par clip) : évite de gonfler la base. */
export const MAX_CLIPS_PER_VOICE = 2_500;

/** Document de consentement signé : PDF ou photo, 4 Mo maximum. */
export const CONSENT_DOC = {
  maxBytes: 4 * 1024 * 1024,
  mimes: ["application/pdf", "image/jpeg", "image/png"] as const,
};

/**
 * Minimum technique pour lancer un entraînement (Orpheus recommande ~300
 * exemples par locuteur). C'est un plancher : viser 1 à 3 h (voir la doc).
 */
export const TRAINING_MINIMUM = { clips: 300, durationMs: 30 * 60_000 } as const;

/**
 * Modèles de base proposés pour l'affinage — uniquement des licences qui
 * autorisent l'usage commercial (code ET poids). Voir docs/voix-maison.md.
 */
export const BASE_MODELS = [
  { id: "orpheus-fr", label: "Orpheus 3B français (Apache-2.0, base Llama 3.2) — recommandé" },
  { id: "chatterbox-multilingual", label: "Chatterbox Multilingual (MIT) — alternative" },
  { id: "styletts2", label: "StyleTTS 2 (MIT) — option légère" },
] as const;
export type BaseModelId = (typeof BASE_MODELS)[number]["id"];
export const isBaseModel = (id: string): id is BaseModelId => BASE_MODELS.some((m) => m.id === id);

export type JobStatus = "queued" | "submitted" | "running" | "succeeded" | "failed" | "canceled";
export const JOB_STATUSES: readonly JobStatus[] = ["queued", "submitted", "running", "succeeded", "failed", "canceled"];
export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["queued", "submitted", "running"];
export const isActiveJob = (s: string) => (ACTIVE_JOB_STATUSES as readonly string[]).includes(s);

const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["submitted", "running", "failed", "canceled"],
  submitted: ["running", "succeeded", "failed", "canceled"],
  running: ["running", "succeeded", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
};

/** Vrai si un entraînement peut passer de `from` à `to` (les états finaux sont figés). */
export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as JobStatus] ?? []).includes(to as JobStatus);
}

export interface ConsentState {
  revokedAt: Date | null;
}

/** Le consentement existe et n'a pas été révoqué. */
export const consentValid = (c: ConsentState | null | undefined): boolean => Boolean(c && !c.revokedAt);

export interface DatasetSummary {
  clips: number;
  durationMs: number;
}

/** Peut-on lancer un entraînement ? Renvoie le motif du refus, en clair. */
export function trainingBlocker(input: {
  consent: ConsentState | null | undefined;
  dataset: DatasetSummary;
  hasActiveJob: boolean;
}): string | null {
  if (!consentValid(input.consent)) return "Consentement signé requis (absent ou révoqué).";
  if (input.hasActiveJob) return "Un entraînement est déjà en cours pour cette voix.";
  const { clips, durationMs } = input.dataset;
  if (clips < TRAINING_MINIMUM.clips || durationMs < TRAINING_MINIMUM.durationMs) {
    const minutes = Math.round(TRAINING_MINIMUM.durationMs / 60_000);
    return `Jeu de données trop petit : ${TRAINING_MINIMUM.clips} clips et ${minutes} min minimum (actuellement ${clips} clips, ${formatDuration(durationMs)}).`;
  }
  return null;
}

/** Identifiant du modèle attribué par Callpme à l'entraînement : sert de voix au téléphone. */
export const modelRefForJob = (jobId: string) => `cpm_${jobId}`;

/** Même contrainte que `providerVoiceId` dans la configuration d'agent. */
export const MODEL_REF_RE = /^[A-Za-z0-9_-]{6,64}$/;

/** Durée lisible : « 12 min 05 s », « 45 s ». */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}

/** Texte d'aperçu par défaut (écoute admin et échantillon public). */
export const SAMPLE_TEXT =
  "Bonjour et bienvenue. Je suis l'assistante vocale de votre entreprise : comment puis-je vous aider aujourd'hui ?";
