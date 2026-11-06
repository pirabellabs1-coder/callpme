/**
 * Heures locales <-> instants UTC pour un fuseau IANA quelconque
 * (Europe/Paris, Africa/Abidjan, America/Montreal…), sans dépendance.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ZonedParts {
  /** AAAA-MM-JJ */
  ymd: string;
  /** HH:MM */
  hm: string;
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
}

function rawParts(date: Date, tz: string): Record<string, string> {
  const p: Record<string, string> = {};
  for (const part of formatter(tz).formatToParts(date)) p[part.type] = part.value;
  return p;
}

/** Fuseau valide ? (sinon Intl lève une exception) */
export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function utcToZoned(date: Date, tz: string): ZonedParts {
  const p = rawParts(date, tz);
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hm: `${p.hour}:${p.minute}`,
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Décalage (ms) du fuseau par rapport à UTC à cet instant. */
function offsetMs(date: Date, tz: string): number {
  const p = rawParts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** « AAAA-MM-JJ » + « HH:MM » dans le fuseau `tz` -> instant UTC. */
export function zonedToUtc(ymd: string, hm: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(new Date(guess), tz);
  // Second passage : corrige un changement d'heure entre les deux estimations.
  return new Date(guess - offsetMs(new Date(first), tz));
}

/** Jour de la semaine (0 = dimanche) d'une date « AAAA-MM-JJ ». */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Accepte « 14:30 », « 14h30 », « 14h », « 9:05 ». */
export function normalizeHm(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function hmOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Date lisible en français dans le fuseau donné (« jeudi 14 novembre à 16 h 30 »). */
export function spokenDateTime(date: Date, tz: string): string {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(date);
  const { hm } = utcToZoned(date, tz);
  const [h, m] = hm.split(":");
  return `${day} à ${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
}
