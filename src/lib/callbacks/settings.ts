/**
 * Rappel automatique des bips et des appels manqués — réglages et règles
 * pures (testées), importables côté client.
 *
 * En Afrique de l'Ouest, beaucoup de gens « bipent » : ils laissent sonner une
 * fois et raccrochent pour être rappelés, sans payer l'appel. Deux modes :
 *  - « missed » : l'agent décroche normalement ; si l'appelant raccroche avant
 *    d'avoir parlé (bip, coupure), l'agent le rappelle ;
 *  - « flash »  : l'agent ne décroche pas (l'appelant ne paie rien) et rappelle
 *    aussitôt. Le rappel est un appel sortant, payé sur le crédit prépayé.
 */
import type { CallbackConfig } from "../shared/types";
import { systemPhrases } from "../voice-engine/languages";

export const DEFAULT_CALLBACK: CallbackConfig = {
  enabled: false,
  mode: "missed",
  delaySec: 30,
  maxPerDay: 2,
};

export const DEFAULT_CALLBACK_MESSAGE =
  "Bonjour, ici {agent} de {organisation}. Vous avez essayé de nous joindre il y a quelques instants, je vous rappelle. Comment puis-je vous aider ?";

/** Un rappel qui n'a pas pu partir dans ce délai n'a plus de sens : abandonné. */
export const CALLBACK_EXPIRE_MS = 20 * 60_000;
/** Tentatives par rappel (une relance si personne ne répond). */
export const CALLBACK_MAX_ATTEMPTS = 2;
/** Délai avant la relance d'un rappel sans réponse. */
export const CALLBACK_RETRY_MS = 5 * 60_000;
/** Plafond de rappels par organisation et par heure (protège le crédit d'une rafale de bips). */
export const CALLBACK_ORG_HOURLY_CAP = 40;
/** Plafond de rappels par organisation sur 24 h. */
export const CALLBACK_ORG_DAILY_CAP = 300;
/** Durée maximale d'une conversation de rappel (le crédit réservé suit ce plafond). */
export const CALLBACK_MAX_DURATION_SEC = 600;
/** Un rappel « en cours » sans nouvelles depuis ce délai est clos en échec. */
export const CALLBACK_STALE_MS = (CALLBACK_MAX_DURATION_SEC + 600) * 1000;
/** Un rappel « en cours » plus récent que ce délai bloque un nouveau rappel du même numéro. */
export const CALLBACK_CALLING_DEDUPE_MS = 3 * 60_000;
/** Sans tour de la file depuis ce délai, le moteur de rappel est considéré arrêté. */
export const CALLBACK_ENGINE_STALE_MS = 60_000;

export function callbackSettings(raw: Partial<CallbackConfig> | null | undefined): CallbackConfig {
  const s = { ...DEFAULT_CALLBACK, ...(raw ?? {}) };
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    enabled: s.enabled === true,
    mode: s.mode === "flash" ? "flash" : "missed",
    delaySec: Math.min(900, Math.max(10, Math.round(num(s.delaySec, DEFAULT_CALLBACK.delaySec)))),
    maxPerDay: Math.min(5, Math.max(1, Math.round(num(s.maxPerDay, DEFAULT_CALLBACK.maxPerDay)))),
    ...(s.message?.trim() ? { message: s.message.trim().slice(0, 400) } : {}),
  };
}

/** Première phrase de l'agent quand il rappelle (message par défaut dans la langue de l'agent). */
export function callbackGreeting(cfg: CallbackConfig, agentName: string, organizationName: string, language?: string): string {
  const phrases = systemPhrases(language);
  return (cfg.message?.trim() || phrases.callback)
    .replace(/\{agent\}/g, agentName)
    .replace(/\{organisation\}|\{entreprise\}/g, organizationName || phrases.ourTeam);
}

/** Contexte donné à l'agent pendant le rappel (faits, pas consignes de l'appelant). */
export const CALLBACK_CONTEXT =
  "## Rappel\nCette personne a appelé l'entreprise il y a quelques instants sans être jointe : " +
  "c'est toi qui la rappelles. Ne lui demande pas pourquoi tu appelles ; demande-lui comment l'aider. " +
  "Si elle n'a pas appelé ou ne souhaite pas être rappelée, excuse-toi et termine poliment l'appel.";

export type CallbackRefusal =
  | "disabled"
  | "mode"
  | "number"
  | "destination"
  | "own_number"
  | "opted_out"
  | "daily_limit"
  | "org_limit"
  | "credit"
  | "engine";

export const CALLBACK_REFUSAL_LABEL: Record<CallbackRefusal, string> = {
  disabled: "Rappel désactivé",
  mode: "Mode de rappel différent",
  number: "Numéro masqué ou invalide",
  destination: "Destination non couverte",
  own_number: "Numéro de la plateforme",
  opted_out: "Liste d'opposition",
  daily_limit: "Déjà rappelé aujourd'hui",
  org_limit: "Trop de rappels cette heure-ci",
  credit: "Crédit d'appels insuffisant",
  engine: "Moteur de rappel arrêté",
};

/**
 * Ce numéro peut-il être rappelé ? Vérifications sans base de données ;
 * les compteurs (jour, heure) sont fournis par l'appelant.
 */
export function callbackRefusal(input: {
  cfg: CallbackConfig;
  reason: "flash" | "missed";
  phone: string | null;
  destinationOpen: boolean;
  sentToday: number;
  sentThisHour: number;
  sentOrgToday?: number;
}): CallbackRefusal | null {
  if (!input.cfg.enabled) return "disabled";
  // Un bip non décroché n'existe qu'en mode « flash » ; un appel manqué se rappelle dans les deux modes.
  if (input.reason === "flash" && input.cfg.mode !== "flash") return "mode";
  if (!input.phone || !/^\+\d{8,15}$/.test(input.phone)) return "number";
  if (!input.destinationOpen) return "destination";
  if (input.sentToday >= input.cfg.maxPerDay) return "daily_limit";
  if (input.sentThisHour >= CALLBACK_ORG_HOURLY_CAP) return "org_limit";
  if ((input.sentOrgToday ?? 0) >= CALLBACK_ORG_DAILY_CAP) return "org_limit";
  return null;
}

/** Issue d'une tentative : statut final, ou relance planifiée. */
export function afterCallbackAttempt(
  status: "completed" | "no_answer" | "failed",
  attempts: number,
  now = new Date(),
  opts: { retry?: boolean } = {},
): { status: string; dueAt: Date | null } {
  if (status === "no_answer" && opts.retry !== false && attempts < CALLBACK_MAX_ATTEMPTS) {
    return { status: "pending", dueAt: new Date(now.getTime() + CALLBACK_RETRY_MS) };
  }
  return { status, dueAt: null };
}
