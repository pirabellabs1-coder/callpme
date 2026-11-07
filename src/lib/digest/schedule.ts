/**
 * Résumé quotidien : calcul de l'heure locale d'envoi par fuseau (module pur).
 */

export interface LocalParts {
  /** Jour local AAAA-MM-JJ (clé de dédoublonnage). */
  day: string;
  hour: number;
  minute: number;
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
}

/** Décalage du fuseau à cet instant, en millisecondes (heure locale − UTC). */
function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const [y, m, d] = p.day.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Minuit local du jour en cours, en instant UTC (début de la période résumée). */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  const [y, m, d] = localParts(date, timeZone).day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d) - offsetMs(date, timeZone);
  // Jour de changement d'heure : on corrige avec le décalage valable à minuit.
  return new Date(Date.UTC(y, m - 1, d) - offsetMs(new Date(guess), timeZone));
}

/**
 * Rattrapage : si un tour est manqué (serveur redémarré, cron en retard), le
 * résumé part encore dans les heures qui suivent, jamais le lendemain.
 */
export const DIGEST_CATCH_UP_HOURS = 3;

/** C'est l'heure d'envoyer le résumé de cette organisation ? */
export function isDigestDue(now: Date, hour: number, timeZone: string): boolean {
  const h = localParts(now, timeZone).hour;
  return h >= hour && h < hour + DIGEST_CATCH_UP_HOURS;
}
