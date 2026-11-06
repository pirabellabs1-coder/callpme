/**
 * Réglages d'une campagne d'appels sortants — fonctions pures (testées),
 * importables côté client.
 *
 * Appeler des particuliers impose des plages horaires raisonnables (en France,
 * le démarchage téléphonique est encadré : jours ouvrés, 10 h–13 h et
 * 14 h–20 h). Les valeurs par défaut suivent ce cadre.
 */
import { utcToZoned, minutesOf, zonedToUtc } from "../agenda/time";

export interface CampaignSettings {
  /** Fuseau des personnes appelées. */
  timezone: string;
  /** Jours autorisés (0 = dimanche … 6 = samedi). */
  days: number[];
  /** Plages horaires autorisées, « HH:MM ». */
  windows: [string, string][];
  /** Appels simultanés au maximum. */
  maxConcurrent: number;
  /** Tentatives par contact (premier appel compris). */
  maxAttempts: number;
  /** Délai avant une nouvelle tentative, en minutes. */
  retryDelayMin: number;
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  timezone: "Europe/Paris",
  days: [1, 2, 3, 4, 5],
  windows: [
    ["10:00", "13:00"],
    ["14:00", "20:00"],
  ],
  maxConcurrent: 3,
  maxAttempts: 2,
  retryDelayMin: 120,
};

export function campaignSettings(raw: string | Partial<CampaignSettings> | null | undefined): CampaignSettings {
  let partial: Partial<CampaignSettings> = {};
  if (typeof raw === "string") {
    try {
      partial = JSON.parse(raw);
    } catch {
      partial = {};
    }
  } else if (raw) partial = raw;
  const s = { ...DEFAULT_CAMPAIGN_SETTINGS, ...partial };
  return {
    ...s,
    maxConcurrent: Math.min(20, Math.max(1, Math.round(s.maxConcurrent))),
    maxAttempts: Math.min(5, Math.max(1, Math.round(s.maxAttempts))),
    retryDelayMin: Math.min(10_080, Math.max(15, Math.round(s.retryDelayMin))),
    days: s.days.length ? s.days : DEFAULT_CAMPAIGN_SETTINGS.days,
    windows: s.windows.length ? s.windows : DEFAULT_CAMPAIGN_SETTINGS.windows,
  };
}

/** L'instant `now` est-il dans une plage autorisée ? */
export function inCallingWindow(now: Date, s: CampaignSettings): boolean {
  const z = utcToZoned(now, s.timezone);
  if (!s.days.includes(z.weekday)) return false;
  const t = minutesOf(z.hm);
  // Marge de 5 min avant la fin : un appel ne démarre pas à 19 h 59.
  return s.windows.some(([a, b]) => t >= minutesOf(a) && t < minutesOf(b) - 5);
}

/** Prochain début de plage autorisée (pour l'affichage « reprend à… »). */
export function nextWindowStart(now: Date, s: CampaignSettings): Date | null {
  for (let d = 0; d <= 8; d++) {
    const day = new Date(now.getTime() + d * 86_400_000);
    const z = utcToZoned(day, s.timezone);
    if (!s.days.includes(z.weekday)) continue;
    for (const [a] of [...s.windows].sort((x, y) => minutesOf(x[0]) - minutesOf(y[0]))) {
      const start = zonedToUtc(z.ymd, a, s.timezone);
      if (start.getTime() > now.getTime()) return start;
    }
  }
  return null;
}

/** Statuts de fin d'appel qui justifient une nouvelle tentative. */
export const RETRYABLE = new Set(["no_answer", "failed", "voicemail"]);

/**
 * Après un appel : statut final du contact, ou relance planifiée.
 * `attempts` = tentatives déjà effectuées (celle-ci comprise).
 */
export function afterAttempt(
  status: string,
  attempts: number,
  s: CampaignSettings,
  now = new Date(),
): { status: string; nextAttemptAt: Date | null } {
  if (RETRYABLE.has(status) && attempts < s.maxAttempts) {
    return { status, nextAttemptAt: new Date(now.getTime() + s.retryDelayMin * 60_000) };
  }
  return { status, nextAttemptAt: null };
}
